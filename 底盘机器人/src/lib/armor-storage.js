const DATABASE='skatechassis-armor-v1';
function openDatabase(){return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DATABASE,1);
  req.onupgradeneeded=()=>req.result.createObjectStore('drafts');req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(Error('本地存储不可用，请导出 GLB 保留模型。'));
});}
// Only migration cleanup remains; new sessions never persist geometry.
// 仅保留旧版草稿清理，新会话不再持久化大模型。
export async function deleteArmorDraft(key){
  const db=await openDatabase();try{await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').delete(key);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(Error('无法清除本地外壳，请重试。'));});}finally{db.close();}
}
