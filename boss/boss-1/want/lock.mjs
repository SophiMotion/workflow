import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

// Publish a complete owner file atomically, avoiding an empty-lock crash window.
export async function acquireLock(file,{timeout=10000,message='记录正在保存，请稍后重试'}={}){
 const claim=file+'.'+randomUUID()+'.owner';
 await fs.writeFile(claim,JSON.stringify({pid:process.pid,at:Date.now()}),{mode:0o600});
 const mine=await fs.stat(claim),until=Date.now()+timeout;
 try{
  while(true){
   try{await fs.link(claim,file);break;}catch(e){
    if(e.code!=='EEXIST')throw e;
    try{
     const before=await fs.stat(file);let abandoned=false;
     try{const owner=JSON.parse(await fs.readFile(file,'utf8'));if(Number.isInteger(owner.pid)&&owner.pid>0){try{process.kill(owner.pid,0);}catch(x){abandoned=x.code==='ESRCH';}}}catch{abandoned=Date.now()-before.mtimeMs>30000;}
     if(abandoned){const current=await fs.stat(file);if(current.ino===before.ino&&current.dev===before.dev){await fs.unlink(file);continue;}}
    }catch(e){if(e.code==='ENOENT')continue;}
    if(Date.now()>=until)throw Error(message);await wait(25);
   }
  }
 }finally{await fs.unlink(claim).catch(()=>{});}
 return async()=>{try{const current=await fs.stat(file);if(current.ino===mine.ino&&current.dev===mine.dev)await fs.unlink(file);}catch(e){if(e.code!=='ENOENT')throw e;}};
}
