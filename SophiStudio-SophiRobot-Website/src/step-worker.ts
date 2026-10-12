import {exportPreviewStep} from './step-export';
import {parseConfig} from './parameters';
import {parseLimbConfig} from './limbs';
import {parseHeadConfig} from './head';
import type {Model} from './geometry';
self.onmessage=async(event:MessageEvent)=>{
 try{
  const {modelUrl,config,cover}=event.data,response=await fetch(modelUrl);if(!response.ok)throw new Error('Unable to load model for STEP export.');
  const model:Model=await response.json(),params=parseConfig(config,model.metadata.sha256),limbs=parseLimbConfig(config.limbs);
  const result=exportPreviewStep(model,params,limbs.pose,cover,(done,total)=>self.postMessage({type:'progress',done,total}),parseHeadConfig(config.head).pose);
  const blob=new Blob(result.chunks,{type:'application/step'});self.postMessage({type:'complete',blob,bodyCount:result.bodyCount,triangles:result.triangles});
 }catch(e){self.postMessage({type:'error',message:e instanceof Error?e.message:'Unable to export STEP.'});}
};
