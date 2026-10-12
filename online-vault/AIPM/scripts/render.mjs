import {Marked} from 'marked';
import sanitizeHtml from 'sanitize-html';
import markedKatex from 'marked-katex-extension';
import hljs from 'highlight.js';

export const escapeHTML = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain = html => sanitizeHtml(html, {allowedTags:[],allowedAttributes:{}}).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"');

export function renderArticle(markdown, {assets = {}, mediaAssets = {}, resolveLink = href => href} = {}) {
  const toc = [], missingImages = [], formulas = [];
  const localMedia = src => {
    let decoded=src;try{decoded=decodeURI(src);}catch{}
    const local=mediaAssets[src]||mediaAssets[decoded];
    return local && /^assets\/[\w%/.\-\u0080-\uFFFF ]+$/.test(local) && !local.includes('..') ? local : '';
  };
  const mediaTag = (tag,attrs) => ({tagName:tag,attribs:{src:localMedia(attrs.src),controls:'controls',preload:'none'}});
  const engine = new Marked({gfm:true, breaks:false});
  const math = markedKatex({throwOnError:false, trust:false, strict:'ignore', output:'html', nonStandard:true});
  for (const extension of math.extensions) {
    const render = extension.renderer;
    extension.renderer = function(token) {
      const index = formulas.push(render.call(this, token)) - 1;
      return `<span data-formula="${index}"></span>`;
    };
  }
  engine.use(math);
  engine.use({renderer:{
    heading({tokens,depth}) {
      const titleHTML = this.parser.parseInline(tokens);
      const title = plain(titleHTML);
      const id = `section-${toc.length + 1}`;
      toc.push({id,depth,title});
      return `<h${depth} id="${id}">${titleHTML}</h${depth}>\n`;
    },
    code({text,lang}) {
      const language = (lang || '').split(/\s/)[0];
      const content = hljs.getLanguage(language) ? hljs.highlight(text,{language,ignoreIllegals:true}).value : escapeHTML(text);
      return `<pre><code class="hljs language-${escapeHTML(language || 'text')}">${content}</code></pre>`;
    }
  }});
  let html = sanitizeHtml(engine.parse(markdown), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'details', 'summary', 'span', 'del', 'input', 'video', 'audio', 'source'],
    allowedAttributes: {
      a:['href','title','target','rel'], img:['src','alt','loading','decoding'],
      '*':['id','class'], span:['class','data-formula'],
      th:['colspan','rowspan'],td:['colspan','rowspan'], input:['type','checked','disabled'],
      ol:['start'], details:['open'],video:['src','controls','preload'],audio:['src','controls','preload'],source:['src']
    },
    allowedSchemes:['http','https','mailto'], allowProtocolRelative:false,
    transformTags:{
      a: (tag,attrs) => {
        let href = localMedia(attrs.href) || resolveLink(attrs.href || '');
        if (/^(?:https?:|mailto:)/i.test(href)) return {tagName:'a',attribs:{href,title:attrs.title || '',target:'_blank',rel:'noopener noreferrer'}};
        return {tagName:'a',attribs:{href}};
      },
      img: (tag,attrs) => {
        let decodedSource=attrs.src;
        try{decodedSource=decodeURI(attrs.src);}catch{/* Keep the original lookup for malformed escapes. */}
        const local = assets[attrs.src] || assets[decodedSource];
        if (!local || !/^assets\/[\w%/.\-\u0080-\uFFFF ]+$/.test(local) || local.includes('..')) {
          missingImages.push({src:attrs.src || '',alt:attrs.alt || ''});
          return {tagName:'span',attribs:{class:'missing-image'},text:`图片未保存${attrs.alt ? '：' + attrs.alt : ''}`};
        }
        return {tagName:'img',attribs:{src:local,alt:attrs.alt || '教材配图',loading:'lazy',decoding:'async'}};
      },
      input: () => ({tagName:'input',attribs:{type:'checkbox',disabled:'disabled'}}),
      video: mediaTag,
      audio: mediaTag,
      source: (tag,attrs) => ({tagName:'source',attribs:{src:localMedia(attrs.src)}})
    }
  });
  html=html.replace(/<(video|audio)\b([^>]*)>([\s\S]*?)<\/\1>/g,(block,tag,attrs,body)=>{
    if(!/\bsrc="assets\//.test(attrs+body))return '<span class="missing-image">视频或音频未保存，可在页面顶部打开原始教材查看。</span>';
    return block;
  });
  const text = plain(html.replace(/<\/(?:p|div|h\d|li|tr|pre)>/g,'$&\n')).replace(/\n{3,}/g,'\n\n');
  html = html.replace(/<span data-formula="(\d+)"><\/span>/g, (_,index)=>formulas[Number(index)] || '');
  return {html,text,toc,missingImages};
}
