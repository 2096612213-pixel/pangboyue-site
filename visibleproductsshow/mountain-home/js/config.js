/**
 * CONFIG - Master Configuration for Mountain Hero Page
 * Tuned for 0.75s rhythmic major mountain shocks, synchronized solar ring recoil,
 * upper-right to lower-left diagonal straight snowfall, and 100% solid mountain geometry.
 */
export const CONFIG = {
  // ==========================================
  // 1. MOUNTAIN LAYERS ARCHITECTURE (100% SOLID)
  // ==========================================
  mountainLayers: 6,              // 六层连绵山岭，前后疏密错落
  mountainCoverage: 0.72,         // Mountain vertical coverage (55% - 70%)
  mountainAspectBaseline: 16 / 9,

  palette: {
    // Distant mountains (Layer 0 - 2)
    distantLit: '#88b5c9',
    distantShadow: '#537d92',
    distantSnowLit: '#ffffff',
    distantSnowShadow: '#d3e6f0',
    distantLine: 'rgba(255, 255, 255, 0.40)',

    // Midground mountains (Layer 3 - 5)
    midLit: '#4a7f96',
    midShadow: '#224d62',
    midSnowLit: '#ffffff',
    midSnowShadow: '#b8d5e4',
    midLine: 'rgba(255, 255, 255, 0.58)',

    // Foreground mountains (Layer 6 - 8)
    nearLit: '#19455a',
    nearShadow: '#051119',
    nearSnowLit: '#ffffff',
    nearSnowShadow: '#9cc2d5',
    nearLine: 'rgba(255, 255, 255, 0.75)',

    raySheenColor: 'rgba(180, 220, 240, 0.055)'
  },

  // ==========================================
  // 2. PARALLAX HORIZONTAL SCROLLING (Left to Right)
  // ==========================================
  scroll: {
    enabled: true,
    speedMin: 14.0,               // Distant mountains speed (px/sec, slow)
    speedMax: 78.0,               // Foreground mountains speed (px/sec, fast)
    direction: 1.0,               // +1 = Left to Right (x increases)
  },

  // ==========================================
  // 3. CELESTIAL SUN & SYNCHRONIZED RECOIL
  // ==========================================
  sun: {
    color: '#ff371a',             // Fiery vermilion / crimson-orange
    glowColor: '#bd332e',         // Atmospheric deep crimson halo
    radius: 0.165,                // Disk radius relative to viewport height
    glowRadius: 1.05,             // Grand soft atmospheric glow radius
    glowOpacity: 0.22,            // 克制的暖辉光，让天空的冷青色保持清晰
    
    // Positioning
    posX: 0.26,                   // X offset (+ = right)
    posY: 0.22,                   // Y offset (+ = up)
    mobilePosX: 0.12,
    mobilePosY: 0.26,
    mobileRadius: 0.14,
    
    // Equal-radius fine concentric rings
    rippleRings: {
      interval: 1.5,              // Exact period between wave emissions (seconds)
      wavelength: 0.18,           // Constant radial distance between consecutive rings
      thickness: 0.016,           // Ultra-fine crisp delicate ring width
      opacity: 0.38,              // Luminous brightness
      color: '#ff4d26',           // Crimson-orange solar ring color
      maxRadiusMult: 3.2          // Fade-out radius multiplier
    },

    // Solar Recoil: fires at the exact moment a ring emerges
    recoil: {
      amplitude: 12.0,            // Solar shudder kick (px) - clearly visible physical jolt
      scaleKick: 0.065,           // Disk expansion kick (+6.5%)
      decaySpeed: 9.0,            // Rapid damping decay
      frequency: 38.0             // Crisp recoil reverberation
    },

    glowBreathing: 0.06,
  },

  // ==========================================
  // 4. SKY ATMOSPHERE GRADIENT
  // ==========================================
  sky: {
    topColor: '#082030',          // 天顶：沉静的深青蓝
    midColor: '#185161',          // 中段：低饱和冷青
    horizonColor: '#346d78',      // 山顶附近：柔和雾青，从下向上加深
    warmthColor: '#962027',       // 太阳周围的暗红，与冷青自然融合
    warmthStrength: 0.58,
    warmthRadius: 0.72,           // 以屏幕高度为单位，窄屏时收拢
    vignetteStrength: 0.035,      // 很轻的边缘压暗，避免天空显得平板
  },

  // ==========================================
  // 5. RHYTHMIC MAJOR TREMOR (0.75s Period, Zero Resting Micro-Shake)
  // ==========================================
  shake: {
    // Zero baseline micro-tremor when resting
    baseShakeX: 0.0,
    baseShakeY: 0.0,
    baseShakeZ: 0.0,
    
    // Rhythmic major pulse every 0.75 seconds
    pulseInterval: 0.75,          // Strike every 0.75 seconds exactly
    pulseAttackTime: 0.04,        // Sharp explosive attack
    pulseDecayTime: 0.28,         // Damped ringdown settling in ~0.28s, completely still until next strike
    resonanceStrength: 15.0,      // Major shock displacement (px)
    resonanceScalePulse: 0.038,   // Major 3D depth perspective surge
    
    // Depth Parallax Weighting
    distantLayerMotionWeight: 0.35,
    foregroundLayerMotionWeight: 1.0,
  },

  // ==========================================
  // 6. AFTERIMAGE / MOTION ECHO (Ghost Trail)
  // ==========================================
  afterimage: {
    decay: 0.80,                  // Ghost trail persistence (~150 - 250ms duration)
    boostOnResonance: 1.45,
    minThreshold: 0.012,
  },

  // ==========================================
  // 7. CHROMATIC ABERRATION / RGB SPLIT
  // ==========================================
  rgbSplit: {
    baseOffset: 0.0003,
    maxOffset: 0.010,             // Visible optical split during the 0.75s shock
    velocityMultiplier: 0.000020,
    directionFollowsVelocity: true
  },

  // ==========================================
  // 8. DIAGONAL STRAIGHT-LINE SNOW (Upper-Right to Lower-Left)
  // ==========================================
  snow: {
    layerFarCount: 750,
    layerMidCount: 380,
    layerNearCount: 65,
    
    // Gentle, poetic slow diagonal straight-line trajectories
    baseSpeed: 2.4,               // Poetic slow speed (reduced from 7.2)
    angleBaseDeg: 228.0,          // Diagonal pointing from upper-right to lower-left (228 deg)
    angleSpreadDeg: 18.0,         // Individual random straight-line angle variation (±9 deg)
  },

  // ==========================================
  // 9. SYSTEM SETTINGS
  // ==========================================
  system: {
    maxDPR: 2.0,
    pauseWhenHidden: true,
    respectReducedMotion: true,
  }
};
