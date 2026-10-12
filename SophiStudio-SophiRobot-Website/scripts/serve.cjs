const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root=path.resolve(__dirname,'../dist');
const {createWorkflowHandler}=require('./workflow-return.cjs');
const openWorkflow=createWorkflowHandler({workflowFile:path.resolve(__dirname,'../../index.html')});
const port=Number(process.env.PORT || 5173);
if(!Number.isInteger(port)||port<1||port>65535){console.error('PORT must be an integer between 1 and 65535.');process.exit(1);}
const url=`http://127.0.0.1:${port}/`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
if(!fs.existsSync(path.join(root,'index.html'))){console.error('Production build missing. Run pnpm build first.');process.exit(1);}
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end('Invalid URL');return;}
 if(pathname==='/api/open-workflow'){void openWorkflow(req,res);return;}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);});
});
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?`Port ${port} is already in use. Open ${url} if the configurator is already running, or close the other server.`:err.message);process.exit(1)});
server.listen(port,'127.0.0.1',()=>{
 console.log(`SophiStudio - SophiRobot\n${url}\nPress Ctrl+C to stop.`);
 if(process.argv.includes('--open'))require('node:child_process').spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'}).on('error',()=>console.log(`Open ${url} in your browser.`));
});
