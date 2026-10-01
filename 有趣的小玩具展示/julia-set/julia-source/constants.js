'use strict';
// 1. CONSTANTS — the same values are used by controls, renderer and documentation.
const CONFIG=Object.freeze({
  defaultSpan:3.65, minZoom:.45, maxZoom:4096,
  baseIterations:220, maxIterations:700, iterationsPerOctave:40,
  maxDPR:2, maxPixels:5200000, idleResumeMs:10000,
  revealSeconds:1.85, paletteSpeed:.0016, glow:.30, exposure:1.32,
  driftAmplitude:.014, driftSpeed:.065
});
const PRESETS=Object.freeze([
  {name:'Nocturne',c:[-.8,.156]},
  {name:'Coral',c:[-.4,.6]},
  {name:'Filigree',c:[.285,.01]},
  {name:'Ember',c:[-.835,-.2321]},
  {name:'Nautilus',c:[-.70176,-.3842]}
]);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const near=(a,b,eps=1e-9)=>Math.abs(a-b)<eps;
const $=id=>document.getElementById(id);

// 2. STATE — view coordinates remain JavaScript doubles; GPU uses highp floats.
function createState(){return{
  c:PRESETS[0].c.slice(),targetC:PRESETS[0].c.slice(),center:[0,0],targetCenter:[0,0],
  logZoom:0,targetLogZoom:0,zoomAnchor:null,preset:0,
  drift:false,driftBase:PRESETS[0].c.slice(),driftClock:0,lastInteraction:performance.now(),
  hidden:false,quality:'auto',samples:1,resolutionFactor:1,iterations:220,
  width:innerWidth,height:innerHeight,dpr:1,fps:0,renderTime:0,
  animate:!matchMedia('(prefers-reduced-motion: reduce)').matches,
  reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,contextLost:false,
  time:0,reveal:0,interacting:false,dirty:true
}}
function screenVector(x,y,width,height){const m=Math.min(width,height);return[(x-width*.5)/m,(height*.5-y)/m]}
function complexAt(x,y,state){const v=screenVector(x,y,state.width,state.height),s=CONFIG.defaultSpan/Math.exp(state.logZoom);return[state.center[0]+v[0]*s,state.center[1]+v[1]*s]}
function iterationBudget(logZoom){return Math.min(CONFIG.maxIterations,CONFIG.baseIterations+Math.ceil(Math.max(0,logZoom/Math.LN2)*CONFIG.iterationsPerOctave))}

// CPU reference for mathematical verification of a few points, never image rendering.
function referenceEscape(z0,c,limit=220){let x=z0[0],y=z0[1],n=0;while(n<limit&&x*x+y*y<=4){const nx=x*x-y*y+c[0];y=2*x*y+c[1];x=nx;n++}return{escaped:x*x+y*y>4,iterations:n}}
