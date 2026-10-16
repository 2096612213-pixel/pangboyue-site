#version 300 es
precision highp float;
in vec3 oldPosition;
in vec3 newPosition;
in float validRay;
out vec4 outColor;
// Martin Renou's differential-area focusing, adapted to actual achromatic receiver planes.
void main() {
  if(validRay<.99)discard;
  float oldArea=length(cross(dFdx(oldPosition),dFdy(oldPosition)));
  float newArea=length(cross(dFdx(newPosition),dFdy(newPosition)));
  float ratio=oldArea/max(newArea,1.e-9);
  float intensity=.16*min(ratio,18.);
  outColor=vec4(vec3(intensity),1.);
}
