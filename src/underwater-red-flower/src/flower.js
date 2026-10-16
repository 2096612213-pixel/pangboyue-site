const NATIVE_DEFAULTS=Object.freeze({rippleStr:0,causticStr:0,pondStr:0,floatStr:1.45,stamenStr:1.15,veinStr:2,stemStr:1,warmth:1.45,speed:.55});
const NATIVE_PRESETS=Object.freeze({
  hyperreal:{rippleStr:0,causticStr:0,pondStr:0,floatStr:1.55,stamenStr:1.3,veinStr:1.95,stemStr:1.15,warmth:1.25,speed:.65},
  crystal_pond:{rippleStr:0,causticStr:0,pondStr:0,floatStr:1.65,stamenStr:1.4,veinStr:1.8,stemStr:1.2,warmth:.75,speed:.65},
  golden_sss:{rippleStr:0,causticStr:0,pondStr:0,floatStr:1.35,stamenStr:1.65,veinStr:2,stemStr:1.15,warmth:1.85,speed:.6},
  original:NATIVE_DEFAULTS
});
const INITIAL_PHASE=98.4*Math.PI/180;
const BASE_OMEGA=2*Math.PI/(50/29.94);
class FlowerSource {
  constructor(gpu) {
    this.gpu=gpu; this.program=gpu.program(SHADERS.flowerVertex,SHADERS.flowerFragment,'Original flower');
    this.drops=new Float32Array(40); this.dropIndex=0;
    for(let i=0;i<10;i++) this.drops[i*4+2]=-100;
  }
  async load() { [this.atlas,this.detail]=await Promise.all([this.gpu.image(ASSETS.flowerAtlas),this.gpu.image(ASSETS.flowerDetail)]); }
  resize(state) {
    const size=state.quality==='high'?1024:state.quality==='low'?512:768;
    if(this.target?.width===size) return;
    this.gpu.disposeTarget(this.target); this.target=this.gpu.target(size,size*2,false);
  }
  addDrop(x,y,time,amplitude=1.35) { this.drops.set([x,y,time,amplitude],this.dropIndex*4); this.dropIndex=(this.dropIndex+1)%10; }
  resetDrops() { for(let i=0;i<10;i++) this.drops.set([.5,.5,-100,0],i*4); }
  render(state,transparentExport=false) {
    const gpu=this.gpu;
    gpu.begin(this.program,this.target);
    gpu.texture('u_atlas',this.atlas,0); gpu.texture('u_causticAtlas',this.detail,1);
    gpu.uniform('u_viewport',[this.target.width,this.target.height]); gpu.uniform('u_resolution',this.target.width);
    gpu.uniform('u_flowerScale',1); gpu.uniform('u_captureOffset',[0,.5]);
    gpu.uniform('u_wt',state.phase); gpu.uniform('u_time',state.timeSec);
    for(const key of ['backgroundStrength','petalFlowStrength','rippleStr','causticStr','pondStr','floatStr','stamenStr','veinStr','stemStr','warmth','colorMix']) gpu.uniform(`u_${key}`,state[key]);
    gpu.uniform('u_flowerColor',hexRGB(state.flowerColor)); gpu.integer('u_exportFlower',transparentExport?1:0);
    gpu.uniform('u_drops[0]',this.drops); gpu.quadPass();
  }
}
function hexRGB(color) { return color.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)/255); }
