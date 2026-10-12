import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { topDiameter, topOutline, maxPatternDiameter, moldFitError, isValidText, isEnglish, PATTERN_NAMES, DEFAULT, normalize, outline, parametricReliefs, rasterRegions, area, regionArea, designDocument, readDocument } from '../src/design.js';
test('diameter, front diameter and text fit are clamped together', () => {
 const d = normalize({ ...DEFAULT, diameter: 50, thickness: 0 });
 assert.equal(d.patternDiameter, 39.6); assert.equal(d.textSize, 15); assert.ok(d.thickness >= 10);
});
test('all side patterns preserve specified maximum diameter', () => {
 for (const side of ['round','scallop','wave']) for (const diameter of [50,80,120]) { const loop=outline({...DEFAULT,side,diameter}); assert.equal(loop.length,384); assert.ok(loop.every(p=>Math.hypot(...p)<=diameter/2+.0001)); assert.ok(area(loop)>0); }
});
test('all pattern combinations stay inside the front disk and retain holes', () => {
 for (const pattern of Object.keys(PATTERN_NAMES)) for (const petals of [8,16,24]) { const d={...DEFAULT,pattern,petals}; for(const r of parametricReliefs(d)){ assert.ok(regionArea(r)>0); assert.ok(r.outer.every(p=>Math.hypot(...p)<=d.patternDiameter/2+.001)); } }
});
test('raster contours retain counters and use ascending height levels', () => {
 const n=64, values=Array.from({length:n*n},(_,i)=>{const r=Math.hypot(i%n-31.5,Math.floor(i/n)-31.5);return r<24&&r>10?.85:0;});
 const regions=rasterRegions(values,n,60,2.4,3);
 assert.equal(regions.length,3); assert.deepEqual(regions.map(r=>r.height),[.8,1.6,2.4]); assert.ok(regions.every(r=>r.holes.length===1));
});
test('JSON round trip, malicious values and incomplete images', () => {
 const doc=designDocument({...DEFAULT, character:''},{outline:outline(DEFAULT),reliefs:parametricReliefs(DEFAULT)});
 assert.equal(readDocument(doc).diameter,80);
 assert.throws(()=>readDocument({...doc,units:'cm'}));
 assert.throws(()=>readDocument({...doc,dimensions:{diameter:Infinity,thickness:25}}));
 assert.throws(()=>readDocument({...doc,text:{...doc.text,character:'团圆福'}}));
 assert.throws(()=>readDocument({...doc,front:{...doc.front,mode:'image',image:null}}));
 assert.equal(readDocument({...doc,mold:undefined}).mold.radialClearance,.3);
 assert.throws(()=>readDocument({...doc,mold:{...doc.mold,stampThickness:2}}));
 assert.throws(()=>readDocument({...doc,mold:null}));
});
test('generate fixtures for Python cross-runtime geometry validation', () => {
 mkdirSync('../mooncake/examples',{recursive:true});
 for(const pattern of Object.keys(PATTERN_NAMES)){
  const d={...DEFAULT,character:'',pattern}; const geometry={outline:outline(d),reliefs:parametricReliefs(d)};
  writeFileSync(`../mooncake/examples/${pattern}.json`,JSON.stringify(designDocument(d,geometry),null,2));
 }
 const n=64, values=Array.from({length:n*n},(_,i)=>{const r=Math.hypot(i%n-31.5,Math.floor(i/n)-31.5);return r<23&&r>11?.9:0;});
 const d={...DEFAULT,character:'',mode:'image',image:{name:'ring-test.png',size:n,values}};
 writeFileSync('../mooncake/examples/image-relief.json',JSON.stringify(designDocument(d,{outline:outline(d),reliefs:[...parametricReliefs(d),...rasterRegions(values,n,d.patternDiameter,d.relief,3)]}),null,2));
});

test('engraving limits, layout persistence and legacy files', () => {
 for(const character of ['', '福', '团圆', '𠮷福', 'A', 'aBcDe']) assert.ok(isValidText(character));
 for(const character of ['团圆福', 'ABCDEF', '福A', 'AB C', 'é', '123', '😊', null]) assert.equal(isValidText(character), false);
 for(const character of ['A','ABCDE']) {
  const d={...DEFAULT,character,textLayout:'circular'}, doc=designDocument(d,null);
  assert.equal(doc.text.layout,'circular'); assert.equal(readDocument(doc).textLayout,'circular');
 }
 const doc=designDocument(DEFAULT,null); delete doc.text.layout;
 assert.equal(readDocument(doc).textLayout,'straight');
 assert.throws(()=>readDocument({...doc,text:{...doc.text,layout:'circular'}}));
 assert.throws(()=>readDocument({...doc,text:{...doc.text,character:'HI',layout:'unknown'}}));
 assert.equal(normalize({...DEFAULT,character:'团圆',textLayout:'circular'}).textLayout,'straight');
});

test('five-degree radial draft preserves the base and clamps artwork to the small face', () => {
 const d=normalize({...DEFAULT,diameter:68,thickness:26});
 assert.ok(Math.abs(topDiameter(d)-(68-52*Math.tan(5*Math.PI/180)))<1e-10);
 for(const side of ['round','wave','scallop']) for(const diameter of [50,120]) for(const thickness of [10,40]) for(const draftAngle of [0,5,8]) {
  const d=normalize({...DEFAULT,side,diameter,thickness,draftAngle,patternDiameter:diameter-10});
  const bottom=outline(d),top=topOutline(d),inset=thickness*Math.tan(draftAngle*Math.PI/180);
  for(let i=0;i<bottom.length;i++) assert.ok(Math.abs(Math.hypot(...bottom[i])-Math.hypot(...top[i])-inset)<.0001);
  assert.ok(d.patternDiameter/2 < Math.min(...top.map(p=>Math.hypot(...p)))+.0001);
  const doc=designDocument(d,{outline:bottom,reliefs:parametricReliefs(d)});
  assert.equal(doc.version,2); assert.equal(doc.geometry.topOutline.length,384);assert.equal(readDocument(doc).draftAngle,draftAngle);
 }
 const legacy=designDocument({...DEFAULT,draftAngle:0},null);legacy.version=1;delete legacy.dimensions.draftAngle;
 assert.equal(readDocument(legacy).draftAngle,0);
 for(const draftAngle of [-1,9,NaN,null]) assert.throws(()=>readDocument({...designDocument(DEFAULT,null),dimensions:{diameter:80,thickness:25,draftAngle}}));
});

test('M20 hardware is exported and older M8 designs upgrade without losing fit settings', () => {
 const doc=designDocument(DEFAULT,null);
 assert.equal(doc.mold.connection,'M20x2.5');
 for(const [key,value] of Object.entries({baseThickness:6,shaftDiameter:30,shaftLength:40,studLength:15,handleDiameter:40,bossDiameter:30,guideHeight:6})) assert.equal(doc.mold[key],value);
 const old={type:'hand_press',radialClearance:.45,wallThickness:4,stampThickness:6,connection:'M8x1.25'};
 const imported=readDocument({...doc,mold:old});
 assert.equal(imported.mold.connection,'M20x2.5');assert.equal(imported.mold.radialClearance,.45);
 assert.equal(designDocument({...DEFAULT,mold:old},null).mold.shaftDiameter,30);
 assert.throws(()=>readDocument({...doc,mold:{...doc.mold,studLength:40}}));
});


test('short upper cavity and diameter-30 boss support the whole cake thickness range', () => {
 for(const thickness of [10,26,33,40]) {
  const d=normalize({...DEFAULT,diameter:50,thickness,draftAngle:8});
  assert.equal(moldFitError(d),'');
 }
 const doc=designDocument(DEFAULT,null);
 const old={...doc.mold,bossDiameter:40};delete old.guideHeight;
 const updated=readDocument({...doc,mold:old});
 assert.equal(updated.mold.bossDiameter,30);assert.equal(updated.mold.guideHeight,6);assert.equal(updated.mold.handleDiameter,40);
 assert.throws(()=>readDocument({...doc,mold:{...doc.mold,bossDiameter:40}}));
 assert.notEqual(moldFitError({...DEFAULT,mold:{...doc.mold,stampThickness:8}}),'');
});
