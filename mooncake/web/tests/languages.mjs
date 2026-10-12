import { chromium, expect } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { translate as tr, LANGUAGES, MESSAGES } from '../src/translations.js';
const qa='/private/tmp/mooncake-qa'; await mkdir(qa,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1536,height:1024},acceptDownloads:true}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/'); await page.locator('.canvas canvas').waitFor();
 await page.locator('#tab-2').click();
 await page.locator('#character').fill('团圆'); await expect(page.locator('.purchase-button')).toBeEnabled();
 const geometryResult=await page.evaluate(async()=>{
   const {DEFAULT,normalize,makeGeometry,textRadius,designDocument,readDocument}=await import('/src/design.js');
   await document.fonts.ready;
   const rows=[], docs=[];
   for(const font of ['serif','sans']) for(const diameter of [50,68,120]) for(const mode of ['parametric','image']) for(const textLayout of ['straight','circular']) {
     for(const character of (textLayout==='straight'?['金','福','囍','团圆','福囍','A','B','LOVE','HELLO','iWgyQ']:['A','AB','ABC','LOVE','HELLO','iWgyQ'])) {
       const d=normalize({...DEFAULT,diameter,patternDiameter:diameter===50?30:diameter-10,textSize:100,font,character,textLayout,mode,image:mode==='image'?{size:64,name:'empty.png',values:Array(4096).fill(0)}:null});
       const geometry=makeGeometry(d),regions=geometry.reliefs.filter(r=>r.label==='文字'),points=regions.flatMap(r=>r.outer),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
       rows.push({font,diameter,mode,textLayout,character,n:regions.length,holes:regions.reduce((n,r)=>n+r.holes.length,0),radius:textRadius(d),extent:Math.max(...points.map(p=>Math.hypot(...p))),x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2});
       const doc=designDocument(d,geometry);if(readDocument(doc).textLayout!==textLayout) throw Error('Layout roundtrip failed');docs.push(doc);
     }
   }
   return {rows,docs};
 });
 for(const r of geometryResult.rows) {
   assert.ok(r.n>0,JSON.stringify(r)); assert.ok(r.extent<=r.radius+.0002,JSON.stringify(r));
   if(r.textLayout==='straight') assert.ok(Math.abs(r.x)<.0002&&Math.abs(r.y)<.0002,`Off center: ${JSON.stringify(r)}`);
   if(['B','AB','ABC','LOVE','HELLO'].includes(r.character)) assert.ok(r.holes>0,`Missing counter: ${JSON.stringify(r)}`);
 }
 await writeFile(qa+'/text-geometry-cases.json',JSON.stringify(geometryResult.docs));
 for(const [width,height] of [[1536,1024],[390,844]]) {
   await page.setViewportSize({width,height});
   for(const locale of Object.keys(LANGUAGES)) {
     const t=key=>tr(locale,key);
     await page.locator('#language').selectOption(locale);
     await expect(page.locator('html')).toHaveAttribute('lang',locale==='zh'?'zh-CN':locale);
     await expect(page.locator('#character')).toHaveValue('团圆');
     await page.locator('#tab-0').click(); await expect(page.getByLabel(t('直径'),{exact:true})).toBeVisible();
     await page.locator('#tab-1').click(); await expect(page.locator('.front-choices .choice')).toHaveCount(10);
     await expect(page.locator('.front-choices')).toContainText(t('花好月圆'));
     await page.locator('#tab-2').click();
     for(const invalid of ['团圆福','ABCDEF','福A','你好😊']) {await page.locator('#character').fill(invalid);await expect(page.locator('.purchase-button')).toBeDisabled();await expect(page.locator('[role=alert]')).toHaveText(t('请输入最多 2 个汉字或 5 个英文字母，请勿混用。'));}
     await page.locator('#character').fill('HELLO');await expect(page.locator('.purchase-button')).toBeEnabled();
     await page.getByRole('button',{name:t('环形排列'),exact:true}).click();await expect(page.getByRole('button',{name:t('环形排列'),exact:true})).toHaveAttribute('aria-pressed','true');
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${locale} ${width} overflow`);
     await page.screenshot({path:`${qa}/language-${locale}-${width}.png`,fullPage:true});
     await page.locator('.purchase-button').click();await expect(page.getByRole('dialog')).toContainText(t('待商家确认 · 未付款'));
     await page.getByRole('button',{name:t('关闭弹窗'),exact:true}).click();
     await page.locator('.admin-button').click();await page.getByRole('button',{name:t('导入 Fusion'),exact:false}).click();await expect(page.getByRole('dialog')).toContainText(t('镜像凹纹 · 压出正向凸字 · M8 盲孔'));
     assert.ok(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
     await page.getByRole('button',{name:t('关闭弹窗'),exact:true}).click();
     // UI may show Chinese engraving presets, but other English/French UI must be translated.
     if(['en','fr'].includes(locale)) {
       const untranslated=await page.evaluate(()=>{const walker=document.createTreeWalker(document.querySelector('.app-shell'),NodeFilter.SHOW_TEXT),bad=[];while(walker.nextNode()){const n=walker.currentNode,p=n.parentElement;if(p.closest('.language-selector,.character-presets'))continue;if(p.getClientRects().length&&/[\u4e00-\u9fff]/.test(n.textContent))bad.push(n.textContent);}return bad;});
       assert.deepEqual(untranslated,[],`${locale} untranslated text`);
     }
     await page.locator('#character').fill('团圆'); await expect(page.locator('.text-layout')).toHaveCount(0);
   }
 }
 // Locale persists independently; changing it does not mutate the saved design or layout.
 await page.locator('#character').fill('HELLO');await page.getByRole('button',{name:tr('ja','环形排列'),exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mooncake.design.v1')).text.layout)).toBe('circular');
 const saved=await page.evaluate(()=>localStorage.getItem('mooncake.design.v1'));
 await page.locator('#language').selectOption('fr');await page.reload();await expect(page.locator('#language')).toHaveValue('fr');await page.locator('#tab-2').click();await expect(page.locator('#character')).toHaveValue('HELLO');await expect(page.getByRole('button',{name:'Circulaire',exact:true})).toHaveAttribute('aria-pressed','true');
 const before=JSON.parse(saved),after=JSON.parse(await page.evaluate(()=>localStorage.getItem('mooncake.design.v1')));delete before.createdAt;delete after.createdAt;assert.deepEqual(after,before);
 await page.locator('.admin-button').click();let waiting=page.waitForEvent('download');await page.getByRole('button',{name:tr('fr','导出设计 JSON'),exact:false}).click();const download=await waiting;await download.saveAs(qa+'/english-circular.json');
 await page.getByLabel(tr('fr','导入设计文件'),{exact:true}).setInputFiles(qa+'/english-circular.json');await expect(page.locator('#character')).toHaveValue('HELLO');
 assert.deepEqual(errors,[]);
 for(const [key,values]of Object.entries(MESSAGES)){assert.equal(values.length,3,key);assert.ok(values.every(v=>v.length>0),key);}
 console.log(`PASS: ${geometryResult.rows.length} real-font geometry cases; four locales at desktop/mobile; limits, circular text, holes, persistence, JSON round trip.`);
} finally {await browser.close();}
