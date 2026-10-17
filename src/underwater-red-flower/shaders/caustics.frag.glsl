#version 300 es
precision highp float;
in vec3 oldPosition;
in vec3 newPosition;
in float validRay;
out vec4 outColor;
uniform float u_depth;
// Martin Renou's differential-area focusing, adapted to actual achromatic receiver planes.
void main() {
  if(validRay<.99)discard;
  float oldArea=length(cross(dFdx(oldPosition),dFdy(oldPosition)));
  float newArea=length(cross(dFdx(newPosition),dFdy(newPosition)));
  float ratio=oldArea/max(newArea,1.e-9);
  // Preserve the flower's original light exactly. Background receivers use a
  // finite focusing response rather than abruptly clipping near-zero Jacobians.
  float focused=ratio*inversesqrt(1.+(ratio/18.)*(ratio/18.));
  float intensity=.16*(u_depth==0.?min(ratio,18.):focused);
  outColor=vec4(vec3(intensity),1.);
}
