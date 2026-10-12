import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderArticle} from './render.mjs';
import {buildCollections} from './build-collections.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const site = path.join(root,'site');
const catalog = JSON.parse(fs.readFileSync(path.join(root,'content/catalog.json'),'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root,'content/hello-agents/manifest.json'),'utf8'));
const ledgerPath = path.join(root,'content/feishu/migration-ledger.json');
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath,'utf8')) : {observed:[]};
const sourceLinks = [...new Map(ledger.observed.filter(record=>record.status==='link-verified' && /^https:\/\/rcnjy4vfjycy\.feishu\.cn\/wiki\/[A-Za-z0-9]+$/.test(record.sourceUrl)).map(record=>[record.sourceUrl,record])).values()];
for (const dir of ['data','articles','assets/hello-agents','vendor/katex']) fs.mkdirSync(path.join(site,dir),{recursive:true});
fs.cpSync(path.join(root,'node_modules/katex/dist/fonts'),path.join(site,'vendor/katex/fonts'),{recursive:true});
fs.copyFileSync(path.join(root,'node_modules/katex/dist/katex.min.css'),path.join(site,'vendor/katex/katex.min.css'));
fs.copyFileSync(path.join(root,'node_modules/highlight.js/styles/github.css'),path.join(site,'vendor/highlight.css'));
fs.copyFileSync(path.join(root,'content/hello-agents/LICENSE.txt'),path.join(site,'data/LICENSE-hello-agents.txt'));
fs.copyFileSync(path.join(root,'content/hello-agents/README.md'),path.join(site,'data/README-hello-agents.md'));

const docs = [], missing = [], savedAssets = new Set();
for (const record of catalog.chapters) {
  const source = manifest.chapters.find(c=>c.number===record.number);
  if (!source) throw new Error(`Missing imported chapter ${record.number}`);
  const input = path.join(root,'content/hello-agents',source.path);
  const assets = {};
  for (const asset of source.assets) {
    const local = path.join(root,'content/hello-agents',asset.local);
    if (!fs.existsSync(local)) continue;
    const dest = path.join(site,'assets/hello-agents',asset.local);
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.copyFileSync(local,dest);
    savedAssets.add(asset.local);
    assets[asset.reference] = 'assets/hello-agents/' + asset.local.split('/').map(encodeURIComponent).join('/');
  }
  const resolveLink = href => {
    if (!href) return '';
    if (href.startsWith('#')) return href;
    if (/^[a-z][a-z\d+.-]*:/i.test(href)) return href;
    if (href.startsWith('//')) return 'https:' + href;
    const decoded = decodeURIComponent(href.split('#')[0]);
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(source.path),decoded));
    const chapter = manifest.chapters.find(c=>c.path===resolved);
    if (chapter) return `#/doc/agent-${String(chapter.number).padStart(2,'0')}`;
    return `https://github.com/datawhalechina/hello-agents/blob/${manifest.commit}/${resolved.split('/').map(encodeURIComponent).join('/')}`;
  };
  const rendered = renderArticle(fs.readFileSync(input,'utf8'), {assets,resolveLink});
  const id = `agent-${String(record.number).padStart(2,'0')}`;
  const data = {
    id,title:record.title,sourceTitle:source.title,category:'agent-course',part:record.part,
    order:record.number,aliases:record.aliases,local:true,collection:'hello-agents',collectionName:'Hello-Agents',licensePath:'data/LICENSE-hello-agents.txt',
    status: rendered.missingImages.length ? 'public-partial' : 'public-original',
    sourceUrl:`https://rcnjy4vfjycy.feishu.cn/wiki/${record.token}`,
    originalUrl:`https://github.com/datawhalechina/hello-agents/blob/${manifest.commit}/${source.path.split('/').map(encodeURIComponent).join('/')}`,
    author:'Datawhale · Hello-Agents 贡献者',license:manifest.license,commit:manifest.commit,
    retrievedAt:manifest.retrievedAt,article:`articles/${id}.html`,toc:rendered.toc,
    imageCount:new Set(Object.values(assets)).size,missingImages:rendered.missingImages,
    chars:rendered.text.replace(/\s/g,'').length,text:rendered.text,
    summary:record.aliases.slice(0,3).join(' · ')
  };
  fs.writeFileSync(path.join(site,data.article),rendered.html);
  docs.push(data);
  missing.push(...rendered.missingImages.map(img=>({doc:id,...img})));
}
const extra=buildCollections(root,site);
docs.push(...extra.documents);missing.push(...extra.missingImages);
const publicAssets = savedAssets.size+extra.savedAssets.length;
const categoriesWithContent=new Set(docs.map(d=>d.category)).size;
const unsavedMedia=docs.flatMap(d=>(d.unsavedMedia||[]).map(reference=>({doc:d.id,reference})));
const sources=[{id:'hello-agents',name:'Hello-Agents',repository:manifest.repository,author:'Datawhale · 陈思州、孙韬及 Hello-Agents 全体贡献者',license:manifest.license,commit:manifest.commit,readmePath:'data/README-hello-agents.md',licensePath:'data/LICENSE-hello-agents.txt',documents:catalog.chapters.length,retrievedAt:manifest.retrievedAt},...extra.sources];
const result = {...catalog,sources,sourceLinks,chapters:undefined,documents:docs,stats:{documents:docs.length,categories:catalog.categories.length,images:publicAssets,media:extra.savedMedia.length,missingImages:missing.length,unsavedMedia:unsavedMedia.length,verifiedArticleLinks:sourceLinks.length,categoriesWithContent,categoriesWithoutContent:catalog.categories.length-categoriesWithContent},provenance:{...manifest,chapters:undefined}};
fs.writeFileSync(path.join(site,'data/catalog.json'),JSON.stringify(result));
fs.writeFileSync(path.join(site,'data/import-report.json'),JSON.stringify({scope:catalog.scope,stats:result.stats,sources,missingImages:missing,unsavedMedia,failedAssets:[...manifest.failedAssets,...extra.sources.flatMap(s=>s.failedAssets||[])]},null,2));
console.log(JSON.stringify(result.stats,null,2));
if (missing.length) console.warn('Some images were not imported; listed in import-report.json.');
