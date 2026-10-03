export function mountImageToggle(content, button, headingBar) {
  const images = Array.from(content.querySelectorAll('img'));
  if (!images.length) return;
  // Remove empty image paragraphs too, so collapsed photo galleries leave no gaps.
  for (const block of content.querySelectorAll('p, figure, a, picture')) {
    if (block.querySelector('img') && !block.textContent.trim() &&
        !block.querySelector('video, audio, iframe, button, input')) {
      block.classList.add('journal-image-only');
    }
  }
  let collapsed = false;
  const label = button.querySelector('.image-toggle-label');
  button.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  button.title = `折叠本篇周记的全部 ${images.length} 张图片，保留文字与视频`;
  button.addEventListener('click', () => {
    const readingTop = headingBar && !headingBar.hidden
      ? headingBar.getBoundingClientRect().bottom + 16 : 16;
    const blocks = Array.from(content.children);
    let anchor = blocks.find(block => block.getBoundingClientRect().height > 0 &&
      block.getBoundingClientRect().bottom > readingTop);
    let offset = anchor?.getBoundingClientRect().top;
    if (!collapsed && anchor?.classList.contains('journal-image-only')) {
      const index = blocks.indexOf(anchor);
      anchor = blocks.slice(index + 1).find(block => !block.classList.contains('journal-image-only'));
      // When inside a long photo, continue at the text following its photo group.
      offset = readingTop;
    }
    // At the beginning of the page there is no need to move the viewport.
    const preservePosition = scrollY > 0;
    collapsed = !collapsed;
    content.classList.toggle('journal-images-collapsed', collapsed);
    label.textContent = collapsed ? '展开全部图片' : '折叠全部图片';
    button.setAttribute('aria-expanded', String(!collapsed));
    button.title = `${collapsed ? '展开' : '折叠'}本篇周记的全部 ${images.length} 张图片，保留文字与视频`;
    if (preservePosition && anchor) {
      scrollBy({ top: anchor.getBoundingClientRect().top - offset, behavior: 'instant' });
    }
    // Refresh the sticky headings even when the browser itself clamps scrollY.
    dispatchEvent(new Event('scroll'));
  });
}
