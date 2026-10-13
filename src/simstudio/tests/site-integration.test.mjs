import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, stat } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { translations } from '../app/i18n.ts';
import { paletteParts } from '../app/palette.ts';
import { displayPartName } from '../app/part-names.zh.ts';
import { GET } from '../app/api/parts/route.ts';
const publicRoot = new URL('../public/', import.meta.url);
const keys = value => Object.entries(value).flatMap(([k,v]) => typeof v === 'object' ? keys(v).map(x => k+'.'+x) : [k]).sort();
test('Chinese covers the complete original translation schema', () => {
  assert.deepEqual(keys(translations['zh-CN']), keys(translations.en));
  assert.deepEqual(keys(translations['zh-CN']), keys(translations.es));
});
test('all default parts have Chinese display names without changing model identities', () => {
  for (const part of paletteParts) {
    assert.match(displayPartName(part.name, 'zh-CN'), /[\u3400-\u9fff]/);
    assert.equal(displayPartName(part.name, 'en'), part.name);
    assert.equal(displayPartName(part.name, 'es'), part.name);
  }
});
test('every packaged palette model and thumbnail exists under the subdirectory', async () => {
  for (const part of paletteParts) {
    for (const asset of [part.geometry, part.paletteHidden ? undefined : part.thumb].filter(Boolean)) {
      assert.ok(!asset.startsWith('/'), asset);
      if (asset.startsWith('https:')) continue;
      const info = await stat(new URL(asset, publicRoot));
      assert.ok(info.size < 25 * 1024 * 1024, asset);
    }
  }
});
test('compressed large baseplate preserves every original byte', async () => {
  const bytes = gunzipSync(await readFile(new URL('catalog/geometry/39369-71.json.gz',publicRoot)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'd239b4b2270876ef96a7f8db56177a40ab93ce69d83f72d89eb7ecb9770bb4eb');
  assert.ok(JSON.parse(bytes.toString()).geometries.length > 0);
});
test('external catalog route retains its JSON response contract', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('<html></html>');
    const response = await GET(new Request('https://example.test/api/parts?q=32524'));
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(), {items:[],query:'32524'});
  } finally { globalThis.fetch = originalFetch; }
});
