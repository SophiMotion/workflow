import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { strToU8 } from 'fflate';

import {
  generateUrdf,
  sha256Hex,
  writeSophiCadPackage,
} from '../packages/core/dist/index.js';

const rootUrl = new URL('../', import.meta.url);
const model = JSON.parse(await readFile(new URL('fixtures/four-bar/model.json', rootUrl), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('fixtures/four-bar/manifest.template.json', rootUrl), 'utf8'));

function boxStl(name, length, width, height) {
  const x0 = 0;
  const x1 = length;
  const y0 = -width / 2;
  const y1 = width / 2;
  const z0 = -height / 2;
  const z1 = height / 2;
  const vertices = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const faces = [
    [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
  ];
  const lines = [`solid ${name}`];
  for (const face of faces) {
    lines.push('  facet normal 0 0 0', '    outer loop');
    for (const index of face) {
      lines.push(`      vertex ${vertices[index].join(' ')}`);
    }
    lines.push('    endloop', '  endfacet');
  }
  lines.push(`endsolid ${name}`, '');
  return strToU8(lines.join('\n'));
}

const robot = generateUrdf(model, { rootOccurrenceId: 'ground', meshUriMode: 'relative' });
const files = new Map([
  ['meshes/collision/ground.stl', boxStl('ground', 0.25, 0.02, 0.02)],
  ['meshes/collision/input.stl', boxStl('input', 0.2, 0.02, 0.02)],
  ['meshes/collision/coupler.stl', boxStl('coupler', 0.25, 0.02, 0.02)],
  ['meshes/collision/output.stl', boxStl('output', 0.2, 0.02, 0.02)],
  ['robot/robot.urdf', strToU8(robot.urdfXml)],
  ['robot/constraints.json', strToU8(`${JSON.stringify(robot.constraints, null, 2)}\n`)],
  ['reports/validation.json', strToU8(`${JSON.stringify({ errors: [], warnings: robot.diagnostics }, null, 2)}\n`)],
]);

manifest.source.fingerprint = sha256Hex(strToU8(JSON.stringify(model)));
const bytes = await writeSophiCadPackage({ manifest, model, files });
const outputDirectory = new URL('fixtures/generated/', rootUrl);
await mkdir(outputDirectory, { recursive: true });
await writeFile(new URL('four-bar.sophicad.zip', outputDirectory), bytes);
