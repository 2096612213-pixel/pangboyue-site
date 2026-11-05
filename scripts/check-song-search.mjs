import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {songs} from '../favorsongs/songs.js';
import {prepareSongSearch, createSongSearch, substringDistance} from '../favorsongs/search.js';
const dictionary = JSON.parse(await readFile(new URL('./data/pinyin-han.json', import.meta.url), 'utf8'));
const data = Object.fromEntries(songs.map(song => [song.file, prepareSongSearch(song, dictionary)]));
const search = createSongSearch(songs, data);
const compactData = Object.fromEntries(Object.entries(data).map(([file,record]) => [file,record.fields.map(field => field.syllables)]));
const compactSearch = createSongSearch(songs, compactData);
for (const query of ['hongkong','qingge','张洁','qing ge liang jing ru']) assert.deepEqual(compactSearch(query,dictionary),search(query,dictionary));
const hongKong = songs.find(song => song.title.startsWith('Hong Kong')).file;
const qingGe = songs.find(song => song.title === '情歌 — 梁静茹').file;
const zhangJie = songs.find(song => song.title.endsWith('— 张杰')).file;
for (const query of ['hongkong', 'Hong Kong', 'ＨｏｎｇＫｏｎｇ', 'hong-kong', 'hong.kong',
  'hongknog', 'honkgong', 'hngkng', 'hongkongg', 'hongkon', 'kong hong', 'hongkong the weeknd']) {
  assert.equal(search(query, dictionary)[0]?.file, hongKong, `Best result for ${query}`);
}
for (const query of ['qingge', 'qing', '清歌', 'qiangge', 'qing ge liang jing ru']) {
  assert.equal(search(query, dictionary)[0]?.file, qingGe, `Best result for ${query}`);
}
assert.equal(search('张洁', dictionary)[0]?.file, zhangJie);
assert.equal(search('张杰')[0]?.file, zhangJie, 'Exact Han queries work without a dictionary');
assert.ok(search('ong').some(song => song.file === hongKong), 'Partial Latin substring');
assert.deepEqual(search('dj'), search('DJ'));
assert.ok(search('梁静如', dictionary).every(result => songs.find(song => song.file === result.file).title.includes('梁静茹')));
for (const query of ['', '。。。', 'zzzzzzzzzzzzzzzz', '绝对不会有这个歌手zzz', 'hongkong qzxvplm', 'x'.repeat(10000)]) {
  assert.deepEqual(search(query, dictionary), [], `Reject unrelated/empty query: ${query.slice(0, 20)}`);
}
assert.equal(substringDistance('abcd', 'zzabdczz'), 1, 'Adjacent transposition');
assert.equal(substringDistance('hongkong', 'zzhongkongtail'), 0, 'Local alignment');
// Verify stable relevance ranking, tie order and separate versions.
const sample = [
  {file:'long',title:'听悲伤的情歌 — 苏星婕'},
  {file:'original',title:'情歌 — 梁静茹'},
  {file:'dj',title:'情歌（DJ版） — 梁静茹'},
];
const sampleData = Object.fromEntries(sample.map(song => [song.file, prepareSongSearch(song, dictionary)]));
assert.deepEqual(createSongSearch(sample, sampleData)('qingge').map(song => song.file), ['original','dj','long']);
assert.deepEqual(createSongSearch([...sample].reverse(), sampleData)('qingge').map(song => song.file), ['dj','original','long']);
assert.equal(new Set(search('qingge').map(song => song.file)).size, search('qingge').length);
const started = performance.now();
for (const query of ['hongkong','Hong Kong','honkgong','清歌','张洁','qing ge liang jing ru','zzzzzzzzzz']) {
  createSongSearch(songs,data)(query,dictionary);
}
console.log(`PASS: ranked song search, typos, pinyin, homophones, versions and negatives (${Math.round(performance.now()-started)} ms for seven uncached searches).`);
