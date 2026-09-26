// Shared same-origin data access for the weekly journal pages.
let weeksRequest;

async function read(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}

export function getWeeks() {
  if (!weeksRequest) {
    weeksRequest = fetch(new URL('weeks.json', import.meta.url))
      .then(read)
      .then(response => response.json())
      .catch(error => { weeksRequest = undefined; throw error; });
  }
  return weeksRequest;
}

export async function getWeek(week) {
  const weeks = await getWeeks();
  const entry = weeks.find(item => item.week === week);
  if (!entry) throw new Error('找不到这周的日记');
  return entry;
}

export async function getWeekMarkdown(entry) {
  // The manifest is maintained locally, but keep paths inside thoughts/.
  if (!/^\d{4}-W\d{2}\/thoughts\.md$/.test(entry.file)) throw new Error('周记路径无效');
  const response = await read(await fetch(new URL(entry.file, import.meta.url)));
  return response.text();
}
