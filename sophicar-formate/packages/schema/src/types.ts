export type Matrix4RowMajor = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export type Vector3 = [number, number, number];

export type InertiaTensor = [
  number, number, number,
  number, number, number,
  number, number, number,
];

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path?: string;
  entityId?: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T; errors: [] }
  | { ok: false; errors: Diagnostic[] };

export interface PackageFileEntry {
  path: string;
  purpose: 'authority' | 'visual-mesh' | 'collision-mesh' | 'robot' | 'report' | 'other';
  bytes: number;
  sha256: string;
}

export interface PackageManifest {
  schemaVersion: string;
  packageId: string;
  createdAt: string;
  producer: string;
  producerVersion: string;
  source: {
    designGuid: string;
    documentName: string;
    dataFileId: string | null;
    versionId: string | null;
    fingerprint: string;
  };
  coordinateSystem: {
    frameName: string;
    convention: 'x-forward-y-left-z-up';
    sourceToRobot: Matrix4RowMajor;
  };
  files: PackageFileEntry[];
}

export interface SiUnits {
  length: 'm';
  mass: 'kg';
  angle: 'rad';
  inertia: 'kg*m^2';
  fusionDocumentLength?: string;
  fusionDocumentAngle?: string;
}

export interface UserParameterRecord {
  name: string;
  unit: string;
  expression: string;
  valueSi: number | null;
  textValue?: string;
  comment?: string;
  favorite?: boolean;
  dependencies: string[];
  writable: boolean;
  readOnlyReason?: string;
}

export interface ModelParameterRecord {
  name: string;
  unit: string;
  expression: string;
  valueSi: number | null;
  createdBy?: string;
  dependencies: string[];
}

export interface AppearanceRecord {
  baseColor: [number, number, number, number];
  metallic?: number;
  roughness?: number;
}

export interface ComponentRecord {
  id: string;
  name: string;
  partNumber?: string;
  description?: string;
  material?: string;
  bodyIds?: string[];
  appearance?: AppearanceRecord;
  visualMesh?: string;
  collisionMesh?: string;
}

export interface OccurrenceRecord {
  id: string;
  componentId: string;
  name: string;
  fullPath: string;
  parentOccurrenceId?: string;
  entityToken?: string;
  transform: Matrix4RowMajor;
  visible?: boolean;
  grounded?: boolean;
  readOnlyReason?: string;
}

export type JointType =
  | 'fixed'
  | 'revolute'
  | 'continuous'
  | 'prismatic'
  | 'ball'
  | 'cylindrical'
  | 'planar'
  | 'pin-slot'
  | 'inferred'
  | 'unknown';

export interface JointLimit {
  lower?: number;
  upper?: number;
  effort?: number;
  velocity?: number;
}

export interface JointRecord {
  id: string;
  name: string;
  parentOccurrenceId: string | null;
  childOccurrenceId: string | null;
  type: JointType;
  fusionType: string;
  origin: Matrix4RowMajor;
  axis: Vector3;
  degreesOfFreedom: number;
  position?: number;
  limit?: JointLimit;
  suppressed?: boolean;
  loopClosure?: boolean;
  entityToken?: string;
  writeback: {
    limits: boolean;
    type: boolean;
    axis: boolean;
  };
}

export interface PhysicalPropertiesRecord {
  entityId: string;
  massKg: number;
  volumeM3: number;
  centerOfMass: Vector3;
  inertiaKgM2: InertiaTensor;
  inertiaFrame: Matrix4RowMajor;
  accuracy: 'low' | 'medium' | 'high' | 'very-high';
}

export interface BomRecord {
  componentId: string;
  partNumber?: string;
  description?: string;
  material?: string;
  quantity: number;
  occurrenceIds: string[];
}

export interface RobotLinkMapping {
  occurrenceId: string;
  linkName: string;
}

export interface RobotJointOverride {
  jointId: string;
  type?: JointType;
  axis?: Vector3;
  limit?: JointLimit;
  damping?: number;
  friction?: number;
  effort?: number;
  velocity?: number;
}

export interface RobotModel {
  name?: string;
  rootOccurrenceId: string | null;
  linkMappings: RobotLinkMapping[];
  jointOverrides: RobotJointOverride[];
  lockedTreeJointIds?: string[];
}

export interface ModelDocument {
  schemaVersion: string;
  units: SiUnits;
  parameters: {
    user: UserParameterRecord[];
    model: ModelParameterRecord[];
  };
  components: ComponentRecord[];
  occurrences: OccurrenceRecord[];
  joints: JointRecord[];
  physicalProperties: PhysicalPropertiesRecord[];
  bom: BomRecord[];
  robot: RobotModel;
}

export interface ParameterChange {
  name: string;
  oldExpression: string;
  newExpression: string;
  expectedOldValueSi?: number | null;
}

export interface JointChange {
  jointId: string;
  field: 'limit.lower' | 'limit.upper' | 'limit.effort' | 'limit.velocity';
  oldValue?: number;
  newValue: number;
  writebackMode: 'fusion-if-supported' | 'robot-only';
}

export interface RobotOverrideChange {
  jointId: string;
  override: RobotJointOverride;
}

export interface BomOverrideChange {
  componentId: string;
  description?: string;
  material?: string;
}

export interface ChangesDocument {
  schemaVersion: string;
  basePackageId: string;
  baseFingerprint: string;
  targetDesignGuid: string;
  createdAt: string;
  author?: string;
  note?: string;
  parameterChanges: ParameterChange[];
  jointChanges: JointChange[];
  robotOverrides: RobotOverrideChange[];
  bomOverrides: BomOverrideChange[];
}
