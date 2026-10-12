/* Local document reader and evidence-grounded consultations. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const { api, toast } = window.SophiFeishu;
  let connected = false, loaded = false, job = null, polling = false, submitting = false;
  let reader = null, readerTicket = 0, readerURLs = [], lastJobJSON = '';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  const labels = {running:'进行中',completed:'已完成',partial:'部分完成',failed:'失败',cancelled:'已取消',interrupted:'已中断',needs_context:'资料不足'};
  const running = () => submitting || job?.status === 'running';
  const scope = () => $('qa-scope').value ? [$('qa-scope').value] : [];

  function controls() {
    $('qa-submit').disabled = !connected || running();
    $('preview-sources').disabled = !connected || running();
    $('qa-cancel').hidden = job?.status !== 'running';
    $('qa-history').disabled = running();
    $('qa-scope').disabled = running();
  }

  // Sanitize and neutralize URLs BEFORE the fragment enters the live DOM.
  function markdown(text, { docKey, sources = [] } = {}) {
    const fragment = DOMPurify.sanitize(marked.parse(String(text), {gfm:true,breaks:false}), {
      RETURN_DOM_FRAGMENT:true, USE_PROFILES:{html:true}, SANITIZE_NAMED_PROPS:true,
      FORBID_TAGS:['style','form','input','button','textarea','iframe','object','embed','video','audio','source'],
      FORBID_ATTR:['style','srcset','autofocus'],
    });
    for (const image of fragment.querySelectorAll('img')) {
      const src = image.getAttribute('src') || '';
      const alt = image.alt || '图片';
      image.removeAttribute('src'); image.removeAttribute('srcset');
      const replacement = document.createElement('span'); replacement.textContent = '[' + alt + '：点击载入图片]';
      const asset = localAsset(src);
      if (docKey && asset && /\.(png|jpe?g|webp|gif|avif)$/i.test(asset)) {
        const button = document.createElement('button'); button.className='asset-image button text-button'; button.textContent=alt + ' · 载入图片';
        button.onclick = async () => {
          button.disabled = true;
          try {
            const blob = await api('asset?key='+encodeURIComponent(docKey)+'&path='+encodeURIComponent(asset), undefined, true);
            const mime = {png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',avif:'image/avif'}[asset.split('.').pop().toLowerCase()];
            const url = URL.createObjectURL(new Blob([blob],{type:mime})); readerURLs.push(url);
            const img = document.createElement('img'); img.alt=alt; img.src=url; button.replaceWith(img);
          } catch (error) { toast(error.message); button.disabled=false; }
        };
        image.replaceWith(button);
      } else { replacement.textContent='['+alt+'：图片未载入]'; image.replaceWith(replacement); }
    }
    for (const a of fragment.querySelectorAll('a')) {
      const href = a.getAttribute('href') || '';
      a.removeAttribute('href');
      const asset = localAsset(href);
      if (docKey && asset) {
        a.href='#'; a.onclick=event => { event.preventDefault(); downloadAsset(docKey,asset); };
      } else if (/^https?:\/\//i.test(href)) {
        a.href=href; a.target='_blank'; a.rel='noopener noreferrer';
      }
    }
    if (sources.length) {
      const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
      const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        if (node.parentElement?.closest('pre,code,a')) continue;
        const parts = node.textContent.split(/(\[S\d+\])/g);
        if (parts.length < 2) continue;
        const replacement = document.createDocumentFragment();
        for (const part of parts) {
          const source = sources.find(s => '['+s.id+']' === part);
          if (!source) { replacement.append(document.createTextNode(part)); continue; }
          const button=document.createElement('button'); button.className='citation-link'; button.textContent=part;
          button.title=source.title+' · 第 '+source.line_start+'–'+source.line_end+' 行';
          button.onclick=() => openDocument(source.key,source); replacement.append(button);
        }
        node.replaceWith(replacement);
      }
    }
    return fragment;
  }

  function localAsset(url) {
    try {
      const value=decodeURIComponent(url).replace(/^\.\//,'');
      return value.startsWith('assets/') && !value.split('/').some(p=>p==='.'||p==='..') && !value.includes('\\') ? value : null;
    } catch { return null; }
  }
  function download(blob, name) {
    const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  async function downloadAsset(key,path) {
    try { download(await api('asset?key='+encodeURIComponent(key)+'&path='+encodeURIComponent(path),undefined,true),path.split('/').pop()); }
    catch(error) { toast(error.message); }
  }
  function clearReader() { readerTicket++; reader=null; readerURLs.forEach(URL.revokeObjectURL); readerURLs=[]; }
  async function openDocument(key, citation) {
    clearReader(); const ticket=readerTicket;
    $('reader-title').textContent='正在读取文档…'; $('reader-meta').textContent='';
    $('reader-body').textContent=''; $('reader-warning').textContent=''; $('reader-raw').textContent='';
    $('reader-citation').hidden=true; $('reader-raw').hidden=true; $('reader-body').hidden=false;
    $('reader-mode').textContent='查看 Markdown'; $('reader-download').disabled=true; $('reader-mode').disabled=true;
    $('reader-source').hidden=true;
    if (!$('reader-dialog').open) $('reader-dialog').showModal();
    try {
      const value=await api('document?key='+encodeURIComponent(key));
      if (ticket!==readerTicket) return;
      reader=value;
      $('reader-title').textContent=value.title; $('reader-meta').textContent=value.space_name+' · '+value.path;
      const warnings=[...value.warnings];
      if (value.status==='missing') warnings.push('此文档当前在云端不可见，展示的是保留在本机的版本。');
      if (value.status==='conflict') warnings.push('此文档存在同步冲突，展示的是当前本地版本。');
      if (citation) {
        $('reader-citation').hidden=false;
        $('reader-citation-label').textContent='['+citation.id+'] 回答使用的片段 · 第 '+citation.line_start+'–'+citation.line_end+' 行';
        $('reader-excerpt').textContent=citation.text;
        if (citation.version!==value.version) warnings.push('文档在回答后已更新；上方保留回答当时的引用，下方为当前原文。');
      }
      $('reader-warning').textContent=warnings.join('；');
      $('reader-body').replaceChildren(markdown(value.content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,''),{docKey:key}));
      $('reader-raw').textContent=value.content;
      $('reader-source').href=value.source; $('reader-source').hidden=false;
      $('reader-download').disabled=false; $('reader-mode').disabled=false;
      $('reader-dialog').querySelector('.reader-scroll').scrollTop=0;
    } catch(error) { if(ticket===readerTicket) $('reader-body').textContent=error.message; }
  }
  $('reader-dialog').addEventListener('close',clearReader);
  $('reader-mode').onclick=()=>{ const raw=$('reader-raw').hidden; $('reader-raw').hidden=!raw; $('reader-body').hidden=raw; $('reader-mode').textContent=raw?'阅读预览':'查看 Markdown'; };
  $('reader-download').onclick=()=>reader && download(new Blob([reader.content],{type:'text/markdown;charset=utf-8'}),reader.title.replace(/[\\/:*?"<>|]/g,'-')+'.md');

  function sourceList(sources) {
    $('sources-summary').textContent='知识库依据 · '+sources.length+' 个片段';
    $('qa-sources').replaceChildren();
    for (const source of sources) {
      const article=document.createElement('article'); article.className='source-item';
      const button=document.createElement('button'); button.className='source-title';
      button.textContent='['+source.id+'] '+source.title; button.onclick=()=>openDocument(source.key,source);
      const meta=document.createElement('p'); meta.className='source-meta'; meta.textContent=source.space_name+' · 第 '+source.line_start+'–'+source.line_end+' 行'+(source.warnings.length?' · 存在导出提示':'');
      const detail=document.createElement('details'); const summary=document.createElement('summary'); summary.textContent='查看片段';
      const pre=document.createElement('pre');pre.textContent=source.text;detail.append(summary,pre);article.append(button,meta,detail);$('qa-sources').append(article);
    }
  }
  function renderJob(value) {
    job=value; controls();
    const serialized=JSON.stringify(value); if(serialized===lastJobJSON) return; lastJobJSON=serialized;
    $('qa-result').hidden=false; $('qa-question').textContent=value.question;
    $('qa-status').textContent=(labels[value.status]||value.status)+' · '+value.message;
    $('qa-status').classList.toggle('error',['failed','partial'].includes(value.status));
    $('qa-stages').innerHTML=[['international','01 国际视角'],['domestic','02 国内视角'],['synthesis','03 综合建议']].map(([id,name])=>`<span class="${esc(value.stages?.[id]||'waiting')}">${name} · ${esc(({running:'分析中',completed:'完成',failed:'失败'})[value.stages?.[id]]||(value.status==='running'?'等待':'未调用'))}</span>`).join('');
    for(const stage of ['international','domestic','synthesis']) {
      const answer=value.answers?.[stage]; $(''+stage+'-card').hidden=!answer;
      if(!answer) continue;
      $(stage+'-model').textContent=(answer.model||'')+(answer.seconds?' · '+answer.seconds+' 秒':'');
      if(answer.error) { $(stage+'-answer').textContent=answer.error; $(stage+'-warning').textContent='此阶段未完成。'; }
      else { $(stage+'-answer').replaceChildren(markdown(answer.text,{sources:value.sources})); $(stage+'-warning').textContent=(answer.warnings||[]).join('；'); }
      if(stage!=='synthesis' && ['partial','failed'].includes(value.status)) $(stage+'-card').open=true;
    }
    sourceList(value.sources||[]);
  }
  async function history() {
    const result=await api('qa/history');
    $('qa-history').innerHTML='<option value="">选择历史提问</option>'+result.jobs.map(j=>`<option value="${esc(j.id)}">${esc(labels[j.status])} · ${esc(j.question.slice(0,55))}</option>`).join('');
    if(job) $('qa-history').value=job.id;
    return result.jobs;
  }
  async function poll() {
    if(!connected||!job||job.status!=='running'||polling) return;
    polling=true;
    try { renderJob(await api('qa/job?id='+encodeURIComponent(job.id))); if(job.status!=='running') await history(); }
    catch(error) { $('qa-status').textContent='读取进度失败，稍后自动重试：'+error.message; }
    finally { polling=false; }
  }
  $('question-form').onsubmit=async event=>{
    event.preventDefault(); if(running())return;
    submitting=true; controls(); $('qa-status').textContent='正在提交问题…';
    try { renderJob(await api('qa/ask',{question:$('question-input').value.trim(),spaces:scope()})); await history(); }
    catch(error) { $('qa-status').textContent=error.message; }
    finally {submitting=false;controls();}
  };
  $('qa-cancel').onclick=async()=>{try{renderJob(await api('qa/cancel',{id:job.id}));await history();}catch(error){toast(error.message);}};
  $('qa-history').onchange=async()=>{if(!$('qa-history').value)return;try{renderJob(await api('qa/job?id='+encodeURIComponent($('qa-history').value)));}catch(error){toast(error.message);}};
  $('preview-sources').onclick=async()=>{
    const question=$('question-input').value.trim();if(question.length<3)return toast('请先输入项目名称和问题。');
    submitting=true;controls();$('qa-status').textContent='正在本地检索…';
    try {
      const result=await api('search?q='+encodeURIComponent(question)+scope().map(s=>'&space='+encodeURIComponent(s)).join(''));
      job=null;lastJobJSON='';$('qa-result').hidden=false;$('qa-question').textContent=question;
      for(const id of ['international','domestic','synthesis']) $(id+'-card').hidden=true;
      $('qa-stages').replaceChildren();sourceList(result.sources);$('sources-panel').open=true;
      $('qa-status').textContent=result.sources.length?'已检索到 '+result.sources.length+' 个片段，尚未调用模型。':'没有命中相关正文，请补充具体项目名称或关键术语。';
    }catch(error){$('qa-status').textContent=error.message;}finally{submitting=false;controls();}
  };

  $('ai-settings-open').onclick=async()=>{
    try {
      const config=await api('ai/config');
      for(const provider of ['openai','deepseek']) {
        $(provider+'-model').value=config[provider+'_model'];$(provider+'-key').value='';
        $(provider+'-config-status').textContent=config[provider+'_configured']?'已读取密钥 · '+config[provider+'_source']+'（有效性以调用结果为准）':'尚未配置 API Key';
        const check=config.checks.find(item=>item.provider===provider);
        if(check) $(provider+'-config-status').textContent+=' · '+check.message;
      }
      $('ai-settings-message').textContent='';$('ai-settings-dialog').showModal();
    }catch(error){toast(error.message);}
  };
  $('ai-settings-form').onsubmit=async event=>{
    event.preventDefault();const button=event.target.querySelector('[type=submit]');button.disabled=true;
    try {
      await api('ai/config',{openai_model:$('openai-model').value.trim(),deepseek_model:$('deepseek-model').value.trim(),openai_key:$('openai-key').value.trim(),deepseek_key:$('deepseek-key').value.trim()});
      $('openai-key').value='';$('deepseek-key').value='';$('ai-settings-dialog').close();toast('模型配置已保存，可重新提交问题。');
    }catch(error){$('ai-settings-message').textContent=error.message;}finally{button.disabled=false;}
  };
  $('ai-check').onclick=async()=>{
    $('ai-check').disabled=true;$('ai-settings-message').textContent='正在检查已保存的密钥与模型…';
    try { const result=await api('ai/check',{});$('ai-settings-message').textContent=result.checks.map(item=>(item.provider==='openai'?'OpenAI':'DeepSeek')+'：'+item.message).join('\n'); }
    catch(error){$('ai-settings-message').textContent=error.message;}
    finally{$('ai-check').disabled=false;}
  };
  window.SophiKnowledge={openDocument,setState(state){
    connected=!!state;controls();
    if(!state)return;
    const existing=$('qa-scope').value;
    const spaces=state.settings.spaces;
    const options='<option value="">全部本地知识库</option>'+spaces.map(s=>`<option value="${esc(s.space_id)}">${esc(s.name||s.space_id)}</option>`).join('');
    if($('qa-scope').innerHTML!==options){$('qa-scope').innerHTML=options;$('qa-scope').value=existing;}
    if(!loaded){loaded=true;history().then(async jobs=>{if(jobs.length)renderJob(await api('qa/job?id='+jobs[0].id));else $('qa-status').textContent='已连接 · '+state.counts.documents+' 份本地文档可用于检索。';}).catch(error=>{loaded=false;$('qa-status').textContent=error.message;});}
  }};
  setInterval(poll,1800);
})();
