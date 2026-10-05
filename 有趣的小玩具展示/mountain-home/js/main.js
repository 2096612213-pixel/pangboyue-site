/**
 * MountainScene - Master Orchestration & Lifecycle Controller
 * Assembles:
 * - MountainLayers (9 Origami Faceted Depth Layers)
 * - CelestialSun (Stable Vermilion Celestial Body)
 * - SkyAtmosphere (Deep Midnight Atmospheric Shader)
 * - SnowSystem (3-Tier Decoupled Falling Snow)
 * - ShakeController (Multi-Frequency Seismic Tremor & Resonance Pulses)
 * - PostProcessPipeline (Ghost Trail Feedback + Velocity Chromatic Aberration)
 */
import { MusicBeatSync } from './music.js';
import { CONFIG } from './config.js';
import { ShakeController } from './shake.js';
import { SkyAtmosphere } from './sky.js';
import { CelestialSun } from './sun.js';
import { MountainLayers } from './mountains.js';
import { SnowSystem } from './snow.js';
import { PostProcessPipeline } from './postprocess.js';

export class MountainScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.time = 0;
    this.lastTime = performance.now();
    this.isPaused = false;
    this.externallyActive = !document.documentElement.classList.contains("embedded");

    this._initRenderer();
    this._initCamera();
    this._initScenes();
    this._initPipeline();
    this._initMusic();
    this._initEvents();

    // Initial layout
    this.handleResize();

    // Start RAF
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true
    });

    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.system.maxDPR);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height);
  }

  _initCamera() {
    const halfW = this.width * 0.5;
    const halfH = this.height * 0.5;
    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 1000);
    this.camera.position.z = 100;
  }

  _initScenes() {
    // 1. Stable Background (Sky + Celestial Sun)
    this.backgroundScene = new THREE.Scene();
    this.sky = new SkyAtmosphere(this.backgroundScene);
    this.sun = new CelestialSun(this.backgroundScene);

    // 2. Vibrating Mountain Range
    this.mountainScene = new THREE.Scene();
    this.mountains = new MountainLayers(this.mountainScene);

    // 3. Independent Falling Snow
    this.snowScene = new THREE.Scene();
    this.snow = new SnowSystem(this.snowScene);

    // 4. Seismic Tremor Controller
    this.shakeController = new ShakeController();
  }

  _initPipeline() {
    this.pipeline = new PostProcessPipeline(this.renderer, this.width, this.height);
  }

  _initMusic() {
    this.audio = document.getElementById('bg-music');
    this.musicButton = document.getElementById('music-toggle');
    this.musicHint = document.getElementById('music-hint');
    this.shakeController.musicDriven = true;
    this.sun.musicDriven = true;
    this.music = new MusicBeatSync(this.audio, beat => {
      this.shakeController.triggerPulse(beat.strength, this.audio.currentTime - beat.pulseTime, beat.pulseTime);
      this.sun.emitBeat(beat.pulseTime, this.shakeController.reducedMotion ? 0 : beat.strength);
      this._showFlashIndicator();
    }, () => {
      this.shakeController.resetPulse();
      this.sun.resetMusicPulse();
    }, state => {
      if (window.parent !== window) window.parent.dispatchEvent(new Event('mountain-music-change'));
      const playing = state === 'playing';
      this.musicButton.textContent = playing ? 'Ⅱ 暂停音乐' : state === 'loading' ? '音乐加载中…' : state === 'paused' ? '▶ 继续播放' : '♫ 开启音乐';
      this.musicButton.setAttribute('aria-pressed', String(playing));
      this.musicButton.setAttribute('aria-label', playing ? '暂停背景音乐' : '播放背景音乐');
      this.musicHint.textContent = state === 'error' ? '音乐加载失败，点击重试' : playing ? '老人与海 · 伴奏 / 循环播放' : state === 'paused' ? '音乐已暂停' : '点击画面或按空格开启音乐';
    });
    this.musicButton.addEventListener('click', () => this.music.toggle());
  }

  _initEvents() {
    // Window Resize
    window.addEventListener('resize', () => this.handleResize(), { passive: true });

    // Page Visibility (Prevents physics jumps on tab return)
    if (CONFIG.system.pauseWhenHidden) {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.isPaused = true;
          this.music.pause();
        } else {
          this.isPaused = false;
          this.lastTime = performance.now();
        }
      });
    }

    window.addEventListener('keydown', e => {
      if (!this.externallyActive) return;
      if (e.code === 'Space' && !e.repeat && !/^(BUTTON|INPUT|TEXTAREA)$/.test(e.target.tagName)) {
        e.preventDefault();
        this.music.toggle();
      }
    });
    this.canvas.addEventListener('pointerdown', () => this.music.toggle());
  }

  _showFlashIndicator() {
    const hint = document.getElementById('resonance-hint');
    if (hint) {
      hint.classList.add('pulse');
      clearTimeout(this._hintTimeout);
      this._hintTimeout = setTimeout(() => {
        hint.classList.remove('pulse');
      }, 140);
    }
  }

  handleResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.system.maxDPR);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height);

    // Update Camera Frustum
    const halfW = this.width * 0.5;
    const halfH = this.height * 0.5;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();

    // Rebuild & Resize Components
    this.sky.resize(this.width, this.height);
    this.sun.resize(this.width, this.height);
    this.mountains.rebuild(this.width, this.height);
    this.snow.rebuild(this.width, this.height);
    this.pipeline.resize(this.width, this.height);
  }

  animate(now) {
    requestAnimationFrame(this.animate);

    if (this.isPaused || !this.externallyActive) { this.lastTime = now; return; }

    // Delta time calculation
    const rawDt = (now - this.lastTime) * 0.001;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05); // Clamp dt to prevent frame lag explosion
    this.time += dt;

    // 同一帧、同一个音频播放时钟触发山体和太阳，避免两套计时器漂移。
    this.music.update();
    this.shakeController.update(dt, this.audio.currentTime);

    // 2. Update Mountains (Endless parallax scrolling + organic 3D tremor)
    this.mountains.update(dt, this.shakeController);

    // 3. Update Celestial Sun (Expanding ripple halos + emission recoil)
    this.sun.update(this.time, dt, this.shakeController.pulseIntensity, this.audio.currentTime);

    // 4. Update Falling Snow (Decoupled independent descent & wind sway)
    this.snow.update(dt, this.time);

    // 5. Execute Multi-Pass Rendering Pipeline (Afterimage + Chromatic Aberration + Composition)
    this.pipeline.renderPipeline({
      backgroundScene: this.backgroundScene,
      mountainScene: this.mountainScene,
      snowScene: this.snowScene,
      camera: this.camera,
      shakeController: this.shakeController,
      dt: dt
    });
  }
}

// Auto-boot when DOM is ready
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('scene-canvas');
    if (canvas) {
      window.app = new MountainScene(canvas);
      window.HomeMountains = {
        setActive(active) {
          window.app.externallyActive = active;
          window.app.lastTime = performance.now();
          if (!active && (!window.app.audio.paused || window.app.music.starting)) window.app.music.pause();
        },
        toggleMusic() { if (window.app.externallyActive || !window.app.audio.paused || window.app.music.starting) return window.app.music.toggle(); },
        isPlaying() { return !window.app.audio.paused; }
      };
    }
  });
}
