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
