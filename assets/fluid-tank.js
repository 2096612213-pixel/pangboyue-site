/* Procedural layered cloud rendering using the previous hero's WebGL pipeline.
 * Domain-warped density is advected left to right at different depths; this is
 * a visual atmosphere model, not a meteorological or full volumetric solver.
 * Moon surface is a locally drawn SVG; ephemerides use vendored MIT Astronomy Engine.
 * Scattering is an artistic eight-level optical approximation, not weather data.
 */
(() => {
  'use strict';
  const tank = document.querySelector('#fluid-tank');
  if (!tank) return;
  const canvas = tank.querySelector('.tank-fluid');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Only the first archive entrance receives the reveal behavior.
  const first = document.querySelector('a.archive-card[href="rhine/index.html"]');
  if (first && !reduced.matches && 'IntersectionObserver' in window) {
    const reveal = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        first.classList.add('is-visible'); reveal.disconnect();
      }
    }, { threshold: .08 });
    first.classList.add('archive-reveal'); reveal.observe(first);
    first.addEventListener('focus', () => first.classList.add('is-visible'));
  }
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  let paused = reduced.matches, visible = true, failed = false, raf = 0, previous = 0, time = 0;
  let nextFlash = 5 + Math.random() * 5, frames = 0;
  let glows = [];
  const stats = { state: 'initializing', frames: 0, flashes: 0, error: null };
  // Pick one cloud field per page load; keep it fixed while the scene animates.
  const cloudSeed = new Float32Array(4);
  if (window.crypto && window.crypto.getRandomValues) {
    const values = new Uint32Array(4);
    window.crypto.getRandomValues(values);
    for (let i = 0; i < 4; i++) cloudSeed[i] = values[i] / 4294967296 * 128;
  } else {
    for (let i = 0; i < 4; i++) cloudSeed[i] = Math.random() * 128;
  }
  stats.cloudSeed = Array.from(cloudSeed);
  Object.defineProperty(tank, 'cloudStats', { get: () => ({ ...stats, time, resolution: [canvas.width, canvas.height], audio: window.StormSound?.diagnostics }) });
  function fallback(e) {
    failed = true; cancelAnimationFrame(raf); raf = 0;
    canvas.style.display = 'none';
    stats.state = 'static'; stats.error = String(e);
    console.warn('Storm clouds:', e);
  }
  if (!gl) { fallback('WebGL2 unavailable'); return; }
  const vertex = `#version 300 es
  out vec2 uv;
  void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0,1);}`;
  const fragment = `#version 300 es
  precision highp float;
  in vec2 uv; out vec4 result;
  uniform vec2 resolution;
  uniform float clockTime;
  uniform vec4 cloudSeed;
  uniform sampler2D moonSurface;
  uniform vec4 moon; // center x/y, radius in viewport heights, illuminated fraction
  uniform vec2 moonLight; // signed horizontal and view-facing solar direction
  uniform vec4 glow0, glow1;
  uniform vec4 event0, event1;
  float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
  float fbm(vec2 p){float s=0.,a=.52;for(int i=0;i<5;i++){s+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+7.3;a*=.49;}return s;}
  float density(vec2 p){vec2 w=vec2(fbm(p*.63+2.),fbm(p*.63-8.));return fbm(p+w*2.1);}
  // Eight reference transmission levels, smoothly interpolated to avoid bands.
  float transmit(float thin){
    float levels[8]=float[8](.012,.035,.080,.155,.27,.43,.62,.82);
    float v=clamp(thin,0.,1.)*7.;int k=min(6,int(floor(v)));
    return mix(levels[k],levels[k+1],smoothstep(0.,1.,v-float(k)));
  }
  float cloudOpening(vec2 world){
    vec2 p=world*5.1+vec2(-clockTime*.018,19.7)+cloudSeed.zw;
    return smoothstep(.32,.68,density(p));
  }
  void main(){
    float aspect=resolution.x/resolution.y;
    vec2 world=vec2(uv.x*aspect,uv.y);
    vec3 col=mix(vec3(.035,.048,.062),vec3(.28,.36,.41),uv.y);
    float thinSum=0.;
    vec3 unlitCloud=col;
    for(int i=0;i<3;i++){
      float layer=float(i);
      vec2 p=world*(3.2+layer*1.9)+vec2(-clockTime*(.012+layer*.005),layer*19.7)
        +mix(cloudSeed.xy,cloudSeed.zw,layer*.5);
      p.y+=sin(clockTime*.018+layer)*.09;
      float d=density(p);
      float shape=smoothstep(.27,.70,d);
      float layerOpening=smoothstep(.30,.67,d);
      thinSum+=layerOpening/3.;
      float rim=max(0.,density(p+vec2(-.09,.12))-d);
      vec3 cloud=mix(vec3(.043,.060,.077),vec3(.34,.40,.43),smoothstep(.31,.73,d));
      cloud+=rim*vec3(.50,.55,.57);
      unlitCloud=mix(unlitCloud,cloud,.46+shape*.25);
      // Soft light sources behind the cloud layers, with no lightning geometry.
      for(int j=0;j<2;j++){
        vec4 source=j==0?glow0:glow1;
        vec4 event=j==0?event0:event1;
        vec2 delta=world-vec2(source.x*aspect,source.y);
        float c=cos(event.z),s=sin(event.z);
        delta=mat2(c,-s,s,c)*delta;
        vec2 radius=max(source.zw*(1.+event.y*.65+layer*.10),vec2(.001));
        float halo=exp(-dot(delta/radius,delta/radius)*1.65);
        float transmission=exp(-shape*(.8+event.y*2.4));
        cloud+=vec3(.66,.74,.90)*halo*event.x*(.3+shape)*transmission*3.2;
      }
      col=mix(col,cloud,.46+shape*.25);
    }
    vec2 center=vec2(moon.x*aspect,moon.y);
    vec2 delta=world-center;
    thinSum=smoothstep(.20,.78,thinSum);
    // Exactly zero in the darkest cloud cores, fading smoothly at their edges.
    // Match the visible cloud composite, rather than letting the darkest of
    // three hidden layers veto every other layer. Lightning cannot open gaps.
    float cloudLuminance=dot(unlitCloud,vec3(.2126,.7152,.0722));
    float moonVisibility=smoothstep(.075,.135,cloudLuminance);
    float dist=length(delta), transmission=transmit(thinSum)*moonVisibility;
    float lunarPower=pow(moon.w,1.5);
    // Circular disc with a spherical terminator; waxing is lit on the right.
    vec2 q=delta/moon.z;
    float edge=1.-smoothstep(.965,1.,length(q));
    if(edge>0.){
      float z=sqrt(max(0.,1.-dot(q,q)));
      float incidence=q.x*moonLight.x+z*moonLight.y;
      float lit=smoothstep(-.015,.035,incidence);
      // Sample inside the SVG's transparent limb, respecting coverage.
      vec2 surfaceQ=q*min(1.,.98/max(length(q),.001));
      vec4 texel=texture(moonSurface,surfaceQ*.5+.5);
      vec3 surface=texel.rgb;
      vec3 moonColor=surface*vec3(.84,.88,.94)*(.48+.52*sqrt(max(incidence,0.)));
      // Moonlight adds radiance behind the clouds; it must not darken a bright
      // cloud into a black rim when the lunar limb is shaded.
      col+=moonColor*edge*lit*texel.a*min(.90,transmission*1.5);
    }
    // Radial shadow samples originate at the moon, so shafts follow moving gaps.
    float rays=0.;
    for(int k=1;k<=6;k++){
      vec2 samplePoint=center+delta*(float(k)/7.);
      rays+=transmit(cloudOpening(samplePoint))/6.;
    }
    float outward=smoothstep(moon.z*.9,moon.z*2.5,dist);
    float falloff=exp(-dist*5.5);
    float shafts=pow(rays,1.35)*outward*falloff*(.25+thinSum*.75);
    float halo=exp(-dist*dist/(moon.z*moon.z*12.))*(.12+transmission*.40);
    col+=vec3(.57,.66,.82)*lunarPower*(halo*.65+shafts*1.25)*moonVisibility;
    float fade=smoothstep(.03,.85,uv.y);
    col=mix(vec3(.0588235),col,fade);
    result=vec4(col,1.);
  }`;
  let program;
  try {
    function compile(type, source) {
      const shader=gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    const vs=compile(gl.VERTEX_SHADER,vertex), fs=compile(gl.FRAGMENT_SHADER,fragment);
    program=gl.createProgram(); gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);gl.bindVertexArray(gl.createVertexArray());
  } catch(e) { fallback(e); return; }
  const locations=Object.fromEntries(['resolution','clockTime','cloudSeed','glow0','glow1','event0','event1','moonSurface','moon','moonLight'].map(n=>[n,gl.getUniformLocation(program,n)]));
  const moonTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,moonTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([190,190,180,255]));
  gl.uniform1i(locations.moonSurface,0);
  const moonImage=new Image();
  moonImage.onload=()=>{
    if(failed)return;
    gl.bindTexture(gl.TEXTURE_2D,moonTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,moonImage);draw();
  };
  moonImage.src=new URL('moon-surface.svg',document.querySelector('script[src*="fluid-tank.js"]').src).href;
  let moonFraction=0,moonX=0,moonZ=-1,lastMoonUpdate=0;
  function updateMoon(now=Date.now()){
    if(now-lastMoonUpdate<60000)return;
    lastMoonUpdate=now;
    if(!window.Astronomy){stats.moonError='Astronomy library unavailable';return;}
    const date=new Date(now), info=Astronomy.Illumination('Moon',date);
    const phase=Astronomy.MoonPhase(date),angle=info.phase_angle*Math.PI/180;
    moonFraction=info.phase_fraction;moonX=Math.sin(angle)*(phase<180?1:-1);moonZ=Math.cos(angle);
    tank.dataset.moonIllumination=(moonFraction*100).toFixed(2);
    tank.dataset.moonPhase=phase<180?'waxing':'waning';
    tank.dataset.moonDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(date);
    stats.moon={fraction:moonFraction,phaseDegrees:phase,beijingDate:tank.dataset.moonDate};
  }
  const random=(a,b)=>a+Math.random()*(b-a);
  function makeGlow(){
    const size=random(.065,.29);
    return {
      x:random(.08,.92),y:random(.38,.88),
      radiusX:size*random(.75,1.55),radiusY:size*random(.65,1.25),
      depth:random(.08,.95),angle:random(0,Math.PI),
      brightness:random(.25,1.55),start:time+random(0,.16),
      duration:random(.45,.85),echo:random(.14,.30),
      attack:random(.045,.085),echoStrength:random(.2,.7)
    };
  }
  function resize(){
    const r=tank.getBoundingClientRect();
    // Render below device resolution: the soft atmosphere needs no retina buffer.
    const scale=Math.min(.7,1100/r.width,800/r.height);
    canvas.width=Math.max(1,Math.round(r.width*scale));canvas.height=Math.max(1,Math.round(r.height*scale));
    draw();
  }
  function draw(){
    if(failed)return;
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.uniform2f(locations.resolution,canvas.width,canvas.height);
    gl.uniform1f(locations.clockTime,time);
    gl.uniform4fv(locations.cloudSeed,cloudSeed);
    updateMoon();
    const mobile=canvas.width/canvas.height<.85;
    gl.uniform4f(locations.moon,mobile?.76:.79,mobile?.80:.77,mobile?.034:.046,moonFraction);
    gl.uniform2f(locations.moonLight,moonX,moonZ);
    for(let i=0;i<2;i++){
      const glow=glows[i];let strength=0;
      if(glow&&!paused&&!reduced.matches){
        const age=time-glow.start;
        if(age>=0&&age<glow.duration){
          strength=(Math.exp(-Math.pow((age-.09)/glow.attack,2))+
            glow.echoStrength*Math.exp(-Math.pow((age-glow.echo)/.10,2)))*glow.brightness;
        }
      }
      gl.uniform4f(locations['glow'+i],glow?glow.x:0,glow?glow.y:0,glow?glow.radiusX:.1,glow?glow.radiusY:.1);
      gl.uniform4f(locations['event'+i],strength,glow?glow.depth:1,glow?glow.angle:0,0);
    }
    gl.drawArrays(gl.TRIANGLES,0,3);
    stats.frames=++frames;
  }
  function running(){return !paused&&!failed&&visible&&!document.hidden;}
  function schedule(){if(!raf&&running())raf=requestAnimationFrame(frame);}
  function frame(now){
    raf=0;if(!running())return;
    if(previous&&now-previous<32){schedule();return;}
    time+=previous?(now-previous)/1000:0;previous=now;
    if(time>=nextFlash){
      glows=Array.from({length:Math.random()<.5?1:2},makeGlow);
      for (const glow of glows) window.StormSound?.schedule(glow, time);
      nextFlash=time+5+Math.random()*5;stats.flashes++;stats.glows=glows.length;
      stats.lastFlashTime=time;
    }
    draw();stats.state='running';schedule();
  }
  function sync(){
    cancelAnimationFrame(raf);raf=0;previous=0;
    window.StormSound?.setSceneActive(running());
    stats.state=paused?'paused':'idle';draw();schedule();
  }
  reduced.addEventListener('change',()=>{paused=reduced.matches;if(first)first.classList.add('is-visible');sync();});
  new ResizeObserver(resize).observe(tank);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:0}).observe(tank);
  document.addEventListener('visibilitychange',sync);
  setInterval(()=>{if(visible&&!document.hidden&&!failed){updateMoon();if(paused)draw();}},60000);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback('Graphics context lost');});
  resize();sync();
})();
