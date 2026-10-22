import { readFile, writeFile, mkdir } from 'node:fs/promises';
const source = new URL('../src/fourier/index.html', import.meta.url);
const output = new URL('../visibleproductsshow/fourier/', import.meta.url);
const content = await readFile(source);
if (process.argv.includes('--check')) {
  const actual = await readFile(new URL('index.html', output));
  if (!actual.equals(content)) throw new Error('傅里叶实验室发布文件未同步');
  console.log('傅里叶实验室源码和发布文件已同步。');
} else {
  await mkdir(output, {recursive: true});
  await writeFile(new URL('index.html', output), content);
  console.log('已生成傅里叶实验室网站入口。');
}
