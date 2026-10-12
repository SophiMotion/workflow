// Rebuild classic-script packs so Finder double-click works without a web server.
// Prerequisite: Node.js and esbuild (or an ESBUILD environment variable).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'assets/offline');fs.mkdirSync(out,{recursive:true});
const json={};for(const file of ['data/campus-default.json','vendor/sophicar/source.json','vendor/fleet/sources.json'])json[file]=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const world=json['data/campus-default.json'].world;
const files=new Set([...['fusion','nav','edu','sophicore','reference-rover-video'].map(id=>'assets/fleet/'+id+'.glb'),...json['vendor/sophicar/source.json'].assets.map(a=>a.file),...Object.values(world.quality_urls),world.collider_url]);
const assets={};
for(const file of files){
 const bytes=fs.readFileSync(path.join(root,file)),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 const name='asset-'+hash.slice(0,16)+'.js';
 fs.writeFileSync(path.join(out,name),'globalThis.__SOPHI_OFFLINE__.data['+JSON.stringify(file)+']='+JSON.stringify(bytes.toString('base64'))+';\n');
 assets[file]={script:'assets/offline/'+name,bytes:bytes.length,sha256:hash,mime:file.endsWith('.glb')?'model/gltf-binary':'application/octet-stream'};
}
const revision=json['data/campus-default.json'].default_scene_revision;
fs.writeFileSync(path.join(out,'manifest.js'),'globalThis.__SOPHI_OFFLINE__='+JSON.stringify({revision,assets,json,data:{}})+';\n');
execFileSync(process.env.ESBUILD||'esbuild',[
 path.join(root,'js/workbench-v2.js'),'--bundle','--format=iife','--platform=browser','--target=es2022','--minify','--legal-comments=eof',
 '--alias:three='+path.join(root,'vendor/three/build/three.module.js'),
 '--alias:three/addons='+path.join(root,'vendor/three/examples/jsm'),
 '--alias:@sparkjsdev/spark='+path.join(root,'vendor/spark/spark.module.js'),
 '--outfile='+path.join(out,'workbench.bundle.js'),
],{cwd:root,stdio:'inherit'});
fs.writeFileSync(path.join(out,'build-info.json'),JSON.stringify({revision,three:'0.180.0',spark:'2.3.0',assetCount:files.size,rawAssetBytes:Object.values(assets).reduce((n,a)=>n+a.bytes,0),sources:{three:'https://registry.npmjs.org/three/-/three-0.180.0.tgz',spark:'https://sparkjs.dev/releases/spark/2.3.0/spark.module.js'}},null,2)+'\n');
console.log('Built direct-open scene: '+files.size+' local assets.');
