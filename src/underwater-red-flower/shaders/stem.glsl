    // One shared botanical surface for the flower capture and extended stalk.
    float stemHash(vec2 p) {
      vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
      q+=dot(q,q.yzx+33.33);
      return fract((q.x+q.y)*q.z);
    }
    float stemNoise(vec2 p) {
      vec2 i=floor(p),f=fract(p);
      f=f*f*f*(f*(f*6.-15.)+10.);
      return 2.*mix(mix(stemHash(i),stemHash(i+vec2(1.,0.)),f.x),
                    mix(stemHash(i+vec2(0.,1.)),stemHash(i+vec2(1.)),f.x),f.y)-1.;
    }
    float stemEase(float t) {
      t=clamp(t,0.,1.);
      return t*t*t*(t*(t*6.-15.)+10.);
    }
    float evalStemCenterX(float ty,float wt,float wNormX) {
      float tp=max(0.,ty);
      // A shallow upper crook settles into an almost vertical lower stalk.
      // The attachment point and its tangent stay fixed at the receptacle.
      float crook=-.060*stemEase((tp-.015)/.40);
      float growth=.0015*stemNoise(vec2(tp*5.7+4.2,1.8))*smoothstep(0.,.24,tp);
      float flex=pow(smoothstep(.06,1.20,tp),1.30)*u_floatStr;
      float current=flex*(.0031*sin(wt-1.8*tp+.45)
                          +.0012*cos(2.*wt-2.7*tp-.3));
      current+=smoothstep(.08,.90,tp)*.0030*wNormX*u_rippleStr;
      return .484+crook+growth+current;
    }

    float stemScar(vec2 q) {
      // Sparse short diagonal abrasions; each cell has a different centre and depth.
      float cell=floor(q.y*8.3),v=fract(q.y*8.3);
      float h=stemHash(vec2(cell,12.7));
      float centerX=mix(-.34,.34,stemHash(vec2(cell,8.2)));
      float centerY=mix(.28,.72,stemHash(vec2(cell,1.9)));
      float d=v-centerY+(q.x-centerX)*.40;
      float cut=exp(-pow(d/.039,2.))*(1.-smoothstep(.07,.20,abs(q.x-centerX)));
      return cut*smoothstep(.46,.68,h);
    }
    float stemSurface(vec2 q,float fine) {
      float fiber=stemNoise(q*vec2(11.,3.4)+vec2(7.2,-3.1));
      float tissue=stemNoise(q*vec2(5.7,32.)+vec2(-2.1,4.8));
      float pores=stemNoise(q*vec2(26.,89.)+vec2(3.7,9.1));
      return .070*fiber+.035*tissue+.014*fine*pores-.055*stemScar(q);
    }

    vec4 evalHarmonizedStem(vec2 p,float wt,float wNormX,float sharedFlow,
                            float waterLocal,vec3 tint) {
      if(u_stemStr<=.001) return vec4(0.);
      float ty=p.y-.680;
      if(ty<-.02) return vec4(0.);
      float tp=max(0.,ty);
      float center=evalStemCenterX(tp,wt,wNormX);
      float slope=(evalStemCenterX(tp+.004,wt,wNormX)-center)/.004;
      float across=(p.x-center)/sqrt(1.+slope*slope);
      float arc=tp*sqrt(1.+.68*slope*slope);
      float stemScale=clamp(u_stemStr,.35,1.85);
      float radScale=.90+.10*stemScale;
      // Slender, fleshy support: slight taper and irregular tissue swelling,
      // without the previous repeated nodal rings and alternating geometric buds.
      float radius=.0220-.0030*smoothstep(.04,.85,arc);
      radius+=.00060*stemNoise(vec2(arc*12.7,5.1))
             +.00035*stemNoise(vec2(arc*30.1,9.7));
      radius+=.0065*exp(-pow((arc-.055)/.048,2.))
             +.0010*exp(-pow((arc-.227)/.035,2.))
             +.0007*exp(-pow((arc-.613)/.043,2.));
      radius*=radScale;
      float aa=2./u_resolution;
      float mask=(1.-smoothstep(-aa*1.4,aa*1.8,abs(across)-radius))
                 *smoothstep(-.01,.04,ty)*clamp(u_stemStr,0.,1.);
      if(mask<=.001) return vec4(0.);

      float u=clamp(across/radius,-1.,1.);
      float z=sqrt(max(0.,1.-u*u));
      vec2 q=vec2(asin(clamp(u,-.999,.999))/3.14159265,arc);
      // Fine epidermal detail is attenuated when the source texture cannot resolve it.
      float fine=1.-smoothstep(.45,1.20,20./max(2.*radius*u_resolution,1.));
      float height=stemSurface(q,fine);
      float du=(stemSurface(q+vec2(.018,0.),fine)-height)/.018;
      float dv=(stemSurface(q+vec2(0.,.003),fine)-height)/.003;
      float detail=clamp(.65+.20*u_veinStr,.65,1.45);
      vec3 tangent=normalize(vec3(slope,1.,0.));
      vec3 around=vec3(z,0.,-u);
      vec3 normal=normalize(vec3(u,-slope*u,z)-detail*(.18*du*around+.012*dv*tangent));

      float mottling=stemNoise(q*vec2(3.2,4.7)+vec2(1.4,8.1));
      float tissue=stemNoise(q*vec2(7.5,24.)+vec2(8.3,2.1));
      float scar=stemScar(q);
      vec3 albedo=mix(vec3(.155,.218,.050),vec3(.280,.305,.105),.5+.5*mottling);
      albedo=mix(albedo,vec3(.200,.235,.145),.22*(.5+.5*tissue));
      albedo*=.96+.11*tissue+.045*stemNoise(q*vec2(10.,3.))
              +.045*fine*stemNoise(q*vec2(21.,63.)+vec2(5.4,2.8));
      albedo=mix(albedo,vec3(.265,.219,.112),scar*.42);

      float roughness=clamp(.78+.07*tissue+.08*scar,.68,.93);
      vec3 light=normalize(vec3(.35+.10*cos(wt+.5),-.20,.90));
      vec3 halfLight=normalize(light+vec3(0.,0.,1.));
      float diffuse=.17+.93*max(dot(normal,light),0.);
      float broadSpec=pow(max(dot(normal,halfLight),0.),mix(27.,9.,roughness));
      float flow=.86+.14*clamp(sharedFlow,0.,1.);
      float underPetal=.36+.64*smoothstep(.015,.16,arc);
      float depth=1.-.18*smoothstep(.08,1.15,arc);
      vec3 color=albedo*diffuse*flow*underPetal*depth;
      vec3 lightColor=mix(vec3(1.),vec3(1.,.94,.83),clamp(u_warmth*.13,0.,.4));
      color+=lightColor*broadSpec*.035*(1.-.35*roughness)*underPetal;
      // Green epidermis stays independent of the petal tint; only weak nearby bounce is coloured.
      color+=clamp(tint,0.,2.5)*u_colorMix*.008*exp(-3.5*arc)
             *(.35+.65*max(-u,0.))*pow(z,.5);
      color*=.55+.45*pow(z,.30);
      if(waterLocal>.001) color=mix(vec3(waterLocal),color,smoothstep(0.,.45,z));
      return vec4(clamp(color,0.,1.),mask);
    }

