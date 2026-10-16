class UnderwaterScene {
  constructor(gpu,flower,water,caustics) {
    this.gpu=gpu; this.flower=flower; this.water=water; this.caustics=caustics;
    this.program=gpu.program(SHADERS.quadVertex,SHADERS.sceneFragment,'Underwater optics');
    // Fixed composition. No controls, orbit, pointer camera handlers or camera animation.
    this.camera=Object.freeze([0,.05,7.5]); this.target=Object.freeze([0,1.15,0]);
    const n=Math.hypot(.27,.9,1.2); this.light=Object.freeze([.27/n,.9/n,1.2/n]);
  }
  objectTransform(state) {
    const scale=state.objectScale*(state.flowerScale/.5);
    // Anchor the upper crown below the surface even at 3x, without changing its shape.
    return {scale,y:.3-1.95*Math.max(0,scale-1)};
  }
  render(state) {
    const gpu=this.gpu, transform=this.objectTransform(state);
    gpu.begin(this.program);
    gpu.texture('u_flower',this.flower.target.texture,0); gpu.texture('u_water',this.water.texture,1);
    this.caustics.targets.forEach((target,i)=>gpu.texture(`u_caustic${i}`,target.texture,i+2));
    gpu.uniform('u_viewport',[gpu.canvas.width,gpu.canvas.height]); gpu.uniform('u_delta',[1/this.water.resolution,1/this.water.resolution]);
    // 嵌入首页时整体右移到画面 64% 处；保留默认相机和所有水花参数。
    gpu.uniform('u_homeOffset',new URLSearchParams(location.search).get('embed')==='1'?.14:0);
    gpu.uniform('u_camera',this.camera); gpu.uniform('u_target',this.target); gpu.uniform('u_light',this.light);
    gpu.uniform('u_amplitude',state.waterAmplitude); gpu.uniform('u_scale',state.rippleScale);
    gpu.uniform('u_objectScale',transform.scale); gpu.uniform('u_objectY',transform.y);
    gpu.uniform('u_causticIntensity',state.causticsIntensity); gpu.uniform('u_causticContrast',state.causticsContrast);
    gpu.uniform('u_shadowStrength',state.shadowStrength); gpu.uniform('u_reflection',state.reflectionStrength);
    gpu.uniform('u_refraction',state.refractionStrength); gpu.uniform('u_transparency',state.waterTransparency);
    gpu.uniform('u_surfaceLight',state.surfaceLight); gpu.uniform('u_exposure',state.exposure);
    gpu.uniform('u_wt',state.phase); gpu.uniform('u_resolution',this.flower.target.width);
    for(const key of ['stemStr','floatStr','rippleStr','veinStr','warmth','colorMix','backgroundStrength']) gpu.uniform(`u_${key}`,state[key]);
    gpu.uniform('u_flowerColor',hexRGB(state.flowerColor)); gpu.quadPass();
  }
  screenRay(clientX,clientY) {
    const rect=this.gpu.canvas.getBoundingClientRect(), aspect=rect.width/rect.height;
    const x=((clientX-rect.left)/rect.width*2-1)*aspect, y=1-(clientY-rect.top)/rect.height*2;
    const f=[this.target[0]-this.camera[0],this.target[1]-this.camera[1],this.target[2]-this.camera[2]];
    const norm=Math.hypot(...f); f.forEach((v,i)=>f[i]=v/norm);
    return [x*.7535541,f[1]+y*.7535541*(-f[2]),f[2]+y*.7535541*f[1]];
  }
  pickFlower(clientX,clientY,state) {
    const ray=this.screenRay(clientX,clientY);
    if(ray[2]>=-.001)return null;
    const t=-this.camera[2]/ray[2],transform=this.objectTransform(state);
    const x=(this.camera[0]+ray[0]*t)/transform.scale;
    const y=(this.camera[1]+ray[1]*t-transform.y)/transform.scale;
    return [287.76/600+x/4.4,269.68/600-y/4.4];
  }
  pickWater(clientX,clientY) {
    const ray=this.screenRay(clientX,clientY);
    if(ray[1]<=.001) return null;
    const t=(2.5-this.camera[1])/ray[1];
    return [this.camera[0]+ray[0]*t,this.camera[2]+ray[2]*t];
  }
}
