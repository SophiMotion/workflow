import fs from 'node:fs';
import {Marked} from 'marked';
import sanitizeHtml from 'sanitize-html';

// Read documentation as data. Code fences must never become titles or assets.
const engine=new Marked();
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const output=input.map(markdown=>{
  const tokens=engine.lexer(markdown),images=new Set(),media=new Set();
  const heading=tokens.find(token=>token.type==='heading');
  engine.walkTokens(tokens,token=>{
    if(token.type==='image')images.add(token.href);
    if(token.type==='link'&&/\.(mp4|webm|mov|mp3|wav)(?:[?#]|$)/i.test(token.href))media.add(token.href);
    if(token.type==='html')sanitizeHtml(token.text,{allowedTags:[],transformTags:{
      img:(tag,attrs)=>{if(attrs.src)images.add(attrs.src);return {tagName:'span',attribs:{}};},
      video:(tag,attrs)=>{if(attrs.src)media.add(attrs.src);return {tagName:'span',attribs:{}};},
      audio:(tag,attrs)=>{if(attrs.src)media.add(attrs.src);return {tagName:'span',attribs:{}};},
      source:(tag,attrs)=>{if(attrs.src)media.add(attrs.src);return {tagName:'span',attribs:{}};}
    }});
  });
  return {title:heading?sanitizeHtml(engine.parseInline(heading.text),{allowedTags:[],allowedAttributes:{}}):null,images:[...images],media:[...media]};
});
process.stdout.write(JSON.stringify(output));
