/**
 * CelestialSun - Crimson Sun with Fine Equal-Interval Concentric Ripple Rings
 * and Synchronized Solar Emission Recoil Vibration.
 * Guarantees that at the exact mathematical moment a wave emerges, the sun jolts with recoil.
 */
import { CONFIG } from './config.js';

export class CelestialSun {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.baseX = 0;
    this.baseY = 0;
    this.sunRadiusNorm = 0.22;
    this.baseDiskDiameter = 100;
    this.baseGlowScale = 1.0;

    // Recoil state
    this.lastRingIndex = -1;
    this.recoilTimer = 999;
    this.recoilActive = false;
    this.recoilDirX = 0;
    this.recoilDirY = 1;
    this.musicDriven = false;
    this.recoilStrength = 1;
    this.lastMusicBeat = -Infinity;
    this.waveTimes = [];
    this.ringAges = new Float32Array(16).fill(-1);

    this._createAtmosphericGlow();
    this._createExpandingRippleRings();
    this._createSunDisk();
  }

  _createSunDisk() {
    const diskGeo = new THREE.PlaneGeometry(1, 1);
    const diskMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(CONFIG.sun.color) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          vec2 center = vUv - vec2(0.5);
          float dist = length(center) * 2.0;
          float edge = fwidth(dist);
          float alpha = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, dist);
          if (alpha <= 0.0) discard;
          gl_FragColor = vec4(uColor, alpha);
        }
      `
    });

    this.diskMesh = new THREE.Mesh(diskGeo, diskMat);
    this.diskMesh.position.z = -10.0;
    this.diskMesh.renderOrder = -48;
    this.group.add(this.diskMesh);
  }

  _createAtmosphericGlow() {
    const glowGeo = new THREE.PlaneGeometry(1, 1);
    const glowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uGlowColor: { value: new THREE.Color(CONFIG.sun.glowColor) },
        uIntensity: { value: CONFIG.sun.glowOpacity },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uGlowColor;
        uniform float uIntensity;
        varying vec2 vUv;
        void main() {
          vec2 center = vUv - vec2(0.5);
          float dist = length(center) * 2.0;
          if (dist > 1.0) discard;
          float falloff = pow(clamp(1.0 - dist, 0.0, 1.0), 2.2);
          float alpha = falloff * uIntensity;
          gl_FragColor = vec4(uGlowColor, alpha);
        }
      `
    });

    this.glowMesh = new THREE.Mesh(glowGeo, glowMat);
    this.glowMesh.position.z = -10.1;
    this.glowMesh.renderOrder = -50;
    this.group.add(this.glowMesh);
  }

  _createExpandingRippleRings() {
    // Equal-radius, fine concentric expanding rings shader
    // Mathematically synchronized with JS emission recoil
    const ringGeo = new THREE.PlaneGeometry(1, 1);
    const ringMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uMusicDriven: { value: 0 },
        uRingAges: { value: this.ringAges },
        uRingColor: { value: new THREE.Color(CONFIG.sun.rippleRings.color) },
        uOpacity: { value: CONFIG.sun.rippleRings.opacity },
        uPeriod: { value: CONFIG.sun.rippleRings.interval },
        uWavelength: { value: CONFIG.sun.rippleRings.wavelength },
        uThickness: { value: CONFIG.sun.rippleRings.thickness },
        uSunRadiusNorm: { value: 0.22 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uMusicDriven;
        uniform float uRingAges[16];
        uniform vec3 uRingColor;
        uniform float uOpacity;
        uniform float uPeriod;
        uniform float uWavelength;
        uniform float uThickness;
        uniform float uSunRadiusNorm;
        varying vec2 vUv;

        void main() {
          vec2 center = vUv - vec2(0.5);
          float dist = length(center) * 2.0;
          if (dist > 1.0) discard;

          // Don't draw inside the sun disk
          if (dist < uSunRadiusNorm) discard;

          // Outward distance traveled from sun edge
          float radialDist = dist - uSunRadiusNorm;

          float ring = 0.0;
          if (uMusicDriven > 0.5) {
            // 每个真实鼓点发出一圈日光波，传播半径从该鼓点时间独立计算。
            for (int i = 0; i < 16; i++) {
              float age = uRingAges[i];
              if (age >= 0.0) {
                float crest = uSunRadiusNorm + age * uWavelength / uPeriod;
                ring += 1.0 - smoothstep(0.0, uThickness * uWavelength, abs(dist - crest));
              }
            }
            ring = min(ring, 1.0);
          } else {
            float phase = (uTime / uPeriod) - (radialDist / uWavelength);
            float f = fract(phase);
            ring = 1.0 - smoothstep(0.0, uThickness, min(f, 1.0 - f));
          }

          // As rings expand outward from the sun, they fade away smoothly
          float fade = pow(clamp(1.0 - dist, 0.0, 1.0), 1.5);

          // Soft transition at sun edge so ring emerges gracefully
          float edgeAlpha = smoothstep(0.0, fwidth(dist) * 2.0, radialDist);

          float totalAlpha = ring * fade * edgeAlpha * uOpacity;
          gl_FragColor = vec4(uRingColor, totalAlpha);
        }
      `
    });

    this.rippleMesh = new THREE.Mesh(ringGeo, ringMat);
    this.rippleMesh.position.z = -10.05;
    this.rippleMesh.renderOrder = -49;
    this.group.add(this.rippleMesh);
  }

  resize(width, height) {
    const isMobile = width < 768;

    // Sun Disk Size
    const radiusFrac = isMobile ? CONFIG.sun.mobileRadius : CONFIG.sun.radius;
    this.baseDiskDiameter = height * radiusFrac * 2.0;
    this.diskMesh.scale.set(this.baseDiskDiameter, this.baseDiskDiameter, 1);

    // Large Atmospheric Glow Size
    const glowDiameter = height * CONFIG.sun.glowRadius * 2.0;
    // 窄屏将日晕限制在画面宽度附近，保留两侧天空的冷青色。
    const atmosphereDiameter = glowDiameter * Math.min(1, width / Math.max(1, height));
    this.glowMesh.scale.set(atmosphereDiameter, atmosphereDiameter, 1);

    // Expanding Ripple Halos Quad Size
    const rippleDiameter = glowDiameter * CONFIG.sun.rippleRings.maxRadiusMult;
    this.rippleMesh.scale.set(rippleDiameter, rippleDiameter, 1);

    this.sunRadiusNorm = this.baseDiskDiameter / rippleDiameter;
    if (this.rippleMesh.material.uniforms) {
      this.rippleMesh.material.uniforms.uSunRadiusNorm.value = this.sunRadiusNorm;
      this.rippleMesh.material.uniforms.uThickness.value = CONFIG.sun.rippleRings.thickness;
      this.rippleMesh.material.uniforms.uPeriod.value = CONFIG.sun.rippleRings.interval;
      this.rippleMesh.material.uniforms.uWavelength.value = CONFIG.sun.rippleRings.wavelength;
    }

    // Base Position (Upper Right)
    const posXFrac = isMobile ? CONFIG.sun.mobilePosX : CONFIG.sun.posX;
    const posYFrac = isMobile ? CONFIG.sun.mobilePosY : CONFIG.sun.posY;
    this.baseX = width * posXFrac;
    this.baseY = height * posYFrac;
    this.group.position.set(this.baseX, this.baseY, 0);
  }

  triggerSunRecoil(elapsed = 0) {
    this.recoilActive = true;
    this.recoilTimer = elapsed;
    // Pick an organic recoil impulse angle
    const angle = Math.random() * Math.PI * 2.0;
    this.recoilDirX = Math.cos(angle);
    this.recoilDirY = Math.sin(angle);
  }

  emitBeat(time, strength) {
    this.lastMusicBeat = time;
    this.recoilStrength = strength;
    this.triggerSunRecoil();
    this.recoilActive = strength > 0;
    this.waveTimes.push(time);
    if (this.waveTimes.length > 16) this.waveTimes.shift();
  }

  resetMusicPulse() {
    this.lastMusicBeat = -Infinity;
    this.recoilActive = false;
    this.waveTimes.length = 0;
    this.ringAges.fill(-1);
    this.diskMesh.position.x = this.diskMesh.position.y = 0;
    this.glowMesh.position.x = this.glowMesh.position.y = 0;
    this.diskMesh.scale.set(this.baseDiskDiameter, this.baseDiskDiameter, 1);
  }

  update(time, dt = 0.016, pulseIntensity = 0, musicTime = 0) {
    if (this.musicDriven) {
      this.recoilTimer = Math.max(0, musicTime - this.lastMusicBeat);
      this.ringAges.fill(-1);
      for (let i = 0; i < this.waveTimes.length; i++) this.ringAges[i] = Math.max(0, musicTime - this.waveTimes[i]);
    } else {
      const period = CONFIG.sun.rippleRings.interval;
      const index = Math.floor(time / period);
      const elapsed = time - index * period;
      if (index !== this.lastRingIndex) {
        this.recoilStrength = 1;
        this.triggerSunRecoil(elapsed);
        this.lastRingIndex = index;
      }
      this.recoilTimer = elapsed;
    }
    const uniforms = this.rippleMesh.material.uniforms;
    uniforms.uTime.value = time;
    uniforms.uMusicDriven.value = this.musicDriven ? 1 : 0;
    uniforms.uOpacity.value = CONFIG.sun.rippleRings.opacity * (1.0 + Math.abs(pulseIntensity) * 0.3);

    // 3. Solar Recoil Physics (Sudden shudder on ring emission)
    let recoilOffsetX = 0;
    let recoilOffsetY = 0;
    let scaleMultiplier = 1.0;

    if (this.recoilActive) {
      const t = this.recoilTimer;
      const decay = Math.exp(-(this.musicDriven ? 14.0 : CONFIG.sun.recoil.decaySpeed) * t);
      const frequency = this.musicDriven ? 42.0 : CONFIG.sun.recoil.frequency;

      if (t < (this.musicDriven ? 0.26 : 0.55)) {
        // High frequency seismic shudder
        const shudder = Math.cos(t * frequency) * decay;
        const amp = CONFIG.sun.recoil.amplitude * shudder * this.recoilStrength;
        recoilOffsetX = this.recoilDirX * amp;
        recoilOffsetY = this.recoilDirY * amp;

        // Visual scale pop on emission
        scaleMultiplier = 1.0 + CONFIG.sun.recoil.scaleKick * this.recoilStrength * decay * Math.cos(t * frequency * 0.5);
      } else {
        this.recoilActive = false;
      }
    }

    // Apply recoil position & scale to Sun
    // 只震动太阳及近身辉光，已经发出的日光波继续平稳向外传播。
    this.group.position.set(this.baseX, this.baseY, 0);
    this.diskMesh.position.x = recoilOffsetX;
    this.diskMesh.position.y = recoilOffsetY;
    this.glowMesh.position.x = recoilOffsetX;
    this.glowMesh.position.y = recoilOffsetY;
    const diskD = this.baseDiskDiameter * scaleMultiplier;
    this.diskMesh.scale.set(diskD, diskD, 1);

    // 4. Atmospheric glow gentle breathing on seismic pulse
    const breathe = 1.0 + Math.sin(time * 0.5) * 0.015 + pulseIntensity * CONFIG.sun.glowBreathing;
    this.glowMesh.material.uniforms.uIntensity.value = CONFIG.sun.glowOpacity * (1.0 + pulseIntensity * 0.28);
    this.glowMesh.scale.set(
      this.glowMesh.scale.x * (breathe / this.baseGlowScale),
      this.glowMesh.scale.y * (breathe / this.baseGlowScale),
      1
    );
    this.baseGlowScale = breathe;
  }
}
