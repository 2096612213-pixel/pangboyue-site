import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../favorsongs/vinyl-bridge.js',import.meta.url),'utf8');
function fixture(){
 let now=0, id=0, legacyClicks=0;
 const intervals=new Map(),document=new EventTarget(),window=new EventTarget(),events=[];
 const buttons=new Map();document.hidden=false;
 document.getElementById=key=>{if(!buttons.has(key))buttons.set(key,Object.assign(new EventTarget(),{setAttribute(){}}));return buttons.get(key);};
 document.querySelector=()=>({click(){legacyClicks++}});
 const media=Object.assign(new EventTarget(),{currentTime:0,readyState:4,paused:true,ended:false,dataset:{},src:'',load(){},removeAttribute(key){this[key]=''}});
 const transport={intent:false,state:'paused',play(){this.intent=true;this.state='preparing'},pause(){this.intent=false;this.state='paused'}};
 const context={window,document,audioEl:media,transport,AbortController,CustomEvent,URL,performance:{now:()=>now},location:{href:'http://localhost/favorsongs/vinyl-player.html',origin:'http://localhost'},
 tonearmMetalLighting:{ready:true,drawCount:0,startupPhase:'ready',host:{classList:{contains:()=>false}}},
 trackAbort:new AbortController(),trackGeneration:0,timelineRevision:0,currentAudioFile:null,isDemoMode:false,currentTrackMeta:null,
 clearCurrentTrack(){context.trackAbort.abort();context.trackAbort=new AbortController();return ++context.trackGeneration},
 updateTrackLabels(){},updateAlbumCover(){},installLyrics(){},setLyricsStatus(){},LyricTimeline:{normalize:x=>x},ensureMediaConnection:async()=>{},
 setInterval(fn){intervals.set(++id,fn);return id},clearInterval(key){intervals.delete(key)},togglePlay(){},
 };
 window.addEventListener('playliststate',e=>events.push(e.detail));vm.runInNewContext(source,context);
 return {context,transport,document,window,media,events,intervals,get legacyClicks(){return legacyClicks},
 tick(ms=500){now+=ms;for(const fn of [...intervals.values()])fn()},
 advance(ms){for(let i=0;i<ms/500;i++)this.tick()},
 async select(){await window.vinylPlayer.select({file:'test.mp3',title:'Test — Artist'})},
 errors(){return events.filter(e=>e.state==='error')},
 visibility(hidden){document.hidden=hidden;document.dispatchEvent(new Event('visibilitychange'))}
 };
}
{
 const f=fixture();await f.select();f.transport.pause();f.advance(300000);
 assert.equal(f.legacyClicks,0,'Idle scenes must never activate old graphics');assert.equal(f.errors().length,0);
 f.transport.intent=true;f.transport.state='preparing';f.visibility(true);f.advance(120000);
 f.visibility(false);f.advance(2000);assert.equal(f.errors().length,0,'Background time must not count as stalled audio');
 f.advance(31000);assert.equal(f.errors().length,1,'A real uninterrupted foreground stall still times out');
 assert.equal(f.intervals.size,0,'Failure must remove track timers');
}
{
 const f=fixture();await f.select();f.advance(20000);f.tick(120000);f.advance(2000);
 assert.equal(f.errors().length,0,'A suspended scheduler starts a fresh stall budget');
 f.window.dispatchEvent(new Event('pageshow'));f.advance(2000);assert.equal(f.errors().length,0);
 f.context.tonearmMetalLighting.ready=false;f.context.tonearmMetalLighting.startupPhase='error';f.advance(120000);
 assert.equal(f.legacyClicks,0,'Graphics errors must not switch to the old player');assert.equal(f.errors().length,0,'Graphics recovery is not an audio connection timeout');
 await f.select();assert.equal(f.intervals.size,1,'Song selection replaces old watchdog');
 f.window.vinylPlayer.destroy();assert.equal(f.intervals.size,0);
}
console.log('PASS: idle/background/scheduler suspension/graphics recovery never activate legacy UI; real stalls time out; timers cleaned.');
