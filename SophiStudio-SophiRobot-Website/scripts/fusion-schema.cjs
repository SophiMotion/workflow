const fs=require('fs'),ts=require('typescript');require.extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,resolveJsonModule:true,esModuleInterop:true}}).outputText,p);
const {defaults,fields}=require('../src/parameters.ts'),{limbKeys,limbJoints}=require('../src/limbs.ts'),m=require('../public/model.json');
const aliases={total_height:'Total_height',od_tire:'OD_tire',thin_sheet:'sheet_thickness',hip_length:'Hip_length',hip_position:'Hip_height',tube_diameter:'dia_tube',tube_thickness:'thickness_tube'};
const {headJoints}=require('../src/head.ts');
const schema={head:headJoints.map(j=>({key:j.key,min:j.min,max:j.max})),sourceSha256:m.metadata.sha256,fields:fields.map(f=>({key:f.key,min:f.min,max:f.max,unit:f.unit==='°'?'deg':'mm'})),joints:Object.fromEntries(limbKeys.map(k=>[k,limbJoints(k).map(j=>({key:j.key,min:j.min,max:j.max}))]))};
const mapping={dimensions:Object.fromEntries(fields.filter(f=>f.key!=='structural_sheet').map(f=>[f.key,{name:aliases[f.key]||f.key,scale:1,offset:0}])),joints:Object.fromEntries(limbKeys.flatMap(k=>limbJoints(k).map(j=>[`${k}.${j.key}`,{name:`${k}_${j.key}`,scale:1,offset:0}])))};
for(const j of headJoints)mapping.joints['head.'+j.key]={name:'head_'+j.key,scale:1,offset:0};
fs.writeFileSync('public/fusion/SophiRobotExport/schema.json',JSON.stringify(schema,null,2)+'\n');fs.writeFileSync('public/fusion/SophiRobotExport/mapping.json',JSON.stringify(mapping,null,2)+'\n');
