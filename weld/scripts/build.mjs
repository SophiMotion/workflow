import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const result=await build({entryPoints:['src/app.js'],bundle:true,minify:true,format:'iife',write:false,target:'es2022',legalComments:'none'});
const template=await readFile('src/shell.html','utf8');
const css=await readFile('src/style.css','utf8');
const licenses='THREE.JS\n'+await readFile('node_modules/three/LICENSE','utf8')+'\n\nLUCIDE\n'+await readFile('node_modules/lucide/LICENSE','utf8');
await writeFile('THIRD_PARTY_LICENSES.txt',licenses);
await writeFile('weld.html',template.replace('</head>',()=>`<!-- Third-party licenses\n${licenses}\n--></head>`).replace('/* APP_STYLES */',()=>css).replace('/* APP_SCRIPT */',()=>result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')));
console.log('Built standalone weld.html (all code, styles and 3D libraries embedded).');
