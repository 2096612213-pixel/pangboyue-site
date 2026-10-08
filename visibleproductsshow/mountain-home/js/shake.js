/**
 * ShakeController - 0.75-Second Rhythmic Major Seismic Pulse Engine
 * Features:
 * - Zero resting jitter: mountains are completely calm and steady between shocks
 * - Sharp, powerful major tectonic shockwave strikes every 0.75 seconds
 * - Depth parallax weighting across layers
 * - Velocity-coupled optical chromatic aberration and ghost echo
 */
import { CONFIG } from './config.js';

export class ShakeController {
  constructor() {
    this.time = 0;
    this.cycleTimer = 0;

    this.prevX = 0;
    this.prevY = 0;

    this.currentVelocity = 0;
    this.smoothVelocity = 0;
    this.velocityDirX = 1;
    this.velocityDirY = 0;

    this.pulseActive = false;
    this.pulseElapsed = 0;
    this.pulseIntensity = 0;
    this.pulseMultiplier = 1.0;
    this.musicDriven = false;
    this.pulseFresh = false;

    this.impulseDirX = 1;
    this.impulseDirY = 0.5;

    this.globalDisplacement = { x: 0, y: 0, z: 0, scale: 1.0 };
    this.reducedMotion = false;

    if (CONFIG.system.respectReducedMotion && typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = mediaQuery.matches;
      mediaQuery.addEventListener('change', (e) => {
        this.reducedMotion = e.matches;
      });
    }
  }

  triggerPulse(strengthMultiplier = 1.0, elapsed = 0, beatTime = null) {
    this.pulseActive = true;
    this.pulseElapsed = elapsed;
    this.lastBeatTime = beatTime;
    this.pulseFresh = true;
    this.pulseMultiplier = strengthMultiplier;

    // Pick alternating or varied seismic shock direction
    const angle = (Math.random() - 0.5) * 0.6; // Primary horizontal with vertical component
    this.impulseDirX = Math.cos(angle);
    this.impulseDirY = Math.sin(angle);
  }

  resetPulse() {
    this.pulseActive = false;
    this.pulseFresh = false;
    this.pulseElapsed = 0;
    this.pulseIntensity = 0;
    this.prevX = this.prevY = this.currentVelocity = this.smoothVelocity = 0;
    this.globalDisplacement = { x: 0, y: 0, z: 0, scale: 1.0 };
  }

  update(dt, musicTime = null) {
    const safeDt = Math.min(dt, 0.05);
    this.time += safeDt;

    if (this.reducedMotion) {
      this.globalDisplacement = { x: 0, y: 0, z: 0, scale: 1.0 };
      this.smoothVelocity = 0;
      this.pulseIntensity = 0;
      return;
    }

    // 1. Rhythmic major pulse scheduler (every 0.75 seconds exactly)
    if (!this.musicDriven) {
    this.cycleTimer += safeDt;
    if (this.cycleTimer >= CONFIG.shake.pulseInterval) {
      this.cycleTimer -= CONFIG.shake.pulseInterval;
      this.triggerPulse(1.0);
    }

    }

    // 2. Pulse Envelope Calculation
    let impulseMag = 0;
    let impulseScaleMag = 0;

    if (this.pulseActive) {
      if (this.musicDriven && Number.isFinite(musicTime) && Number.isFinite(this.lastBeatTime)) {
        this.pulseElapsed = Math.max(0, musicTime - this.lastBeatTime);
      } else if (!this.pulseFresh) this.pulseElapsed += safeDt;
      this.pulseFresh = false;
      const attack = CONFIG.shake.pulseAttackTime;
      const decay = CONFIG.shake.pulseDecayTime;
      const mult = this.pulseMultiplier;

      if (this.musicDriven) {
        // 鼓点当帧立即顶起，短促回弹；避免原本的 40ms 攻击延迟。
        const t = this.pulseElapsed;
        this.pulseIntensity = t < 0.26 ? Math.cos(t * 42.0) * Math.exp(-14.0 * t) * mult : 0;
        if (t >= 0.26) this.pulseActive = false;
      } else if (this.pulseElapsed < attack) {
        // Sudden explosive seismic shock
        const t = this.pulseElapsed / attack;
        this.pulseIntensity = (t * t) * mult;
      } else if (this.pulseElapsed < attack + decay) {
        // Damped reverberating ringdown
        const tDecay = (this.pulseElapsed - attack) / decay;
        const envelope = Math.exp(-4.2 * tDecay);
        // Rapid decaying seismic wave
        const wave = Math.cos(tDecay * Math.PI * 10.0) * envelope;
        this.pulseIntensity = wave * mult;
      } else {
        // Settled completely calm and still until next 0.75s shock
        this.pulseActive = false;
        this.pulseIntensity = 0;
      }

      impulseMag = this.pulseIntensity * CONFIG.shake.resonanceStrength;
      impulseScaleMag = this.pulseIntensity * CONFIG.shake.resonanceScalePulse;
    } else {
      this.pulseIntensity = 0;
    }

    // 3. Compute Displacement: Zero micro-tremor when resting
    const rawX = impulseMag * this.impulseDirX;
    const rawY = impulseMag * this.impulseDirY * 0.75;
    const rawZ = impulseScaleMag;

    this.globalDisplacement.x = rawX;
    this.globalDisplacement.y = rawY;
    this.globalDisplacement.z = rawZ;
    this.globalDisplacement.scale = 1.0 + rawZ;

    // 4. Instantaneous Mountain Velocity (for chromatic aberration coupling)
    if (safeDt > 0.0001) {
      const vx = (rawX - this.prevX) / safeDt;
      const vy = (rawY - this.prevY) / safeDt;
      this.currentVelocity = Math.sqrt(vx * vx + vy * vy);

      if (this.currentVelocity > 0.01) {
        this.velocityDirX = vx / this.currentVelocity;
        this.velocityDirY = vy / this.currentVelocity;
      }
    }

    this.prevX = rawX;
    this.prevY = rawY;

    // Smooth velocity
    this.smoothVelocity += (this.currentVelocity - this.smoothVelocity) * 0.28;
  }

  getLayerTransform(layerIndex, totalLayers) {
    if (this.reducedMotion) {
      return { x: 0, y: 0, scale: 1.0 };
    }

    const norm = totalLayers > 1 ? layerIndex / (totalLayers - 1) : 1.0;
    const depthCurve = Math.pow(norm, 1.25);
    const weight = CONFIG.shake.distantLayerMotionWeight + 
                   (CONFIG.shake.foregroundLayerMotionWeight - CONFIG.shake.distantLayerMotionWeight) * depthCurve;

    return {
      x: this.globalDisplacement.x * weight,
      y: this.globalDisplacement.y * weight,
      scale: 1.0 + (this.globalDisplacement.scale - 1.0) * weight
    };
  }

  getRGBSplit() {
    if (this.reducedMotion) {
      return { offsetX: 0, offsetY: 0, amount: 0 };
    }

    const { baseOffset, maxOffset, velocityMultiplier, directionFollowsVelocity } = CONFIG.rgbSplit;
    let amount = baseOffset + this.smoothVelocity * velocityMultiplier;
    amount = Math.min(amount, maxOffset);

    let dx = directionFollowsVelocity ? this.velocityDirX : 1.0;
    let dy = directionFollowsVelocity ? this.velocityDirY : 0.0;

    return {
      offsetX: dx * amount,
      offsetY: dy * amount,
      amount: amount
    };
  }

  getAfterimageDecay(dt) {
    if (this.reducedMotion) return 0.0;
    let decay = CONFIG.afterimage.decay;
    if (Math.abs(this.pulseIntensity) > 0.08) {
      decay = Math.min(0.93, decay * CONFIG.afterimage.boostOnResonance);
    }
    return decay;
  }
}
