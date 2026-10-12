const fs = require('node:fs');
const crypto = require('node:crypto');
const occtFactory = require('occt-import-js');
const path = process.argv[2] || 'D:/ProfabX/Company humanoid/Assembly testing website 4.step';
async function main(){
 const input = fs.readFileSync(path);
 const occt = await occtFactory();
 const result = occt.ReadStepFile(input, {linearUnit:'millimeter',linearDeflectionType:'absolute_value',linearDeflection:0.15,angularDeflection:0.3});
 if(!result.success) throw new Error('STEP conversion failed');
 const bounds = a => {let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<a.length;i++) {let k=i%3;min[k]=Math.min(min[k],a[i]);max[k]=Math.max(max[k],a[i]);}return {min,max,size:max.map((v,i)=>v-min[i]),center:max.map((v,i)=>(v+min[i])/2)};};
 const names={};
 function visit(n){n.meshes.forEach((id,i)=>names[id]=n.name.trim()+(n.meshes.length>1?' / body '+(i+1):''));n.children.forEach(visit);} visit(result.root);
 const meshes=result.meshes.map((m,i)=>({id:i,name:names[i]||m.name||'Part '+i,color:m.color,positions:m.attributes.position.array,indices:m.index.array,bounds:bounds(m.attributes.position.array)}));
 const allBounds=bounds(meshes.flatMap(m=>[...m.bounds.min,...m.bounds.max]));
 const metadata={source:path.split('/').pop(),sha256:crypto.createHash('sha256').update(input).digest('hex'),units:'mm',meshCount:meshes.length,bounds:allBounds,hierarchy:result.root,components:meshes.map(({positions,indices,...m})=>({...m,vertices:positions.length/3,triangles:indices.length/3}))};
 fs.mkdirSync('public',{recursive:true}); fs.mkdirSync('docs',{recursive:true});
 fs.writeFileSync('public/model.json',JSON.stringify({metadata,meshes}));
 fs.writeFileSync('docs/model-inspection.json',JSON.stringify(metadata,null,2));
 console.log(JSON.stringify(metadata,null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
