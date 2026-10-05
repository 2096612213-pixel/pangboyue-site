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
