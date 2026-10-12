// A shell exists only while its workbench is open. / 外壳只在当前装配会话中保留。
export function releaseArmorResources(resources,retained={geometries:new Set(),materials:new Set()}){
  const textures=new Set(),images=new Set(),keepTextures=new Set(),keepImages=new Set();
  for(const m of retained.materials)for(const value of Object.values(m))if(value?.isTexture){keepTextures.add(value);if(value.image)keepImages.add(value.image);}
  for(const m of resources.materials)if(!retained.materials.has(m)){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();resources.materials.delete(m);}
  for(const t of textures)if(!keepTextures.has(t)){if(t.image)images.add(t.image);t.dispose();}
  for(const img of images)if(!keepImages.has(img)&&typeof img.close==='function')img.close();
  for(const g of resources.geometries)if(!retained.geometries.has(g)){g.dispose();resources.geometries.delete(g);}
}
export function partResources(parts){return {geometries:new Set(parts.map(p=>p.geometry)),materials:new Set(parts.flatMap(p=>Array.isArray(p.material)?p.material:[p.material]))};}
export function createArmorSession(){
  const controller=new AbortController(),resources={geometries:new Set(),materials:new Set()},history=[];
  return {
    signal:controller.signal,resources,history,source:null,
    track(parts){
      if(controller.signal.aborted){releaseArmorResources(partResources(parts));controller.signal.throwIfAborted();}
      for(const p of parts){resources.geometries.add(p.geometry);for(const m of Array.isArray(p.material)?p.material:[p.material])resources.materials.add(m);}
      return parts;
    },
    dispose(){
      if(controller.signal.aborted)return;
      controller.abort();this.source=null;history.length=0;releaseArmorResources(resources);
    },
  };
}

// Aborting also cancels a frame wait when a background tab stops painting.
// 后台标签可能暂停绘制；离开时同时取消等待，避免悬挂的大模型引用。
export function armorFrame(signal){
  return new Promise((resolve,reject)=>{
    let frame;
    const cleanup=()=>{cancelAnimationFrame(frame);signal?.removeEventListener('abort',abort);};
    const abort=()=>{cleanup();reject(signal.reason);};
    if(signal?.aborted){reject(signal.reason);return;}
    signal?.addEventListener('abort',abort,{once:true});
    frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{cleanup();resolve();});});
  });
}
