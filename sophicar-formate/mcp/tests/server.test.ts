import { describe, expect, it } from 'vitest';

import { SOPHICAD_TOOL_NAMES, createSophiCadMcpServer } from '../src/server.js';

describe('MCP server', () => {
  it('advertises exactly the eight package-level tools', () => {
    expect([...SOPHICAD_TOOL_NAMES].sort()).toEqual([
      'analyze_kinematics',
      'compare_versions',
      'create_update_package',
      'generate_urdf',
      'inspect_assembly',
      'list_parameters',
      'propose_parameter_changes',
      'validate_package',
    ]);
    expect(createSophiCadMcpServer()).toBeDefined();
  });
});
