(() => {
  'use strict';
  const section = document.getElementById('digital-agent');
  const canvas = document.getElementById('agent-backdrop');
  if (!section || !canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  // 点阵只在原始Psi矢量轮廓内绘制；统一在此调整密度、亮度和流速。
  const CONFIG = Object.freeze({ fps: 30, maxDpr: 1.5, gap: 17, mobileGap: 11, size: .80, flow: 2.8, speed: .65, opacity: .30, hoverOpacity: .60, spotlightPeriod: 8, spotlightLength: .32, spotlightWidth: 1.20, spotlightGain: 3.30 });
  const mask = document.createElement('canvas');
  const maskCtx = mask.getContext('2d', { alpha: true });
  if (!maskCtx) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, strength: 0, active: false };
  let paths = [], points = [], width = 0, height = 0, dpr = 1, scale = 1, originX = 0, originY = 0;
  let frame = 0, lastFrame = 0, elapsed = 0, visible = false;
  let lensZone = null;

  function resize() {
    if (!paths.length) return;
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    if (!width || !height) return;
    dpr = Math.min(devicePixelRatio || 1, CONFIG.maxDpr);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    mask.width = canvas.width;
    mask.height = canvas.height;
    const glyphSize = Math.min(width * .89, height * CONFIG.size);
    scale = glyphSize / 69;
    originX = width / 2 - 48 * scale;
    originY = height / 2 - 48 * scale;
    // 单独填充每条路径并取并集，避免相反绕向让重叠处互相抵消。
    maskCtx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * originX, dpr * originY);
    maskCtx.fillStyle = '#fff';
    for (const path of paths) maskCtx.fill(path);
    const gap = width < 600 ? CONFIG.mobileGap : CONFIG.gap;
    points = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let y = gap / 2; y < height; y += gap) {
      for (let x = gap / 2; x < width; x += gap) {
        if (paths.some(path => ctx.isPointInPath(path, (x - originX) / scale, (y - originY) / scale))) points.push({ x, y });
      }
    }
    canvas.dataset.ready = 'true';
    canvas.dataset.points = String(points.length);
    updateLensZone();
    draw();
    updatePlayback();
  }

  function updateLensZone() {
    const bounds = canvas.getBoundingClientRect();
    const composer = document.getElementById('agent-form');
    const lens = composer.getBoundingClientRect();
    lensZone = { left: lens.left - bounds.left, top: lens.top - bounds.top, width: lens.width, height: lens.height, radius: parseFloat(getComputedStyle(composer).borderRadius) || 26 };

  }

  function draw() {
    if (!paths.length || !width || !height) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const time = reducedMotion.matches ? 0 : elapsed * CONFIG.speed;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const half = width < 600 ? 3.1 : 4.9;
    const radius = width < 600 ? 95 : 155;
    // 软边长椭圆聚光从左上扫至右下；两端移出图案后重新开始。
    // 只照亮已有字符，不在黑色空白处绘制光束或底色。
    const phase = reducedMotion.matches ? .5 : (elapsed / CONFIG.spotlightPeriod + .25) % 1;
    const travel = -.22 + phase * 1.44;
    const spotX = width * travel, spotY = height * travel;
    const diagonal = Math.hypot(width, height);
    const axisX = width / diagonal, axisY = height / diagonal;
    const beamLength = diagonal * CONFIG.spotlightLength;
    // 横向半径覆盖整张画布在光束垂直方向的投影，避免漏照右上、左下。
    const beamWidth = (width * axisY + height * axisX) * .5 * CONFIG.spotlightWidth;
    for (const point of points) {
      const wave = Math.sin(point.y * .017 - time + point.x * .006);
      const distance = Math.hypot(point.x - pointer.x, point.y - pointer.y);
      const influence = Math.max(0, 1 - distance / radius) ** 1.5 * pointer.strength;
      const flow = reducedMotion.matches ? 0 : CONFIG.flow;
      let x = point.x + Math.sin(point.y * .013 + time) * flow + wave * influence * 3;
      let y = point.y + Math.cos(point.x * .013 - time * .7) * flow * .6 + wave * influence * 2;
      // 清水折射和散射都在同一动态画布内绘制，不依赖覆盖层缓存背景。
      let scattering = 0;
      if (lensZone) {
        const l = lensZone, u = (x - l.left) / l.width, v = (y - l.top) / l.height;
        const qx = Math.abs(x - l.left - l.width / 2) - (l.width / 2 - l.radius);
        const qy = Math.abs(y - l.top - l.height / 2) - (l.height / 2 - l.radius);
        const signedDistance = Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - l.radius;
        if (signedDistance < 0) {
          const weight = Math.min(1, -signedDistance / 14);
          scattering = weight;
          x += ((u - .5) * 5 + Math.sin(v * Math.PI * 2) * .8) * weight;
          y += ((v - .5) * 3.5 + Math.cos(u * Math.PI * 2) * .5) * weight;
        }
      }
      const glint = Math.max(0, Math.sin(point.x * .009 + point.y * .015 - time * .35)) ** 8;
      const ambientAlpha = CONFIG.opacity + wave * .055;
      const dx = point.x - spotX, dy = point.y - spotY;
      const along = (dx * axisX + dy * axisY) / beamLength;
      const across = (-dx * axisY + dy * axisX) / beamWidth;
      const beam = Math.max(0, 1 - along * along - across * across) ** 2;
      // 光束范围外完全透明；鼠标仍可独立唤醒原来的变亮和形变。
      const illumination = Math.max(beam * CONFIG.spotlightGain, Math.min(1, influence * 8));
      if (!illumination && !influence) continue;
      // 聊天前后使用相同的背景亮度，保留鼠标原有的交互亮度。
      const alpha = Math.min(.88, ambientAlpha * illumination + influence * CONFIG.hoverOpacity);
      const rise = half * .95 * influence;
      ctx.beginPath();
      ctx.moveTo(x + half, y - rise);
      ctx.lineTo(x - half, y);
      ctx.lineTo(x + half, y + rise);
      // 透明水感：仅将已有字符的光分散到稍宽的笔画，减少光芯强度。
      // 没有整块底色或发光层；框内外共享位置、时间和鼠标形变。
      if (scattering) {
        ctx.lineWidth = (width < 600 ? 2 : 2.7) + scattering * 1.8;
        ctx.strokeStyle = `rgba(184,203,227,${(alpha * .16 * scattering).toFixed(3)})`;
        ctx.stroke();
      }
      // 宽的透明冷色外沿与细白光芯，形成玻璃短横/尖括号。
      ctx.lineWidth = width < 600 ? 2 : 2.7;
      ctx.strokeStyle = `rgba(159,191,230,${(alpha * (.58 - scattering * .12)).toFixed(3)})`;
      ctx.stroke();
      ctx.lineWidth = width < 600 ? .8 : 1.05;
      ctx.strokeStyle = `rgba(245,250,255,${((alpha * .9 + glint * .23 * illumination) * (1 - scattering * .16)).toFixed(3)})`;
      ctx.stroke();
    }
    ctx.restore();
    // 以并集遮罩裁切最终点阵，轮廓外不画点，也不勾边。
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    ctx.restore();
  }

  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || reducedMotion.matches) return;
    if (!lastFrame || now - lastFrame >= 1000 / CONFIG.fps) {
      const dt = lastFrame ? Math.min(.1, (now - lastFrame) / 1000) : 0;
      elapsed += dt;
      lastFrame = now;
      pointer.x += (pointer.targetX - pointer.x) * .2;
      pointer.y += (pointer.targetY - pointer.y) * .2;
      pointer.strength += ((pointer.active ? 1 : 0) - pointer.strength) * .12;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }

  function updatePlayback() {
    const animate = paths.length && visible && !document.hidden && !reducedMotion.matches;
    canvas.dataset.playback = animate ? 'running' : 'paused';
    if (animate && !frame) { lastFrame = 0; frame = requestAnimationFrame(tick); }
    else if (!animate) { cancelAnimationFrame(frame); frame = 0; lastFrame = 0; if (paths.length) draw(); }
  }

  // 捕获阶段读取鼠标位置：覆盖的输入框、按钮、聊天记录都能触发背景。
  section.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const bounds = canvas.getBoundingClientRect();
    pointer.targetX = event.clientX - bounds.left;
    pointer.targetY = event.clientY - bounds.top;
    pointer.active = true;
    if (!pointer.strength) { pointer.x = pointer.targetX; pointer.y = pointer.targetY; }
    if (reducedMotion.matches) { pointer.x = pointer.targetX; pointer.y = pointer.targetY; pointer.strength = 1; draw(); }
  }, { passive: true, capture: true });
  section.addEventListener('pointerleave', () => {
    pointer.active = false;
    if (reducedMotion.matches) { pointer.strength = 0; draw(); }
  }, { passive: true });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; updatePlayback(); }).observe(section);
  new ResizeObserver(resize).observe(canvas);
  new ResizeObserver(updateLensZone).observe(section.querySelector('.agent-panel'));
  section.addEventListener('agent:layout', updateLensZone);
  document.addEventListener('visibilitychange', updatePlayback);
  reducedMotion.addEventListener('change', updatePlayback);

  // 复用网站图标的同一份SVG，保证点阵形状与现有图标一致。
  fetch(section.querySelector('.agent-empty-mark').src)
    .then(response => { if (!response.ok) throw new Error('Psi asset unavailable'); return response.text(); })
    .then(svg => {
      const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
      paths = [...document.querySelectorAll('path')].map(path => new Path2D(path.getAttribute('d')));
      if (!paths.length) throw new Error('Psi paths unavailable');
      resize();
    })
    .catch(() => { canvas.hidden = true; });
})();
