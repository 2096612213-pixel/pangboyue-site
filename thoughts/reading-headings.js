// Use the Markdown hierarchy, so every weekly entry shares the same behavior.
export function activeHeadingPath(headings, topFor, rowHeight = 36, topPadding = 10) {
  const path = [];
  for (const heading of headings) {
    const parents = path.filter(item => item.level < heading.level);
    const threshold = topPadding + parents.length * rowHeight;
    if (topFor(heading) > threshold) break;
    path.splice(0, path.length, ...parents, heading);
  }
  return path;
}

export function mountReadingHeadings(content, bar) {
  const headings = Array.from(content.querySelectorAll('h1, h2, h3'), (element, index) => {
    if (!element.id) {
      let id = `journal-heading-${index + 1}`;
      while (document.getElementById(id)) id += '-heading';
      element.id = id;
    }
    return { element, level: Number(element.tagName.slice(1)) };
  });
  if (!headings.length) return;
  let pending = false;
  let previous = '';
  function update() {
    pending = false;
    const styles = getComputedStyle(bar);
    const rowHeight = parseFloat(styles.getPropertyValue('--heading-row-height')) || 36;
    const topPadding = parseFloat(styles.paddingTop) || 10;
    const path = activeHeadingPath(headings, heading => heading.element.getBoundingClientRect().top, rowHeight, topPadding);
    const signature = path.map(heading => heading.element.id).join('|');
    if (signature === previous) return;
    previous = signature;
    bar.hidden = path.length === 0;
    bar.replaceChildren(...path.map((heading, depth) => {
      const link = document.createElement('a');
      link.className = `reading-heading reading-heading-${heading.level}`;
      link.href = `#${heading.element.id}`;
      link.textContent = heading.element.textContent.trim();
      link.title = link.textContent;
      link.style.setProperty('--heading-depth', depth);
      if (depth === path.length - 1) link.setAttribute('aria-current', 'location');
      link.addEventListener('click', event => {
        event.preventDefault();
        // Align this heading with its own sticky row, leaving the text beneath visible.
        const top = scrollY + heading.element.getBoundingClientRect().top - topPadding - depth * rowHeight;
        scrollTo({ top: Math.max(0, top), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      });
      return link;
    }));
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(update); }
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  addEventListener('pageshow', schedule);
  // Lazy-loaded photos change heading positions after the initial render.
  content.addEventListener('load', schedule, true);
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(content);
  document.fonts?.ready.then(schedule);
  update();
}
