import test from 'node:test';
import assert from 'node:assert/strict';
import {ROAD,CAMPUS,isRoad,roadHeight,roadZone,roadTiles,roadRoute} from '../js/road-profile.mjs';
test('all streets, intersections and wet areas have exactly the same road datum',()=>{
 for(let x=CAMPUS.minX;x<=CAMPUS.maxX;x+=.5)for(let z=CAMPUS.minZ;z<=CAMPUS.maxZ;z+=.5)if(isRoad(x,z))assert.equal(roadHeight(x,z),0);
 assert.equal(roadHeight(ROAD.puddleX,ROAD.puddleZ),0);assert.ok(ROAD.waterLevel>0&&ROAD.waterLevel<=.05);
});
test('road mesh covers the entire network without overlapping tiles or uncovered junctions',()=>{
 const tiles=roadTiles();
 for(let x=-35.25;x<35.3;x+=.25)for(let z=-3.25;z<75.3;z+=.25){const n=tiles.filter(t=>x>t.x0&&x<t.x1&&z>t.z0&&z<t.z1).length;
  // Boundary lines are shared deliberately; verify open interiors only.
  if(tiles.some(t=>Math.abs(x-t.x0)<1e-8||Math.abs(x-t.x1)<1e-8||Math.abs(z-t.z0)<1e-8||Math.abs(z-t.z1)<1e-8))continue;
  assert.equal(n,isRoad(x,z)?1:0,`coverage at ${x}, ${z}`);
 }
 for(const x of CAMPUS.vertical)for(const z of CAMPUS.horizontal)assert.ok(isRoad(x,z));
});
test('demonstration route stays level and inside roads through a complete closed lap',()=>{
 const p=roadRoute();assert.ok(p.length>50&&p.length<=200);assert.deepEqual(p[0],p.at(-1));
 for(const [x,y,z] of p){assert.equal(y,.025);assert.ok(isRoad(x,z));}
 const zones=new Set(p.map(([x,,z])=>roadZone(x,z)));assert.ok(zones.has('灰色平路'));assert.equal(zones.size,1);
});
