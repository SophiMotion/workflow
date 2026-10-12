import test from 'node:test';import assert from 'node:assert/strict';
import {cameraClipping,depthResolution,groundTop} from '../js/view-precision.mjs';
test('zoom from close-up to full site retains separation of ground and asphalt',()=>{for(const distance of [3,10,80,150,400,650]){const {near,far}=cameraClipping(distance);assert.ok(near<distance*.04);assert.ok(depthResolution(distance,near,far)*4<Math.abs(groundTop));assert.ok(depthResolution(distance,near,far)<.006,'paint depth resolution');}assert.ok(depthResolution(400,.05,1800)>.1,'reproduces the old distant-camera precision loss');});
