import { mkdir, readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = new URL('src/silver-blossom/index.html', root);
const output = new URL('visibleproductsshow/silver-blossom/index.html', root);
const expected = await readFile(source);
if (process.argv.includes('--check')) {
  if (!(await readFile(output)).equals(expected)) throw new Error('银花工作室发布文件未同步。');
  console.log('银花工作室源码与发布文件已同步。');
} else {
  await mkdir(new URL('./', output), { recursive: true });
  await writeFile(output, expected);
  console.log('已生成 visibleproductsshow/silver-blossom/index.html');
}
