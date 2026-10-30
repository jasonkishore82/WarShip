export const oceanVertex = /* glsl */ `
uniform float uTime;
uniform float uChop;
uniform vec4 uWaves[8]; // dir.x, dir.z, steepness, wavelength

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;
varying float vJacobian;

const float G = 9.81;

void main() {
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  vec2 p = wp.xz;
  float dist = length(p - cameraPosition.xz);

  vec3 T = vec3(1.0, 0.0, 0.0);
  vec3 B = vec3(0.0, 0.0, 1.0);
  vec3 disp = vec3(0.0);

  for (int i = 0; i < 8; i++) {
    vec4 w = uWaves[i];
    // Fade short waves in the distance to avoid shimmering.
    float fade = 1.0 - smoothstep(w.w * 25.0, w.w * 70.0, dist);
    float k = 6.2831853 / w.w;
    float c = sqrt(G / k);
    vec2 d = normalize(w.xy);
    float f = k * (dot(d, p) - c * uTime);
    float s = w.z * uChop * fade;
    float a = s / k;
    float sf = sin(f);
    float cf = cos(f);
    disp += vec3(d.x * a * cf, a * sf, d.y * a * cf);
    T += vec3(-d.x * d.x * s * sf, d.x * s * cf, -d.x * d.y * s * sf);
    B += vec3(-d.x * d.y * s * sf, d.y * s * cf, -d.y * d.y * s * sf);
  }

  wp += disp;
  vWorldPos = wp;
  vNormal = normalize(cross(B, T));
  vHeight = disp.y;
  // Below 1 = water squeezed together at a crest, where foam forms.
  vJacobian = T.x * B.z - T.z * B.x;

  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`

export const oceanFragment = /* glsl */ `
uniform samplerCube uEnv;
uniform vec3 uSunDir;
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uScatter;
uniform float uFoam;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;
varying float vJacobian;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i), f), dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    s += a * gnoise(p);
    p = m * p;
    a *= 0.5;
  }
  return s;
}

// Small ripples layered on top of the big waves.
float ripples(vec2 p) {
  return fbm(p * 0.18 + vec2(uTime * 0.11, uTime * 0.05))
       + 0.6 * fbm(p * 0.47 + vec2(-uTime * 0.09, uTime * 0.13));
}

void main() {
  vec3 toCam = cameraPosition - vWorldPos;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec3 L = normalize(uSunDir);

  // Detail normal from ripples, faded with distance.
  vec2 p = vWorldPos.xz;
  float e = 0.1;
  float h0 = ripples(p);
  float hx = ripples(p + vec2(e, 0.0));
  float hz = ripples(p + vec2(0.0, e));
  float detail = 0.55 * exp(-dist * 0.005);
  vec3 N = normalize(vNormal + vec3(-(hx - h0) / e, 0.0, -(hz - h0) / e) * detail);

  float NdV = max(dot(N, V), 0.001);
  float fresnel = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);

  // Sky reflection (never reflect below the horizon).
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  vec3 reflection = textureCube(uEnv, R).rgb;

  // Sun colour: warm near the horizon.
  float sunUp = smoothstep(-0.05, 0.25, L.y);
  vec3 sunCol = mix(vec3(1.0, 0.5, 0.25), vec3(1.0, 0.96, 0.9), smoothstep(0.0, 0.5, L.y)) * sunUp;

  // Water body: deep colour plus light scattering through wave crests.
  float wrap = max(dot(N, L), 0.0) * 0.5 + 0.5;
  vec3 body = uDeep * (0.25 + 0.75 * sunUp) * wrap;
  float crest = clamp(vHeight * 0.18 + 0.35, 0.0, 1.0);
  vec2 viewH = normalize(-V.xz + 1e-5);
  vec2 sunH = normalize(L.xz + 1e-5);
  float backLit = pow(max(dot(viewH, sunH), 0.0), 4.0);
  body += uScatter * (backLit * 1.6 + 0.35) * crest * crest * sunCol;

  vec3 color = mix(body, reflection, fresnel);

  // Sharp sun glint.
  vec3 H = normalize(L + V);
  float NdH = max(dot(N, H), 0.0);
  color += sunCol * (pow(NdH, 900.0) * 25.0 + pow(NdH, 150.0) * 0.6) * sunUp;

  // Whitecap foam on compressed crests, broken up by noise.
  float foam = smoothstep(uFoam, uFoam - 0.45, vJacobian);
  foam *= smoothstep(0.0, 0.35, fbm(p * 0.6 + vec2(uTime * 0.2, 0.0)) + 0.15);
  foam *= exp(-dist * 0.0015);
  vec3 foamCol = vec3(0.85, 0.9, 0.92) * (0.25 + 0.75 * sunUp) * wrap;
  color = mix(color, foamCol, clamp(foam, 0.0, 1.0) * 0.85);

  // Blend into the sky at the horizon.
  vec3 horizon = textureCube(uEnv, normalize(vec3(-V.x, 0.03, -V.z))).rgb;
  float fog = 1.0 - exp(-dist * 0.00022);
  color = mix(color, horizon, fog);

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
