// Run with: node tests/verify-orbits.mjs. No browser or packages required.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
vm.runInThisContext(fs.readFileSync(join(root, 'Common/MV.js'), 'utf8'));
const m = await import('data:text/javascript;base64,' + fs.readFileSync(join(root, 'scene.js')).toString('base64'));
const {PLANETS, solveKepler, orbitalPointFromE, planetPosition, makePlanetOrbit, cycleAngle,
  MOON_ORBIT_DAYS:T, MOON_ECCENTRICITY:e, MOON_INCLINATION_DEG, moonPointFromE,
  moonPosition, moonFrameForAnchor, makeMoonOrbit, SolarScene} = m;
const near = (a,b,tol=1e-7) => assert.ok(Math.abs(a-b)<tol, `${a} != ${b}`);
const dist = (a,b) => Math.hypot(...a.map((x,i)=>x-b[i]));
// Independent multipliers preserve continuity and leave the other phase unchanged.
assert.deepEqual(m.advanceMotionDays(10, 20, 2, 3, 0, 2), [10, 32]);
assert.deepEqual(m.advanceMotionDays(10, 20, 2, 3, 2, 0), [22, 20]);
assert.deepEqual(m.advanceMotionDays(10, 20, 2, 0, 4, 4), [10, 20]);
assert.deepEqual(m.advanceMotionDays(10, 10, 2, 3, 1, 1), [16, 16]);
const independentMoon = moonFrameForAnchor(mat4(), 2, 1, 7);
const ordinaryMoon = moonFrameForAnchor(mat4(), 2, 1, 2);
for (let i=0; i<3; i++) near(independentMoon[i][3], ordinaryMoon[i][3]);
assert.notEqual(independentMoon[0][0], ordinaryMoon[0][0]);
assert.equal(PLANETS.length,8);
for (const p of PLANETS) for (const mode of ['display','true']) {
  const a=mode==='true' ? 4*p.orbitAU/1.00000261 : p.orbit;
  for (const M of [-10,-Math.PI,-1,0,.7,Math.PI,19]) {
    const E=solveKepler(M,p.eccentricity), norm=((M+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
    near(E-p.eccentricity*Math.sin(E),norm,1e-11);
  }
  near(Math.hypot(...orbitalPointFromE(p,0,mode)),a*(1-p.eccentricity));
  near(Math.hypot(...orbitalPointFromE(p,Math.PI,mode)),a*(1+p.eccentricity));
  const line=makePlanetOrbit(p,mode); assert.equal(line.length,512*8);
  for(let i=0;i<512;i++) { const q=orbitalPointFromE(p,i*2*Math.PI/512,mode); for(let j=0;j<3;j++) near(line[i*8+j],q[j]); }
  for(const day of [-932,0,123.456,9000]) {
    const pos=planetPosition(p,day,mode); assert.ok(dist(pos,planetPosition(p,day+p.orbitDays,mode))<1e-7);
    const hit=SolarScene.prototype.pickSurface.call({simulationDays:day},[pos[0],pos[1]+10,pos[2]],[0,-1,0],'system',mode);
    assert.ok(hit,p.name); near(hit[1],pos[1]+p.radius,1e-6);
  }
  const peri={...p,meanLongitude:p.periLongitude}, dt=p.orbitDays*1e-5;
  const vp=dist(planetPosition(peri,0,mode),planetPosition(peri,dt,mode));
  const va=dist(planetPosition(peri,p.orbitDays/2,mode),planetPosition(peri,p.orbitDays/2+dt,mode));
  near(vp/va,(1+p.eccentricity)/(1-p.eccentricity),1e-6);
  near(cycleAngle(Math.abs(p.rotationDays)/4,p.rotationDays),p.rotationDays<0?-90:90);
}
near(T,27.321661); near(e,.0549); near(MOON_INCLINATION_DEG,5.145);
for(const a of [.57,.78]) {
  near(Math.hypot(...moonPointFromE(0,a)),a*(1-e));
  near(Math.hypot(...moonPointFromE(Math.PI,a)),a*(1+e));
  for(const day of [-89,0,5,13.7,T,123.456,5000]) {
    const local=moonPosition(day,a); assert.ok(dist(local,moonPosition(day+T,a))<1e-9);
    const origin=[4,2,-3], frame=moonFrameForAnchor(translate(...origin),day,a);
    const rotated=mult(rotateZ(MOON_INCLINATION_DEG),vec4(...local,1));
    for(let i=0;i<3;i++) near(frame[i][3],origin[i]+rotated[i]);
    const facingEarth=-(frame[0][0]*(origin[0]-frame[0][3])+frame[1][0]*(origin[1]-frame[1][3])+frame[2][0]*(origin[2]-frame[2][3]))/Math.hypot(...local);
    const trueAngle=Math.atan2(-local[2],local[0]), meanAngle=cycleAngle(day,T)*Math.PI/180;
    near(facingEarth,Math.cos(trueAngle-meanAngle),1e-8);
  }
  const dt=T*1e-5;
  near(dist(moonPosition(0,a),moonPosition(dt,a))/dist(moonPosition(T/2,a),moonPosition(T/2+dt,a)),(1+e)/(1-e),1e-6);
}
const lunarOrbit=makeMoonOrbit(); assert.equal(lunarOrbit.length,512*8);
for(let i=0;i<512;i++){ const q=moonPointFromE(i*2*Math.PI/512); for(let j=0;j<3;j++) near(lunarOrbit[i*8+j],q[j]); }
for(const mode of ['focus','system']) for(const scale of ['display','true']) for(const day of [0,2,7,14,21,123.456]) {
  const earth=PLANETS.find(p=>p.name==='earth'), anchor=translate(...planetPosition(earth,day,scale));
  const frame=moonFrameForAnchor(anchor,day,mode==='focus'?.78:.57), c=[frame[0][3],frame[1][3],frame[2][3]], r=mode==='focus'?.105:.075;
  const hit=SolarScene.prototype.pickSurface.call({simulationDays:day},[c[0],c[1]+10,c[2]],[0,-1,0],mode,scale);
  assert.ok(hit,`${mode} ${scale} ${day}`); near(hit[1],c[1]+r,1e-6);
}
const quarter=moonPosition(T/4,1), libration=Math.abs(Math.atan2(-quarter[2],quarter[0])-Math.PI/2)*180/Math.PI;
assert.ok(libration>6.2 && libration<6.4,`unexpected libration: ${libration}`);
console.log(`通过：八大行星两种距离尺度、月球椭圆轨道、近远地点速度、同步平均自转、轨道线与拾取；四分之一周期经度天平动约 ${libration.toFixed(3)}°。`);
