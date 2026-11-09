// Loaded on desktop selection or restoration, with audio deferred until play.
// The iframe isolates the
// reference player's renderer and wheel gestures from the playlist controls.
export function createVinylPlayer({onState, onNavigate, onPreferences}) {
  let frame, pending, selected, playerAPI, state = 'idle', disposed = false;
  const stage = document.querySelector('#vinyl-stage');
  function ready() {
    if (pending) return pending;
    stage.classList.add('is-loading');
    pending = new Promise((resolve, reject) => {
      frame = document.createElement('iframe');
      frame.title = '黑胶播放器与同步歌词'; frame.allow = 'autoplay';
      const timer = setTimeout(() => reject(Error('播放器加载超时，请重试')), 30000);
      frame.addEventListener('load', () => {
        clearTimeout(timer);
        if (disposed) return reject(Error('播放器已关闭'));
        const win = frame.contentWindow;
        if (!win.vinylPlayer) return reject(Error('播放器未能初始化，请重试'));
        win.addEventListener('playliststate', event => {
          if (disposed || event.detail.file !== selected?.file) return;
          state = event.detail.state; onState(event.detail);
        });
        win.addEventListener('playlistnavigate', event => onNavigate(event.detail));
        win.addEventListener('playlistpreferences', event => {
          if (!disposed && event.detail.file === selected?.file) onPreferences?.(event.detail);
        });
        stage.classList.remove('is-loading'); stage.classList.add('is-ready');
        playerAPI = win.vinylPlayer; resolve(playerAPI);
      }, {once:true});
      frame.src = new URL('./vinyl-player.html?v=032cc715cb62', import.meta.url).href;
      stage.append(frame);
    });
    return pending;
  }
  return {
    async select(song, {autoplay = true} = {}) {
      if (disposed) return;
      if (selected?.file === song.file && selected?.audioFile === song.audioFile && state !== 'error') {
        if (playerAPI) { if (autoplay) playerAPI.toggle(); return; }
        const player = await ready(); if (!disposed && autoplay) player.toggle(); return;
      }
      selected = song; state = autoplay ? 'loading' : 'paused';
      onState({file:song.file, state});
      try {
        const player = await ready();
        if (!disposed && selected === song) await player.select(song, {autoplay});
      } catch (error) {
        if (disposed || selected !== song) return;
        state = 'error'; onState({file:song.file,state,message:error.message,resetMedia:true});
        frame?.remove(); frame = null; pending = null; playerAPI = null;
        stage.classList.remove('is-ready','is-loading');
      }
    },
    setShuffle(value) { if (playerAPI) playerAPI.setShuffle(value); else ready().then(player => { if (!disposed) player.setShuffle(value); }).catch(() => {}); },
    save() { frame?.contentWindow?.vinylPlayer?.save(); },
    destroy() {
      disposed = true; frame?.contentWindow?.vinylPlayer?.destroy(); frame?.remove();
      stage.classList.remove('is-ready','is-loading');
    }
  };
}
