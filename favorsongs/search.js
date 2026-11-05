// Shared by the browser and build-time indexer. No audio or DOM side effects.
export function normalizeSearch(value) {
  return String(value).normalize('NFKC').normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');
}
const compactSearch = value => normalizeSearch(value).replace(/[^\p{L}\p{N}]/gu, '');
const containsHan = value => /\p{Script=Han}/u.test(value);

export function prepareSongSearch(song, dictionary = {}) {
  const [name, ...rest] = song.title.split('—');
  const artist = rest.join('—').trim();
  const mainName = name.replace(/\([^)]*\)|（[^）]*）|\[[^\]]*\]/g, ' ').trim();
  const values = [name, mainName, artist, ...artist.split(/[、,，&]/u)];
  const fields = [];
  const seen = new Set();
  for (const value of values) {
    const text = normalizeSearch(value);
    const literal = compactSearch(text);
    if (!literal || seen.has(literal)) continue;
    seen.add(literal);
    const words = text.match(/[\p{L}\p{N}]+/gu) || [];
    const pinyinWords = Array.from(value.normalize('NFKC'), char => dictionary[char] ? ` ${dictionary[char]} ` : char).join('');
    fields.push({literal, words, pinyin: compactSearch(pinyinWords),
      syllables: normalizeSearch(pinyinWords).match(/[\p{L}\p{N}]+/gu) || []});
  }
  return {fields};
}

// Optimal-string-alignment distance (Damerau-Levenshtein with adjacent swaps).
// Free leading/trailing text gives the best local match inside a longer title.
export function substringDistance(query, candidate) {
  let previousPrevious;
  let previous = new Uint16Array(candidate.length + 1);
  for (let i = 1; i <= query.length; i++) {
    const row = new Uint16Array(candidate.length + 1);
    row[0] = i;
    for (let j = 1; j <= candidate.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1,
        previous[j - 1] + (query[i - 1] === candidate[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && query[i - 1] === candidate[j - 2] && query[i - 2] === candidate[j - 1]) {
        row[j] = Math.min(row[j], previousPrevious[j - 2] + 1);
      }
    }
    previousPrevious = previous;
    previous = row;
  }
  return Math.min(...previous);
}

function bigramSimilarity(a, b) {
  if (a.length < 2 || b.length < 2) return 0;
  const grams = new Map();
  for (let i = 1; i < a.length; i++) {
    const gram = a.slice(i - 1, i + 1);
    grams.set(gram, (grams.get(gram) || 0) + 1);
  }
  let shared = 0;
  for (let i = 1; i < b.length; i++) {
    const gram = b.slice(i - 1, i + 1), count = grams.get(gram) || 0;
    if (count) { shared++; grams.set(gram, count - 1); }
  }
  return 2 * shared / (a.length + b.length - 2);
}

function similarity(query, candidate, approximate = true) {
  if (!query || !candidate) return 0;
  if (candidate === query) return 1;
  const at = candidate.indexOf(query);
  if (at >= 0) return (at === 0 ? .95 : .88) + .04 * query.length / candidate.length;
  // Single letters and very short names must not expand into unrelated matches.
  const minimum = containsHan(query) ? 3 : 4;
  if (!approximate || query.length < minimum) return 0;
  const distance = substringDistance(query, candidate);
  const budget = Math.min(3, Math.floor(query.length * .34));
  if (distance > budget) return 0;
  const editScore = 1 - distance / query.length;
  // Editing is the gate; shared letter pairs only order equally plausible hits.
  return .67 + .13 * editScore + .03 * bigramSimilarity(query, candidate);
}

export function createSongSearch(songs, data) {
  const records = new Map(songs.map(song => {
    const saved = data?.[song.file];
    if (saved?.fields) return [song.file, saved];
    const record = prepareSongSearch(song);
    // Only pronunciation tokens travel in the bundle; display text and Latin
    // tokens are already present in the song manifest.
    if (Array.isArray(saved)) record.fields.forEach((field, index) => {
      field.syllables = saved[index] || field.syllables;
      field.pinyin = compactSearch(field.syllables.join(''));
    });
    return [song.file, record];
  }));
  const cache = new Map();
  return function search(value, dictionary = null) {
    const normalized = normalizeSearch(value);
    const raw = compactSearch(normalized);
    if (!raw || raw.length > 96) return [];
    const key = `${dictionary ? 'phonetic' : 'literal'}:${normalized}`;
    if (cache.has(key)) return cache.get(key);
    const transliterate = text => compactSearch(Array.from(text, char => dictionary?.[char] || char).join(''));
    const phonetic = containsHan(raw) && dictionary ? transliterate(raw) : raw;
    const tokens = (normalized.match(/[\p{L}\p{N}]+/gu) || []).map(raw => ({raw, phonetic: transliterate(raw)}));
    const results = [];
    for (const song of songs) {
      const {fields} = records.get(song.file);
      let score = 0;
      for (const field of fields) {
        score = Math.max(score, similarity(raw, field.literal));
        if (!containsHan(phonetic)) score = Math.max(score, similarity(phonetic, field.pinyin) * .97);
      }
      // Word order may differ, and song/artist may be typed together. Every
      // query token must match; one popular word cannot rescue unrelated text.
      if (tokens.length > 1 && tokens.length <= 12) {
        const tokenScores = tokens.map(token => {
          let best = 0;
          for (const field of fields) {
            for (const word of field.words) best = Math.max(best, similarity(token.raw, word));
            best = Math.max(best, similarity(token.raw, field.literal, false) * .96);
            if (!containsHan(token.phonetic)) {
              for (const word of field.syllables) best = Math.max(best, similarity(token.phonetic, word) * .97);
              best = Math.max(best, similarity(token.phonetic, field.pinyin, false) * .94);
            }
          }
          return best;
        });
        if (tokenScores.every(Boolean)) {
          const coverage = tokenScores.reduce((sum, value) => sum + value, 0) / tokenScores.length;
          score = Math.max(score, .93 * coverage);
        }
      }
      if (score > 0) results.push({file: song.file, score});
    }
    results.sort((a, b) => b.score - a.score); // Stable: playlist order breaks ties.
    // Once a convincing match exists, suppress distant guesses rather than
    // cycling through every loosely similar name in the library.
    const cutoff = Math.max(.74, (results[0]?.score || 0) - .12);
    const relevant = results.filter(result => result.score >= cutoff);
    if (cache.size >= 32) cache.delete(cache.keys().next().value);
    cache.set(key, relevant);
    return relevant;
  };
}
