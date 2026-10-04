import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'simstudio-src');
const publicRoot = path.join(source, 'public');
// 目录再生成后仍保持这个大底板的无损压缩格式。
const baseplate = path.join(publicRoot, 'catalog/geometry/39369-71.json');
if (existsSync(baseplate)) {
  writeFileSync(baseplate + '.gz', gzipSync(readFileSync(baseplate), { level: 9 }));
  rmSync(baseplate);
  const manifest = path.join(publicRoot, 'catalog/manifest.json');
  writeFileSync(manifest, readFileSync(manifest, 'utf8').replaceAll('39369-71.json"', '39369-71.json.gz"'));
}
function files(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const rel = path.join(prefix, entry.name);
    return entry.isDirectory() ? files(path.join(dir, entry.name), rel) : [rel];
  }).sort();
}
for (const rel of files(publicRoot)) {
  if (statSync(path.join(publicRoot, rel)).size >= 25 * 1024 * 1024)
    throw new Error('资源超过 25 MiB 托管限制：' + rel);
}
execFileSync(process.execPath, [path.join(source, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'vite.pages.config.ts'], { cwd: source, stdio: 'inherit' });
const output = path.join(source, 'pages-dist');
const destination = path.join(root, '有趣的小玩具展示/lego');
if (process.argv.includes('--check')) {
  const expected = files(output), actual = files(destination);
  if (JSON.stringify(expected) !== JSON.stringify(actual) || expected.some(rel => !readFileSync(path.join(output, rel)).equals(readFileSync(path.join(destination, rel)))))
    throw new Error('部署文件与源码构建不一致，请运行 node scripts/build-simstudio.mjs');
  console.log('乐高部署文件与源码构建完全一致。');
} else {
  // 仅替换该项目自己的构建产物，保留源码及网站其他内容。
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  cpSync(output, destination, { recursive: true });
  console.log('乐高项目已构建并同步到：' + destination);
}
