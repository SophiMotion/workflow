import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProject } from '../shared/domain.mjs';
import { fusionPayload } from '../shared/fusion.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'public/fusion/SkateChassis20260906');
const target=path.resolve(root,'../../autodesk/SkateChassis20260906');
fs.mkdirSync(target,{recursive:true});
const names=['SkateChassis20260906.py','SkateChassis20260906.manifest','modeling.py','payload.py','palette.html','README.md'];
for(const name of names){
  const output=path.join(target,name),content=fs.readFileSync(path.join(source,name));
  if(fs.existsSync(output)&&!fs.readFileSync(output).equals(content)){
    const backup=path.join(target,'backups',String(Date.now()));fs.mkdirSync(backup,{recursive:true});fs.copyFileSync(output,path.join(backup,name));
  }
  fs.writeFileSync(output,content);
}
fs.writeFileSync(path.join(target,'bridge.json'),JSON.stringify({directory:path.join(root,'data/fusion')},null,2));
if(!fs.existsSync(path.join(target,'example.fusion.json')))fs.writeFileSync(path.join(target,'example.fusion.json'),JSON.stringify(fusionPayload(createProject()),null,2));
console.log('Fusion add-in files installed at '+target);
