(() => {
  const root = document.documentElement;
  const tank = document.getElementById('fluid-tank');
  const frame = document.getElementById('mountain-home');
  const buttons = [...document.querySelectorAll('[data-home-scene]')];
  const musicButton = document.getElementById('mountain-music-toggle');
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
    const changed = next !== mode;
    mode = next;
    root.dataset.homeScene = next;
    tank.setAttribute('aria-label', next === 'bright' ? '音乐与群山共振' : '缓缓向右流动的雷雨云层');
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.homeScene === next));
    try { localStorage.setItem('home-scene', next); } catch {}
    if (next === 'bright' && !frame.hasAttribute('src')) frame.src = frame.dataset.src;
    window.dispatchEvent(new Event('home-scene-change'));
    sync();
    // Same-origin call stays within the click gesture. First visit remains silent.
    if (gesture && changed && next === 'bright' && api() && !api().isPlaying()) api().toggleMusic();
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
