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

