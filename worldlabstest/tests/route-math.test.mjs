import test from 'node:test';
import assert from 'node:assert/strict';
import {pathLength,samplePath,advancePlayback} from '../js/route-math.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('meters follow the length of a sloped road, not just its ground projection',()=>{
 const path=[[0,0,0],[0,3,4]];close(pathLength(path),5);
 const pose=samplePath(path,2.5);assert.deepEqual(pose.position,[0,1.5,2]);close(Math.abs(pose.yaw),180);close(pose.pitch,Math.atan2(3,4)*180/Math.PI);
});
test('empty and repeated points cannot produce invalid position or heading',()=>{
 assert.equal(samplePath([],1),null);assert.equal(samplePath([[1,2,3],[1,2,3]],1),null);
 const path=[[0,0,0],[0,0,0],[4,0,0]];assert.deepEqual(samplePath(path,2).position,[2,0,0]);close(samplePath(path,2).yaw,-90);
});
test('scrubbing clamps to both endpoints and turns at segment boundaries',()=>{
 const path=[[0,0,0],[4,0,0],[4,0,-4]];
 assert.deepEqual(samplePath(path,-3).position,[0,0,0]);assert.deepEqual(samplePath(path,99).position,[4,0,-4]);close(samplePath(path,6).yaw,0);
});
test('playback reaches the endpoint once or wraps without losing excess distance',()=>{
 assert.deepEqual(advancePlayback(9,2,1,10,false),{distance:10,finished:true});
 assert.deepEqual(advancePlayback(9,2,1,10,true),{distance:1,finished:false});
 assert.deepEqual(advancePlayback(5,0,1,10,false),{distance:5,finished:false});
});
