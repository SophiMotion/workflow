export { sha256Hex } from './package/hash.js';
export {
  DEFAULT_PACKAGE_LIMITS,
  PackageError,
  readSophiCadPackage,
  type PackageLimits,
  type SophiCadPackage,
} from './package/read-package.js';
export { writeSophiCadPackage, type SophiCadPackageInput } from './package/write-package.js';
export {
  analyzeAssemblyGraph,
  buildUrdfSpanningTree,
  type AssemblyAnalysis,
  type SpanningTreeResult,
} from './graph/assembly-graph.js';
export {
  ChangeError,
  applyChangesDocument,
  sortParameterChanges,
  type PatchedModelResult,
  type SortedParameterChangeResult,
} from './parameters/changes.js';
export {
  UnitError,
  convertAngle,
  convertInertia,
  convertLength,
  type AngleUnit,
  type InertiaUnit,
  type LengthUnit,
} from './physics/units.js';
export {
  isPositiveDefiniteInertia,
  rotateInertiaTensor,
  shiftInertiaTensor,
  transformPhysicalProperties,
} from './physics/inertia.js';
export {
  generateUrdf,
  type ConstraintsDocument,
  type LoopClosureConstraint,
  type UrdfArtifacts,
  type UrdfGenerationOptions,
} from './urdf/generate-urdf.js';
export { validateUrdfArtifacts } from './urdf/validate-urdf.js';
export {
  solvePlanarFourBar,
  unwrapAngle,
  type FourBarFailure,
  type FourBarInput,
  type FourBarSolution,
  type Point2,
} from './kinematics/four-bar.js';
export { compareModels, type ChangedValue, type ModelComparison } from './compare/compare-models.js';
