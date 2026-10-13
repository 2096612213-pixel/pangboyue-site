import { execFileSync } from 'node:child_process';
import { cpSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src/book');
const output = path.join(source, 'dist');
const destination = path.join(root, 'sample');
execFileSync(process.execPath, [path.join(source, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: source, stdio: 'inherit' });
function files(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.DS_Store') return [];
    const rel = path.join(prefix, entry.name);
    return entry.isDirectory() ? files(path.join(directory, entry.name), rel) : [rel];
  }).sort();
}
if (process.argv.includes('--check')) {
  const expected = files(output), actual = files(destination);
  if (JSON.stringify(expected) !== JSON.stringify(actual) || expected.some(rel => !readFileSync(path.join(output, rel)).equals(readFileSync(path.join(destination, rel)))))
    throw new Error('电子书发布文件与源码不一致，请运行 node scripts/build-book.mjs');
  console.log('电子书发布文件与源码一致。');
} else {
  // 只替换本项目生成目录，清除之前构建遗留的旧哈希文件。
  rmSync(destination, { recursive: true, force: true });
  cpSync(output, destination, { recursive: true });
  console.log('电子书已构建并同步到 sample/。');
}
