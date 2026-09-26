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

  let touchStartY = 0;
  window.addEventListener('touchstart', event => {
    if (event.touches.length === 1) touchStartY = event.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchmove', event => {
    if (event.touches.length === 1) {
      preventTopOverscroll(event, event.touches[0].clientY > touchStartY);
    }
  }, { passive: false });

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

  // Reveal pictures only as they approach the viewport. Keep their size reserved.
  const deferredImages = document.querySelectorAll('picture img[data-src]');
  function revealPicture(picture) {
    const source = picture.querySelector('source[data-srcset]');
    const image = picture.querySelector('img[data-src]');
    if (source) { source.srcset = source.dataset.srcset; delete source.dataset.srcset; }
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
