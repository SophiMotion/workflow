import { resolve } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';

import { createSophiCadMcpServer, SOPHICAD_TOOL_NAMES } from '../src/server.js';

const fixturePath = resolve(import.meta.dirname, '../../fixtures/generated/four-bar.sophicad.zip');

describe('MCP protocol', () => {
  it('lists and calls the real registered tools over an MCP transport', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createSophiCadMcpServer();
    const client = new Client({ name: 'sophicad-test-client', version: '0.1.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual([...SOPHICAD_TOOL_NAMES].sort());
    const called = await client.callTool({ name: 'inspect_assembly', arguments: { packagePath: fixturePath } });
    expect(called.isError).not.toBe(true);
    expect(called.structuredContent).toMatchObject({ data: { occurrenceCount: 4 }, errors: [] });
    await client.close();
    await server.close();
  });

  it('starts the built stdio CLI, calls a tool and shuts down cleanly', async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve(import.meta.dirname, '../dist/cli.js')],
      stderr: 'pipe',
    });
    const client = new Client({ name: 'sophicad-stdio-test', version: '0.1.0' });
    await client.connect(transport);
    const result = await client.callTool({ name: 'analyze_kinematics', arguments: { packagePath: fixturePath } });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ data: { loopJointIds: ['j-output-ground'] } });
    await client.close();
  });
});
