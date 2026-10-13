  // Keep the page at its true top edge in Safari while allowing normal scrolling.
  function preventTopOverscroll(event, pullingDown) {
    if (!pullingDown || window.scrollY > 0 || !event.cancelable) return;
    const menu = event.target instanceof Element ? event.target.closest('.dropdown-menu') : null;
    if (menu && menu.scrollTop > 0) return;
    event.preventDefault();
  }

  window.addEventListener('wheel', event => {
    if (!event.ctrlKey) preventTopOverscroll(event, event.deltaY < 0);
  }, { passive: false });

  // Touch scrolling stays native. CSS overscroll-behavior handles the edge;
  // cancelling window touchmove can trap Safari gestures over an embedded scene.
  function alignDropdowns() {
    const header = document.querySelector('.top-nav');
    const headerLeft = header.getBoundingClientRect().left;
    header.querySelectorAll('.nav-dropdown').forEach(dropdown => {
      const trigger = dropdown.querySelector('.nav-link');
      const menu = dropdown.querySelector('.dropdown-menu');
      const contentWidth = menu.querySelector('.dropdown-inner').offsetWidth;
      const triggerLeft = trigger.getBoundingClientRect().left - headerLeft;
      const left = Math.max(16, Math.min(triggerLeft, header.clientWidth - contentWidth - 16));
      menu.style.setProperty('--menu-x', `${left}px`);
    });
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Only the first archive entrance receives the reveal behavior.
  const first = document.querySelector('a.archive-card');
  if (first && !reduced.matches && 'IntersectionObserver' in window) {
    const reveal = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        first.classList.add('is-visible'); reveal.disconnect();
      }
    }, { threshold: .08 });
    first.classList.add('archive-reveal'); reveal.observe(first);
    first.addEventListener('focus', () => first.classList.add('is-visible'));
  }

  // Reveal pictures only as they approach the viewport. Keep their size reserved.
  const deferredImages = document.querySelectorAll('picture img[data-src]');
  function revealPicture(picture) {
    const source = picture.querySelector('source[data-srcset]');
    const image = picture.querySelector('img[data-src]');
    if (source) { source.srcset = source.dataset.srcset; delete source.dataset.srcset; }
    if (image.dataset.srcset) { image.srcset = image.dataset.srcset; delete image.dataset.srcset; }
    image.src = image.dataset.src;
    delete image.dataset.src;
  }
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        revealPicture(entry.target.closest('picture'));
        imageObserver.unobserve(entry.target);
      }
    }, { rootMargin: '50px 0px' });
    deferredImages.forEach(image => imageObserver.observe(image));
  } else {
    deferredImages.forEach(image => revealPicture(image.closest('picture')));
  }

  // Warm up only the HTML of a destination the visitor is about to choose.
  const prefetchedPages = new Set();
  function prefetchDestination(link) {
    if (navigator.connection?.saveData) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search) || prefetchedPages.has(url.href)) return;
    prefetchedPages.add(url.href);
    const hint = document.createElement('link');
    hint.rel = 'prefetch';
    hint.href = url.href;
    document.head.append(hint);
  }
  document.querySelectorAll('a[href]').forEach(link => {
    link.addEventListener('pointerenter', () => prefetchDestination(link), { once: true });
    link.addEventListener('focus', () => prefetchDestination(link), { once: true });
  });

  alignDropdowns();
  window.addEventListener('resize', alignDropdowns);

  function updateBeijingTime() {

    const now = new Date();

    const formatter = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",

      year: "numeric",
      month: "long",
      day: "numeric",

      weekday: "long",

      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",

      hour12: false
    });

    const timeText = formatter.format(now);

    const clock = document.getElementById("beijing-time");
    clock.textContent = "北京时间 · " + timeText;
    // Reserve the clock's width once so changing seconds never shifts the icon.
    if (!clock.style.width) clock.style.width = Math.ceil(clock.getBoundingClientRect().width) + "px";
  }

  updateBeijingTime();
  window.addEventListener('resize', () => {
    const clock = document.getElementById('beijing-time');
    clock.style.width = '';
    clock.style.width = Math.ceil(clock.getBoundingClientRect().width) + 'px';
  });

  setInterval(updateBeijingTime, 1000);
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
    const changed = next !== mode;
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
  // Start the point-field only when the visitor approaches the chat section.
  (() => {
    const section = document.getElementById('digital-agent');
    const canvas = document.getElementById('agent-backdrop');
    if (!section || !canvas) return;
    let requested = false;
    function loadBackdrop() {
      if (requested) return;
      requested = true;
      const script = document.createElement('script');
      script.src = canvas.dataset.script;
      script.onerror = () => { requested = false; script.remove(); canvas.hidden = true; };
      document.head.append(script);
    }
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect(); loadBackdrop();
      }, { rootMargin: '160px 0px' });
      observer.observe(section);
    } else loadBackdrop();
  })();
