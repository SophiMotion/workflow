import { BufferGeometry, BufferAttribute } from 'three';

const EPSILON=1e-7;
const SKINNING=new Set(['skinIndex','skinWeight']);

// Keep shared source vertices indexed. Only triangles crossing the plane need
// interpolated vertex objects. / 保留共享顶点，仅为穿过切面的三角形插值。
export function splitGeometry(geometry,axis,position,onProgress=()=>{}){
  const axisIndex={x:0,y:1,z:2}[axis],positions=geometry.getAttribute('position');
  if(axisIndex===undefined)throw new RangeError("axis must be 'x', 'y', or 'z'");
  if(!Number.isFinite(position))throw new TypeError('position must be finite');
  if(!positions)throw new TypeError('geometry must have a position attribute');
  const names=Object.keys(geometry.attributes).filter(name=>!SKINNING.has(name));
  const distances=new Float64Array(positions.count);
  let negative=false,positive=false;
  for(let i=0;i<positions.count;i++){
    const d=positions.getComponent(i,axisIndex)-position;distances[i]=Math.abs(d)<=EPSILON?0:d;
    if(d<-EPSILON)negative=true;if(d>EPSILON)positive=true;
  }
  if(!negative||!positive)throw new RangeError('plane does not split the geometry');
  const elements=geometry.index?.count??positions.count;
  const at=i=>geometry.index?geometry.index.getX(i):i;
  const materialAt=i=>geometry.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex??0;
  const vertex=id=>({id,distance:distances[id],values:Object.fromEntries(names.map(name=>{
    const a=geometry.attributes[name];return [name,Array.from({length:a.itemSize},(_,c)=>a.getComponent(id,c))];
  }))});
  function interpolate(a,b){
    const t=a.distance/(a.distance-b.distance),values={};
    for(const name of names){
      values[name]=a.values[name].map((v,c)=>v+(b.values[name][c]-v)*t);
      if(name==='normal'||name==='tangent'){
        const length=Math.hypot(...values[name].slice(0,3));
        if(length>EPSILON)for(let c=0;c<3;c++)values[name][c]/=length;
      }
      if(name==='tangent'&&values[name].length>=4)values[name][3]=values[name][3]<0?-1:1;
    }
    // Pin the intersection exactly to the cutting plane. / 切面坐标精确对齐。
    values.position[axisIndex]=position;
    return {id:-1,distance:0,values};
  }
  function clip(vertices,sign){
    const out=[];
    for(let i=0;i<3;i++){
      const a=vertices[i],b=vertices[(i+1)%3],inside=a.distance*sign>=0,next=b.distance*sign>=0;
      if(inside)out.push(a);
      if(inside!==next){
        if(a.distance===0)out.push(a);else if(b.distance===0)out.push(b);else out.push(interpolate(a,b));
      }
    }
    return out;
  }
  function hasArea(a,b,c){
    const p=a.values.position,q=b.values.position,r=c.values.position;
    const x=q[0]-p[0],y=q[1]-p[1],z=q[2]-p[2],u=r[0]-p[0],v=r[1]-p[1],w=r[2]-p[2];
    return (y*w-z*v)**2+(z*u-x*w)**2+(x*v-y*u)**2>1e-24;
  }
  function builder(capacity){
    const remap=new Int32Array(positions.count).fill(-1),intersections=new WeakMap();
    const attributes=capacity?Object.fromEntries(names.map(n=>[n,new Float32Array(capacity.vertices*geometry.attributes[n].itemSize)])):null;
    const indices=capacity?new Uint32Array(capacity.elements):null,groups=[];
    let vertices=0,count=0;
    function add(v){
      const source=typeof v==='number'?v:v.id;
      let id=source>=0?remap[source]:intersections.get(v);
      if(id===undefined||id===-1){
        id=vertices++;
        if(source>=0)remap[source]=id;else intersections.set(v,id);
        if(capacity)for(const name of names){
          const a=geometry.attributes[name];
          for(let c=0;c<a.itemSize;c++)attributes[name][id*a.itemSize+c]=source>=0?a.getComponent(source,c):v.values[name][c];
        }
      }
      if(indices)indices[count]=id;
      count++;
    }
    return {
      triangle(a,b,c,material){
        if(capacity){const last=groups.at(-1);if(!last||last.materialIndex!==material)groups.push({start:count,count:3,materialIndex:material});else last.count+=3;}
        add(a);add(b);add(c);
      },
      finish(){
        if(!capacity)return {vertices,elements:count};
        const result=new BufferGeometry();
        for(const name of names)result.setAttribute(name,new BufferAttribute(attributes[name],geometry.attributes[name].itemSize));
        result.setIndex(new BufferAttribute(indices,1));result.groups=groups;
        result.computeBoundingBox();result.computeBoundingSphere();return result;
      },
    };
  }
  function pass(capacities,phase){
    const halves=[builder(capacities?.[0]),builder(capacities?.[1])];
    for(let offset=0;offset+2<elements;offset+=3){
      const a=at(offset),b=at(offset+1),c=at(offset+2),da=distances[a],db=distances[b],dc=distances[c],material=materialAt(offset);
      if(da>=0&&db>=0&&dc>=0)halves[1].triangle(a,b,c,material);
      else if(da<=0&&db<=0&&dc<=0)halves[0].triangle(a,b,c,material);
      else{
        const source=[vertex(a),vertex(b),vertex(c)];
        for(let half=0;half<2;half++){
          const polygon=clip(source,half===0?-1:1);
          for(let i=1;i+1<polygon.length;i++)if(hasArea(polygon[0],polygon[i],polygon[i+1]))halves[half].triangle(polygon[0],polygon[i],polygon[i+1],material);
        }
      }
      if(offset%196608===0)onProgress(Math.floor(phase*50+offset/elements*50));
    }
    return halves.map(h=>h.finish());
  }
  // Count first, then allocate exact typed buffers: memory scales with mesh size,
  // not millions of JS objects. / 两遍扫描，精确分配，不展开数百万个顶点对象。
  const counts=pass(null,0);
  if(counts.some(c=>c.elements===0))throw new RangeError('plane does not split any triangles');
  const result=pass(counts,1);onProgress(100);
  return {negative:result[0],positive:result[1]};
}
