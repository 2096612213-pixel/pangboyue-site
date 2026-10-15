import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const source = new URL('src/abstract-wave/', root);
const output = new URL('visibleproductsshow/abstract-wave/', root);
const hash = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 12);
const files = ['styles.css', 'scene.js', 'interface.js', 'harmonic-fields.webp'];
const contents = new Map(await Promise.all(files.map(async name => [name, await readFile(new URL(name, source))])));
const scene = contents.get('scene.js').toString().replace('"harmonic-fields.webp"', `"harmonic-fields.webp?v=${hash(contents.get('harmonic-fields.webp'))}"`);
contents.set('scene.js', Buffer.from(scene));
let html = await readFile(new URL('index.html', source), 'utf8');
for (const [token, name] of [['STYLE', 'styles.css'], ['SCENE', 'scene.js'], ['INTERFACE', 'interface.js']]) html = html.replaceAll(`__${token}_HASH__`, hash(contents.get(name)));
contents.set('index.html', Buffer.from(html));
if (process.argv.includes('--check')) {
  for (const [name, expected] of contents) {
    const actual = await readFile(new URL(name, output));
    if (!actual.equals(expected)) throw new Error(`发布文件未同步：${name}`);
  }
  console.log('抽象动画源码和发布文件已同步。');
} else {
  await mkdir(output, { recursive: true });
  for (const [name, bytes] of contents) await writeFile(new URL(name, output), bytes);
  console.log(`已生成 ${fileURLToPath(output)}`);
}
