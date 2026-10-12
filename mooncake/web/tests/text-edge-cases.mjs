import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1024,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/');
 const result=await page.evaluate(async()=>{
  const {DEFAULT,normalize,makeGeometry,textRadius,designDocument}=await import('/src/design.js');
  const rows=[],docs=[];
  for(const font of ['serif','sans']) for(const patternDiameter of [30,68,110]) for(const textSize of [10,Math.floor(patternDiameter*.38)]) for(const character of ['i','j','B','ABCDE','iWgyQ','团圆']) {
   const d=normalize({...DEFAULT,diameter:120,patternDiameter,textSize,character,font,textLayout:character==='团圆'?'straight':'circular'}),g=makeGeometry(d),regions=g.reliefs.filter(r=>r.label==='文字');
   rows.push({font,patternDiameter,textSize,character,n:regions.length,area:regions.reduce((sum,r)=>sum+Math.abs(r.outer.reduce((a,p,i)=>{const q=r.outer[(i+1)%r.outer.length];return a+p[0]*q[1]-q[0]*p[1];},0)/2),0),extent:Math.max(...regions.flatMap(r=>r.outer.map(p=>Math.hypot(...p)))),radius:textRadius(d)});docs.push(designDocument(d,g));
  }return{rows,docs};
 });
 for(const row of result.rows){assert.ok(row.n>0&&row.extent<=row.radius+.0002,JSON.stringify(row));if(['i','j'].includes(row.character))assert.equal(row.n,2,`Stem/dot lost: ${JSON.stringify(row)}`);}
 for(const r of result.rows.filter(r=>r.textSize===10&&r.patternDiameter===68&&r.character==='ABCDE')){const max=result.rows.find(m=>m.font===r.font&&m.patternDiameter===68&&m.textSize!==10&&m.character===r.character);assert.ok(max.area>r.area*2,'Circular font size must change');}
 await writeFile('/private/tmp/mooncake-qa/text-edge-geometries.json',JSON.stringify(result.docs));
 await page.locator('#tab-2').click();await page.locator('#character').fill('ABCDEF');await expect(page.locator('.purchase-button')).toBeDisabled();
 await page.locator('#language').selectOption('fr');await expect(page.locator('[role=alert]')).toContainText('2 caractères chinois');await expect(page.locator('#character')).toHaveValue('ABCDEF');
 await page.locator('footer button').last().click();await page.getByRole('dialog').getByRole('button',{name:'Recommencer',exact:true}).click();await page.locator('#tab-2').click();await expect(page.locator('#character')).toHaveValue('福');await expect(page.locator('.purchase-button')).toBeEnabled();
 await page.locator('#character').dispatchEvent('compositionstart');await expect(page.locator('.purchase-button')).toBeDisabled();await page.locator('#character').dispatchEvent('compositionend');await expect(page.locator('.purchase-button')).toBeEnabled();
 for(const locale of ['fr','ja']){await page.locator('#language').selectOption(locale);assert.ok(await page.locator('.intro').evaluate(el=>el.querySelector('p').getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom),'Intro must not overlap preview');}
 await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('footer .mobile-guide').isVisible());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const offline=await browser.newPage();const requests=[];offline.on('request',r=>{if(r.url().startsWith('http'))requests.push(r.url());});await offline.route(/^https?:/,r=>r.abort());
 await offline.goto('file://'+fileURLToPath(new URL('../../mooncake/Mooncake.html',import.meta.url)));await offline.locator('#language').selectOption('en');await offline.locator('#tab-2').click();await offline.locator('#character').fill('HELLO');await offline.getByRole('button',{name:'Circular',exact:true}).click();await expect(offline.locator('.purchase-button')).toBeEnabled();await expect(offline.locator('.canvas canvas')).toBeVisible();assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
 console.log(`PASS: ${result.rows.length} minimum/maximum text cases including i/j dots; size changes, IME, reset, tablet, mobile guide, offline English circular.`);
}finally{await browser.close();}
