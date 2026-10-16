// 首页三：水中花源码生成单文件，再同步到既有嵌入地址。
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
execFileSync(process.execPath, [fileURLToPath(new URL('src/underwater-red-flower/tools/build.mjs', root))], { stdio: 'inherit' });
const source = new URL('src/underwater-red-flower/index.html', root);
const output = new URL('visibleproductsshow/silver-blossom/index.html', root);
const expected = await readFile(source);
if (process.argv.includes('--check')) {
  if (!(await readFile(output)).equals(expected)) throw new Error('水中花发布文件未同步。');
  console.log('水中花源码与发布文件已同步。');
} else {
  await mkdir(new URL('./', output), { recursive: true });
  await writeFile(output, expected);
  console.log('已生成首页三水中花。');
}
