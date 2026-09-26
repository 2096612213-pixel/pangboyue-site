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

