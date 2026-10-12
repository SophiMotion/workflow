import { afterEach, expect, it, vi } from "vitest";
import type { TelemetryFrame } from "../experiment/model";
import type { FlowRuntimeMetadata } from "../flow/types";
import type { CfdSensorProxySample } from "../flow/cfdSensorProxy";
import { downloadExperimentCsv, serializeExperimentCsv } from "./csv";

afterEach(() => vi.restoreAllMocks());

const flowMetadata: FlowRuntimeMetadata = {
  acceptedFrameId: 77,
  generation: 3,
  gridWidth: 160,
  gridHeight: 64,
  tau: 0.62,
  requestedInletVelocity: 0.04,
  actualInletVelocity: 0.032,
  velocityScale: 0.8,
  recovery: "non-finite-field-scale",
  rebuildReason: "non-finite-restart",
  sourceTelemetrySequence: 44,
  sourceFanPowerPct: 90,
  sourceSweepRunRevision: 2,
  sourceSweepConditionIndex: 2,
  provenance: "2d-teaching-cfd",
};

const rawProxySample: CfdSensorProxySample = {
  flowFrameId: 31,
  simulationTimeMs: 2_300,
  fanPowerPct: 30,
  cfdPressureDeltaLu: -0.0012,
  latticeDynamicPressure: 0.0008,
  sensorPressurePa: -8.2,
  physicalDynamicPressurePa: 12.4,
  runtimeConfiguration: {
    generation: 3,
    gridWidth: 160,
    gridHeight: 64,
    tau: 0.62,
    requestedInletVelocity: 0.04,
    actualInletVelocity: 0.032,
    velocityScale: 0.8,
    recovery: "non-finite-field-scale",
    rebuildReason: "non-finite-restart",
  },
};

it("writes BOM, metadata, units, raw samples, summaries, and RFC4180 escaping", () => {
  const sample: TelemetryFrame = {
    sequence: 1,
    simulationTimeMs: 50,
    phase: "sampling",
    fanPowerPct: 30,
    rpm: 1_860,
    windSpeedMps: 3.6,
    underbodyPressurePa: -8,
    verticalLoadN: 0.1,
    quality: "stable",
    provenance: "simulated",
  };
  const csv = serializeExperimentCsv({
    metadata: {
      generatedTime: "2026-08-18T01:02:03.000Z",
      conclusion: "速度越高, \"载荷\"越大\n符合趋势",
      comparisonReason: "高风速下支架与三维泄漏未被二维截面表示",
      flow: flowMetadata,
      simulationSeed: 20260818,
      provenance: "simulated",
    },
    samples: [sample],
    proxySamples: [
      {
        ...rawProxySample,
        flowFrameId: 30,
        runtimeConfiguration: {
          ...rawProxySample.runtimeConfiguration,
          generation: 2,
          gridWidth: 240,
          gridHeight: 96,
          actualInletVelocity: 0.04,
          velocityScale: 1,
          recovery: "none",
          rebuildReason: "timeout-downgrade",
        },
      },
      rawProxySample,
    ],
    comparisonFormula: "Cp_CFD formula",
    comparisons: [{
      fanPowerPct: 30,
      valid: true,
      sampleCount: 5,
      cfdPressureCoefficient: -0.5,
      sensorPressureCoefficient: -0.45,
      signedResidual: 0.05,
      absoluteResidual: 0.05,
      normalizedResidualPct: 11.11,
      mixedRuntimeConfiguration: true,
      runtimeConfigurations: [
        {
          generation: 2,
          gridWidth: 240,
          gridHeight: 96,
          tau: 0.62,
          requestedInletVelocity: 0.04,
          actualInletVelocity: 0.04,
          velocityScale: 1,
          recovery: "none",
          rebuildReason: "initial",
        },
        {
          generation: 3,
          gridWidth: 160,
          gridHeight: 64,
          tau: 0.62,
          requestedInletVelocity: 0.04,
          actualInletVelocity: 0.032,
          velocityScale: 0.8,
          recovery: "non-finite-field-scale",
          rebuildReason: "non-finite-restart",
        },
      ],
      requestedInletVelocityRange: { min: 0.035, max: 0.04 },
      actualInletVelocityRange: { min: 0.028, max: 0.04 },
    }],
  });

  expect(csv.startsWith("\uFEFFtitle,SophiFlow 三工况数字风洞实验\r\n")).toBe(true);
  expect(csv).toContain("generatedTime,2026-08-18T01:02:03.000Z\r\n");
  expect(csv).toContain("provenance,simulated\r\n");
  expect(csv).toContain("solver,D2Q9 BGK teaching solver\r\n");
  expect(csv).toContain("gridSize,mixed: 240 × 96 | 160 × 64\r\n");
  expect(csv).toContain("solverGeneration,mixed: 2 | 3\r\n");
  expect(csv).toContain("velocityScale,mixed: 1 | 0.8\r\n");
  expect(csv).toContain("rebuildReason,mixed: timeout-downgrade | non-finite-restart\r\n");
  expect(csv).toContain("latestAcceptedGridSize,160 × 64\r\n");
  expect(csv).toContain("latestAcceptedActualInletVelocityLu,0.032\r\n");
  expect(csv).toContain("comparisonReason,高风速下支架与三维泄漏未被二维截面表示\r\n");
  expect(csv).toContain("comparisonFormula,Cp_CFD formula\r\n");
  expect(csv).toContain("30,true,5,-0.5,-0.45,0.05,0.05,11.11,true");
  expect(csv).toContain("grid=240x96");
  expect(csv).toContain("grid=160x64");
  expect(csv).toContain("0.035..0.04,0.028..0.04");
  expect(csv).toContain("CFD_PROXY_SAMPLES\r\n");
  expect(csv).toContain("flowFrameId,simulationTimeMs,fanPowerPct,cfdPressureDeltaLu,latticeDynamicPressure,sensorPressurePa,physicalDynamicPressurePa,generation,gridWidth,gridHeight,tau,requestedInletVelocityLu,actualInletVelocityLu,velocityScale,recovery,rebuildReason\r\n");
  expect(csv).toContain("31,2300,30,-0.0012,0.0008,-8.2,12.4,3,160,64,0.62,0.04,0.032,0.8,non-finite-field-scale,non-finite-restart\r\n");
  expect(csv).toContain('conclusion,"速度越高, ""载荷""越大\r\n符合趋势"\r\n');
  expect(csv).toContain("disclaimer,SIMULATED / 模拟数据；2D TEACHING CFD / 二维教学近似\r\n");
  expect(csv).toContain("sequence,simulationTimeMs,phase,fanPowerPct,rpm,windSpeedMps,underbodyPressurePa,verticalLoadN,quality,provenance\r\n");
  expect(csv).toContain("summaryFanPowerPct,valid,sampleCount");
});

it("downloads with the required timestamped filename and always revokes its object URL", () => {
  const createObjectURL = vi.fn(() => "blob:sweep-report");
  const revokeObjectURL = vi.fn();
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: createObjectURL },
    revokeObjectURL: { configurable: true, value: revokeObjectURL },
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

  const filename = downloadExperimentCsv("\uFEFFtitle,test\r\n", "2026-08-18T01:02:03.000Z");

  expect(filename).toBe("sophiflow-cfd-sweep-20260818-010203.csv");
  expect(click).toHaveBeenCalledOnce();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:sweep-report");
});

it.each([
  "=1+1",
  "+SUM(A1:A2)",
  "-2+3",
  "@SUM(A1:A2)",
  "   =1+1",
  "\t@SUM(A1:A2)",
])("prefixes spreadsheet-dangerous string cells: %j", (conclusion) => {
  const csv = serializeExperimentCsv({ metadata: { conclusion, provenance: "simulated" }, samples: [] });
  expect(csv).toContain(`conclusion,'${conclusion}\r\n`);
});

it("leaves ordinary Chinese strings and negative number cells unchanged", () => {
  const sample: TelemetryFrame = {
    sequence: 1,
    simulationTimeMs: 50,
    phase: "sampling",
    fanPowerPct: 30,
    rpm: 1_860,
    windSpeedMps: 3.6,
    underbodyPressurePa: -1,
    verticalLoadN: 0.1,
    quality: "stable",
    provenance: "simulated",
  };
  const csv = serializeExperimentCsv({
    metadata: { conclusion: "正常中文结论", provenance: "simulated" },
    samples: [sample],
  });

  expect(csv).toContain("conclusion,正常中文结论\r\n");
  expect(csv).toContain("1,50,sampling,30,1860,3.6,-1,0.1,stable,simulated\r\n");
  expect(csv).not.toContain("'-1");
});

it("revokes the object URL when anchor setup throws", () => {
  const revokeObjectURL = vi.fn();
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: vi.fn(() => "blob:setup-failure") },
    revokeObjectURL: { configurable: true, value: revokeObjectURL },
  });
  vi.spyOn(document, "createElement").mockImplementationOnce(() => {
    throw new Error("anchor setup failed");
  });

  expect(() => downloadExperimentCsv("csv", "2026-08-18T01:02:03.000Z")).toThrow("anchor setup failed");
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:setup-failure");
});

it("revokes the object URL when anchor click throws", () => {
  const revokeObjectURL = vi.fn();
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: vi.fn(() => "blob:click-failure") },
    revokeObjectURL: { configurable: true, value: revokeObjectURL },
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementationOnce(() => {
    throw new Error("click failed");
  });

  expect(() => downloadExperimentCsv("csv", "2026-08-18T01:02:03.000Z")).toThrow("click failed");
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:click-failure");
});
