import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.location={protocol:'file:',href:'file:///example/campus/worldlabstestv2.html'};
globalThis.__SOPHI_OFFLINE__={assets:{'assets/test.glb':{bytes:4,mime:'model/gltf-binary'}},data:{'assets/test.glb':'AQID/w=='},json:{'data/scene.json':{objects:[{name:'car'}]}}};
const {assetUrl,jsonAsset,packedAssetKey}=await import('../js/local-assets.js');

test('file asset lookup is limited to the exact bundled project paths',()=>{
 assert.equal(packedAssetKey('assets/test.glb'),'assets/test.glb');
 for(const p of ['../assets/test.glb','file:///elsewhere/assets/test.glb','https://example.com/assets/test.glb','assets/test.glb?changed=1','assets/missing.glb'])assert.equal(packedAssetKey(p),null);
});
test('concurrent asset loads reuse one Blob URL and preserve all bytes',async()=>{
 const [a,b]=await Promise.all([assetUrl('assets/test.glb'),assetUrl('assets/test.glb')]);assert.equal(a,b);
 assert.deepEqual([...new Uint8Array(await (await fetch(a)).arrayBuffer())],[1,2,3,255]);
 assert.equal(Object.hasOwn(globalThis.__SOPHI_OFFLINE__.data,'assets/test.glb'),false);
 assert.equal(await assetUrl('assets/test.glb'),a);
 await assert.rejects(assetUrl('assets/missing.glb'),/未打包/);
 URL.revokeObjectURL(a);
});
test('restoring a scene cannot mutate the packed default data',async()=>{
 const a=await jsonAsset('data/scene.json');a.objects[0].name='edited';
 assert.equal((await jsonAsset('data/scene.json')).objects[0].name,'car');
 await assert.rejects(jsonAsset('data/missing.json'),/缺少/);
});
