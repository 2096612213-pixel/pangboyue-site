/* Original WebGL2 implementation of the standard Stable Fluids pipeline.
 * rtfs2d informed the solver stages; no Vulkan source or third-party code is embedded.
 * Velocities live on right/top cell faces (MAC grid); glyphs are solid cells.
 * This is an interactive visual approximation, not an engineering CFD solver.
 */
(() => {
  'use strict';
  const tank = document.querySelector('#fluid-tank');
  if (!tank) return;
  const canvas = tank.querySelector('.tank-fluid');
  const lettering = tank.querySelector('.tank-lettering');
  function setStatus(text) { canvas.setAttribute('aria-label', text); }
  const pauseButton = tank.querySelector('.tank-pause');
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse) tank.dataset.touch = 'ink';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches, visible = true, lost = false, failed = false;
  let raf = 0, previous = 0, elapsed = 0, frameCount = 0, slowFrames = 0;
  let quality = coarse ? 1 : 2, targetFPS = coarse ? 30 : 60;
  let W = 0, H = 0, displayW = 0, displayH = 0, pendingResize = true, maskDirty = true;
  let lastMask = 0, lastSample = 0, lastQuality = 0, measuredFPS = 0;
  let pointer = null, pendingSplats = [], hue = 0;
  let fields, maskTexture, emptyVAO, maskPixels;
  const programs = [];
  const gl = canvas.getContext('webgl2', { alpha: false, depth: false, stencil: false,
    antialias: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  const labelContext = lettering.getContext('2d');
  const maskCanvas = document.createElement('canvas');
  const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
  const diagnostics = { state: 'initializing', fps: 0, steps: 0, grid: '', glyphCells: 0,
    pointerInjections: 0, quality: 0, error: null };
  // Read-only diagnostic snapshot; no GPU readbacks in normal animation.
  Object.defineProperty(tank, 'fluidStats', { get: () => ({ ...diagnostics }) });
  function fallback(error) {
    failed = true; cancelAnimationFrame(raf); raf = 0;
    diagnostics.state = 'static'; diagnostics.error = String(error);
    tank.classList.remove('fluid-ready'); canvas.hidden = true; canvas.style.display = 'none';
    lettering.style.display = 'none';
    setStatus('静态玻璃缸 · 当前浏览器未启用流体效果');
    pauseButton.disabled = true;
    console.warn('Fluid tank:', error);
  }
  if (!gl || !labelContext || !maskContext || !gl.getExtension('EXT_color_buffer_float')) {
    fallback('WebGL2 floating-point render targets unavailable'); return;
  }
  const vertex = `#version 300 es
  precision highp float;
  out vec2 uv;
  void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); uv=p; gl_Position=vec4(p*2.-1.,0.,1.); }`;
  const common = `#version 300 es
  precision highp float;
  precision highp sampler2D;
  in vec2 uv; out vec4 result;
  uniform sampler2D source, velocity, obstacle, pressure, divergence, curlField;
  uniform vec2 px, dimensions;
  uniform float dt, clockTime, inlet;
  vec3 palette(float t){
    float q=fract(t)*5.; float f=smoothstep(.15,.85,fract(q));
    vec3 blue=vec3(.03,.28,1.), green=vec3(.02,.9,.22), yellow=vec3(1.,.77,.025);
    vec3 purple=vec3(.65,.07,1.), red=vec3(1.,.055,.09);
    if(q<1.) return mix(blue,green,f);
    if(q<2.) return mix(green,yellow,f);
    if(q<3.) return mix(yellow,purple,f);
    if(q<4.) return mix(purple,red,f);
    return mix(red,blue,f);
  }
  float solid(vec2 p){
    if(p.y<px.y || p.y>1.-px.y) return 1.;
    if(p.x<0. || p.x>1.) return 0.;
    return step(.12,texture(obstacle,p).a);
  }
  vec4 bilerp(sampler2D tex,vec2 p){
    vec2 size=vec2(textureSize(tex,0)); vec2 q=p*size-.5;
    vec2 i=floor(q), f=fract(q); vec2 a=(i+.5)/size, d=1./size;
    return mix(mix(texture(tex,a),texture(tex,a+vec2(d.x,0)),f.x),
      mix(texture(tex,a+vec2(0,d.y)),texture(tex,a+d),f.x),f.y);
  }
  vec2 flow(vec2 p){return vec2(bilerp(velocity,p-vec2(px.x*.5,0)).x,
    bilerp(velocity,p-vec2(0,px.y*.5)).y);}
  vec2 trace(vec2 p,vec2 v){
    vec2 back=clamp(p-dt*v*px,px*.5,1.-px*.5); vec2 last=p;
    for(int i=1;i<=6;i++){vec2 q=mix(p,back,float(i)/6.); if(solid(q)>.5) break; last=q;}
    return last;
  }
  vec2 boundary(vec2 v){
    if(solid(uv)>.5) return vec2(0);
    if(solid(uv+vec2(px.x,0))>.5) v.x=0.;
    if(solid(uv+vec2(0,px.y))>.5) v.y=0.;
    if(uv.x<px.x*2.) v=vec2(inlet,0.);
    // Open right outlet: zero-pressure projection, no incoming backflow.
    if(uv.x>1.-px.x*2.) v.x=max(v.x,0.);
    return clamp(v,vec2(-95.),vec2(95.));
  }
  `;
  function program(body, extra = '') {
    function compile(type, code) {
      const s = gl.createShader(type); gl.shaderSource(s, code); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(info);
      }
      return s;
    }
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, common + extra + body);
    const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const uniforms = new Map();
    const obj = { p, location(name) { if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(p, name)); return uniforms.get(name); } };
    programs.push(obj); return obj;
  }
  let advect, divergencePass, pressurePass, project, curlPass, swirl, dyePass, splat, display, seed;
  try {
    emptyVAO = gl.createVertexArray(); gl.bindVertexArray(emptyVAO);
    advect = program(`void main(){
      vec2 fx=uv+vec2(px.x*.5,0), fy=uv+vec2(0,px.y*.5);
      vec2 v=vec2(bilerp(source,trace(fx,flow(fx))-vec2(px.x*.5,0)).x,
                  bilerp(source,trace(fy,flow(fy))-vec2(0,px.y*.5)).y);
      v*=exp(-dt*.08);
      // Gentle distributed drive maintains through-flow despite numerical dissipation.
      v.x+=(inlet-v.x)*(1.-exp(-dt*.45));
      result=vec4(boundary(v),0,1);
    }`);
    curlPass = program(`void main(){
      vec2 l=flow(uv-vec2(px.x,0)),r=flow(uv+vec2(px.x,0));
      vec2 b=flow(uv-vec2(0,px.y)),t=flow(uv+vec2(0,px.y));
      result=vec4(.5*(r.y-l.y-t.x+b.x),0,0,1);
    }`);
    swirl = program(`void main(){
      float c=texture(curlField,uv).x;
      vec2 n=vec2(abs(texture(curlField,uv+vec2(px.x,0)).x)-abs(texture(curlField,uv-vec2(px.x,0)).x),
                  abs(texture(curlField,uv+vec2(0,px.y)).x)-abs(texture(curlField,uv-vec2(0,px.y)).x));
      n/=(length(n)+.0001);
      vec2 v=texture(source,uv).xy+dt*2.8*vec2(n.y,-n.x)*c;
      result=vec4(boundary(v),0,1);
    }`);
    divergencePass = program(`void main(){
      if(solid(uv)>.5){result=vec4(0);return;}
      vec2 c=texture(velocity,uv).xy;
      float l=texture(velocity,uv-vec2(px.x,0)).x;
      float b=texture(velocity,uv-vec2(0,px.y)).y;
      result=vec4(c.x-l+c.y-b,0,0,1);
    }`);
    pressurePass = program(`void main(){
      if(solid(uv)>.5){result=vec4(0);return;}
      vec2 l=uv-vec2(px.x,0),r=uv+vec2(px.x,0),b=uv-vec2(0,px.y),t=uv+vec2(0,px.y);
      float pc=texture(pressure,uv).x;
      float pl=solid(l)>.5||l.x<0.?pc:texture(pressure,l).x;
      float pr=solid(r)>.5?pc:(r.x>1.?0.:texture(pressure,r).x);
      float pb=solid(b)>.5?pc:texture(pressure,b).x;
      float pt=solid(t)>.5?pc:texture(pressure,t).x;
      result=vec4((pl+pr+pb+pt-texture(divergence,uv).x)*.25,0,0,1);
    }`);
    project = program(`void main(){
      float c=texture(pressure,uv).x;
      float r=uv.x+px.x>1.?0.:texture(pressure,uv+vec2(px.x,0)).x;
      float t=texture(pressure,uv+vec2(0,px.y)).x;
      vec2 v=texture(velocity,uv).xy-vec2(r-c,t-c);
      result=vec4(boundary(v),0,1);
    }`);
    dyePass = program(`void main(){
      if(solid(uv)>.5){result=vec4(0);return;}
      vec3 ink=bilerp(source,trace(uv,flow(uv))).rgb*exp(-dt*.075);
      if(uv.x<px.x*3.) {
        float bands=pow(.5+.5*sin(uv.y*28.+sin(clockTime*.6+uv.y*7.)*1.8),8.);
        vec3 color=palette(uv.y+clockTime*.012);
        ink=mix(ink,color*(.22+1.8*bands),1.-exp(-dt*8.));
      }
      // Feather dye at the open exit instead of accumulating a colored edge.
      ink*=exp(-dt*8.*smoothstep(.97,1.,uv.x));
      result=vec4(ink,1);
    }`);
    splat = program(`void main(){
      vec2 p=uv-point; p.x*=dimensions.x/dimensions.y;
      float weight=exp(-dot(p,p)/(radius*radius));
      vec4 value=texture(source,uv);
      if(isVelocity==1) result=vec4(boundary(value.xy+force*weight),0,1);
      else result=solid(uv)>.5?vec4(0):vec4(min(value.rgb+color*weight,vec3(3.)),1);
    }`, 'uniform vec2 point,force; uniform vec3 color; uniform float radius; uniform int isVelocity;\n');
    seed = program(`void main(){
      if(isVelocity==1) result=vec4(boundary(vec2(inlet,0)),0,1);
      else {
        float waves=pow(.5+.5*sin(uv.y*28.+sin(uv.x*9.)*1.3),10.);
        vec3 color=palette(uv.y);
        result=solid(uv)>.5?vec4(0):vec4(color*(.12+waves)*(.6+.4*(1.-uv.x)),1);
      }
    }`, 'uniform int isVelocity;\n');
    display = program(`void main(){
      vec3 d=max(bilerp(source,uv).rgb,vec3(0));
      vec3 base=mix(vec3(.036,.055,.073),vec3(.052,.080,.092),uv.y);
      vec3 color=base+vec3(1.)-exp(-d*2.7);
      float edge=pow(max(abs(uv.x-.5)*2.,abs(uv.y-.5)*2.),14.);
      color*=1.-.25*edge;
      result=vec4(color,1);
    }`);
    maskTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  } catch (e) { fallback(e); return; }
  function target(w, h) {
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(fbo); gl.deleteTexture(texture); throw new Error('Float framebuffer incomplete');
    }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    return { texture, fbo, w, h };
  }
  function pair(w,h) { return { read: target(w,h), write: target(w,h), swap() { [this.read,this.write]=[this.write,this.read]; } }; }
  function dispose() {
    if (!fields) return;
    for (const f of Object.values(fields)) for (const t of f.read ? [f.read,f.write] : [f]) {
      gl.deleteTexture(t.texture); gl.deleteFramebuffer(t.fbo);
    }
    fields = null;
  }
  function draw(p, dest, textures = {}, values = {}) {
    gl.useProgram(p.p); gl.bindVertexArray(emptyVAO);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dest ? dest.fbo : null);
    gl.viewport(0, 0, dest ? dest.w : canvas.width, dest ? dest.h : canvas.height);
    gl.uniform2f(p.location('px'), 1/W, 1/H);
    gl.uniform2f(p.location('dimensions'), W, H);
    gl.uniform1f(p.location('dt'), stepDT);
    gl.uniform1f(p.location('clockTime'), elapsed);
    gl.uniform1f(p.location('inlet'), W * .07);
    let unit=0;
    for (const [name, texture] of Object.entries({ obstacle: maskTexture, ...textures })) {
      gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D, texture.texture || texture);
      gl.uniform1i(p.location(name),unit++);
    }
    for(const [name, value] of Object.entries(values)) {
      const l=p.location(name);
      if(name==='isVelocity') gl.uniform1i(l,value);
      else if(Array.isArray(value)) {
        if(value.length===2) gl.uniform2f(l,...value); else gl.uniform3f(l,...value);
      } else gl.uniform1f(l,value);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  let stepDT=1/60;
  // The identical rasterized glyph image is both the visible lettering and obstacle mask.
  function drawLetters() {
    const rect=canvas.getBoundingClientRect(), sx=lettering.width/rect.width, sy=lettering.height/rect.height;
    labelContext.setTransform(sx,0,0,sy,0,0);
    labelContext.clearRect(0,0,rect.width,rect.height);
    const range=document.createRange();
    for(const block of tank.querySelectorAll('.welcome-text, .beijing-time')) {
      const style=getComputedStyle(block);
      labelContext.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      labelContext.fillStyle=style.color;
      labelContext.textBaseline='alphabetic';
      const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
      let node;
      while((node=walker.nextNode())) {
        let offset=0;
        for(const character of node.textContent) {
          range.setStart(node,offset); offset+=character.length; range.setEnd(node,offset);
          const r=range.getBoundingClientRect(); if(!r.width || !r.height) continue;
          const m=labelContext.measureText(character);
          const ascent=m.fontBoundingBoxAscent ?? parseFloat(style.fontSize)*.85;
          const descent=m.fontBoundingBoxDescent ?? parseFloat(style.fontSize)*.2;
          const baseline=r.top-rect.top+(r.height-ascent-descent)*.5+ascent;
          labelContext.fillText(character,r.left-rect.left,baseline);
        }
      }
    }
    maskContext.clearRect(0,0,W,H);
    maskContext.drawImage(lettering,0,0,W,H);
    // Normalize translucent clock glyphs; leave only the glyph silhouettes solid.
    maskPixels=maskContext.getImageData(0,0,W,H);
    let count=0;
    for(let i=3;i<maskPixels.data.length;i+=4) {
      const on=maskPixels.data[i]>24; maskPixels.data[i]=on?255:0; if(on) count++;
    }
    maskContext.putImageData(maskPixels,0,0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,maskTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,maskCanvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    diagnostics.glyphCells=count; maskDirty=false;
  }
  function resize() {
    const rect=canvas.getBoundingClientRect(); if(rect.width<1||rect.height<1) return;
    const aspect=rect.width/rect.height;
    const longSide=[320,400,560][quality];
    W=aspect>=1?longSide:Math.round(longSide*aspect);
    H=aspect>=1?Math.round(longSide/aspect):longSide;
    const scale=Math.min(1,Math.sqrt((coarse?90000:160000)/(W*H)));
    W=Math.round(W*scale); H=Math.round(H*scale);
    const dpr=Math.min(devicePixelRatio||1,coarse?1.5:1.75);
    canvas.width=Math.min(1920,Math.round(rect.width*dpr));
    canvas.height=Math.round(canvas.width/aspect);
    lettering.width=Math.round(rect.width*Math.min(devicePixelRatio||1,2));
    lettering.height=Math.round(rect.height*Math.min(devicePixelRatio||1,2));
    displayW=rect.width; displayH=rect.height;
    maskCanvas.width=W; maskCanvas.height=H;
    dispose();
    fields={ v:pair(W,H), p:pair(W,H), d:pair(W*2,H*2), div:target(W,H), curl:target(W,H) };
    drawLetters(); seedFields(); pendingResize=false;
    diagnostics.grid=`${W} × ${H}`; diagnostics.quality=quality;
    tank.classList.add('fluid-ready');
  }
  function seedFields() {
    draw(seed,fields.v.read,{}, {isVelocity:1});
    draw(seed,fields.d.read,{}, {isVelocity:0});
    // Settle inlet/obstacle pressure before the first visible frame.
    for(let i=0;i<8;i++) projectVelocity(24);
  }
  function projectVelocity(iterations) {
    // Solve for this step's pressure correction; stale pressure biases short Jacobi solves.
    gl.bindFramebuffer(gl.FRAMEBUFFER,fields.p.read.fbo);
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    draw(divergencePass,fields.div,{velocity:fields.v.read});
    for(let i=0;i<iterations;i++) {
      draw(pressurePass,fields.p.write,{pressure:fields.p.read,divergence:fields.div}); fields.p.swap();
    }
    draw(project,fields.v.write,{velocity:fields.v.read,pressure:fields.p.read}); fields.v.swap();
  }
  function addInk(x,y,dx=0,dy=0) {
    if(paused||failed||lost) return;
    pendingSplats.push({x,y,dx,dy,hue: hue++}); if(pendingSplats.length>12) pendingSplats.shift();
    diagnostics.pointerInjections++; schedule();
  }
  function inject(s) {
    const colors=[[.03,.28,1],[.02,.9,.22],[1,.77,.025],[.65,.07,1],[1,.055,.09]];
    const point=[s.x,1-s.y], radius=coarse?.055:.042;
    const force=[Math.max(-70,Math.min(70,s.dx*W*5)),Math.max(-70,Math.min(70,-s.dy*H*5))];
    draw(splat,fields.v.write,{source:fields.v.read},{point,force,radius,isVelocity:1,color:[0,0,0]}); fields.v.swap();
    draw(splat,fields.d.write,{source:fields.d.read},{point,force:[0,0],radius,isVelocity:0,color:colors[Math.floor(s.hue/24)%colors.length]}); fields.d.swap();
  }
  function simulate() {
    draw(advect,fields.v.write,{source:fields.v.read,velocity:fields.v.read}); fields.v.swap();
    for(const s of pendingSplats) inject(s); pendingSplats.length=0;
    draw(curlPass,fields.curl,{velocity:fields.v.read});
    draw(swirl,fields.v.write,{source:fields.v.read,curlField:fields.curl}); fields.v.swap();
    projectVelocity([14,18,24][quality]);
    draw(dyePass,fields.d.write,{source:fields.d.read,velocity:fields.v.read}); fields.d.swap();
    diagnostics.steps++;
  }
  function render() { draw(display,null,{source:fields.d.read}); }
  function shouldRun() { return !paused && visible && !document.hidden && !lost && !failed; }
  function schedule() { if(!raf && shouldRun()) raf=requestAnimationFrame(frame); }
  function frame(now) {
    raf=0; if(!shouldRun()) return;
    try {
      if(previous && now-previous<1000/targetFPS-2) { schedule(); return; }
      const interval=previous?now-previous:1000/targetFPS; previous=now;
      stepDT=Math.min(interval/1000,1/30); elapsed+=stepDT;
      if(pendingResize) resize();
      if(maskDirty && now-lastMask>900) { drawLetters(); lastMask=now; }
      simulate(); render();
      diagnostics.state='running'; frameCount++;
      if(!lastSample) lastSample=now;
      if(now-lastSample>2000) {
        measuredFPS=frameCount*1000/(now-lastSample); diagnostics.fps=Math.round(measuredFPS);
        frameCount=0; lastSample=now;
        if(measuredFPS<targetFPS*.68) slowFrames++; else slowFrames=0;
        if(slowFrames>=2 && now-lastQuality>7000) {
          if(quality>0) {quality--; pendingResize=true;} else targetFPS=30;
          slowFrames=0; lastQuality=now;
        }
      }
      schedule();
    } catch(e) { fallback(e); }
  }
  function syncPause() {
    pauseButton.textContent=paused?'播放':'暂停'; pauseButton.setAttribute('aria-pressed',String(paused));
    setStatus(paused?'流体已暂停，点播放继续':'流体互动区域：点击加墨，按住拖动搅动');
    cancelAnimationFrame(raf); raf=0; previous=0; lastSample=0; frameCount=0;
    diagnostics.state=paused?'paused':'waiting';
    if(!paused) schedule();
  }
  pauseButton.addEventListener('click',()=>{paused=!paused; syncPause();});
  reduced.addEventListener('change',e=>{paused=e.matches; syncPause();});
  function position(e) { const r=canvas.getBoundingClientRect(); return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}; }
  canvas.addEventListener('pointerdown',e=>{
    if(paused || (e.pointerType==='mouse' && e.button!==0) || pointer) return;
    const p=position(e); pointer={id:e.pointerId,...p,start:p,moved:false,touch:e.pointerType==='touch'};
    if(e.pointerType!=='touch'||tank.dataset.touch==='ink') {
      canvas.setPointerCapture(e.pointerId); addInk(p.x,p.y);
    }
  });
  canvas.addEventListener('pointermove',e=>{
    if(!pointer||e.pointerId!==pointer.id) return;
    const p=position(e), dx=p.x-pointer.x,dy=p.y-pointer.y;
    if(Math.hypot((p.x-pointer.start.x)*displayW,(p.y-pointer.start.y)*displayH)>8) pointer.moved=true;
    if(!pointer.touch||tank.dataset.touch==='ink') {
      const n=Math.min(5,Math.max(1,Math.ceil(Math.hypot(dx*W,dy*H)/4)));
      for(let i=1;i<=n;i++) addInk(pointer.x+dx*i/n,pointer.y+dy*i/n,dx/n,dy/n);
    }
    pointer.x=p.x; pointer.y=p.y;
  });
  canvas.addEventListener('pointerup',e=>{
    if(pointer && pointer.id===e.pointerId) {
      if(pointer.touch && tank.dataset.touch!=='ink' && !pointer.moved) addInk(pointer.x,pointer.y);
      pointer=null; if(canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    }
  });
  for(const event of ['pointercancel','lostpointercapture']) canvas.addEventListener(event,()=>{pointer=null;});
  const resizeObserver=new ResizeObserver(()=>{pendingResize=true; if(paused && visible && !document.hidden && !failed && !lost) {try{resize(); render();}catch(e){fallback(e);}} else schedule();});
  resizeObserver.observe(tank);
  const mutationObserver=new MutationObserver(()=>{maskDirty=true; if(paused && visible && !document.hidden && !failed && !lost && fields) drawLetters();});
  mutationObserver.observe(tank.querySelector('.tank-copy'),{childList:true,subtree:true,characterData:true});
  const intersectionObserver=new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting; previous=0; lastSample=0; frameCount=0;
    if(!visible) {cancelAnimationFrame(raf);raf=0;diagnostics.state='offscreen';}
    else if(paused && fields && !failed && !lost) {drawLetters();render();} else schedule();
  },{threshold:0}); intersectionObserver.observe(tank);
  document.addEventListener('visibilitychange',()=>{
    previous=0; lastSample=0; frameCount=0;
    if(document.hidden) {cancelAnimationFrame(raf);raf=0;diagnostics.state='hidden';}
    else if(paused && visible && fields && !failed && !lost) {drawLetters();render();} else schedule();
  });
  canvas.addEventListener('webglcontextlost',e=>{
    e.preventDefault(); lost=true; cancelAnimationFrame(raf);raf=0;diagnostics.state='context-lost';
    setStatus('动画暂时暂停，正在等待图形恢复');
  });
  // A restored context invalidates every shader and texture. Preserve readable content.
  canvas.addEventListener('webglcontextrestored',()=>{
    // Keep a readable static panel; a page refresh safely creates a new context and resources.
    fallback('Graphics context restored; refresh to resume animation');
    setStatus('图形已恢复 · 刷新页面继续动画');
  });
  document.fonts.ready.then(()=>{maskDirty=true; if(paused && visible && !document.hidden && fields && !failed&&!lost) drawLetters();});
  try {resize(); render(); syncPause();} catch(e) {fallback(e);}
})();
