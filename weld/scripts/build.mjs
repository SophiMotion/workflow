import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const result=await build({entryPoints:['src/app.js'],bundle:true,minify:true,format:'iife',write:false,target:'es2022',legalComments:'none',loader:{'.stl':'binary'}});
const template=await readFile('src/shell.html','utf8');
const css=await readFile('src/style.css','utf8')+'\n'+await readFile('src/studio.css','utf8')+'\n'+await readFile('src/layout.css','utf8');
const licenses='THREE.JS\n'+await readFile('node_modules/three/LICENSE','utf8')+'\n\nLUCIDE\n'+await readFile('node_modules/lucide/LICENSE','utf8')+'\n\nTHREE-MESH-BVH\n'+await readFile('node_modules/three-mesh-bvh/LICENSE','utf8')+'\n\nROS-INDUSTRIAL ABB IRB6700 MODELS (Apache-2.0)\n'+await readFile('assets/abb-irb6700/LICENSE','utf8');
const html=template.replace('</head>',()=>`<!-- Third-party licenses\n${licenses}\n--></head>`).replace('/* APP_STYLES */',()=>css).replace('/* APP_SCRIPT */',()=>result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
const outputs={'THIRD_PARTY_LICENSES.txt':licenses,'weld.html':html};
if(process.argv.includes('--check')){
 for(const [file,expected] of Object.entries(outputs)){
  const current=await readFile(file,'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  if(current!==expected)throw Error(`${file} is out of date. Run npm run build and commit the generated files with the sources.`);
 }
 console.log('Published welding artifact matches its sources, models and licenses.');
}else{
 for(const [file,content] of Object.entries(outputs))await writeFile(file,content);
 console.log('Built standalone weld.html (all code, styles and 3D libraries embedded).');
}
