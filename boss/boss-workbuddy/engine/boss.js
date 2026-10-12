// BOSS 直聘页面操作层：采集候选人、翻页、打开简历、打招呼
// 通过 CDP 在 iframe 内操作。推荐页 iframe 与搜索页 iframe 是两套结构。
import { connectMainTab } from './cdp.js';

// 在指定 iframe 里执行脚本（按 src 关键词匹配 iframe）
async function inFrameBySrc(session, srcKeyword, expr) {
  return session.eval(`
    (function(){
      const f = Array.from(document.querySelectorAll("iframe")).find(f => (f.src||"").includes("${srcKeyword}"));
      const doc = f && f.contentDocument;
      if (!doc) return { __err: "iframe 未找到: ${srcKeyword}" };
      return (${expr}).call(null, doc);
    })()
  `);
}

// 推荐页 iframe
const inRecommend = (session, expr) => inFrameBySrc(session, '/frame/recommend/', expr);
// 搜索页 iframe
const inSearch = (session, expr) => inFrameBySrc(session, '/frame/search/', expr);

// ============ 推荐页（推荐 tab，13-15人/岗）============

// A non-empty list can still belong to the previous job. Observe job and identities together.
export function matchesJobName(text, expected) {
  const t=String(text||'').trim(), e=String(expected||'').trim();
  return !!e && (t===e || (t.startsWith(e) && /^[\s—–-]/u.test(t.slice(e.length))));
}
export async function readRecommendContext(session) {
  return inRecommend(session, `(doc) => {
    const current=Array.from(doc.querySelectorAll('.job-item')).filter(j=>j.className.includes('curr'));
    const cards=Array.from(doc.querySelectorAll('li.card-item'));
    const cardIds=cards.map(c=>{const e=c.querySelector('[data-geekid], [data-geek]');return e&&(e.getAttribute('data-geekid')||e.getAttribute('data-geek'));}).filter(Boolean);
    return {jobText:current[0]?.innerText?.trim()||'',currentCount:current.length,cardIds,signature:cardIds.join('|'),count:cards.length};
  }`);
}
export async function waitForRecommendCards(session, timeout=20000, {expectedJobName,previousSignature='',requireChanged=false,pollMs=150}={}) {
  if(!expectedJobName)return 0;
  const end=Date.now()+timeout;let stable='',passes=0;
  while(Date.now()<end){
    const context=await readRecommendContext(session);
    const valid=context?.currentCount===1 && matchesJobName(context.jobText,expectedJobName) && context.cardIds?.length>0 && (!requireChanged||context.signature!==previousSignature);
    if(valid){passes=context.signature===stable?passes+1:1;stable=context.signature;if(passes>=2)return context.count;}
    else {passes=0;stable='';}
    await new Promise(r=>setTimeout(r,pollMs));
  }
  return 0;
}

// 采集推荐页候选人卡片
export async function collectRecommendCards(session) {
  return inRecommend(session, `(doc) => {
    const cards = Array.from(doc.querySelectorAll("li.card-item"));
    return cards.map(card => {
      const get = (sel) => { const e = card.querySelector(sel); return e ? e.innerText.trim() : ""; };
      const getAll = (sel) => Array.from(card.querySelectorAll(sel)).map(e => e.innerText.trim()).filter(Boolean);
      const el = card.querySelector("[data-geekid], [data-geek]");
      const geekId = el ? (el.getAttribute("data-geekid") || el.getAttribute("data-geek")) : "";
      return {
        geekId, name: get(".name"), salary: get(".salary-wrap"), baseInfo: get(".base-info"),
        expect: get(".expect-wrap .content"), desc: get(".geek-desc .content"), tags: getAll(".tag-item"),
        education: get(".edu-info") || get(".school"),
      };
    }).filter(c => c.name);
  }`);
}

// 推荐页切换职位
export async function switchJob(session, jobName, {timeout=15000,pollMs=150}={}) {
  const before=await readRecommendContext(session);
  const selected=await inRecommend(session, `(doc) => {
    const expected=${JSON.stringify(jobName)};
    const matches=Array.from(doc.querySelectorAll('.job-item')).filter(j=>{
      const text=(j.innerText||'').trim();return text===expected || (text.startsWith(expected)&&/^[\\s—–-]/u.test(text.slice(expected.length)));
    });
    if(matches.length!==1)return {ok:false,err:'职位缺失或名称不唯一'};
    matches[0].click();return {ok:true};
  }`);
  if(!selected?.ok)return selected||{ok:false,err:'无法核验职位'};
  const count=await waitForRecommendCards(session,timeout,{expectedJobName:jobName,previousSignature:before?.signature,requireChanged:!matchesJobName(before?.jobText,jobName),pollMs});
  return count>0?{ok:true,jobName,count}:{ok:false,err:'新岗位及候选卡片尚未同步，停止发送'};
}

// 推荐页切换 tab
export async function switchTab(session, tabKeyword) {
  return inRecommend(session, `(doc) => {
    const tabs = Array.from(doc.querySelectorAll(".tab-item"));
    const target = tabs.find(t => (t.innerText||"").trim().startsWith("${tabKeyword}"));
    if (!target) return { ok: false, err: "tab未找到: ${tabKeyword}" };
    target.click(); return { ok: true };
  }`);
}

// 推荐页职位列表
export async function listJobs(session) {
  return inRecommend(session, `(doc) => {
    return Array.from(doc.querySelectorAll(".job-item")).map(j => ({
      text: (j.innerText||"").trim(), isCurrent: j.className.includes("curr"),
    }));
  }`);
}

// ============ 搜索页（牛人搜索，可达100+人）============

// 导航到搜索页
export async function gotoSearch(session, keywords = '', jobId = '') {
  const url = `https://www.zhipin.com/web/chat/search`;
  await session.navigate(url);
  // 通过 URL 参数或输入框设置关键词
  if (keywords) {
    await searchByKeyword(session, keywords);
  }
  return { ok: true };
}

// 在搜索页输入关键词并搜索
export async function searchByKeyword(session, keywords) {
  return inSearch(session, `(doc) => {
    const input = doc.querySelector("input.search-input");
    if (!input) return { ok: false, err: "搜索框未找到" };
    // 设置值并触发输入事件
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "${keywords}");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    // 触发回车搜索
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, which: 13, bubbles: true }));
    return { ok: true };
  }`);
}

// 用 jobId 关联搜索（导航搜索 iframe 到带 jobId 的 URL，返回该岗位的匹配候选人）
export async function searchByJobId(session, jobId) {
  // 直接在主 frame 里定位搜索 iframe 并重设其 src
  await session.eval(`
    (function(){
      const f = Array.from(document.querySelectorAll("iframe")).find(f => (f.src||"").indexOf("/frame/search/") >= 0);
      if (!f) return false;
      f.src = "https://www.zhipin.com/web/frame/search/?jobId=" + encodeURIComponent("${jobId}") + "&keywords=&t=&source=&city=";
      return true;
    })()
  `);
  return { ok: true };
}

// 等待搜索结果渲染
export async function waitForSearchCards(session, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const n = await inSearch(session, `(doc) => doc.querySelectorAll("li.geek-info-card").length`);
    if (n > 0) return n;
    await new Promise(r => setTimeout(r, 500));
  }
  return 0;
}

// 轻量计数：只返回搜索结果卡片数量（不采集完整内容，用于翻页智能等待）
export async function inSearchCount(session) {
  return inSearch(session, `(doc) => doc.querySelectorAll("li.geek-info-card").length`);
}

// 采集搜索结果卡片（含 data-jid、data-lid 等关键属性）
export async function collectSearchCards(session) {
  return inSearch(session, `(doc) => {
    const cards = Array.from(doc.querySelectorAll("li.geek-info-card"));
    return cards.map(card => {
      const a = card.querySelector("a[ka='search_click_open_resume'], a[data-lid]");
      const get = (sel) => { const e = card.querySelector(sel); return e ? e.innerText.trim() : ""; };
      const getAll = (sel) => Array.from(card.querySelectorAll(sel)).map(e => e.innerText.trim()).filter(Boolean);
      const fullText = card.innerText || "";
      return {
        jid: a ? a.getAttribute("data-jid") : "",
        lid: a ? a.getAttribute("data-lid") : "",
        expectId: a ? a.getAttribute("data-expect") : "",
        name: get(".name-label"),
        baseInfo: get(".info-labels"),
        salary: get(".salary"),
        // 完整文本作为描述（含核心技能、期望、院校等）
        desc: fullText,
        tags: getAll(".card-label, .tag-item"),
        school: get(".university, .school"),
        city: get(".expect, .city"),
      };
    }).filter(c => c.name);
  }`);
}

// 点击"加载更多"（先滚动到底部确保可见，再点击）
export async function clickLoadMore(session) {
  return inSearch(session, `(doc) => {
    const btn = doc.querySelector(".loadmore .click-class") || doc.querySelector(".loadmore");
    if (!btn) return { ok: false, err: "无加载更多按钮" };
    btn.scrollIntoView({ block: "end" });
    btn.click();
    return { ok: true };
  }`);
}

// 搜索结果页点击"联系Ta"
// ⚠️ 搜索页联系属付费「搜索畅聊卡」功能：点击通常弹出购买弹窗而非直接发送。
// 本函数点击后会自动检测付费弹窗并关闭，返回 err 提示，绝不误报"已发送"。
export async function clickSearchGreet(session, lid) {
  const click = await inSearch(session, `(doc) => {
    const card = Array.from(doc.querySelectorAll("li.geek-info-card")).find(c => {
      const a = c.querySelector("a[data-lid]");
      return a && a.getAttribute("data-lid") === "${lid}";
    });
    if (!card) return { ok: false, err: "卡片未找到" };
    const btn = card.querySelector("button.btn-getcontact, .btn-getcontact");
    if (!btn) return { ok: false, err: "联系Ta按钮未找到" };
    const rect = btn.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, view: doc.defaultView };
    const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
    btn.dispatchEvent(new MouseEvent("mousedown", { ...opts, clientX: cx, clientY: cy, button: 0 }));
    btn.dispatchEvent(new MouseEvent("mouseup", { ...opts, clientX: cx, clientY: cy, button: 0 }));
    btn.dispatchEvent(new MouseEvent("click", { ...opts, clientX: cx, clientY: cy, button: 0 }));
    return { ok: true };
  }`);
  if (!click.ok) return click;
  await new Promise(r => setTimeout(r, 1200));
  if (await paidDialogVisible(session)) {
    await closePaidDialog(session);
    return { ok: false, err: '需付费畅聊卡（购买弹窗已自动关闭，未支付）' };
  }
  return { ok: true };
}

// ============ 付费弹窗检测与发送核验 ============

// 是否出现付费购买弹窗（畅聊卡等），在主文档和所有 iframe 中检测
export async function paidDialogVisible(session) {
  const r = await session.eval(`(function(){
    var re = /畅聊卡|商品需付|扫码支付/;
    var scanDoc = function(doc) {
      if (!doc || !doc.body) return false;
      if (re.test(doc.body.innerText || "")) return true;
      var els = doc.querySelectorAll("[class*='dialog'], [class*='Dialog'], [class*='popup'], [class*='modal']");
      for (var i = 0; i < els.length; i++) {
        var st = doc.defaultView.getComputedStyle(els[i]);
        if (st.display === "none" || st.visibility === "hidden") continue;
        if (re.test(els[i].innerText || "")) return true;
      }
      return false;
    };
    if (scanDoc(document)) return { paid: true, where: "main" };
    var frames = document.querySelectorAll("iframe");
    for (var j = 0; j < frames.length; j++) {
      try { if (scanDoc(frames[j].contentDocument)) return { paid: true, where: frames[j].src || "iframe" }; } catch (e) {}
    }
    return { paid: false };
  })()`);
  return !!(r && r.paid);
}

// 关闭付费弹窗（点可见关闭按钮，兜底发 ESC）
export async function closePaidDialog(session) {
  return session.eval(`(function(){
    var docs = [document];
    var frames = document.querySelectorAll("iframe");
    for (var i = 0; i < frames.length; i++) { try { if (frames[i].contentDocument) docs.push(frames[i].contentDocument); } catch (e) {} }
    var sels = [".boss-dialog__close", ".dialog-close", ".zc-dialog-close", ".zp-dialog-close", "[class*='dialog'] [class*='close']", "[class*='Dialog'] [class*='close']"];
    for (var a = 0; a < docs.length; a++) {
      for (var b = 0; b < sels.length; b++) {
        var els = Array.from(docs[a].querySelectorAll(sels[b])).filter(function(e){ return e.offsetParent !== null; });
        if (els.length) { els[0].click(); return { ok: true, via: sels[b] }; }
      }
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, which: 27, bubbles: true }));
    return { ok: false, via: "esc" };
  })()`);
}

// 主界面会话列表数量（发送成功通常会新增一条会话，作为核验信号）
export async function countConversations(session) {
  return session.eval(`(function(){
    var sels = [".chat-conversation-list li", ".conversation-list li", "[class*='conversation'] li"];
    for (var i = 0; i < sels.length; i++) {
      var n = document.querySelectorAll(sels[i]).length;
      if (n > 0) return { n: n, via: sels[i] };
    }
    return { n: 0, via: "" };
  })()`);
}

// 若打招呼打开了聊天面板（预填招呼语未自动发出），点击可见的「发送/发送招呼」按钮
export async function clickChatSendIfAny(session) {
  return session.eval(`(function(){
    var docs = [document];
    var frames = document.querySelectorAll("iframe");
    for (var i = 0; i < frames.length; i++) { try { if (frames[i].contentDocument) docs.push(frames[i].contentDocument); } catch (e) {} }
    for (var a = 0; a < docs.length; a++) {
      var btns = Array.from(docs[a].querySelectorAll("button, [class*='send']")).filter(function(e){ return e.offsetParent !== null; });
      var el = btns.find(function(b){ return /^发送(招呼)?$/.test((b.innerText || "").trim()); });
      if (el) { el.click(); return { ok: true }; }
    }
    return { ok: false };
  })()`);
}

// 推荐页对指定卡片打招呼（免费渠道）
// 关键：BOSS 的「打招呼」按钮只响应真实鼠标事件（isTrusted=true），
//       el.click() 和合成 MouseEvent 都会被忽略或跨 iframe 失效。
//       必须用 CDP Input.dispatchMouseEvent 在按钮真实坐标处点击。
export async function clickRecommendGreet(session, geekId, expectedJobName) {
  const context=await readRecommendContext(session);
  if(context?.currentCount!==1||!matchesJobName(context.jobText,expectedJobName)||!context.cardIds?.includes(geekId))return {ok:false,err:'岗位或候选人身份变化，停止发送'};
  // 1) 在 iframe 内定位按钮，返回其视口中心坐标 + 状态判断
  const info = await inRecommend(session, `(doc) => {
    const cards = Array.from(doc.querySelectorAll("li.card-item"));
    const card = cards.find(c => {
      const el = c.querySelector("[data-geekid], [data-geek]");
      const id = el ? (el.getAttribute("data-geekid") || el.getAttribute("data-geek")) : "";
      return id && id === ${JSON.stringify(geekId)};
    });
    if (!card) return { err: "卡片未找到" };
    const btns = Array.from(card.querySelectorAll("button, a, [class*='btn']"));
    const norm = (b) => (b.innerText || "").replace(/\\s+/g, "").trim();
    const done = btns.find(b => /继续沟通|已沟通|等待接受/.test(norm(b)));
    if (done) return { err: "已沟通过" };
    const btn = btns.find(b => /^打招呼$|^沟通$/.test(norm(b)));
    if (!btn) return { err: "打招呼按钮未找到" };
    const r = btn.getBoundingClientRect();
    const f = doc.defaultView.frameElement; // 拿到 iframe 元素
    const fr = f ? f.getBoundingClientRect() : { x: 0, y: 0 };
    return { x: fr.x + r.x + r.width / 2, y: fr.y + r.y + r.height / 2 };
  }`);
  if (info && info.err) return { ok: false, err: info.err };
  if (!info || info.x == null) return { ok: false, err: "按钮定位失败" };
  // 2) 用 CDP 真实鼠标点击
  await session.clickAt(info.x, info.y);
  return { ok: true };
}

// 读取推荐卡片当前状态（是否已沟通/等待接受）
export async function recommendCardState(session, geekId) {
  return inRecommend(session, `(doc) => {
    const cards = Array.from(doc.querySelectorAll("li.card-item"));
    const card = cards.find(c => {
      const el = c.querySelector("[data-geekid], [data-geek]");
      const id = el ? (el.getAttribute("data-geekid") || el.getAttribute("data-geek")) : "";
      return id && id === ${JSON.stringify(geekId)};
    });
    if (!card) return { found: false };
    const btns = Array.from(card.querySelectorAll("button, a")).map(b => (b.innerText||"").replace(/\\s+/g,"").trim()).join(" ");
    return { found: true, done: /等待接受|已沟通|继续沟通/.test(btns) };
  }`);
}

// 检测并关闭「已向牛人发送招呼」确认弹窗
// 返回 { sent: true } 表示检测到发送成功提示；同时勾选「不再显示」并点「知道了」关闭
export async function handleGreetSuccessDialog(session) {
  return inRecommend(session, `(doc) => {
    const dlg = Array.from(doc.querySelectorAll(".dialog-container, [class*='dialog']")).find(e => e.offsetParent !== null && /已向牛人发送招呼/.test(e.innerText || ""));
    if (!dlg) return { sent: false };
    // 勾选「不再显示」（可选，避免后续每次弹窗）
    const chk = dlg.querySelector("input[type=checkbox][name=notip], input[type=checkbox]");
    if (chk && !chk.checked) { chk.click(); }
    // 点「知道了」关闭
    const btn = Array.from(dlg.querySelectorAll("button, .btn")).find(b => /知道了/.test((b.innerText || "").trim()));
    if (btn) btn.click();
    else {
      const close = dlg.querySelector(".close, .dialog-header .close, [class*='close']");
      if (close) close.click();
    }
    return { sent: true };
  }`);
}

// ============ 高效核验：一次往返合并检测打招呼结果 ============
// 原实现分 3 次 CDP 往返（付费弹窗检测 + 发送成功弹窗 + 卡片状态），
// 现合并为 1 次，同时返回 paid / sent / done 三个信号，大幅减少往返开销。
export async function checkGreetResult(session, geekId) {
  const observed=await inRecommend(session, `(doc) => {
    // 1) 付费弹窗（畅聊卡）
    const rePaid = /畅聊卡|商品需付|扫码支付/;
    let paid = false;
    const scanPaid = (d) => {
      if (!d || !d.body) return false;
      if (rePaid.test(d.body.innerText || "")) return true;
      const els = d.querySelectorAll("[class*='dialog'], [class*='Dialog'], [class*='popup'], [class*='modal']");
      for (let i = 0; i < els.length; i++) {
        const st = d.defaultView.getComputedStyle(els[i]);
        if (st.display === "none" || st.visibility === "hidden") continue;
        if (rePaid.test(els[i].innerText || "")) return true;
      }
      return false;
    };
    if (scanPaid(doc)) paid = true;
    else {
      const frames = doc.defaultView.top.document.querySelectorAll("iframe");
      for (let i = 0; i < frames.length; i++) { try { if (scanPaid(frames[i].contentDocument)) { paid = true; break; } } catch (e) {} }
    }

    // 2) 发送成功弹窗「已向牛人发送招呼」
    let sent = false;
    const dlg = Array.from(doc.querySelectorAll(".dialog-container, [class*='dialog']")).find(e =>
      e.offsetParent !== null && /已向牛人发送招呼/.test(e.innerText || "")
    );
    if (dlg) {
      sent = true;
      const chk = dlg.querySelector("input[type=checkbox][name=notip], input[type=checkbox]");
      if (chk && !chk.checked) { chk.click(); }
      const btn = Array.from(dlg.querySelectorAll("button, .btn")).find(b => /知道了/.test((b.innerText || "").trim()));
      if (btn) btn.click();
      else { const c = dlg.querySelector(".close, [class*='close']"); if (c) c.click(); }
    }

    // 3) 卡片状态（继续沟通/等待接受/已沟通）
    let done = false;
    const cards = Array.from(doc.querySelectorAll("li.card-item"));
    const card = cards.find(c => {
      const el = c.querySelector("[data-geekid], [data-geek]");
      const id = el ? (el.getAttribute("data-geekid") || el.getAttribute("data-geek")) : "";
      return id && id === ${JSON.stringify(geekId)};
    });
    if (card) {
      const btns = Array.from(card.querySelectorAll("button, a")).map(b => (b.innerText || "").replace(/\\s+/g, "").trim()).join(" ");
      done = /等待接受|已沟通|继续沟通/.test(btns);
    }

    return { paid, sent, done };
  }`);
  return {paid:!!observed?.paid,sent:false,done:!!observed?.done,observedSuccess:!!observed?.sent,requiresChatVerification:true};
}

// 检查是否被阻断（登录/验证）
export async function checkBlocked(session) {
  const info = await session.eval(`({ url: location.href, text: (document.body?.innerText||"").slice(0,300) })`);
  if (info.url.includes('/user/') || info.url.includes('login')) return { blocked: true, reason: '登录页', url: info.url };
  if (/安全验证|验证码|请完成验证/.test(info.text)) return { blocked: true, reason: '安全验证', text: info.text };
  return { blocked: false };
}

export { inRecommend, inSearch };
