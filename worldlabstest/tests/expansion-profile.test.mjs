import test from 'node:test';
import assert from 'node:assert/strict';
import {SITE,TEST,TEST_SECTIONS,testHeight,testZone,testRoute,raceRoute} from '../js/expansion-profile.mjs';
import {pathLength,samplePath} from '../js/route-math.mjs';
test('proving road has four real surface zones with level transitions and bounded slopes',()=>{
 const points=testRoute();assert.equal(points.length,901);assert.equal(points[0][2],TEST.start);assert.equal(points.at(-1)[2],TEST.end);
 const zones=new Set(points.map(p=>testZone(p[2])));
 for(const s of TEST_SECTIONS){assert.ok(zones.has(s.name));assert.equal(testHeight(s.from),0);assert.ok(Math.abs(testHeight(s.to))<1e-8);}
 let maxSlope=0,maxY=0;
 for(let i=1;i<points.length;i++){const [x,y,z]=points[i];assert.ok(x>SITE.minX&&x<SITE.maxX&&z<SITE.maxZ);assert.ok(y>=.025&&y<.6);maxY=Math.max(maxY,y);maxSlope=Math.max(maxSlope,Math.abs(y-points[i-1][1])/.1);}
 assert.ok(maxY>.3);assert.ok(maxSlope<.9);
 for(let z=52;z<=68;z+=.1)assert.equal(testHeight(z),0);
 assert.ok(TEST.water>0);assert.ok(testHeight(76)>0);
});
test('race circuit is closed, level, finite, within site, and has no crossing segments',()=>{
 const p=raceRoute();assert.deepEqual(p[0],p.at(-1));assert.ok(pathLength(p)>350);
 for(const [x,y,z] of p){assert.equal(y,.025);assert.ok(x>SITE.minX+4&&x<SITE.maxX-4&&z>SITE.minZ+4&&z<SITE.maxZ-4);}
 const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
 for(let i=1;i<p.length;i++)for(let j=i+2;j<p.length;j++){
  if(i===1&&j===p.length-1)continue;
  const a=p[i-1],b=p[i],c=p[j-1],d=p[j];assert.ok(!(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0),`crossing ${i},${j}`);
 }
});
test('sampling a complete proving route stays finite and reaches every zone',()=>{
 const p=testRoute(),length=pathLength(p),zones=new Set();for(let d=0;d<=length;d+=.1){const s=samplePath(p,d);assert.ok(s.position.every(Number.isFinite));assert.ok(Number.isFinite(s.pitch));zones.add(testZone(s.position[2]));}
 for(const s of TEST_SECTIONS)assert.ok(zones.has(s.name));assert.ok(length>90);
});

test('axle-based vehicle stance responds to rough road and returns level in water',async()=>{
 const {sampleAxlePose}=await import('../js/route-math.mjs');const p=testRoute(),length=pathLength(p);let peak=0;
 for(let d=1;d<length-1;d+=.2){const pose=sampleAxlePose(p,d,1.683);assert.ok(pose.position.every(Number.isFinite));assert.ok(Math.abs(pose.pitch)<30);peak=Math.max(peak,Math.abs(pose.pitch));if(pose.position[2]>54&&pose.position[2]<66){assert.equal(pose.position[1],.025);assert.equal(pose.pitch,0);}}
 assert.ok(peak>2);
});
