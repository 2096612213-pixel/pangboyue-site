#version 300 es
precision highp float;
in vec2 a_pos;
uniform sampler2D u_water;
uniform vec2 u_delta;
uniform float u_amplitude, u_scale, u_depth;
uniform int u_receiver;
uniform vec3 u_light;
out vec3 oldPosition;
out vec3 newPosition;
out float validRay;
const float DOMAIN=24.;
const float WATER_Y=2.5;
const float ETA=.7504;
void main() {
  vec2 uv=a_pos;
  vec2 p=(uv-.5)*DOMAIN*u_scale;
  float h=texture(u_water,uv).r*u_amplitude;
  vec2 dx=vec2(u_delta.x,0.), dy=vec2(0.,u_delta.y);
  vec2 slope=vec2(texture(u_water,uv+dx).r-texture(u_water,uv-dx).r,
                  texture(u_water,uv+dy).r-texture(u_water,uv-dy).r)*u_amplitude/(2.*DOMAIN*u_delta.x*u_scale);
  vec3 waterPosition=vec3(p.x,WATER_Y+h,p.y);
  vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
  vec3 refracted=refract(-u_light,normal,ETA);
  vec3 flatRefracted=refract(-u_light,vec3(0.,1.,0.),ETA);
  // Intersect the actual receiving plane: upright flower, upright dark wall, or floor.
  // This replaces the demo's 50-step env-map search without a horizontal-plane assumption.
  float distanceToPlane;
  if(u_receiver==1) {
    distanceToPlane=(u_depth-waterPosition.z)/min(-.01,refracted.z);
    newPosition=waterPosition+refracted*distanceToPlane;
    oldPosition=vec3(p.x,WATER_Y,p.y)+flatRefracted*((u_depth-p.y)/flatRefracted.z);
    gl_Position=vec4(newPosition.x/(DOMAIN*u_scale*.5),(newPosition.y+3.)/6.,0.,1.);
  } else {
    distanceToPlane=(u_depth-waterPosition.y)/min(-.01,refracted.y);
    newPosition=waterPosition+refracted*distanceToPlane;
    oldPosition=vec3(p.x,WATER_Y,p.y)+flatRefracted*((u_depth-WATER_Y)/flatRefracted.y);
    gl_Position=vec4(newPosition.xz/(DOMAIN*u_scale*.5),0.,1.);
  }
  validRay=distanceToPlane>0.?1.:0.;
}
