const {access}=require('node:fs/promises');
const {execFile}=require('node:child_process');
const {pathToFileURL}=require('node:url');

function launchWorkflow(url){
 return new Promise((resolve,reject)=>{
  if(process.platform!=='darwin'){reject(new Error('Desktop workflow opening requires macOS.'));return;}
  execFile('/usr/bin/open',[url],{timeout:5000},error=>error?reject(error):resolve());
 });
}

function createWorkflowHandler({workflowFile,launch=launchWorkflow}){
 const target=pathToFileURL(workflowFile);target.hash='/workflow';
 return async(req,res)=>{
  const reply=(status,payload)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));};
  if(req.method!=='POST'){reply(405,{ok:false,error:'Use POST.'});return;}
  // Only an explicit action in this loopback app may launch the fixed local page.
  const host=`127.0.0.1:${req.socket.localPort}`;
  if(req.headers.host!==host||req.headers.origin!==`http://${host}`||req.headers['x-sophistudio-action']!=='open-workflow'){
   reply(403,{ok:false,error:'A same-origin workflow action is required.'});return;
  }
  try{await access(workflowFile);}catch{reply(404,{ok:false,url:target.href,error:'Workflow homepage is missing.'});return;}
  try{await launch(target.href);reply(200,{ok:true,url:target.href});}
  catch{reply(500,{ok:false,url:target.href,error:'Unable to open the workflow page.'});}
 };
}

module.exports={createWorkflowHandler};
