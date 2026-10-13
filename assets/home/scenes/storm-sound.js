/* One thunder burst per cloud flash, with a quiet bed of overlapping distant
 * rolls. The short burst passages preserve the 5–10 second lightning rhythm. */
(() => {
  'use strict';
  const button = document.querySelector('#storm-sound-toggle');
  if (!button) return;

  const scriptURL = document.currentScript.src;
  const tracks = [
    ['strong-incessant-thunder-in-the-distance.mp3', 'distant'],
    ['thunderstorm-breaking-at-night.mp3', 'middle'],
    ['lightning-flashed.mp3', 'close'],
    ['sound-thunder.mp3', 'middle'],
    ['lightning-rumble-and-thunder.mp3', 'middle'],
    ['the-sound-of-thunder.mp3', 'middle'],
    ['thunder-single-hit.mp3', 'close'],
    ['strong-thunder-clap.mp3', 'close'],
    ['a-booming-distant-thunder.mp3', 'distant'],
    ['thunder-rumbling-in-the-distance.mp3', 'distant']
  ];
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  let context, master, compressor, ambientBus, loaded = [], loading, enabled = false;
  let lastTrack = '', lastAmbientTrack = '', scheduled = 0, played = 0;
  let sceneActive = false, ambientTimer = 0, nextAmbientTime = 0, ambientScheduled = 0;
  const active = new Set(), ambientSources = new Set();
  const diagnostics = { get enabled() { return enabled; }, get loaded() { return loaded.length; },
    get scheduled() { return scheduled; }, get played() { return played; },
    get ambientScheduled() { return ambientScheduled; }, get ambientActive() { return ambientSources.size; },
    lastDelay: 0, lastDistance: 0, lastTrack: '' };

  function setButton(label) {
    button.setAttribute('aria-label', label);
    button.title = label;
    button.setAttribute('aria-pressed', String(enabled));
  }

  function strongestPassage(buffer, type) {
    const samples = buffer.getChannelData(0);
    const rate = buffer.sampleRate;
    const stride = Math.max(1, Math.floor(rate * .08));
    const envelope = [];
    for (let start = 0; start < samples.length; start += stride) {
      let power = 0, count = 0;
      for (let i = start; i < Math.min(start + stride, samples.length); i += 8) {
        power += samples[i] * samples[i]; count++;
      }
      envelope.push(Math.sqrt(power / Math.max(count, 1)));
    }
    let peakIndex = 0, best = -1;
    for (let i = 0; i < envelope.length; i++) {
      const previous = (envelope[Math.max(0, i - 3)] + envelope[Math.max(0, i - 2)]) * .5;
      const score = envelope[i] + Math.max(0, envelope[i] - previous) * .8;
      if (score > best) { best = score; peakIndex = i; }
    }
    const lead = type === 'distant' ? .85 : .42;
    let offset = Math.max(0, peakIndex * stride / rate - lead);
    if (buffer.duration - offset < 2.3) offset = Math.max(0, buffer.duration - 2.3);
    const duration = Math.min(5, buffer.duration - offset);
    let peak = .02;
    const startSample = Math.floor(offset * rate);
    const endSample = Math.min(samples.length, Math.floor((offset + duration) * rate));
    for (let i = startSample; i < endSample; i += 16) peak = Math.max(peak, Math.abs(samples[i]));
    return { offset, duration, normalization: clamp(.52 / peak, .45, 2.2) };
  }

  function rollingPassage(buffer) {
    const samples = buffer.getChannelData(0);
    const stride = Math.max(1, Math.floor(buffer.sampleRate * .12));
    const levels = [];
    for (let start = 0; start < samples.length; start += stride) {
      let power = 0, count = 0;
      for (let i = start; i < Math.min(start + stride, samples.length); i += 12) {
        power += samples[i] * samples[i]; count++;
      }
      levels.push(Math.sqrt(power / Math.max(count, 1)));
    }
    const duration = Math.min(6.2, buffer.duration - .15);
    const windowBins = Math.max(1, Math.floor(duration * buffer.sampleRate / stride));
    const loudest = Math.max(...levels);
    let bestStart = 0, bestScore = Infinity, bestMean = .01;
    for (let start = 0; start + windowBins <= levels.length; start += 3) {
      const window = levels.slice(start, start + windowBins);
      const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
      if (mean < loudest * .11) continue;
      const highest = Math.max(...window);
      const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / window.length;
      // Prefer an audible, steady roll over a quiet gap or a sharp thunderclap.
      const score = highest / mean + Math.sqrt(variance) / mean - .12 * mean / loudest;
      if (score < bestScore) { bestScore = score; bestStart = start; bestMean = mean; }
    }
    return { offset: Math.min(bestStart * stride / buffer.sampleRate, buffer.duration - duration),
      duration, normalization: clamp(.04 / bestMean, .2, 1.4) };
  }

  async function prepare() {
    if (loading) return loading;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw Error('当前浏览器不支持雷声播放');
    context = new AudioContextClass();
    compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -17;
    compressor.knee.value = 12;
    compressor.ratio.value = 5;
    compressor.attack.value = .006;
    compressor.release.value = .22;
    master = context.createGain();
    master.gain.value = .68;
    compressor.connect(master).connect(context.destination);
    ambientBus = context.createGain();
    ambientBus.gain.value = .8;
    ambientBus.connect(compressor);
    // Resume synchronously from the click; Safari requires a user gesture.
    const resumed = context.resume();
    loading = (async () => {
      await resumed;
      async function loadTrack([file, type]) {
        let lastError;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(new URL('thunder/' + file, scriptURL));
            if (!response.ok) throw Error(file + ': HTTP ' + response.status);
            const buffer = await context.decodeAudioData(await response.arrayBuffer());
            return { file, type, buffer, ...strongestPassage(buffer, type),
              rolling: type === 'distant' ? rollingPassage(buffer) : null };
          } catch (error) { lastError = error; }
        }
        throw lastError;
      }
      const results = [];
      for (let index = 0; index < tracks.length; index += 3) {
        results.push(...await Promise.allSettled(tracks.slice(index, index + 3).map(loadTrack)));
      }
      loaded = results.filter(result => result.status === 'fulfilled').map(result => result.value);
      if (!loaded.length) throw Error('雷声音频加载失败');
      button.dataset.loadedTracks = String(loaded.length);
      const failures = results.flatMap((result, index) => result.status === 'rejected' ?
        [tracks[index][0] + ': ' + String(result.reason)] : []);
      if (failures.length) console.warn('Some thunder recordings failed to load:', failures.join('; '));
      return loaded;
    })();
    return loading;
  }

  function stopAll() {
    if (ambientTimer) clearInterval(ambientTimer);
    ambientTimer = 0;
    nextAmbientTime = 0;
    for (const source of active) {
      try { source.stop(); } catch (_) { /* The source may have just ended. */ }
    }
    active.clear();
    for (const source of ambientSources) {
      try { source.stop(); } catch (_) { /* The source may have just ended. */ }
    }
    ambientSources.clear();
  }

  function queueAmbience() {
    if (!enabled || !sceneActive || !context || context.state !== 'running') return;
    const pool = loaded.filter(track => track.rolling);
    if (!pool.length) return;
    while (nextAmbientTime < context.currentTime + 8) {
      let choices = pool.filter(track => track.file !== lastAmbientTrack);
      if (!choices.length) choices = pool;
      const track = choices[Math.floor(Math.random() * choices.length)];
      lastAmbientTrack = track.file;
      const source = context.createBufferSource();
      source.buffer = track.buffer;
      source.playbackRate.value = .86 + Math.random() * .14;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 230 + Math.random() * 130;
      const volume = context.createGain();
      const when = nextAmbientTime;
      const playDuration = track.rolling.duration / source.playbackRate.value;
      const fade = Math.min(1.8, playDuration * .27);
      const level = track.rolling.normalization * (.75 + Math.random() * .35);
      volume.gain.setValueAtTime(.0001, when);
      volume.gain.linearRampToValueAtTime(level, when + fade);
      volume.gain.setValueAtTime(level, when + playDuration - fade);
      volume.gain.linearRampToValueAtTime(.0001, when + playDuration);
      source.connect(filter).connect(volume).connect(ambientBus);
      source.onended = () => ambientSources.delete(source);
      ambientSources.add(source);
      source.start(when, track.rolling.offset, track.rolling.duration);
      source.stop(when + playDuration + .02);
      nextAmbientTime += playDuration - fade;
      ambientScheduled++;
      button.dataset.ambientRolls = String(ambientScheduled);
    }
  }

  function startAmbience() {
    if (!enabled || !sceneActive || !context || context.state !== 'running' || ambientTimer) return;
    nextAmbientTime = context.currentTime + .08;
    queueAmbience();
    ambientTimer = setInterval(queueAmbience, 900);
  }

  function setSceneActive(activeNow) {
    sceneActive = activeNow;
    if (!sceneActive) { stopAll(); return; }
    if (enabled && context && context.state !== 'running') {
      context.resume().then(() => { if (sceneActive) startAmbience(); }).catch(() => {});
    } else startAmbience();
  }

  function pickTrack(impact) {
    const preferred = impact > .52 ? 'close' : impact < .34 ? 'distant' : 'middle';
    let pool = loaded.filter(track => track.type === preferred && track.file !== lastTrack);
    if (!pool.length) pool = loaded.filter(track => track.file !== lastTrack);
    if (!pool.length) pool = loaded;
    const track = pool[Math.floor(Math.random() * pool.length)];
    lastTrack = track.file;
    return track;
  }

  function schedule(glow, animationTime) {
    if (!enabled || !context || context.state !== 'running' || !loaded.length || document.hidden) return;
    // Depth supplies the main distance; screen position adds a small oblique path.
    // The visible cloud field is capped at 1.5 km: 1500 / 340 = 4.41 seconds.
    const depthMeters = 180 + glow.depth * 1320;
    const sidewaysMeters = (glow.x - .5) * 360;
    const verticalMeters = (glow.y - .65) * 210;
    const distance = Math.min(1500, Math.hypot(depthMeters, sidewaysMeters, verticalMeters));
    const delay = distance / 340;
    const visualOffset = Math.max(0, glow.start - animationTime);
    const area = Math.sqrt(glow.radiusX * glow.radiusY);
    const areaStrength = clamp((area - .045) / .22, 0, 1);
    const impact = clamp((.15 + .65 * areaStrength) * (.68 + .32 * Math.sqrt(glow.brightness)) *
      (1 - .24 * distance / 1500), .10, .82);
    const track = pickTrack(impact);
    const source = context.createBufferSource();
    source.buffer = track.buffer;
    source.playbackRate.value = .91 + Math.random() * .18;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 900 + (1 - distance / 1500) * 3600;
    const position = context.createStereoPanner ? context.createStereoPanner() : context.createGain();
    if (position.pan) position.pan.value = clamp((glow.x - .5) * .85, -.42, .42);
    const volume = context.createGain();
    const when = context.currentTime + visualOffset + delay;
    const segmentDuration = Math.min(track.duration, 5 * source.playbackRate.value);
    const playDuration = segmentDuration / source.playbackRate.value;
    const level = impact * track.normalization;
    volume.gain.setValueAtTime(.0001, when);
    volume.gain.linearRampToValueAtTime(level, when + .055);
    volume.gain.setValueAtTime(level, when + Math.max(.08, playDuration - .85));
    volume.gain.linearRampToValueAtTime(.0001, when + playDuration);
    source.connect(lowpass).connect(position).connect(volume).connect(compressor);
    source.onended = () => { active.delete(source); played++; };
    active.add(source);
    source.start(when, track.offset, segmentDuration);
    source.stop(when + playDuration + .02);
    scheduled++;
    button.dataset.scheduledThunders = String(scheduled);
    button.dataset.lastThunderDelay = delay.toFixed(2);
    diagnostics.lastDelay = delay;
    diagnostics.lastDistance = distance;
    diagnostics.lastTrack = track.file;
  }

  button.addEventListener('click', async () => {
    if (enabled) {
      enabled = false; stopAll();
      if (context) await context.suspend();
      setButton('开启雷声');
      return;
    }
    button.disabled = true;
    setButton('雷声载入中…');
    try {
      await prepare();
      await context.resume();
      enabled = true;
      startAmbience();
      setButton('关闭雷声');
    } catch (error) {
      console.warn('Storm sound:', error);
      setButton('雷声加载失败 · 重试');
      loading = null;
    } finally { button.disabled = false; }
  });
  window.StormSound = { schedule, setSceneActive, diagnostics };
})();
