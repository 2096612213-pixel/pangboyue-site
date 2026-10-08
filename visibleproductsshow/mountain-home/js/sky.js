/** 冷青天空：雾青山际向深青蓝天顶渐变，局部暗红日晕，静态细抖动消除色带。 */
import { CONFIG } from './config.js';

export class SkyAtmosphere {
  constructor(scene) {
    this.scene = scene;

    const geo = new THREE.PlaneGeometry(2, 2);
    this.mat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color(CONFIG.sky.topColor) },
        uMidColor: { value: new THREE.Color(CONFIG.sky.midColor) },
        uHorizonColor: { value: new THREE.Color(CONFIG.sky.horizonColor) },
        uWarmthColor: { value: new THREE.Color(CONFIG.sky.warmthColor) },
        uSunPosNorm: { value: new THREE.Vector2(0.76, 0.72) },
        uAspect: { value: 1 },
        uWarmthStrength: { value: CONFIG.sky.warmthStrength },
        uWarmthRadius: { value: CONFIG.sky.warmthRadius },
        uVignetteStrength: { value: CONFIG.sky.vignetteStrength },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.9999, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uWarmthColor;
        uniform vec2 uSunPosNorm;
        uniform float uAspect;
        uniform float uWarmthStrength;
        uniform float uWarmthRadius;
        uniform float uVignetteStrength;
        varying vec2 vUv;

        // Fast high-quality pseudo-random dithering
        float dither(vec2 coord) {
          return fract(sin(dot(coord, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
        }

        void main() {
          float y = vUv.y;
          
          // 将青色铺到山峰上方的可见天空，三个色阶平滑衔接。
          vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.08, 0.72, y));
          col = mix(col, uTopColor, smoothstep(0.55, 1.0, y));

          // 按真实宽高比计算日晕距离，横屏圆润，竖屏收拢。
          vec2 sunDelta = (vUv - uSunPosNorm) * vec2(uAspect, 1.0);
          float distSun = length(sunDelta);
          float warmth = exp(-2.0 * pow(distSun / uWarmthRadius, 2.0)) * uWarmthStrength;
          col += uWarmthColor * warmth;

          // 柔和暗角只收住边缘，不遮住冷青渐变。
          vec2 edge = (vUv - 0.5) * 2.0;
          float vignette = smoothstep(0.3, 1.6, dot(edge, edge));
          col *= 1.0 - vignette * uVignetteStrength;

          // Atmospheric dither (eliminates banding)
          col += (dither(gl_FragCoord.xy) / 255.0);

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });

    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.z = -50;
    this.mesh.renderOrder = -100; // Guaranteed bottom backdrop
    this.scene.add(this.mesh);
  }

  resize(width, height) {
    const isMobile = width < 768;
    const posXFrac = isMobile ? CONFIG.sun.mobilePosX : CONFIG.sun.posX;
    const posYFrac = isMobile ? CONFIG.sun.mobilePosY : CONFIG.sun.posY;

    // Convert centered coordinates [-0.5..0.5] to UV [0..1]
    const uX = 0.5 + posXFrac;
    const uY = 0.5 + posYFrac;

    this.mat.uniforms.uSunPosNorm.value.set(uX, uY);
    const aspect = width / Math.max(1, height);
    this.mat.uniforms.uAspect.value = aspect;
    this.mat.uniforms.uWarmthRadius.value = CONFIG.sky.warmthRadius * Math.min(1, aspect * 0.85);
  }
}
