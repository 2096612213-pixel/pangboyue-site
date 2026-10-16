class WaterSimulation {
  constructor(gpu, resolution) {
    this.gpu=gpu; this.program=gpu.program(SHADERS.quadVertex,SHADERS.simulation,'Water simulation');
    this.time=0; this.nextDrop=.4; this.seed=912813; this.pending=[];
    this.rebuild(resolution,false);
  }
  random() { let x=this.seed|0; x^=x<<13; x^=x>>>17; x^=x<<5; this.seed=x>>>0; return this.seed/4294967296; }
  rebuild(resolution,preserve=true) {
    const gpu=this.gpu, old=this.targets;
    this.targets=[gpu.target(resolution,resolution),gpu.target(resolution,resolution)]; this.current=0; this.resolution=resolution;
    for (const target of this.targets) {
      gpu.begin(this.program,target); gpu.integer('u_mode',preserve && old ? 3:1);
      gpu.uniform('u_delta',[1/resolution,1/resolution]);
      if(old) gpu.texture('u_water',old[this.oldCurrent ?? 0].texture,0);
      else gpu.texture('u_water',this.targets[target===this.targets[0]?1:0].texture,0);
      gpu.quadPass();
    }
    if(old) old.forEach(target=>gpu.disposeTarget(target));
    this.oldCurrent=0;
  }
  resize(resolution) { this.oldCurrent=this.current; this.rebuild(resolution,true); }
  reset() {
    this.time=0; this.nextDrop=.4; this.seed=912813; this.pending.length=0;
    this.rebuild(this.resolution,false);
  }
  get texture() { return this.targets[this.current].texture; }
  pass(mode,dt=0,drop=[.5,.5,.03,.06]) {
    const gpu=this.gpu, next=1-this.current;
    gpu.begin(this.program,this.targets[next]);
    gpu.texture('u_water',this.texture,0); gpu.integer('u_mode',mode);
    gpu.uniform('u_delta',[1/this.resolution,1/this.resolution]);
    gpu.uniform('u_dt',dt); gpu.uniform('u_time',this.time); gpu.uniform('u_drop',drop);
    gpu.uniform('u_forcingStrength',this.forcingStrength??1);
    gpu.uniform('u_forcingFrequency',this.forcingFrequency??.65);
    gpu.quadPass(); this.current=next;
  }
  addDrop(x=.5,y=.5,strength=.13,radius=.036) { this.pending.push([x,y,radius,strength]); }
  update(dt,state) {
    const scaled=dt*state.waterSpeed;
    if(scaled<=0) return;
    this.forcingStrength=state.disturbanceStrength;
    this.forcingFrequency=state.disturbanceFrequency;
    const maxStep=Math.min(1/45,.43*(24/this.resolution)/.8);
    const steps=Math.max(1,Math.ceil(scaled/maxStep)),step=scaled/steps;
    for(let i=0;i<steps;i++) {
      // A single simulation clock drives pressure, impulses and propagation. Speed
      // changes their pace together, without changing their density per simulated second.
      this.time+=step;
      if(state.disturbanceFrequency>0) {
        while(this.time>=this.nextDrop) {
          const radius=.024+.065*this.random()**2;
          this.pending.push([.12+.76*this.random(),.12+.76*this.random(),radius,(.08+.10*this.random())*state.disturbanceStrength*(this.random()>.5?1:-1)]);
          this.nextDrop+=Math.max(.08,-Math.log(Math.max(.001,1-this.random()))/state.disturbanceFrequency);
        }
      } else this.nextDrop=this.time+.2;
      while(this.pending.length) this.pass(2,0,this.pending.shift());
      this.pass(0,step);
    }
  }
}

class Caustics {
  constructor(gpu,resolution,quality) {
    this.gpu=gpu; this.program=gpu.program(SHADERS.causticsVertex,SHADERS.causticsFragment,'Refracted caustics');
    this.receivers=[{axis:1,depth:0},{axis:1,depth:-1.15},{axis:0,depth:-5}]; this.rebuild(resolution,quality);
  }
  rebuild(resolution,quality) {
    const gpu=this.gpu;
    if(this.grid) gpu.disposeGrid(this.grid);
    if(this.targets) this.targets.forEach(target=>gpu.disposeTarget(target));
    this.grid=gpu.grid(resolution);
    const size=quality==='high'?768:quality==='low'?256:512;
    this.targets=this.receivers.map(()=>gpu.target(size,size));
  }
  render(water,state,light) {
    const gpu=this.gpu, gl=gpu.gl;
    for(let i=0;i<this.targets.length;i++) {
      gpu.begin(this.program,this.targets[i]);
      gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE);
      gpu.texture('u_water',water.texture,0); gpu.uniform('u_delta',[1/water.resolution,1/water.resolution]);
      gpu.uniform('u_amplitude',state.waterAmplitude); gpu.uniform('u_scale',state.rippleScale);
      gpu.uniform('u_depth',this.receivers[i].depth); gpu.integer('u_receiver',this.receivers[i].axis); gpu.uniform('u_light',light);
      gpu.drawGrid(this.grid);
    }
    gl.disable(gl.BLEND);
  }
}
