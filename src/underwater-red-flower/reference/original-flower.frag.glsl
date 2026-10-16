#version 300 es
    precision highp float;

    in vec2 v_uv;
    out vec4 outColor;

    uniform sampler2D u_atlas;
    uniform sampler2D u_causticAtlas;
    uniform float u_backgroundStrength;
    uniform float u_petalFlowStrength;
    uniform float u_resolution;
    uniform vec2 u_viewport;
    uniform float u_flowerScale;
    uniform float u_wt;
    uniform float u_time;
    uniform float u_rippleStr;
    uniform float u_causticStr;
    uniform float u_pondStr;
    uniform float u_floatStr;
    uniform float u_stamenStr;
    uniform float u_veinStr;
    uniform float u_stemStr;
    uniform float u_warmth;
    uniform vec3 u_flowerColor;
    uniform float u_colorMix;
    uniform bool u_exportFlower;
    uniform vec4 u_drops[10];

    const float S = 600.0;
    const vec2 CENTER = vec2(287.76 / 600.0, 269.68 / 600.0);

    // Catmull-Rom cubic weights for ultra-sharp super-resolution texture sampling
    vec4 cubicWeights(float f) {
      float f2 = f * f;
      float f3 = f2 * f;
      float w0 = -0.5 * f3 + f2 - 0.5 * f;
      float w1 =  1.5 * f3 - 2.5 * f2 + 1.0;
      float w2 = -1.5 * f3 + 2.0 * f2 + 0.5 * f;
      float w3 =  0.5 * f3 - 0.5 * f2;
      return vec4(w0, w1, w2, w3);
    }

    // Sample tile k (0, 1, or 2) at normalized uv in [0, 1]^2 using 16-tap Catmull-Rom bicubic interpolation
    vec3 sampleTileBicubic(int tileIdx, vec2 uv) {
      vec2 suv = clamp(uv, 0.002, 0.998) * S - 0.5;
      vec2 iuv = floor(suv);
      vec2 fuv = suv - iuv;
      vec4 wx = cubicWeights(fuv.x);
      vec4 wy = cubicWeights(fuv.y);

      float tileOff = float(tileIdx) * S;
      vec2 invAtlas = vec2(1.0 / (3.0 * S), 1.0 / S);

      vec3 sum = vec3(0.0);
      for (int m = -1; m <= 2; m++) {
        float yCoord = clamp(iuv.y + float(m), 0.0, S - 1.0) + 0.5;
        float wy_m = wy[m + 1];
        for (int n = -1; n <= 2; n++) {
          float xCoord = clamp(iuv.x + float(n), 0.0, S - 1.0) + 0.5 + tileOff;
          vec3 c = texture(u_atlas, vec2(xCoord, yCoord) * invAtlas).rgb;
          sum += (wx[n + 1] * wy_m) * c;
        }
      }
      return clamp(sum, 0.0, 1.0);
    }

    // Fast bilinear sample for finite-difference normal gradients
    float sampleStamenHeight(vec2 uv) {
      vec2 suv = clamp(uv, 0.002, 0.998);
      vec2 atlasUV = vec2((2.0 + suv.x) / 3.0, suv.y);
      return texture(u_atlas, atlasUV).b;
    }

    vec3 sampleCausticTile(int index, vec2 uv) {
      vec2 tile = vec2(float(index % 3), float(index / 3));
      vec2 local = (clamp(uv, 0.006, 0.994) * 383.0 + 0.5) / 384.0;
      return texture(u_causticAtlas, (tile + local) / vec2(3.0, 2.0)).rgb;
    }

    // Pseudo-random 2D hash for cellular water caustic lattice & pollen micro-texture
    vec2 hash22(vec2 p) {
      vec2 q = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return fract(sin(q) * 43758.5453123);
    }

    float hash21(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }

    float smoothPollen(vec2 p) {
      vec2 cell = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), f.x),
                 mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0, 1.0)), f.x), f.y);
    }

    // 2D Tsallis q=2 Hyperbolic Cellular Caustic Network (reproducing video 21s-26s natural pool caustics)
    // Returns vec4(c_sharp, c_broad, mrx, mry)
    vec4 tsallisHyperbolicCaustic(vec2 p, float wt, float kSharp, float kBroad) {
      vec2 ip = floor(p);
      vec2 fp = p - ip;

      float wsSum  = 0.0;
      float ws2Sum = 0.0;
      float wbSum  = 0.0;
      float wb2Sum = 0.0;
      vec2  vSum   = vec2(0.0);

      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 g = ip + vec2(float(i), float(j));
          vec2 h = hash22(g);
          float dirS = (h.x > 0.5) ? 1.0 : -1.0;
          float ang = wt * dirS + 6.2831853 * h.y;
          vec2 o = 0.5 + 0.33 * vec2(sin(ang + h.x * 3.14159), cos(ang - h.y * 3.14159));
          float cellW = 0.78 + 0.28 * sin(wt + (h.x - h.y) * 6.2831853);

          vec2 rVec = fp - (vec2(float(i), float(j)) + o);
          float d2 = dot(rVec, rVec);
          float win = pow(smoothstep(1.92, 0.72, d2), 2.0) * cellW;
          float rho = sqrt(d2 + 0.010);

          float ws = win * exp(-kSharp * rho);
          wsSum  += ws;
          ws2Sum += ws * ws;

          float wb = win * exp(-kBroad * rho);
          wbSum  += wb;
          wb2Sum += wb * wb;
          vSum   += wb * rVec;
        }
      }

      float cSharp = 1.0 - ws2Sum / (wsSum * wsSum + 1e-12);
      float cBroad = 1.0 - wb2Sum / (wbSum * wbSum + 1e-12);
      vec2  mr     = vSum / (wbSum + 1e-12);
      return vec4(cSharp, cBroad, mr.x, mr.y);
    }

    // Complete 21s-26s Dual-Layer Refracted Water Caustic & Wave Slope Field
    // Returns vec3(causticLuminance, waveGradX, waveGradY)
    vec3 evalWater21To26(vec2 uv, float wt) {
      // Multi-scale wave refraction warp (liquid crinkles & natural water-wave motion from 21s-26s)
      vec2 w = vec2(
        0.015 * sin(uv.x * 18.0 + uv.y * 13.0 - wt)
        + 0.009 * cos(uv.x * 33.0 - uv.y * 27.0 + wt)
        + 0.005 * sin(uv.x * 57.0 + uv.y * 49.0 - 2.0 * wt),
        0.015 * cos(uv.x * 15.0 - uv.y * 20.0 - wt)
        + 0.009 * sin(uv.x * 29.0 + uv.y * 35.0 - wt)
        + 0.005 * cos(uv.x * 53.0 - uv.y * 61.0 + 2.0 * wt)
      );

      float scale = 15.6;
      vec4 layer1 = tsallisHyperbolicCaustic((uv + w) * scale, wt, 12.2, 4.2);
      float cs1 = layer1.x;
      float cb1 = layer1.y;
      vec2  mr1 = layer1.zw;

      // Secondary refracted wave layer warped by Layer 1's slope mr1
      vec2 uv2 = vec2(
        0.80 * uv.x - 0.60 * uv.y - 0.6 * w.x + 0.028 * mr1.x,
        0.60 * uv.x + 0.80 * uv.y + 0.6 * w.y + 0.028 * mr1.y
      );
      vec4 layer2 = tsallisHyperbolicCaustic(uv2 * (scale * 1.42), -wt + 1.9, 11.4, 4.2);
      float cs2 = layer2.x;
      float cb2 = layer2.y;
      vec2  mr2 = layer2.zw;

      // Fine capillary wave shimmer
      float cap1 = sin(52.0 * (uv.x + 0.018 * mr1.x) + 38.0 * (uv.y + 0.018 * mr1.y) - 2.0 * wt)
                 * cos(44.0 * uv.y - 34.0 * uv.x + wt);
      float cap2 = sin(86.0 * (uv.x - 0.012 * mr1.x) - 70.0 * uv.y + 2.0 * wt)
                 * cos(76.0 * (uv.y + 0.012 * mr1.y) + 60.0 * uv.x - wt);

      float ridgeCore1  = smoothstep(0.19, 0.55, cs1 * (0.92 + 0.20 * cap1 + 0.12 * cap2));
      float ridgeYjunc1 = smoothstep(0.46, 0.66, cs1);
      float ridgeSkirt1 = smoothstep(0.12, 0.58, cb1 * (0.94 + 0.14 * cap1));

      float ridgeCore2  = smoothstep(0.20, 0.56, cs2 * (0.92 - 0.18 * cap1));
      float ridgeSkirt2 = smoothstep(0.14, 0.60, cb2);

      // 3D directional wave-trough shading inside each cell
      vec2 g = mr1 + 0.45 * mr2 + 0.12 * vec2(cap1);
      float slopeShade = clamp(0.5 + 0.68 * (-g.x * 0.65 - g.y * 0.76), 0.0, 1.0);

      float caustic = 0.08
                    + 0.25 * slopeShade * (0.50 + 0.50 * ridgeSkirt1)
                    + 0.20 * ridgeSkirt1
                    + 0.14 * ridgeSkirt2
                    + 0.34 * pow(ridgeCore1, 1.40)
                    + 0.16 * ridgeYjunc1
                    + 0.22 * pow(ridgeCore2, 1.40) * (0.45 + 0.55 * ridgeSkirt1)
                    + 0.035 * cap1 + 0.025 * cap2;

      caustic = pow(clamp((caustic - 0.08) / 0.88, 0.0, 1.0), 1.15);
      return vec3(caustic, g.x, g.y);
    }

    // 2D Left-to-Right Traveling Caustic Wave Network for additional caustic sparkle
    float causticPattern(vec2 p, float wt) {
      vec2 pa = vec2(p.x * 16.0 - wt, p.y * 16.0);
      vec2 pb = vec2(p.x * 23.0 - 2.0 * wt, p.y * 23.0);
      mat2 rot1 = mat2(0.92, -0.39, 0.39, 0.92);
      mat2 rot2 = mat2(0.88,  0.47, -0.47, 0.88);
      vec2 p1 = rot1 * pa;
      vec2 p2 = rot2 * pb;

      float w1 = sin(p1.x + 0.85 * sin(p1.y - wt)) + cos(p1.y + 0.85 * sin(p1.x - wt));
      float w2 = sin(p2.x - 0.80 * sin(p2.y - wt)) + cos(p2.y + 0.80 * cos(p2.x - wt));
      float c = 0.25 * (w1 + w2);
      return pow(clamp(0.5 + 0.5 * sin(c * 2.4), 0.0, 1.0), 3.0);
    }

    // Complete 3D Water Surface Elevation eta(uv, wt, time)
    float evalWaterHeight(vec2 uv, float wt, float time) {
      vec2 d = uv - CENTER;
      float r = length(d);
      float theta = atan(d.y, d.x);

      float w_pond1 = sin(13.5 * d.x + 3.2 * d.y - 1.0 * wt + 0.45 * sin(6.0 * d.y - wt));
      float w_pond2 = sin(12.8 * d.x - 3.6 * d.y - 1.0 * wt + 1.15);

      vec2 d_wake = d - vec2(0.035, 0.0);
      float r_wake = length(d_wake);
      float w_wake1 = sin(32.0 * r_wake - wt - 4.5 * d.x + 0.38 * sin(5.0 * theta)) * exp(-2.1 * r);
      float w_wake2 = sin(52.0 * r_wake - 2.0 * wt - 7.0 * d.x - 0.30 * cos(7.0 * theta)) * exp(-2.6 * r);
      float w_cap   = 0.16 * sin(38.0 * d.x + 14.0 * d.y - 2.0 * wt) * cos(34.0 * d.x - 16.0 * d.y - wt) * exp(-1.5 * r);

      float eta = (0.38 * w_pond1 + 0.24 * w_pond2 + 0.46 * w_wake1 + 0.20 * w_wake2 + w_cap) * u_rippleStr;

      for (int i = 0; i < 10; i++) {
        vec4 dp = u_drops[i];
        float dt = time - dp.z;
        if (dt > 0.0 && dt < 4.5 && dp.w > 0.0) {
          float dist = length(uv - dp.xy);
          float waveFront = dist - 0.22 * dt;
          float env = exp(-1.35 * dt) * exp(-130.0 * waveFront * waveFront) * exp(-2.2 * dist);
          eta += dp.w * 0.88 * sin(82.0 * dist - 18.0 * dt) * env;
        }
      }
      return eta;
    }

    // Exact centerline X(ty) of the Vertically Downward botanical stem
    float evalStemCenterX(float ty, float wt, float wNormX) {
      float tp = max(0.0, ty);
      float flex = pow(smoothstep(0.06, 1.20, tp), 1.30) * u_floatStr;
      float naturalCurve = -0.0085 * sin(2.8 * tp) + 0.0035 * (1.0 - cos(4.2 * tp));
      float currentWave = flex * (
        0.0068 * sin(wt - 2.6 * tp + 0.45)
        + 0.0026 * cos(2.0 * wt - 4.2 * tp - 0.3)
      ) + smoothstep(0.08, 0.90, tp) * 0.0030 * wNormX * u_rippleStr;

      return 0.484 + naturalCurve + currentWave;
    }

    // Evaluate the 3D Botanical Stem with Chiaroscuro Light & Shadow matching the Flower Petals
    vec4 evalHarmonizedStem(
      vec2 p,
      float wt,
      float wNormX,
      float sharedFlow,
      float waterLocal,
      vec3 tint
    ) {
      if (u_stemStr <= 0.001) return vec4(0.0);

      float y0 = 0.680;
      float t_y = p.y - y0;
      if (t_y < -0.02) return vec4(0.0);
      float ty_pos = max(0.0, t_y);

      float x_center = evalStemCenterX(ty_pos, wt, wNormX);
      float x_next   = evalStemCenterX(ty_pos + 0.004, wt, wNormX);
      float slope    = (x_next - x_center) / 0.004;

      vec2 T_stem = normalize(vec2(slope, 1.0));
      float d_perp = (p.x - x_center) * T_stem.y;
      float s_arc  = ty_pos * sqrt(1.0 + 0.68 * slope * slope);

      float stemScale = clamp(u_stemStr, 0.35, 1.85);
      float radScale  = 0.82 + 0.18 * stemScale;

      // 1. Sculpted Receptacle / Calyx Cup & Extended Organic Stem Nodes (down through screen bottom)
      float calyxCup = 0.0155 * exp(-pow((s_arc - 0.105) / 0.042, 2.0));
      float node1 = exp(-pow((s_arc - 0.31) / 0.024, 2.0));
      float node2 = exp(-pow((s_arc - 0.58) / 0.028, 2.0));
      float node3 = exp(-pow((s_arc - 0.88) / 0.032, 2.0));
      float node4 = exp(-pow((s_arc - 1.21) / 0.034, 2.0));
      float node5 = exp(-pow((s_arc - 1.56) / 0.036, 2.0));
      float node6 = exp(-pow((s_arc - 1.93) / 0.038, 2.0));
      float node7 = exp(-pow((s_arc - 2.32) / 0.040, 2.0));
      float node8 = exp(-pow((s_arc - 2.73) / 0.040, 2.0));
      float node9 = exp(-pow((s_arc - 3.16) / 0.042, 2.0));
      float node10 = exp(-pow((s_arc - 3.61) / 0.042, 2.0));
      float node11 = exp(-pow((s_arc - 4.08) / 0.044, 2.0));
      float nodeBulge = 0.0026 * (
          node1 + 0.90 * node2 + 0.82 * node3 + 0.78 * node4 + 0.75 * node5
        + 0.72 * node6 + 0.70 * node7 + 0.68 * node8 + 0.66 * node9 + 0.64 * node10 + 0.62 * node11
      );
      float organicWave = 0.0007 * sin(11.0 * s_arc + 0.4) * smoothstep(0.14, 0.30, s_arc);

      float baseRadius = (0.0132 - 0.0022 * smoothstep(0.12, 0.48, s_arc) + 0.0012 * smoothstep(0.55, 1.10, s_arc) + organicWave) * radScale;
      float R_main = baseRadius + (calyxCup + nodeBulge) * radScale;

      // 2. Clasping Nodal Leaf-Buds & Calyx Sepals (alternating naturally on left and right)
      float t_b1 = clamp((0.315 - s_arc) / 0.095, 0.0, 1.0);
      float bud1_bulge = (s_arc > 0.220 && s_arc < 0.315)
                        ? 0.0058 * sin(3.14159265 * pow(t_b1, 0.68)) * (1.0 - 0.25 * t_b1 * t_b1) * radScale
                        : 0.0;
      float t_b2 = clamp((0.588 - s_arc) / 0.110, 0.0, 1.0);
      float bud2_bulge = (s_arc > 0.478 && s_arc < 0.588)
                        ? 0.0066 * sin(3.14159265 * pow(t_b2, 0.65)) * (1.0 - 0.22 * t_b2 * t_b2) * radScale
                        : 0.0;
      float t_b3 = clamp((0.888 - s_arc) / 0.115, 0.0, 1.0);
      float bud3_bulge = (s_arc > 0.773 && s_arc < 0.888)
                        ? 0.0060 * sin(3.14159265 * pow(t_b3, 0.66)) * (1.0 - 0.22 * t_b3 * t_b3) * radScale
                        : 0.0;
      float t_b4 = clamp((1.218 - s_arc) / 0.120, 0.0, 1.0);
      float bud4_bulge = (s_arc > 1.098 && s_arc < 1.218)
                        ? 0.0055 * sin(3.14159265 * pow(t_b4, 0.66)) * (1.0 - 0.22 * t_b4 * t_b4) * radScale
                        : 0.0;
      float t_b5 = clamp((1.568 - s_arc) / 0.125, 0.0, 1.0);
      float bud5_bulge = (s_arc > 1.443 && s_arc < 1.568)
                        ? 0.0052 * sin(3.14159265 * pow(t_b5, 0.66)) * (1.0 - 0.22 * t_b5 * t_b5) * radScale
                        : 0.0;
      float t_b6 = clamp((1.938 - s_arc) / 0.130, 0.0, 1.0);
      float bud6_bulge = (s_arc > 1.808 && s_arc < 1.938)
                        ? 0.0048 * sin(3.14159265 * pow(t_b6, 0.66)) * (1.0 - 0.22 * t_b6 * t_b6) * radScale
                        : 0.0;
      float t_b7 = clamp((2.328 - s_arc) / 0.135, 0.0, 1.0);
      float bud7_bulge = (s_arc > 2.193 && s_arc < 2.328)
                        ? 0.0045 * sin(3.14159265 * pow(t_b7, 0.66)) * (1.0 - 0.22 * t_b7 * t_b7) * radScale
                        : 0.0;
      float t_b8 = clamp((2.738 - s_arc) / 0.135, 0.0, 1.0);
      float bud8_bulge = (s_arc > 2.603 && s_arc < 2.738)
                        ? 0.0042 * sin(3.14159265 * pow(t_b8, 0.66)) * (1.0 - 0.22 * t_b8 * t_b8) * radScale
                        : 0.0;

      float t_sep = clamp((0.145 - s_arc) / 0.068, 0.0, 1.0);
      float sep_bulge = (s_arc > 0.077 && s_arc < 0.145)
                       ? 0.0040 * sin(3.14159265 * pow(t_sep, 0.60)) * radScale
                       : 0.0;

      float x_L = -R_main - bud2_bulge - bud4_bulge - bud6_bulge - bud8_bulge - sep_bulge * 0.85;
      float x_R =  R_main + bud1_bulge + bud3_bulge + bud5_bulge + bud7_bulge + sep_bulge * 0.70;
      float x_mid  = 0.5 * (x_L + x_R);
      float R_half = max(0.5 * (x_R - x_L), 1e-4);
      float d_stem = abs(d_perp - x_mid) - R_half;

      float aa = 2.0 / u_resolution;
      float stemMask = (1.0 - smoothstep(-aa * 1.4, aa * 1.8, d_stem))
                     * smoothstep(-0.01, 0.04, t_y)
                     * clamp(u_stemStr, 0.0, 1.0);
      if (stemMask <= 0.001) return vec4(0.0);

      // 3. Cylindrical 3D Chiaroscuro Light & Shadow Flow (matching the flower's dramatic chiaroscuro)
      float u_cyl = clamp((d_perp - x_mid) / R_half, -1.0, 1.0);
      float z_cyl = sqrt(max(0.0, 1.0 - u_cyl * u_cyl));

      float twistU = u_cyl + 0.12 * sin(2.6 * s_arc);
      float vFibers = (0.65 * sin(22.0 * twistU + 3.5 * s_arc) + 0.35 * cos(44.0 * twistU - 5.2 * s_arc)) * pow(z_cyl, 1.2);
      float nodalRing = (
          node1 * cos(52.0 * (s_arc - 0.31))
        + 0.90 * node2 * cos(50.0 * (s_arc - 0.58))
        + 0.85 * node3 * cos(48.0 * (s_arc - 0.88))
        + 0.80 * node4 * cos(46.0 * (s_arc - 1.21))
        + 0.75 * node5 * cos(44.0 * (s_arc - 1.56))
        + 0.70 * node6 * cos(42.0 * (s_arc - 1.93))
        + 0.68 * node7 * cos(40.0 * (s_arc - 2.32))
        + 0.65 * node8 * cos(40.0 * (s_arc - 2.73))
        + 0.62 * node9 * cos(38.0 * (s_arc - 3.16))
        + 0.60 * node10 * cos(38.0 * (s_arc - 3.61))
        + 0.58 * node11 * cos(36.0 * (s_arc - 4.08))
      );

      // Multi-harmonic chiaroscuro light wave traveling along the stem in phase with the flower
      float ph_stem = wt - 3.6 * s_arc + 1.15 * twistU;
      float chiaroscuroWave = pow(0.5 + 0.5 * cos(ph_stem - 0.4), 1.45)
                            * (0.65 + 0.35 * sin(2.0 * ph_stem + 0.8));

      // Orbiting light direction across the cylinder cross-section
      float lightX = 0.55 * cos(wt + 0.5) + 0.25;
      float cylDiffuse = pow(clamp(0.50 * z_cyl + 0.50 * max(0.0, u_cyl * lightX + z_cyl * 0.78), 0.0, 1.0), 1.25);
      float cylSpec = exp(-pow((u_cyl - 0.28 * cos(wt + 0.5)) / 0.28, 2.0)) * pow(z_cyl, 0.8) * (0.18 + 0.62 * chiaroscuroWave);
      float rimSheen = pow(1.0 - z_cyl, 1.8) * smoothstep(0.0, 0.35, z_cyl) * (0.10 + 0.28 * chiaroscuroWave);

      float stemCoreLum = cylDiffuse * (0.16 + 0.52 * chiaroscuroWave + 0.22 * sharedFlow)
                        + cylSpec
                        + rimSheen
                        + 0.032 * u_veinStr * vFibers * (0.35 + 0.65 * chiaroscuroWave)
                        + 0.055 * nodalRing * z_cyl * (0.4 + 0.6 * chiaroscuroWave);

      // Deep ambient occlusion right under the bottom petals & subtle natural depth gradient without cut-off
      float underPetalAO = 0.24 + 0.76 * smoothstep(0.09, 0.19, s_arc);
      float depthAtten   = 1.0 - 0.25 * clamp((s_arc - 0.10) / 2.20, 0.0, 1.0);
      float cylEdgeFade  = smoothstep(0.0, 0.34, z_cyl);
      float stemLumFinal = clamp(stemCoreLum * underPetalAO * depthAtten * cylEdgeFade, 0.0, 0.96);

      if ( waterLocal > 0.001 ) {
        stemLumFinal = mix(waterLocal, stemLumFinal, smoothstep(0.0, 0.45, z_cyl));
      }

      // 4. Harmonized Chiaroscuro Subsurface Scattering & Color Grading matching the flower petals
      float warmSSS_stem = pow(max(0.0, sin(3.14159265 * stemLumFinal)), 1.25) * (1.0 - 0.52 * stemLumFinal) * u_warmth * 0.055;
      float coolSil_stem = pow(stemLumFinal, 2.3) * (1.0 - stemLumFinal) * 0.055;
      vec3 stemOrigRGB = clamp(vec3(
        stemLumFinal + warmSSS_stem - 0.25 * coolSil_stem,
        stemLumFinal + 0.42 * warmSSS_stem + 0.10 * coolSil_stem,
        stemLumFinal - 0.80 * warmSSS_stem + coolSil_stem
      ), 0.0, 1.0);

      float stemLumVal = dot(stemOrigRGB, vec3(0.2126, 0.7152, 0.0722));
      vec3 stemTintedRGB = clamp(stemLumVal * tint, 0.0, 1.0);
      float stemColorW = u_colorMix * smoothstep(0.12, 0.52, z_cyl) * (0.82 - 0.62 * pow(stemLumFinal, 2.4));
      vec3 stemFinalColor = mix(stemOrigRGB, stemTintedRGB, clamp(stemColorW, 0.0, 1.0));

      return vec4(stemFinalColor, stemMask);
    }

    void main() {
      float shortSide = min(u_viewport.x, u_viewport.y);
      vec2 screenPosition = (v_uv - 0.5) * u_viewport / shortSide;
      vec2 flowerUV = CENTER + screenPosition / u_flowerScale;
      vec2 backgroundUV = vec2(0.5) + screenPosition * 0.85;
      vec2 d = flowerUV - CENTER;
      float r = length(d);
      float theta = atan(d.y, d.x);
      vec2 rDir = d / max(r, 1e-5);
      vec2 tDir = vec2(-rDir.y, rDir.x);

      // 1. Smooth Chiaroscuro Light Flow (Water Ripples Removed by Default)
      float eps = 1.0 / 600.0;
      float petalFlowSmooth = 0.52
                            + 0.28 * sin(backgroundUV.x * 9.0 + backgroundUV.y * 7.0 - u_wt)
                            + 0.20 * cos(backgroundUV.x * 13.0 - backgroundUV.y * 10.0 + u_wt);
      vec3 waterField = vec3(petalFlowSmooth, 0.0, 0.0);
      if (u_backgroundStrength > 0.001 || u_rippleStr > 0.001) {
        waterField = evalWater21To26(backgroundUV, u_wt);
      }
      float sharedFlow = mix(petalFlowSmooth, waterField.x, clamp(u_rippleStr, 0.0, 1.0));
      vec2  wGrad      = waterField.yz * clamp(u_rippleStr, 0.0, 1.0);
      float petalFlowField = petalFlowSmooth;

      float eta_c = 0.0, eta_r = 0.0, eta_l = 0.0, eta_d = 0.0, eta_u = 0.0;
      if (u_rippleStr > 0.001) {
        eta_c = evalWaterHeight(flowerUV, u_wt, u_time);
        eta_r = evalWaterHeight(flowerUV + vec2(eps, 0.0), u_wt, u_time);
        eta_l = evalWaterHeight(flowerUV - vec2(eps, 0.0), u_wt, u_time);
        eta_d = evalWaterHeight(flowerUV + vec2(0.0, eps), u_wt, u_time);
        eta_u = evalWaterHeight(flowerUV - vec2(0.0, eps), u_wt, u_time);
      }

      vec2 gradEta = vec2(eta_r - eta_l, eta_d - eta_u) * 0.5;
      float lapEta = (eta_r + eta_l + eta_d + eta_u - 4.0 * eta_c);
      eta_c += (petalFlowField - 0.45) * 0.25 * u_petalFlowStrength;
      gradEta += wGrad * 0.0025 * u_petalFlowStrength;
      vec3 wNorm = normalize(vec3(-gradEta * 15.0, 1.0));

      vec3 lightDir = normalize(vec3(0.46 * cos(u_wt + 0.6), 0.46 * sin(u_wt + 0.6), 0.88));
      vec3 halfVec  = normalize(lightDir + vec3(0.0, 0.0, 1.0));

      // 2. Hydro-Elastic Floating Petal Displacement
      float w_petal = pow(smoothstep(0.092, 0.39, r), 1.42) * u_floatStr;

      float radialBreath = 0.0042 * sin(5.0 * theta + 9.5 * r - u_wt)
                         + 0.0021 * cos(7.0 * theta - 13.0 * r + u_wt);
      float marginalFlutter = 0.0014 * smoothstep(0.22, 0.38, r) * sin(26.0 * theta + 18.0 * r - 2.0 * u_wt);
      float azimuthalSway = 0.0024 * sin(6.0 * theta - 8.0 * r + u_wt);

      vec2 u_petal = w_petal * ((radialBreath + marginalFlutter) * rDir + azimuthalSway * tDir)
                   + smoothstep(0.08, 0.25, r) * 0.0024 * wNorm.xy * u_rippleStr;

      float w_st_sway = smoothstep(0.022, 0.075, r) * (1.0 - smoothstep(0.088, 0.108, r)) * u_floatStr;
      vec2 u_stamen = w_st_sway * 0.0018 * vec2(cos(u_wt - 9.0 * r + 2.0 * theta), sin(u_wt - 9.0 * r + 2.0 * theta))
                    + w_st_sway * 0.0012 * wNorm.xy;

      vec2 baseShift = vec2(0.010 * sin(u_wt + 0.9) + 0.004 * sin(2.0 * u_wt + 2.1),
                            0.008 * cos(u_wt - 0.4) + 0.003 * sin(2.0 * u_wt));
      vec2 rotShift  = vec2(-d.y, d.x) * 0.045 * sin(u_wt + 0.7);
      vec2 sway = baseShift + rotShift + wNorm.xy * 0.010 * u_rippleStr;
      vec2 uv_warped = flowerUV + u_petal + u_stamen + sway;

      vec2 uv_stem = flowerUV + baseShift + rotShift * smoothstep(0.95, 0.68, flowerUV.y) * 0.35
                   + 0.0025 * wGrad + wNorm.xy * 0.0045 * u_rippleStr;

      // 3. Bicubic Super-Resolution Sampling of the 3-Tile Harmonic & Stamen Atlas
      vec3 t0 = sampleTileBicubic(0, uv_warped);
      vec3 t1 = sampleTileBicubic(1, uv_warped);
      vec3 t2 = sampleTileBicubic(2, uv_warped);

      float A0  = t0.r * 255.0;
      float Re1 = (t0.g * 255.0 - 128.0) / 0.90;
      float Im1 = (t0.b * 255.0 - 128.0) / 0.90;

      float Re2 = (t1.r * 255.0 - 128.0) / 1.00;
      float Im2 = (t1.g * 255.0 - 128.0) / 1.00;
      float Re3 = (t1.b * 255.0 - 128.0) / 1.35;

      float Im3   = (t2.r * 255.0 - 128.0) / 1.35;
      float s_Det = (t2.g * 255.0 - 128.0) / 1.80;
      float s_Stm = t2.b;

      // Compute soft silhouette mask first so we can un-premultiply outer petal edges cleanly
      float domainMask = step(0.0, uv_warped.x) * step(uv_warped.x, 1.0) * step(0.0, uv_warped.y) * step(uv_warped.y, 1.0);
      float softEdge = sampleCausticTile(5, uv_warped).b;
      for (int i = 0; i < 8; i++) {
        float ang = 6.2831853 * float(i) / 8.0 + 0.3927;
        softEdge += sampleCausticTile(5, uv_warped + vec2(cos(ang), sin(ang)) * 0.0055).b;
      }
      float softMaskRaw = softEdge / 9.0;

      float amp1 = length(vec2(Re1, Im1));
      float rawSignal = A0 + 0.85 * amp1;
      float flowerAlpha = smoothstep(4.0, 22.0, rawSignal);

      // 4. 3-Harmonic Chiaroscuro Wave + Water-Ripple Phase Refraction
      float dPhi = 0.25 * eta_c * smoothstep(0.04, 0.18, r);
      float ph1 = u_wt - dPhi;
      float ph2 = 2.0 * ph1;
      float ph3 = 3.0 * ph1;

      float L_base = A0
                   + Re1 * cos(ph1) - Im1 * sin(ph1)
                   + Re2 * cos(ph2) - Im2 * sin(ph2)
                   + Re3 * cos(ph3) - Im3 * sin(ph3);
      L_base = clamp(L_base, 0.0, 255.0);

      // Keep native chiaroscuro petal edge falloff on dark background

      // 5. Super-Resolution Silk Petal Venation
      vec2 d_w = uv_warped - CENTER;
      float r_w = length(d_w);
      float th_w = atan(d_w.y, d_w.x);
      float microVeins = 0.65 * sin(240.0 * th_w + 3.5 * sin(26.0 * r_w + 5.0 * th_w))
                       + 0.35 * sin(460.0 * th_w - 4.0 * cos(38.0 * r_w));
      float veinMask = flowerAlpha * smoothstep(0.10, 0.14, r_w) * (0.25 + 0.75 * (L_base / 255.0));
      float L_petal = L_base + u_veinStr * (0.75 * s_Det * (0.25 + 0.75 * (L_base / 255.0)) + 2.4 * microVeins * veinMask);

      // 6. Hyper-Realistic 3D Botanical Stamen Crown, Filaments, Anthers & Pistil
      float stm_r = sampleStamenHeight(uv_warped + vec2(eps, 0.0));
      float stm_l = sampleStamenHeight(uv_warped - vec2(eps, 0.0));
      float stm_d = sampleStamenHeight(uv_warped + vec2(0.0, eps));
      float stm_u = sampleStamenHeight(uv_warped - vec2(0.0, eps));
      vec3 sNorm = normalize(vec3(-(stm_r - stm_l) * 16.0, -(stm_d - stm_u) * 16.0, 1.0));

      float sNdotH  = max(dot(sNorm, halfVec), 0.0);
      float sNdotL  = max(dot(sNorm, lightDir), 0.0);

      float stMaskStrict = smoothstep(0.12, 0.82, s_Stm);
      float spineMask    = smoothstep(0.32, 0.78, s_Stm);
      float antherRing   = exp(-pow((r_w - 0.072) / 0.024, 2.0));
      float stigmaCollar = exp(-pow((r_w - 0.030) / 0.0055, 2.0));
      float pistilCore   = 1.0 - smoothstep(0.012, 0.028, r_w);

      float pollenGrain = 0.65 + 0.70 * smoothPollen(uv_warped * 950.0);
      float filamentSpec = pow(sNdotH, 16.0) * spineMask * (1.0 - pistilCore) * 38.0;
      float antherSpec   = pow(sNdotH, 9.0) * pow(spineMask, 1.2) * antherRing * (56.0 * pollenGrain + 28.0 * sNdotL);
      float stigmaSheen  = stigmaCollar * spineMask * (26.0 + 42.0 * pow(sNdotH, 6.0) * pollenGrain);
      float pistilDew    = pistilCore * pow(sNdotH, 24.0) * 32.0 * pollenGrain;

      float stTotalLight = (filamentSpec + antherSpec + stigmaSheen + pistilDew) * u_stamenStr;
      float L_blossom = L_petal * (1.0 - 0.65 * pow(stMaskStrict, 1.25)) + stTotalLight;

      // 7. Underwater Caustic Light Web & Rim Translucency
      float cWeb = causticPattern(uv_warped + 0.012 * wNorm.xy, u_wt);
      float causticFocus = clamp(-lapEta * 12.0, 0.0, 1.0) + 0.65 * cWeb;
      float petalCaustic = flowerAlpha * (1.0 - stMaskStrict) * causticFocus * (14.0 + 0.16 * L_petal) * u_causticStr;

      float wNdotH = max(dot(wNorm, halfVec), 0.0);
      float pondRadialFade = exp(-2.1 * max(r - 0.14, 0.0));
      float pondSpec = (pow(wNdotH, 26.0) * 54.0 + cWeb * 15.0 * length(wNorm.xy) * 6.0) * pondRadialFade * u_pondStr;

      float L_total = clamp(L_blossom + petalCaustic + flowerAlpha * 0.35 * pondSpec, 0.0, 255.0);

      float flowingSheen = smoothstep(0.48, 0.86, petalFlowField);
      float flowOnPetals = clamp(L_total * (0.58 + 0.72 * petalFlowField) + 58.0 * flowingSheen * (0.30 + 0.70 * sqrt(L_total / 255.0)), 0.0, 255.0);
      L_total = mix(L_total, flowOnPetals, u_petalFlowStrength * flowerAlpha * (1.0 - 0.55 * stMaskStrict));

      // 8. Flower Color Grading
      float normL = L_total / 255.0;
      float normL_sc = clamp(pow(normL, 1.03) * (1.04 - 0.04 * normL), 0.0, 1.0);
      float L_out = normL_sc * 255.0;

      float warmSSS = pow(max(0.0, sin(3.14159265 * normL_sc)), 1.25) * (1.0 - 0.52 * normL_sc) * flowerAlpha * u_warmth;
      float coolSilver = pow(normL_sc, 2.3) * (1.0 - normL_sc) * 3.8;
      float waterTint = flowerAlpha * 0.25 * pondSpec;
      float pollenGold = (antherSpec + 0.4 * stigmaSheen) * u_stamenStr * u_warmth;

      float R = clamp(L_out + 13.5 * warmSSS - 3.5 * coolSilver + 0.34 * pollenGold - 0.18 * waterTint, 0.0, 255.0);
      float G = clamp(L_out +  5.8 * warmSSS + 1.5 * coolSilver + 0.20 * pollenGold + 0.06 * waterTint, 0.0, 255.0);
      float B = clamp(L_out - 11.0 * warmSSS + 14.0 * coolSilver - 0.08 * pollenGold + 0.48 * waterTint, 0.0, 255.0);

      vec3 originalColor = vec3(R, G, B) / 255.0;
      float luminance = dot(originalColor, vec3(0.2126, 0.7152, 0.0722));
      vec3 tint = u_flowerColor / max(dot(u_flowerColor, vec3(0.2126, 0.7152, 0.0722)), 0.08);
      vec3 tinted = clamp(luminance * tint, 0.0, 1.0);

      float colorWeight = u_colorMix * flowerAlpha
                        * (1.0 - 0.70 * stMaskStrict) * (1.0 - 0.72 * pow(normL_sc, 3.0));
      vec3 flowerFinalColor = mix(originalColor, tinted, colorWeight);

      // Clean outer petal mask
      float petalMask = domainMask * smoothstep(0.50, 0.92, softMaskRaw) * flowerAlpha;
      float iconFlowerMask = domainMask * max(smoothstep(0.10, 0.95, flowerAlpha), 1.0 - smoothstep(0.085, 0.12, r_w));
      float flowerMask = u_exportFlower ? iconFlowerMask : petalMask;

      // 9. Pure Deep Black Background & Harmonized Continuous Stem Composition (background water ripples removed)
      float monochromeWater = 0.0;
      vec4 stemData = evalHarmonizedStem(uv_stem, u_wt, wNorm.x, petalFlowSmooth, monochromeWater, tint);
      vec3 stemFinalColor = stemData.rgb;
      float stemAlpha = stemData.a;

      if (u_exportFlower) {
        float combinedAlpha = max(flowerMask, stemAlpha);
        vec3 exportColor = mix(stemFinalColor, flowerFinalColor, flowerMask);
        outColor = vec4(exportColor * combinedAlpha, combinedAlpha);
      } else {
        vec3 withStem = mix(vec3(monochromeWater), stemFinalColor, stemAlpha);
        vec3 finalColor = mix(withStem, flowerFinalColor, petalMask);
        finalColor = clamp(finalColor, 0.0, 1.0);
        outColor = vec4(finalColor, 1.0);
      }
    }
