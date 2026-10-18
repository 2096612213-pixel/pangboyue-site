/* Small WebGL2 host. All passes share this context; no secondary canvas or renderer. */
class GPU {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { alpha: true, antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: true });
    if (!this.gl) throw new Error('需要支持 WebGL2 的浏览器。请开启浏览器硬件加速。');
    const gl = this.gl;
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) throw new Error('当前设备不能渲染浮点水波纹理，请使用支持浮点渲染的 WebGL2 浏览器。');
    this.resources = { textures: 0, framebuffers: 0, buffers: 0, programs: 0, vaos: 0 };
    this.errors = [];
    this.drawCalls = 0;
    this.quad = gl.createVertexArray(); this.resources.vaos++;
    this.quadBuffer = gl.createBuffer(); this.resources.buffers++;
    gl.bindVertexArray(this.quad);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }
  program(vertex, fragment, name) {
    const gl = this.gl, shaders = [];
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
        const shader = gl.createShader(type); shaders.push(shader);
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const message = `${name}: ${gl.getShaderInfoLog(shader)}`;
          this.errors.push(message); throw new Error(message);
        }
      }
      const handle = gl.createProgram();
      shaders.forEach(shader => gl.attachShader(handle, shader));
      gl.bindAttribLocation(handle, 0, 'a_pos'); gl.linkProgram(handle);
      if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
        const message = `${name}: ${gl.getProgramInfoLog(handle)}`;
        gl.deleteProgram(handle); this.errors.push(message); throw new Error(message);
      }
      this.resources.programs++;
      const locations = new Map();
      return { handle, name, location: key => {
        if (!locations.has(key)) locations.set(key, gl.getUniformLocation(handle, key));
        return locations.get(key);
      } };
    } finally { shaders.forEach(shader => gl.deleteShader(shader)); }
  }
  target(width, height, floating = true) {
    const gl = this.gl;
    const texture = gl.createTexture(), framebuffer = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, floating ? gl.RGBA16F : gl.RGBA8, width, height, 0, gl.RGBA, floating ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(framebuffer); gl.deleteTexture(texture);
      throw new Error(`无法创建 ${width}×${height} 渲染目标。`);
    }
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.resources.textures++; this.resources.framebuffers++;
    return { width, height, texture, framebuffer };
  }
  disposeTarget(target) {
    if (!target) return;
    this.gl.deleteTexture(target.texture); this.gl.deleteFramebuffer(target.framebuffer);
    this.resources.textures--; this.resources.framebuffers--;
  }
  async image(data) {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('花朵纹理读取失败')); image.src = data; });
    const gl = this.gl, texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    this.resources.textures++;
    return texture;
  }
  begin(program, target = null) {
    const gl = this.gl;
    this.current = program;
    gl.useProgram(program.handle); gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer || null);
    gl.viewport(0, 0, target?.width || this.canvas.width, target?.height || this.canvas.height);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
  }
  uniform(key, value) {
    const gl = this.gl, location = this.current.location(key);
    if (location === null) return;
    if (typeof value === 'number') gl.uniform1f(location, value);
    else if (value.length === 2) gl.uniform2fv(location, value);
    else if (value.length === 3) gl.uniform3fv(location, value);
    else if (value.length === 4) gl.uniform4fv(location, value);
    else gl.uniform4fv(location, value);
  }
  integer(key, value) { this.gl.uniform1i(this.current.location(key), value); }
  texture(key, texture, unit) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.current.location(key), unit);
  }
  quadPass() {
    this.gl.bindVertexArray(this.quad); this.gl.drawArrays(this.gl.TRIANGLES, 0, 6); this.drawCalls++;
  }
  grid(resolution) {
    const gl = this.gl, vertices = new Float32Array((resolution+1)**2 * 2), indices = new Uint32Array(resolution**2 * 6);
    for (let y=0; y<=resolution; y++) for (let x=0; x<=resolution; x++) {
      const k=(y*(resolution+1)+x)*2; vertices[k]=x/resolution; vertices[k+1]=y/resolution;
    }
    for (let y=0, k=0; y<resolution; y++) for (let x=0; x<resolution; x++) {
      const a=y*(resolution+1)+x, b=a+1, c=a+resolution+1, d=c+1;
      indices.set([a,b,c,b,d,c], k); k+=6;
    }
    const vao=gl.createVertexArray(), vertex=gl.createBuffer(), index=gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vertex); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
    this.resources.vaos++; this.resources.buffers+=2;
    return { vao, vertex, index, count: indices.length, resolution };
  }
  disposeGrid(grid) {
    const gl=this.gl;
    gl.deleteVertexArray(grid.vao); gl.deleteBuffer(grid.vertex); gl.deleteBuffer(grid.index);
    this.resources.vaos--; this.resources.buffers-=2;
  }
  drawGrid(grid) { const gl=this.gl; gl.bindVertexArray(grid.vao); gl.drawElements(gl.TRIANGLES,grid.count,gl.UNSIGNED_INT,0); this.drawCalls++; }
}
