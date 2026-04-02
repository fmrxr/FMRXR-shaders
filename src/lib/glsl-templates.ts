export const GLSL_TEMPLATES: Record<string, string> = {
  blank: `precision highp float;

uniform float iTime;
uniform vec3  iResolution;
uniform vec4  iMouse;
uniform int   iFrame;

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  vec3 col = vec3(uv, 0.5 + 0.5 * sin(iTime));
  gl_FragColor = vec4(col, 1.0);
}`,

  plasma: `precision highp float;

uniform float iTime;
uniform vec3  iResolution;
uniform vec4  iMouse;
uniform int   iFrame;

// @label Speed  @min 0.1 @max 5.0
uniform float u_speed;
// @label Scale  @min 0.5 @max 8.0
uniform float u_scale;
// @label Gamma  @min 0.2 @max 3.0
uniform float u_gamma;

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  uv = uv * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;

  float t = iTime * u_speed;
  float s = u_scale;

  float v = 0.0;
  v += sin(uv.x * s + t);
  v += sin(uv.y * s + t * 0.73);
  v += sin((uv.x + uv.y) * s * 0.5 + t * 1.31);
  v += sin(length(uv) * s * 2.0 - t * 0.9);
  v += sin(atan(uv.y, uv.x) * 3.0 + length(uv) * s - t);

  vec3 col = 0.5 + 0.5 * cos(v + vec3(0.0, 2.094, 4.189));
  col = pow(max(col, 0.0), vec3(1.0 / max(u_gamma, 0.01)));

  gl_FragColor = vec4(col, 1.0);
}`,

  fractal: `precision highp float;

uniform float iTime;
uniform vec3  iResolution;
uniform vec4  iMouse;

// @label Iterations @min 20.0 @max 512.0
uniform float u_maxIter;
// @label Zoom       @min 0.1  @max 4.0
uniform float u_zoom;
// @label Hue Shift  @min 0.0  @max 6.28
uniform float u_hue;

vec3 palette(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t * 3.0 + vec3(0.0, 0.4, 0.7)) + u_hue + iTime * 0.15);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - iResolution * 0.5) / min(iResolution.x, iResolution.y);
  uv /= u_zoom;
  uv += vec2(-0.5, 0.0);

  vec2 c = uv;
  vec2 z = vec2(0.0);
  float n = 0.0;
  float maxI = u_maxIter;

  for (float i = 0.0; i < 512.0; i++) {
    if (i >= maxI || dot(z, z) > 4.0) break;
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    n = i;
  }

  bool inside = dot(z, z) <= 4.0;
  vec3 col = inside ? vec3(0.0) : palette(n / maxI);

  gl_FragColor = vec4(col, 1.0);
}`,

  raymarching: `precision highp float;

uniform float iTime;
uniform vec3  iResolution;
uniform vec4  iMouse;

// @label Sphere Radius @min 0.2 @max 1.5
uniform float u_radius;
// @label Orbit Speed   @min 0.1 @max 3.0
uniform float u_speed;
// @label Fog Density   @min 0.0 @max 0.15
uniform float u_fog;

float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float opSmoothUnion(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float scene(vec3 p) {
  float t = iTime * u_speed;
  vec3 sp = p - vec3(sin(t) * 0.7, cos(t * 0.8) * 0.4, cos(t * 0.6) * 0.3);
  float s1 = sdSphere(sp, u_radius);
  vec3 sp2 = p - vec3(cos(t * 1.3) * 0.5, sin(t * 1.1) * 0.3, sin(t) * 0.4);
  float s2 = sdSphere(sp2, u_radius * 0.65);
  float floor_ = p.y + 1.8;
  float tor = sdTorus(p - vec3(0.0, -1.5, 0.0), vec2(1.2, 0.15));
  return opSmoothUnion(opSmoothUnion(s1, s2, 0.4), min(floor_, tor), 0.0);
}

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    scene(p + e.xyy) - scene(p - e.xyy),
    scene(p + e.yxy) - scene(p - e.yxy),
    scene(p + e.yyx) - scene(p - e.yyx)
  ));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - iResolution * 0.5) / iResolution.y;
  vec3 ro = vec3(0.0, 0.3, 3.5);
  vec3 rd = normalize(vec3(uv, -1.8));

  float t = 0.0;
  vec3 col = vec3(0.03, 0.03, 0.08);
  bool hit = false;

  for (int i = 0; i < 96; i++) {
    vec3 p = ro + rd * t;
    float d = scene(p);
    if (d < 0.001) { hit = true; break; }
    t += d;
    if (t > 20.0) break;
  }

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 light1 = normalize(vec3(sin(iTime * 0.5) * 2.0, 2.5, 1.5));
    vec3 light2 = normalize(vec3(-1.5, 1.0, -1.0));
    float diff1 = max(dot(n, light1), 0.0);
    float diff2 = max(dot(n, light2), 0.0) * 0.3;
    float spec  = pow(max(dot(reflect(-light1, n), -rd), 0.0), 48.0);
    float ao    = clamp(scene(p + n * 0.15) / 0.15, 0.0, 1.0);
    vec3 albedo = mix(vec3(0.15, 0.4, 1.0), vec3(1.0, 0.4, 0.2), clamp(p.y + 0.5, 0.0, 1.0));
    col = albedo * (diff1 + diff2) * ao + spec * vec3(1.0, 0.95, 0.9);
    float fog = 1.0 - exp(-t * u_fog);
    col = mix(col, vec3(0.03, 0.03, 0.08), fog);
  }

  col = pow(max(col, 0.0), vec3(0.4545));
  gl_FragColor = vec4(col, 1.0);
}`,

  noise: `precision highp float;

uniform float iTime;
uniform vec3  iResolution;

// @label Octaves @min 1.0 @max 8.0
uniform float u_octaves;
// @label Speed   @min 0.0 @max 2.0
uniform float u_speed;
// @label Warp    @min 0.0 @max 2.0
uniform float u_warp;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1, 0));
  float c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= u_octaves) break;
    v += a * noise(p);
    p = p * 2.1 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  float t  = iTime * u_speed;

  vec2 p = uv * 3.0 + vec2(t * 0.3, t * 0.2);
  vec2 q = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
  vec2 r = vec2(fbm(p + u_warp * q + vec2(1.7, 9.2) + t * 0.1),
                fbm(p + u_warp * q + vec2(8.3, 2.8) + t * 0.1));
  float f = fbm(p + u_warp * r);

  vec3 col = mix(vec3(0.05, 0.08, 0.2),  vec3(0.7, 0.3, 0.1),  clamp(f * 2.0, 0.0, 1.0));
      col = mix(col,                      vec3(0.9, 0.7, 0.3),  clamp(f * f * 4.0, 0.0, 1.0));
      col = mix(col,                      vec3(1.0, 0.95, 0.85), clamp(pow(f, 5.0) * 8.0, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
}`,

  reaction: `precision highp float;

uniform float iTime;
uniform vec3  iResolution;
uniform sampler2D iChannel0;

// @label Feed Rate @min 0.01 @max 0.08
uniform float u_feed;
// @label Kill Rate @min 0.04 @max 0.07
uniform float u_kill;

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  vec2 texel = 1.0 / iResolution.xy;

  vec4 center = texture2D(iChannel0, uv);
  vec4 laplacian =
    texture2D(iChannel0, uv + texel * vec2(-1, 0)) +
    texture2D(iChannel0, uv + texel * vec2( 1, 0)) +
    texture2D(iChannel0, uv + texel * vec2( 0,-1)) +
    texture2D(iChannel0, uv + texel * vec2( 0, 1)) -
    4.0 * center;

  float A = center.r;
  float B = center.g;

  float dA = 1.0;
  float dB = 0.5;
  float f  = u_feed;
  float k  = u_kill;
  float dt = 1.0;

  float reaction = A * B * B;
  float newA = A + (dA * laplacian.r - reaction + f * (1.0 - A)) * dt;
  float newB = B + (dB * laplacian.g + reaction - (k + f) * B) * dt;

  gl_FragColor = vec4(clamp(newA, 0.0, 1.0), clamp(newB, 0.0, 1.0), 0.0, 1.0);
}`,
};

export const DEFAULT_BUFFER_CODE = `precision highp float;

uniform float iTime;
uniform vec3  iResolution;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  gl_FragColor = texture2D(iChannel0, uv);
}`;
