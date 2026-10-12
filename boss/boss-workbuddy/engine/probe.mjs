// 探测：连接现有 Edge，导航到 BOSS 推荐页，验证登录态 + dump DOM
import { listTabs, CDPSession } from './cdp.js';

async function main() {
  const tabs = await listTabs();
  const page = tabs.find(t => t.type === 'page');
  if (!page) { console.error('无页面标签'); process.exit(1); }

  const session = await CDPSession.connect(page.webSocketDebuggerUrl);
  await session.send('Page.enable');
  await session.send('Runtime.enable');

  console.log('[1] 导航到 BOSS 推荐页...');
  await session.navigate('https://www.zhipin.com/web/chat/recommend');
  await new Promise(r => setTimeout(r, 5000));
  await session.waitLoad().catch(() => {});

  const info = await session.eval(`({
    url: location.href,
    title: document.title,
    bodyText: (document.body?.innerText || '').slice(0, 800),
  })`);
  console.log('[2] 页面信息:');
  console.log(JSON.stringify(info, null, 2));

  const isLoginPage = info.url.includes('/user/') || info.url.includes('login') || /登录|注册/.test(info.bodyText.slice(0, 200));
  console.log('[3] 登录状态判断:', isLoginPage ? '❌ 未登录(跳转登录页)' : '✅ 已登录(在推荐页)');

  session.close();
}
main().catch(e => { console.error('失败:', e.message); process.exit(1); });
