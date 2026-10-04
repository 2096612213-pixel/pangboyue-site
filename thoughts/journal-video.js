// Parse in an inert template: no media URLs reach live players before a click.
export function renderJournalContent(content, html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const image of template.content.querySelectorAll('img')) {
    image.loading = 'lazy';
    image.decoding = 'async';
  }
  let active = null;

  function prepareMediaUrl(rawUrl, position = 0) {
    if (!rawUrl) return '';
    const targetTime = position > 0 ? position : 0.001;
    const [base] = rawUrl.split('#');
    return `${base}#t=${targetTime}`;
  }

  function release(state) {
    const video = state.video;
    if (!video) return;
    state.position = !video.ended && Number.isFinite(video.currentTime) ? video.currentTime : 0;
    state.video = null;
    video.pause();
    video.removeAttribute('src');
    video.load(); // Abort the previous download
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
    
    const poster = original.getAttribute('poster');
    const url = original.getAttribute('src') || original.querySelector('source[src]')?.getAttribute('src');

    // Create the video element directly in the box under the cover overlay.
    // It remains inert (no src, preload="none") until user clicks play.
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'none';
    if (poster) video.poster = poster;
    if (width > 0) video.width = width;
    if (height > 0) video.height = height;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'journal-video-play';
    button.setAttribute('aria-label', `播放视频：${original.getAttribute('aria-label') || '周记视频'}`);
    
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

    const revealPlayingVideo = () => {
      if (state.video === video) {
        button.hidden = true;
      }
    };

    video.addEventListener('playing', revealPlayingVideo);
    video.addEventListener('timeupdate', () => {
      if (video.currentTime > 0) revealPlayingVideo();
    });

    video.addEventListener('loadedmetadata', () => {
      if (state.video === video && state.position > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(state.position, Math.max(0, video.duration - 0.1));
      }
    });

    video.addEventListener('ended', () => {
      state.position = 0;
      release(state);
    });

    const showError = () => {
      if (state.video !== video) return;
      release(state);
      label.textContent = '↻ 点击重试';
      message.hidden = false;
    };
    video.addEventListener('error', showError);

    button.addEventListener('click', () => {
      if (state.video) return;
      if (active) release(active);
      message.hidden = true;
      
      state.video = video;
      active = state;
      label.textContent = '⏳ 加载中…';

      // Appending #t=0.001 forces iOS Safari AVPlayer to execute a range request
      // and seek to 1ms, eliminating the cellular 00:00 decoding stall.
      const mediaUrl = prepareMediaUrl(url, state.position);
      video.src = mediaUrl;

      // Keep play() synchronous in user gesture
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
            showError();
          } else {
            button.hidden = false;
            label.textContent = state.position > 0 ? '▶ 继续播放' : '▶ 点击播放';
          }
        });
      }

      // Fallback: If playing event doesn't fire within 1.2s but playback started, reveal
      setTimeout(() => {
        if (state.video === video && !video.paused) {
          revealPlayingVideo();
        }
      }, 1200);
    });

    box.append(video, button, message);
    original.replaceWith(box);
  }
  content.replaceChildren(template.content);
  window.addEventListener('pagehide', () => { if (active) release(active); }, {once: true});
}
