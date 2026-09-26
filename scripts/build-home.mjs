import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const parts = [
  'document-head.html',
  'header.html',
  'hero.html',
  'archive-cards.html',
  'footer.html',
];
const html = (await Promise.all(parts.map(name =>
  readFile(join(root, 'src', 'home', name), 'utf8')))).join('');
const scripts = [
  'overscroll.js',
  'dropdowns.js',
  'lazy-images.js',
  'route-prefetch.js',
  'clock.js',
];
const javascript = (await Promise.all(scripts.map(name =>
  readFile(join(root, 'src', 'home', 'scripts', name), 'utf8')))).join('');
const targets = [
  [join(root, 'index.html'), html],
  [join(root, 'assets', 'home.js'), javascript],
];

if (process.argv.includes('--check')) {
  const stale = [];
  for (const [path, expected] of targets) {
    if (await readFile(path, 'utf8') !== expected) stale.push(path);
  }
  if (stale.length) {
    console.error('构建文件与 src/home/ 不一致，请运行 node scripts/build-home.mjs');
    process.exitCode = 1;
  } else {
    console.log('首页 HTML 和交互脚本已同步。');
  }
} else {
  await Promise.all(targets.map(([path, content]) => writeFile(path, content)));
  console.log('已生成 index.html 和 assets/home.js');
}
