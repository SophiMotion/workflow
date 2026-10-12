# SophiCAD Fusion Robot Bridge

SophiCAD Bridge connects Autodesk Fusion assemblies to a local Three.js/URDF workbench and an MCP tool layer. Fusion remains the authoritative geometry solver; the exchange package preserves editable user-parameter expressions, assembly instances, joints, BOM, physical properties, meshes, and robot metadata.

## Current implementation

The foundation workspace is implemented:

- versioned `manifest.json`, `model.json`, and `changes.json` schemas;
- safe deterministic `.sophicad.zip` read/write;
- assembly graph, root, spanning-tree, and loop-closure analysis;
- parameter dependency ordering and update patches;
- SI units, pose, and inertia conversion;
- URDF and `constraints.json` generation;
- a planar four-bar solver and a `test1.f3d`-derived fixture.

Fusion add-in, Web workbench, and MCP server are implemented in the subsequent project plans under `docs/superpowers/plans/`.

## Development

Requirements: Node.js 20.19 or later and npm.

```bash
npm install
npm run build:fixture
npm run verify
```

The generated reference package is `fixtures/generated/four-bar.sophicad.zip`. Model files are processed locally; no source `.f3d` file or API key is committed.

## Project map

- `packages/schema/` — versioned exchange types and JSON Schema validation.
- `packages/core/` — package IO, graph, parameter, physics, URDF, and kinematics logic.
- `fixtures/four-bar/` — SI reference model and checked URDF/constraint artifacts.
- `scripts/build-four-bar-fixture.mjs` — deterministic fixture package builder.
- `docs/data-package.md` — package contract and safety rules.
- `docs/superpowers/specs/` — approved system design.
- `docs/superpowers/plans/` — implementation plans for all four subsystems.
