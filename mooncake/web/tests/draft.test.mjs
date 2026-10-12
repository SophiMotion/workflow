import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,normalize,outline,topOutline,area} from '../src/design.js';
import {taperedBodyGeometry} from '../src/geometry3d.js';
test('rendered tapered solid has correct caps, outward normals and prismoidal volume',()=>{
 for(const side of ['scallop','wave','round']) for(const draftAngle of [0,5,8]){
  const d=normalize({...DEFAULT,side,draftAngle,thickness:40}),bottom=outline(d),top=topOutline(d),mid=bottom.map((p,i)=>p.map((x,k)=>(x+top[i][k])/2));
  const g=taperedBodyGeometry(bottom,top,d.thickness),p=g.getAttribute('position'),n=g.getAttribute('normal');let v=0;
  for(let i=0;i<p.count;i+=3){const a=[p.getX(i),p.getY(i),p.getZ(i)],b=[p.getX(i+1),p.getY(i+1),p.getZ(i+1)],c=[p.getX(i+2),p.getY(i+2),p.getZ(i+2)];v+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;if(a[2]===b[2]&&b[2]===c[2])assert.ok(a[2]===0?n.getZ(i)<-.99:n.getZ(i)>.99);}
  const expected=d.thickness*(area(bottom)+4*area(mid)+area(top))/6;
  assert.ok(Math.abs(v-expected)/expected<1e-6);assert.equal(g.boundingBox.min.z,0);assert.equal(g.boundingBox.max.z,40);g.dispose();
 }
});
