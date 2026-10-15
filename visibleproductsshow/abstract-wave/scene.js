const SPRITE_B64 = "harmonic-fields.webp?v=a2209acb41eb";
    const canvas = document.getElementById('artCanvas');
    const ctx = canvas.getContext('2d');
    const stageContainer = document.getElementById('stageContainer');

    // Original 1.0x world coordinate domain is [0, W0) x [0, H0) where W0 = 442, H0 = 442.
    // Precomputed seamless 2.60x Bravais-extended world map: W_WORLD = 1150, H_WORLD = 1150
    const W0 = 442, H0 = 442, N0 = W0 * H0;
    const W_WORLD = 1150, H_WORLD = 1150, N_WORLD = W_WORLD * H_WORLD;
    const WORLD_OFF = (W_WORLD - W0) >> 1; // 354

    // True 1x1 per-pixel canvas resolution (660 x 660): every single pixel is bilinearly interpolated (NO 2x2 block stamping!)
    const W_CANVAS = 660, H_CANVAS = 660, N_CANVAS = W_CANVAS * H_CANVAS;

    const LUT_SIZE = 4096;
    const LUT_MASK = LUT_SIZE - 1;
    const RAD_TO_LUT = LUT_SIZE / (2.0 * Math.PI);
    const COS_LUT = new Float32Array(LUT_SIZE);
    for (let i = 0; i < LUT_SIZE; i++) {
      COS_LUT[i] = Math.cos((i * 2.0 * Math.PI) / LUT_SIZE);
    }

    // Decoded smooth 442x442 demodulated harmonic fields
    const d_A0  = new Float32Array(N0);
    const d_Re1 = new Float32Array(N0);
    const d_Im1 = new Float32Array(N0);
    const d_Re2 = new Float32Array(N0);
    const d_Im2 = new Float32Array(N0);
    const d_Re3 = new Float32Array(N0);

    // Seamless Bravais-extended 1150x1150 world buffers (built with sub-pixel bilinear interpolation!)
    const w_A0  = new Float32Array(N_WORLD);
    const w_Re1 = new Float32Array(N_WORLD);
    const w_Im1 = new Float32Array(N_WORLD);
    const w_Re2 = new Float32Array(N_WORLD);
    const w_Im2 = new Float32Array(N_WORLD);
    const w_Re3 = new Float32Array(N_WORLD);

    let spriteLoaded = false;

    // Pure procedural engine buffers on the 660x660 canvas
    const p_cosR  = new Float32Array(N_CANVAS);
    const p_cos2R = new Float32Array(N_CANVAS);
    const p_crown = new Float32Array(N_CANVAS);
    const p_bg    = new Float32Array(N_CANVAS);

    // Separable per-row / per-column bilinear lookup tables for ultra-fast 60fps 1x1 pixel rendering
    const x0_tab = new Int32Array(W_CANVAS);
    const fx_tab = new Float32Array(W_CANVAS);
    const wx_tab = new Float32Array(W_CANVAS);
    const gx_tab = new Float32Array(W_CANVAS);
    const vx_tab = new Float32Array(W_CANVAS);

    const y0_tab = new Int32Array(H_CANVAS);
    const fy_tab = new Float32Array(H_CANVAS);
    const wy_tab = new Float32Array(H_CANVAS);
    const gy_tab = new Float32Array(H_CANVAS);
    const vy_tab = new Float32Array(H_CANVAS);

    const imgData = ctx.createImageData(W_CANVAS, H_CANVAS);
    const pixels32 = new Uint32Array(imgData.data.buffer);

    const sf = H0 / 348.0;

    const state = {
      playing: true,
      tPhase: 0.0,
      speed: 24.64,
      kx: 17.30,
      bendScale: 1.00,
      g1: 1.00,
      g2: 1.00,
      g3: 1.00,
      fov: 1.00,
      panX: 0.0,
      panY: 0.0,
      lockDomeSize: true,
      showOrigBox: false,
      gridStrength: 1.00,
      bwMix: 0.00,
      gridScale: 1.0,
      R_bound: 132.0,
      gamma: 0.52,
      engine: 'harmonic',
      mode: 'full',
      showOverlay: false,
      needsProcUpdate: true
    };

    function smoothstep01(t) {
      return t <= 0.0 ? 0.0 : (t >= 1.0 ? 1.0 : t * t * (3.0 - 2.0 * t));
    }

    function sampleBilinearOrig(arr, sx, sy) {
      const cx = sx < 28.0 ? 28.0 : (sx > W0 - 29.001 ? W0 - 29.001 : sx);
      const cy = sy < 28.0 ? 28.0 : (sy > H0 - 29.001 ? H0 - 29.001 : sy);
      const x0 = cx | 0;
      const y0 = cy | 0;
      const fx = cx - x0;
      const fy = cy - y0;
      const omfx = 1.0 - fx;
      const omfy = 1.0 - fy;
      const idx0 = y0 * W0 + x0;
      const idx1 = idx0 + W0;
      return (
        omfx * omfy * arr[idx0] +
        fx   * omfy * arr[idx0 + 1] +
        omfx * fy   * arr[idx1] +
        fx   * fy   * arr[idx1 + 1]
      );
    }

    // Build the seamless 1150x1150 Bravais-extended world map using sub-pixel bilinear interpolation!
    function buildBravaisWorldMap() {
      const b1x = 144.6, b1y = 120.2;
      const b2x = -138.2, b2y = 129.3;
      const det = b1x * b2y - b2x * b1y;
      const inv00 =  b2y / det, inv01 = -b2x / det;
      const inv10 = -b1y / det, inv11 =  b1x / det;
      const psi_b1 = -0.7941, psi_b2 = +0.7191;

      for (let wyIdx = 0; wyIdx < H_WORLD; wyIdx++) {
        const wy = wyIdx - WORLD_OFF;
        const dy = wy - 221.0;
        const wRowOff = wyIdx * W_WORLD;

        for (let wxIdx = 0; wxIdx < W_WORLD; wxIdx++) {
          const wx = wxIdx - WORLD_OFF;
          const dx = wx - 221.0;

          const u = inv00 * dx + inv01 * dy;
          const v = inv10 * dx + inv11 * dy;
          const u_idx = Math.floor(u);
          const v_idx = Math.floor(v);
          const fu = u - u_idx;
          const fv = v - v_idx;

          const wu1 = smoothstep01((fu - 0.30) / 0.40);
          const wu0 = 1.0 - wu1;
          const wv1 = smoothstep01((fv - 0.30) / 0.40);
          const wv0 = 1.0 - wv1;

          let sA0 = 0, sRe1 = 0, sIm1 = 0, sRe2 = 0, sIm2 = 0, sRe3 = 0;

          for (let du = 0; du <= 1; du++) {
            const wu = du === 0 ? wu0 : wu1;
            if (wu <= 0) continue;
            const m = u_idx + du;
            const rem_u = u - m;

            for (let dv = 0; dv <= 1; dv++) {
              const wv = dv === 0 ? wv0 : wv1;
              if (wv <= 0) continue;
              const w = wu * wv;
              const n = v_idx + dv;
              const rem_v = v - n;

              const sx = 221.0 + rem_u * b1x + rem_v * b2x;
              const sy = 221.0 + rem_u * b1y + rem_v * b2y;

              const ang = m * psi_b1 + n * psi_b2;
              const ca = Math.cos(ang);
              const sa = Math.sin(ang);

              const r1 = sampleBilinearOrig(d_Re1, sx, sy);
              const i1 = sampleBilinearOrig(d_Im1, sx, sy);

              sA0  += w * sampleBilinearOrig(d_A0,  sx, sy);
              sRe1 += w * (r1 * ca - i1 * sa);
              sIm1 += w * (r1 * sa + i1 * ca);
              sRe2 += w * sampleBilinearOrig(d_Re2, sx, sy);
              sIm2 += w * sampleBilinearOrig(d_Im2, sx, sy);
              sRe3 += w * sampleBilinearOrig(d_Re3, sx, sy);
            }
          }

          const dstIdx = wRowOff + wxIdx;

          if (wx >= 0 && wx < W0 && wy >= 0 && wy < H0) {
            const origIdx = wy * W0 + wx;
            const margin = Math.min(Math.min(wx - 28.0, 413.0 - wx), Math.min(wy - 28.0, 413.0 - wy));
            const wo = smoothstep01(margin / 26.0);
            const omw = 1.0 - wo;

            w_A0[dstIdx]  = omw * sA0  + wo * d_A0[origIdx];
            w_Re1[dstIdx] = omw * sRe1 + wo * d_Re1[origIdx];
            w_Im1[dstIdx] = omw * sIm1 + wo * d_Im1[origIdx];
            w_Re2[dstIdx] = omw * sRe2 + wo * d_Re2[origIdx];
            w_Im2[dstIdx] = omw * sIm2 + wo * d_Im2[origIdx];
            w_Re3[dstIdx] = omw * sRe3 + wo * d_Re3[origIdx];
          } else {
            w_A0[dstIdx]  = sA0;
            w_Re1[dstIdx] = sRe1;
            w_Im1[dstIdx] = sIm1;
            w_Re2[dstIdx] = sRe2;
            w_Im2[dstIdx] = sIm2;
            w_Re3[dstIdx] = sRe3;
          }
        }
      }
    }

    function updateCanvasViewportSize() {
      const basePx = 620;
      const stageRect = stageContainer.getBoundingClientRect();
      const maxW = Math.max(180, (stageRect.width || 720) - 32);
      const maxH = Math.max(180, (stageRect.height || 720) - 120);
      const maxSide = Math.min(maxW, maxH);

      let sidePx;
      if (state.lockDomeSize) {
        sidePx = Math.min(maxSide, Math.round(basePx * state.fov));
      } else {
        sidePx = Math.min(maxSide, basePx);
      }
      canvas.style.width = `${sidePx}px`;
      canvas.style.height = `${sidePx}px`;
    }

    window.addEventListener('resize', () => {
      updateCanvasViewportSize();
    });

    function updateProceduralBuffers() {
      const R_bound = state.R_bound * sf;
      const gamma = state.gamma;
      const oneMinusG2 = Math.max(0.08, 1.0 - gamma * gamma);
      const onePlusG = 1.0 + gamma;
      const wl_s = 19.95 * sf;
      const twoPiOverWls = (2.0 * Math.PI) / wl_s;

      p_cosR.fill(0); p_cos2R.fill(0); p_crown.fill(0); p_bg.fill(0);

      const fov = state.fov;
      const worldSpan = W0 * fov;
      const step = worldSpan / W_CANVAS;
      const wxStart = 221.0 + state.panX - 0.5 * worldSpan;
      const wyStart = 221.0 + state.panY - 0.5 * worldSpan;

      for (let rIdx = -5; rIdx <= 9; rIdx++) {
        const cy0 = (30.0 + rIdx * 100.0) * sf;
        const isOdd = (rIdx & 1) !== 0;
        for (let cIdx = -3; cIdx <= 4; cIdx++) {
          const cx = ((isOdd ? 62.0 : -48.0) + cIdx * 220.0) * sf;

          for (let py = 0; py < H_CANVAS; py++) {
            const wy = wyStart + py * step;
            const u = wy - cy0 - gamma * R_bound;
            if (u < -R_bound * (1.0 + gamma) || u > 240.0 * sf) continue;
            const u2 = u * u;
            const rowOff = py * W_CANVAS;

            for (let px = 0; px < W_CANVAS; px++) {
              const wx = wxStart + px * step;
              const dx = wx - cx;
              const absDx = Math.abs(dx);
              if (absDx > 128.0 * sf) continue;

              const r_ecc = (gamma * u + Math.sqrt(oneMinusG2 * dx * dx + u2)) / oneMinusG2;
              const s = onePlusG * (R_bound - r_ecc);
              if (s < -2.0 * sf || s > 215.0 * sf) continue;

              const w = smoothstep01((s + 2.0 * sf) / (5.0 * sf)) *
                        smoothstep01((126.0 * sf - absDx) / (12.0 * sf)) *
                        Math.max(0.0, Math.min(1.0, (215.0 * sf - s) / (12.0 * sf)));
              if (w <= 1e-4) continue;

              const idx = rowOff + px;
              const th = twoPiOverWls * (s - 18.0 * sf);
              const throat_s = Math.max(0.0, s - 65.0 * sf) / (125.0 * sf);
              const wingL = Math.max(0.0, Math.min(1.0, (-dx - 28.0 * sf) / (50.0 * sf))) *
                            Math.max(0.0, Math.min(1.0, (58.0 * sf - s) / (40.0 * sf)));
              const wingR = Math.max(0.0, Math.min(1.0, (dx - 38.0 * sf) / (50.0 * sf))) *
                            Math.max(0.0, Math.min(1.0, (38.0 * sf - s) / (28.0 * sf)));
              const loc_bg = -0.32 * (dx / R_bound) - 2.1 * (throat_s * throat_s) +
                             wingL * (0.20 * s / sf) - wingR * (0.15 * s / sf);
              const c_light = Math.exp(-((dx / (76.0 * sf)) ** 2) - (((s - 45.0 * sf) / (58.0 * sf)) ** 2));

              const omw = 1.0 - w;
              p_cosR[idx]  = omw * p_cosR[idx]  + w * Math.cos(th);
              p_cos2R[idx] = omw * p_cos2R[idx] + w * Math.cos(2.0 * th);
              p_crown[idx] = omw * p_crown[idx] + w * c_light;
              p_bg[idx]    = omw * p_bg[idx]    + w * loc_bg;
            }
          }
        }
      }
      state.needsProcUpdate = false;
    }

    const spriteImg = new Image();
    spriteImg.onload = () => {
      const off = document.createElement('canvas');
      off.width = W0 * 2;
      off.height = H0;
      const octx = off.getContext('2d');
      octx.drawImage(spriteImg, 0, 0);
      const sData = octx.getImageData(0, 0, W0 * 2, H0).data;

      for (let y = 0; y < H0; y++) {
        for (let x = 0; x < W0; x++) {
          const idx = y * W0 + x;
          const pLeft  = (y * (W0 * 2) + x) * 4;
          const pRight = (y * (W0 * 2) + (x + W0)) * 4;

          d_A0[idx]  = sData[pLeft];
          d_Re1[idx] = sData[pLeft + 1] - 128.0;
          d_Im1[idx] = sData[pLeft + 2] - 128.0;

          d_Re2[idx] = (sData[pRight]     - 128.0) / 1.5;
          d_Im2[idx] = (sData[pRight + 1] - 128.0) / 1.5;
          d_Re3[idx] = (sData[pRight + 2] - 128.0) / 2.0;
        }
      }
      buildBravaisWorldMap();
      spriteLoaded = true;
      updateCanvasViewportSize();
      renderFrame();
    };
    spriteImg.src = SPRITE_B64;

    function packRGB(r, g, b) {
      const ri = r <= 0 ? 0 : (r >= 255 ? 255 : (r | 0));
      const gi = g <= 0 ? 0 : (g >= 255 ? 255 : (g | 0));
      const bi = b <= 0 ? 0 : (b >= 255 ? 255 : (b | 0));
      return (255 << 24) | (bi << 16) | (gi << 8) | ri;
    }

    function renderFrame() {
      const useProc = (state.engine === 'procedural') || !spriteLoaded;
      if (useProc && state.needsProcUpdate) {
        updateProceduralBuffers();
      }

      const wt = state.tPhase;
      const k_x = (2.0 * Math.PI * state.kx) / W0;
      const bendScale = state.bendScale;
      const g1 = state.g1;
      const g2 = (state.mode === 'fund') ? 0.0 : state.g2;
      const g3 = (state.mode === 'fund') ? 0.0 : state.g3;
      const gridStr = state.gridStrength;
      const gScale = state.gridScale;
      const mode = state.mode;
      const fov = state.fov;

      const worldSpan = W0 * fov;
      const step = worldSpan / W_CANVAS;
      const wxStart = 221.0 + state.panX - 0.5 * worldSpan;
      const wyStart = 221.0 + state.panY - 0.5 * worldSpan;

      // Screen-locked smooth cosine sci-fi grid frequency (constant visual smoothness on screen regardless of FOV!)
      const gridFreq = Math.PI / (1.5 * gScale);

      for (let px = 0; px < W_CANVAS; px++) {
        const wx = wxStart + px * step;
        wx_tab[px] = wx;
        const wxf = Math.max(0.0, Math.min(W_WORLD - 2.001, wx + WORLD_OFF));
        const x0 = wxf | 0;
        x0_tab[px] = x0;
        fx_tab[px] = wxf - x0;
        gx_tab[px] = Math.cos(px * gridFreq);
        vx_tab[px] = Math.min(1.0, Math.min(px, W_CANVAS - 1 - px) / 12.0);
      }

      for (let py = 0; py < H_CANVAS; py++) {
        const wy = wyStart + py * step;
        wy_tab[py] = wy;
        const wyf = Math.max(0.0, Math.min(H_WORLD - 2.001, wy + WORLD_OFF));
        const y0 = wyf | 0;
        y0_tab[py] = y0;
        fy_tab[py] = wyf - y0;
        gy_tab[py] = Math.cos(py * gridFreq);
        vy_tab[py] = Math.min(1.0, Math.min(py, H_CANVAS - 1 - py) / 12.0);
      }

      const autoBw = Math.max(0.0, (gridStr - 1.0) * 0.42);
      const totalBwMix = (mode === 'scifi_bw') ? 1.0 : Math.min(1.0, state.bwMix + autoBw);
      const colorMix = 1.0 - totalBwMix;

      const C1_LUT = 1365;
      const C2_LUT = 2731;
      const Q_LUT  = 1024;

      for (let py = 0; py < H_CANVAS; py++) {
        const y0 = y0_tab[py];
        const fy = fy_tab[py];
        const omfy = 1.0 - fy;
        const row0Off = y0 * W_WORLD;
        const row1Off = row0Off + W_WORLD;
        const gy = gy_tab[py];
        const vigY = vy_tab[py];
        const outRowOff = py * W_CANVAS;

        for (let px = 0; px < W_CANVAS; px++) {
          const cIdx = outRowOff + px;
          const x0 = x0_tab[px];
          const fx = fx_tab[px];
          const omfx = 1.0 - fx;

          const w00 = omfx * omfy;
          const w10 = fx   * omfy;
          const w01 = omfx * fy;
          const w11 = fx   * fy;

          const i00 = row0Off + x0;
          const i10 = i00 + 1;
          const i01 = row1Off + x0;
          const i11 = i01 + 1;

          const vig = vigY * vx_tab[px];
          const gx = gx_tab[px];
          // Smooth cosine sci-fi grid (zero discontinuous step jumps!)
          const G_smooth = 0.5 * (gx + gy) + 0.18 * (gx * gy);

          let A0, A1, psi_demod, Re2, Im2, Re3;

          if (!useProc) {
            A0 = (w00 * w_A0[i00] + w10 * w_A0[i10] + w01 * w_A0[i01] + w11 * w_A0[i11]) * vig;
            const re1 = w00 * w_Re1[i00] + w10 * w_Re1[i10] + w01 * w_Re1[i01] + w11 * w_Re1[i11];
            const im1 = (w00 * w_Im1[i00] + w10 * w_Im1[i10] + w01 * w_Im1[i01] + w11 * w_Im1[i11]) * bendScale;
            A1 = Math.hypot(re1, im1) * g1 * vig;
            psi_demod = Math.atan2(im1, re1);
            Re2 = (w00 * w_Re2[i00] + w10 * w_Re2[i10] + w01 * w_Re2[i01] + w11 * w_Re2[i11]) * g2 * vig;
            Im2 = (w00 * w_Im2[i00] + w10 * w_Im2[i10] + w01 * w_Im2[i01] + w11 * w_Im2[i11]) * g2 * vig;
            Re3 = (w00 * w_Re3[i00] + w10 * w_Re3[i10] + w01 * w_Re3[i01] + w11 * w_Re3[i11]) * g3 * vig;
          } else {
            const cos_r = p_cosR[cIdx];
            const cos_2r = p_cos2R[cIdx];
            const crown = p_crown[cIdx];

            const re1 = -25.0 - 69.0 * cos_r;
            const im1 = (5.0 + 38.0 * cos_2r) * bendScale;
            A1 = Math.hypot(re1, im1) * (0.95 + 0.12 * crown) * g1 * vig;
            psi_demod = Math.atan2(im1, re1) + p_bg[cIdx] - 0.15;

            A0 = (0.32 + 0.68 * crown) * (96.0 + 36.0 * cos_r - 22.0 * cos_2r) * vig;
            const a2 = (36.0 - 26.0 * cos_r) * (1.20 - 0.30 * crown) * g2 * vig;
            Re2 = a2 * 0.995;
            Im2 = -a2 * 0.0998;
            Re3 = (22.0 - 40.0 * cos_r) * (1.15 - 0.25 * crown) * g3 * vig;
          }

          if (mode === 'demod') {
            const pLut = ((psi_demod * RAD_TO_LUT) | 0) & LUT_MASK;
            const rv = 128 + 110 * COS_LUT[pLut];
            const gv = 128 + 110 * COS_LUT[(pLut - C1_LUT) & LUT_MASK];
            const bv = 128 + 110 * COS_LUT[(pLut - C2_LUT) & LUT_MASK];
            pixels32[cIdx] = packRGB(rv, gv, bv);
            continue;
          }

          // Pure, silky-smooth wave phase (ZERO G_cell phase saw-tooth jitter on wave edges!)
          const Phi = psi_demod - k_x * wx_tab[px] + wt;
          const phiLut = ((Phi * RAD_TO_LUT) | 0) & LUT_MASK;
          const phi2Lut = (phiLut << 1) & LUT_MASK;
          const phi3Lut = (phiLut * 3) & LUT_MASK;

          const c3 = Re3 * COS_LUT[phi3Lut];

          // Smooth sci-fi black-and-white base grid modulation (modulates luminance & wave gain without jagged phase steps)
          const gMod = gridStr * G_smooth * vig;
          const a0_grid = A0 + gMod * (8.5 + 0.09 * A0);
          const bw_skeleton = (A0 + c3) * (0.82 + 0.32 * gMod) + 12.0 * gMod;

          if (mode === 'scifi_bw') {
            pixels32[cIdx] = packRGB(bw_skeleton, bw_skeleton, bw_skeleton);
            continue;
          }

          const a1_mult = 1.0 + 0.09 * gMod;
          const A1_eff = A1 * a1_mult;
          const Re2_eff = Re2 * a1_mult;
          const Im2_eff = Im2 * a1_mult;

          const c1_0 = A1_eff * COS_LUT[phiLut];
          const c2_0 = Re2_eff * COS_LUT[phi2Lut] - Im2_eff * COS_LUT[(phi2Lut - Q_LUT) & LUT_MASK];
          const rCol = a0_grid + c1_0 + c2_0 + c3;

          const p1_1 = (phiLut - C1_LUT) & LUT_MASK;
          const p2_1 = (phi2Lut + C1_LUT) & LUT_MASK;
          const c1_1 = A1_eff * COS_LUT[p1_1];
          const c2_1 = Re2_eff * COS_LUT[p2_1] - Im2_eff * COS_LUT[(p2_1 - Q_LUT) & LUT_MASK];
          const gCol = a0_grid + c1_1 + c2_1 + c3;

          const p1_2 = (phiLut - C2_LUT) & LUT_MASK;
          const p2_2 = (phi2Lut + C2_LUT) & LUT_MASK;
          const c1_2 = A1_eff * COS_LUT[p1_2];
          const c2_2 = Re2_eff * COS_LUT[p2_2] - Im2_eff * COS_LUT[(p2_2 - Q_LUT) & LUT_MASK];
          const bCol = a0_grid + c1_2 + c2_2 + c3;

          const rOut = colorMix * rCol + totalBwMix * bw_skeleton;
          const gOut = colorMix * gCol + totalBwMix * bw_skeleton;
          const bOut = colorMix * bCol + totalBwMix * bw_skeleton;

          pixels32[cIdx] = packRGB(rOut, gOut, bOut);
        }
      }

      ctx.putImageData(imgData, 0, 0);

      if (state.showOrigBox) {
        drawOriginalBoundaryBox(wxStart, wyStart, step);
      }

      if (state.showOverlay) {
        drawGeometricOverlay(wxStart, wyStart, step);
      }

      const deg = (((state.tPhase * 180.0 / Math.PI) % 360.0) + 360.0) % 360.0;
      const eqFrame = ((state.tPhase / (4.0 * Math.PI / 15.0)) % 15.0 + 15.0) % 15.0;
      document.getElementById('metricPhase').textContent = `${deg.toFixed(1)}°`;
      document.getElementById('canvasBadge').textContent =
        `视野 ${fov.toFixed(2)}× · 双线性平滑 · 网格 ${(state.gridStrength*100).toFixed(0)}% · 帧 ${eqFrame.toFixed(1)}/15`;
    }

    function drawOriginalBoundaryBox(wxStart, wyStart, step) {
      const x0 = (0.0 - wxStart) / step;
      const y0 = (0.0 - wyStart) / step;
      const wBox = W0 / step;
      const hBox = H0 / step;

      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.88)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(x0, y0, wBox, hBox);
      ctx.fillStyle = 'rgba(7, 8, 12, 0.78)';
      ctx.fillRect(x0 + 6, y0 + 6, 155, 20);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 11px monospace';
      ctx.fillText('原画 1.0× 边界', x0 + 11, y0 + 20);
      ctx.restore();
    }

    function drawGeometricOverlay(wxStart, wyStart, step) {
      const R_bound = state.R_bound * sf;
      const gamma = state.gamma;
      const wl_s = 19.95 * sf;
      ctx.save();
      for (let rIdx = -5; rIdx <= 9; rIdx++) {
        const cy0 = (30.0 + rIdx * 100.0) * sf;
        const isOdd = (rIdx & 1) !== 0;
        for (let cIdx = -3; cIdx <= 4; cIdx++) {
          const cx = ((isOdd ? 62.0 : -48.0) + cIdx * 220.0) * sf;
          const scrX = (cx - wxStart) / step;
          const scrY = (cy0 - wyStart) / step;
          const scrR = R_bound / step;

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
          ctx.lineWidth = 1.1;
          ctx.setLineDash([4, 4]);
          for (let k = 1; k <= 9; k++) {
            const rk = R_bound - k * (wl_s / (1.0 + gamma));
            if (rk > 0) {
              const scrRk = rk / step;
              const scrYk = (cy0 + gamma * (R_bound - rk) - wyStart) / step;
              ctx.beginPath();
              ctx.arc(scrX, scrYk, scrRk, Math.PI, 0, false);
              ctx.stroke();
            }
          }
          ctx.setLineDash([]);
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(scrX, scrY, scrR, Math.PI, 0, false);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    let isDragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
    canvas.addEventListener('mousedown', e => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      panStartX = state.panX;
      panStartY = state.panY;
    });
    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const rect = canvas.getBoundingClientRect();
      const scale = (W0 * state.fov) / Math.max(100, rect.width);
      const maxPan = Math.max(0, (W_WORLD - W0 * state.fov) * 0.48);
      state.panX = Math.max(-maxPan, Math.min(maxPan, panStartX - (e.clientX - dragStartX) * scale));
      state.panY = Math.max(-maxPan, Math.min(maxPan, panStartY - (e.clientY - dragStartY) * scale));
      if (state.engine === 'procedural') state.needsProcUpdate = true;
      if (!state.playing) renderFrame();
    });
    window.addEventListener('mouseup', () => { isDragging = false; });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const nextFov = Math.max(1.00, Math.min(2.50, state.fov + (e.deltaY > 0 ? 0.06 : -0.06)));
      setFovValue(nextFov);
    }, { passive: false });

    function setFovValue(v) {
      state.fov = v;
      const maxPan = Math.max(0, (W_WORLD - W0 * state.fov) * 0.48);
      state.panX = Math.max(-maxPan, Math.min(maxPan, state.panX));
      state.panY = Math.max(-maxPan, Math.min(maxPan, state.panY));

      document.getElementById('fovSlider').value = v;
      document.getElementById('fovVal').textContent = v <= 1.01 ? `1.00× (原画范围)` : `${v.toFixed(2)}× (扩展群球视野)`;
      document.getElementById('metricFov').textContent = `${v.toFixed(2)}×`;
      document.querySelectorAll('[data-fov]').forEach(b => {
        b.classList.toggle('active', Math.abs(parseFloat(b.dataset.fov) - v) < 0.03);
      });
      if (state.engine === 'procedural') state.needsProcUpdate = true;
      updateCanvasViewportSize();
      renderFrame();
    }

    let lastTime = performance.now();
    function tick(now) {
      const dt = Math.min(0.05, (now - lastTime) / 1000.0);
      lastTime = now;
      if (state.playing && !document.hidden) {
        state.tPhase = (state.tPhase + state.speed * dt) % (4.0 * Math.PI);
        renderFrame();
      }
      requestAnimationFrame(tick);
    }

    const playPauseBtn = document.getElementById('playPauseBtn');
    const STEP_1F = (4.0 * Math.PI) / 15.0;

    function pauseAtPhase(p) {
      state.playing = false;
      state.tPhase = p;
      playPauseBtn.textContent = '▶ 播放';
      renderFrame();
    }

    playPauseBtn.onclick = () => {
      state.playing = !state.playing;
      playPauseBtn.textContent = state.playing ? '⏸ 暂停' : '▶ 播放';
      renderFrame();
    };

    document.getElementById('stepPrevBtn').onclick = () => pauseAtPhase(state.tPhase - STEP_1F);
    document.getElementById('stepNextBtn').onclick = () => pauseAtPhase(state.tPhase + STEP_1F);
    document.getElementById('f0Btn').onclick = () => pauseAtPhase(0.0);
    document.getElementById('f4Btn').onclick = () => pauseAtPhase(4.0 * STEP_1F);
    document.getElementById('centerPanBtn').onclick = () => {
      state.panX = 0.0;
      state.panY = 0.0;
      if (state.engine === 'procedural') state.needsProcUpdate = true;
      renderFrame();
    };

    document.getElementById('resetBtn').onclick = () => {
      Object.assign(state, {
        playing: true, speed: 24.64, kx: 17.30, bendScale: 1.00,
        g1: 1.00, g2: 1.00, g3: 1.00,
        fov: 1.00, panX: 0.0, panY: 0.0, lockDomeSize: true, showOrigBox: false,
        gridStrength: 1.00, bwMix: 0.00, gridScale: 1.0,
        R_bound: 132.0, gamma: 0.52, needsProcUpdate: true
      });
      playPauseBtn.textContent = '⏸ 暂停';
      document.getElementById('lockDomeSizeToggle').checked = true;
      document.getElementById('showOrigBoxToggle').checked = false;
      setFovValue(1.00);
      document.getElementById('gridStrSlider').value = 1.00;
      document.getElementById('gridStrVal').textContent = '100% (1.00×)';
      document.getElementById('metricGrid').textContent = '100%';
      document.getElementById('bwMixSlider').value = 0.00;
      document.getElementById('bwMixVal').textContent = '0%（原色）';
      document.getElementById('gridScaleSlider').value = 1.0;
      document.getElementById('gridScaleVal').textContent = '1.0×（精细）';
      document.getElementById('speedSlider').value = 24.64;
      document.getElementById('speedVal').textContent = '24.64 弧度/秒';
      document.getElementById('kxSlider').value = 17.30;
      document.getElementById('kxVal').textContent = '17.30 周期';
      document.getElementById('bendSlider').value = 1.00;
      document.getElementById('bendVal').textContent = '1.00×';
      document.getElementById('g1Slider').value = 1.00;
      document.getElementById('g1Val').textContent = '1.00×';
      document.getElementById('g2Slider').value = 1.00;
      document.getElementById('g2Val').textContent = '1.00×';
      document.getElementById('g3Slider').value = 1.00;
      document.getElementById('g3Val').textContent = '1.00×';
      renderFrame();
    };

    document.getElementById('exportBtn').onclick = () => {
      const link = document.createElement('a');
      link.download = `seigaiha_fov_${state.fov.toFixed(2)}x.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    document.getElementById('fovSlider').oninput = e => {
      setFovValue(parseFloat(e.target.value));
    };
    document.querySelectorAll('[data-fov]').forEach(btn => {
      btn.onclick = () => setFovValue(parseFloat(btn.dataset.fov));
    });
    document.getElementById('lockDomeSizeToggle').onchange = e => {
      state.lockDomeSize = e.target.checked;
      updateCanvasViewportSize();
    };
    document.getElementById('showOrigBoxToggle').onchange = e => {
      state.showOrigBox = e.target.checked;
      renderFrame();
    };

    document.querySelectorAll('[data-engine]').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('[data-engine]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.engine = btn.dataset.engine;
        const showProc = state.engine === 'procedural';
        document.getElementById('procRowRadius').style.display = showProc ? 'flex' : 'none';
        document.getElementById('procRowGamma').style.display = showProc ? 'flex' : 'none';
        state.needsProcUpdate = true;
        renderFrame();
      };
    });

    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = btn.dataset.mode;
        renderFrame();
      };
    });

    document.getElementById('overlayToggle').onchange = e => {
      state.showOverlay = e.target.checked;
      renderFrame();
    };

    function bindSlider(id, valId, key, fmt, isProc) {
      const el = document.getElementById(id);
      const valEl = document.getElementById(valId);
      el.oninput = () => {
        const v = parseFloat(el.value);
        state[key] = v;
        valEl.textContent = fmt(v);
        if (key === 'gridStrength') document.getElementById('metricGrid').textContent = `${(v*100).toFixed(0)}%`;
        if (isProc) state.needsProcUpdate = true;
        renderFrame();
      };
    }

    bindSlider('gridStrSlider', 'gridStrVal', 'gridStrength', v => `${(v*100).toFixed(0)}% (${v.toFixed(2)}×)`, false);
    bindSlider('bwMixSlider', 'bwMixVal', 'bwMix', v => v === 0 ? '0%（原色）' : `${(v*100).toFixed(0)}% 黑白`, false);
    bindSlider('gridScaleSlider', 'gridScaleVal', 'gridScale', v => `${v.toFixed(2)}×`, false);
    bindSlider('speedSlider', 'speedVal', 'speed', v => `${v.toFixed(2)} 弧度/秒`, false);
    bindSlider('kxSlider', 'kxVal', 'kx', v => `${v.toFixed(2)} 周期`, false);
    bindSlider('bendSlider', 'bendVal', 'bendScale', v => `${v.toFixed(2)}×`, false);
    bindSlider('g1Slider', 'g1Val', 'g1', v => `${v.toFixed(2)}×`, false);
    bindSlider('g2Slider', 'g2Val', 'g2', v => `${v.toFixed(2)}×`, false);
    bindSlider('g3Slider', 'g3Val', 'g3', v => `${v.toFixed(2)}×`, false);
    bindSlider('radSlider', 'radVal', 'R_bound', v => `${v.toFixed(0)} 像素`, true);
    bindSlider('gamSlider', 'gamVal', 'gamma', v => v.toFixed(2), true);

    document.addEventListener('visibilitychange', () => { lastTime = performance.now(); });
    requestAnimationFrame(tick);
