// File-open mode reads trusted, generated script packs instead of fetching file://.
// HTTP mode continues to use the original asset URLs and API service.
export const isFilePreview=location.protocol==='file:';
const base=new URL('.',location.href),pending=new Map(),urls=new Map();
const pack=()=>globalThis.__SOPHI_OFFLINE__;

export function packedAssetKey(value){
 const url=new URL(value,base);
 if(url.protocol!==base.protocol||url.host!==base.host||url.search||url.hash||!url.pathname.startsWith(base.pathname))return null;
 const path=decodeURIComponent(url.pathname.slice(base.pathname.length));
 return Object.hasOwn(pack()?.assets||{},path)?path:null;
}

export async function assetUrl(value){
 const url=new URL(value,base);
 if(!isFilePreview||url.protocol!=='file:')return url.href;
 const key=packedAssetKey(url.href);
 if(!key)throw Error('本地资源未打包，请通过文件选择器导入，或重新生成直开资源包。');
 if(urls.has(key))return urls.get(key);
 if(!pending.has(key))pending.set(key,(async()=>{
  const info=pack().assets[key];
  if(!Object.hasOwn(pack().data,key))await new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=new URL(info.script,base).href;
   script.onload=()=>{script.remove();resolve();};
   script.onerror=()=>{script.remove();reject(Error('缺少直开资源文件，请保留完整 worldlabstest 文件夹。'));};
   document.head.append(script);
  });
  const encoded=pack().data[key];if(typeof encoded!=='string')throw Error('直开资源包内容不完整。');
  const binary=atob(encoded),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  if(bytes.byteLength!==info.bytes)throw Error('直开资源大小不符，请重新生成资源包。');
  const blobUrl=URL.createObjectURL(new Blob([bytes],{type:info.mime}));
  urls.set(key,blobUrl);delete pack().data[key];return blobUrl;
 })().catch(e=>{pending.delete(key);throw e;}));
 return pending.get(key);
}

export async function jsonAsset(path){
 if(isFilePreview){const value=pack()?.json?.[path];if(!value)throw Error('直开资源包缺少 '+path);return structuredClone(value);}
 const response=await fetch(new URL(path,base),{cache:'no-store'});
 if(!response.ok)throw Error('资源清单不可用：'+path);
 return response.json();
}
