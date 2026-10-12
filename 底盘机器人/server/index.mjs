import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createProject } from '../shared/domain.mjs';
import { applyOperation } from '../shared/project.mjs';
import { createFusionBridge, localFusionRequest } from './fusion-bridge.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=process.env.DATA_DIR||path.join(root,'data');fs.mkdirSync(data,{recursive:true});
const fusion=createFusionBridge(process.env.FUSION_BRIDGE_DIR||path.join(data,'fusion'));
const prod=process.env.NODE_ENV==='production';
const vite=prod?null:await (await import('vite')).createServer({root,server:{middlewareMode:true},appType:'spa'});
const sessions=new Map();
const digest=k=>crypto.createHash('sha256').update(k).digest('hex');
const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
function save(id,p){const f=path.join(data,id+'.json');fs.writeFileSync(f+'.tmp',JSON.stringify(p),{mode:0o600});fs.renameSync(f+'.tmp',f);}
async function body(req){let b='';for await(const c of req){b+=c;if(b.length>1024*1024){const e=Error('请求过大');e.status=413;throw e;}}try{return JSON.parse(b);}catch{throw Error('JSON 无效');}}
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.pdf':'application/pdf','.woff2':'font/woff2','.json':'application/json','.py':'text/x-python; charset=utf-8','.txt':'text/plain; charset=utf-8','.wasm':'application/wasm'};
function staticFile(res,file,base){
  const full=path.resolve(base,file);if(!full.startsWith(base+path.sep)||file.split(/[\\/]/).some(x=>x.startsWith('.'))||!mime[path.extname(full)]||!fs.existsSync(full)||!fs.statSync(full).isFile())return false;
  res.writeHead(200,{'Content-Type':mime[path.extname(full)],'X-Content-Type-Options':'nosniff'});fs.createReadStream(full).pipe(res);return true;
}
const server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname.startsWith('/api/skate/')){
    const origin=req.headers.origin;
    if(origin&&new URL(origin).host!==req.headers.host)return send(res,403,{error:'仅允许同源请求'});
    if(u.pathname==='/api/skate/health')return send(res,200,{ok:true,mode:'shared'});
    if(u.pathname.startsWith('/api/skate/fusion/')){
      if(!localFusionRequest(req))return send(res,403,{error:'Fusion 联动仅允许本机网页发起；其他设备请下载配置后在本机 Fusion 导入。'});
      if(u.pathname==='/api/skate/fusion/open'&&req.method==='POST')return send(res,202,await fusion.open(await body(req)));
      if(u.pathname==='/api/skate/fusion/status'&&req.method==='POST'){
        const {id}=await body(req);if(!/^[a-f0-9-]{36}$/.test(id||''))throw Error('请求编号无效');
        return send(res,200,fusion.status(id));
      }
      return send(res,404,{error:'Fusion 接口不存在'});
    }
    if(u.pathname==='/api/skate/projects'&&req.method==='POST'){
      const id=crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex'),p=createProject();save(id,{tokenHash:digest(token),project:p});return send(res,201,{id,token,project:p});
    }
    const match=u.pathname.match(/^\/api\/skate\/projects\/([a-f0-9-]{36})(?:\/(ops|presence))?$/);
    if(!match)return send(res,404,{error:'接口不存在'});
    const [,id,action]=match,file=path.join(data,id+'.json');if(!fs.existsSync(file))return send(res,404,{error:'项目不存在'});
    const record=JSON.parse(fs.readFileSync(file,'utf8')),token=(req.headers.authorization||'').replace(/^Bearer /,'');
    if(!token||!crypto.timingSafeEqual(Buffer.from(digest(token)),Buffer.from(record.tokenHash)))return send(res,403,{error:'项目访问凭据无效，请使用完整共享链接'});
    if(req.method==='GET')return send(res,200,{project:record.project});
    if(action==='ops'&&req.method==='POST'){
      const op=await body(req);
      // Body reading yields; reload immediately before atomic compare-and-swap.
      const latest=JSON.parse(fs.readFileSync(file,'utf8'));latest.project=applyOperation(latest.project,op);save(id,latest);return send(res,200,{project:latest.project});
    }
    if(action==='presence'&&req.method==='POST'){
      const b=await body(req);if(typeof b.client!=='string'||b.client.length>100||typeof b.name!=='string'||b.name.length>60)throw Error('成员数据无效');
      const members=sessions.get(id)||new Map();members.set(b.client,{name:b.name,seen:Date.now()});for(const [k,v] of members)if(Date.now()-v.seen>16000)members.delete(k);sessions.set(id,members);return send(res,200,{members:[...members.values()].map(x=>x.name)});
    }
    return send(res,405,{error:'方法不支持'});
  }
  if(u.pathname.startsWith('/studio/')){const f=decodeURIComponent(u.pathname.slice(8))||'index.html';const allowed=f==='index.html'||['assets/','unit/css/','unit/js/','prd/','stlquote/','sophicarv2/','sophicar-formate/web/dist/','cfd/dist/','底盘机器人/dist/'].some(prefix=>f.startsWith(prefix));if(allowed&&!f.split('/').includes('..')&&staticFile(res,f,path.dirname(root)))return;res.writeHead(404);return res.end('SophiStudio 工具文件不存在');}
  if(vite)return vite.middlewares(req,res,()=>{res.writeHead(404);res.end();});
  const f=decodeURIComponent(u.pathname).replace(/^\//,'')||'index.html';if(staticFile(res,f,path.join(root,'dist')))return;
  if(!path.extname(f)&&staticFile(res,'index.html',path.join(root,'dist')))return;
  res.writeHead(404);res.end('Not found');
}catch(e){send(res,e.status||400,{error:e.message});}});
server.listen(Number(process.env.PORT||4173),process.env.HOST||'127.0.0.1',()=>console.log(`SkateChassis: http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||4173}`));
