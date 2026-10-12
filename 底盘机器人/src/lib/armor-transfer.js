import { BufferGeometry, BufferAttribute } from 'three';

// 使用可转移缓冲区把大网格运算交给后台线程。 Transfer mesh buffers to a worker for expensive editing.
export function packGeometry(geometry,{copy=true}={}){
  const attributes={};for(const [name,a] of Object.entries(geometry.attributes)){
    if(!a.isInterleavedBufferAttribute&&!a.isFloat16BufferAttribute){attributes[name]={array:copy?a.array.slice():a.array,itemSize:a.itemSize,normalized:a.normalized};continue;}
    const array=new Float32Array(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let j=0;j<a.itemSize;j++)array[i*a.itemSize+j]=a.getComponent(i,j);
    attributes[name]={array,itemSize:a.itemSize};
  }
  return {attributes,index:geometry.index?(copy?geometry.index.array.slice():geometry.index.array):null,groups:geometry.groups.map(g=>({...g}))};
}
export function unpackGeometry(data){
  const g=new BufferGeometry();for(const [name,a] of Object.entries(data.attributes))g.setAttribute(name,new BufferAttribute(a.array,a.itemSize,!!a.normalized));
  if(data.index)g.setIndex(new BufferAttribute(data.index,1));data.groups.forEach(gr=>g.addGroup(gr.start,gr.count,gr.materialIndex));return g;
}
export function geometryBuffers(data){return [...new Set([...Object.values(data.attributes).map(a=>a.array.buffer),...(data.index?[data.index.buffer]:[])])];}
