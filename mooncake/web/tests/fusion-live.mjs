import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const qa='/private/tmp/mooncake-qa'; await mkdir(qa,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1536,height:1024}}), errors=[], responses=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',async r=>{if(r.url().startsWith('http://127.0.0.1:19876/')&&r.request().method()!=='OPTIONS') {const reply=await r.json(); if(reply.state==='complete'||reply.state==='failed') responses.push(reply);}});
 await page.goto(process.env.MOONCAKE_URL || 'http://127.0.0.1:5173/');
 for(const [label,value] of [['直径数值','68'],['厚度数值','26']]){await page.getByLabel(label,{exact:true}).fill(value);await page.getByLabel(label,{exact:true}).press('Tab');}
 await page.getByRole('tab',{name:'文字',exact:true}).click();await page.getByLabel('内部文字',{exact:true}).fill(process.env.MOONCAKE_TEXT || '金');await page.getByLabel('文字大小数值',{exact:true}).fill('18');await page.getByLabel('文字大小数值',{exact:true}).press('Tab');
 if(process.env.MOONCAKE_LAYOUT==='circular') await page.getByRole('button',{name:'环形排列',exact:true}).click();
 await page.getByRole('tab',{name:'正面',exact:true}).click();await page.getByRole('button',{name:process.env.MOONCAKE_PATTERN || '莲珠团花',exact:true}).click();
 await page.getByLabel('花纹数量数值',{exact:true}).fill(process.env.MOONCAKE_COUNT || '12');await page.getByLabel('花纹数量数值',{exact:true}).press('Tab');
 await page.getByLabel('花纹直径数值',{exact:true}).fill('56');await page.getByLabel('花纹直径数值',{exact:true}).press('Tab');
 const box=await page.locator('.purchase-button').boundingBox();assert.ok(box.y+box.height<1024,JSON.stringify(box));
 await page.screenshot({path:qa+'/ten-patterns-final.png'});
 await page.getByRole('button',{name:'管理员',exact:true}).click();await page.getByRole('button',{name:'导入 Fusion',exact:false}).click();
 await page.screenshot({path:qa+'/fusion-import-confirmation.png'});
 console.log('Submitting live design to actual Fusion add-in');
 await page.getByRole('button',{name:'确认并导入 Fusion',exact:true}).click();
 await page.waitForFunction(()=>{const el=document.querySelector('.fusion-progress');return el?.classList.contains('success')||el?.classList.contains('error');},{},{timeout:600000});
 await expect(page.locator('.fusion-progress')).toContainText('F3D 已保存');
 await page.getByRole('button',{name:'管理员',exact:true}).click();await page.screenshot({path:qa+'/fusion-import-complete.png'});
 assert.deepEqual(errors,[]);assert.ok(responses.some(r=>r.state==='complete'&&r.filePath));
 await writeFile(qa+(process.env.MOONCAKE_RESULT || '/fusion-live-result.json'),JSON.stringify({passed:true,errors,result:responses.find(r=>r.state==='complete')},null,2));
 console.log('PASS real browser → loopback → Fusion custom event → cake and mold → F3D export');
} finally {await browser.close();}
