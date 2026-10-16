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

