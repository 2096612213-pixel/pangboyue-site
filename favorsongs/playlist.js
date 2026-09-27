import { songs } from './songs.js?v=20260927-40';

const list = document.querySelector('#songs');
const cards = new Map();
let activeIndex = -1;
let scheduled = false;

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
