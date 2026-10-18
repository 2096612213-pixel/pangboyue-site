(() => {
  const root = document.documentElement;
  const tank = document.getElementById('fluid-tank');
  const frame = document.getElementById('mountain-home');
  const blossomFrame = document.getElementById('blossom-home');
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
  // 音频仅在用户点击后创建并赋予地址，不随首页或场景加载预取。
  let flowerAudio, flowerStarting = false, flowerWantsPlay = false, flowerRequest = 0;
  function stopFlowerMusic() {
    flowerRequest++; flowerStarting = false; flowerWantsPlay = false;
    flowerAudio?.pause();
  }
  async function toggleFlowerMusic() {
    if (flowerStarting || (flowerAudio && !flowerAudio.paused)) {
      stopFlowerMusic(); sync(); return;
    }
    if (!flowerAudio) {
      flowerAudio = new Audio();
      flowerAudio.preload = 'none'; flowerAudio.loop = true;
      flowerAudio.src = '/favorsongs/river-flows-in-you-martin-ermen.mp3';
      for (const event of ['play', 'pause', 'error']) flowerAudio.addEventListener(event, sync);
    }
    const request = ++flowerRequest; flowerStarting = true; flowerWantsPlay = true;
    try {
      await flowerAudio.play();
      if (request !== flowerRequest && !flowerWantsPlay) flowerAudio.pause();
    } catch (error) { if (error.name !== 'AbortError') console.warn('水中花音乐播放失败：', error); }
    finally { if (request === flowerRequest) flowerStarting = false; sync(); }
  }
  let visible = true;
  let mode = root.dataset.homeScene || 'bright';
  const api = () => frame.contentWindow?.HomeMountains;
  const blossomApi = () => {
    try { return blossomFrame.contentWindow?.HomeBlossom; }
    catch { return null; } // Network/error documents may not share our origin.
  };
  function sync() {
    const active = mode === 'bright' && visible && !document.hidden;
    api()?.setActive(active);
    blossomApi()?.setActive(mode === 'flower' && visible && !document.hidden);
    const flowerActive = mode === 'flower' && visible && !document.hidden;
    if (!flowerActive && (flowerStarting || (flowerAudio && !flowerAudio.paused))) stopFlowerMusic();
    const playing = mode === 'flower' ? flowerActive && flowerAudio && !flowerAudio.paused : active && api()?.isPlaying();
    const musicName = mode === 'flower' ? '水中花音乐' : '群山音乐';
    musicButton.setAttribute('aria-pressed', String(Boolean(playing)));
    musicButton.setAttribute('aria-label', `${playing ? '暂停' : '播放'}${musicName}`);
    musicButton.title = `${playing ? '暂停' : '播放'}${musicName}`;
  }
  function select(next, gesture = false) {
    mode = next;
    root.dataset.homeScene = next;
    tank.setAttribute('aria-label', next === 'flower' ? '水中花' : next === 'bright' ? '音乐与群山共振' : '缓缓向右流动的雷雨云层');
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.homeScene === next));
    try { localStorage.setItem('home-scene', next); } catch {}
    const loadCurrentScene = () => {
      if (mode === 'bright' && !frame.hasAttribute('src')) frame.src = frame.dataset.src;
      if (mode === 'dark') ensureClouds();
      if (mode === 'flower' && !blossomFrame.hasAttribute('src')) blossomFrame.src = blossomFrame.dataset.src;
    };
    // Show the navigation and welcome copy before compiling the selected scene.
    if (gesture) loadCurrentScene();
    else requestAnimationFrame(() => requestAnimationFrame(loadCurrentScene));
    window.dispatchEvent(new Event('home-scene-change'));
    sync();
  }
  buttons.forEach(button => button.addEventListener('click', () => select(button.dataset.homeScene, true)));
  musicButton.addEventListener('click', () => { if (mode === 'flower') toggleFlowerMusic(); else api()?.toggleMusic(); });
  frame.addEventListener('load', sync);
  function syncBlossomReady() {
    let ready = false;
    try { ready = blossomApi()?.ready === true; }
    catch { /* A failed/redirected frame keeps the locally hosted preview. */ }
    blossomFrame.parentElement.dataset.ready=String(ready);
    root.dataset.blossomReady=String(ready);
    sync();
  }
  // The document load event alone does not mean the textures and first frame are ready.
  blossomFrame.addEventListener('load', syncBlossomReady);
  window.addEventListener('message',event=>{
    if(event.source===blossomFrame.contentWindow&&event.origin===location.origin&&
       ['home-blossom-ready','home-blossom-error'].includes(event.data?.type))syncBlossomReady();
  });
  window.addEventListener('mountain-music-change', sync);
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(tank);
  window.addEventListener('pagehide', () => { stopFlowerMusic(); api()?.setActive(false); blossomApi()?.setActive(false); });
  window.addEventListener('pageshow', sync);
  select(mode);
})();
