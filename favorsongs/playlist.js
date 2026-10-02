// The song list is tiny; give it a fresh URL so Safari never keeps an old list.
const { songs } = await import(`./songs.js?v=${Date.now()}`);

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
  audio.addEventListener('ended', () => {
    if (activeIndex === index) activeIndex = -1;
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
    card.style.top = `${index * stride}px`;
    card.classList.toggle("search-match", index === searchIndex);
  }
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
