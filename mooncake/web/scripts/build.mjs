import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({ entryPoints: [root + 'src/main.jsx'], bundle: true, minify: true, format: 'iife', target: ['chrome100'], write: false, outfile: 'app.js', legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"' } });
const js = result.outputFiles.find(f => f.path.endsWith('.js')).text;
const css = result.outputFiles.find(f => f.path.endsWith('.css')).text;
const html = (await readFile(root + 'index.html', 'utf8')).replace('<script type="module" src="/src/main.jsx"></script>', () => `<style>${css}</style><script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
if ((html.match(/<\/script>/g) || []).length !== 1 || html.includes('type="module"')) throw new Error('Offline HTML must contain exactly one inline script.');

await writeFile(new URL('../../mooncake/Mooncake.html', import.meta.url), html);
console.log(`Built offline Mooncake.html (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
