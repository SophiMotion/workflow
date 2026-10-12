import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.resolve(root,'../unit/js/views.js');
const source=fs.readFileSync(target,'utf8');
const marker='      <div class="workflow-rail engineering-rail">';
if(!source.includes(marker))throw Error('SophiStudio engineering rail not found. No files changed.');
const card=`
        <a class="workflow-card" data-module="skatechassis" data-status="ready" href="底盘机器人/dist/index.html">
          <div class="wf-icon"><span class="ms">smart_toy</span></div>
          <div class="wf-copy"><h3>SkateChassis 机器人工作台</h3><p>参数设计、BOM 核价、报价、协作 PRD 与 ROS / Fusion 工程导出。</p><small>可直接使用 · 团队协作需项目服务</small></div>
        </a>`;
let updated=source.includes('data-module="skatechassis"')?source:source.replace(marker,marker+card);
updated=updated.replace('<strong>8</strong><span>/ 11 模块可用</span>','<strong>9</strong><span>/ 12 模块可用</span>');
if(updated!==source)fs.writeFileSync(target,updated);
console.log('SkateChassis entrance and module count verified: '+target);
