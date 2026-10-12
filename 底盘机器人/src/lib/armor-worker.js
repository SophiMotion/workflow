import { splitGeometry, simplifyGeometry } from './armor-geometry.js';
import { packGeometry, unpackGeometry, geometryBuffers } from './armor-transfer.js';
self.onmessage=async({data})=>{
  try{
    const geometry=unpackGeometry(data.geometry),result=data.operation==='split'?splitGeometry(geometry,data.axis,data.position,percent=>self.postMessage({progress:`正在切分原始网格 · ${percent}%`})):{geometry:await simplifyGeometry(geometry,data.ratio)};
    const packed=Object.fromEntries(Object.entries(result).map(([k,g])=>[k,packGeometry(g,{copy:false})]));
    self.postMessage({ok:true,result:packed},Object.values(packed).flatMap(geometryBuffers));
  }catch(e){self.postMessage({ok:false,error:e.message});}
};
