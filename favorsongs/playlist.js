// The song list is tiny; give it a fresh URL so Safari never keeps an old list.
const { songs: addedSongs } = await import(`./songs.js?v=${Date.now()}`);
let songs = [...addedSongs];
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
const alphabetButtons = new Map();
function markLetter(letter) {
  for (const [key, button] of alphabetButtons) button.setAttribute('aria-pressed', String(key === letter));
}
function syncAlphabet(listTop, stride) {
  if (!alphabetNav) return;
  const edge = matchMedia('(max-width: 1000px)').matches ? 176 : 24;
  const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
  const first = atBottom ? songs.length - 1 : Math.max(0, Math.min(songs.length - 1, Math.floor((edge - listTop + 1) / stride)));
  markLetter(sortMode === 'pinyin' ? initials.get(songs[first]?.file) : '');
}


const list = document.querySelector('#songs');
const cards = new Map();
let activeIndex = -1;
let scheduled = false;
let searchIndex = -1;
let previousQuery = "";
let matchCursor = -1;

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
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.preload = 'none';
  audio.hidden = true;
  audio.setAttribute('aria-label', song.title);

  // Audio stays source-free until this song's play button is pressed.
  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'load-play';
  playButton.setAttribute('aria-label', `播放 ${song.title}`);
  playButton.innerHTML = '<span class="play-triangle">▶</span><span class="play-time">0:00 / 0:00</span><span class="play-progress"></span><span class="play-volume">◖</span><span class="play-more">⋮</span>';
  async function startSong() {
    if (audio.src) return;
    const index = songs.indexOf(song);
    if (activeIndex !== -1 && activeIndex !== index) {
      cards.get(activeIndex)?.querySelector('audio')?.pause();
    }
    activeIndex = index;
    audio.src = song.file;
    audio.hidden = false;
    playButton.remove();
    render();
    try {
      await audio.play();
    } catch {
      // Native controls remain available if autoplay is blocked or a file fails.
    }
  }
  playButton.addEventListener('pointerdown', startSong);
  playButton.addEventListener('click', startSong);
  audio.addEventListener('play', () => {
    for (const card of cards.values()) {
      const other = card.querySelector('audio');
      if (other !== audio) other.pause();
    }
    activeIndex = songs.indexOf(song);
    scheduleRender();
  });
  audio.addEventListener('ended', () => {
    if (activeIndex === songs.indexOf(song)) activeIndex = -1;
    scheduleRender();
  });

  player.append(audio, playButton);
  card.append(name, player);
  return card;
}

function render() {
  const { height, gap } = dimensions();
  const stride = height + gap;
  list.style.height = `${songs.length * stride - gap}px`;

  const listTop = list.getBoundingClientRect().top;
  const start = Math.max(0, Math.floor(-listTop / stride) - 2);
  const end = Math.min(songs.length, Math.max(0, Math.ceil((innerHeight - listTop) / stride) + 2));
  const wanted = new Set();
  for (let index = start; index < end; index++) wanted.add(index);
  if (activeIndex !== -1) wanted.add(activeIndex);
  if (searchIndex !== -1) wanted.add(searchIndex);

  for (const [index, card] of cards) {
    if (!wanted.has(index)) {
      card.remove();
      cards.delete(index);
    }
  }
  for (const index of wanted) {
    let card = cards.get(index);
    if (!card) {
      card = makeCard(songs[index], index);
      cards.set(index, card);
      list.append(card);
    }
    card.setAttribute('aria-posinset', String(index + 1));
    card.style.top = `${index * stride}px`;
    card.classList.toggle("search-match", index === searchIndex);
  }
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
addEventListener('resize', scheduleRender);
render();

// Search navigates the virtual list without loading, starting, or pausing audio.
const searchForm = document.querySelector('#song-search');
const searchInput = document.querySelector('#song-query');
const searchStatus = document.querySelector('#search-status');
const normalizeSearch = value => value.normalize('NFKC').toLocaleLowerCase().trim().replace(/\s+/g, ' ');
let composing = false;
searchInput.addEventListener('compositionstart', () => { composing = true; });
searchInput.addEventListener('compositionend', () => { composing = false; });
searchInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.isComposing || composing || event.keyCode === 229)) event.preventDefault();
});
searchInput.addEventListener('input', () => {
  previousQuery = ''; matchCursor = -1; searchIndex = -1;
  searchStatus.textContent = '搜索只定位歌曲，点击播放按钮开始听。';
  render();
});
searchForm.addEventListener('submit', event => {
  event.preventDefault();
  if (composing) return;
  const query = normalizeSearch(searchInput.value);
  if (!query) {
    searchStatus.textContent = '请输入歌名或歌手。';
    searchInput.focus();
    return;
  }
  const terms = query.split(' ');
  const matches = songs.map((song, index) => ({ title: normalizeSearch(song.title), index }))
    .filter(song => terms.every(term => song.title.includes(term)));
  if (!matches.length) {
    searchIndex = -1; previousQuery = ''; matchCursor = -1;
    searchStatus.textContent = `没有找到“${searchInput.value.trim()}”，试试部分歌名或歌手名。`;
    render();
    return;
  }
  matchCursor = query === previousQuery ? (matchCursor + 1) % matches.length : 0;
  previousQuery = query;
  searchIndex = matches[matchCursor].index;
  searchStatus.textContent = `已定位：${songs[searchIndex].title}` +
    (matches.length > 1 ? `（${matchCursor + 1}/${matches.length}，回到搜索框再次按 Enter 定位下一首）` : '');
  render(); // Materialize even a far-off card before scrolling to it.
  const card = cards.get(searchIndex);
  card.focus({ preventScroll: true });
  requestAnimationFrame(() => {
    card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
  });
});


function sortPlaylist(mode, resetScroll = true) {
  sortMode = mode;
  const activeFile = songs[activeIndex]?.file;
  const matchedFile = songs[searchIndex]?.file;
  const retained = new Map([...cards.values()].map(card => [card.dataset.file, card]));
  songs = [...addedSongs];
  if (mode === 'pinyin') {
    songs.sort((a, b) => groupOrder(a) - groupOrder(b) || pinyinCollator.compare(songName(a), songName(b))
      || pinyinCollator.compare(a.title, b.title)
      || additionOrder.get(a.file) - additionOrder.get(b.file));
  }
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
  if (resetScroll) window.scrollTo({ top: 0, behavior: 'instant' });
}
document.querySelector('#sort-pinyin').addEventListener('click', () => sortPlaylist('pinyin'));
document.querySelector('#sort-added').addEventListener('click', () => sortPlaylist('added'));


// 微信式索引：点选、连续拖动与键盘定位都不触发音频加载。
alphabetNav = document.querySelector('#song-alphabet');
const preview = alphabetNav.querySelector('.alphabet-preview');
let previewTimer = 0;
let draggingPointer = null;
let draggedLetter = '';
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
  if (alphabetButtons.get(letter)?.disabled) return;
  if (sortMode !== 'pinyin') sortPlaylist('pinyin', false);
  const index = songs.findIndex(song => initials.get(song.file) === letter);
  if (index < 0) return;
  searchIndex = index; previousQuery = ''; matchCursor = -1;
  searchStatus.textContent = `已定位 ${letter}：${songs[index].title}`;
  render();
  const top = cards.get(index).getBoundingClientRect().top + scrollY;
  const edge = matchMedia('(max-width: 1000px)').matches ? 176 : 24;
  window.scrollTo({ top: Math.max(0, top - edge), behavior: 'instant' });
  markLetter(letter); scheduleRender(); showPreview(letter);
}
function letterAtPointer(event) {
  const rect = alphabetNav.getBoundingClientRect();
  const index = Math.max(0, Math.min(alphabet.length - 1, Math.floor((event.clientY - rect.top) / (rect.height / alphabet.length))));
  return alphabet[index];
}
function dragToLetter(event) {
  const letter = letterAtPointer(event);
  if (letter === draggedLetter || alphabetButtons.get(letter).disabled) return;
  draggedLetter = letter; jumpToLetter(letter);
}
alphabetNav.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  event.preventDefault(); draggingPointer = event.pointerId; draggedLetter = '';
  alphabetNav.setPointerCapture(event.pointerId); dragToLetter(event);
});
alphabetNav.addEventListener('pointermove', event => {
  if (event.pointerId === draggingPointer) dragToLetter(event);
});
function finishDrag() {
  if (draggingPointer === null) return;
  const pointer = draggingPointer; draggingPointer = null; draggedLetter = '';
  if (alphabetNav.hasPointerCapture(pointer)) alphabetNav.releasePointerCapture(pointer);
  hidePreview();
}
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) alphabetNav.addEventListener(event, finishDrag);
alphabetNav.addEventListener('click', event => {
  // 鼠标和触摸已由 pointerdown 处理；detail=0 是键盘触发。
  if (event.detail !== 0) return;
  const button = event.target.closest('button[data-letter]');
  if (button && !button.disabled) { jumpToLetter(button.dataset.letter); hidePreview(); }
});
render();
