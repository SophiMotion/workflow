#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createSophiCadMcpServer, SOPHICAD_TOOL_NAMES } from './server.js';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write([
    'SophiCAD MCP — 本地 stdio 数据包服务',
    '',
    '用法: sophicad-mcp',
    `工具: ${SOPHICAD_TOOL_NAMES.join(', ')}`,
    '说明: 不监听网络、不控制 Fusion UI；写工具只接受不存在的新输出路径。',
    '',
  ].join('\n'));
} else {
  const server = createSophiCadMcpServer();
  await server.connect(new StdioServerTransport());
}
