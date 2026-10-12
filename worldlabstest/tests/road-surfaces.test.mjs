import test from 'node:test';import assert from 'node:assert/strict';
import {accessRoadStrips,raceLeftEdge,outerRaceEdges} from '../js/road-surfaces.mjs';
test('access paving is clipped to the race shoulder without coplanar overlap',()=>{const edges=outerRaceEdges();for(const strip of accessRoadStrips())for(let i=1;i<strip.length;i++){const a=strip[i-1],b=strip[i];for(let t=0;t<=1;t+=.1){const z=a.z+(b.z-a.z)*t,x=a.right+(b.right-a.right)*t;assert.ok(x<=raceLeftEdge(z,edges)+1e-7);assert.ok(x>a.left);}}});
