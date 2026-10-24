// Loaded only after an explicit desktop play action. The iframe isolates the
// reference player's renderer and wheel gestures from the playlist controls.
export function createVinylPlayer({onState, onNavigate}) {
  let frame, pending, selected, state = 'idle', disposed = false;
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
        stage.classList.remove('is-loading'); stage.classList.add('is-ready');
        resolve(win.vinylPlayer);
      }, {once:true});
      frame.src = new URL('./vinyl-player.html?v=7540f57060bb', import.meta.url).href;
      stage.append(frame);
    });
    return pending;
  }
  return {
    async select(song) {
      if (disposed) return;
      if (selected?.file === song.file && selected?.audioFile === song.audioFile && state !== 'error') {
        const player = await ready(); if (!disposed) player.toggle(); return;
      }
      selected = song; state = 'loading';
      onState({file:song.file, state});
      try {
        const player = await ready();
        if (!disposed && selected === song) await player.select(song);
      } catch (error) {
        if (disposed || selected !== song) return;
        state = 'error'; onState({file:song.file,state,message:error.message,resetMedia:true});
        frame?.remove(); frame = null; pending = null;
        stage.classList.remove('is-ready','is-loading');
      }
    },
    destroy() {
      disposed = true; frame?.contentWindow?.vinylPlayer?.destroy(); frame?.remove();
      stage.classList.remove('is-ready','is-loading');
    }
  };
}
