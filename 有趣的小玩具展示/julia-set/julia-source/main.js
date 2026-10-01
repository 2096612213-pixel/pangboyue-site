// 8. ANIMATION — exponentially damped navigation; time is suspended off screen.
function startJulia(){
  const state=createState();let renderer,controls,raf=0,last=0,elapsed=0,fpsElapsed=0,fpsFrames=0,qualityClock=0,toastTimer=0,frameAverage=16.67;
  const notify=message=>{$('toast').textContent=message;$('toast').classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('on'),2200)};
  const fail=message=>{cancelAnimationFrame(raf);$('fallback-message').textContent=message;$('fallback').hidden=false;document.body.classList.remove('ready')};
  try{renderer=new JuliaRenderer($('stage'),state);renderer.resize();controls=new Controls(state,renderer,notify)}catch(error){console.error(error);fail(error.message);return}
  setTimeout(()=>document.body.classList.add('ready'),state.reduced?0:650);
  function navigation(dt){
    const k=state.reduced?1:1-Math.exp(-10*dt);
    state.logZoom=mix(state.logZoom,state.targetLogZoom,k);
    if(near(state.logZoom,state.targetLogZoom,1e-7))state.logZoom=state.targetLogZoom;
    if(state.zoomAnchor){const a=state.zoomAnchor,span=CONFIG.defaultSpan/Math.exp(state.logZoom);state.center=[a.world[0]-a.vector[0]*span,a.world[1]-a.vector[1]*span];state.targetCenter=state.center.slice();if(near(state.logZoom,state.targetLogZoom,1e-7))state.zoomAnchor=null}
    else for(let i=0;i<2;i++){state.center[i]=mix(state.center[i],state.targetCenter[i],k);if(near(state.center[i],state.targetCenter[i]))state.center[i]=state.targetCenter[i]}
  }
  function evolve(dt,now){
    const running=state.drift&&!state.interacting&&now-state.lastInteraction>=CONFIG.idleResumeMs;
    if(running){state.driftClock+=dt;const t=state.driftClock,a=CONFIG.driftAmplitude*ease(t/3),w=CONFIG.driftSpeed;
      state.targetC=[clamp(state.driftBase[0]+a*Math.sin(t*w),-1.2,1.2),clamp(state.driftBase[1]+a*.76*(Math.cos(t*w*.73)-1),-1.2,1.2)];state.preset=-1;
    }
    const k=state.reduced?1:1-Math.exp(-6*dt);
    for(let i=0;i<2;i++){state.c[i]=mix(state.c[i],state.targetC[i],k);if(near(state.c[i],state.targetC[i]))state.c[i]=state.targetC[i]}
    return running;
  }
  // Adaptive quality never changes the escape recurrence or silently lowers iteration budget.
  function adapt(dt){
    if(state.quality!=='auto'||elapsed<3)return;qualityClock+=dt;
    const fast=frameAverage<18,slow=frameAverage>22;
    if(slow&&qualityClock>1.6){
      if(state.samples>1)state.samples=1;
      else{const floor=Math.min(1,1/Math.min(devicePixelRatio||1,CONFIG.maxDPR));state.resolutionFactor=Math.max(floor,state.resolutionFactor*.86);renderer.resize()}
      qualityClock=0;
    }else if(fast&&qualityClock>5&&!state.interacting){
      if(state.resolutionFactor<.999){state.resolutionFactor=Math.min(1,state.resolutionFactor+.07);renderer.resize()}
      else if(state.samples===1)state.samples=2;
      else if(state.samples===2&&frameAverage<16.9)state.samples=4;
      qualityClock=0;
    }
    if(state.interacting&&state.samples>1){state.samples=1;qualityClock=0}
  }
  function frame(now){
    if(document.hidden||state.contextLost)return;
    const raw=last?now-last:16.667;last=now;const dt=Math.min(raw/1000,.05);elapsed+=dt;
    if(raw<150)frameAverage=mix(frameAverage,raw,.06);
    navigation(dt);const drifting=evolve(dt,now);
    if(state.animate)state.time+=dt;
    state.reveal=state.reduced?1:ease(elapsed/CONFIG.revealSeconds);
    state.iterations=iterationBudget(state.logZoom);
    adapt(dt);
    const moving=!near(state.logZoom,state.targetLogZoom)||state.center.some((v,i)=>!near(v,state.targetCenter[i]))||state.c.some((v,i)=>!near(v,state.targetC[i]));
    if(state.animate||drifting||moving||state.dirty||state.reveal<1){const t=performance.now();renderer.draw();state.renderTime=performance.now()-t;state.dirty=false}
    fpsElapsed+=raw;fpsFrames++;
    if(fpsElapsed>=500){state.fps=Math.round(fpsFrames*1000/fpsElapsed);fpsElapsed=0;fpsFrames=0;updateUI(drifting,now)}
    updatePad();raf=requestAnimationFrame(frame);
  }
  // 9. RESIZE — CSS coordinates and physical framebuffer coordinates stay separate.
  function resize(){state.width=Math.max(1,innerWidth);state.height=Math.max(1,innerHeight);state.zoomAnchor=null;renderer.resize()}
  addEventListener('resize',resize);if(window.visualViewport)visualViewport.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);last=0;fpsFrames=0;fpsElapsed=0;if(!document.hidden&&!state.contextLost){state.lastInteraction=performance.now();state.driftBase=state.c.slice();state.driftClock=0;raf=requestAnimationFrame(frame)}});
  $('stage').addEventListener('webglcontextlost',event=>{event.preventDefault();state.contextLost=true;cancelAnimationFrame(raf);fail('The graphics context was interrupted. Waiting for the GPU to return…')});
  $('stage').addEventListener('webglcontextrestored',()=>{try{renderer.initialize();renderer.resize();controls.buildPresets();state.contextLost=false;$('fallback').hidden=true;document.body.classList.add('ready');last=0;state.dirty=true;raf=requestAnimationFrame(frame)}catch(e){fail(e.message)}});
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{state.reduced=e.matches;state.animate=!e.matches;if(e.matches)state.drift=false;state.dirty=true});
  // 10. UI — deliberately slower statistics; no live-region chatter every frame.
  function updatePad(){const x=(state.c[0]+1.2)/2.4*100,y=(1.2-state.c[1])/2.4*100;$('parameter-dot').style.left=x+'%';$('parameter-dot').style.top=y+'%';const a=state.c[0]<0?'−'+Math.abs(state.c[0]).toFixed(4):state.c[0].toFixed(4),b=Math.abs(state.c[1]).toFixed(4);$('coordinate').textContent=`c = ${a} ${state.c[1]<0?'−':'+'} ${b}i`}
  function updateUI(drifting,now){
    $('stage').dataset.navigation=JSON.stringify({current:state.logZoom,target:state.targetLogZoom,center:state.center});
    $('fps').textContent=state.fps;$('iterations').textContent=state.iterations;const z=Math.exp(state.logZoom);$('zoom').innerHTML=(z<100?z.toFixed(2):z.toFixed(0))+'<small>×</small>';
    $('drift').setAttribute('aria-pressed',String(state.drift));$('drift-label').textContent=state.drift?(drifting?'Drifting':'Paused'):'Drift';
    $('parameter-status').textContent=state.drift?(drifting?'drifting':Math.max(0,Math.ceil((CONFIG.idleResumeMs-now+state.lastInteraction)/1000))+'s'):'c';
    $('quality').title=`${state.quality} · ${renderer.canvas.width} × ${renderer.canvas.height} · ${state.samples} sample${state.samples>1?'s':''} · DPR ${state.dpr.toFixed(2)}`;
    controls.updatePresetButtons();
  }
  $('hint').textContent=matchMedia('(pointer: coarse)').matches?'Drag to wander · Pinch to dive':'Drag to wander · Scroll to dive · Double-click to explore';
  // Small public integration / verification API. Never used to render pixels on the CPU.
  window.JuliaArt=Object.freeze({
    getState:()=>({c:state.c.slice(),center:state.center.slice(),zoom:Math.exp(state.logZoom),iterations:state.iterations,fps:state.fps,dpr:state.dpr,samples:state.samples,quality:state.quality,drift:state.drift,driftClock:state.driftClock,uiHidden:state.hidden,webgl:renderer.webgl2?2:1,precision:renderer.precision,resolution:[renderer.canvas.width,renderer.canvas.height]}),
    setParameter:(a,b)=>{if(!Number.isFinite(a)||!Number.isFinite(b))throw Error('Finite parameters required');controls.setParameter([a,b])},
    selectPreset:i=>{if(Number.isInteger(i)&&i>=0&&i<PRESETS.length)controls.selectPreset(i)},
    setQuality:q=>{if(['auto','fine','eco'].includes(q))controls.setQuality(q)},reset:()=>controls.reset(),
    pause:()=>{state.animate=false;state.drift=false;state.dirty=true},resume:()=>{state.animate=!state.reduced;state.dirty=true},
    probe:(z,c,limit=220)=>{const result=renderer.probe(z,c,limit);state.dirty=true;return result},referenceEscape,
    complexAt:(x,y)=>complexAt(x,y,state),getGLError:()=>renderer.gl.getError(),
    renderNow:()=>renderer.draw({reveal:1})
  });
  updateUI(false,performance.now());updatePad();raf=requestAnimationFrame(frame);
}
$('retry').addEventListener('click',()=>location.reload());
startJulia();
