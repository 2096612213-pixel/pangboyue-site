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
    video.hidden = true; // Hide it instead of removing it from DOM
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

    // iOS Safari workaround: Create the video element UPFRONT and put it in the DOM,
    // but keep it hidden and without a src. This avoids the WebKit bug where newly
    // created video elements in a click handler fail to reliably capture the user gesture
    // or initialize their media pipeline, leading to a 00:00 stall.
    const videoNode = document.createElement('video');
    videoNode.controls = true;
    videoNode.playsInline = true;
    videoNode.preload = 'none'; // Prevent loading before click
    videoNode.hidden = true;
    if (poster) videoNode.poster = poster;
    if (width > 0) videoNode.width = width;
    if (height > 0) videoNode.height = height;

    const state = {button, label, video: null, position: 0};

    // Attach listeners once
    videoNode.addEventListener('loadedmetadata', () => {
      if (state.video === videoNode && state.position > 0 && Number.isFinite(videoNode.duration)) {
        videoNode.currentTime = Math.min(state.position, Math.max(0, videoNode.duration - 0.1));
      }
    });
    
    videoNode.addEventListener('ended', () => { 
      if (state.video === videoNode) {
        state.position = 0; 
      }
    });
    
    videoNode.addEventListener('error', () => {
      if (state.video !== videoNode) return;
      release(state);
      label.textContent = '↻ 点击重试';
      message.hidden = false;
    });

    button.addEventListener('click', () => {
      if (state.video) return;
      if (active) release(active);
      message.hidden = true;
      
      state.video = videoNode;
      active = state;
      button.hidden = true;
      
      videoNode.hidden = false;
      
      // FORCE WEBKIT LAYOUT:
      // iOS Safari's AVPlayer layer is only attached after the element gets a layout.
      // Since it was hidden (display: none), we must force a synchronous layout
      // calculation before assigning src and calling play(), otherwise the media 
      // engine stalls at -00:00.
      void videoNode.offsetWidth;
      
      videoNode.preload = 'auto';
      videoNode.src = url;
      videoNode.load(); // Force iOS to fetch

      videoNode.focus({preventScroll: true});
      videoNode.play().catch(error => {
        // Keep native controls for gesture restrictions; a switched-out player
        // may reject with AbortError and must not alter the new active player.
        if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
          if (state.video === videoNode) {
            release(state);
            label.textContent = '↻ 点击重试';
            message.hidden = false;
          }
        }
      });
    });

    box.append(button, videoNode, message);
    original.replaceWith(box);
  }
  content.replaceChildren(template.content);
  window.addEventListener('pagehide', () => { if (active) release(active); }, {once: true});
}
