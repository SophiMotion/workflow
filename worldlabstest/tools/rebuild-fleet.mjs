// Rebuild the local vehicle assets from archived public geometry and the reference-image model.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';import {gunzipSync} from 'node:zlib';import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),source=path.join(root,'vendor/fleet/source'),work=fs.mkdtempSync(path.join(os.tmpdir(),'sophi-fleet-'));
fs.cpSync(source,work,{recursive:true});fs.mkdirSync(path.join(work,'node_modules'),{recursive:true});fs.symlinkSync(path.join(root,'vendor/three'),path.join(work,'node_modules/three'),'dir');fs.writeFileSync(path.join(work,'package.json'),'{"type":"module"}');
fs.writeFileSync(path.join(work,'sophicore-cle-model.json'),gunzipSync(fs.readFileSync(path.join(work,'sophicore-cle-model.json.gz'))));
fs.copyFileSync(path.join(root,'js/reference-rover.js'),path.join(work,'reference-rover.js'));
execFileSync(process.execPath,[path.join(work,'convert.mjs')],{cwd:work,stdio:'inherit'});execFileSync(process.execPath,[path.join(work,'rover-convert.mjs')],{cwd:work,stdio:'inherit'});
const output=path.join(work,'output');for(const name of fs.readdirSync(output).filter(n=>n.endsWith('.glb')))fs.copyFileSync(path.join(output,name),path.join(root,'assets/fleet',name));
const manifest=JSON.parse(fs.readFileSync(path.join(output,'sources.json')));manifest.models.push(JSON.parse(fs.readFileSync(path.join(output,'reference-rover-source.json'))));fs.writeFileSync(path.join(root,'vendor/fleet/sources.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Rebuilt five GLB assets. Run tools/build_offline.mjs to refresh direct-open packs. Temporary sources: '+work);
