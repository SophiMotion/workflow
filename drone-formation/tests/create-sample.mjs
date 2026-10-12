import * as THREE from '../vendor/three.module.min.js';
import {writeFile} from 'node:fs/promises';
const g=new THREE.TorusKnotGeometry(3,1,120,16).toNonIndexed();
const a=g.attributes.position.array,bin=Buffer.from(a.buffer,a.byteOffset,a.byteLength);
g.computeBoundingBox();
const document={asset:{version:'2.0',generator:'Drone formation verification fixture'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,rotation:[0,0,Math.sin(.2),Math.cos(.2)]}],meshes:[{primitives:[{attributes:{POSITION:0},mode:4}]}],buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:bin.length,target:34962}],accessors:[{bufferView:0,componentType:5126,count:a.length/3,type:'VEC3',min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()}]};
let json=JSON.stringify(document);json+=' '.repeat((4-Buffer.byteLength(json)%4)%4);const j=Buffer.from(json),buffer=Buffer.alloc(12+8+j.length+8+bin.length);buffer.writeUInt32LE(0x46546c67,0);buffer.writeUInt32LE(2,4);buffer.writeUInt32LE(buffer.length,8);buffer.writeUInt32LE(j.length,12);buffer.writeUInt32LE(0x4e4f534a,16);j.copy(buffer,20);const o=20+j.length;buffer.writeUInt32LE(bin.length,o);buffer.writeUInt32LE(0x004e4942,o+4);bin.copy(buffer,o+8);
await writeFile(new URL('../samples/torus-knot.glb',import.meta.url),buffer);
await writeFile(new URL('../samples/invalid.glb',import.meta.url),'Invalid GLB fixture');
