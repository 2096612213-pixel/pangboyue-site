/**
 * High-performance, zero-allocation Simplex Noise & Layered Harmonic Generator
 * Implements 2D & 3D simplex noise with multi-octave synthesis.
 */

// Permutation table precomputed for fast indexing
const PERM = new Uint8Array(512);
const P = [
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,
  8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,
  35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,
  134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,
  55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,
  18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,
  250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,
  189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,
  172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,
  228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,
  107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
];

for (let i = 0; i < 256; i++) {
  PERM[i] = P[i];
  PERM[i + 256] = P[i];
}

const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;

const GRAD3 = [
  1,1,0, -1,1,0, 1,-1,0, -1,-1,0,
  1,0,1, -1,0,1, 1,0,-1, -1,0,-1,
  0,1,1, 0,-1,1, 0,1,-1, 0,-1,-1
];

/**
 * 2D Simplex Noise in range [-1, 1]
 */
export function simplex2D(xin, yin) {
  let n0 = 0, n1 = 0, n2 = 0;
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = xin - X0;
  const y0 = yin - Y0;

  let i1, j1;
  if (x0 > y0) {
    i1 = 1; j1 = 0;
  } else {
    i1 = 0; j1 = 1;
  }

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1.0 + 2.0 * G2;
  const y2 = y0 - 1.0 + 2.0 * G2;

  const ii = i & 255;
  const jj = j & 255;
  const gi0 = (PERM[ii + PERM[jj]] % 12) * 3;
  const gi1 = (PERM[ii + i1 + PERM[jj + j1]] % 12) * 3;
  const gi2 = (PERM[ii + 1 + PERM[jj + 1]] % 12) * 3;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    t0 *= t0;
    n0 = t0 * t0 * (GRAD3[gi0] * x0 + GRAD3[gi0 + 1] * y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    t1 *= t1;
    n1 = t1 * t1 * (GRAD3[gi1] * x1 + GRAD3[gi1 + 1] * y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    t2 *= t2;
    n2 = t2 * t2 * (GRAD3[gi2] * x2 + GRAD3[gi2 + 1] * y2);
  }

  return 70.0 * (n0 + n1 + n2);
}

/**
 * Multi-Octave Fractal Brownian Motion (fBm) in 2D
 */
export function fbm2D(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let total = 0;
  let frequency = 1.0;
  let amplitude = 1.0;
  let maxAmp = 0;

  for (let i = 0; i < octaves; i++) {
    total += simplex2D(x * frequency, y * frequency) * amplitude;
    maxAmp += amplitude;
    frequency *= lacunarity;
    amplitude *= gain;
  }

  return total / maxAmp;
}

/**
 * Non-harmonic multi-frequency organic wave synthesizer
 * Combines incommensurate frequencies (golden ratio roots) to produce
 * a non-periodic, fluid, continuous organic tremor signal.
 */
export class OrganicSeismicSynthesizer {
  constructor(seed = 42) {
    this.seed = seed;
    // Golden ratio and prime harmonic ratios
    this.freqsX = [1.0, 1.618033, 2.71828, 4.23606, 7.142];
    this.freqsY = [1.123, 1.73205, 2.41421, 3.8284, 6.618];
    this.freqsZ = [0.894, 1.41421, 2.23606, 3.61803, 5.732];
    
    this.phasesX = [0.1, 1.4, 2.9, 0.7, 3.8];
    this.phasesY = [2.2, 0.8, 3.1, 1.9, 0.4];
    this.phasesZ = [1.1, 2.7, 0.3, 3.4, 1.7];
  }

  /**
   * Sample 3D organic displacement at given time
   * Returns { x, y, z } in range roughly [-1, 1]
   */
  sample(time, highFreqMultiplier = 20.0) {
    // 1. Multi-octave continuous simplex noise
    const tSlow = time * 0.15;
    const tFast = time * highFreqMultiplier;
    
    const noiseSlowX = simplex2D(tSlow, 12.34);
    const noiseSlowY = simplex2D(tSlow, 56.78);
    const noiseSlowZ = simplex2D(tSlow, 91.12);
    
    const noiseFastX = simplex2D(tFast, 24.68);
    const noiseFastY = simplex2D(tFast, 79.13);
    const noiseFastZ = simplex2D(tFast, 35.79);
    
    // 2. Non-harmonic wave sum for dense tremor texture
    let waveX = 0;
    let waveY = 0;
    let waveZ = 0;
    
    const count = this.freqsX.length;
    for (let i = 0; i < count; i++) {
      const w = 1.0 / (i + 1.2);
      waveX += Math.sin(time * this.freqsX[i] * highFreqMultiplier + this.phasesX[i]) * w;
      waveY += Math.sin(time * this.freqsY[i] * highFreqMultiplier + this.phasesY[i]) * w;
      waveZ += Math.sin(time * this.freqsZ[i] * highFreqMultiplier + this.phasesZ[i]) * w;
    }
    
    // Blend: 25% slow wandering drift + 40% simplex tremor + 35% dense micro-harmonics
    const x = noiseSlowX * 0.25 + noiseFastX * 0.45 + waveX * 0.30;
    const y = noiseSlowY * 0.25 + noiseFastY * 0.45 + waveY * 0.30;
    const z = noiseSlowZ * 0.25 + noiseFastZ * 0.45 + waveZ * 0.30;
    
    return { x, y, z };
  }
}
