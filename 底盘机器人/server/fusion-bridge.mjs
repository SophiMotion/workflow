import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fusionPayload } from '../shared/fusion.mjs';

const exec=promisify(execFile);
export const isLoopback=ip=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip);
export function localFusionRequest(req) {
  let origin;
  try {origin=new URL(req.headers.origin);} catch{return false;}
  return isLoopback(req.socket.remoteAddress)&&['127.0.0.1','localhost','[::1]'].includes(origin.hostname)
    &&origin.protocol==='http:'&&origin.host===req.headers.host&&req.headers['x-skate-fusion']==='1'
    &&req.headers['content-type']?.startsWith('application/json');
}
function atomic(file,value) {
  const temporary=file+'.'+crypto.randomUUID()+'.tmp';
  fs.writeFileSync(temporary,JSON.stringify(value),{mode:0o600});fs.renameSync(temporary,file);
}
export function createFusionBridge(directory, launch=async()=>{
  if(process.platform!=='darwin')throw Error('自动启动目前支持本机 macOS；请手动打开 Fusion 插件并导入已下载的配置。');
  await exec('/usr/bin/open',['-b','com.autodesk.fusion360'],{timeout:12000});
}) {
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const read=file=>{try{return JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));}catch{return null;}};
  return {
    async open(project){
      const payload=fusionPayload(project),id=crypto.randomUUID();
      // One current handoff; a second export replaces the pending configuration.
      atomic(path.join(directory,'request.json'),{id,createdAt:Date.now(),payload});
      try {await launch();return {id,launch:'requested'};}
      catch(e){return {id,launch:'failed',error:e.message};}
    },
    status(id){
      const heartbeat=read('heartbeat.json'),reply=read('reply.json'),pending=read('request.json');
      return {pluginRunning:!!heartbeat&&heartbeat.running===true&&Date.now()-heartbeat.at<8000,
        state:reply?.id===id?reply.state:pending?.id===id?'queued':'superseded',
        message:reply?.id===id?reply.message:undefined};
    }
  };
}
