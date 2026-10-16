const NATIVE_BINDINGS={
  rippleSlider:['rippleStr','rippleVal'],causticSlider:['causticStr','causticVal'],pondSlider:['pondStr','pondVal'],
  floatSlider:['floatStr','floatVal'],stamenSlider:['stamenStr','stamenVal'],veinSlider:['veinStr','veinVal'],
  stemSlider:['stemStr','stemVal'],warmthSlider:['warmth','warmthVal'],speedSlider:['speed','speedVal'],
  backgroundSlider:['backgroundStrength','backgroundVal'],petalFlowSlider:['petalFlowStrength','petalFlowVal'],
  flowerScaleSlider:['flowerScale','flowerScaleVal'],colorAmount:['colorMix','colorAmountVal']
};
class StudioUI {
  constructor(app) {
    this.app=app;this.inputs=new Map();this.outputs=new Map();this.storageKey='submerged-flower-preset-v1';
    for(const [id,[key,output]] of Object.entries(NATIVE_BINDINGS))this.bind(document.getElementById(id),key,output);
    document.querySelectorAll('[data-setting]').forEach(input=>this.bind(input,input.dataset.setting,`${input.id}Val`));
    const color=document.getElementById('flowerColor');this.inputs.set('flowerColor',color);
    color.addEventListener('input',()=>{app.set('flowerColor',color.value,false);if(app.state.colorMix===0)app.set('colorMix',.8,false);app.render();});
    document.querySelectorAll('[data-flower-color]').forEach(button=>button.addEventListener('click',()=>{
      if(button.dataset.flowerColor==='silver')app.set('colorMix',0,false);
      else {app.set('flowerColor',button.dataset.flowerColor,false);app.set('colorMix',.85,false);}app.render();
    }));
    document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
      app.apply(NATIVE_PRESETS[button.dataset.preset]);document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b===button));
    }));
    document.querySelectorAll('[data-res]').forEach(button=>button.addEventListener('click',()=>app.set('res',Number(button.dataset.res))));
    this.click('playPauseBtn',()=>app.play(!app.state.playing));this.click('dropWaveBtn',()=>app.drop());
    this.click('stepPrevBtn',()=>app.step(-1));this.click('stepNextBtn',()=>app.step(1));this.click('resetBtn',()=>app.reset());
    this.click('exportBtn',()=>this.download(app.capture(),`submerged-flower-${app.state.res}px.png`));
    this.click('iconExportBtn',()=>this.download(app.extractIcon(),'blossom-icon.png'));
    this.click('savePreset',()=>{try{localStorage.setItem(this.storageKey,JSON.stringify(app.settings()));this.toast('已保存当前全部参数');}catch(error){this.toast('浏览器存储不可用，可导出 JSON 保存');}});
    this.click('loadPreset',()=>{try{const saved=localStorage.getItem(this.storageKey);if(!saved){this.toast('还没有保存的预设');return;}app.apply(JSON.parse(saved));this.toast('已恢复保存的参数');}catch(error){this.toast(`恢复失败：${error.message}`);}});
    this.click('exportPreset',()=>this.download(URL.createObjectURL(new Blob([JSON.stringify({version:1,settings:app.settings()},null,2)],{type:'application/json'})),'submerged-flower-preset.json',true));
    this.click('importPreset',()=>document.getElementById('presetFile').click());
    document.getElementById('presetFile').addEventListener('change',async event=>{
      const file=event.target.files[0];if(!file)return;
      try{const data=JSON.parse(await file.text());app.apply(data.settings||data);this.toast('已导入参数');}catch(error){this.toast(`导入失败：${error.message}`);}event.target.value='';
    });
    const panel=()=>{document.body.classList.toggle('panel-hidden');this.syncPanel();};
    this.click('panelToggle',panel);this.click('closePanel',panel);
    this.click('immersiveBtn',()=>this.immersive(true));this.click('exitImmersive',()=>this.immersive(false));
    document.addEventListener('keydown',event=>{
      if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName))return;
      if(event.code==='Space'){event.preventDefault();app.play(!app.state.playing);}
      if(event.key.toLowerCase()==='h')this.immersive(!document.body.classList.contains('immersive'));
      if(event.key==='Escape')this.immersive(false);
    });
    document.querySelectorAll('.control-row').forEach((row,index)=>{
      const label=row.querySelector('.control-label'),input=row.querySelector('input');
      if(label&&input){label.id=`control-label-${index}`;input.setAttribute('aria-labelledby',label.id);}
    });
    if(MOBILE)document.body.classList.add('panel-hidden');
    if(new URLSearchParams(location.search).get('embed')==='1'){document.body.classList.add('embedded');this.immersive(true);}
    this.sync();this.syncPanel();
  }
  click(id,action) {document.getElementById(id).addEventListener('click',()=>{try{action();}catch(error){this.toast(error.message);console.error(error);}});}
  bind(input,key,outputId) {
    this.inputs.set(key,input);this.outputs.set(key,document.getElementById(outputId));
    input.addEventListener(input.tagName==='SELECT'?'change':'input',()=>{
      const value=key==='quality'?input.value:Number(input.value);
      try{this.app.set(key,value);}catch(error){this.toast(error.message);this.sync();}
    });
  }
  validate(key,value) {
    if(key==='flowerColor'){if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw new Error('花朵颜色格式不正确');return;}
    if(key==='res'){if(![1024,1280,1600].includes(value))throw new Error('不支持的渲染分辨率');return;}
    const input=this.inputs.get(key);
    if(!input)throw new Error(`参数不存在：${key}`);
    if(input.tagName==='SELECT'){
      if(![...input.options].some(option=>option.value===String(value)))throw new Error(`参数超出范围：${key}`);
    }else if(typeof value!=='number'||!Number.isFinite(value)||value<Number(input.min)||value>Number(input.max))throw new Error(`参数超出范围：${key}`);
  }
  format(key,value) {
    if(['backgroundStrength','petalFlowStrength','flowerScale','colorMix','waterTransparency','shadowStrength'].includes(key))return `${Math.round(value*100)}%`;
    if(['rippleStr','causticStr','pondStr','floatStr','stamenStr','veinStr','stemStr'].includes(key))return `${Math.round(value*100)}% (${value.toFixed(2)}×)`;
    if(key==='disturbanceFrequency')return `${value.toFixed(2)} / s`;
    return `${Number(value).toFixed(2)}×`;
  }
  sync() {
    const state=this.app.state;
    for(const [key,input] of this.inputs){input.value=state[key];const out=this.outputs.get(key);if(out)out.textContent=this.format(key,state[key]);}
    document.getElementById('playPauseBtn').textContent=state.playing?'Ⅱ 暂停':'▷ 继续';
    document.getElementById('exportBtn').textContent=`保存 ${state.res}px 图片`;
    document.querySelectorAll('[data-res]').forEach(button=>button.classList.toggle('active',Number(button.dataset.res)===state.res));
    document.querySelectorAll('[data-preset]').forEach(button=>button.classList.toggle('active',Object.entries(NATIVE_PRESETS[button.dataset.preset]).every(([key,value])=>state[key]===value)));
    document.querySelectorAll('[data-flower-color]').forEach(button=>{
      const active=button.dataset.flowerColor==='silver'?state.colorMix===0:state.colorMix>0&&button.dataset.flowerColor===state.flowerColor;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    });
    this.metrics(this.app.fps);
  }
  metrics(fps) {
    const state=this.app.state;
    document.getElementById('metricRes').textContent=`${this.app.canvas.width} × ${this.app.canvas.height}`;
    document.getElementById('metricPhase').textContent=`${(state.phase*180/Math.PI).toFixed(1)}°`;
    document.getElementById('metricRipple').textContent=state.rippleStr>0?`${Math.round(state.rippleStr*100)}%`:'关闭';
    document.getElementById('fpsMetric').textContent=fps?`${Math.round(fps)} FPS`:'';
    document.getElementById('canvasBadge').textContent=`摄像机已锁定 · 水波 ${state.waterSpeed.toFixed(2)}×`;
  }
  syncPanel(){document.getElementById('panelToggle').setAttribute('aria-expanded',String(!document.body.classList.contains('panel-hidden')));}
  immersive(on){document.body.classList.toggle('immersive',on);}
  toast(message){const toast=document.getElementById('toast');toast.textContent=message;toast.classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>toast.classList.remove('visible'),2600);}
  download(url,name,revoke=false){const link=document.createElement('a');link.href=url;link.download=name;link.click();if(revoke)setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
