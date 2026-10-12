import './bom.css';
import {studioBrand,workflowButton,bindWorkflowNavigation} from './studio-navigation';
import {exampleBom,lineTotalFen,totalFen,bomCsv,type BomRow} from './bom-data';
import {matchesBomRow,numericError,stepQuantity} from './bom-controls';
import {defaults,parseConfig,type Params} from './parameters';
import {defaultMotors,parseMotors} from './motors';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const currency=new Intl.NumberFormat('en-CN',{style:'currency',currency:'CNY',currencyDisplay:'symbol'});
const money=(fen:number)=>currency.format(fen/100);
let params:Params={...defaults};let motors=defaultMotors(),source='Example configuration';
try{const key='sophi-bom-source:'+location.hash.slice(1),raw=localStorage.getItem(key)||sessionStorage.getItem(key);if(raw){const c=JSON.parse(raw);params=parseConfig(c,c.sourceSha256);motors=parseMotors(c.motors);sessionStorage.setItem(key,raw);localStorage.removeItem(key);source='Snapshot of your configurator';}}catch{source='Default examples (configuration snapshot unavailable)';}
let rows=exampleBom(params,motors);
const groups=[...new Set(rows.map(r=>r.group))],collapsed=new Set<string>();
let undo:{rows:BomRow[];drafts:Map<string,string>}|undefined;
let drafts=new Map<string,string>();
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
document.querySelector('#bom-app')!.innerHTML=`<header>${studioBrand()}<span class="project">SophiRobot</span><span class="page-marker">Bill of materials</span>${workflowButton()}</header>
<main><div class="page-heading"><div><p class="eyebrow">SOPHIROBOT / PROCUREMENT</p><h1>Bill of materials</h1><p class="intro">Plan your parts. Adjust quantities. Track your estimate.</p></div><div class="actions"><button id="reset-bom">Reset examples</button><button id="export-bom" class="primary">Download CSV ↓</button></div></div>
<div class="notice"><strong>Example estimate · CNY</strong><span>Illustrative materials and prices. Tax, shipping and assembly are excluded.</span></div>
<section class="summary" aria-label="BOM summary"><div><span>Total estimate · CNY</span><strong id="grand-total"></strong></div><div><span>Line items</span><strong>${rows.length}</strong></div><div><span>Categories</span><strong>${groups.length}</strong></div></section>
<div class="table-toolbar"><label class="search">Search parts or materials<input type="search" id="search" placeholder="Try steel, shoulder, tube…"></label><label>Category<select id="category"><option value="">All categories</option>${groups.map(g=>`<option>${g}</option>`).join('')}</select></label><button id="expand-all">Expand all</button><button id="collapse-all">Collapse all</button></div>
<div class="table-meta"><span id="result-count" role="status"></span><span>Edit materials, quantities and unit prices directly.</span></div>
<div id="reset-status" class="undo-bar" hidden><span role="status">Example values restored.</span><button id="undo-reset">Undo reset</button></div>
<p id="bom-error" role="alert" hidden></p>
<div class="table-wrap" tabindex="0" aria-label="Scrollable bill of materials"><table><caption class="sr-only">Editable SophiRobot example bill of materials, priced in Chinese yuan.</caption><thead><tr><th scope="col">Part / component</th><th scope="col">Material / specification</th><th scope="col">Quantity</th><th scope="col">Unit price · CNY</th><th scope="col">Amount · CNY</th></tr></thead>${groups.map((g,n)=>`<tbody><tr class="group-heading" id="group-heading-${n}"><th colspan="5"><button data-toggle="${n}" aria-expanded="true" aria-controls="group-${n}"><span class="chevron">▾</span><strong>${g}</strong><span id="group-count-${n}" class="group-count"></span><span id="group-total-${n}" class="group-total"></span></button></th></tr></tbody><tbody id="group-${n}"></tbody>`).join('')}</table><div id="empty" hidden><strong>No matching parts</strong><p>Try a different search or category.</p><button id="clear-filters">Clear filters</button></div></div>
<div class="total-bar"><div><strong>Total estimate <small>· CNY</small></strong><span>All ${rows.length} line items, including hidden rows</span></div><strong id="footer-total"></strong></div>
<footer>${esc(source)} · Edits stay in this window; download CSV to keep them.<br>Example prices only, not a supplier quotation or verified parts list. Changing this estimate does not change the 3D model.</footer></main>`;
bindWorkflowNavigation();

function validRow(r:BomRow){return !numericError('quantity',r.quantity)&&!numericError('unitPrice',r.unitPrice);}
function estimate(items:BomRow[]){return items.every(validRow)?money(totalFen(items)):'Check values';}
function update(){
 let invalid=0;
 rows.forEach((r,i)=>{
  $('#amount-'+i).textContent=validRow(r)?money(lineTotalFen(r)):'—';
  for(const key of ['quantity','unitPrice'] as const){
   const error=numericError(key,r[key]),input=$<HTMLInputElement>(`#${key}-${i}`);
   input.setAttribute('aria-invalid',String(!!error));
   $(`#${key}-error-${i}`).textContent=error;
   $(`#${key}-error-${i}`).hidden=!error;
   if(error)invalid++;
  }
  $<HTMLButtonElement>(`#minus-${i}`).disabled=Number.isFinite(r.quantity)&&r.quantity<=0;
  $<HTMLButtonElement>(`#plus-${i}`).disabled=Number.isFinite(r.quantity)&&r.quantity>=100000;
 });
 $('#bom-error').hidden=!invalid;
 $('#bom-error').textContent=`${invalid} field${invalid===1?' needs':'s need'} attention. Check quantities and prices; errors may be in collapsed or filtered categories.`;
 $('#export-bom').toggleAttribute('disabled',!!invalid);
 $('#grand-total').textContent=$('#footer-total').textContent=estimate(rows);
 groups.forEach((g,n)=>{$('#group-total-'+n).textContent=estimate(rows.filter(r=>r.group===g));});
}
function render(){
 groups.forEach((g,n)=>{
  $('#group-'+n).innerHTML=rows.map((r,i)=>r.group!==g?'':`<tr id="row-${i}"><th scope="row"><span class="item-name">${esc(r.item)}</span><span class="part-id">${esc(r.id)}</span></th><td data-label="Material"><textarea data-row="${i}" data-key="material" rows="2" maxlength="500" aria-label="Material for ${esc(r.item)}">${esc(r.material)}</textarea></td><td data-label="Quantity"><div class="quantity"><button id="minus-${i}" data-step="-1" data-row="${i}" aria-label="Decrease quantity for ${esc(r.item)}">−</button><input id="quantity-${i}" data-row="${i}" data-key="quantity" type="number" min="0" max="100000" step="1" aria-label="Quantity for ${esc(r.item)}" aria-describedby="quantity-error-${i}"><button id="plus-${i}" data-step="1" data-row="${i}" aria-label="Increase quantity for ${esc(r.item)}">+</button></div><span class="unit">${esc(r.unit)}</span><span class="field-error" id="quantity-error-${i}" hidden></span></td><td data-label="Unit price · CNY"><div class="price"><span>¥</span><input id="unitPrice-${i}" data-row="${i}" data-key="unitPrice" type="number" min="0" max="10000000" step="0.01" aria-label="Unit price in CNY for ${esc(r.item)}" aria-describedby="unitPrice-error-${i}"></div><span class="field-error" id="unitPrice-error-${i}" hidden></span></td><td data-label="Amount · CNY" id="amount-${i}" class="amount"></td></tr>`).join('');
 });
 rows.forEach((r,i)=>{for(const key of ['quantity','unitPrice'] as const)$<HTMLInputElement>(`#${key}-${i}`).value=drafts.get(`${key}-${i}`)??(Number.isFinite(r[key])?(key==='unitPrice'?r[key].toFixed(2):String(r[key])):'');});
 document.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('[data-key]').forEach(input=>input.oninput=()=>{
  const i=Number(input.dataset.row),key=input.dataset.key as 'quantity'|'unitPrice'|'material';
  if(key==='material')rows[i].material=input.value;
  else{drafts.set(`${key}-${i}`,input.value);rows[i][key]=input.value.trim()===''?NaN:Number(input.value);}
  update();
 });
 document.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(button=>button.onclick=()=>{
  const i=Number(button.dataset.row);rows[i].quantity=stepQuantity(rows[i].quantity,Number(button.dataset.step));
  drafts.delete(`quantity-${i}`);$<HTMLInputElement>(`#quantity-${i}`).value=String(rows[i].quantity);update();
 });
 update();filter();
}
function filter(){
 const query=$<HTMLInputElement>('#search').value,category=$<HTMLSelectElement>('#category').value;
 let count=0;
 groups.forEach((g,n)=>{
  const matches=rows.map((r,i)=>({r,i})).filter(({r})=>r.group===g&&matchesBomRow(r,query,category));count+=matches.length;
  $('#group-heading-'+n).hidden=!matches.length;$('#group-'+n).hidden=collapsed.has(g)||!matches.length;
  rows.forEach((r,i)=>{if(r.group===g)$('#row-'+i).hidden=!matches.some(m=>m.i===i);});
  $('#group-count-'+n).textContent=`${matches.length} / ${rows.filter(r=>r.group===g).length} items`;
  const button=$<HTMLButtonElement>(`[data-toggle="${n}"]`);button.setAttribute('aria-expanded',String(!collapsed.has(g)));button.querySelector('.chevron')!.textContent=collapsed.has(g)?'▸':'▾';
 });
 $('#result-count').textContent=`${count} of ${rows.length} line items match · Category totals include all items`;
 $('#empty').hidden=count!==0;
}
$('#search').oninput=filter;$('#category').onchange=filter;
document.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach(button=>button.onclick=()=>{const g=groups[Number(button.dataset.toggle)];if(collapsed.has(g))collapsed.delete(g);else collapsed.add(g);filter();});
$('#expand-all').onclick=()=>{collapsed.clear();filter();};
$('#collapse-all').onclick=()=>{groups.forEach(g=>collapsed.add(g));filter();};
$('#clear-filters').onclick=()=>{$<HTMLInputElement>('#search').value='';$<HTMLSelectElement>('#category').value='';filter();$('#search').focus();};
$('#reset-bom').onclick=()=>{undo={rows:rows.map(r=>({...r})),drafts:new Map(drafts)};rows=exampleBom(params,motors);drafts.clear();render();$('#reset-status').hidden=false;};
$('#undo-reset').onclick=()=>{if(!undo)return;rows=undo.rows;drafts=undo.drafts;undo=undefined;render();$('#reset-status').hidden=true;$('#reset-bom').focus();};
$('#export-bom').onclick=()=>{if(!rows.every(validRow))return;const url=URL.createObjectURL(new Blob([bomCsv(rows)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='SophiRobot-BOM-CNY.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
render();
