#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_flower, u_water, u_caustic0, u_caustic1, u_caustic2;
uniform vec2 u_viewport, u_delta;
uniform float u_homeOffset;
uniform vec3 u_camera, u_target, u_light;
uniform float u_amplitude, u_scale, u_objectScale, u_objectY;
uniform float u_causticIntensity, u_causticContrast, u_shadowStrength;
uniform float u_reflection, u_refraction, u_transparency, u_surfaceLight, u_exposure;
uniform float u_wt, u_resolution, u_stemStr, u_floatStr, u_rippleStr, u_veinStr, u_warmth, u_colorMix, u_backgroundStrength;
uniform vec3 u_flowerColor;
const float WATER_Y=2.5;
const float FLOOR_Y=-5.;
const float DOMAIN=24.;
const vec2 CENTER=vec2(287.76/600.,269.68/600.);

/*__NATIVE_STEM__*/

vec4 waterInfo(vec2 worldXZ) {
  vec2 uv=worldXZ/(DOMAIN*u_scale)+.5;
  float h=texture(u_water,uv).r*u_amplitude;
  vec2 dx=vec2(u_delta.x,0.),dy=vec2(0.,u_delta.y);
  float l=texture(u_water,uv-dx).r, r=texture(u_water,uv+dx).r;
  float b=texture(u_water,uv-dy).r, t=texture(u_water,uv+dy).r;
  vec2 slope=vec2(r-l,t-b)*u_amplitude/(2.*DOMAIN*u_delta.x*u_scale);
  float curvature=(l+r+b+t-4.*texture(u_water,uv).r)*u_amplitude/pow(DOMAIN*u_delta.x*u_scale,2.);
  return vec4(h,slope,curvature);
}

float focusedLight(float c,vec2 uv) {
  float edge=smoothstep(0.,.06,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
  return pow(clamp(max(0.,c-.085)*3.0,0.,2.),u_causticContrast)*u_causticIntensity*edge;
}
float softFlux(sampler2D image,vec2 uv) {
  // The upstream environment's Gaussian receiver filtering, in both axes.
  // Filtering the photon footprint suppresses single-pixel focusing / mesh aliasing.
  vec2 pixel=.65/vec2(textureSize(image,0));
  vec2 a=1.3846153846*pixel,b=3.2307692308*pixel;
  float c=texture(image,uv).r*.2270270270;
  c+=(texture(image,uv+vec2(a.x,0.)).r+texture(image,uv-vec2(a.x,0.)).r
     +texture(image,uv+vec2(0.,a.y)).r+texture(image,uv-vec2(0.,a.y)).r)*.1581081081;
  c+=(texture(image,uv+vec2(b.x,0.)).r+texture(image,uv-vec2(b.x,0.)).r
     +texture(image,uv+vec2(0.,b.y)).r+texture(image,uv-vec2(0.,b.y)).r)*.0351351351;
  return c;
}
// Compact C2 photon footprint, evaluated at the exact subtexel position.
vec2 photonWeight(vec2 distance) {
  vec2 w=max(vec2(0.),1.-distance*distance/9.);
  // The same compact footprint, with a narrower core to recover fine ribbons.
  // Its zero-valued boundary still has continuous first and second derivatives.
  return w*w*w*w*w;
}
float receiverFlux(sampler2D image,vec2 uv) {
  // Reconstruct the background photon map, not the finished scene. Six texels
  // per axis are paired into nine bilinear reads (the previous filter also used
  // nine). Phase-aware weights remove the sampling lattice of fixed offsets.
  vec2 size=vec2(textureSize(image,0)),p=uv*size-.5,f=fract(p),base=floor(p)+.5;
  vec2 w0=photonWeight(f+2.),w1=photonWeight(f+1.),w2=photonWeight(f);
  vec2 w3=photonWeight(1.-f),w4=photonWeight(2.-f),w5=photonWeight(3.-f);
  vec2 a=w0+w1,b=w2+w3,c=w4+w5;
  vec2 x=(base-2.+w1/a)/size,y=(base+w3/b)/size,z=(base+2.+w5/c)/size;
  vec2 total=a+b+c;a/=total;b/=total;c/=total;
  return texture(image,vec2(x.x,x.y)).r*a.x*a.y
       + texture(image,vec2(y.x,x.y)).r*b.x*a.y
       + texture(image,vec2(z.x,x.y)).r*c.x*a.y
       + texture(image,vec2(x.x,y.y)).r*a.x*b.y
       + texture(image,vec2(y.x,y.y)).r*b.x*b.y
       + texture(image,vec2(z.x,y.y)).r*c.x*b.y
       + texture(image,vec2(x.x,z.y)).r*a.x*c.y
       + texture(image,vec2(y.x,z.y)).r*b.x*c.y
       + texture(image,vec2(z.x,z.y)).r*c.x*c.y;
}
float receiverLight(float c,vec2 uv) {
  // Integrate the positive threshold over one screen pixel instead of cutting
  // faint ribbons off abruptly. Away from the small transition it is unchanged.
  float d=c-.085,w=clamp(fwidth(c),.004,.06);
  float positive=d<=-w?0.:(d>=w?d:(d+w)*(d+w)/(4.*w));
  float edge=smoothstep(0.,.06,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
  // Lift the ribbons above the existing black threshold, not the ambient floor.
  float light=positive*4.1;
  // A smooth shoulder replaces the flat-topped highlight clamp; faint ribbons
  // retain their contrast, while bright intersections roll off continuously.
  light*=inversesqrt(1.+.22*light*light);
  return pow(light,u_causticContrast)*u_causticIntensity*edge;
}
vec2 uprightUV(vec3 p) {return vec2(p.x/(DOMAIN*u_scale)+.5,(p.y+3.)/12.+.5);}
float causticAt(vec3 p) {
  vec2 uv=uprightUV(p);
  return focusedLight(softFlux(u_caustic0,uv),uv);
}
vec3 backgroundReceiver(vec3 p) {
  // The analytical wall is infinite, but its photon map ends at the waterline.
  // Map that infinite background into the illuminated interior, without clamping,
  // tiling, or exposing the finite map's upper / side edges. Flower sampling is separate.
  float width=DOMAIN*u_scale*.39;
  p.x=width*tanh(p.x/width);
  p.y=1.4-1.6*log(1.+exp((1.4-p.y)/1.6));
  return p;
}
float receiverCaustic(vec3 p,vec3 normal) {
  bool wall=normal.z>.5;
  vec2 uv=wall?uprightUV(backgroundReceiver(p)):p.xz/(DOMAIN*u_scale)+.5;
  float c=wall?receiverFlux(u_caustic1,uv):receiverFlux(u_caustic2,uv);
  return receiverLight(c,uv);
}

float lowerStemVisibility(vec3 p) {
  // Only the homepage embed fades the stem. Preserve the crown and upper stalk,
  // then reach zero in world space before the floor can occlude it at FLOOR_Y.
  if(u_homeOffset<=0.) return 1.;
  float rootY=u_objectY-1.6*u_objectScale;
  float endY=max(FLOOR_Y+.7,u_objectY-4.6*u_objectScale);
  if(rootY<=endY) return 1.; // At extreme scales the floor already hides this lower stalk.
  float t=clamp((rootY-p.y)/(rootY-endY),0.,1.);
  return 1.-t*t*t*(t*(t*6.-15.)+10.);
}

vec4 flowerAt(vec3 p) {
  vec2 local=(p.xy-vec2(0.,u_objectY))/u_objectScale;
  vec2 uv=vec2(.5+local.x/4.4,.25-local.y/8.8);
  if(uv.x<0. || uv.x>1. || uv.y<0. || p.y>WATER_Y-.045) return vec4(0.);
  float visibility=lowerStemVisibility(p);
  // The source texture is premultiplied: fade RGB and alpha together so both the
  // existing front-to-back composite and flowerShadow use identical stem coverage.
  if(uv.y<=1.) return texture(u_flower,vec2(uv.x,1.-uv.y))*visibility;
  // The original stem is mathematically unbounded. Continue its identical function below
  // the finite atlas capture, including at the smallest object scale.
  vec2 flowerUV=CENTER+vec2(local.x,-local.y)/4.4;
  vec2 d=flowerUV-CENTER;
  vec2 baseShift=vec2(.010*sin(u_wt+.9)+.004*sin(2.*u_wt+2.1),.008*cos(u_wt-.4)+.003*sin(2.*u_wt));
  vec2 rotShift=vec2(-d.y,d.x)*.045*sin(u_wt+.7);
  vec2 stemUV=flowerUV+baseShift+rotShift*smoothstep(.95,.68,flowerUV.y)*.35;
  vec2 bg=vec2(.5)+d*.85;
  float flow=.52+.28*sin(bg.x*9.+bg.y*7.-u_wt)+.20*cos(bg.x*13.-bg.y*10.+u_wt);
  vec3 tint=u_flowerColor/max(dot(u_flowerColor,vec3(.2126,.7152,.0722)),.08);
  vec4 stem=evalHarmonizedStem(stemUV,u_wt,0.,flow,0.,tint);
  return vec4(stem.rgb*stem.a,stem.a)*visibility;
}

vec3 underwaterLight(vec3 p) {
  vec3 flatLight=-refract(-u_light,vec3(0.,1.,0.),.7504);
  vec3 entry=p+flatLight*((WATER_Y-p.y)/max(.1,flatLight.y));
  vec4 wi=waterInfo(entry.xz);
  vec3 n=normalize(vec3(-wi.y,1.,-wi.z));
  vec3 light=-refract(-u_light,n,.7504);
  entry=p+light*((WATER_Y-p.y)/max(.1,light.y));
  wi=waterInfo(entry.xz);n=normalize(vec3(-wi.y,1.,-wi.z));
  return -refract(-u_light,n,.7504);
}

float flowerShadow(vec3 p,vec3 L) {
  if(p.z>=-.025 || L.z<=.01) return 0.;
  vec3 hit=p+L*(-p.z/L.z);
  float softness=.024+.009*length(hit-p);
  float a=flowerAt(hit).a*.36;
  a+=flowerAt(hit+vec3(softness,0.,0.)).a*.16;
  a+=flowerAt(hit-vec3(softness,0.,0.)).a*.16;
  a+=flowerAt(hit+vec3(0.,softness,0.)).a*.16;
  a+=flowerAt(hit-vec3(0.,softness,0.)).a*.16;
  return clamp(a*u_shadowStrength,0.,1.);
}

vec3 receiver(vec3 p,vec3 normal) {
  // Optical distance grows smoothly into a broad elliptical dark far field.
  // There is no horizon threshold or finite mask contour, including in the ambient light.
  float farDistance=2.5*log(1.+exp((p.y+3.)/2.5));
  float falloff=exp(-.024*p.x*p.x-.045*farDistance*farDistance);
  float caustic=receiverCaustic(p,normal);
  vec3 light=underwaterLight(p);
  float shadow=flowerShadow(p,light);
  float facing=.28+.72*max(dot(normal,light),0.);
  float gray=(.017+.23*caustic)*falloff*facing;
  vec2 nativeUV=(p.xy-vec2(0.,u_objectY))/u_objectScale/4.4;
  vec2 bg=.5+vec2(nativeUV.x,-nativeUV.y)*.85;
  float flow=.52+.28*sin(bg.x*9.+bg.y*7.-u_wt)+.20*cos(bg.x*13.-bg.y*10.+u_wt);
  gray+=u_backgroundStrength*.06*max(0.,flow)*falloff;
  gray*=1.-.93*shadow;
  return vec3(gray+.0007);
}

vec3 traceUnderwater(vec3 origin,vec3 direction) {
  float wallT=direction.z<-.001?(-1.15-origin.z)/direction.z:1.e4;
  float floorT=direction.y<-.001?(FLOOR_Y-origin.y)/direction.y:1.e4;
  float distanceToSurface=min(wallT,floorT);
  if(distanceToSurface<0.) distanceToSurface=1.e4;
  vec3 p=origin+direction*min(distanceToSurface,100.);
  vec3 normal=wallT<floorT?vec3(0.,0.,1.):vec3(0.,1.,0.);
  vec3 color=distanceToSurface<100.?receiver(p,normal):vec3(0.);
  // Fade only the receiving water/background before compositing the flower.
  // A broad C2 screen-space rolloff has no circular outline or hard horizon;
  // reach pure black just before the bottom, including outside the homepage.
  float bottomFade=clamp((v_uv.y-.025)/.30,0.,1.);
  bottomFade=bottomFade*bottomFade*bottomFade*(bottomFade*(bottomFade*6.-15.)+10.);
  color*=bottomFade;
  float t=abs(direction.z)>.001?-origin.z/direction.z:-1.;
  if(t>0. && t<distanceToSurface) {
    vec3 hit=origin+direction*t;
    vec4 f=flowerAt(hit);
    if(f.a>.001) {
      vec3 nativeColor=f.rgb/max(f.a,.001);
      float caustic=causticAt(hit);
      // Achromatic illumination modulates the native color. No blue/green water tint.
      vec3 lit=nativeColor*(.88+.44*caustic);
      float highlight=pow(max(nativeColor.r,max(nativeColor.g,nativeColor.b)),5.);
      lit+=vec3(.025*caustic*highlight);
      float attenuation=exp(-.009*t);
      color=mix(color,clamp(lit*attenuation,0.,1.),f.a);
    }
  }
  return color;
}

vec4 foregroundFlower(vec3 hit,float distanceToFlower) {
  vec4 f=flowerAt(hit);
  if(f.a<=.001)return vec4(0.);
  vec3 nativeColor=f.rgb/max(f.a,.001);
  float caustic=causticAt(hit);
  vec3 lit=nativeColor*(.88+.44*caustic);
  float highlight=pow(max(nativeColor.r,max(nativeColor.g,nativeColor.b)),5.);
  lit+=vec3(.025*caustic*highlight);
  return vec4(clamp(lit*exp(-.009*distanceToFlower),0.,1.),f.a);
}

vec3 aboveWater(vec3 origin,vec3 direction) {
  if(direction.y<=.001) return vec3(.005);
  vec3 p=origin+direction*((7.0-origin.y)/direction.y);
  // A neutral ceiling opening and long white luminaires, outside the underwater scene.
  float opening=exp(-.018*pow(p.x+1.8,2.)-.011*pow(p.z+3.5,2.));
  float strips=smoothstep(.70,.88,cos(p.x*1.24+p.z*.09));
  float light=opening*(.10+.62*strips);
  return vec3(.015+light);
}

float fresnelWaterAir(float cosI) {
  float sinT2=1.333*1.333*(1.-cosI*cosI);
  if(sinT2>=1.) return 1.;
  float cosT=sqrt(1.-sinT2);
  float rs=(1.333*cosI-cosT)/(1.333*cosI+cosT);
  float rp=(cosI-1.333*cosT)/(cosI+1.333*cosT);
  return .5*(rs*rs+rp*rp);
}

void main() {
  vec2 screen=((v_uv-vec2(u_homeOffset,u_homeOffset))*2.-1.)*vec2(u_viewport.x/u_viewport.y,1.);
  vec3 forward=normalize(u_target-u_camera);
  vec3 right=normalize(cross(forward,vec3(0.,1.,0.)));
  vec3 up=cross(right,forward);
  vec3 ray=normalize(forward+.7535541*(screen.x*right+screen.y*up));
  // Keep the simulated water's lighting, without drawing its reflective surface layer.
  vec3 color=traceUnderwater(u_camera,ray);
  float vignette=1.-.22*smoothstep(.35,1.25,length((v_uv-.5)*vec2(1.,.8)));
  color*=vignette*u_exposure;
  outColor=vec4(clamp(color,0.,1.),1.);
}
