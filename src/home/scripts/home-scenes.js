(() => {
  const root = document.documentElement;
  const tank = document.getElementById('fluid-tank');
  const frame = document.getElementById('mountain-home');
  const buttons = [...document.querySelectorAll('[data-home-scene]')];
  const musicButton = document.getElementById('mountain-music-toggle');
  const cloudButton = document.getElementById('storm-sound-toggle');
  let clouds;
  function ensureClouds() {
    if (clouds) return clouds;
    cloudButton.disabled = true;
    clouds = Promise.all([tank.dataset.astronomySrc, tank.dataset.soundSrc, tank.dataset.cloudSrc].map(src => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.async = false; script.src = src;
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error('Scene asset unavailable')); };
      document.head.append(script);
    }))).then(() => {
      tank.dataset.cloudReady = 'true';
      window.dispatchEvent(new Event('home-scene-change'));
    }).catch(error => { console.warn('Cloud scene:', error); }).finally(() => { cloudButton.disabled = false; });
    return clouds;
  }
  let visible = true;
  let mode = root.dataset.homeScene || 'bright';
  const api = () => frame.contentWindow?.HomeMountains;
  function sync() {
    const active = mode === 'bright' && visible && !document.hidden;
    api()?.setActive(active);
    const playing = active && api()?.isPlaying();
    musicButton.setAttribute('aria-pressed', String(Boolean(playing)));
    musicButton.setAttribute('aria-label', playing ? '暂停群山音乐' : '播放群山音乐');
    musicButton.title = playing ? '暂停群山音乐' : '播放群山音乐';
  }
  function select(next, gesture = false) {
    mode = next;
    root.dataset.homeScene = next;
    tank.setAttribute('aria-label', next === 'bright' ? '音乐与群山共振' : '缓缓向右流动的雷雨云层');
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.homeScene === next));
    try { localStorage.setItem('home-scene', next); } catch {}
    const loadCurrentScene = () => {
      if (mode === 'bright' && !frame.hasAttribute('src')) frame.src = frame.dataset.src;
      if (mode === 'dark') ensureClouds();
    };
    // Show the navigation and welcome copy before compiling the selected scene.
    if (gesture) loadCurrentScene();
    else requestAnimationFrame(() => requestAnimationFrame(loadCurrentScene));
    window.dispatchEvent(new Event('home-scene-change'));
    sync();
  }
  buttons.forEach(button => button.addEventListener('click', () => select(button.dataset.homeScene, true)));
  musicButton.addEventListener('click', () => { api()?.toggleMusic(); });
  frame.addEventListener('load', () => { sync(); });
  window.addEventListener('mountain-music-change', sync);
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(tank);
  window.addEventListener('pagehide', () => api()?.setActive(false));
  window.addEventListener('pageshow', sync);
  select(mode);
})();
