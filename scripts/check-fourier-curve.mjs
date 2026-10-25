import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../src/fourier/index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function angleAt('),html.indexOf('function recordSample('));
const chainSource=html.slice(html.indexOf('function chain('),html.indexOf('function drawPanel('));
const state={T:2*Math.PI,dc:.2,x:0,span:2,zoom:1,panX:0,motions:[],terms:[]};
let points=[];
const context={state,CURVE_PIXEL_ERROR:.15,cw:1000,dpr:2,ctx:{beginPath(){points=[]},moveTo(x,y){points.push({x,y,start:true})},lineTo(x,y){points.push({x,y})}}};
const api=vm.runInNewContext(source+chainSource+';({motionEndpoint,chain,recordMotion,recordedCurvePath})',context);
const independent=(terms,x,dc,T,count=terms.length)=>terms.slice(0,count).reduce((y,t)=>y+(t.enabled?t.r*Math.sin(t.omega*(10*x/T)+t.phase+t.offset):0),dc);
let worst=0,checked=0;
for(const n of [60,70,128]){
 state.terms=Array.from({length:n},(_,i)=>({r:4/Math.PI/(2*i+1),omega:(i%3===0?-1:1)*(2*i+1)*2*Math.PI/10,phase:(i%7)*.31,offset:(i%5)*.17,enabled:i%13!==5}));
 state.x=0;state.motions=[];api.recordMotion();const segment=state.motions[0];segment.end=state.x=2*state.T;
 assert.equal(api.chain(state.terms,state.x).y,api.motionEndpoint(segment.terms,state.x,segment.dc,segment.T).y);
 for(const zoom of [1,100,1000])for(const count of [Math.round(n/3),Infinity]){
  state.zoom=zoom;state.panX=-250*zoom;
  api.recordedCurvePath(count,25,470,978,220);
  assert(points.length>1);let previous=null;
  for(const p of points){const x=state.x-(p.x-470)*state.T*state.span/508;
   assert(Math.abs((220-p.y)/25-independent(segment.terms,x,segment.dc,segment.T,count))<1e-9,'Every plotted vertex is the actual endpoint sum');
   if(previous&&!p.start)for(const f of [.2,.4,.6,.8]){
    const gx=previous.x+(p.x-previous.x)*f,t=state.x-(gx-470)*state.T*state.span/508;
    const lineY=previous.y+(p.y-previous.y)*f,exactY=220-independent(segment.terms,t,segment.dc,segment.T,count)*25;
    const error=Math.abs(lineY-exactY)*zoom*context.dpr;worst=Math.max(worst,error);checked++;
    assert(error<=.150001,`Interpolation exceeds pixel budget: ${error}`);
   }previous=p;
  }
 }
 const saved=JSON.stringify(segment),oldValue=api.motionEndpoint(segment.terms,.1,segment.dc,segment.T).y;
 state.terms[0].r+=3;api.recordMotion();assert.equal(JSON.stringify(segment),saved);assert.equal(api.motionEndpoint(segment.terms,.1,segment.dc,segment.T).y,oldValue);
 assert.equal(state.motions.length,2);api.recordMotion();assert.equal(state.motions.length,2,'Unchanged parameters must not create new segments');
 state.terms[0].phase+=.3;api.recordMotion();assert.equal(state.motions.length,2,'Repeated edits at the same time replace only the unplayed segment');
}
state.terms=[{r:1,omega:0,phase:.3,offset:0,enabled:true}];state.x=0;state.motions=[];api.recordMotion();state.motions[0].end=state.x=1;state.zoom=1;state.panX=0;api.recordedCurvePath(Infinity,25,470,978,220);assert(points.length===2,'Stationary signal is an exact straight line');
console.log(`PASS: 60/70/128 terms, 1/100/1000×, partial sums, immutable history, zero velocity. ${checked} chord samples; worst error ${worst.toFixed(6)} physical px.`);
