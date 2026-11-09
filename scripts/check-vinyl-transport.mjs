import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the real transport class without loading the graphics renderer.
const html = readFileSync(new URL('../favorsongs/vinyl-player.html', import.meta.url), 'utf8');
const start = html.indexOf('class TurntableTransport {');
const end = html.indexOf("if (typeof module !== 'undefined') module.exports = TurntableTransport;", start);
assert.ok(start >= 0 && end > start);
const Transport = vm.runInNewContext(`${html.slice(start, end)}; TurntableTransport`);

function descending(oldDuration, newDuration) {
  const media = {currentTime: 4, duration: oldDuration, paused: true, readyState: 4, seeking: false,
    play() {this.paused = false; return Promise.resolve();}, pause() {this.paused = true;}};
  const io = {media, groove: time => 10 + 20 * time / media.duration,
    unlock: () => Promise.resolve(), gate() {}};
  const t = new Transport(io, {restAngle: 0, reducedMotion: true});
  t.intent = true; t.contextReady = true; t.primedRevision = t.sourceRevision;
  t.pose = {angle: io.groove(media.currentTime), lift: 1};
  t.setState('loweringStylus'); t.move({lift: 0}, .9);
  media.duration = newDuration;
  return {t, media, io};
}
async function settle(t) {
  for (let i = 0; i < 12; i++) {t.tick(.05, 1, 1); await Promise.resolve();}
}
for (const [before, after] of [[10, 20], [20, 10]]) {
  const {t, media, io} = descending(before, after);
  t.tick(.05, 1, 1);
  assert.equal(t.outputOpen, false, 'Never unmute an unaligned needle');
  await settle(t);
  assert.equal(t.state, 'playing', 'Duration corrections must not strand descent');
  assert.equal(t.pose.angle, io.groove(media.currentTime));
  assert.equal(t.outputOpen, true);
  assert.equal(media.paused, false);
}
const {t, media} = descending(10, 20);
t.tick(.05, 1, 1); t.pause(); await settle(t);
assert.equal(t.state, 'paused');
assert.equal(media.paused, true);
assert.equal(t.outputOpen, false, 'Cancel during realignment must stay silent');
console.log('PASS: duration corrections in both directions recover; cancellation stays silent.');

// Hidden pages can stop delivering animation frames. Exercise the real state
// machine without calling tick externally, including repeat and replacement.
const hiddenDocument = {hidden: true};
const HiddenTransport = vm.runInNewContext(`${html.slice(start, end)}; TurntableTransport`, {document: hiddenDocument});
const hiddenMedia = {currentTime: 0, duration: 10, paused: true, readyState: 4, seeking: false,
  dataset: {repeatOne: 'true'}, get ended() {return this.currentTime >= this.duration;},
  play() {this.paused = false; return Promise.resolve();}, pause() {this.paused = true;}};
const hidden = new HiddenTransport({media: hiddenMedia, groove: time => 10 + 20 * time / 10,
  visualReady: () => false, unlock: () => Promise.resolve(), gate() {}}, {restAngle: 0});
async function microtasks() {for (let i = 0; i < 30; i++) await Promise.resolve();}
hidden.play(); await microtasks();
assert.equal(hidden.state, 'playing', 'Hidden playback starts without animation frames');
assert.equal(hidden.outputOpen, true);
hiddenMedia.currentTime = 10; hidden.mediaEvent('ended'); hidden.scheduleBackground(); await microtasks();
assert.equal(hidden.state, 'playing', 'Hidden single-track repeat resumes');
assert.equal(hiddenMedia.currentTime, 0);
hidden.replaceSource(); hiddenMedia.currentTime = 0; hidden.play(); await microtasks();
assert.equal(hidden.state, 'playing', 'Hidden track replacement resumes');
hidden.pause(); await microtasks();
assert.equal(hidden.state, 'paused');
hiddenDocument.hidden = false;
hidden.play(); await microtasks();
assert.notEqual(hidden.state, 'playing', 'Foreground still waits for the renderer');
console.log('PASS: hidden startup, repeat and track replacement work without animation frames.');
