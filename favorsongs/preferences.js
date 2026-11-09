// Browser-local listening preferences; invalid/old data never blocks the page.
export const PLAYLIST_PREFERENCES_KEY = 'favorite-playlist-config-v1';
export const PLAYLIST_CONSENT_KEY = 'favorite-playlist-storage-consent-v1';
export function createPlaylistPreferences(files, storage) {
  const available = new Set(files);
  function validate(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
    const file = available.has(value.file) ? value.file : null;
    return {
      version: 1,
      file,
      repeatOne: value.repeatOne === true,
      shuffle: value.shuffle === true,
      position: file && Number.isFinite(value.position) && value.position >= 0 ? Math.min(value.position, 86400) : 0,
      quality: value.quality === 'original' ? 'original' : 'smooth',
      sort: value.sort === 'pinyin' ? 'pinyin' : 'added',
      query: typeof value.query === 'string' ? value.query.slice(0, 200) : '',
    };
  }
  let consented = false;
  try { consented = storage?.getItem(PLAYLIST_CONSENT_KEY) === 'allowed'; } catch {}
  function readSaved() {
    try {
      const saved = storage?.getItem(PLAYLIST_PREFERENCES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.version === 1) return validate(parsed);
      } else return validate({quality: storage?.getItem('favorite-audio-quality')});
    } catch { /* Disabled storage or an invalid old record must not block use. */ }
    return validate();
  }
  let current = consented ? readSaved() : validate();
  let pending = {};
  function persist() {
    if (!consented) return;
    try { storage?.setItem(PLAYLIST_PREFERENCES_KEY, JSON.stringify(current)); } catch {}
  }
  return {
    get: () => ({...current}),
    hasConsent: () => consented,
    allowStorage() {
      if (!consented) {
        // Only this explicit action may read earlier settings and enable writes.
        // Choices made before accepting remain the current session's choices.
        const base = current.file ? current : readSaved();
        current = validate({...base, ...pending});
        pending = {}; consented = true;
        try { storage?.setItem(PLAYLIST_CONSENT_KEY, 'allowed'); } catch {}
        persist();
      }
      return {...current};
    },
    update(patch) {
      current = validate({...current, ...patch});
      if (!consented) pending = {...pending, ...patch};
      persist();
      return {...current};
    },
  };
}
