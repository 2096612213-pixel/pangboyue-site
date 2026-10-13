import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const parts = [
  'document-head.html',
  'header.html',
  'hero.html',
  'agent-chat.html',
  'archive-cards.html',
  'footer.html',
];
const htmlTemplate = (await Promise.all(parts.map(name =>
  readFile(join(root, 'src', 'home', name), 'utf8')))).join('');
const scripts = [
  'overscroll.js',
  'dropdowns.js',
  'lazy-images.js',
  'route-prefetch.js',
  'clock.js',
  'home-scenes.js',
];
const javascript = (await Promise.all(scripts.map(name =>
  readFile(join(root, 'src', 'home', 'scripts', name), 'utf8')))).join('');
const fingerprint = content => createHash('sha256').update(content).digest('hex').slice(0, 12);
const versions = {
  __AGENT_BACKDROP_HASH__: fingerprint(await readFile(join(root, 'assets', 'agent-chat', 'backdrop.js'))),
  __AGENT_CSS_HASH__: fingerprint(await readFile(join(root, 'assets', 'agent-chat', 'chat.css'))),
  __AGENT_JS_HASH__: fingerprint(await readFile(join(root, 'assets', 'agent-chat', 'chat.js'))),
  __AGENT_ICON_HASH__: fingerprint(await readFile(join(root, 'assets', 'agent-chat', 'psi.svg'))),
  __SCENE_CSS_HASH__: fingerprint(await readFile(join(root, 'assets', 'home-scenes.css'))),
  __FLUID_JS_HASH__: fingerprint(await readFile(join(root, 'assets', 'fluid-tank.js'))),
  __HOME_CSS_HASH__: fingerprint(await readFile(join(root, 'assets', 'home.css'))),
  __FLUID_CSS_HASH__: fingerprint(await readFile(join(root, 'assets', 'fluid-tank.css'))),
  __LANDSCAPE_SVG_HASH__: fingerprint(await readFile(join(root, 'images', 'changsha-xiangjiang-reflections-corrected-v2.svg'))),
  __HOME_JS_HASH__: fingerprint(javascript),
};
const html = Object.entries(versions).reduce(
  (page, [token, hash]) => page.replaceAll(token, hash),
  htmlTemplate,
);
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
