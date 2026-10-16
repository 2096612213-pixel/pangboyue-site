#version 300 es
precision highp float;
precision highp int;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_water;
uniform vec2 u_delta;
uniform float u_dt, u_time, u_forcingStrength, u_forcingFrequency;
uniform int u_mode;
uniform vec4 u_drop;
const float DOMAIN = 24.;

float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float smoothNoise(vec2 p) {
  vec2 i=floor(p),f=fract(p); f=f*f*f*(f*(f*6.-15.)+10.);
  return 2.*mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y)-1.;
}

float gradientDot(ivec3 cell,vec3 offset) {
  // Integer hashing has no short temporal wrap or floating-point sine-hash drift.
  uvec3 q=uvec3(cell);
  uint h=q.x*1597334677u ^ q.y*3812015801u ^ q.z*2798796415u;
  h=(h^(h>>16))*2246822519u; h=(h^(h>>13))*3266489917u; h^=h>>16;
  vec3 g=vec3(uvec3(h,h>>10,h>>20)&uvec3(1023u))/511.5-1.;
  return dot(g*inversesqrt(max(dot(g,g),.0001)),offset);
}
float pressureNoise(vec3 p) {
  ivec3 i=ivec3(floor(p));vec3 f=fract(p),w=f*f*f*(f*(f*6.-15.)+10.);
  float a=mix(gradientDot(i,f),gradientDot(i+ivec3(1,0,0),f-vec3(1,0,0)),w.x);
  float b=mix(gradientDot(i+ivec3(0,1,0),f-vec3(0,1,0)),gradientDot(i+ivec3(1,1,0),f-vec3(1,1,0)),w.x);
  float c=mix(gradientDot(i+ivec3(0,0,1),f-vec3(0,0,1)),gradientDot(i+ivec3(1,0,1),f-vec3(1,0,1)),w.x);
  float d=mix(gradientDot(i+ivec3(0,1,1),f-vec3(0,1,1)),gradientDot(i+ivec3(1,1,1),f-vec3(1,1,1)),w.x);
  return 1.7*mix(mix(a,b,w.y),mix(c,d,w.y),w.z);
}
// Continuous stochastic pressure drives the actual height / velocity PDE.
// Rotated, differently evolving scales replenish the spectrum after the seed decays;
// unlike a fixed set of sinusoidal drivers, these fields have no repeating phase loop.
float forcing(vec2 p,float t) {
  vec2 a=mat2(.8,-.6,.6,.8)*p;
  vec2 b=mat2(-.38,.925,-.925,-.38)*p;
  vec2 c=mat2(.93,.368,-.368,.93)*p;
  // Replenish fine ripples without driving wavelengths the selected grid cannot resolve.
  float fine=1.-smoothstep(.65,1.3,DOMAIN*u_delta.x*3.4);
  return .035*pressureNoise(vec3(a*.58,t*.19+11.7))
       + .125*pressureNoise(vec3(b*1.4+7.4,t*.47+4.8))
       + .360*fine*pressureNoise(vec3(c*3.4-3.1,t*.93-17.3));
}
// Height / velocity ping-pong evolution adapted from Martin Renou (BSD-3-Clause).
void main() {
  vec2 p=(v_uv-.5)*DOMAIN;
  if(u_mode == 1) {
    // Seed a continuous, aperiodic multi-scale surface once, then evolve the wave PDE.
    float h=.035*smoothNoise(p*.65+vec2(3.4,1.7))
           +.020*smoothNoise(p*1.4+vec2(-4.1,7.2))
           +.009*smoothNoise(p*3.7+vec2(2.8,-1.9))
           +.010*sin(dot(p,vec2(1.53,.81))+.4);
    outColor=vec4(h,0.,0.,0.); return;
  }
  vec4 info=texture(u_water,v_uv);
  if(u_mode == 2) {
    float drop=max(0.,1.-length(v_uv-u_drop.xy)/u_drop.z);
    drop=.5-.5*cos(drop*3.14159265359);
    // Inject velocity rather than teleporting the height: the impulse evolves continuously.
    info.g += drop*u_drop.w; outColor=info; return;
  }
  if(u_mode == 3) { outColor=info; return; }
  vec2 dx=vec2(u_delta.x,0.), dy=vec2(0.,u_delta.y);
  float hL=texture(u_water,v_uv-dx).r, hR=texture(u_water,v_uv+dx).r;
  float hD=texture(u_water,v_uv-dy).r, hU=texture(u_water,v_uv+dy).r;
  float cell=DOMAIN*u_delta.x;
  float lap=(hL+hR+hD+hU-4.*info.r)/(cell*cell);
  float edge=min(min(v_uv.x,1.-v_uv.x),min(v_uv.y,1.-v_uv.y));
  float interior=smoothstep(.02,.18,edge);
  float renewal=sqrt(2.*u_forcingFrequency/(u_forcingFrequency+.65));
  info.g += (lap*.64 + interior*renewal*u_forcingStrength*forcing(p,u_time) - .035*info.r)*u_dt;
  info.g *= exp(-.32*u_dt);
  info.r += info.g*u_dt;
  // A gentle sponge at the simulation boundary avoids a rectangular standing-wave pool.
  info.rg *= exp(-u_dt*3.5*(1.-smoothstep(.015,.18,edge)));
  vec2 gradient=vec2(hR-hL,hU-hD)/(2.*cell);
  outColor=vec4(info.rg,normalize(vec3(-gradient.x,1.,-gradient.y)).xz);
}
