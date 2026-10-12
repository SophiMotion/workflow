import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site');
const port=Number(process.env.PORT || 4174);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
Object.assign(types,{'.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.mp3':'audio/mpeg','.wav':'audio/wav'});
const server=http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
    const real=fs.realpathSync(file);if(!real.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const size=fs.statSync(file).size;
    const headers={'Content-Type':types[path.extname(file)] || 'application/octet-stream','Content-Length':size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Accept-Ranges':'bytes'};
    let start=0,end=size-1,status=200;
    if(req.headers.range){
      const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(!range||(!range[1]&&!range[2])){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
      start=range[1]?Number(range[1]):Math.max(0,size-Number(range[2]));
      end=range[1]&&range[2]?Math.min(Number(range[2]),size-1):size-1;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
      status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;headers['Content-Length']=end-start+1;
    }
    res.writeHead(status,headers);
    if(req.method==='HEAD'||!size){res.end();return;}fs.createReadStream(file,{start,end}).pipe(res);
  }catch{res.writeHead(400);res.end('Bad request');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${port} 已在使用，请先打开 http://127.0.0.1:${port} 检查现有服务，或设置 PORT 使用其他端口。`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`AI 产品经理知识库：http://127.0.0.1:${port}\n仅本机可访问。按 Ctrl+C 停止服务。`));
