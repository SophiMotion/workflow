import {searchDocuments} from './search.mjs';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
let library, renderVersion = 0, observer, localOnly = false;
const input = $('search-input');
const route = () => location.hash.replace(/^#\/?/,'').split('?')[0];
const docById = id => library.documents.find(d=>d.id===id);
const categoryById = id => library.categories.find(c=>c.id===id);
const external = (url,label,cls='') => `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
const footer = () => `<div class="footer-note">目录依据${external(library.sourceUrl,esc(library.sourceTitle))}整理。已保存教材来自已核实的公开项目，各项目许可见正文来源。<a href="#/about">查看来源与收录范围</a></div>`;

function closeMenu(){ $('sidebar').classList.remove('open');$('scrim').hidden=true;$('menu-toggle').setAttribute('aria-expanded','false'); }
$('menu-toggle').addEventListener('click',()=>{const open=!$('sidebar').classList.contains('open');$('sidebar').classList.toggle('open',open);$('scrim').hidden=!open;$('menu-toggle').setAttribute('aria-expanded',String(open));});
$('scrim').addEventListener('click',closeMenu);
document.addEventListener('keydown', event=>{
  if (((event.metaKey || event.ctrlKey)&&event.key.toLowerCase()==='k') || (event.key==='/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName))) { event.preventDefault();input.focus(); }
  if (event.key==='Escape') {closeMenu();if(input.value){input.value='';input.blur();render();}}
});
input.addEventListener('input',()=>{clearTimeout(input.searchTimer);input.searchTimer=setTimeout(()=>renderSearch(),120);});
document.addEventListener('click',event=>{
  const link=event.target.closest('a');
  if(link?.classList.contains('skip-link')){event.preventDefault();$('main').focus();$('main').scrollIntoView();return;}
  if (link?.getAttribute('href')?.startsWith('#/')) {input.value='';closeMenu();if(link.hash===location.hash)render();}
  const jump=event.target.closest('[data-jump]');
  if(jump){event.preventDefault();document.getElementById(jump.dataset.jump)?.scrollIntoView({behavior:'smooth',block:'start'});}
});
window.addEventListener('hashchange',()=>{input.value='';closeMenu();render();});

function navigation(){
  const active=route(),doc=active.startsWith('doc/')?docById(active.split('/')[1]):null;
  let html=`<a class="nav-link ${!active?'active':''}" href="#/"><span class="nav-icon">▦</span><span class="nav-label">知识库总览</span></a><div class="nav-divider"></div>`;
  for(const category of library.categories){
    const selected=active===`category/${category.id}` || doc?.category===category.id;
    const count=library.documents.filter(d=>d.category===category.id).length;
    html+=`<a class="nav-link ${selected?'active':''}" href="#/category/${category.id}" ${selected?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${esc(category.symbol)}</span><span class="nav-label">${esc(category.title)}</span>${count?`<span class="nav-count">${count}</span>`:''}</a>`;
    if(doc && category.id===doc.category){html+=`<div class="nav-children">${library.documents.filter(d=>d.category===category.id).map(d=>`<a class="nav-link ${d.id===doc.id?'active':''}" href="#/doc/${d.id}" ${d.id===doc.id?'aria-current="page"':''}>${esc(d.title)}</a>`).join('')}</div>`;}
  }
  $('navigation').innerHTML=html;
  $('category-count').textContent=library.categories.length;
}
function railOverview(){
  $('right-rail').innerHTML=`<p class="rail-title">本页内容</p><a class="rail-link" href="#learning" data-jump="learning">系统学习 · AI Agent</a><a class="rail-link" href="#topics" data-jump="topics">专题目录</a><div class="rail-rule"></div><p class="rail-title">本地收录</p><div class="rail-stat"><strong class="rail-number">${library.stats.documents}<span style="font-size:13px;margin-left:5px">篇</span></strong>公开教材正文</div><div class="rail-stat"><strong class="rail-number">${library.stats.images}<span style="font-size:13px;margin-left:5px">张</span></strong>已保存配图</div><p class="rail-note">整理于 ${library.collectedAt}<br>${library.stats.categoriesWithContent || 1} 个栏目已有正文，<br>尚未完成全库迁移。</p><a class="rail-link" href="#/about">查看收录说明 ↗</a>`;
}
function chapterRow(doc){
  return `<a class="chapter-row" href="#/doc/${doc.id}"><span class="chapter-number">${String(doc.order).padStart(2,'0')}</span><div class="chapter-info"><div class="chapter-name">${esc(doc.title.replace(/^第[一二三四五六七八九十]+章\s*/,''))}</div><div class="chapter-summary">${esc(doc.summary)}</div></div><span class="chapter-state">${doc.missingImages.length||doc.unsavedMedia?.length?'正文已存':'可离线阅读'}</span>${arrow}</a>`;
}
function learningSections(){
  return library.parts.map((part,index)=>{
    const docs=library.documents.filter(d=>d.part===index+1);
    return `<section><div class="section-heading"><span class="section-index">${String(index+1).padStart(2,'0')}</span><h2>${esc(part)}</h2><span>${docs.length} 篇</span></div><div class="chapter-list">${docs.map(chapterRow).join('')}</div></section>`;
  }).join('');
}
function overview(){
  document.title='AI 产品经理知识库 · 本地';
  $('breadcrumb').innerHTML='知识库 <span aria-hidden="true"> / </span> <b>总览</b>';
  $('main').innerHTML=`<div class="home-heading"><h1>AI 产品经理知识库</h1><p class="lead">从智能体基础到产品实践，按主题阅读、查找和积累。<br>从左侧目录进入专题，或从下面的系统课程开始。</p><div class="collection-meta"><span><span class="local-dot"></span><strong>${library.stats.documents}</strong> 篇公开教材已保存</span><span><strong>${library.stats.categories}</strong> 个原库栏目</span><span>更新 ${library.collectedAt}</span></div></div><section id="learning"><div class="section-heading"><h2>系统学习 · AI Agent</h2><span>Hello-Agents</span></div><p class="section-intro">对应原库「从 0 开始学习 AI Agent」主线。以下为 Datawhale 公开原始版本。</p>${learningSections()}</section><section id="topics"><div class="section-heading"><h2>专题目录</h2><span>来自原知识库</span></div><p class="section-intro">按栏目浏览已存正文和原库目录；每个栏目会显示当前收录范围。</p><div class="catalog-grid">${library.categories.filter(c=>c.id!=='agent-course').map(c=>`<a class="catalog-item" href="#/category/${c.id}"><span class="nav-icon" aria-hidden="true">${esc(c.symbol)}</span><span>${esc(c.title)}</span><small>${library.documents.some(d=>d.category===c.id)?'已有本地正文':'仅目录'}</small></a>`).join('')}</div></section>${footer()}`;
  railOverview();
}
function collectionSections(docs){
  const groups=new Map();
  for(const doc of docs){const title=doc.group||doc.collectionName||'已保存正文';if(!groups.has(title))groups.set(title,[]);groups.get(title).push(doc);}
  return [...groups].map(([title,items])=>`<section><div class="section-heading"><h2>${esc(title)}</h2><span>${items.length} 篇</span></div><div class="chapter-list">${items.map(chapterRow).join('')}</div></section>`).join('');
}
function categoryPage(id){
  const category=categoryById(id);
  if(!category){notFound();return;}
  document.title=`${category.title} · AI 产品经理知识库`;
  $('breadcrumb').innerHTML=`<a href="#/">知识库</a> / <b>${esc(category.title)}</b>`;
  if(id==='agent-course'){
    $('main').innerHTML=`<div class="home-heading"><h1>${esc(category.title)}</h1><p class="lead">原库主线课程，共 15 章。保存 Datawhale 公开原始版本，正文与配图可在本地阅读。</p></div>${learningSections()}${footer()}`;
  }else{
    const saved=library.documents.filter(doc=>doc.category===id);
    const related=category.related.map(docById).filter(Boolean);
    const verified=(library.sourceLinks||[]).filter(record=>record.category===id);
    const sourceList=verified.length ? `<div class="section-heading"><h2>已核实的原文链接</h2><span>${verified.length} 篇</span></div><p class="section-intro">目前仅保存标题和来源链接，正文尚未导入；点击后在飞书阅读。</p>${verified.map(record=>external(record.sourceUrl,`<div class="result-type">${esc(record.parent||'原库文章')} · 正文未导入</div><h2>${esc(record.title)}</h2>`,'search-result')).join('')}` : '';
    $('main').innerHTML=`<h1>${esc(category.title)}</h1><div class="collection-meta"><span class="status-label">${saved.length?'部分收录':'仅目录'}</span><span>${saved.length?`${saved.length} 篇公开原始正文已保存`:'正文尚未导入'}</span></div>${saved.length?`<div class="notice">已保存 ${esc([...new Set(saved.map(d=>d.collectionName))].join('、'))} 公开原始教材。本栏目其他文章尚未完成迁移；公开版本与飞书版本可能存在差异。</div>${collectionSections(saved)}`:`<div class="empty-state"><h2>这个栏目还没有本地正文</h2><p>已保留原库栏目名称。其子目录、文章和附件尚未完整核验，暂不能离线阅读本栏目的原始内容。</p>${external(category.sourceUrl || library.sourceUrl,'查看飞书原库目录 ↗','button secondary')}</div>`}${sourceList}${related.length?`<div class="section-heading"><h2>已收录的相关教材</h2><span>${related.length} 篇</span></div><p class="section-intro">以下内容来自 AI Agent 主线，便于延伸阅读；不代表上方栏目已迁移。</p><div class="chapter-list">${related.map(chapterRow).join('')}</div>`:''}${footer()}`;
  }
  railOverview();
}
async function articlePage(id,version){
  const doc=docById(id);if(!doc){notFound();return;}
  const category=categoryById(doc.category);
  document.title=`${doc.title} · AI 产品经理知识库`;
  $('breadcrumb').innerHTML=`<a href="#/">知识库</a> / <a href="#/category/${doc.category}">${esc(category.title)}</a> / <b>${String(doc.order).padStart(2,'0')}</b>`;
  $('main').innerHTML=`<h1 class="article-title">${esc(doc.title)}</h1><div class="article-meta"><span class="status-label">公开原始版本</span><span>${esc(doc.author)}</span><span>${Math.ceil(doc.chars/600)} 分钟阅读</span><span>${doc.imageCount} 张配图</span></div><div class="article-origin">本文保存自${external(doc.originalUrl,'公开教材')}，与${external(doc.sourceUrl,esc(doc.sourceLinkLabel||'飞书版本'))}可能存在差异。${external(doc.licensePath || 'data/LICENSE-hello-agents.txt',esc(doc.license))} · ${doc.retrievedAt} 收录${doc.missingImages.length?`<br>有 ${doc.missingImages.length} 个图片引用未保存，正文中已标注。`:''}${doc.unsavedMedia?.length?`<br>另有 ${doc.unsavedMedia.length} 个视频或音频引用尚未保存，可通过公开教材入口查看。`:''}</div><div id="article-body" class="article-body"><p class="loading">正在加载正文…</p></div><div id="pagination"></div>`;
  $('right-rail').innerHTML=`<p class="rail-title">文章目录</p>${doc.toc.filter(t=>t.depth===2||t.depth===3).map(t=>`<a class="rail-link depth-${t.depth}" href="#${t.id}" data-jump="${t.id}">${esc(t.title)}</a>`).join('')}<div class="rail-rule"></div><p class="rail-note">版本 ${doc.commit.slice(0,8)}<br>${doc.missingImages.length||doc.unsavedMedia?.length?'正文已保存；资源缺失见来源说明。':'正文与所收录配图保存在本机。'}</p>`;
  try{
    const response=await fetch(doc.article);if(!response.ok)throw new Error('正文文件不可用');
    const html=await response.text();if(version!==renderVersion)return;
    $('article-body').innerHTML=html;
    for(const table of $('article-body').querySelectorAll('table')){const wrapper=document.createElement('div');wrapper.className='table-scroll';wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label','可横向滚动的表格');table.before(wrapper);wrapper.append(table);}
    for(const a of $('article-body').querySelectorAll('a[href^="#"]')){
      if(a.getAttribute('href').startsWith('#/'))continue;
      const old=a.getAttribute('href').slice(1);
      const target=doc.toc.find(t=>t.id===old || t.title===decodeURIComponent(old) || t.title.toLowerCase().replace(/\s+/g,'-')===decodeURIComponent(old));
      if(target){a.dataset.jump=target.id;}else{a.removeAttribute('href');a.title='原文内部锚点未匹配';}
    }
    const previous=library.documents.find(d=>d.collection===doc.collection && d.order===doc.order-1),next=library.documents.find(d=>d.collection===doc.collection && d.order===doc.order+1);
    $('pagination').innerHTML=`<nav class="pagination" aria-label="上一篇与下一篇">${previous?`<a href="#/doc/${previous.id}"><small>← 上一篇</small>${esc(previous.title)}</a>`:''}${next?`<a href="#/doc/${next.id}"><small>下一篇 →</small>${esc(next.title)}</a>`:''}</nav>${footer()}`;
    observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){document.querySelectorAll('.right-rail .rail-link').forEach(a=>a.classList.toggle('active',a.dataset.jump===entry.target.id));}}},{rootMargin:'-90px 0px -60% 0px'});
    $('article-body').querySelectorAll('h2,h3').forEach(h=>observer.observe(h));
  }catch(error){if(version!==renderVersion)return;$('article-body').innerHTML='<div class="notice">本地正文文件无法打开。请重新运行构建，或先通过上方来源链接阅读。</div>';}
}
function about(){
  document.title='收录说明 · AI 产品经理知识库';
  $('breadcrumb').innerHTML='<a href="#/">知识库</a> / <b>收录说明</b>';
  const sources=(library.sources||[]).map(source=>`<section><div class="section-heading"><h2>${esc(source.name)}</h2><span>${source.documents} 篇</span></div><p class="lead">${esc(source.author)}</p><p>${external(source.repository,'公开原仓库')} · ${external(source.readmePath,'原始说明与贡献者')} · ${external(source.licensePath,esc(source.license))}</p><p class="article-origin">版本 ${esc(source.commit)}<br>${esc(source.retrievedAt)} 收录${source.sourceRelationship?'<br>'+esc(source.sourceRelationship):''}</p></section>`).join('');
  $('main').innerHTML=`<h1>来源与收录说明</h1><p class="lead">这里记录实际保存了什么，以及哪些内容仍需补齐。</p><div class="notice">${esc(library.scope)}</div><table class="source-table"><tbody><tr><td>原知识库</td><td>${external(library.sourceUrl,esc(library.sourceTitle))}</td></tr><tr><td>目录范围</td><td>${library.stats.categories} 个已核实的侧栏条目；全库子目录尚未遍历完成。</td></tr><tr><td>本地正文</td><td>${library.stats.documents} 篇公开原始教材，覆盖 ${library.stats.categoriesWithContent} 个栏目。不是飞书文档的逐字副本。</td></tr><tr><td>图片</td><td>${library.stats.images} 张已保存，${library.stats.missingImages} 个图片引用未保存。</td></tr><tr><td>视频与音频</td><td>${library.stats.media||0} 个文件已保存，${library.stats.unsavedMedia||0} 个已识别引用尚未保存。</td></tr><tr><td>其他原文入口</td><td>${library.stats.verifiedArticleLinks} 个已核实链接，正文尚未导入。</td></tr><tr><td>处理方式</td><td>Markdown 转换为 HTML；调整排版、图片路径、标题锚点和文章链接。图片按原始文档链接保存。正文中的项目代码、外部数据集和视频链接不等于已部署的程序或本地附件。</td></tr><tr><td>保存位置</td><td>当前项目的 content/ 与 site/ 文件夹，站点只在本机运行。</td></tr><tr><td>检查记录</td><td>${external('data/import-report.json','查看机器可读的收录清单')}</td></tr></tbody></table>${sources}<div class="section-heading"><h2>条目状态</h2></div><p class="lead">「公开原始版本」表示已保存对应公开教材，可搜索正文；「部分收录」表示栏目中有本地内容，但并未迁完；「仅目录」不包含原栏目正文。缺失配图在文章内显示提示。</p>${footer()}`;
  railOverview();
}
function notFound(){document.title='未找到内容 · AI 产品经理知识库';$('main').innerHTML='<div class="empty-state"><h1>没有找到这个页面</h1><p>该地址不在当前本地知识库中。可以返回目录，或用上方搜索查找内容。</p><a class="button" href="#/">回到知识库</a></div>';$('right-rail').innerHTML='';}
function highlight(text,terms){
  const clean=String(text);const pattern=terms.filter(Boolean).map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  if(!pattern)return esc(clean);const expression=new RegExp(`(${pattern})`,'gi');return clean.split(expression).map((part,index)=>index%2?`<mark>${esc(part)}</mark>`:esc(part)).join('');
}
function renderSearch(){
  if(!library)return;const query=input.value.trim();if(!query){render();return;}
  renderVersion++;observer?.disconnect();document.title=`搜索 ${query} · AI 产品经理知识库`;
  $('breadcrumb').innerHTML='<a href="#/">知识库</a> / <b>搜索</b>';
  const results=searchDocuments(library.documents,query,{localOnly});
  const categories=localOnly?[]:library.categories.filter(c=>c.title.toLowerCase().includes(query.toLowerCase()));
  const terms=query.split(/\s+/);
  $('main').innerHTML=`<h1>搜索知识库</h1><p class="lead">搜索已保存的教材正文、章节主题和栏目名称。</p><div class="search-controls"><span>“${esc(query)}” · ${results.length+categories.length} 条结果</span><label><input type="checkbox" id="local-only" ${localOnly?'checked':''}>只看已存正文</label></div>${results.map(({doc,snippet})=>`<a class="search-result" href="#/doc/${doc.id}"><div class="result-type">${esc(doc.collectionName||categoryById(doc.category)?.title)} · 公开原始版本</div><h2>${highlight(doc.title,terms)}</h2><p>${highlight(snippet,terms)}</p></a>`).join('')}${categories.map(c=>`<a class="search-result" href="#/category/${c.id}"><div class="result-type">栏目 · ${library.documents.some(d=>d.category===c.id)?'已有本地正文':'仅目录'}</div><h2>${highlight(c.title,terms)}</h2><p>${library.documents.some(d=>d.category===c.id)?'查看已收录的本地正文。':'此栏目正文尚未导入，可查看来源或相关教材。'}</p></a>`).join('')}${!results.length&&!categories.length?'<div class="empty-state"><h2>没有匹配的内容</h2><p>试试更短的关键词，例如“记忆”“提示词”或“MCP”。未收录的正文不会出现在全文搜索结果中。</p></div>':''}`;
  $('local-only').addEventListener('change',event=>{localOnly=event.target.checked;renderSearch();});
  $('right-rail').innerHTML='<p class="rail-title">搜索提示</p><p class="rail-note">中文与英文均可搜索。<br>多个关键词用空格分隔。<br><br>搜索完全在本机完成。<br>按 Esc 返回阅读。</p>';
}
async function render(){
  if(!library)return;const version=++renderVersion;observer?.disconnect();window.scrollTo(0,0);navigation();
  const current=route();if(!current)overview();else if(current==='about')about();else if(current.startsWith('category/'))categoryPage(current.slice(9));else if(current.startsWith('doc/'))await articlePage(current.slice(4),version);else notFound();
}
try{
  const response=await fetch('data/catalog.json');if(!response.ok)throw new Error('目录无法读取');library=await response.json();
  $('source-top').href=library.sourceUrl;await render();
}catch(error){$('main').innerHTML='<div class="empty-state"><h1>暂时无法打开知识库</h1><p>请使用项目中的「启动知识库.command」启动本地服务，再访问 http://127.0.0.1:4174。直接双击 HTML 文件无法加载文章。</p></div>';}
