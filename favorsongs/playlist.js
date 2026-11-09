// Readable module source; build:songs bundles the manifest for one startup request.
import { songs as addedSongs } from './songs.js';
import {normalizeSearch, createSongSearch} from './search.js';
import {createPlaylistPreferences} from './preferences.js';
let songs = [...addedSongs];
let preferenceStorage;
try { preferenceStorage = localStorage; } catch {}
const preferences = createPlaylistPreferences(addedSongs.map(song => song.file), preferenceStorage);
// AAC-LC copies have no large embedded artwork and their index is at the start.
const STREAM_REVISION = 'd440e2748333'; // updated by build:songs
const qualityControl = document.querySelector('#audio-quality');
let audioQuality = preferences.get().quality;
qualityControl.value = audioQuality;
const audioPath = song => audioQuality === 'original' ? song.file : `streams/${song.file.replace(/\.(?:mp3|m4a)$/i, '.m4a')}?v=${STREAM_REVISION}`;
const playbackSong = song => ({...song, repeatOne:preferences.get().repeatOne, startAt:preferences.get().file === song.file ? preferences.get().position : 0, audioFile:audioPath(song), detailsFile:`details/${song.file.replace(/\.(?:mp3|m4a)$/i, '.json')}?v=${STREAM_REVISION}`});

// Manifest order records addition order, including older entries without timestamps.
const additionOrder = new Map(addedSongs.map((song, index) => [song.file, index]));
const pinyinCollator = new Intl.Collator('zh-Hans-CN-u-co-pinyin', { numeric: true, sensitivity: 'base' });

// 复用浏览器的拼音排序规则；中文以音节边界分类，英文直接取首字母。
const alphabet = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
const pinyinBoundaries = [
  ['A','阿'], ['B','八'], ['C','擦'], ['D','搭'], ['E','蛾'], ['F','发'],
  ['G','噶'], ['H','哈'], ['J','击'], ['K','喀'], ['L','垃'], ['M','妈'],
  ['N','拿'], ['O','哦'], ['P','啪'], ['Q','七'], ['R','然'], ['S','撒'],
  ['T','塌'], ['W','挖'], ['X','昔'], ['Y','压'], ['Z','匝'],
];
const songName = song => song.title.split('—')[0].trim();
function initialFor(song) {
  const title = songName(song).normalize('NFKC').replace(/^[\p{P}\p{S}\p{Z}]+/u, '');
  const first = [...title][0] || '';
  const latin = first.normalize('NFD').replace(/\p{M}/gu, '');
  if (/^[a-z]$/i.test(latin)) return latin.toUpperCase();
  if (/\p{Script=Han}/u.test(first)) {
    for (let index = pinyinBoundaries.length - 1; index >= 0; index--) {
      if (pinyinCollator.compare(first, pinyinBoundaries[index][1]) >= 0) return pinyinBoundaries[index][0];
    }
  }
  return '#';
}
const initials = new Map(addedSongs.map(song => [song.file, initialFor(song)]));
const groupOrder = song => alphabet.indexOf(initials.get(song.file));
let sortMode = 'added';
let alphabetNav = null;
let draggingPointer = null;
let draggedLetter = '';
let dragBounds = null;
let letterNavigation = null;
const alphabetButtons = new Map();
function markLetter(letter) {
  for (const [key, button] of alphabetButtons) button.setAttribute('aria-pressed', String(key === letter));
}
function syncAlphabet(listTop, stride) {
  if (!alphabetNav) return;
  // A gesture owns the selection. Scroll/render callbacks must not replace the
  // letter under the finger with the group currently passing the viewport edge.
  if (draggingPointer !== null) {
    if (draggedLetter) markLetter(draggedLetter);
    return;
  }
  // A programmatic scroll can be delivered after touchend in a mobile webview.
  // Retain the requested selection until that scroll has settled, or the user
  // starts a different scroll/search/sort action.
  if (letterNavigation && performance.now() < letterNavigation.until) {
    markLetter(letterNavigation.letter);
    if (Math.abs(scrollPosition().top - letterNavigation.top) < 2) letterNavigation = null;
    return;
  }
  letterNavigation = null;
  const edge = matchMedia('(max-width: 1000px)').matches ? 216 : 266;
  const position = scrollPosition();
  const atBottom = position.top + position.height >= position.scrollHeight - 2;
  const first = atBottom ? songs.length - 1 : Math.max(0, Math.min(songs.length - 1, Math.floor((edge - listTop + 1) / stride)));
  markLetter(sortMode === 'pinyin' ? initials.get(songs[first]?.file) : '');
}


const list = document.querySelector('#songs');
const cards = new Map();
const flowLayout = matchMedia('(max-width: 1000px)');
const scrollViewport = document.querySelector('#playlist-viewport');
let searchScrollFrame = 0;
let rowsNeedLayout = true;
let lastFlow = null;
let lastStride = 0;
let matchedCard = null;
let activeIndex = -1;
let scheduled = false;
let searchIndex = -1;
let previousQuery = "";
let matchCursor = -1;
let desktopPlayer = null;
let desktopModule = null;
let selectionRevision = 0;
let desktopState = 'idle';
let currentCard = null;
let mobileRepeat = preferences.get().repeatOne;
function rememberSelection(song) {
  if (preferences.get().file !== song.file) preferences.update({file: song.file, position: 0});
}
function rememberDesktopPreferences(detail) {
  if (detail.file !== preferences.get().file) return;
  const patch = {};
  if (typeof detail.repeatOne === 'boolean') patch.repeatOne = detail.repeatOne;
  if (Number.isFinite(detail.position)) patch.position = detail.position;
  preferences.update(patch);
  mobileRepeat = preferences.get().repeatOne;
}
function flushPreferences() {
  preferences.update({query: document.querySelector('#song-query').value, sort: sortMode});
  if (flowLayout.matches) cards.get(activeIndex)?.savePlayer?.();
  else desktopPlayer?.save();
}
addEventListener('pagehide', flushPreferences);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushPreferences(); });
function updateDesktopState({file, state, message, resetMedia}) {
  if (flowLayout.matches || songs[activeIndex]?.file !== file) return;
  desktopState = state;
  if (resetMedia) releaseDesktopAudio();
  const playing = ['playing','preparing','spinningUp','movingArm','loweringStylus','loading'].includes(state);
  for (const card of [cards.get(activeIndex), currentCard]) {
    const button = card?.querySelector('.load-play');
    if (!button) continue;
    button.querySelector('.play-triangle').textContent = playing ? 'Ⅱ' : '▶';
    button.querySelector('.play-time').textContent = state === 'error' ? '重试' : state === 'loading' ? '加载中' : playing ? '暂停' : '播放';
    button.setAttribute('aria-label', `${state === 'error' ? '重试播放' : playing ? '暂停' : '播放'} ${songs[activeIndex].title}`);
    button.setAttribute('aria-pressed', String(playing));
    button.title = message || button.getAttribute('aria-label');
  }
}
function releaseDesktopAudio() {
  window.__favoriteVinylAudioContext?.close().catch(() => {});
  delete window.__favoriteVinylAudioContext;
  window.__favoriteVinylAudio?.pause(); window.__favoriteVinylAudio?.remove();
  delete window.__favoriteVinylAudio;
}
function unlockDesktopAudio() {
  // WebKit needs AudioContext.resume inside the original page click, before
  // the lazy module/iframe or selected file has finished loading.
  if (!window.__favoriteVinylAudio) {
    const audio = document.createElement('audio');
    audio.hidden = true; audio.preload = 'none'; audio.dataset.vinylWarm = 'true';
    audio.src = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
    window.__favoriteVinylAudio = audio; document.body.append(audio);
    // A short, genuinely silent local WAV unlocks this same media element.
    audio.play().then(() => {
      if (audio.dataset.vinylWarm === 'true') {audio.pause();audio.removeAttribute('src');audio.load();}
    }).catch(() => {});
  }
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  try {
    window.__favoriteVinylAudioContext ||= new Context();
    window.__favoriteVinylAudioContext.resume().catch(() => {});
  } catch { /* The player's controls expose a retry if audio is unavailable. */ }
}
async function selectDesktopSong(song, {restore = false} = {}) {
  rememberSelection(song);
  if (!restore && !desktopPlayer) unlockDesktopAudio();
  // Start buffering the selected audio while the renderer is downloading.
  if (!desktopPlayer && !restore) {
    const audio = window.__favoriteVinylAudio;
    delete audio.dataset.vinylWarm;
    const url = new URL(audioPath(song), location.href).href;
    if (audio.dataset.prebufferSrc !== url) {
      audio.muted = true; audio.src = url; audio.preload = 'auto';
      audio.dataset.prebufferSrc = url; audio.load();
    }
  }
  const revision = ++selectionRevision;
  for (const card of cards.values()) card.querySelector('audio')?.pause();
  const same = songs[activeIndex]?.file === song.file;
  activeIndex = songs.indexOf(song);
  if (!same || restore) desktopState = restore ? 'paused' : 'loading';
  document.body.classList.add('vinyl-selected');
  cancelAnimationFrame(searchScrollFrame); letterNavigation = null;
  render();
  try {
    if (desktopPlayer) { desktopPlayer.select(playbackSong(song), {autoplay: !restore}); return; }
    desktopModule ||= import('./vinyl-desktop.js?v=0a91bf9614ce');
    let loadTimer;
    const {createVinylPlayer} = await Promise.race([desktopModule, new Promise((_, reject) => {
      loadTimer = setTimeout(() => reject(Error('播放器加载超时，请重试')), 30000);
    })]).finally(() => clearTimeout(loadTimer));
    if (revision !== selectionRevision || flowLayout.matches) return;
    desktopPlayer ||= createVinylPlayer({onState:updateDesktopState, onPreferences:rememberDesktopPreferences, onNavigate:direction => {
      const next = (activeIndex + direction + songs.length) % songs.length;
      selectDesktopSong(songs[next]);
    }});
    desktopPlayer.select(playbackSong(song), {autoplay: !restore});
  } catch (error) {
    desktopModule = null;
    if (revision === selectionRevision) updateDesktopState({file:song.file,state:'error',message:'播放器加载失败，请重试',resetMedia:true});
  }
}
flowLayout.addEventListener('change', () => {
  cards.get(activeIndex)?.savePlayer?.();
  desktopPlayer?.save();
  selectionRevision++;
  desktopPlayer?.destroy(); desktopPlayer = null;
  releaseDesktopAudio();
  for (const card of cards.values()) {card.querySelector('audio')?.pause();card.remove();}
  cards.clear(); activeIndex = -1; rowsNeedLayout = true;
  currentCard?.remove(); currentCard = null;
  document.body.classList.remove('vinyl-selected');
  render(); restoreSavedSelection();
});

function scrollPosition() {
  return flowLayout.matches
    ? { top: scrollViewport.scrollTop, height: scrollViewport.clientHeight, scrollHeight: scrollViewport.scrollHeight }
    : { top: scrollY, height: innerHeight, scrollHeight: document.documentElement.scrollHeight };
}
function scrollPlaylist(top, behavior = 'auto') {
  (flowLayout.matches ? scrollViewport : window).scrollTo({ top, behavior });
}
function listContentTop() {
  let top = 0;
  for (let node = list; node && node !== scrollViewport; node = node.offsetParent) top += node.offsetTop;
  return top;
}

function dimensions() {
  const styles = getComputedStyle(list);
  return {
    height: parseFloat(styles.getPropertyValue('--card-height')),
    gap: parseFloat(styles.getPropertyValue('--card-gap')),
  };
}

function makeCard(song, index) {
  const card = document.createElement('div');
  card.className = 'song';
  card.dataset.file = song.file;
  card.tabIndex = -1;
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-posinset', String(index + 1));
  card.setAttribute('aria-setsize', String(songs.length));

  const name = document.createElement('span');
  name.className = 'song-name';
  name.textContent = song.title;

  const player = document.createElement('div');
  player.className = 'player';
  let audio;
  // Keep unplayed rows lightweight: no native media element or source until play.
  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'load-play';
  playButton.setAttribute('aria-label', `播放 ${song.title}`);
  playButton.innerHTML = '<span class="play-triangle">▶</span><span class="play-time">0:00 / 0:00</span><span class="play-progress"></span><span class="play-volume">◖</span><span class="play-more">⋮</span>';
  async function startSong(autoplay = true) {
    if (!flowLayout.matches) { selectDesktopSong(song); return; }
    if (audio) { if (autoplay) { if (audio.error) audio.load(); try { await audio.play(); } catch {} } return; }
    rememberSelection(song);
    const index = songs.indexOf(song);
    cards.get(activeIndex)?.querySelector('audio')?.pause();
    activeIndex = index;
    audio = document.createElement('audio');
    audio.controls = true; audio.preload = autoplay ? 'auto' : 'none'; audio.loop = mobileRepeat;
    let pendingPosition = preferences.get().position;
    const applyPosition = () => {
      if (pendingPosition > 0 && Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(pendingPosition, Math.max(0, audio.duration - .1));
      }
      pendingPosition = 0;
    };
    audio.addEventListener('loadedmetadata', applyPosition, {once: true});
    let lastSave = 0;
    const savePosition = force => {
      if (preferences.get().file !== song.file || pendingPosition > 0 || audio.readyState < 1) return;
      if (force || performance.now() - lastSave >= 5000) {
        lastSave = performance.now(); preferences.update({position: audio.ended ? 0 : audio.currentTime});
      }
    };
    card.savePlayer = () => savePosition(true);
    audio.addEventListener('timeupdate', () => savePosition(false));
    for (const type of ['pause','seeked','ended']) audio.addEventListener(type, () => savePosition(true));
    card.classList.add('mobile-active');
    audio.setAttribute('aria-label', song.title);
    const repeat = document.createElement('button');
    repeat.type = 'button'; repeat.className = 'mobile-repeat';
    repeat.setAttribute('aria-label', '单曲循环'); repeat.setAttribute('aria-pressed', String(mobileRepeat));
    repeat.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/><path d="M11 10l1-1v6m-1 0h2"/></svg>';
    repeat.addEventListener('click', () => {
      mobileRepeat = !mobileRepeat; audio.loop = mobileRepeat;
      preferences.update({repeatOne: mobileRepeat});
      repeat.setAttribute('aria-pressed', String(mobileRepeat));
    });
    const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'mobile-retry'; retry.textContent = '重试播放'; retry.hidden = true;
    retry.addEventListener('click', () => { if (audio.error) audio.load(); audio.play().catch(() => { retry.hidden = false; }); });
    audio.addEventListener('error', () => { retry.hidden = false; });
    audio.addEventListener('playing', () => { retry.hidden = true; });
    audio.addEventListener('play', () => {
      for (const card of cards.values()) {
        const other = card.querySelector('audio');
        if (other && other !== audio) other.pause();
      }
      for (const c of cards.values()) c.classList.toggle('mobile-active', c === card);
      audio.loop = mobileRepeat; repeat.setAttribute('aria-pressed', String(mobileRepeat));
      if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
        const [title, ...artist] = song.title.split('—');
        navigator.mediaSession.metadata = new MediaMetadata({title: title.trim(), artist: artist.join('—').trim()});
        navigator.mediaSession.setActionHandler('play', () => { audio.play().catch(() => {}); });
        navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      }
      rememberSelection(song);
      activeIndex = songs.indexOf(song); scheduleRender();
    });
    audio.addEventListener('ended', () => {
      if (activeIndex === songs.indexOf(song)) activeIndex = -1;
      scheduleRender();
    });
    audio.src = audioPath(song);
    playButton.replaceWith(audio); player.append(repeat, retry);
    render();
    if (autoplay) try { await audio.play(); } catch { retry.hidden = false; }
  }
  playButton.addEventListener('click', () => startSong(true));
  card.restorePlayer = () => startSong(false);
  card.addEventListener('click', event => {
    if (!flowLayout.matches && !event.target.closest('button,audio')) selectDesktopSong(song);
  });

  player.append(playButton);
  card.append(name, player);
  return card;
}

function render() {
  const { height, gap } = dimensions();
  const stride = height + gap;
  // iOS scrolling/compositing must not depend on recycling absolute rows in a
  // 100,000px layer. Phone/tablet rows stay in normal flow; desktop stays virtual.
  const flow = flowLayout.matches;
  if (flow && lastFlow === flow && lastStride === stride && !rowsNeedLayout) {
    const nextMatch = cards.get(searchIndex);
    if (matchedCard !== nextMatch) {
      matchedCard?.classList.remove('search-match');
      nextMatch?.classList.add('search-match'); matchedCard = nextMatch;
    }
    syncAlphabet(list.getBoundingClientRect().top, stride);
    return;
  }
  lastFlow = flow; lastStride = stride; rowsNeedLayout = false;
  list.classList.toggle('is-flow-list', flow);
  list.style.height = flow ? 'auto' : `${songs.length * stride - gap}px`;

  const listTop = list.getBoundingClientRect().top;
  const start = flow ? 0 : Math.max(0, Math.floor(-listTop / stride) - 2);
  const end = flow ? songs.length : Math.min(songs.length, Math.max(0, Math.ceil((innerHeight - listTop) / stride) + 2));
  const wanted = new Set();
  for (let row = start; row < end; row++) {
    const index = row;
    if (index < songs.length) wanted.add(index);
  }
  if (activeIndex !== -1) wanted.add(activeIndex);
  if (searchIndex !== -1) wanted.add(searchIndex);

  for (const [index, card] of cards) {
    if (!wanted.has(index)) {
      card.remove();
      cards.delete(index);
    }
  }
  let previousCard = null;
  for (const index of wanted) {
    let card = cards.get(index);
    if (!card) {
      card = makeCard(songs[index], index);
      cards.set(index, card);
      list.append(card);
    }
    if (flow) {
      const next = previousCard ? previousCard.nextElementSibling : list.firstElementChild;
      if (next !== card) list.insertBefore(card, next);
      previousCard = card;
    }
    card.setAttribute('aria-posinset', String(index + 1));
    card.style.top = `${index * stride}px`;
    if (!flow) {
      const button = card.querySelector('.load-play');
      if (button && index !== activeIndex) {
        button.querySelector('.play-time').textContent = '播放';
        button.querySelector('.play-triangle').textContent = '▶';
        button.setAttribute('aria-label', `播放 ${songs[index].title}`);
        button.setAttribute('aria-pressed','false');
      }
    }
    card.classList.toggle("search-match", index === searchIndex);
  }
  if (!flow && activeIndex >= 0) {
    // The fixed now-playing card is separate: queue rows and scroll stay put.
    if (currentCard?.dataset.file !== songs[activeIndex].file) {
      currentCard?.remove();
      currentCard = makeCard(songs[activeIndex], activeIndex);
      currentCard.classList.add('is-current');
      currentCard.setAttribute('role', 'group');
      currentCard.setAttribute('aria-label', '当前播放');
      currentCard.removeAttribute('aria-posinset');
      currentCard.removeAttribute('aria-setsize');
      document.body.append(currentCard);
    }
    updateDesktopState({file:songs[activeIndex].file,state:desktopState});
  }
  matchedCard = cards.get(searchIndex);
  syncAlphabet(listTop, stride);
}

function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    render();
  });
}

addEventListener('scroll', scheduleRender, { passive: true });
scrollViewport.addEventListener('scroll', scheduleRender, { passive: true });
addEventListener('resize', scheduleRender);
window.visualViewport?.addEventListener('resize', scheduleRender);
render();

// Search navigates the virtual list without loading, starting, or pausing audio.
const searchForm = document.querySelector('#song-search');
const searchInput = document.querySelector('#song-query');
const searchStatus = document.querySelector('#search-status');
const SONG_SEARCH_DATA = {}; // generated at build
let searchSongs = createSongSearch(songs, SONG_SEARCH_DATA);
let searchGeneration = 0;
let queryDictionaryPromise, queryDictionary;
function loadQueryDictionary() {
  if (!queryDictionaryPromise) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    queryDictionaryPromise = fetch('./pinyin-han.json?v=generated', {signal: controller.signal})
      .then(response => { if (!response.ok) throw new Error('pinyin dictionary'); return response.json(); })
      .then(dictionary => (queryDictionary = dictionary))
      .catch(() => { queryDictionaryPromise = null; return null; })
      .finally(() => clearTimeout(timer));
  }
  return queryDictionaryPromise;
}
let composing = false;
searchInput.addEventListener('compositionstart', () => { composing = true; });
searchInput.addEventListener('compositionend', () => { composing = false; });
searchInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.isComposing || composing || event.keyCode === 229)) event.preventDefault();
});
searchInput.addEventListener('input', () => {
  searchGeneration++;
  preferences.update({query: searchInput.value});
  letterNavigation = null;
  if (/\p{Script=Han}/u.test(searchInput.value)) loadQueryDictionary();
  previousQuery = ''; matchCursor = -1; searchIndex = -1;
  searchStatus.textContent = '搜索只定位歌曲，点击播放按钮开始听。';
  render();
});
searchForm.addEventListener('submit', async event => {
  event.preventDefault();
  cancelAnimationFrame(searchScrollFrame);
  letterNavigation = null;
  if (composing) return;
  const generation = searchGeneration;
  const query = normalizeSearch(searchInput.value);
  if (!query) {
    searchStatus.textContent = '请输入歌名或歌手。';
    searchInput.focus();
    return;
  }
  // Literal/Latin searches are immediate. Chinese typo matching additionally
  // uses the lazy pronunciation dictionary, without blocking normal matches.
  let matches = searchSongs(query);
  if (/\p{Script=Han}/u.test(query) && (queryDictionary || !matches.length || matches[0].score < .88)) {
    if (!matches.length) searchStatus.textContent = '正在搜索…';
    const dictionary = await loadQueryDictionary();
    if (generation !== searchGeneration || normalizeSearch(searchInput.value) !== query || composing) return;
    if (dictionary) matches = searchSongs(query, dictionary);
  }
  if (!matches.length) {
    searchIndex = -1; previousQuery = ''; matchCursor = -1;
    searchStatus.textContent = `没有找到“${searchInput.value.trim()}”，试试部分歌名或歌手名。`;
    render();
    return;
  }
  matchCursor = query === previousQuery ? (matchCursor + 1) % matches.length : 0;
  previousQuery = query;
  searchIndex = songs.findIndex(song => song.file === matches[matchCursor].file);
  searchStatus.textContent = `已定位：${songs[searchIndex].title}` +
    (matches.length > 1 ? `（${matchCursor + 1}/${matches.length}，再次按 Enter 定位下一首）` : '');
  render(); // Materialize even a far-off card before scrolling to it.
  searchScrollFrame = requestAnimationFrame(() => {
    const { height, gap } = dimensions();
    const target = cards.get(searchIndex);
    const top = flowLayout.matches && target ? listContentTop() + target.offsetTop - (scrollPosition().height - target.offsetHeight) / 2 : listContentTop() + searchIndex * (height + gap) - (scrollPosition().height - height) / 2;
    scrollPlaylist(Math.max(0, top), matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  });
});


function sortPlaylist(mode, resetScroll = true) {
  searchGeneration++;
  cancelAnimationFrame(searchScrollFrame);
  letterNavigation = null;
  rowsNeedLayout = true;
  sortMode = mode;
  preferences.update({sort: mode});
  const activeFile = songs[activeIndex]?.file;
  const matchedFile = songs[searchIndex]?.file;
  const retained = new Map([...cards.values()].map(card => [card.dataset.file, card]));
  songs = [...addedSongs];
  if (mode === 'pinyin') {
    songs.sort((a, b) => groupOrder(a) - groupOrder(b) || pinyinCollator.compare(songName(a), songName(b))
      || pinyinCollator.compare(a.title, b.title)
      || additionOrder.get(a.file) - additionOrder.get(b.file));
  }
  searchSongs = createSongSearch(songs, SONG_SEARCH_DATA);
  // Keep the playing card and audio element so sorting never restarts playback.
  cards.clear();
  songs.forEach((song, index) => {
    const card = retained.get(song.file);
    if (card) cards.set(index, card);
  });
  activeIndex = songs.findIndex(song => song.file === activeFile);
  searchIndex = songs.findIndex(song => song.file === matchedFile);
  previousQuery = ''; matchCursor = -1;
  document.querySelector('#sort-pinyin').setAttribute('aria-pressed', String(mode === 'pinyin'));
  document.querySelector('#sort-added').setAttribute('aria-pressed', String(mode === 'added'));
  searchStatus.textContent = mode === 'pinyin' ? '已按歌名拼音 A–Z 排序。' : '已按添加时间排序（最早 → 最新）。';
  render();
  if (resetScroll) scrollPlaylist(0);
}
document.querySelector('#sort-pinyin').addEventListener('click', () => sortPlaylist('pinyin'));
document.querySelector('#sort-added').addEventListener('click', () => sortPlaylist('added'));


// 微信式索引：点选、连续拖动与键盘定位都不触发音频加载。
alphabetNav = document.querySelector('#song-alphabet');
const preview = alphabetNav.querySelector('.alphabet-preview');
let previewTimer = 0;
let lastPointerTime = -Infinity;
for (const letter of alphabet) {
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.letter = letter;
  button.setAttribute('aria-label', letter === '#' ? '定位数字或其他字符开头的歌曲' : `定位到 ${letter} 开头的歌曲`);
  button.setAttribute('aria-pressed', 'false');
  button.disabled = !addedSongs.some(song => initials.get(song.file) === letter);
  const label = document.createElement('span'); label.textContent = letter;
  button.append(label); alphabetNav.insertBefore(button, preview);
  alphabetButtons.set(letter, button);
}
function showPreview(letter) {
  clearTimeout(previewTimer);
  const rect = alphabetButtons.get(letter).getBoundingClientRect();
  const margin = matchMedia('(max-width: 1000px)').matches ? 30 : 44;
  const center = Math.max(margin, Math.min(innerHeight - margin, rect.top + rect.height / 2));
  preview.style.top = `${center - alphabetNav.getBoundingClientRect().top}px`;
  preview.textContent = letter; preview.hidden = false;
}
function hidePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => { preview.hidden = true; }, 450);
}
function jumpToLetter(letter) {
  cancelAnimationFrame(searchScrollFrame);
  if (alphabetButtons.get(letter)?.disabled) return;
  if (sortMode !== 'pinyin') sortPlaylist('pinyin', false);
  const index = songs.findIndex(song => initials.get(song.file) === letter);
  if (index < 0) return;
  searchIndex = index; previousQuery = ''; matchCursor = -1;
  searchStatus.textContent = `已定位 ${letter}：${songs[index].title}`;
  render();
  // Use the virtual row's layout position, not a card's animated hover transform.
  const { height, gap } = dimensions();
  const listOrigin = dragBounds?.listOrigin ?? listContentTop();
  const top = listOrigin + index * (height + gap);
  const edge = matchMedia('(max-width: 1000px)').matches ? 216 : 266;
  const position = scrollPosition();
  const target = Math.max(0, Math.min(top - edge, position.scrollHeight - position.height));
  letterNavigation = { letter, top: target, until: performance.now() + 800 };
  scrollPlaylist(target);
  // Materialize/reconcile the destination now, without waiting for a Safari
  // scroll event or animation frame during the active touch gesture.
  render(); markLetter(letter); showPreview(letter);
}
// Touch Events own phone gestures; Pointer Events are only used for mouse/pen
// or browsers without Touch Events. Never let both streams drive one gesture.
const nativeTouch = 'ontouchstart' in window;
let touchId = null;
let pendingLetter = '';
let navigationFrame = 0;
let committedLetter = '';
function letterAtPoint(point) {
  const rect = dragBounds || alphabetNav.getBoundingClientRect();
  // Both coordinates use the same viewport. Never combine screen/page deltas
  // with client coordinates: programmatic scrolling can magnify those deltas.
  const y = point.clientY;
  if (!Number.isFinite(y) || y <= 0 || y > innerHeight) return null;
  const row = rect.height / alphabet.length;
  const index = Math.max(0, Math.min(alphabet.length - 1, Math.floor((y - rect.top) / row)));
  const previous = alphabet.indexOf(draggedLetter);
  // A small deadband prevents one-pixel finger jitter at a letter boundary.
  const slop = Math.min(2, row * .15);
  if (previous >= 0 && index > previous && y < rect.top + (previous + 1) * row + slop) return draggedLetter;
  if (previous >= 0 && index < previous && y > rect.top + previous * row - slop) return draggedLetter;
  return alphabet[index];
}
function flushNavigation() {
  cancelAnimationFrame(navigationFrame); navigationFrame = 0;
  const letter = pendingLetter; pendingLetter = '';
  if (letter && letter !== committedLetter) {
    committedLetter = letter; jumpToLetter(letter);
  }
}
function dragToPoint(point) {
  const letter = letterAtPoint(point);
  if (!letter || letter === draggedLetter || alphabetButtons.get(letter).disabled) return;
  draggedLetter = letter;
  // Feedback follows the finger immediately; scroll at most once per frame,
  // using only the latest sample. Intermediate jumps must not queue up.
  markLetter(letter); showPreview(letter); pendingLetter = letter;
  if (!navigationFrame) navigationFrame = requestAnimationFrame(flushNavigation);
}
function beginDrag(point, owner) {
  lastPointerTime = performance.now();
  cancelAnimationFrame(searchScrollFrame);
  const rect = alphabetNav.getBoundingClientRect();
  dragBounds = {
    top: rect.top, height: rect.height,
    listOrigin: listContentTop(),
  };
  for (const key of ['left', 'top', 'width', 'height']) alphabetNav.style.setProperty(`--drag-${key}`, `${rect[key]}px`);
  alphabetNav.classList.add('is-dragging');
  draggingPointer = owner; draggedLetter = ''; committedLetter = '';
  if (document.activeElement === searchInput) searchInput.blur();
  dragToPoint(point);
}
function finishDrag(event) {
  if (draggingPointer === null || (event && event.pointerId !== draggingPointer)) return;
  // Commit the last move, not a potentially stale/missing coordinate on release.
  flushNavigation(); lastPointerTime = performance.now();
  if (letterNavigation && Math.abs(scrollPosition().top - letterNavigation.top) < 2) letterNavigation = null;
  const pointer = draggingPointer;
  draggingPointer = null; touchId = null; draggedLetter = ''; dragBounds = null;
  alphabetNav.classList.remove('is-dragging');
  for (const key of ['left', 'top', 'width', 'height']) alphabetNav.style.removeProperty(`--drag-${key}`);
  if (typeof pointer === 'number' && alphabetNav.hasPointerCapture(pointer)) alphabetNav.releasePointerCapture(pointer);
  hidePreview();
}
alphabetNav.addEventListener('touchstart', event => {
  if (draggingPointer !== null || event.touches.length !== 1) return;
  if (event.cancelable) event.preventDefault();
  const touch = event.changedTouches[0];
  touchId = touch.identifier;
  beginDrag(touch, `touch:${touchId}`);
}, { passive: false });
alphabetNav.addEventListener('touchmove', event => {
  if (touchId === null) return;
  if (event.cancelable) event.preventDefault();
  const touch = [...event.changedTouches].find(t => t.identifier === touchId);
  if (touch) dragToPoint(touch);
}, { passive: false });
for (const type of ['touchend', 'touchcancel']) alphabetNav.addEventListener(type, event => {
  if (touchId === null || ![...event.changedTouches].some(t => t.identifier === touchId)) return;
  if (event.cancelable) event.preventDefault();
  finishDrag();
}, { passive: false });
alphabetNav.addEventListener('pointerdown', event => {
  if (nativeTouch && event.pointerType === 'touch') return;
  if (event.button !== 0 || event.isPrimary === false || draggingPointer !== null) return;
  event.preventDefault();
  beginDrag(event, event.pointerId);
  alphabetNav.setPointerCapture(event.pointerId);
});
alphabetNav.addEventListener('pointermove', event => {
  if (event.pointerId !== draggingPointer) return;
  event.preventDefault(); dragToPoint(event);
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) alphabetNav.addEventListener(event, finishDrag);
addEventListener('blur', () => finishDrag());
addEventListener('pagehide', () => finishDrag());
// Ordinary scrolling takes ownership back immediately.
addEventListener('wheel', () => { letterNavigation = null; }, { passive: true });
addEventListener('touchstart', event => {
  if (!alphabetNav.contains(event.target)) letterNavigation = null;
}, { passive: true });
addEventListener('keydown', event => {
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key) && !alphabetNav.contains(event.target)) letterNavigation = null;
});
alphabetNav.addEventListener('keydown', event => {
  const button = event.target.closest('button[data-letter]');
  if (button && !button.disabled && ['Enter', ' '].includes(event.key)) {
    event.preventDefault(); jumpToLetter(button.dataset.letter); hidePreview();
  }
});
alphabetNav.addEventListener('click', event => {
  // 鼠标和触摸已由 pointerdown 处理；detail=0 是键盘触发。
  // WebKit may emit a compatibility click after the touch, including detail=0.
  if (event.detail !== 0 || performance.now() - lastPointerTime < 800) return;
  const button = event.target.closest('button[data-letter]');
  if (button && !button.disabled) { jumpToLetter(button.dataset.letter); hidePreview(); }
});
render();

qualityControl.addEventListener('change', () => {
  audioQuality = qualityControl.value;
  preferences.update({quality: audioQuality});
  if (activeIndex < 0) return;
  if (!flowLayout.matches) {
    if (['playing','preparing','spinningUp','movingArm','loweringStylus','loading'].includes(desktopState)) selectDesktopSong(songs[activeIndex]);
  } else {
    const audio = cards.get(activeIndex)?.querySelector('audio');
    if (!audio) return;
    const playing = !audio.paused;
    audio.src = audioPath(songs[activeIndex]); audio.load();
    if (playing) audio.play().catch(() => {});
  }
});

// Restore a selected track without requesting autoplay permission or loading
// audio bytes. The next play gesture resumes the saved position and repeat mode.
function restoreSavedSelection() {
  const saved = preferences.get();
  const index = songs.findIndex(song => song.file === saved.file);
  if (index < 0) return;
  activeIndex = index; searchIndex = index;
  if (flowLayout.matches) { render(); cards.get(index)?.restorePlayer(); }
  else selectDesktopSong(songs[index], {restore: true});
  if (flowLayout.matches) requestAnimationFrame(() => {
    const target = cards.get(index);
    if (!target) return;
    const top = listContentTop() + target.offsetTop - (scrollPosition().height - target.offsetHeight) / 2;
    scrollPlaylist(Math.max(0, top));
  });
}
function applyStoredPreferences() {
  const saved = preferences.get();
  mobileRepeat = saved.repeatOne;
  audioQuality = saved.quality; qualityControl.value = audioQuality;
  if (sortMode !== saved.sort) sortPlaylist(saved.sort, false);
  searchInput.value = saved.query;
  if (activeIndex < 0) restoreSavedSelection();
}
const consentPanel = document.querySelector('#playlist-storage-consent');
consentPanel.hidden = preferences.hasConsent();
document.querySelector('#allow-playlist-storage').addEventListener('click', () => {
  if (activeIndex >= 0) flushPreferences();
  preferences.allowStorage();
  consentPanel.hidden = true;
  applyStoredPreferences();
});
document.querySelector('#dismiss-playlist-storage').addEventListener('click', () => {
  // Dismiss for this visit only. Never write a refusal or infer permission.
  consentPanel.hidden = true;
});
addEventListener('pageshow', event => {
  if (event.persisted && !preferences.hasConsent()) consentPanel.hidden = false;
});
applyStoredPreferences();
