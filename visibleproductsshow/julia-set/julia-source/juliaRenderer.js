// 4. RENDERER — a full-screen triangle, native GPU iteration, no runtime dependencies.
class JuliaRenderer {
  constructor(canvas,state){
    this.canvas=canvas;this.state=state;
    const options={alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'high-performance'};
    this.gl=canvas.getContext('webgl2',options);this.webgl2=!!this.gl;
    if(!this.gl)this.gl=canvas.getContext('webgl',options);
    if(!this.gl)throw Error('WebGL is unavailable. Enable hardware acceleration, then reload this artwork.');
    const precision=this.gl.getShaderPrecisionFormat(this.gl.FRAGMENT_SHADER,this.gl.HIGH_FLOAT);
    if(!precision||precision.precision<23)throw Error('This GPU does not expose the fragment precision needed for accurate Julia rendering. Try a browser with hardware acceleration enabled.');
    this.precision=precision.precision;this.initialize();
  }
  compile(type,source){const gl=this.gl,s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error)}return s}
  initialize(){
    const gl=this.gl;let vs=VERTEX_SHADER,fs=FRAGMENT_SHADER;
    if(this.webgl2){vs='#version 300 es\n'+vs.replace('attribute vec2','in vec2');fs='#version 300 es\n'+fs.replace('precision highp float;','precision highp float;\nout vec4 fragColor;').replaceAll('gl_FragColor','fragColor')}
    const vert=this.compile(gl.VERTEX_SHADER,vs),frag=this.compile(gl.FRAGMENT_SHADER,fs),p=gl.createProgram();
    gl.attachShader(p,vert);gl.attachShader(p,frag);gl.linkProgram(p);gl.deleteShader(vert);gl.deleteShader(frag);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
    this.program=p;gl.useProgram(p);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const attribute=gl.getAttribLocation(p,'aPosition');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
    this.uniforms={};for(const name of ['Resolution','Center','C','Span','Time','Reveal','Iterations','Samples','PaletteSpeed','Glow','Exposure','Debug'])this.uniforms[name]=gl.getUniformLocation(p,'u'+name);
    gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.DITHER);
  }
  resize(){
    const s=this.state,gl=this.gl;
    let ratio=Math.min(devicePixelRatio||1,CONFIG.maxDPR);
    if(s.quality==='eco')ratio=Math.min(ratio,1);
    else if(s.quality==='auto')ratio*=s.resolutionFactor;
    ratio=Math.min(ratio,Math.sqrt(CONFIG.maxPixels/(s.width*s.height)));
    ratio=Math.min(ratio,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)/Math.max(s.width,s.height));
    s.dpr=ratio;
    const w=Math.max(1,Math.round(s.width*ratio)),h=Math.max(1,Math.round(s.height*ratio));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}
    gl.viewport(0,0,w,h);s.dirty=true;
  }
  draw(overrides={}){
    const gl=this.gl,s=this.state,u=this.uniforms;
    gl.useProgram(this.program);
    gl.uniform2f(u.Resolution,overrides.width||this.canvas.width,overrides.height||this.canvas.height);
    gl.uniform2fv(u.Center,overrides.center||s.center);gl.uniform2fv(u.C,overrides.c||s.c);
    gl.uniform1f(u.Span,overrides.span??CONFIG.defaultSpan/Math.exp(s.logZoom));
    gl.uniform1f(u.Time,overrides.time??s.time);gl.uniform1f(u.Reveal,overrides.reveal??s.reveal);
    gl.uniform1i(u.Iterations,overrides.iterations??s.iterations);gl.uniform1i(u.Samples,overrides.samples??s.samples);
    gl.uniform1f(u.PaletteSpeed,CONFIG.paletteSpeed);gl.uniform1f(u.Glow,CONFIG.glow);gl.uniform1f(u.Exposure,CONFIG.exposure);
    gl.uniform1i(u.Debug,overrides.debug||0);gl.drawArrays(gl.TRIANGLES,0,3);
  }
  offscreen(width,height,overrides){
    const gl=this.gl,texture=gl.createTexture(),fb=gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Offscreen framebuffer unavailable');
    gl.viewport(0,0,width,height);this.draw({...overrides,width,height});
    const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(fb);gl.deleteTexture(texture);gl.viewport(0,0,this.canvas.width,this.canvas.height);
    return pixels;
  }
  thumbnail(c,canvas){
    const size=96,pixels=this.offscreen(size,size,{c,center:[0,0],span:3.8,time:0,reveal:1,iterations:220,samples:2});
    canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d'),data=ctx.createImageData(size,size);
    for(let y=0;y<size;y++)data.data.set(pixels.subarray((size-1-y)*size*4,(size-y)*size*4),y*size*4);
    ctx.putImageData(data,0,0);
  }
  probe(z0,c,iterations=220){
    const p=this.offscreen(1,1,{center:z0,c,span:1,reveal:1,time:0,iterations,samples:1,debug:1});
    return{escaped:p[1]>127,iterations:p[1]>127?p[0]:iterations};
  }
}
