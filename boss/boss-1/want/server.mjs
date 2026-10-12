import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {randomBytes} from 'node:crypto';
import {acquireLock} from './lock.mjs';
import {Store} from './store.mjs';import {viewRecords,filterRecords,dashboard,CATEGORIES,day,hash} from './model.mjs';import {CodexRunner} from './codex.mjs';import {Queue} from './queue.mjs';import {createExport} from './export.mjs';
const moduleDir=path.dirname(fileURLToPath(import.meta.url));
export async function createServer({root=path.dirname(moduleDir),store=new Store(root),runner}={}){
 await fs.mkdir(store.dir,{recursive:true,mode:0o700});const releaseWorker=await acquireLock(path.join(store.dir,'.worker.lock'),{timeout:0,message:'招聘后台已在运行，请使用现有服务'});try{await store.init();runner??=new CodexRunner(store);const queue=new Queue(store,runner);await queue.recover();const token=randomBytes(24).toString('hex');let auth={available:false,note:'正在检查 Codex 登录'};const check=()=>runner.status().then(s=>{auth=s;}).catch(()=>{});await check();
 const json=(res,code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 const select=(s,body)=>{let rows=filterRecords(viewRecords(s),body.filters||{});if(body.ids!==undefined){if(!Array.isArray(body.ids)||body.ids.some(x=>typeof x!=='string'))throw Error('记录选择格式错误');const ids=new Set(body.ids);rows=rows.filter(r=>ids.has(r.id));}return rows;};
 const server=http.createServer(async(req,res)=>{try{
  const port=server.address()?.port,host=req.headers.host,origin='http://'+host;
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(host))return json(res,403,{error:'仅允许本机访问'});
  if((req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'不允许跨站访问'});
  const u=new URL(req.url,origin),pathname=decodeURIComponent(u.pathname);let body;
  if(req.method==='POST'){
   if(req.headers.origin!==origin||req.headers['x-want-token']!==token)return json(res,403,{error:'请求验证失败，请刷新页面'});
   if(!req.headers['content-type']?.startsWith('application/json'))return json(res,400,{error:'需要 JSON 请求'});
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>500000)throw Error('请求过大');}try{body=JSON.parse(raw);}catch{throw Error('JSON 格式错误');}if(!body||Array.isArray(body)||typeof body!=='object')throw Error('请求格式错误');
  }
  if(req.method==='GET'&&pathname==='/api/want/session')return json(res,200,{token});
  if(req.method==='GET'&&pathname==='/api/want/health')return json(res,200,{service:'sophistudio-want',ok:true});
  if(req.method==='GET'&&pathname==='/api/want/snapshot'){
   const s=await store.snapshot(),rows=viewRecords(s);return json(res,200,{date:day(new Date()),updatedAt:s.data.updatedAt,stateUpdatedAt:s.state.updatedAt,version:s.state.version,sourceRevision:hash({data:s.data,config:s.config}),roles:[...s.config.roles,...(s.config.archivedRoles||[])],categories:CATEGORIES,stats:dashboard(s,u.searchParams.get('scope')||'today'),counts:Object.fromEntries(CATEGORIES.map(c=>[c,rows.filter(r=>r.category===c).length])),total:rows.length,reviewed:rows.filter(r=>r.reviewCount>0).length,archived:rows.filter(r=>r.archived).length,jobs:s.state.jobs.slice(-25).reverse(),exports:s.state.exports.slice(-15).reverse(),sourceNotes:s.config.sourceNotes,latestRun:s.data.runs?.at(-1),capabilities:{codex:auth,browser:{available:false,note:'尚无独立后台 Edge 连接；本工作台可以评估资料，未接管 BOSS 自动读取或发送。'}}});
  }
  if(req.method==='GET'&&pathname==='/api/want/records'){
   const s=await store.snapshot(),f=Object.fromEntries(u.searchParams),rows=filterRecords(viewRecords(s),f);const requested=Math.max(1,parseInt(f.page)||1),size=Math.min(50,Math.max(1,parseInt(f.size)||20)),pages=Math.max(1,Math.ceil(rows.length/size)),page=Math.min(requested,pages);
   rows.sort((a,b)=>String(b.reviewedAt||'').localeCompare(String(a.reviewedAt||'')));return json(res,200,{total:rows.length,page,pages,rows:rows.slice((page-1)*size,page*size)});
  }
  if(req.method==='GET'&&pathname==='/api/want/record'){const s=await store.snapshot(),row=viewRecords(s).find(r=>r.id===u.searchParams.get('id'));return json(res,row?200:404,row||{error:'记录不存在'});}
  if(req.method==='POST'&&pathname==='/api/want/reviews'){const event=await store.addReview(body.id,body);return json(res,200,{event});}
  if(req.method==='POST'&&pathname==='/api/want/auth-check'){await check();return json(res,200,auth);}
  if(req.method==='POST'&&pathname==='/api/want/jobs'){const rows=select(await store.snapshot(),body);const job=await queue.create(rows.map(r=>r.id));void queue.drain();return json(res,202,{job});}
  const action=pathname.match(/^\/api\/want\/jobs\/([\w-]+)\/(pause|resume)$/);if(req.method==='POST'&&action){await queue[action[2]](action[1]);if(action[2]==='resume')void queue.drain();return json(res,200,{ok:true});}
  if(req.method==='POST'&&pathname==='/api/want/export'){const rows=select(await store.snapshot(),body);if(!rows.length)throw Error('筛选结果为空');return json(res,200,await createExport(store,rows,body.format,body.filters));}
  const download=pathname.match(/^\/api\/want\/download\/(want-[a-zA-Z0-9.-]+\.(csv|html|xlsx))$/);if(req.method==='GET'&&download){const bytes=await fs.readFile(path.join(store.dir,'exports',download[1]));res.writeHead(200,{'Content-Type':download[2]==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':download[2]==='html'?'text/html; charset=utf-8':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="'+download[1]+'"','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(bytes);return;}
  const allowed=pathname==='/want.html'||pathname==='/'||/^\/want\/public\/[\w.-]+\.(js|css)$/.test(pathname)||/^\/unit\/(js|css)\/[\w.-]+\.(js|css)$/.test(pathname)||/^\/assets\/[\w.-]+\.(png|svg|jpg|webp)$/.test(pathname);
  if(req.method==='GET'&&allowed){const file=path.join(root,pathname==='/'?'want.html':pathname.slice(1));const bytes=await fs.readFile(file);const ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp'})[ext],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"});res.end(bytes);return;}
  json(res,404,{error:'页面或接口不存在'});
 }catch(e){json(res,e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'文件不存在':e.message});}});
 let released=false;const release=async()=>{if(released)return;released=true;await queue.stop();await releaseWorker();};server.on('close',()=>{void release();});server.on('error',()=>{void release();});
 return {server,store,queue};
 }catch(e){await releaseWorker();throw e;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=await createServer();const port=Number(process.env.PORT||8770);app.server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`${port} 端口已占用，未停止其他程序`:e.message);process.exitCode=1;});app.server.listen(port,'127.0.0.1',()=>{console.log(`Want ready: http://127.0.0.1:${port}/want.html`);void app.queue.drain();});
}
