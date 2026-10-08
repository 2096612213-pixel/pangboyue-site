/**
 * MountainLayers - Layered Alpine Ranges with Curved Valleys and Irregular Snowcaps
 * Features:
 * - 100% Solid mountain geometry from ridge crest down to below viewport base (ZERO hollow gaps or cutouts)
 * - Truly randomized procedural peaks on every page refresh
 * - Endless left-to-right constant scrolling with depth parallax (back slow, front fast)
 * - 100% robust chunk recycling with in-place geometry regeneration: mountains NEVER run out
 * - Newly emerging peaks generated dynamically on the fly from the left edge
 * - Broad slanted rock faces, curved shoulders and irregular snowlines
 * - Irregular descending snowcaps with multi-tonal shading
 * - Thin contour strokes along continuous ridge crests
 * - Ground-anchored 3D scale pivot for enhanced 0.75s low-frequency tectonic shocks
 */
import { CONFIG } from './config.js';
import { simplex2D } from './noise.js';

export class MountainLayers {
  constructor(scene) {
    this.scene = scene;
    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    this.layers = [];
    this.layerCount = CONFIG.mountainLayers;

    this.viewWidth = 1920;
    this.viewHeight = 1080;

    this._initLayerConfigs();
  }

  _initLayerConfigs() {
    // 参考图：远山青蓝、近山深蓝，主峰稀疏，雪帽随距离逐渐变暗。
    const styles = [
      [1.00, 0.38, 2, 3, '#629eae', '#437988', '#fafbff', '#c8d0dc'],
      [0.87, 0.40, 2, 3, '#4d8397', '#315e74', '#f5f8fc', '#bdc8d6'],
      [0.72, 0.36, 2, 4, '#34677e', '#244d65', '#e8eef5', '#b7c5d3'],
      [0.53, 0.30, 2, 4, '#1b4962', '#12344e', '#bdc9d7', '#8e9fb1'],
      [0.37, 0.23, 3, 5, '#10344b', '#0b2339', '#a0aebf', '#76899e'],
      [0.20, 0.00, 3, 5, '#091e31', '#051321', '#788b9e', '#536b82']
    ];
    this.layerConfigs = styles.map((v, i) => ({
      depth: -45 + i * 11,
      heightFactor: v[0], snowRatio: v[1], peakCountMin: v[2], peakCountMax: v[3],
      litColor: v[4], shadowColor: v[5], snowLit: v[6], snowShadow: v[7],
      lineOpacity: 0.24 + i * 0.035, lineWidth: 1.0
    }));
  }

  rebuild(width, height) {
    this.viewWidth = width;
    this.viewHeight = height;

    while (this.rootGroup.children.length > 0) {
      const child = this.rootGroup.children[0];
      this.rootGroup.remove(child);
      if (child.traverse) {
        child.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
          }
        });
      }
    }

    this.layers = [];
    this.groundY = -height * 0.5;

    for (let i = 0; i < this.layerCount; i++) {
      const config = this.layerConfigs[i];
      const layerObj = this._buildScrollingLayer(i, config, width, height);
      this.layers.push(layerObj);
      this.rootGroup.add(layerObj.group);
    }

    this._buildAtmosphericRays(width, height);
  }

  /**
   * Build a layer with 5 sequential procedural chunks for infinite seamless scrolling
   */
  _buildScrollingLayer(layerIndex, config, width, height) {
    const layerGroup = new THREE.Group();
    layerGroup.position.set(0, this.groundY, config.depth);

    // Depth parallax speed: back slow, front fast
    const norm = layerIndex / (this.layerCount - 1);
    const speedCurve = Math.pow(norm, 1.3);
    const speed = CONFIG.scroll.speedMin + (CONFIG.scroll.speedMax - CONFIG.scroll.speedMin) * speedCurve;

    // 5 chunks covering 3.75x viewport width for seamless infinite buffer
    const chunkWidth = Math.max(width * 0.75, height * 0.70);
    const chunkCount = 5;
    const chunks = [];
    const startX = -chunkWidth * 2.0;
    const maxMountainHeight = height * CONFIG.mountainCoverage * config.heightFactor;

    let seamHeight = maxMountainHeight * (0.52 + Math.random() * 0.12);

    for (let c = 0; c < chunkCount; c++) {
      const chunkX = startX + c * chunkWidth;
      const nextSeamHeight = maxMountainHeight * (0.52 + Math.random() * 0.12);

      const chunkGroup = new THREE.Group();
      chunkGroup.position.x = chunkX;

      const { meshGeo, lineGeo } = this._buildChunkGeometryData(
        layerIndex, config,
        chunkWidth, maxMountainHeight, height,
        seamHeight, nextSeamHeight
      );

      const meshMat = this._createMountainMaterial(config, chunkWidth, height, meshGeo.userData.facetSeed);
      const mesh = new THREE.Mesh(meshGeo, meshMat);
      // 第 1 通道仅标记实体山面，供雪片遮挡使用；轮廓线与透明光束不写遮挡。
      mesh.layers.enable(1);
      chunkGroup.add(mesh);

      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color('#ffffff'),
        transparent: true,
        opacity: config.lineOpacity,
        linewidth: config.lineWidth,
        depthTest: true
      });
      const lines = new THREE.LineSegments(lineGeo, lineMat);
      chunkGroup.add(lines);

      layerGroup.add(chunkGroup);

      chunks.push({
        group: chunkGroup,
        mesh: mesh,
        lines: lines,
        x: chunkX,
        leftY: seamHeight,
        rightY: nextSeamHeight
      });

      seamHeight = nextSeamHeight;
    }

    return {
      index: layerIndex,
      config: config,
      group: layerGroup,
      chunks: chunks,
      chunkWidth: chunkWidth,
      speed: speed,
      maxMountainHeight: maxMountainHeight,
      basePos: { x: 0, y: this.groundY, z: config.depth }
    };
  }

  _createMountainMaterial(config, chunkWidth, height, seed) {
    return new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uLit: { value: new THREE.Color(config.litColor) },
        uShadow: { value: new THREE.Color(config.shadowColor) },
        uSnowLit: { value: new THREE.Color(config.snowLit) },
        uSnowShadow: { value: new THREE.Color(config.snowShadow) },
        uWidth: { value: chunkWidth },
        uHeight: { value: height },
        uFacetSeed: { value: seed }
      },
      vertexShader: `
        attribute float snowLine;
        attribute vec2 snowPeak;
        varying vec2 vLocal;
        varying float vSnowLine;
        varying vec2 vSnowPeak;
        void main() {
          vLocal = position.xy;
          vSnowLine = snowLine;
          vSnowPeak = snowPeak;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uLit, uShadow, uSnowLit, uSnowShadow;
        uniform float uWidth, uHeight, uFacetSeed;
        varying vec2 vLocal;
        varying float vSnowLine;
        varying vec2 vSnowPeak;
        float hash(float p) { return fract(sin(p * 127.1 + uFacetSeed * 31.7) * 43758.5453); }
        void main() {
          // 斜向岩面：宽窄、明暗与边缘弯折分别变化，不再绘制贯穿山体的竖线。
          float facetWidth = uWidth / 9.0;
          float slope = (uWidth / uHeight) * (0.16 + 0.035 * sin(uFacetSeed));
          float q = (vLocal.x - vLocal.y * slope) / facetWidth;
          q += 0.045 * sin(vLocal.y / uHeight * 17.0 + uFacetSeed);
          float cell = floor(q);
          float cut = 0.22 + hash(cell) * 0.55;
          float light = mix(0.12 + hash(cell + 3.0) * 0.20,
                            0.72 + hash(cell + 9.0) * 0.28, step(cut, fract(q)));
          // 分块端点的光照连续衔接，不出现直立的拼接缝。
          float seamBlend = smoothstep(0.0, uWidth * 0.025, min(vLocal.x, uWidth - vLocal.x));
          light = mix(0.55, light, seamBlend);
          vec3 rock = mix(uShadow, uLit, light);
          // 雪帽折线从尖峰向左下方延伸，左侧背光、右侧亮白。
          float snowSide = vLocal.x - vSnowPeak.x - (vLocal.y - vSnowPeak.y) * slope * 0.75;
          float snowLight = mix(0.12, 0.97, smoothstep(-1.0, 1.0, snowSide));
          vec3 snow = mix(uSnowShadow, uSnowLit, snowLight * 0.90 + light * 0.10);
          float edge = max(fwidth(vLocal.y - vSnowLine), 0.5);
          float snowMask = smoothstep(-edge, edge, vLocal.y - vSnowLine);
          gl_FragColor = vec4(mix(rock, snow, snowMask), 1.0);
        }
      `
    });
  }

  /** 连续山岭：尖峰、宽肩、弧形山谷及不规则雪线，实体一直延伸到屏幕外。 */
  _buildChunkGeometryData(layerIndex, config, chunkWidth, maxMountainHeight, screenHeight, leftSeamY, rightSeamY) {
    const numPeaks = Math.floor(config.peakCountMin + Math.random() * (config.peakCountMax - config.peakCountMin + 1));
    const stepX = chunkWidth / numPeaks;
    const seed = Math.random() * 1000;
    const valleys = [{ x: 0, y: leftSeamY }];
    for (let i = 1; i < numPeaks; i++) {
      valleys.push({
        x: (i + (Math.random() - 0.5) * 0.40) * stepX,
        y: maxMountainHeight * (0.44 + Math.random() * 0.23)
      });
    }
    valleys.push({ x: chunkWidth, y: rightSeamY });

    const peaks = valleys.slice(0, -1).map((left, i) => {
      const right = valleys[i + 1];
      return {
        x: left.x + (right.x - left.x) * (0.30 + Math.random() * 0.40),
        y: maxMountainHeight * (0.74 + Math.random() * 0.26),
        roundness: 1.55 + Math.random() * 0.85,
        snowDepth: config.snowRatio * (0.82 + Math.random() * 0.36)
      };
    });
    const points = [];
    for (let i = 0; i < numPeaks; i++) {
      const left = valleys[i], right = valleys[i + 1], peak = peaks[i];
      const snowBase = peak.y - (peak.y - Math.min(left.y, right.y)) * peak.snowDepth;
      // 逐侧采样，确保尖峰处有精确顶点；山谷连接处的斜率趋于零。
      for (const [start, end, rising] of [[left, peak, true], [peak, right, false]]) {
        const count = Math.max(12, Math.ceil((end.x - start.x) / 7));
        for (let j = 0; j < count; j++) {
          const t = j / count;
          const x = start.x + (end.x - start.x) * t;
          const valley = rising ? left : right;
          const phase = rising ? t : 1.0 - t;
          const crest = valley.y + (peak.y - valley.y) * Math.pow(phase, peak.roundness);
          const envelope = Math.sin(Math.PI * t);
          const rough = (simplex2D(x * 0.018, seed) * 0.012
            + simplex2D(x * 0.047, seed + 20) * 0.003) * maxMountainHeight * envelope;
          const snow = snowBase + maxMountainHeight * (0.020 * simplex2D(x * 0.032, seed + 60)
            + 0.007 * Math.sin(x * 0.066 + seed));
          points.push({ x, y: crest + rough, snow: config.snowRatio > 0 ? snow : maxMountainHeight * 2, peakX: peak.x, peakY: peak.y });
        }
      }
    }
    points.push({ x: chunkWidth, y: rightSeamY, snow: maxMountainHeight * 2, peakX: peaks[peaks.length - 1].x, peakY: peaks[peaks.length - 1].y });
    // 山谷接缝无积雪，独立生成的相邻分块具有相同的轮廓和颜色。
    points[0].snow = maxMountainHeight * 2;
    const bottom = -Math.max(screenHeight * 0.30, 100);
    const positions = [], snowLines = [], snowPeaks = [], linePositions = [];
    const vertex = (point, y) => {
      positions.push(point.x, y, 0);
      snowLines.push(point.snow);
      snowPeaks.push(point.peakX, point.peakY);
    };
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      vertex(a, a.y); vertex(a, bottom); vertex(b, bottom);
      vertex(a, a.y); vertex(b, bottom); vertex(b, b.y);
      linePositions.push(a.x, a.y, 0.5, b.x, b.y, 0.5);
    }
    const meshGeo = new THREE.BufferGeometry();
    meshGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    meshGeo.setAttribute('snowLine', new THREE.Float32BufferAttribute(snowLines, 1));
    meshGeo.setAttribute('snowPeak', new THREE.Float32BufferAttribute(snowPeaks, 2));
    meshGeo.userData.facetSeed = seed;
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    return { meshGeo, lineGeo };
  }

  _buildAtmosphericRays(width, height) {
    const rayGeo = new THREE.BufferGeometry();
    const rayPositions = [];
    const rayColors = [];

    const rayCount = 7;
    const rayAngle = -0.58;
    const cRayBot = new THREE.Color(0.45, 0.75, 0.95);

    for (let i = 0; i < rayCount; i++) {
      const topX = (i / rayCount - 0.25) * width * 1.3;
      const topY = height * 0.6;
      const beamWidth = width * (0.04 + 0.05 * Math.random());
      const length = height * 1.6;

      const botX1 = topX + Math.cos(rayAngle) * length;
      const botY1 = topY + Math.sin(rayAngle) * length;
      const botX2 = botX1 + beamWidth * 2.2;
      const botY2 = botY1;

      rayPositions.push(
        topX, topY, -20,  topX + beamWidth, topY, -20,  botX2, botY2, -20,
        topX, topY, -20,  botX2, botY2, -20,  botX1, botY1, -20
      );

      const alpha = 0.028 + 0.02 * Math.sin(i * 1.7);
      for (let k = 0; k < 6; k++) {
        rayColors.push(cRayBot.r * alpha, cRayBot.g * alpha, cRayBot.b * alpha);
      }
    }

    rayGeo.setAttribute('position', new THREE.Float32BufferAttribute(rayPositions, 3));
    rayGeo.setAttribute('color', new THREE.Float32BufferAttribute(rayColors, 3));

    const rayMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const rayMesh = new THREE.Mesh(rayGeo, rayMat);
    this.rootGroup.add(rayMesh);
  }

  /**
   * Endless Left-to-Right Scrolling & Deep Tectonic Spatial 3D Tremor
   * Guaranteed to generate new peaks infinitely without ever running out or disappearing.
   */
  update(dt, shakeController) {
    const total = this.layers.length;
    // When a chunk's left edge passes beyond right edge of viewport (+0.5 * viewWidth)
    const rightCullingLimit = this.viewWidth * 0.55;

    for (let i = 0; i < total; i++) {
      const layer = this.layers[i];
      const chunks = layer.chunks;

      // 1. Advance all chunks to the right (x increases)
      const moveDelta = layer.speed * dt * CONFIG.scroll.direction;

      for (let c = 0; c < chunks.length; c++) {
        chunks[c].x += moveDelta;
        chunks[c].group.position.x = chunks[c].x;
      }

      // 2. Check for chunks that have completely exited offscreen to the right
      for (let c = 0; c < chunks.length; c++) {
        const chunk = chunks[c];
        if (chunk.x > rightCullingLimit) {
          // Find the current leftmost chunk among all other chunks
          let minX = Infinity;
          let leftmostChunk = null;
          for (let k = 0; k < chunks.length; k++) {
            if (chunks[k] !== chunk && chunks[k].x < minX) {
              minX = chunks[k].x;
              leftmostChunk = chunks[k];
            }
          }

          if (leftmostChunk) {
            // Position this chunk seamlessly to the left of the leftmost chunk
            const newX = minX - layer.chunkWidth;
            chunk.x = newX;
            chunk.group.position.x = newX;

            // Generate fresh random procedural peaks entering from the left edge!
            const newLeftSeamY = layer.maxMountainHeight * (0.52 + Math.random() * 0.12);
            const newRightSeamY = leftmostChunk.leftY; // Match adjacent seam seamlessly

            const { meshGeo, lineGeo } = this._buildChunkGeometryData(
              i, layer.config,
              layer.chunkWidth, layer.maxMountainHeight, this.viewHeight,
              newLeftSeamY, newRightSeamY
            );

            // Safely swap geometries in-place without removing meshes from the scene graph
            const oldMeshGeo = chunk.mesh.geometry;
            const oldLinesGeo = chunk.lines.geometry;

            chunk.mesh.geometry = meshGeo;
            chunk.mesh.material.uniforms.uFacetSeed.value = meshGeo.userData.facetSeed;
            chunk.lines.geometry = lineGeo;

            if (oldMeshGeo && oldMeshGeo.dispose) oldMeshGeo.dispose();
            if (oldLinesGeo && oldLinesGeo.dispose) oldLinesGeo.dispose();

            chunk.leftY = newLeftSeamY;
            chunk.rightY = newRightSeamY;
          }
        }
      }

      // 3. Apply deep tectonic spatial 3D tremor with depth parallax
      const transform = shakeController.getLayerTransform(i, total);
      layer.group.position.x = transform.x;
      layer.group.position.y = layer.basePos.y + transform.y;
      layer.group.scale.set(transform.scale, transform.scale, 1.0);
    }
  }
}
