import fs from 'node:fs';
import path from 'node:path';
import {renderArticle} from './render.mjs';

export function buildCollections(root,site){
  const configPath=path.join(root,'content/public-collections.json');
  const configs=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath,'utf8')):[];
  const documents=[],missingImages=[],savedAssets=new Set(),savedMedia=new Set(),sources=[];
  for(const config of configs){
    const inputRoot=path.join(root,'content',config.id);
    const manifestPath=path.join(inputRoot,'manifest.json');
    if(!fs.existsSync(manifestPath))throw new Error(`Run the importer first: ${config.id}`);
    const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
    if(manifest.commit!==config.commit)throw new Error(`Version mismatch: ${config.id}`);
    const readmePath=`data/README-${config.id}.md`;
    const licensePath=config.licenseFile?`data/LICENSE-${config.id}.txt`:readmePath;
    fs.copyFileSync(path.join(inputRoot,'README.md'),path.join(site,readmePath));
    if(config.licenseFile)fs.copyFileSync(path.join(inputRoot,config.licenseFile),path.join(site,licensePath));
    sources.push({...config,readmePath,licensePath,retrievedAt:manifest.retrievedAt,documents:manifest.documents.length,failedAssets:manifest.failedAssets});
    for(const doc of manifest.documents){
      const assets={};
      for(const asset of doc.assets){
        const local=path.resolve(inputRoot,asset.local);
        if(!local.startsWith(inputRoot+path.sep))throw new Error('Unsafe asset path');
        if(!fs.existsSync(local)||!fs.statSync(local).isFile()||!fs.statSync(local).size)continue;
        const dest=`assets/${config.id}/${asset.local}`;
        fs.mkdirSync(path.dirname(path.join(site,dest)),{recursive:true});
        fs.copyFileSync(local,path.join(site,dest));
        assets[asset.reference]=dest.split('/').map(encodeURIComponent).join('/');
        savedAssets.add(dest);
      }
      const mediaAssets={};
      for(const asset of doc.mediaAssets||[]){
        const local=path.resolve(inputRoot,asset.local);
        if(!local.startsWith(inputRoot+path.sep))throw new Error('Unsafe media path');
        if(!fs.existsSync(local)||!fs.statSync(local).isFile()||!fs.statSync(local).size)continue;
        const dest=`assets/${config.id}/${asset.local}`;
        fs.mkdirSync(path.dirname(path.join(site,dest)),{recursive:true});
        fs.copyFileSync(local,path.join(site,dest));
        mediaAssets[asset.reference]=dest.split('/').map(encodeURIComponent).join('/');
        savedMedia.add(dest);
      }
      const unsavedMedia=(doc.mediaReferences||doc.unsavedMedia||[]).filter(ref=>!mediaAssets[ref]);
      const resolveLink=href=>{
        if(!href||href.startsWith('#')||/^[a-z][a-z\d+.-]*:/i.test(href))return href;
        if(href.startsWith('//'))return 'https:'+href;
        let decoded;try{decoded=decodeURIComponent(href.split('#')[0]);}catch{return '';}
        const target=path.posix.normalize(path.posix.join(path.posix.dirname(doc.path),decoded));
        const found=manifest.documents.find(d=>d.path===target);
        return found?`#/doc/${found.id}`:`${config.repository}/${config.documentPathStyle||'blob'}/${config.commit}/${target.split('/').map(encodeURIComponent).join('/')}`;
      };
      const rendered=renderArticle(fs.readFileSync(path.join(inputRoot,doc.path),'utf8'),{assets,mediaAssets,resolveLink});
      const data={id:doc.id,title:doc.title,sourceTitle:doc.title,category:config.category,group:doc.group,order:doc.order,
        collection:config.id,collectionName:config.name,aliases:[doc.group,config.name],local:true,
        status:rendered.missingImages.length||unsavedMedia.length?'public-partial':'public-original',sourceUrl:doc.sourceUrl||config.sourceUrl,sourceLinkLabel:doc.sourceUrl?'飞书对应章节':'飞书对应栏目',
        originalUrl:`${config.repository}/${config.documentPathStyle||'blob'}/${config.commit}/${doc.path.split('/').map(encodeURIComponent).join('/')}`,
        sourceRelationship:config.sourceRelationship,author:config.author,license:config.license,licensePath,
        commit:config.commit,retrievedAt:manifest.retrievedAt,article:`articles/${doc.id}.html`,toc:rendered.toc,
        imageCount:new Set(Object.values(assets)).size,missingImages:rendered.missingImages,
        mediaCount:new Set(Object.values(mediaAssets)).size,unsavedMedia,
        chars:rendered.text.replace(/\s/g,'').length,text:rendered.text,summary:doc.group};
      fs.writeFileSync(path.join(site,data.article),rendered.html);
      documents.push(data);missingImages.push(...rendered.missingImages.map(image=>({doc:doc.id,...image})));
    }
  }
  return {documents,missingImages,savedAssets:[...savedAssets],savedMedia:[...savedMedia],sources};
}
