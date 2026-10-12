export type LbmConfig = {
  width: number;
  height: number;
  inletVelocity: number;
  tau: number;
  obstacleMask: Uint8Array;
};

export type FlowFieldFrame = {
  width: number;
  height: number;
  speed: Float32Array;
  pressure: Float32Array;
  vorticity: Float32Array;
  velocityX: Float32Array;
  velocityY: Float32Array;
  provenance: "2d-teaching-cfd";
};

export type SolverIdentity = {
  generation: number;
  width: number;
  height: number;
  tau: number;
};

export type FlowRuntimeMetadata = {
  acceptedFrameId: number;
  generation: number;
  gridWidth: number;
  gridHeight: number;
  tau: number;
  requestedInletVelocity: number;
  actualInletVelocity: number;
  velocityScale: number;
  recovery: "none" | "non-finite-field-scale";
  rebuildReason: FlowRebuildReason;
  sourceTelemetrySequence: number;
  sourceFanPowerPct: number;
  sourceSweepRunRevision: number;
  sourceSweepConditionIndex: number | null;
  provenance: "2d-teaching-cfd";
};

export type FlowRebuildReason =
  | "initial"
  | "environment-profile-change"
  | "performance-downgrade"
  | "timeout-downgrade"
  | "context-restore"
  | "manual-restart"
  | "non-finite-restart";
