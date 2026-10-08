// 5. INTERACTION — pointer capture, anchored smooth wheel zoom, pan and touch pinch.
class Controls {
  constructor(state,renderer,notify){
    this.s=state;this.renderer=renderer;this.notify=notify;this.points=new Map();this.gesture=null;this.uiTimer=0;this.padDragging=false;
    this.bindCanvas();this.bindParameter();this.bindButtons();this.buildPresets();this.bindKeyboard();
  }
  manual(){const s=this.s;s.lastInteraction=performance.now();s.driftBase=s.c.slice();s.driftClock=0;s.dirty=true;this.wakeUI()}
  wakeUI(){if(!this.s.hidden)return;document.body.classList.add('peek');clearTimeout(this.uiTimer);this.uiTimer=setTimeout(()=>document.body.classList.remove('peek'),1600)}
  local(event){const r=this.renderer.canvas.getBoundingClientRect();return[event.clientX-r.left,event.clientY-r.top]}
  zoomAt(x,y,delta){
    this.manual();const s=this.s;
    s.zoomAnchor={world:complexAt(x,y,s),vector:screenVector(x,y,s.width,s.height)};
    s.targetLogZoom=clamp(s.targetLogZoom+delta,Math.log(CONFIG.minZoom),Math.log(CONFIG.maxZoom));
    this.renderer.canvas.dataset.lastZoomRequest=JSON.stringify({x,y,delta,target:s.targetLogZoom});
    if(s.targetLogZoom===Math.log(CONFIG.maxZoom))this.notify('Precision limit · 4096×');
  }
  beginGesture(){
    const s=this.s,a=[...this.points.values()];s.targetLogZoom=s.logZoom;s.zoomAnchor=null;s.targetCenter=s.center.slice();
    if(a.length>=2){const mid=[(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2];this.gesture={kind:'pinch',distance:Math.max(1,Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])),world:complexAt(...mid,s),zoom:s.logZoom}}
    else if(a.length)this.gesture={kind:'pan',point:a[0].slice(),center:s.center.slice()};else this.gesture=null;
  }
  bindCanvas(){
    const canvas=this.renderer.canvas,s=this.s;
    canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;this.manual();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);this.points.set(e.pointerId,this.local(e));s.interacting=true;this.beginGesture()});
    canvas.addEventListener('pointermove',e=>{this.wakeUI();if(!this.points.has(e.pointerId))return;this.manual();this.points.set(e.pointerId,this.local(e));const a=[...this.points.values()],g=this.gesture;if(!g)return;
      if(g.kind==='pinch'&&a.length>=2){const d=Math.max(1,Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])),mid=[(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2];s.logZoom=s.targetLogZoom=clamp(g.zoom+Math.log(d/g.distance),Math.log(CONFIG.minZoom),Math.log(CONFIG.maxZoom));const v=screenVector(...mid,s.width,s.height),span=CONFIG.defaultSpan/Math.exp(s.logZoom);s.center=[g.world[0]-v[0]*span,g.world[1]-v[1]*span]}
      else if(g.kind==='pan'){const span=CONFIG.defaultSpan/Math.exp(s.logZoom)/Math.min(s.width,s.height);s.center=[g.center[0]-(a[0][0]-g.point[0])*span,g.center[1]+(a[0][1]-g.point[1])*span]}
      s.targetCenter=s.center.slice();
    });
    const release=e=>{if(!this.points.has(e.pointerId))return;this.points.delete(e.pointerId);s.interacting=this.points.size>0;if(this.points.size)this.beginGesture();else this.gesture=null;s.lastInteraction=performance.now()};
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,release);
    canvas.addEventListener('wheel',e=>{e.preventDefault();let d=e.deltaY;if(e.deltaMode===1)d*=16;if(e.deltaMode===2)d*=s.height;this.zoomAt(...this.local(e),-clamp(d,-160,160)*.0025)},{passive:false});
    canvas.addEventListener('dblclick',e=>{e.preventDefault();this.zoomAt(...this.local(e),Math.log(2.4))});
    window.addEventListener('pointermove',()=>this.wakeUI(),{passive:true});
  }
  // 6. PARAMETER CONTROLS — an actual complex-coordinate pad, keyboard accessible.
  setParameter(c,immediate=true){this.manual();const s=this.s;s.preset=-1;s.targetC=c.map(v=>clamp(v,-1.2,1.2));if(immediate)s.c=s.targetC.slice();s.driftBase=s.targetC.slice();this.updatePresetButtons()}
  bindParameter(){const pad=$('parameter-pad'),s=this.s;
    const set=e=>{const r=pad.getBoundingClientRect();this.setParameter([(e.clientX-r.left)/r.width*2.4-1.2,1.2-(e.clientY-r.top)/r.height*2.4])};
    pad.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();pad.focus({preventScroll:true});pad.setPointerCapture(e.pointerId);this.padDragging=true;s.interacting=true;set(e)});
    pad.addEventListener('pointermove',e=>{if(this.padDragging)set(e)});
    const release=()=>{this.padDragging=false;s.interacting=false;s.lastInteraction=performance.now()};for(const type of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(type,release);
    pad.addEventListener('keydown',e=>{const delta=e.shiftKey?.0005:.005;const c=s.c.slice();if(e.key==='ArrowLeft')c[0]-=delta;else if(e.key==='ArrowRight')c[0]+=delta;else if(e.key==='ArrowUp')c[1]+=delta;else if(e.key==='ArrowDown')c[1]-=delta;else return;e.preventDefault();e.stopPropagation();this.setParameter(c)});
  }
  // 7. PRESETS — every tiny preview was computed by the same Julia shader.
  buildPresets(){const host=$('presets');host.replaceChildren();PRESETS.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.className='preset';b.dataset.name=p.name;b.title=`${p.name} · c = ${p.c[0]} ${p.c[1]<0?'−':'+'} ${Math.abs(p.c[1])}i`;b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(i===this.s.preset));const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');b.append(canvas);host.append(b);this.renderer.thumbnail(p.c,canvas);b.addEventListener('click',()=>this.selectPreset(i))})}
  selectPreset(i){this.manual();const s=this.s,p=PRESETS[i];s.targetC=p.c.slice();s.targetCenter=[0,0];s.targetLogZoom=0;s.zoomAnchor=null;s.preset=i;s.driftBase=p.c.slice();s.driftClock=0;this.updatePresetButtons();$('announcement').textContent=p.name+' preset selected.'}
  updatePresetButtons(){[...$('presets').children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===this.s.preset)))}
  reset(){this.selectPreset(0);this.s.drift=false;this.s.driftClock=0;this.notify('Back to the beginning')}
  toggleDrift(){const s=this.s;this.manual();s.drift=!s.drift;s.driftBase=s.c.slice();s.driftClock=0;if(s.drift){s.lastInteraction=performance.now()-CONFIG.idleResumeMs;s.targetC=s.c.slice()}this.notify(s.drift?'Drift on · touch to pause':'Drift off')}
  setQuality(value){const s=this.s;this.manual();s.quality=value;s.resolutionFactor=1;s.samples=value==='fine'?4:1;this.renderer.resize();$('quality').textContent={auto:'Auto',fine:'Fine',eco:'Eco'}[value];$('quality').title=`Rendering quality: ${value}. Click to change.`;$('quality').setAttribute('aria-label','Rendering quality: '+value);this.notify({auto:'Adaptive quality',fine:'Fine · 2 × 2 supersampling',eco:'Eco · native 1× pixels'}[value])}
  hideUI(value=!this.s.hidden){this.s.hidden=value;document.body.classList.toggle('ui-hidden',value);document.body.classList.remove('peek');document.querySelectorAll('.ui').forEach(el=>el.inert=value);$('hide').setAttribute('aria-pressed',String(value));if(!value)$('hide').focus({preventScroll:true});else document.activeElement.blur()}
  async fullscreen(){this.manual();const el=document.documentElement,active=document.fullscreenElement||document.webkitFullscreenElement;
    try{if(active){const exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit)await exit.call(document)}else{const enter=el.requestFullscreen||el.webkitRequestFullscreen;if(!enter){this.notify('Fullscreen is unavailable in this browser');return}await enter.call(el)}}catch{this.notify('Fullscreen was not granted by this browser')}
  }
  bindButtons(){
    $('reset').onclick=()=>this.reset();$('drift').onclick=()=>this.toggleDrift();$('hide').onclick=()=>this.hideUI();$('show').onclick=()=>this.hideUI(false);$('fullscreen').onclick=()=>this.fullscreen();
    $('quality').onclick=()=>{const a=['auto','fine','eco'];this.setQuality(a[(a.indexOf(this.s.quality)+1)%3])};
    const sync=()=>{const on=!!(document.fullscreenElement||document.webkitFullscreenElement);document.body.classList.toggle('immersive',on);$('fullscreen').setAttribute('aria-label',on?'Exit fullscreen':'Enter fullscreen')};
    document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync);
    if(!document.documentElement.requestFullscreen&&!document.documentElement.webkitRequestFullscreen){$('fullscreen').disabled=true;$('fullscreen').title='Fullscreen unavailable in this browser'}
  }
  bindKeyboard(){window.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const key=e.key.toLowerCase();
    if(key==='h'){e.preventDefault();this.hideUI();return}if(key==='escape'&&this.s.hidden){this.hideUI(false);return}
    if(e.target.closest('input,textarea,select,#parameter-pad'))return;
    if(key==='r')this.reset();else if(key==='d')this.toggleDrift();else if(key==='f')this.fullscreen();
    else if(key==='+'||key==='=')this.zoomAt(this.s.width/2,this.s.height/2,.25);
    else if(key==='-')this.zoomAt(this.s.width/2,this.s.height/2,-.25);
    else if(key.startsWith('arrow')){this.manual();this.s.zoomAnchor=null;const d=CONFIG.defaultSpan/Math.exp(this.s.logZoom)*.08;if(key==='arrowleft')this.s.targetCenter[0]-=d;if(key==='arrowright')this.s.targetCenter[0]+=d;if(key==='arrowup')this.s.targetCenter[1]+=d;if(key==='arrowdown')this.s.targetCenter[1]-=d}else return;e.preventDefault();})}
}
