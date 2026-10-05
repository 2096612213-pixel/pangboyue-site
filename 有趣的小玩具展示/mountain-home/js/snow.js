/**
 * SnowSystem - 按距离分层的斜向飘雪
 * - 从右上方沿独立直线向左下方飘落，三层雪拥有各自的远近位置。
 * - 每片雪的可见部分由当前实体山体深度决定，不会全部浮在山前。
 * - 雪保持独立运动，山体滚动或震动时实时更新遮挡。
 */
import { CONFIG } from './config.js';

export class SnowSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.layers = [];
    this.viewWidth = 1920;
    this.viewHeight = 1080;
  }

  rebuild(width, height) {
    this.viewWidth = width;
    this.viewHeight = height;

    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
    this.layers = [];

    // 1. Distant Snow Layer (Fast micro-snow)
    this._createTier({
      count: CONFIG.snow.layerFarCount,
      size: 2.2,
      speedMult: 0.70,
      z: -25,
      softness: 0.2,
      opacity: 0.45
    });

    // 2. Midground Snow Layer (Moderate flakes)
    this._createTier({
      count: CONFIG.snow.layerMidCount,
      size: 4.8,
      speedMult: 1.05,
      z: 0,
      softness: 0.45,
      opacity: 0.80
    });

    // 3. Foreground Snow Layer (Large flakes with soft bokeh DoF blur)
    this._createTier({
      count: CONFIG.snow.layerNearCount,
      size: 15.0,
      speedMult: 1.45,
      z: 20,
      softness: 0.85,
      opacity: 0.55
    });
  }

  _createTier(opts) {
    const { count, size, speedMult, z, softness, opacity } = opts;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 2); // [0] = vx, [1] = vy
    const scales = new Float32Array(count);

    const w = this.viewWidth * 1.8;
    const h = this.viewHeight * 1.6;

    const baseAngleRad = (CONFIG.snow.angleBaseDeg * Math.PI) / 180.0;
    const spreadRad = (CONFIG.snow.angleSpreadDeg * Math.PI) / 180.0;

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * w;
      positions[i * 3 + 1] = (Math.random() - 0.5) * h;
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 6;

      // Calculate straight-line trajectory vector pointing from upper-right to lower-left
      const angle = baseAngleRad + (Math.random() - 0.5) * spreadRad;
      const speed = CONFIG.snow.baseSpeed * speedMult * (0.80 + Math.random() * 0.45);

      velocities[i * 2 + 0] = Math.cos(angle) * speed; // Negative (towards left)
      velocities[i * 2 + 1] = Math.sin(angle) * speed; // Negative (towards bottom)

      scales[i] = 0.70 + Math.random() * 0.60;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: true, // 每片雪按自身 z 距离与实体山面比较，被挡住的部分不绘制。
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uBaseSize: { value: size },
        uSoftness: { value: softness },
        uOpacity: { value: opacity }
      },
      vertexShader: `
        attribute float aScale;
        uniform float uBaseSize;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uBaseSize * aScale;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uSoftness;
        uniform float uOpacity;
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center) * 2.0;
          if (dist > 1.0) discard;
          float alpha = (1.0 - smoothstep(1.0 - uSoftness, 1.0, dist)) * uOpacity;
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
      `
    });

    const points = new THREE.Points(geo, mat);
    this.group.add(points);
    this.layers.push({ points, count, positions, velocities, w, h });
  }

  update(dt) {
    const safeDt = Math.min(dt, 0.05);

    for (let l = 0; l < this.layers.length; l++) {
      const layer = this.layers[l];
      const pos = layer.positions;
      const vel = layer.velocities;
      const count = layer.count;
      const halfW = layer.w * 0.5;
      const halfH = layer.h * 0.5;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const i2 = i * 2;

        // Straight line translation: upper-right -> lower-left
        pos[i3 + 0] += vel[i2 + 0] * safeDt * 60.0;
        pos[i3 + 1] += vel[i2 + 1] * safeDt * 60.0;

        // Re-inject when exiting through bottom or left boundary
        if (pos[i3 + 1] < -halfH || pos[i3 + 0] < -halfW) {
          // Re-spawn along top edge or right edge
          if (Math.random() < 0.65) {
            // Spawn along top edge towards right
            pos[i3 + 1] = halfH + Math.random() * 40.0;
            pos[i3 + 0] = -halfW * 0.2 + Math.random() * (halfW * 1.2);
          } else {
            // Spawn along right edge towards top
            pos[i3 + 0] = halfW + Math.random() * 40.0;
            pos[i3 + 1] = -halfH * 0.2 + Math.random() * (halfH * 1.2);
          }
        }
      }

      layer.points.geometry.attributes.position.needsUpdate = true;
    }
  }
}
