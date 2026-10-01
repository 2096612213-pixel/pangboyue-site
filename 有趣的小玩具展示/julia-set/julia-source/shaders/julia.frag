precision highp float;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform vec2 uC;
uniform float uSpan;
uniform float uTime;
uniform float uReveal;
uniform int uIterations;
uniform int uSamples;
uniform float uPaletteSpeed;
uniform float uGlow;
uniform float uExposure;
uniform int uDebug;
const float LN2 = 0.6931471805599453;

vec2 squareComplex(vec2 z) { return vec2(z.x*z.x-z.y*z.y, 2.0*z.x*z.y); }
vec2 multiplyComplex(vec2 a, vec2 b) { return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }

// A closed, piecewise-interpolated pigment ramp; not a sine RGB palette.
// Stops are authored in linear light. Smooth joins keep the cycle continuous.
vec3 pigment(float t) {
    float x=fract(t)*7.0;
    float f=fract(x); f=f*f*(3.0-2.0*f);
    vec3 a; vec3 b;
    if(x<1.0) { a=vec3(.018,.026,.085); b=vec3(.055,.105,.235); }
    else if(x<2.0) { a=vec3(.055,.105,.235); b=vec3(.165,.090,.280); }
    else if(x<3.0) { a=vec3(.165,.090,.280); b=vec3(.340,.105,.220); }
    else if(x<4.0) { a=vec3(.340,.105,.220); b=vec3(.220,.420,.550); }
    else if(x<5.0) { a=vec3(.220,.420,.550); b=vec3(.570,.650,.690); }
    else if(x<6.0) { a=vec3(.570,.650,.690); b=vec3(.360,.240,.135); }
    else { a=vec3(.360,.240,.135); b=vec3(.018,.026,.085); }
    return mix(a,b,f);
}

vec3 background(vec2 uv) {
    float haze=exp(-1.3*dot(uv-vec2(.25,-.1),uv-vec2(.25,-.1)));
    return vec3(.00010,.00015,.00035)+haze*vec3(.00010,.00008,.00030);
}

vec3 julia(vec2 pixel) {
    float minSide=min(uResolution.x,uResolution.y);
    vec2 screen=(pixel-.5*uResolution)/minSide;
    vec2 z=screen*uSpan+uCenter;
    vec2 derivative=vec2(1.0,0.0);
    float derivativeLogScale=0.0;
    float n=0.0;
    float radius2=dot(z,z);
    for(int i=0;i<700;i++) {
        if(i>=uIterations || radius2>4.0) break;
        // Both expressions use the old z, exactly z(n+1) = z(n)^2 + c.
        derivative=2.0*multiplyComplex(z,derivative);
        float d2=dot(derivative,derivative);
        if(d2>1.0e28) { derivative*=1.0e-14; derivativeLogScale+=32.2361913; }
        z=squareComplex(z)+uC;
        radius2=dot(z,z);
        n+=1.0;
    }
    bool escaped=radius2>4.0;
    if(uDebug==1) return escaped ? vec3(n/255.0,1.0,0.0) : vec3(0.0);
    vec3 bg=background(screen);
    // Finite-budget non-escape is shaded dark; it is not a proof of membership.
    if(!escaped) return bg*.64;

    // Refine the SAME escaped orbit to stabilize smooth count / distance near R=2.
    // The escape decision has already been made; this does not alter the set.
    for(int j=0;j<4;j++) {
        if(radius2>1.0e12) break;
        derivative=2.0*multiplyComplex(z,derivative);
        if(dot(derivative,derivative)>1.0e28) {
            derivative*=1.0e-14; derivativeLogScale+=32.2361913;
        }
        z=squareComplex(z)+uC;
        radius2=dot(z,z);
        n+=1.0;
    }
    float logRadius=.5*log(max(radius2,4.00001));
    float smoothIter=n+1.0-log(logRadius)/LN2;
    float derivativeLength=max(length(derivative),1.0e-24);
    float logDistance=logRadius+log(logRadius)-log(derivativeLength)-derivativeLogScale;
    float distanceEstimate=exp(clamp(logDistance,-75.0,10.0));
    float pixelWorld=uSpan/minSide;
    float pixelDistance=distanceEstimate/pixelWorld;

    // Coloring only: distance is an exterior estimate, not a changed escape rule.
    float t=log(1.0+max(smoothIter,0.0))*.42 + .16 + uTime*uPaletteSpeed;
    vec3 base=pigment(t);
    vec2 normal=vec2(dot(z,derivative),z.y*derivative.x-z.x*derivative.y);
    normal/=max(length(normal),1.0e-20);
    float light=.54+.46*dot(normal,normalize(vec2(-.6,.8)));
    float close=exp(-4.8*pow(max(distanceEstimate,0.0),.42));
    float silk=.90+.10*cos(smoothIter*.57);
    float edge=exp(-.58*sqrt(max(pixelDistance,0.0)));
    float breath=1.0+.035*sin(uTime*.24);
    vec3 body=base*close*(.48+.60*light)*silk;
    vec3 pearl=mix(vec3(.42,.66,.82),vec3(.93,.78,.56),smoothstep(.72,.99,light));
    vec3 color=bg+body+pearl*edge*uGlow*breath*(.3+.7*light);
    // Far exterior returns to ink; fine filaments keep their natural topology.
    color=mix(bg,color,smoothstep(0.0,3.0,max(smoothIter,0.0)));
    return color;
}

void main() {
    vec3 color=vec3(0.0);
    for(int i=0;i<4;i++) {
        if(i>=uSamples) break;
        vec2 offset=vec2(0.0);
        if(uSamples==2) offset=(i==0 ? vec2(-.25,-.25) : vec2(.25,.25));
        if(uSamples==4) {
            if(i==0) offset=vec2(-.25,-.25);
            else if(i==1) offset=vec2(.25,-.25);
            else if(i==2) offset=vec2(-.25,.25);
            else offset=vec2(.25,.25);
        }
        color+=julia(gl_FragCoord.xy+offset);
    }
    color/=float(uSamples);
    if(uDebug==1) { gl_FragColor=vec4(color,1.0); return; }
    vec2 uv=gl_FragCoord.xy/uResolution;
    float vignette=1.0-.18*smoothstep(.23,.85,length(uv-.5));
    color*=vignette*uExposure;
    color=1.0-exp(-color); // restrained exponential tone mapping
    color=pow(max(color,vec3(0.0)),vec3(1.0/2.2));
    // Sub-LSB static dither suppresses quantization bands, not visible film grain.
    float dither=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5;
    color=max(vec3(0.0),color+dither/255.0);
    gl_FragColor=vec4(color*uReveal,1.0);
}
