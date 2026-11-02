/* AP2 solar system: hierarchical transforms are composed with the textbook MV.js. */
// Periods are sidereal days; negative rotations represent retrograde spin.
// NASA Planetary Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/
// Orbit-shape/orientation and illustrative initial phase: NASA JPL J2000
// https://ssd.jpl.nasa.gov/planets/approx_pos.html (Table 1).
// Earth uses the Earth-Moon barycenter elements as an approximation. Elements are
// frozen at epoch; positions are illustrative, not a date-accurate ephemeris.
// Geometry radii and semimajor axes remain exaggerated for visibility.
export const PLANETS = [
  { name: 'mercury', orbitAU: 0.38709927, eccentricity: 0.20563593, inclination: 7.00497902, meanLongitude: 252.25032350, periLongitude: 77.45779628, ascendingNode: 48.33076593, orbit: 2.2, radius: 0.12, orbitDays: 88.0, rotationDays: 1407.6/24, axialTilt: 0.034, color: [0.62, 0.59, 0.55] },
  { name: 'venus', orbitAU: 0.72333566, eccentricity: 0.00677672, inclination: 3.39467605, meanLongitude: 181.97909950, periLongitude: 131.60246718, ascendingNode: 76.67984255, orbit: 3.0, radius: 0.20, orbitDays: 224.7, rotationDays: -5832.5/24, axialTilt: -2.6, color: [0.91, 0.70, 0.39] },
  { name: 'earth', orbitAU: 1.00000261, eccentricity: 0.01671123, inclination: -0.00001531, meanLongitude: 100.46457166, periLongitude: 102.93768193, ascendingNode: 0, orbit: 4.0, radius: 0.25, orbitDays: 365.256, rotationDays: 23.9345/24, axialTilt: 23.5, color: [0.25, 0.52, 0.85] },
  { name: 'mars', orbitAU: 1.52371034, eccentricity: 0.09339410, inclination: 1.84969142, meanLongitude: -4.55343205, periLongitude: -23.94362959, ascendingNode: 49.55953891, orbit: 5.0, radius: 0.17, orbitDays: 687.0, rotationDays: 24.6229/24, axialTilt: 25.2, color: [0.76, 0.36, 0.24] },
  { name: 'jupiter', orbitAU: 5.202887, eccentricity: 0.04838624, inclination: 1.30439695, meanLongitude: 34.39644051, periLongitude: 14.72847983, ascendingNode: 100.47390909, orbit: 7.3, radius: 0.53, orbitDays: 4331, rotationDays: 9.9/24, axialTilt: 3.1, color: [0.79, 0.65, 0.49] },
  { name: 'saturn', orbitAU: 9.53667594, eccentricity: 0.05386179, inclination: 2.48599187, meanLongitude: 49.95424423, periLongitude: 92.59887831, ascendingNode: 113.66242448, orbit: 9.3, radius: 0.45, orbitDays: 10747, rotationDays: 10.7/24, axialTilt: 26.7, color: [0.85, 0.75, 0.51] },
  { name: 'uranus', orbitAU: 19.18916464, eccentricity: 0.04725744, inclination: 0.77263783, meanLongitude: 313.23810451, periLongitude: 170.95427630, ascendingNode: 74.01692503, orbit: 11.3, radius: 0.34, orbitDays: 30589, rotationDays: -17.2/24, axialTilt: -82.2, color: [0.49, 0.77, 0.80] },
  { name: 'neptune', orbitAU: 30.06992276, eccentricity: 0.00859048, inclination: 1.77004347, meanLongitude: -55.12002969, periLongitude: 44.96476227, ascendingNode: 131.78422574, orbit: 13.2, radius: 0.33, orbitDays: 59800, rotationDays: 16.1/24, axialTilt: 28.3, color: [0.24, 0.38, 0.82] }
];
// For retrograde Venus and Uranus, signed period + complementary axis are equivalent
// to their >90° obliquities without accidentally reversing rotation twice.
export const SUN_ROTATION_DAYS = 25.38; // representative near-equatorial solar sidereal rotation
export const MOON_ORBIT_DAYS = 27.321661; // sidereal revolution and mean spin, Earth days
export const MOON_ECCENTRICITY = 0.0549; // NASA mean lunar eccentricity
export const MOON_INCLINATION_DEG = 5.145; // approximate inclination to ecliptic
export const ASTEROID_ORBIT_DAYS = 1680; // representative visual period, not an ephemeris
export function cycleAngle(days, periodDays) { return ((days % Math.abs(periodDays)) / periodDays) * 360; }
// Solve M = E - e*sin(E), with M reduced to [-pi, pi]. For the eight
// planetary eccentricities (all below .21), Newton iteration converges rapidly.
export function solveKepler(meanAnomaly, eccentricity) {
  const tau = 2 * Math.PI;
  const M = ((meanAnomaly + Math.PI) % tau + tau) % tau - Math.PI;
  let E = M;
  for (let i = 0; i < 12; i++) {
    const step = (E - eccentricity * Math.sin(E) - M) / (1 - eccentricity * Math.cos(E));
    E -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  return E;
}
// Eccentric anomaly -> orbital plane -> J2000 ecliptic. NASA's ecliptic
// (x,y,z) maps to WebGL (x,z-up,-y) so existing Ry rotations remain prograde.
// A display semimajor axis is used instead of AU; the focus remains at the Sun.
export function orbitalPointFromE(p, eccentricAnomaly, orbitScale = 'display') {
  const rad = Math.PI / 180;
  const inc = p.inclination * rad, node = p.ascendingNode * rad;
  const omega = (p.periLongitude - p.ascendingNode) * rad;
  const co = Math.cos(omega), so = Math.sin(omega), cn = Math.cos(node), sn = Math.sin(node), ci = Math.cos(inc), si = Math.sin(inc);
  const axis = orbitScale === 'true' ? 4 * p.orbitAU / 1.00000261 : p.orbit;
  const x = axis * (Math.cos(eccentricAnomaly) - p.eccentricity);
  const y = axis * Math.sqrt(1 - p.eccentricity * p.eccentricity) * Math.sin(eccentricAnomaly);
  const ex = (co * cn - so * sn * ci) * x + (-so * cn - co * sn * ci) * y;
  const ey = (co * sn + so * cn * ci) * x + (-so * sn + co * cn * ci) * y;
  const ez = so * si * x + co * si * y;
  return [ex, ez, -ey];
}
export function planetPosition(p, days, orbitScale = 'display') {
  const meanAtEpoch = (p.meanLongitude - p.periLongitude) * Math.PI / 180;
  const meanAnomaly = meanAtEpoch + 2 * Math.PI * ((days % p.orbitDays) / p.orbitDays);
  return orbitalPointFromE(p, solveKepler(meanAnomaly, p.eccentricity), orbitScale);
}
export function advanceSimulationDays(days, elapsedSeconds, simulationSpeed) {
  return days + Math.max(0, elapsedSeconds) * Math.max(0, simulationSpeed);
}
// Keep two accumulated phases so changing a multiplier never jumps the scene.
export function advanceMotionDays(orbitDays, rotationDays, dt, speed, orbitMultiplier, rotationMultiplier) {
  return [advanceSimulationDays(orbitDays, dt, speed * orbitMultiplier),
    advanceSimulationDays(rotationDays, dt, speed * rotationMultiplier)];
}
// Local x-z orbital-plane position relative to Earth, which is one focus.
// Perigee occurs at simulation day zero; this is an illustrative phase, not an ephemeris.
export function moonPointFromE(eccentricAnomaly, semimajorAxis = 1) {
  return [semimajorAxis * (Math.cos(eccentricAnomaly) - MOON_ECCENTRICITY), 0,
    -semimajorAxis * Math.sqrt(1 - MOON_ECCENTRICITY ** 2) * Math.sin(eccentricAnomaly)];
}
export function moonPosition(days, semimajorAxis) {
  const meanAnomaly = 2 * Math.PI * ((days % MOON_ORBIT_DAYS) / MOON_ORBIT_DAYS);
  return moonPointFromE(solveKepler(meanAnomaly, MOON_ECCENTRICITY), semimajorAxis);
}
// The shared orbital frame translates to the elliptical position, then rotates
// uniformly by mean anomaly. This yields a sidereal spin period equal to the
// orbit period, while the nonuniform true anomaly produces optical libration.
// Local -X points toward Earth at perigee and apogee, and toward the mean
// orbital direction at intermediate phases. Fixed tilt and apsis are simplified.
export function moonFrameForAnchor(anchor, days, semimajorAxis, rotationDays = days) {
  return mult(mult(mult(anchor, rotateZ(MOON_INCLINATION_DEG)), translate(...moonPosition(days, semimajorAxis))),
    rotateY(cycleAngle(rotationDays, MOON_ORBIT_DAYS)));
}
const COLORS = { sun: [1, 0.70, 0.2], moon: [0.72, 0.73, 0.75] };
const VERTEX = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aUV;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
uniform float uPointSize;
uniform bool uGlow;
out vec3 vLocal;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUV;
void main() {
  if (uGlow) {
    vec4 center = uView * vec4(0.0, 0.0, 0.0, 1.0);
    vUV = aPosition.xy;
    vWorld = vec3(0.0); vNormal = vec3(0.0); vLocal = vec3(0.0);
    gl_Position = uProjection * (center + vec4(aPosition.xy * 2.6, 0.0, 0.0));
    return;
  }
  vLocal = aPosition;
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  gl_Position = uProjection * uView * world;
  gl_PointSize = uPointSize;
}`;
const FRAGMENT = `#version 300 es
precision highp float;
in vec3 vLocal;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUV;
uniform vec3 uColor;
uniform sampler2D uTexture;
uniform bool uTextured;
uniform bool uUnlit;
uniform bool uGlow;
uniform bool uSolar;
uniform bool uEarth;
uniform bool uRing;
uniform bool uGas;
uniform bool uCloud;
uniform float uSolarTime;
uniform vec3 uEye;
out vec4 fragColor;
float hash31(vec3 p) {
  p = fract(p * .1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i+vec3(1,0,0)), f.x),
                 mix(hash31(i+vec3(0,1,0)), hash31(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i+vec3(0,0,1)), hash31(i+vec3(1,0,1)), f.x),
                 mix(hash31(i+vec3(0,1,1)), hash31(i+vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  if (uGlow) {
    float r = length(vUV);
    float alpha = (0.19 * exp(-r * r * 7.5) + 0.024 * exp(-r * r * 2.5)) * (1.0 - smoothstep(0.72, 1.0, r));
    fragColor = vec4(1.0, 0.43, 0.10, alpha);
    return;
  }
  if (uSolar) {
    vec3 p = normalize(vLocal);
    float phase = uSolarTime * (6.28318530718 / 2000.0);
    vec3 drift = vec3(sin(phase), cos(phase), 0.0) * 0.4;
    float large = noise3(p * 6.0 + drift);
    float medium = noise3(p * 19.0 - drift * 1.5);
    float fine = noise3(p * 65.0 + drift * 2.0);
    float granules = 0.52 * large + 0.30 * medium + 0.18 * fine;
    float spots = smoothstep(0.67, 0.80, noise3(p * 9.0 + vec3(11.0))) * smoothstep(0.58, 0.72, large);
    vec3 col = mix(vec3(0.82, 0.20, 0.035), vec3(1.0, 0.77, 0.30), smoothstep(0.25, 0.72, granules));
    if (uTextured) col *= mix(vec3(1.0), texture(uTexture, vUV).rgb * 1.18, 0.15);
    col = mix(col, vec3(0.30, 0.045, 0.012), spots * 0.70);
    float facing = max(dot(normalize(vNormal), normalize(uEye - vWorld)), 0.0);
    col *= 0.73 + 0.27 * pow(facing, 0.45);
    fragColor = vec4(col, 1.0);
    return;
  }
  if (uCloud) {
    float cloud = texture(uTexture, vUV).r;
    float alpha = smoothstep(0.10, 0.72, cloud) * 0.72;
    float sunlit = max(dot(normalize(vNormal), normalize(-vWorld)), 0.0);
    fragColor = vec4(vec3(0.18, 0.23, 0.31) + vec3(0.80, 0.78, 0.75) * sunlit, alpha);
    return;
  }
  vec3 albedo = uTextured ? texture(uTexture, vUV).rgb : uColor;
  if (uUnlit) { fragColor = vec4(albedo, 1.0); return; }
  if (uRing) {
    // Artistically approximate concentric ice-and-dust bands with a Cassini-like gap.
    // vLocal is the position on the unscaled ring; it works on both faces.
    float radius = length(vLocal.xz);
    float band = 0.5 + 0.5 * sin(radius * 100.0 + 0.6 * sin(radius * 35.0));
    float fine = 0.5 + 0.5 * sin(radius * 310.0);
    float gap = smoothstep(1.68, 1.70, radius) * (1.0 - smoothstep(1.735, 1.755, radius));
    float edge = smoothstep(1.30, 1.34, radius) * (1.0 - smoothstep(1.99, 2.05, radius));
    float dust = mix(0.50, 0.92, 0.68 * band + 0.32 * fine) * (1.0 - 0.82 * gap);
    float illumination = 0.32 + 0.68 * abs(dot(normalize(vNormal), normalize(-vWorld)));
    vec3 ringColor = mix(vec3(0.46, 0.36, 0.26), vec3(0.89, 0.79, 0.61), 0.65 * band + 0.35 * fine);
    fragColor = vec4(ringColor * illumination, edge * dust);
    return;
  }
  vec3 n = normalize(vNormal);
  vec3 lightDir = normalize(-vWorld);
  vec3 viewDir = normalize(uEye - vWorld);
  float ndl = dot(n, lightDir);
  // Restrained cool fill reveals texture on the night side; daylight remains directional.
  // A slightly stronger display fill for gas giants preserves subtle cloud bands in wide views.
  float daylight = max(ndl, 0.0);
  vec3 ambient = uGas ? vec3(0.28, 0.29, 0.32) : vec3(0.17, 0.18, 0.21);
  vec3 light = ambient + daylight * vec3(0.79, 0.75, 0.69);
  vec3 color = albedo * light;
  if (uEarth) {
    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.2);
    float atmosphereDay = smoothstep(-0.18, 0.42, ndl);
    color += vec3(0.08, 0.22, 0.39) * rim * (0.18 + 0.82 * atmosphereDay);
    // Approximate an ocean mask from blue albedo; avoid a uniform specular sheen on land.
    float ocean = smoothstep(0.005, 0.06, albedo.b - max(albedo.r, albedo.g));
    vec3 halfDir = normalize(lightDir + viewDir);
    color += vec3(0.22, 0.26, 0.30) * ocean * pow(max(dot(n, halfDir), 0.0), 40.0) * max(ndl, 0.0);
  }
  fragColor = vec4(color, 1.0);
}`;

function shader(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl) {
  const p = gl.createProgram();
  gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
// Interleaved position, normal and UV. A duplicated seam allows 0 and 1 texture U.
function makeSphere(rows = 48, columns = 72) {
  const data = [];
  const vertex = (i, j) => {
    const theta = Math.PI * i / rows, phi = 2 * Math.PI * j / columns;
    const x = Math.sin(theta) * Math.cos(phi), y = Math.cos(theta), z = Math.sin(theta) * Math.sin(phi);
    return [x, y, z, x, y, z, j / columns, 1 - i / rows];
  };
  for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
    const a = vertex(i, j), b = vertex(i + 1, j), c = vertex(i + 1, j + 1), d = vertex(i, j + 1);
    data.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  return data;
}
// Unit semimajor axis, scaled and tilted by the Earth-local model matrix.
export function makeMoonOrbit(segments = 512) {
  const data = [];
  for (let i = 0; i < segments; i++) {
    const [x, y, z] = moonPointFromE(i * 2 * Math.PI / segments);
    data.push(x, y, z, 0, 1, 0, i / segments, 0);
  }
  return data;
}
// Same focus, orientation and display semimajor axis as planetPosition().
export function makePlanetOrbit(p, orbitScale = 'display', segments = 512) {
  const data = [];
  for (let i = 0; i < segments; i++) {
    const [x, y, z] = orbitalPointFromE(p, i * 2 * Math.PI / segments, orbitScale);
    data.push(x, y, z, 0, 1, 0, i / segments, 0);
  }
  return data;
}
function makeRing() {
  const data = [], n = 144, inner = 1.3, outer = 2.05;
  const p = (r, a) => [r * Math.cos(a), 0, r * Math.sin(a), 0, 1, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const a = i * 2 * Math.PI / n, b = (i + 1) * 2 * Math.PI / n;
    data.push(...p(inner, a), ...p(outer, a), ...p(outer, b), ...p(inner, a), ...p(outer, b), ...p(inner, b));
  }
  return data;
}
function makeAsteroids(orbitScale = 'display') {
  const data = [];
  // A seeded generator makes the belt stable across page reloads.
  let seed = 7231;
  const rand = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 1000; i++) {
    const a = rand() * Math.PI * 2, r = orbitScale === 'true' ? 8.8 + rand() * 4.4 : 5.6 + rand() * 1.1, y = (rand() - 0.5) * 0.22;
    data.push(r * Math.cos(a), y, r * Math.sin(a), 0, 1, 0, 0, 0);
  }
  return data;
}

// Screen-facing quad for a continuous, depth-tested halo around the solar disk.
function makeHaloQuad() {
  const vertex = (x, y) => [x, y, 0, 0, 0, 1, 0, 0];
  return [...vertex(-1,-1), ...vertex(1,-1), ...vertex(1,1),
          ...vertex(-1,-1), ...vertex(1,1), ...vertex(-1,1)];
}

// A deterministic, distant star field stays fixed in the world as the camera orbits.
function makeStars() {
  const data = [];
  let seed = 48271;
  const rand = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 900; i++) {
    const y = 2 * rand() - 1, a = 2 * Math.PI * rand();
    const r = Math.sqrt(1 - y * y), d = 55 + rand() * 10;
    data.push(d * r * Math.cos(a), d * y, d * r * Math.sin(a), 0, 1, 0, 0, 0);
  }
  return data;
}

export class SolarScene {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext('webgl2', { antialias: true });
    if (!gl) throw new Error('此浏览器不支持 WebGL 2，请使用新版 Chrome、Edge 或 Firefox。');
    this.program = program(gl);
    gl.useProgram(this.program);
    this.loc = {};
    for (const n of ['uModel', 'uView', 'uProjection', 'uPointSize', 'uColor', 'uTexture', 'uTextured', 'uUnlit', 'uGlow', 'uSolar', 'uEarth', 'uRing', 'uGas', 'uCloud', 'uSolarTime', 'uEye']) this.loc[n] = gl.getUniformLocation(this.program, n);
    this.attributes = ['aPosition', 'aNormal', 'aUV'].map(n => gl.getAttribLocation(this.program, n));
    this.sphere = this.mesh(makeSphere());
    this.halo = this.mesh(makeHaloQuad());
    this.moonOrbit = this.mesh(makeMoonOrbit()); // Earth-centred focus, unit semimajor axis
    this.planetOrbits = Object.fromEntries(['display', 'true'].map(scale => [scale, Object.fromEntries(PLANETS.map(p => [p.name, this.mesh(makePlanetOrbit(p, scale))]))]));
    this.ring = this.mesh(makeRing());
    this.asteroids = Object.fromEntries(['display', 'true'].map(scale => [scale, this.mesh(makeAsteroids(scale))]));
    this.stars = this.mesh(makeStars());
    this.textures = {};
    for (const n of ['sun', 'moon', 'earth_clouds', ...PLANETS.map(p => p.name)]) this.loadTexture(n);
    this.previousTime = null;
    this.simulationDays = 0;
    this.rotationDays = 0;
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.012, 0.02, 0.055, 1);
    gl.uniform1i(this.loc.uTexture, 0);
  }
  mesh(data) {
    const gl = this.gl, buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return { buffer, count: data.length / 8 };
  }
  loadTexture(name) {
    const gl = this.gl, entry = this.textures[name] = { texture: gl.createTexture(), ready: false };
    const image = new Image();
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      // Bitmap top row is geographic north. Flipping on upload makes V=1 correspond to that row.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      entry.ready = true;
    };
    image.onerror = () => {
      const message = `无法加载纹理：textures/${name}.png，将使用纯色。`;
      console.warn(message);
      this.canvas.dispatchEvent(new CustomEvent('textureerror', {detail: {name, message}}));
    };
    // Version the resource URLs so a browser cannot reuse the older illustrative maps.
    image.src = `textures/${name}.png?v=20261031-2k`;
  }
  draw(mesh, mode, model, color, textureName = null, unlit = false, pointSize = 2) {
    const gl = this.gl, [pos, normal, uv] = this.attributes;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    for (const a of [pos, normal, uv]) gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 32, 12);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 32, 24);
    gl.uniformMatrix4fv(this.loc.uModel, false, flatten(model));
    gl.uniform3fv(this.loc.uColor, color);
    const entry = textureName && this.textures[textureName];
    gl.uniform1i(this.loc.uTextured, !!(entry && entry.ready));
    gl.uniform1i(this.loc.uUnlit, unlit);
    gl.uniform1i(this.loc.uEarth, textureName === 'earth');
    gl.uniform1i(this.loc.uRing, mesh === this.ring);
    gl.uniform1i(this.loc.uGas, ['jupiter', 'saturn', 'uranus', 'neptune'].includes(textureName));
    gl.uniform1i(this.loc.uCloud, textureName === 'earth_clouds');
    gl.uniform1f(this.loc.uPointSize, pointSize);
    if (entry && entry.ready) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, entry.texture); }
    gl.drawArrays(mode, 0, mesh.count);
  }
  resetTime() {
    this.previousTime = null;
    this.simulationDays = 0;
    this.rotationDays = 0;
  }
  // Ray and returned world-space point use the same centers and display radii as render().
  pickSurface(origin, direction, sceneMode = 'system', orbitScale = 'display') {
    const bodies = [{ center: [0, 0, 0], radius: 0.8 }];
    for (const p of PLANETS) {
      if (sceneMode === 'focus' && p.name !== 'earth') continue;
      const anchor = translate(...planetPosition(p, this.simulationDays, orbitScale));
      bodies.push({ center: [anchor[0][3], anchor[1][3], anchor[2][3]], radius: p.name === 'earth' && sceneMode === 'focus' ? 0.34 : p.radius });
      if (p.name === 'earth') {
        const distance = sceneMode === 'focus' ? 0.78 : 0.57;
        const moon = moonFrameForAnchor(anchor, this.simulationDays, distance);
        bodies.push({ center: [moon[0][3], moon[1][3], moon[2][3]], radius: sceneMode === 'focus' ? 0.105 : 0.075 });
      }
    }
    const length = Math.hypot(...direction);
    if (!(length > 0)) return null;
    const d = direction.map(x => x / length);
    let closest = Infinity;
    for (const {center, radius} of bodies) {
      const oc = origin.map((x, i) => x - center[i]);
      const b = oc.reduce((sum, x, i) => sum + x * d[i], 0);
      const c = oc.reduce((sum, x) => sum + x * x, 0) - radius * radius;
      const disc = b * b - c;
      if (disc < 0) continue;
      const near = -b - Math.sqrt(disc), far = -b + Math.sqrt(disc);
      const t = near > 1e-5 ? near : far > 1e-5 ? far : Infinity;
      if (t < closest) closest = t;
    }
    return Number.isFinite(closest) ? origin.map((x, i) => x + d[i] * closest) : null;
  }
  render({ time = 0, simulationSpeed = 2, orbitSpeed = 1, rotationSpeed = 1, tilt = 23.5, showOrbits = true,
    projection = 'perspective', yaw = 0.8, pitch = 0.55, distance = 35, sceneMode = 'system', target = [0, 0, 0], orbitScale = 'display' }) {
    const gl = this.gl;
    const dt = this.previousTime === null ? 0 : Math.max(0, time - this.previousTime);
    this.previousTime = time;
    [this.simulationDays, this.rotationDays] = advanceMotionDays(
      this.simulationDays, this.rotationDays, dt, simulationSpeed, orbitSpeed, rotationSpeed);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    // Orthographic distance controls scale, not camera proximity; keep the eye clear of geometry.
    const eyeDistance = projection === 'orthographic' ? 700 : distance;
    const eye = vec3(target[0] + eyeDistance * Math.cos(pitch) * Math.sin(yaw), target[1] + eyeDistance * Math.sin(pitch), target[2] + eyeDistance * Math.cos(pitch) * Math.cos(yaw));
    const view = lookAt(eye, vec3(...target), vec3(0, 1, 0));
    const aspect = w / h;
    // On portrait screens keep at least the desktop horizontal field of view.
    // Both projections share the same adjustment so switching preserves framing.
    const halfAngle = Math.atan(Math.tan(22.5 * Math.PI / 180) / Math.min(aspect, 1));
    const half = distance * Math.tan(halfAngle);
    const proj = projection === 'orthographic' ? ortho(-half * aspect, half * aspect, -half, half, 0.01, 2000) : perspective(halfAngle * 360 / Math.PI, aspect, 0.01, 2000);
    gl.uniformMatrix4fv(this.loc.uView, false, flatten(view));
    gl.uniform3fv(this.loc.uEye, eye);
    gl.uniform1i(this.loc.uGlow, false);
    gl.uniformMatrix4fv(this.loc.uProjection, false, flatten(proj));
    // Draw dim stars without writing depth so they never hide a celestial body.
    gl.depthMask(false);
    this.draw(this.stars, gl.POINTS, mult(translate(...eye), scalem(10, 10, 10)), [0.30, 0.38, 0.49], null, true, Math.max(1, dpr));
    gl.depthMask(true);
    const visiblePlanets = sceneMode === 'focus' ? PLANETS.filter(p => p.name === 'earth') : PLANETS;
    if (showOrbits) for (const p of visiblePlanets) this.draw(this.planetOrbits[orbitScale][p.name], gl.LINE_LOOP, mat4(), [0.22, 0.32, 0.45], null, true);
    if (sceneMode !== 'focus') this.draw(this.asteroids[orbitScale], gl.POINTS, rotateY(cycleAngle(this.simulationDays, ASTEROID_ORBIT_DAYS)), [0.58, 0.55, 0.50], null, true, 2 * dpr);
    const sun = mult(rotateY(cycleAngle(this.rotationDays, SUN_ROTATION_DAYS)), scalem(0.8, 0.8, 0.8));
    gl.uniform1i(this.loc.uSolar, true);
    gl.uniform1f(this.loc.uSolarTime, this.rotationDays % 2000);
    this.draw(this.sphere, gl.TRIANGLES, sun, COLORS.sun, 'sun', true);
    gl.uniform1i(this.loc.uSolar, false);
    // Render the smooth corona behind the solar disk and without writing depth.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.depthMask(false);
    gl.uniform1i(this.loc.uGlow, true);
    this.draw(this.halo, gl.TRIANGLES, mat4(), COLORS.sun, null, true);
    gl.uniform1i(this.loc.uGlow, false);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    for (const p of visiblePlanets) {
      // Translation only: the spin axis remains fixed as the planet travels.
      const anchor = translate(...planetPosition(p, this.simulationDays, orbitScale));
      const axis = p.name === 'earth' ? tilt : p.axialTilt;
      const radius = p.name === 'earth' && sceneMode === 'focus' ? 0.34 : p.radius;
      const globe = mult(mult(mult(anchor, rotateZ(axis)), rotateY(cycleAngle(this.rotationDays, p.rotationDays))), scalem(radius, radius, radius));
      this.draw(this.sphere, gl.TRIANGLES, globe, p.color, p.name);
      if (p.name === 'earth' && this.textures.earth_clouds.ready) {
        const clouds = mult(mult(mult(anchor, rotateZ(axis)), rotateY(cycleAngle(this.rotationDays, p.rotationDays) + (this.rotationDays % 800) * 0.45)), scalem(radius * 1.012, radius * 1.012, radius * 1.012));
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        this.draw(this.sphere, gl.TRIANGLES, clouds, [1, 1, 1], 'earth_clouds');
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
      if (p.name === 'saturn') {
        const ringModel = mult(mult(anchor, rotateZ(axis)), scalem(p.radius, p.radius, p.radius));
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        this.draw(this.ring, gl.TRIANGLES, ringModel, [0.68, 0.58, 0.39]);
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
      if (p.name === 'earth') {
        // The moon inherits the Earth position, not its daily rotation, axial tilt or scale.
        // Tilt the lunar orbital plane, translate along the ellipse, and spin with mean anomaly.
        const moonDistance = sceneMode === 'focus' ? 0.78 : 0.57;
        const moonRadius = sceneMode === 'focus' ? 0.105 : 0.075;
        const moonFrame = moonFrameForAnchor(anchor, this.simulationDays, moonDistance, this.rotationDays);
        if (showOrbits) this.draw(this.moonOrbit, gl.LINE_LOOP, mult(mult(anchor, rotateZ(MOON_INCLINATION_DEG)), scalem(moonDistance, 1, moonDistance)), [0.36, 0.42, 0.53], null, true);
        this.draw(this.sphere, gl.TRIANGLES, mult(moonFrame, scalem(moonRadius, moonRadius, moonRadius)), COLORS.moon, 'moon');
      }
    }
  }
}
