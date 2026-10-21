/* Adapter for the supplied Hi-Fi renderer. One selected file, one media element. */
(() => {
  let selected = null, loading = false, shouldPlay = false, failed = false;
  const notify = (state, message = '') => window.dispatchEvent(new CustomEvent('playliststate', {
    detail: { file: selected?.file, state, message }
  }));
  const statusLine = text => installLyrics(LyricTimeline.normalize([{text, source:'status'}]), false);
  async function select(song) {
    selected = song; failed = false;
    const generation = clearCurrentTrack(), signal = trackAbort.signal;
    const valid = () => generation === trackGeneration && !signal.aborted;
    const [title, ...artists] = song.title.split('—');
    const artist = artists.join('—').trim();
    loading = true; shouldPlay = true; currentAudioFile = null; isDemoMode = false;
    updateTrackLabels(title.trim(), artist); updateAlbumCover(null);
    statusLine('正在加载这张唱片…'); setLyricsStatus('正在读取音频'); notify('loading');
    const revision = timelineRevision;
    // Resume the audio context in the original click gesture, before downloading.
    ensureMediaConnection().catch(() => {});
    try {
      const url = new URL(song.file, location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith(new URL('./', location.href).pathname)) throw Error('无效的歌曲地址');
      const response = await fetch(url, {signal});
      if (!response.ok) throw Error('音频加载失败，请点击重试');
      const blob = await response.blob();
      if (!valid()) return;
      const file = new File([blob], decodeURIComponent(url.pathname.split('/').pop()), {type:blob.type || 'audio/mpeg'});
      currentAudioFile = file;
      currentAudioObjectUrl = URL.createObjectURL(file);
      audioEl.src = currentAudioObjectUrl; audioEl.preload = 'auto'; audioEl.load();
      const loaded = waitForMetadata(signal);
      const metadata = extractID3Metadata(file), embedded = EmbeddedLyrics.read(file);
      loading = false;
      if (shouldPlay) transport.play(true); else notify('paused');
      if (!await loaded || !valid()) { if (valid()) throw Error('音频未能打开，请点击重试'); return; }
      duration = audioEl.duration; syncFromMedia();
      const [meta, tags] = await Promise.all([metadata, embedded]);
      if (!valid()) { if (meta.coverUrl) URL.revokeObjectURL(meta.coverUrl); return; }
      // Keep the playlist's live/remix/studio version in the matching identity.
      currentTrackMeta = {title:title.trim(), lookupTitle:meta.title || title.trim(), artist:meta.artist || artist, album:meta.album || ''};
      updateAlbumCover(meta.coverUrl || null);
      if (revision !== timelineRevision) return;
      const text = meta.lyrics || tags.plain || '';
      const rows = text ? await parseAndCheckLyrics(text) : [];
      if (!valid()) return;
      if (rows.length) installLyrics(rows, false); else statusLine('正在寻找这首歌的歌词…');
      await beginLyricsMatching(rows, tags);
    } catch (error) {
      if (!valid()) return;
      loading = false; shouldPlay = false; failed = true; transport.pause();
      statusLine('暂时无法加载，请重试'); setLyricsStatus(error.message); notify('error', error.message);
    }
  }
  function toggle() {
    if (!selected) return;
    if (loading) { shouldPlay = !shouldPlay; notify(shouldPlay ? 'loading' : 'paused'); return; }
    togglePlay();
  }
  function pause() { shouldPlay = false; transport.pause(); }
  document.getElementById('btn-play').addEventListener('click', event => {
    if (!failed && !loading) return;
    event.stopImmediatePropagation();
    if (failed) select(selected); else toggle();
  }, true);
  window.addEventListener('keydown', event => {
    if (event.target.matches('input,textarea,select,[contenteditable=true]')) return;
    if (event.code === 'Space' && (failed || loading)) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (failed) select(selected); else toggle();
    } else if (event.key === 'Escape' && loading) {shouldPlay=false;notify('paused');}
  }, true);
  document.addEventListener('transportstatechange', event => {
    if (!loading && !failed) notify(event.detail.state, transport.error || '');
  });
  for (const [id, direction] of [['btn-prev',-1], ['btn-next',1]]) {
    const button = document.getElementById(id);
    button.title = direction < 0 ? '上一首歌曲' : '下一首歌曲';
    button.setAttribute('aria-label', button.title);
    button.addEventListener('click', event => {
      event.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('playlistnavigate', {detail:direction}));
    }, true);
  }
  // The site owns track selection; standalone audio drag-and-drop is disabled.
  for (const type of ['dragover','drop']) window.addEventListener(type, event => { event.preventDefault(); event.stopImmediatePropagation(); }, true);
  window.vinylPlayer = {select, toggle, pause, destroy() {selected=null; clearCurrentTrack(); currentAudioFile=null; updateAlbumCover(null);}};
  updateTrackLabels('最爱的歌曲', '选择一首，开始听');
  statusLine('从右侧选择一首歌'); setLyricsStatus('');
})();
