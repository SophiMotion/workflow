import test from 'node:test';
import assert from 'node:assert/strict';
import {renderArticle} from '../scripts/render.mjs';
import {searchDocuments} from '../site/search.mjs';

test('imported markup cannot execute scripts, event handlers or javascript URLs', () => {
  const result = renderArticle('# 标题\n<script>alert(1)</script><img src="https://evil.test/a.png" onerror="alert(2)"><a href="javascript:alert(3)">链接</a><iframe src="https://evil.test"></iframe>');
  assert.doesNotMatch(result.html, /<script|onerror=|javascript:|<iframe|src="https:/i);
});
test('images require a verified local map and missing images are reported', () => {
  const result = renderArticle('![已存图](./image.png)\n![缺失图](gone.jpg)', {assets:{'./image.png':'assets/hello/image.png'}});
  assert.match(result.html, /src="assets\/hello\/image.png"/);
  assert.equal(result.missingImages.length, 1);
  assert.match(result.html, /图片未保存/);
});
test('unsaved embedded video remains visible as an explicit missing-resource notice',()=>{
  const result=renderArticle('<video src="https://example.test/demo.mp4"><source src="demo.mp4"></video>');
  assert.match(result.html,/视频或音频未保存/);
  assert.doesNotMatch(result.html,/<video|<source|src="https:/);
});
test('saved videos and media links use only vetted local files and never autoplay',()=>{
  const result=renderArticle('<video autoplay onplay="alert(1)"><source src="demo.mp4"></video>\n\n[视频](demo.mp4)',{mediaAssets:{'demo.mp4':'assets/example/demo.mp4'}});
  assert.match(result.html,/<video[^>]*controls/);
  assert.match(result.html,/<source src="assets\/example\/demo.mp4"/);
  assert.match(result.html,/href="assets\/example\/demo.mp4"/);
  assert.doesNotMatch(result.html,/autoplay|onplay|未保存/);
  const unsafe=renderArticle('<video src="bad.mp4"></video>',{mediaAssets:{'bad.mp4':'https://evil.test/bad.mp4'}});
  assert.doesNotMatch(unsafe.html,/<video|evil.test/);
});
test('encoded Chinese image references resolve to the same verified local asset',()=>{
  const result=renderArticle('![image](../%E5%85%B7%E8%BA%AB/diagram.png)',{assets:{'../具身/diagram.png':'assets/embodied/diagram.png'}});
  assert.equal(result.missingImages.length,0);
  assert.match(result.html,/src="assets\/embodied\/diagram.png"/);
});
test('duplicate headings get unique stable anchors; Chinese text remains searchable', () => {
  const result = renderArticle('## 任务环境\n自主决策\n## 任务环境\n第二节');
  assert.equal(new Set(result.toc.map(x=>x.id)).size, 2);
  assert.match(result.text, /自主决策/);
});
test('search includes saved body text, combines terms, and rejects empty query', () => {
  const docs=[{id:'a',title:'初识智能体',text:'自主决策和环境感知',aliases:[]},{id:'b',title:'环境入门',text:'',aliases:[]}];
  assert.equal(searchDocuments(docs,'自主决策')[0].doc.id,'a');
  assert.equal(searchDocuments(docs,'智能体 环境')[0].doc.id,'a');
  assert.equal(searchDocuments(docs,'不存在').length,0);
  assert.equal(searchDocuments(docs,'  ').length,0);
});
