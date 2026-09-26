import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const id = process.argv[2];
const match = /^(\d{4})-W(\d{2})$/.exec(id ?? '');

if (!match) {
  console.error('用法：node thoughts/new-week.mjs 2026-W40');
  process.exit(1);
}

const year = Number(match[1]);
const week = Number(match[2]);
const mondayOfWeekOne = value => {
  const januaryFourth = new Date(Date.UTC(value, 0, 4));
  const weekday = (januaryFourth.getUTCDay() + 6) % 7;
  januaryFourth.setUTCDate(januaryFourth.getUTCDate() - weekday);
  return januaryFourth;
};
const firstMonday = mondayOfWeekOne(year);
const weeksInYear = (mondayOfWeekOne(year + 1) - firstMonday) / (7 * 86400000);

if (week < 1 || week > weeksInYear) {
  console.error(`${year} 年没有第 ${week} 周。`);
  process.exit(1);
}

const indexPath = join(root, 'weeks.json');
let entries;
try {
  entries = JSON.parse(readFileSync(indexPath, 'utf8'));
  if (!Array.isArray(entries)) throw new Error('目录必须是一个列表');
} catch (error) {
  console.error(`无法读取 weeks.json：${error.message}`);
  process.exit(1);
}

if (entries.some(entry => entry.week === id)) {
  console.error(`${id} 已在目录中，请直接编辑对应的 thoughts.md。`);
  process.exit(1);
}

const start = new Date(firstMonday);
start.setUTCDate(start.getUTCDate() + (week - 1) * 7);
const end = new Date(start);
end.setUTCDate(end.getUTCDate() + 6);
const day = value => `${value.getUTCMonth() + 1} 月 ${value.getUTCDate()} 日`;
const endDate = end.getUTCFullYear() === start.getUTCFullYear()
  ? day(end)
  : `${end.getUTCFullYear()} 年 ${day(end)}`;
const markdownPath = join(root, id, 'thoughts.md');

mkdirSync(dirname(markdownPath), { recursive: true });
if (!existsSync(markdownPath)) {
  writeFileSync(markdownPath, `# ${year} 年第 ${week} 周\n\n## ${start.toISOString().slice(0, 10)}\n\n`);
}

entries.push({
  week: id,
  title: `${year} 年第 ${week} 周`,
  dateRange: `${start.getUTCFullYear()} 年 ${day(start)}—${endDate}`,
  file: `${id}/thoughts.md`,
});
entries.sort((a, b) => b.week.localeCompare(a.week));
writeFileSync(indexPath, `${JSON.stringify(entries, null, 2)}\n`);

console.log(`已创建 ${id}/thoughts.md，并更新 weeks.json。现在可以打开 Markdown 文件写作。`);
