const MOBILE=matchMedia('(max-width:900px)').matches;
const SETTINGS_DEFAULTS=Object.freeze({
  ...NATIVE_DEFAULTS,res:MOBILE?1024:1600,flowerColor:'#c8102e',colorMix:.95,
  backgroundStrength:0,petalFlowStrength:.82,flowerScale:.5,objectScale:1,
  waterSpeed:1,gridResolution:MOBILE?128:256,rippleScale:1,waterAmplitude:1,
  disturbanceStrength:1,disturbanceFrequency:.65,waterTransparency:.92,
  causticsIntensity:1.3,causticsContrast:1.25,shadowStrength:.85,
  reflectionStrength:1,refractionStrength:1,surfaceLight:1,exposure:1,quality:MOBILE?'low':'balanced'
});
class Studio {
  constructor() {
    this.state={...SETTINGS_DEFAULTS,phase:INITIAL_PHASE,timeSec:0,playing:new URLSearchParams(location.search).get('qa')!=='1'};
    this.canvas=document.getElementById('glCanvas');
    this.gpu=new GPU(this.canvas);
    this.water=new WaterSimulation(this.gpu,this.state.gridResolution);
    this.flower=new FlowerSource(this.gpu);
    this.caustics=new Caustics(this.gpu,this.state.gridResolution,this.state.quality);
    this.scene=new UnderwaterScene(this.gpu,this.flower,this.water,this.caustics);
    this.ready=false; this.active=true; this.flowerDirty=true; this.causticsDirty=true;
    this.lastTime=performance.now(); this.fpsStart=this.lastTime; this.frameCount=0; this.fps=0;
  }
  async init() {
    await this.flower.load(); this.flower.resize(this.state);
    if(STUDIO_MODE)this.ui=new StudioUI(this);
    this.ready=true; this.resize(); this.render();
    if(STUDIO_MODE)document.getElementById('loading').hidden=true;
    this.resizeObserver=new ResizeObserver(()=>this.resize()); this.resizeObserver.observe(this.canvas.parentElement);
    document.addEventListener('visibilitychange',()=>{this.lastTime=performance.now();});
    this.canvas.addEventListener('webglcontextlost',event=>{
      event.preventDefault(); this.active=false; cancelAnimationFrame(this.raf);
      showFailure(new Error('图形上下文已中断。请重新载入页面继续。'));
    });
    this.canvas.addEventListener('webglcontextrestored',()=>location.reload());
    let dragTime=0;
    const disturb=event=>{
      let nativeDrop=false;
      if(this.state.rippleStr>.001){
        const flowerUV=this.scene.pickFlower(event.clientX,event.clientY,this.state);
        if(flowerUV){this.flower.addDrop(flowerUV[0],flowerUV[1],this.state.timeSec,1.35);this.flowerDirty=true;nativeDrop=true;}
      }
      const p=this.scene.pickWater(event.clientX,event.clientY);
      if(!p){if(nativeDrop&&!this.state.playing)this.render();return;}
      const uv=p.map(v=>v/(24*this.state.rippleScale)+.5);
      if(uv.some(v=>v<.04||v>.96)){if(nativeDrop&&!this.state.playing)this.render();return;}
      this.water.addDrop(uv[0],uv[1],.2,.031);
      if(!this.state.playing) {this.water.update(1/60,this.state);this.causticsDirty=true;this.flowerDirty=true;this.render();}
    };
    this.canvas.addEventListener('pointerdown',disturb);
    this.canvas.addEventListener('pointermove',event=>{if(event.buttons===1 && performance.now()-dragTime>100){dragTime=performance.now();disturb(event);}});
    this.tick=this.tick.bind(this); this.raf=requestAnimationFrame(this.tick);
    window.HomeBlossom={ready:true,setActive:active=>{this.active=Boolean(active);this.lastTime=performance.now();if(this.active)this.render();},isActive:()=>this.active};
    window.UnderwaterStudio={
      getState:()=>({...this.state,waterTime:this.water.time}),
      set:(key,value)=>this.set(key,value),
      pause:()=>this.play(false),play:()=>this.play(true),
      advance:(seconds,{flower=true,water=true}={})=>{
        for(let t=0;t<seconds-1.e-7;t+=1/60)this.advance(Math.min(1/60,seconds-t),flower,water);
        this.render();this.ui?.sync();
      },
      reset:()=>this.reset(),diagnostics:()=>this.diagnostics(),debugWater:()=>this.debugWater(),
      exportSettings:()=>this.settings(),capture:()=>this.capture(),extractFlowerIcon:()=>this.extractIcon()
    };
    setSceneReady(true);
  }
  settings() { return Object.fromEntries(Object.keys(SETTINGS_DEFAULTS).map(key=>[key,this.state[key]])); }
  set(key,value,draw=true) {
    if(!(key in SETTINGS_DEFAULTS)) throw new Error(`未知设置：${key}`);
    this.ui?.validate(key,value);
    if(this.state[key]===value) return;
    this.state[key]=value;
    if(key==='gridResolution'){this.water.resize(value);this.caustics.rebuild(value,this.state.quality);}
    if(key==='quality'){this.flower.resize(this.state);this.caustics.rebuild(this.state.gridResolution,value);}
    this.flowerDirty=true; this.causticsDirty=true;
    if(key==='res')this.resize();
    this.ui?.sync(); if(draw)this.render();
  }
  apply(settings) {
    const clean={};
    for(const key of Object.keys(SETTINGS_DEFAULTS))if(key in settings){this.ui?.validate(key,settings[key]);clean[key]=settings[key];}
    // Validate the entire import before mutating any live settings.
    const oldGrid=this.state.gridResolution,oldQuality=this.state.quality;
    Object.assign(this.state,clean);
    if(oldGrid!==this.state.gridResolution)this.water.resize(this.state.gridResolution);
    if(oldGrid!==this.state.gridResolution||oldQuality!==this.state.quality)this.caustics.rebuild(this.state.gridResolution,this.state.quality);
    this.flower.resize(this.state);this.flowerDirty=true;this.causticsDirty=true;
    this.resize();this.ui?.sync();this.render();
  }
  play(playing) {this.state.playing=playing;this.lastTime=performance.now();this.ui?.sync();}
  step(direction) {this.play(false);this.state.phase=(this.state.phase+direction*2*Math.PI/50+2*Math.PI)%(2*Math.PI);this.flowerDirty=true;this.render();}
  reset() {
    Object.assign(this.state,SETTINGS_DEFAULTS,{phase:INITIAL_PHASE,timeSec:0,playing:true});
    if(this.water.resolution!==this.state.gridResolution)this.water.resize(this.state.gridResolution);
    this.water.reset();this.flower.resetDrops();this.flower.resize(this.state);
    this.caustics.rebuild(this.state.gridResolution,this.state.quality);
    this.flowerDirty=true;this.causticsDirty=true;this.lastTime=performance.now();
    this.resize();this.ui?.sync();this.render();this.ui?.toast('已恢复默认水境');
  }
  advance(dt,flower=true,water=true) {
    if(flower){this.state.timeSec+=dt;this.state.phase=(this.state.phase+BASE_OMEGA*this.state.speed*dt)%(2*Math.PI);this.flowerDirty=true;}
    if(water){this.water.update(dt,this.state);this.causticsDirty=true;}
  }
  tick(now) {
    const dt=Math.max(0,Math.min(.05,(now-this.lastTime)/1000)); this.lastTime=now;
    if(this.state.playing&&this.active&&!document.hidden){this.advance(dt);this.render();}
    this.frameCount++;
    if(now-this.fpsStart>750){this.fps=this.frameCount*1000/(now-this.fpsStart);this.frameCount=0;this.fpsStart=now;this.ui?.metrics(this.fps);}
    this.raf=requestAnimationFrame(this.tick);
  }
  resize() {
    if(!this.ready)return;
    const rect=this.canvas.parentElement.getBoundingClientRect();
    const long=Math.max(rect.width,rect.height),edge=Math.min(this.state.res,long*Math.min(devicePixelRatio||1,2));
    const width=Math.max(1,Math.round(rect.width*edge/long)),height=Math.max(1,Math.round(rect.height*edge/long));
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    this.render();this.ui?.metrics(this.fps);
  }
  render() {
    if(!this.ready)return;
    this.gpu.drawCalls=0;
    if(this.flowerDirty){this.flower.render(this.state);this.flowerDirty=false;}
    if(this.causticsDirty){this.caustics.render(this.water,this.state,this.scene.light);this.causticsDirty=false;}
    this.scene.render(this.state);
  }
  drop() {
    this.water.addDrop(.48,.52,.2,.035); this.flower.addDrop(.52,.54,this.state.timeSec,1.6);
    if(!this.state.playing)this.water.update(1/60,this.state);
    this.flowerDirty=true;this.causticsDirty=true;this.render();
  }
  capture() {
    const width=this.canvas.width,height=this.canvas.height,aspect=width/height;
    try {
      this.canvas.width=aspect>=1?this.state.res:Math.round(this.state.res*aspect);
      this.canvas.height=aspect>=1?Math.round(this.state.res/aspect):this.state.res;
      this.render(); return this.canvas.toDataURL('image/png');
    } finally {this.canvas.width=width;this.canvas.height=height;this.render();}
  }
  extractIcon() {
    // GPU readback occurs only for explicit image export, never in the rendering loop.
    const gl=this.gpu.gl,target=this.flower.target,raw=new Uint8Array(target.width*target.height*4);
    this.flower.render(this.state,true);gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);
    gl.readPixels(0,0,target.width,target.height,gl.RGBA,gl.UNSIGNED_BYTE,raw);
    const capture=document.createElement('canvas');capture.width=target.width;capture.height=target.height;
    const context=capture.getContext('2d'),pixels=context.createImageData(target.width,target.height);
    let left=target.width,top=target.height,right=-1,bottom=-1;
    for(let y=0;y<target.height;y++)for(let x=0;x<target.width;x++){
      const src=((target.height-y-1)*target.width+x)*4,dst=(y*target.width+x)*4,a=raw[src+3];
      pixels.data[dst+3]=a;
      for(let c=0;c<3;c++)pixels.data[dst+c]=a?Math.min(255,raw[src+c]*255/a):0;
      if(a>12){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    context.putImageData(pixels,0,0);this.flowerDirty=true;this.render();
    if(right<left)throw new Error('当前设置下没有可导出的花朵');
    const icon=document.createElement('canvas');icon.width=icon.height=512;
    const w=right-left+1,h=bottom-top+1,side=Math.max(w,h)*1.1;
    const ctx=icon.getContext('2d');ctx.imageSmoothingQuality='high';
    ctx.drawImage(capture,left,top,w,h,(side-w)*256/side,(side-h)*256/side,w*512/side,h*512/side);
    return icon.toDataURL('image/png');
  }
  diagnostics() {
    const gl=this.gpu.gl,errors=[];let error;
    while((error=gl.getError())!==gl.NO_ERROR)errors.push(error);
    return {ready:this.ready,webgl2:true,canvas:[this.canvas.width,this.canvas.height],
      waterGrid:this.water.resolution,causticGrid:this.caustics.grid.resolution,causticSize:this.caustics.targets[0].width,
      flowerTexture:[this.flower.target.width,this.flower.target.height],camera:[...this.scene.camera],
      nativeDropIndex:this.flower.dropIndex,
      lastNativeDrop:Array.from(this.flower.drops.slice(((this.flower.dropIndex+9)%10)*4,((this.flower.dropIndex+9)%10)*4+4)),
      flower:this.scene.objectTransform(this.state),waterY:2.5,waterTime:this.water.time,
      resources:{...this.gpu.resources},drawCalls:this.gpu.drawCalls,shaderErrors:[...this.gpu.errors],glErrors:errors,fps:this.fps};
  }
  debugWater() {
    const gl=this.gpu.gl,n=this.water.resolution,pixels=new Float32Array(n*n*4);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.water.targets[this.water.current].framebuffer);
    gl.readPixels(0,0,n,n,gl.RGBA,gl.FLOAT,pixels);
    let min=Infinity,max=-Infinity,energy=0,finite=true;
    for(let i=0;i<pixels.length;i+=4){min=Math.min(min,pixels[i]);max=Math.max(max,pixels[i]);energy+=pixels[i]*pixels[i];finite=finite&&Number.isFinite(pixels[i])&&Number.isFinite(pixels[i+1]);}
    this.render();return {min,max,energy:energy/(n*n),finite};
  }
}
function setSceneReady(ready) {
  document.documentElement.toggleAttribute('data-scene-ready',ready);
  if(window.HomeBlossom)window.HomeBlossom.ready=ready;
  if(!STUDIO_MODE&&parent!==window)parent.postMessage({type:ready?'home-blossom-ready':'home-blossom-error'},location.origin);
}
function showFailure(error) {
  console.error(error);setSceneReady(false);
  if(!STUDIO_MODE)return;
  const loading=document.getElementById('loading');loading.hidden=false;loading.classList.add('error');
  loading.textContent=error.message;const button=document.createElement('button');button.textContent='重新载入';button.onclick=()=>location.reload();loading.appendChild(button);
}
let studio;
try{studio=new Studio();studio.init().catch(showFailure);}catch(error){showFailure(error);}
