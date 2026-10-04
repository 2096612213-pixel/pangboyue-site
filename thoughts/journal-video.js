// Parse in an inert template: no media URLs reach live players before a click.
export function renderJournalContent(content, html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const image of template.content.querySelectorAll('img')) {
    image.loading = 'lazy';
    image.decoding = 'async';
  }
  let active = null;

  function release(state) {
    const video = state.video;
    if (!video) return;
    state.position = !video.ended && Number.isFinite(video.currentTime) ? video.currentTime : 0;
    state.video = null;
    video.pause();
    video.removeAttribute('src');
    video.load(); // Abort the previous download, rather than only pausing playback.
    video.remove();
    state.button.hidden = false;
    state.label.textContent = state.position > 0 ? '▶ 继续播放' : '▶ 点击播放';
    if (active === state) active = null;
  }

  for (const original of template.content.querySelectorAll('video')) {
    const box = document.createElement('div');
    box.className = 'journal-video';
    const width = Number(original.getAttribute('width'));
    const height = Number(original.getAttribute('height'));
    box.style.setProperty('--video-ratio', width > 0 && height > 0 ? `${width} / ${height}` : '16 / 9');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'journal-video-play';
    button.setAttribute('aria-label', `播放视频：${original.getAttribute('aria-label') || '周记视频'}`);
    const poster = original.getAttribute('poster');
    if (poster) {
      const cover = document.createElement('img');
      cover.className = 'journal-video-cover';
      cover.alt = '';
      cover.loading = 'lazy';
      cover.decoding = 'async';
      cover.src = poster;
      button.append(cover);
    }
    const label = document.createElement('span');
    label.className = 'journal-video-play-label';
    label.textContent = '▶ 点击播放';
    button.append(label);
    const message = document.createElement('div');
    message.className = 'journal-video-message';
    message.setAttribute('role', 'status');
    message.hidden = true;
    const url = original.getAttribute('src') || original.querySelector('source[src]')?.getAttribute('src');
    message.append(document.createTextNode('视频加载失败，请点击封面重试，或'));
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.textContent = '单独打开视频';
      link.target = '_blank';
      link.rel = 'noopener';
      message.append(link);
    }
    const state = {button, label, video: null, position: 0};
    button.addEventListener('click', () => {
      if (state.video) return;
      if (active) release(active);
      message.hidden = true;
      // Safari's cloneNode(true) does not register <source> children in the
      // media engine, so the cloned video silently fails to load on first play.
      // Build a fresh <video> and set src directly to bypass source selection.
      const video = document.createElement('video');
      video.controls = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.autoplay = true; // Signal intent to Safari
      if (poster) video.poster = poster;
      if (width > 0) video.width = width;
      if (height > 0) video.height = height;
      
      state.video = video;
      active = state;
      button.hidden = true;
      
      // Safari workaround: MUST append to DOM before setting src, otherwise 
      // Safari's media pipeline may fail to load metadata, causing a 00:00 stall.
      box.insertBefore(video, message);
      video.src = url;

      video.addEventListener('loadedmetadata', () => {
        if (state.video === video && state.position > 0 && Number.isFinite(video.duration)) {
          video.currentTime = Math.min(state.position, Math.max(0, video.duration - 0.1));
        }
      }, {once: true});
      video.addEventListener('ended', () => { state.position = 0; });
      const showError = () => {
        if (state.video !== video) return;
        release(state);
        label.textContent = '↻ 点击重试';
        message.hidden = false;
      };
      video.addEventListener('error', showError);
      video.focus({preventScroll: true});
      // Keep play() in the user gesture for Safari and mobile autoplay policy.
      video.play().catch(error => {
        // Keep native controls for gesture restrictions; a switched-out player
        // may reject with AbortError and must not alter the new active player.
        if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') showError();
      });
    });
    box.append(button, message);
    original.replaceWith(box);
  }
  content.replaceChildren(template.content);
  window.addEventListener('pagehide', () => { if (active) release(active); }, {once: true});
}
