/** 播放时钟驱动鼓点：音频暂停、跳转、循环后都从实际进度重新对齐。 */
import { MUSIC_TRACK } from './track.js';

export class MusicBeatSync {
  constructor(audio, onBeat, onReset, onState) {
    this.audio = audio;
    this.onBeat = onBeat;
    this.onReset = onReset;
    this.onState = onState;
    // 中等及更强的鼓点都会触发；很轻的敲击不产生动画事件。
    this.beats = MUSIC_TRACK.resonanceBeats;
    this.index = 0;
    this.previousTime = 0;
    this.waiting = false;
    this.hasPlayed = false;
    this.starting = false;
    audio.loop = true;
    audio.volume = 0.75;
    audio.addEventListener('playing', () => {
      this.waiting = false;
      this.hasPlayed = true;
      this.align(audio.currentTime);
      this.onState('playing');
    });
    audio.addEventListener('pause', () => {
      this.align(audio.currentTime);
      this.onState(this.hasPlayed ? 'paused' : 'idle');
    });
    audio.addEventListener('waiting', () => {
      this.waiting = true;
      this.onReset();
      this.onState('loading');
    });
    audio.addEventListener('seeking', () => this.align(audio.currentTime));
    audio.addEventListener('seeked', () => this.align(audio.currentTime));
    audio.addEventListener('error', () => {
      this.onReset();
      this.onState('error');
    });
  }

  lowerBound(time) {
    let lo = 0, hi = this.beats.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.beats[mid][0] < time) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  align(time) {
    this.index = this.lowerBound(time);
    this.previousTime = time;
    this.onReset();
  }

  pause() {
    this.playRequest = (this.playRequest || 0) + 1;
    this.wantsPlay = false;
    this.starting = false;
    this.audio.pause();
    this.align(this.audio.currentTime);
    this.onState('paused');
  }

  async toggle() {
    // A stop must work even while play() is waiting for network data.
    if (this.starting || !this.audio.paused) {
      this.pause();
      return;
    }
    const request = this.playRequest = (this.playRequest || 0) + 1;
    this.wantsPlay = true;
    this.starting = true;
    this.onState('loading');
    try {
      await this.audio.play();
      if (request !== this.playRequest && !this.wantsPlay) this.audio.pause();
    } catch (error) {
      if (request === this.playRequest) {
        this.wantsPlay = false;
        this.onState(error.name === 'NotAllowedError' ? 'idle' : 'error');
      }
    } finally {
      if (request === this.playRequest) this.starting = false;
    }
  }

  update() {
    const audio = this.audio;
    if (audio.paused || audio.ended || audio.seeking || this.waiting || audio.readyState < 2) return;
    const time = audio.currentTime;
    // 返回后台、循环回到开头或跳转时，跳过错过的鼓点，不补发一串震动。
    if (time < this.previousTime - 0.05 || time - this.previousTime > 0.30) {
      this.align(Math.max(0, time - 0.035));
    }
    while (this.index < this.beats.length && this.beats[this.index][0] <= time) {
      const [beatTime, strength] = this.beats[this.index++];
      const elapsed = time - beatTime;
      if (elapsed < 0.25) {
        // 短暂掉帧仍触发刚过去的鼓点；将动画开头保留到可见的一帧。
        // 音乐时间不变，两处震动和波纹统一使用同一个视觉起点。
        const pulseTime = time - Math.min(elapsed, 0.012);
        this.onBeat({ time: beatTime, strength, elapsed, pulseTime });
      }
    }
    this.previousTime = time;
  }
}
