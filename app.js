import { SolarScene } from './scene.js';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const state = { time: 0, simulationSpeed: 2, tilt: 23.5, showOrbits: true, projection: 'perspective', sceneMode: 'focus', orbitScale: 'display', yaw: 0.65, pitch: 0.55, distance: 12, target: [0, 0, 0] };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let roaming = !reducedMotion, roamPhase = state.yaw, last = null;
// Orthographic magnification (distance) is independent of the eye position.
// Keep this in sync with SolarScene.render.
const ORTHO_EYE_DISTANCE = 700;
const MAX_DISTANCE = 800;
const pointers = new Map();
let lastOrthoAnchor = null;
let scene, contextLost = false, lostSimulationDays = 0;
const missingTextures = new Set();
canvas.addEventListener('textureerror', event => { missingTextures.add(event.detail.name); const warning = $('texture-warning'); warning.hidden = false; warning.textContent = `部分纹理加载失败（${[...missingTextures].join('、')}），当前显示替代颜色。请检查网络或刷新页面。`; });
try { scene = new SolarScene(canvas); } catch (error) { $('error').hidden = false; $('error').textContent = `无法启动 WebGL 2：${error.message}。请使用支持 WebGL 2 的浏览器。`; throw error; }
function cameraUI() {
  $('camera-status').textContent = roaming ? '环绕漫游中' : '手动视角';
  $('roam').innerHTML = `${roaming ? 'Ⅱ' : '▶'} <span>${roaming ? '暂停漫游' : '继续漫游'}</span><kbd>SPACE</kbd>`;
}
function toggleRoam() { roaming = !roaming; roamPhase = state.yaw; cameraUI(); }
function setProjection(value) {
  if (state.projection === 'orthographic' && value === 'perspective' && lastOrthoAnchor && scene.pickSurface) {
    // Rebase the target plane to the visible anchor depth without changing its screen position.
    const rect = canvas.getBoundingClientRect();
    const ray = pointerRay(rect.left + lastOrthoAnchor.x * rect.width, rect.top + lastOrthoAnchor.y * rect.height);
    const hit = scene.pickSurface(ray.origin, ray.direction, state.sceneMode, state.orbitScale);
    if (hit) {
      const backward = [Math.cos(state.pitch)*Math.sin(state.yaw), Math.sin(state.pitch), Math.cos(state.pitch)*Math.cos(state.yaw)];
      const shift = hit.reduce((sum, v, i) => sum + (v - state.target[i]) * backward[i], 0);
      state.target = state.target.map((v, i) => v + backward[i] * shift);
    }
  }
  lastOrthoAnchor = null;
  state.projection = value;
  for (const name of ['perspective', 'orthographic']) { $(name).classList.toggle('active', name === value); $(name).setAttribute('aria-pressed', String(name === value)); }
  $('projection-label').textContent = value === 'perspective' ? '透视投影' : '正交投影';
}
// Discrete, labelled rates cover slow rotation and orbital-scale views without separate clocks.
const SIMULATION_RATES = [0, 0.01, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50];
function updateSimulationSpeed() {
  const rate = SIMULATION_RATES[Number($('simulation-speed').value)];
  state.simulationSpeed = rate;
  $('simulation-speed-value').textContent = rate === 0 ? '已暂停' : `1 秒 = ${rate} 模拟日`;
  $('simulation-speed').setAttribute('aria-valuetext', rate === 0 ? '模拟时间暂停' : `每真实秒 ${rate} 模拟日`);
}
$('simulation-speed').addEventListener('input', updateSimulationSpeed);
$('tilt').addEventListener('input', event => {
  state.tilt = Number(event.target.value);
  $('tilt-value').textContent = `${state.tilt.toFixed(1)}°`;
});
function refreshScaleUI() {
  for (const [id, value] of [['scale-display', 'display'], ['scale-true', 'true']]) {
    $(id).classList.toggle('active', state.orbitScale === value);
    $(id).setAttribute('aria-pressed', String(state.orbitScale === value));
  }
  $('scale-note').textContent = state.orbitScale === 'true'
    ? '轨道半长轴按真实比例；天体大小和地月距离为展示而放大。'
    : '为展示压缩行星距离；天体大小和地月距离非真实比例。';
}
function setMode(value) {
  state.sceneMode = value;
  if (value === 'focus') state.orbitScale = 'display';
  state.distance = value === 'focus' ? 12 : state.orbitScale === 'true' ? 400 : 35;
  state.target = [0, 0, 0]; lastOrthoAnchor = null;
  for (const name of ['focus', 'system']) { $(name).classList.toggle('active', name === value); $(name).setAttribute('aria-pressed', String(name === value)); }
  refreshScaleUI();
}
$('focus').addEventListener('click', () => setMode('focus'));
$('system').addEventListener('click', () => setMode('system'));
$('scale-display').addEventListener('click', () => { state.orbitScale = 'display'; setMode(state.sceneMode); });
$('scale-true').addEventListener('click', () => { state.orbitScale = 'true'; setMode('system'); });
$('orbits').addEventListener('change', e => state.showOrbits = e.target.checked);
$('perspective').addEventListener('click', () => setProjection('perspective'));
$('orthographic').addEventListener('click', () => setProjection('orthographic'));
$('roam').addEventListener('click', toggleRoam);
$('reset').addEventListener('click', () => {
  Object.assign(state, {time:0, simulationSpeed:2, tilt:23.5, showOrbits:true, yaw:.65, pitch:.55, distance:12});
  $('simulation-speed').value = '6'; updateSimulationSpeed();
  $('tilt').value = '23.5'; $('tilt').dispatchEvent(new Event('input'));
  $('orbits').checked = true; scene.resetTime(); lostSimulationDays = 0; setMode('focus'); setProjection('perspective'); roaming = !reducedMotion; roamPhase = state.yaw; cameraUI();
});
// Screen-plane camera operations. Both projections use the same framing at the target distance.
function cameraBasis() {
  const {yaw, pitch} = state, sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  return {right: [cy, 0, -sy], up: [-sp * sy, cp, -sp * cy]};
}
function translateTarget(horizontal, vertical) {
  const {right, up} = cameraBasis();
  state.target = state.target.map((v, i) => v + right[i] * horizontal + up[i] * vertical);
}
function framing() {
  const rect = canvas.getBoundingClientRect();
  const aspect = rect.width / Math.max(rect.height, 1);
  const halfTangent = Math.tan(Math.PI / 8) / Math.min(aspect, 1);
  return {rect, aspect, halfTangent};
}
function pauseRoam() { if (roaming) { roaming = false; cameraUI(); } }
function panPixels(dx, dy) {
  lastOrthoAnchor = null;
  const {rect, halfTangent} = framing();
  const units = 2 * state.distance * halfTangent / Math.max(rect.height, 1);
  translateTarget(-dx * units, dy * units);
}
// Moving the camera along the pointer ray keeps its projected point fixed at every depth.
function zoomAt(factor, clientX, clientY) {
  const {rect, aspect, halfTangent} = framing();
  if (state.projection === 'orthographic') lastOrthoAnchor = {x:(clientX-rect.left)/Math.max(rect.width, 1), y:(clientY-rect.top)/Math.max(rect.height, 1)};
  const nx = (clientX - rect.left) / Math.max(rect.width, 1) * 2 - 1;
  const ny = 1 - (clientY - rect.top) / Math.max(rect.height, 1) * 2;
  const before = state.distance;
  const after = Math.max(0.35, Math.min(MAX_DISTANCE, before * factor));
  const delta = (before - after) * halfTangent;
  translateTarget(nx * aspect * delta, ny * delta);
  state.distance = after;
}
function centerZoom(factor) {
  const rect = canvas.getBoundingClientRect();
  const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
  retargetDepth(x, y); zoomAt(factor, x, y);
}
function pointerRay(clientX, clientY) {
  const {rect, aspect, halfTangent} = framing();
  const x = (clientX - rect.left) / Math.max(rect.width, 1) * 2 - 1;
  const y = 1 - (clientY - rect.top) / Math.max(rect.height, 1) * 2;
  const {right, up} = cameraBasis();
  const backward = [Math.cos(state.pitch)*Math.sin(state.yaw), Math.sin(state.pitch), Math.cos(state.pitch)*Math.cos(state.yaw)];
  const eyeDistance = state.projection === 'orthographic' ? ORTHO_EYE_DISTANCE : state.distance;
  const eye = state.target.map((v,i) => v + backward[i] * eyeDistance);
  if (state.projection === 'orthographic') return {
    origin: eye.map((v,i) => v + state.distance * halfTangent * (x * aspect * right[i] + y * up[i])),
    direction: backward.map(v => -v), eye
  };
  const ray = backward.map((v,i) => -v + halfTangent * (x * aspect * right[i] + y * up[i]));
  const length = Math.hypot(...ray);
  return {origin:eye, direction:ray.map(v => v/length), eye};
}
// In perspective, move the target plane to the hit depth without moving the eye.
// This lets a distant body be approached even when it lies beyond the original target.
function retargetDepth(clientX, clientY) {
  if (state.projection !== 'perspective' || !scene.pickSurface) return;
  const ray = pointerRay(clientX, clientY);
  const hit = scene.pickSurface(ray.origin, ray.direction, state.sceneMode, state.orbitScale);
  if (!hit) return;
  const backward = [Math.cos(state.pitch)*Math.sin(state.yaw), Math.sin(state.pitch), Math.cos(state.pitch)*Math.cos(state.yaw)];
  const depth = hit.reduce((sum,v,i) => sum + (ray.eye[i] - v) * backward[i], 0);
  if (depth <= .35 || depth > MAX_DISTANCE) return;
  state.target = ray.eye.map((v,i) => v - backward[i] * depth);
  state.distance = depth;
}
// Double click a celestial body to make it the rotation centre.
canvas.addEventListener('dblclick', e => {
  if (!scene.pickSurface) return;
  const ray = pointerRay(e.clientX, e.clientY);
  const hit = scene.pickSurface(ray.origin, ray.direction, state.sceneMode, state.orbitScale);
  if (!hit) return;
  if (state.projection === 'orthographic') {
    // Keep magnification and orientation fixed while recentering the selected point.
    state.target = [...hit];
    lastOrthoAnchor = {x:0.5, y:0.5};
    pauseRoam();
    return;
  }
  const offset = ray.eye.map((v,i) => v - hit[i]);
  const distance = Math.hypot(...offset);
  if (distance < .01) return;
  state.target = [...hit]; state.distance = Math.max(.35, Math.min(MAX_DISTANCE, distance));
  state.pitch = Math.max(-1.55, Math.min(1.55, Math.asin(Math.max(-1, Math.min(1, offset[1] / distance)))));
  state.yaw = Math.atan2(offset[0], offset[2]);
  pauseRoam();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' && ![0, 1, 2].includes(e.button)) return;
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY, type:e.pointerType, pan:e.button !== 0 || e.shiftKey});
  canvas.setPointerCapture(e.pointerId); pauseRoam();
});
canvas.addEventListener('pointermove', e => {
  const point = pointers.get(e.pointerId); if (!point) return;
  const activeTouches = [...pointers.values()].filter(p => p.type === 'touch');
  if (point.type === 'touch' && activeTouches.length >= 2) {
    const [a,b] = activeTouches;
    if (point !== a && point !== b) { point.x = e.clientX; point.y = e.clientY; return; }
    const oldX = (a.x+b.x)/2, oldY = (a.y+b.y)/2;
    const oldDistance = Math.hypot(a.x-b.x,a.y-b.y);
    point.x=e.clientX; point.y=e.clientY;
    const newX = (a.x+b.x)/2, newY = (a.y+b.y)/2;
    const newDistance = Math.hypot(a.x-b.x,a.y-b.y);
    panPixels(newX-oldX, newY-oldY);
    if (oldDistance > 1 && newDistance > 1) { retargetDepth(newX, newY); zoomAt(oldDistance/newDistance, newX, newY); }
  } else {
    const dx = e.clientX-point.x, dy = e.clientY-point.y;
    if (point.pan || e.shiftKey) panPixels(dx, dy);
    else { lastOrthoAnchor = null; state.yaw += dx*.008; state.pitch = Math.max(-1.55, Math.min(1.55, state.pitch+dy*.008)); }
    point.x=e.clientX; point.y=e.clientY;
  }
});
function endPointer(e) { pointers.delete(e.pointerId); }
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('lostpointercapture', endPointer);
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  // Preserve the last visible simulation instant; time is paused until recovery.
  lostSimulationDays = scene.simulationDays;
  contextLost = true; $('error').hidden = false; $('error').textContent = '图形上下文暂时中断，正在尝试恢复…';
});
canvas.addEventListener('webglcontextrestored', () => {
  try {
    const restoredScene = new SolarScene(canvas);
    restoredScene.simulationDays = lostSimulationDays;
    scene = restoredScene; contextLost = false; $('error').hidden = true; last = null;
  } catch (error) { $('error').textContent = '图形恢复失败，请刷新页面：' + error.message; }
});
canvas.addEventListener('wheel', e => { e.preventDefault(); pauseRoam(); const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1; retargetDepth(e.clientX, e.clientY); zoomAt(Math.exp(Math.max(-1, Math.min(1, e.deltaY * unit * .001))), e.clientX, e.clientY); }, {passive:false});
$('zoom-in').addEventListener('click', () => { pauseRoam(); centerZoom(.8); });
$('zoom-out').addEventListener('click', () => { pauseRoam(); centerZoom(1.25); });
canvas.addEventListener('keydown', e => {
  const step = .12;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
    e.preventDefault(); pauseRoam(); lastOrthoAnchor = null;
    if (e.shiftKey) {
      const amount = state.distance * .06;
      if (e.key === 'ArrowLeft') translateTarget(-amount,0); if (e.key === 'ArrowRight') translateTarget(amount,0);
      if (e.key === 'ArrowUp') translateTarget(0,amount); if (e.key === 'ArrowDown') translateTarget(0,-amount);
    } else {
      if (e.key === 'ArrowLeft') state.yaw -= step; if (e.key === 'ArrowRight') state.yaw += step;
      if (e.key === 'ArrowUp') state.pitch = Math.max(-1.55, state.pitch-step); if (e.key === 'ArrowDown') state.pitch = Math.min(1.55, state.pitch+step);
    }
  } else if (e.key === '+' || e.key === '=') { e.preventDefault(); pauseRoam(); centerZoom(.8); }
  else if (e.key === '-') { e.preventDefault(); pauseRoam(); centerZoom(1.25); }
});
document.addEventListener('visibilitychange', () => { last = null; });
document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.repeat) return;
  if (e.code === 'Space' && e.target instanceof HTMLButtonElement) return;
  if (e.code === 'Space') { e.preventDefault(); toggleRoam(); }
  if (e.key.toLowerCase() === 'o') { e.preventDefault(); setProjection(state.projection === 'perspective' ? 'orthographic' : 'perspective'); }
});
$('record').addEventListener('click', () => {
  const button = $('record');
  const restore = message => { button.disabled = false; button.textContent = message || '录制 10 秒画面 ↓'; };
  if (!canvas.captureStream || !window.MediaRecorder) { restore('当前浏览器不支持录制'); return; }
  let stream, recorder, timer, failed = false;
  const chunks = [];
  try {
    stream = canvas.captureStream(30);
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) { stream.getTracks().forEach(track => track.stop()); restore('浏览器不支持 WebM 录制'); return; }
    recorder = new MediaRecorder(stream, {mimeType:mime});
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => { failed = true; clearTimeout(timer); stream.getTracks().forEach(track => track.stop()); restore('录制失败，请重试'); };
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      if (failed || !chunks.length) { restore('录制失败，请重试'); return; }
      const url = URL.createObjectURL(new Blob(chunks, {type:recorder.mimeType || 'video/webm'}));
      const link = document.createElement('a'); link.href = url; link.download = 'ap2-roaming.webm'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000); restore();
    };
    button.disabled = true; button.textContent = '正在录制 10 秒…'; recorder.start();
    timer = setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 10500);
  } catch (error) {
    if (stream) stream.getTracks().forEach(track => track.stop());
    restore('无法开始录制，请更换浏览器'); console.warn('Recording unavailable:', error);
  }
});
function frame(now) {
  if (document.hidden) { last = null; requestAnimationFrame(frame); return; }
  const dt = last === null ? 0 : Math.max(0, (now-last)/1000); last = now;
  state.time += dt;
  if (roaming) { roamPhase += dt * .16; state.yaw = roamPhase; }
  if (!contextLost) scene.render(state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

cameraUI();
