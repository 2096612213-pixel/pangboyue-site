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

  // Native lazy loading works before JS/IntersectionObserver and chooses a small
  // responsive image. If a selected source fails, retry the compatible img URL.
  document.querySelectorAll('picture img').forEach(image => {
    image.addEventListener('error', () => {
      if (image.dataset.fallbackTried) return;
      image.dataset.fallbackTried = 'true';
      image.closest('picture').querySelectorAll('source').forEach(source => source.remove());
      image.removeAttribute('srcset');
      image.loading = 'eager';
      const fallback = new URL(image.getAttribute('src'), location.href);
      fallback.searchParams.set('retry', '1');
      image.src = fallback.href;
    });
    // A cached decode error can arrive before the deferred script attaches.
    if (image.complete && image.naturalWidth === 0) image.dispatchEvent(new Event('error'));
  });
