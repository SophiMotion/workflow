#!/usr/bin/env node
// 统一启动入口：三种启动方式（WorkBuddy 指令 / 定时任务 / HTML 点搜索）都调用这里
// 用法：node start.js [--dry-run] [--no-send] [--paid-greet] [--role <id>]
// 自动发送必须配置精确聊天核验连接；没有连接时返回明确阻碍。
import { run } from './engine/engine.js';

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    noSend: args.includes('--no-send'),
    paidGreet: args.includes('--paid-greet'),
    role: (() => { const i = args.indexOf('--role'); return i >= 0 ? args[i + 1] : null; })(),
  };
}

const opts = parseArgs();
console.log('='.repeat(60));
console.log('WorkBuddy BOSS 招聘执行引擎');
console.log(`时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
console.log(`模式：${opts.dryRun ? '试运行(不发送不写数据)' : opts.noSend ? '只采集不发送' : '经核验的邀约队列'}`);
if (opts.paidGreet) console.log('本任务不支持付费发送');
console.log('='.repeat(60));

let result;
try { result = await run({
  dryRun: opts.dryRun,
  sendGreeting: !opts.noSend,
  paidGreet: opts.paidGreet,
  roleIds: opts.role ? [opts.role] : null,
}); } catch (error) { result={ok:false,error:error.message}; }

console.log('\n' + '='.repeat(60));
console.log('执行结果汇总：');
if (result.error) console.error(result.error);
if (result.status) console.log(`状态：${result.status}`);
if (result.summary) {
  console.log(`  采集候选人：${result.summary.totalCollected} 位`);
  console.log(`  成功打招呼：${result.summary.totalSent} 位`);
  console.log(`  跳过/失败：${result.summary.totalSkipped} 位`);
  console.log(`  待核验：${result.summary.totalUnknown || 0} 位`);
}
console.log('='.repeat(60));

process.exit(result.ok ? 0 : 1);
