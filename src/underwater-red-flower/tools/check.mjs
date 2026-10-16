import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {strict as assert} from 'node:assert';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFile(resolve(root,path),'utf8');
const original=await read('reference/original-flower.frag.glsl');
const integrated=(await read('shaders/flower.frag.glsl'))
  .replace('\n    uniform vec2 u_captureOffset;','')
  .replace(' + u_captureOffset;',';')
  .replace('outColor = vec4(finalColor, max(petalMask, stemAlpha));','outColor = vec4(finalColor, 1.0);');
assert.equal(integrated,original,'Native flower shader changed outside its three integration hooks.');
const stem=original.slice(original.indexOf('    // Exact centerline X'),original.indexOf('    void main()'));
assert.equal(await read('shaders/stem.glsl'),stem,'Original procedural stem was changed.');
const html=await read('index.html'),source=await read('reference/original-flower.html');
for(const match of source.matchAll(/<(?:input|button)[^>]*\bid="([^"]+)"/g))assert(html.includes(`id="${match[1]}"`),`Lost native control ${match[1]}`);
for(const match of source.matchAll(/data-preset="([^"]+)"/g))assert(html.includes(`data-preset="${match[1]}"`));
for(const match of source.matchAll(/data-flower-color="([^"]+)"/g))assert(html.includes(`data-flower-color="${match[1]}"`));
const hash=data=>createHash('sha256').update(data).digest('hex');
for(const [file,key] of [['flower-atlas.webp','ATLAS_B64'],['flower-detail.webp','CAUSTIC_ATLAS_B64']]){
  const data=source.match(new RegExp(`const ${key} = "data:image/webp;base64,([^"]+)"`))[1];
  assert.equal(hash(await readFile(resolve(root,'assets',file))),hash(Buffer.from(data,'base64')),`Atlas changed: ${file}`);
}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(ids.length,new Set(ids).size,'Duplicate HTML IDs');
assert(!/<(?:script|link)[^>]+(?:src|href)="https?:/i.test(html),'External runtime dependency found');
for(const name of ['gpu','water','flower','scene','ui','app'])new vm.Script(await read(`src/${name}.js`),{filename:`src/${name}.js`});
const script=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
new vm.Script(script,{filename:'index.html inline bundle'});
assert((await read('licenses/threejs-caustics-BSD-3-Clause.txt')).includes('Copyright (c) 2020 Martin Renou'));
console.log('PASS: native shader integration hooks, exact stem, both atlas hashes, all native controls/presets/colors, unique IDs, offline bundle, JavaScript syntax and license.');
