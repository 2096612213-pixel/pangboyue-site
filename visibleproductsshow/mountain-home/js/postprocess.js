/**
 * PostProcessPipeline - Feedback Afterimage & Velocity-Coupled Chromatic Aberration
 * Implements:
 * 1. Ping-Pong WebGL Frame Feedback (Ghost Trail / Motion Echo, 150 - 350ms lifespan)
 * 2. Optical Chromatic Aberration / RGB Split aligned with mountain velocity vector
 * 3. Composite layering with mountain depth occlusion for independently falling snow
 */
import { CONFIG } from './config.js';

export class PostProcessPipeline {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.width = width;
    this.height = height;

    // Fullscreen quad camera & scene
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadGeo = new THREE.PlaneGeometry(2, 2);

    this._initRenderTargets();
    this._initFeedbackPass();
    this._initChromaticPass();
    this._initCompositePass();
    // 仅写深度，不改变已合成的山体颜色；直接使用当前山体几何和震动后的变换。
    this.mountainDepthMaterial = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      blending: THREE.NoBlending
    });
  }

  _initRenderTargets() {
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.system.maxDPR);
    const w = Math.floor(this.width * dpr);
    const h = Math.floor(this.height * dpr);

    const rtParams = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      stencilBuffer: false,
      depthBuffer: false
    };

    // Mountain current frame target (transparent clear)
    this.rtMountainCurrent = new THREE.WebGLRenderTarget(w, h, { ...rtParams, depthBuffer: true });

    // Ping-pong targets for feedback afterimage
    this.rtFeedbackA = new THREE.WebGLRenderTarget(w, h, rtParams);
    this.rtFeedbackB = new THREE.WebGLRenderTarget(w, h, rtParams);

    // Target for post-chromatic mountain texture
    this.rtMountainProcessed = new THREE.WebGLRenderTarget(w, h, rtParams);

    // Clear all targets initially
    this.renderer.setRenderTarget(this.rtFeedbackA);
    this.renderer.clearColor();
    this.renderer.setRenderTarget(this.rtFeedbackB);
    this.renderer.clearColor();
    this.renderer.setRenderTarget(null);
  }

  _initFeedbackPass() {
    // Feedback / Afterimage Shader
    this.feedbackMat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tCurrent: { value: null },
        tPrev: { value: null },
        uDecay: { value: CONFIG.afterimage.decay },
        uMinThreshold: { value: CONFIG.afterimage.minThreshold },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tCurrent;
        uniform sampler2D tPrev;
        uniform float uDecay;
        uniform float uMinThreshold;
        varying vec2 vUv;

        void main() {
          vec4 curr = texture2D(tCurrent, vUv);
          vec4 prev = texture2D(tPrev, vUv);

          // Exponential trail decay
          vec4 trail = prev * uDecay;

          // Crisp resting cutoff so static image has zero smudge
          if (trail.a < uMinThreshold) {
            trail = vec4(0.0);
          }

          // Composite: current crisp mountain on top, fading ghost trail behind/around
          vec4 result;
          // 实体山面遮住残影，避免颜色累加使雪帽背光面泛白。
          result.rgb = curr.rgb + trail.rgb * (1.0 - curr.a);
          result.a = max(curr.a, trail.a * 0.95);

          gl_FragColor = result;
        }
      `
    });

    this.feedbackMesh = new THREE.Mesh(this.quadGeo, this.feedbackMat);
    this.feedbackScene = new THREE.Scene();
    this.feedbackScene.add(this.feedbackMesh);
  }

  _initChromaticPass() {
    // Optical Velocity-Coupled Chromatic Aberration Shader
    this.chromaticMat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tInput: { value: null },
        uOffset: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tInput;
        uniform vec2 uOffset;
        varying vec2 vUv;

        void main() {
          // If stationary, direct sample for razor-sharp fidelity
          if (length(uOffset) < 0.00002) {
            gl_FragColor = texture2D(tInput, vUv);
            return;
          }

          // Optical split:
          // Red shifts in +uOffset direction
          // Green remains at optical center
          // Blue/Cyan shifts in -uOffset direction
          vec4 rSample = texture2D(tInput, vUv + uOffset);
          vec4 gSample = texture2D(tInput, vUv);
          vec4 bSample = texture2D(tInput, vUv - uOffset);

          vec3 color = vec3(rSample.r, gSample.g, bSample.b);

          // Alpha blending for mountain silhouette fringes
          float alpha = max(gSample.a, max(rSample.a * 0.85, bSample.a * 0.85));

          gl_FragColor = vec4(color, alpha);
        }
      `
    });

    this.chromaticMesh = new THREE.Mesh(this.quadGeo, this.chromaticMat);
    this.chromaticScene = new THREE.Scene();
    this.chromaticScene.add(this.chromaticMesh);
  }

  _initCompositePass() {
    // Composite Shader: Blends processed mountain layer over background with proper alpha
    this.compositeMat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        tMountain: { value: null },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tMountain;
        varying vec2 vUv;

        void main() {
          vec4 mtn = texture2D(tMountain, vUv);
          if (mtn.a <= 0.001) discard;
          gl_FragColor = mtn;
        }
      `
    });

    this.compositeMesh = new THREE.Mesh(this.quadGeo, this.compositeMat);
    this.compositeScene = new THREE.Scene();
    this.compositeScene.add(this.compositeMesh);
  }

  resize(width, height) {
    this.width = width;
    this.height = height;

    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.system.maxDPR);
    const w = Math.floor(width * dpr);
    const h = Math.floor(height * dpr);

    this.rtMountainCurrent.setSize(w, h);
    this.rtFeedbackA.setSize(w, h);
    this.rtFeedbackB.setSize(w, h);
    this.rtMountainProcessed.setSize(w, h);
  }

  /**
   * 山体后期效果在离屏纹理中完成，合成到屏幕时不携带深度。
   * 只将实体山面重新写入屏幕深度，使每片雪按世界距离被近处山峰遮住。
   */
  _renderMountainDepth(mountainScene, camera) {
    const savedMask = camera.layers.mask;
    const savedOverride = mountainScene.overrideMaterial;
    try {
      camera.layers.set(1);
      mountainScene.overrideMaterial = this.mountainDepthMaterial;
      this.renderer.clearDepth();
      this.renderer.render(mountainScene, camera);
    } finally {
      camera.layers.mask = savedMask;
      mountainScene.overrideMaterial = savedOverride;
    }
  }

  /**
   * Execute the full rendering and post-processing pipeline
   * @param {Object} pipelineData
   */
  renderPipeline(pipelineData) {
    const {
      backgroundScene,
      mountainScene,
      snowScene,
      camera,
      shakeController,
      dt
    } = pipelineData;

    // ----------------------------------------------------
    // PASS 1: Render Mountain Scene into rtMountainCurrent
    // Clear color is transparent black (0,0,0,0)
    // ----------------------------------------------------
    this.renderer.setRenderTarget(this.rtMountainCurrent);
    this.renderer.setClearColor(0x000000, 0.0);
    this.renderer.clear();
    this.renderer.render(mountainScene, camera);

    // ----------------------------------------------------
    // PASS 2: Feedback Pass (Afterimage / Ghost Trail)
    // ----------------------------------------------------
    const decay = shakeController.getAfterimageDecay(dt);
    this.feedbackMat.uniforms.tCurrent.value = this.rtMountainCurrent.texture;
    this.feedbackMat.uniforms.tPrev.value = this.rtFeedbackA.texture;
    this.feedbackMat.uniforms.uDecay.value = decay;

    this.renderer.setRenderTarget(this.rtFeedbackB);
    this.renderer.render(this.feedbackScene, this.quadCamera);

    // Swap Feedback Ping-Pong targets
    const temp = this.rtFeedbackA;
    this.rtFeedbackA = this.rtFeedbackB;
    this.rtFeedbackB = temp;

    // ----------------------------------------------------
    // PASS 3: Chromatic Aberration Pass (RGB Split)
    // Offset scaled by instantaneous mountain velocity
    // ----------------------------------------------------
    const rgbSplit = shakeController.getRGBSplit();
    // rgbSplit provides normalized UV coordinates
    const uvOffsetX = rgbSplit.offsetX;
    const uvOffsetY = rgbSplit.offsetY;

    this.chromaticMat.uniforms.tInput.value = this.rtFeedbackA.texture;
    this.chromaticMat.uniforms.uOffset.value.set(uvOffsetX, uvOffsetY);

    this.renderer.setRenderTarget(this.rtMountainProcessed);
    this.renderer.render(this.chromaticScene, this.quadCamera);

    // ----------------------------------------------------
    // PASS 4: Render Background Scene (Sky + Sun) to Screen Canvas
    // The celestial sun is completely stable and clean!
    // ----------------------------------------------------
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(0x000000, 1.0);
    this.renderer.clear();
    this.renderer.render(backgroundScene, camera);

    // ----------------------------------------------------
    // PASS 5: Composite Processed Mountain on top of Background
    // Distant peaks naturally cut and occlude the lower edge of the sun!
    // ----------------------------------------------------
    this.renderer.autoClear = false;
    this.compositeMat.uniforms.tMountain.value = this.rtMountainProcessed.texture;
    this.renderer.render(this.compositeScene, this.quadCamera);

    // ----------------------------------------------------
    // PASS 6: 写入当前山体深度，再绘制远、中、近三层雪。
    // 雪片独立飘落，近处山面会逐像素挡住位于其后的雪。
    // ----------------------------------------------------
    this._renderMountainDepth(mountainScene, camera);
    this.renderer.render(snowScene, camera);
    this.renderer.autoClear = true;
  }
}
