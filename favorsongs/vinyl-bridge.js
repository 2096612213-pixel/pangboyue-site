/* Adapter for the supplied Hi-Fi renderer. One selected file, one media element. */
(() => {
  let selected = null, loading = false, shouldPlay = false, failed = false;
  let saveCurrentPreferences = () => {};
  const notify = (state, message = '') => window.dispatchEvent(new CustomEvent('playliststate', {
    detail: { file: selected?.file, state, message }
  }));
  const statusLine = text => installLyrics(LyricTimeline.normalize([{text, source:'status'}]), false);
  async function select(song, {autoplay = true} = {}) {
    saveCurrentPreferences();
    selected = song; failed = false;
    const requestedURL = new URL(song.audioFile || song.file, location.href).href;
    const prebuffered = audioEl.dataset.prebufferSrc === requestedURL && audioEl.src === requestedURL;
    delete audioEl.dataset.prebufferSrc;
    const generation = clearCurrentTrack(prebuffered), signal = trackAbort.signal;
    const valid = () => generation === trackGeneration && !signal.aborted;
    const [title, ...artists] = song.title.split('—');
    const artist = artists.join('—').trim();
    loading = true; shouldPlay = autoplay; currentAudioFile = null; isDemoMode = false;
    updateTrackLabels(title.trim(), artist); updateAlbumCover(null);
    statusLine(autoplay ? '正在加载这张唱片…' : ''); setLyricsStatus(autoplay ? '正在连接音频' : ''); notify(autoplay ? 'loading' : 'paused');
    if (!autoplay) {
      // A restored selection displays its controls immediately. Defer even
      // assigning the media URL until a real play gesture (Safari may fetch
      // metadata despite preload=none).
      audioEl.dataset.repeatOne = String(song.repeatOne === true);
      document.getElementById('btn-repeat-one').setAttribute('aria-pressed', audioEl.dataset.repeatOne);
      saveCurrentPreferences = () => {};
      loading = false; notify('paused'); return;
    }
    let revision = timelineRevision;
    const fail = message => {
      if (!valid() || failed) return;
      loading = false; shouldPlay = false; failed = true;
      // Stop both media buffering and optional metadata work. A retry gets a
      // fresh generation, so delayed events cannot replace the next selection.
      trackAbort.abort();
      transport.pause(); audioEl.removeAttribute('src'); audioEl.load();
      statusLine(message); setLyricsStatus(message); notify('error', message);
    };
    if (autoplay) ensureMediaConnection().catch(() => {});
    try {
      const url = new URL(requestedURL);
      if (url.origin !== location.origin || !url.pathname.startsWith(new URL('./', location.href).pathname)) throw Error('无效的歌曲地址');
      currentTrackMeta = {title:title.trim(), artist, album:''};
      // Let the media engine stream/range-request the original URL. Never gate
      // playback on downloading a complete MP3 or on a lyrics service response.
      audioEl.dataset.repeatOne = String(song.repeatOne === true);
      document.getElementById('btn-repeat-one').setAttribute('aria-pressed', audioEl.dataset.repeatOne);
      let pendingPosition = Number.isFinite(song.startAt) ? Math.max(0, song.startAt) : 0;
      const applyPosition = () => {
        if (!valid()) return;
        if (pendingPosition > 0 && Number.isFinite(audioEl.duration)) {
          const target = Math.min(pendingPosition, Math.max(0, audioEl.duration - .1));
          transport.managedSeek = true; transport.resumeTime = target; audioEl.currentTime = target;
          syncFromMedia();
        }
        pendingPosition = 0;
      };
      audioEl.addEventListener('loadedmetadata', applyPosition, {signal});
      if (!prebuffered) {audioEl.preload = autoplay ? 'auto' : 'none';audioEl.src = url.href;audioEl.load();}
      else if (audioEl.readyState >= 1) applyPosition();
      let lastSave = 0;
      const savePosition = force => {
        if (!valid() || pendingPosition > 0 || transport.priming || audioEl.readyState < 1) return;
        if (force || performance.now() - lastSave >= 5000) {
          lastSave = performance.now();
          // WebKit can briefly report the old decoder clock while the arm
          // repositions. Save the transport's seek target until it is settled.
          const position = audioEl.ended ? 0 : transport.busy ? transport.resumeTime : audioEl.currentTime;
          window.dispatchEvent(new CustomEvent('playlistpreferences', {detail: {file: song.file,
            position, repeatOne: audioEl.dataset.repeatOne === 'true'}}));
        }
      };
      saveCurrentPreferences = () => savePosition(true);
      audioEl.addEventListener('timeupdate', () => savePosition(false), {signal});
      for (const type of ['pause','seeked','ended']) audioEl.addEventListener(type, () => savePosition(true), {signal});

      let lastTime = audioEl.currentTime, lastAdvance = performance.now();
      let waitingSince = null, tagsStarted = false;
      let lastCheck = performance.now(), foregroundAt = lastCheck;
      const resetWatchdog = () => {
        lastCheck = foregroundAt = lastAdvance = performance.now();
        lastTime = audioEl.currentTime; waitingSince = null;
      };
      const mediaError = () => fail('音频连接失败，请点击重试');
      const stateError = event => {
        if (event.detail.state === 'error') fail(transport.error || '播放失败，请点击重试');
      };
      const watchdog = setInterval(() => {
        if (!valid()) return;
        const now = performance.now();
        if (audioEl.currentTime !== lastTime) {lastTime = audioEl.currentTime; lastAdvance = now;}
        // Suspended tabs and idle graphics are not audio failures. Only count
        // continuous foreground playback stalls, allowing time to resume.
        const suspended = now - lastCheck > 2500;
        lastCheck = now;
        if (document.hidden || suspended) {resetWatchdog(); return;}
        if (!transport.intent || audioEl.ended || !tonearmMetalLighting.ready || now - foregroundAt < 2000) {
          waitingSince = null; return;
        }
        const audible = transport.state === 'playing' && !audioEl.paused && now - lastAdvance < 2000;
        if (audible) {
          waitingSince = null;
          if (!tagsStarted) {
            tagsStarted = true;
            if (revision === timelineRevision) {
              statusLine('正在读取歌词，音乐继续播放'); revision = timelineRevision;
            }
            loadTrackDetails(song, {signal, valid, revision, title:title.trim(), artist});
          }
        } else {
          waitingSince ??= now;
          if (now - waitingSince >= 30000) fail('音频连接超时，请点击重试');
        }
      }, 500);
      document.addEventListener('visibilitychange', resetWatchdog);
      window.addEventListener('pageshow', resetWatchdog);
      audioEl.addEventListener('error', mediaError);
      document.addEventListener('transportstatechange', stateError);
      signal.addEventListener('abort', () => {
        clearInterval(watchdog);
        document.removeEventListener('visibilitychange', resetWatchdog);
        window.removeEventListener('pageshow', resetWatchdog);
        audioEl.removeEventListener('error', mediaError);
        document.removeEventListener('transportstatechange', stateError);
      }, {once:true});
      loading = false;
      if (shouldPlay) transport.play(true); else notify('paused');
    } catch (error) {
      fail(error.message);
    }
  }
  async function loadTrackDetails(song, {signal, valid, revision, title, artist}) {
    // Read a tiny build-time sidecar, never a second copy of the full song.
    const details = new AbortController();
    const abort = () => details.abort();
    signal.addEventListener('abort', abort, {once:true});
    const timer = setTimeout(abort, 15000);
    try {
      const response = await fetch(new URL(song.detailsFile, location.href), {signal:details.signal, priority:'low'});
      if (!response.ok) throw Error('暂未读取到歌曲信息');
      const meta = await response.json();
      if (!valid()) return;
      currentTrackMeta = {title, lookupTitle:meta.title || title, artist:meta.artist || artist, album:meta.album || ''};
      // A small thumbnail can wait until there is a playback buffer to spare.
      if (meta.cover) {
        let coverTimer;
        const showCover = () => {
          if (!valid()) {clearInterval(coverTimer); return;}
          const buffered = audioEl.buffered;
          const end = buffered.length ? buffered.end(buffered.length - 1) : 0;
          if (end - audioEl.currentTime >= 15 || end >= audioEl.duration - .1) {
            clearInterval(coverTimer); updateAlbumCover(new URL(meta.cover, location.href).href);
          }
        };
        coverTimer = setInterval(showCover, 1000);
        signal.addEventListener('abort', () => clearInterval(coverTimer), {once:true});
        showCover();
      }
      if (revision !== timelineRevision) return;
      const rows = meta.lyrics ? await parseAndCheckLyrics(meta.lyrics) : [];
      if (!valid()) return;
      if (rows.length) installLyrics(rows, false); else statusLine('正在寻找这首歌的歌词…');
      await beginLyricsMatching(rows, meta.embedded || null);
    } catch (error) {
      if (valid() && revision === timelineRevision) {
        statusLine('暂未加载歌词，先听听旋律。');
        setLyricsStatus('歌词暂不可用，音乐继续播放', error.message);
      }
    } finally {
      clearTimeout(timer); signal.removeEventListener('abort', abort);
    }
  }
  function toggle() {
    if (!selected) return;
    if (!loading && !failed && !audioEl.getAttribute('src')) {
      select({...selected, repeatOne:audioEl.dataset.repeatOne === 'true'}); return;
    }
    if (loading) { shouldPlay = !shouldPlay; notify(shouldPlay ? 'loading' : 'paused'); return; }
    togglePlay();
  }
  function pause() { shouldPlay = false; transport.pause(); }
  document.getElementById('btn-play').addEventListener('click', event => {
    if (!failed && !loading && !(selected && !audioEl.getAttribute('src'))) return;
    event.stopImmediatePropagation();
    if (failed) select(selected); else toggle();
  }, true);
  window.addEventListener('keydown', event => {
    if (event.target.matches('input,textarea,select,[contenteditable=true]')) return;
    if (event.code === 'Space' && (failed || loading || (selected && !audioEl.getAttribute('src')))) {
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
  document.getElementById('btn-repeat-one').addEventListener('click', () => {
    if (selected) window.dispatchEvent(new CustomEvent('playlistpreferences', {detail: {file:selected.file, repeatOne:audioEl.dataset.repeatOne === 'true'}}));
  });
  addEventListener('pagehide', () => saveCurrentPreferences());
  window.vinylPlayer = {select, toggle, pause, save: () => saveCurrentPreferences(), destroy() {selected=null; clearCurrentTrack(); currentAudioFile=null; updateAlbumCover(null);}};
  updateTrackLabels('最爱的歌曲', '选择一首，开始听');
  statusLine('从右侧选择一首歌'); setLyricsStatus('');
})();
