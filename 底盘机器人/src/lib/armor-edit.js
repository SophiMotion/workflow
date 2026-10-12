import { packGeometry, unpackGeometry, geometryBuffers } from './armor-transfer.js';
export function editGeometry(operation,geometry,options={}){
  const {onProgress,signal,...parameters}=options;
  if(signal?.aborted)return Promise.reject(signal.reason);
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./armor-worker.js',import.meta.url),{type:'module'});
    const finish=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.onmessage=null;worker.onerror=null;worker.terminate();};
    const abort=()=>{finish();reject(signal.reason);};
    const timer=setTimeout(()=>{finish();reject(Error('网格处理超过 15 分钟，当前模型保持不变。请重新尝试或分部件处理。'));},15*60*1000);
    signal?.addEventListener('abort',abort,{once:true});
    worker.onmessage=({data})=>{if(data.progress){onProgress?.(data.progress);return;}finish();if(!data.ok)reject(Error(data.error));else resolve(Object.fromEntries(Object.entries(data.result).map(([k,p])=>[k,unpackGeometry(p)])));};
    worker.onerror=()=>{finish();reject(Error('后台网格处理失败，请刷新后重试。'));};
    try{const packed=packGeometry(geometry);worker.postMessage({operation,geometry:packed,...parameters},geometryBuffers(packed));}catch(e){finish();reject(e);}
  });
}
