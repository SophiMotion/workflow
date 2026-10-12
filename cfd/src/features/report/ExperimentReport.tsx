import { useMemo, useState } from "react";
import { summarizeCfdSensorProxySamples, type CfdSensorProxySummary } from "../flow/cfdSensorProxy";
import type { FlowRuntimeMetadata } from "../flow/types";
import type { SweepState, SweepPower } from "../sweep/sweepRunner";
import { SWEEP_POWERS } from "../sweep/sweepRunner";
import {
  downloadExperimentCsv,
  serializeExperimentCsv,
  type ExperimentCsvInput,
} from "./csv";
import { summarizeRun, type RunSummary } from "./experimentSummary";

type DownloadCsv = (csv: string, generatedTime?: string) => unknown;

export type ExperimentReportProps = {
  sweep: SweepState | null;
  conclusion: string;
  comparisonReason?: string;
  selectedLargestResidualPower?: SweepPower | null;
  flowMetadata?: FlowRuntimeMetadata | null;
  onConclusionChange(value: string): void;
  onComparisonReasonChange?(value: string): void;
  onSelectLargestResidual(power: SweepPower, largestPower: SweepPower): void;
  onStartSweep(): void;
  onCancelSweep(): void;
  onRetrySweep(): void;
  generatedTime?: string;
  downloadCsv?: DownloadCsv;
  serializeCsv?: (input: ExperimentCsvInput) => string;
};

type ConditionResult = {
  power: SweepPower;
  summary: RunSummary;
  comparison: CfdSensorProxySummary;
  residual: number | null;
};

export const CFD_SENSOR_COMPARISON_FORMULA = "Cp_CFD = ΣΔp_lu / Σ(0.5·u_actual²); Cp_sensor = Σp_underbody_Pa / Σ(0.5·1.225·v²); residual = |Cp_sensor − Cp_CFD|";

export function ExperimentReport(props: ExperimentReportProps) {
  const conditions = useMemo(() => buildConditionResults(props.sweep), [props.sweep]);
  const largestResidualPower = findLargestResidualPower(conditions);

  return (
    <section className="experiment-report" aria-labelledby="experiment-report-title">
      <div className="report-heading">
        <div>
          <p className="section-kicker">AUTOMATED SWEEP &amp; REPORT</p>
          <h2 id="experiment-report-title">三工况实验报告</h2>
        </div>
        <div className="report-disclaimers">
          <span>SIMULATED / 模拟数据</span>
          <span>2D TEACHING CFD / 二维教学近似</span>
        </div>
      </div>

      <SweepPanel
        sweep={props.sweep}
        onStart={props.onStartSweep}
        onCancel={props.onCancelSweep}
        onRetry={props.onRetrySweep}
      />
      <div className="condition-summary-grid">
        {conditions.map(({ power, summary }) => <ConditionCard key={power} power={power} summary={summary} />)}
      </div>
      <ComparisonTable
        conditions={conditions}
        largestResidualPower={largestResidualPower}
        selectedLargestResidualPower={props.selectedLargestResidualPower ?? null}
        comparisonReason={props.comparisonReason ?? ""}
        onComparisonReasonChange={props.onComparisonReasonChange ?? (() => undefined)}
        onSelect={(power) => {
          if (largestResidualPower !== null) props.onSelectLargestResidual(power, largestResidualPower);
        }}
      />
      <ReportPanel {...props} conditions={conditions} />
    </section>
  );
}

export function SweepPanel({
  sweep,
  onStart,
  onCancel,
  onRetry,
}: Pick<ExperimentReportProps, "sweep"> & {
  onStart(): void;
  onCancel(): void;
  onRetry(): void;
}) {
  const active = sweep !== null && ["ramping", "stabilizing", "sampling"].includes(sweep.status);
  const label = sweep === null ? "未开始" : statusLabel(sweep);

  return (
    <div className="sweep-panel">
      <div>
        <strong>固定序列 30% → 60% → 90%</strong>
        <span>{label}</span>
      </div>
      <div className="sweep-actions">
        <button type="button" disabled={active} onClick={onStart}>
          {sweep === null ? "开始自动扫频" : "重新运行扫频"}
        </button>
        {active && <button type="button" onClick={onCancel}>取消扫频</button>}
        {sweep?.status === "failed" && <button type="button" onClick={onRetry}>重试当前工况</button>}
      </div>
      {sweep?.error && <p className="sweep-error" role="alert">{sweep.error}</p>}
    </div>
  );
}

export function ComparisonTable({
  conditions,
  largestResidualPower,
  selectedLargestResidualPower,
  comparisonReason,
  onComparisonReasonChange,
  onSelect,
}: {
  conditions: ConditionResult[];
  largestResidualPower: SweepPower | null;
  selectedLargestResidualPower: SweepPower | null;
  comparisonReason: string;
  onComparisonReasonChange(value: string): void;
  onSelect(power: SweepPower): void;
}) {
  return (
    <section className="comparison-panel" aria-labelledby="comparison-title">
      <div className="comparison-heading">
        <h3 id="comparison-title">残差对比</h3>
        <p>{CFD_SENSOR_COMPARISON_FORMULA}</p>
        <p>CFD 的压差与动压使用格点单位（lu），虚拟传感器使用 Pa；两侧先各自除以同单位动压，得到无量纲 Cp 后再比较，不能直接把 lu 与 Pa 相减。</p>
        <p>归一化残差 = |ΔCp| ÷ max(|Cp_sensor|, 10⁻⁹) × 100%。CFD 取固定参考窗与车底窗的平均压差，是二维教学代理，不是三维载荷预测。</p>
      </div>
      <div className="comparison-table-wrap">
        <table>
          <thead><tr><th>工况</th><th>CFD Cp</th><th>传感器 Cp</th><th>|ΔCp|</th><th>归一化残差</th><th>求解配置</th><th>判断</th></tr></thead>
          <tbody>
            {conditions.map(({ power, comparison, residual }) => (
              <tr key={power}>
                <th scope="row">{power}%</th>
                <td>{format(comparison.cfdPressureCoefficient, 4)}</td>
                <td>{format(comparison.sensorPressureCoefficient, 4)}</td>
                <td>{format(residual, 6)}</td>
                <td>{format(comparison.normalizedResidualPct, 1)}{comparison.normalizedResidualPct === null ? "" : "%"}</td>
                <td>{formatRuntimeConfigurations(comparison)}</td>
                <td><label><input
                  type="radio"
                  name="largest-residual"
                  disabled={largestResidualPower === null}
                  checked={selectedLargestResidualPower === power}
                  aria-label={`${power}% 为最大残差`}
                  onChange={() => onSelect(power)}
                /> 选择</label></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="comparison-reason" htmlFor="comparison-reason">
        偏差原因
        <textarea
          id="comparison-reason"
          rows={3}
          required
          value={comparisonReason}
          onChange={(event) => onComparisonReasonChange(event.currentTarget.value)}
          placeholder="例如：二维中心截面忽略侧向泄漏、支架干扰与真实三维边界层。"
        />
      </label>
    </section>
  );
}

export function ReportPanel({
  sweep,
  conclusion,
  comparisonReason = "",
  selectedLargestResidualPower = null,
  flowMetadata = null,
  onConclusionChange,
  generatedTime,
  downloadCsv = downloadExperimentCsv,
  serializeCsv = serializeExperimentCsv,
  conditions,
}: ExperimentReportProps & { conditions: ConditionResult[] }) {
  const [failedSnapshot, setFailedSnapshot] = useState<ExportSnapshot | null>(null);
  const remainingCharacters = Math.max(0, 12 - conclusion.trim().length);
  const comparisonsReady = conditions.every(({ comparison }) => comparison.valid);
  const computedLargestResidualPower = findLargestResidualPower(conditions);
  const canExport = sweep?.status === "completed"
    && remainingCharacters === 0
    && comparisonReason.trim().length > 0
    && flowMetadata !== null
    && comparisonsReady
    && selectedLargestResidualPower === computedLargestResidualPower;

  const runExport = (snapshot: ExportSnapshot) => {
    let csv = snapshot.csv;
    if (csv === undefined) {
      try {
        csv = serializeCsv(snapshot.input);
      } catch {
        setFailedSnapshot(snapshot);
        return;
      }
    }
    const serializedSnapshot = { ...snapshot, csv };
    try {
      downloadCsv(csv, snapshot.generatedTime);
      setFailedSnapshot(null);
    } catch {
      setFailedSnapshot(serializedSnapshot);
    }
  };

  const exportReport = () => {
    if (!sweep) return;
    const snapshotTime = generatedTime ?? new Date().toISOString();
    const samples = SWEEP_POWERS.flatMap((power) => (
      (sweep.samplesByPower[power] ?? []).map((sample) => ({ ...sample }))
    ));
    const proxySamples = SWEEP_POWERS.flatMap((power) => (
      (sweep.proxySamplesByPower[power] ?? []).map((sample) => ({
        ...sample,
        runtimeConfiguration: { ...sample.runtimeConfiguration },
      }))
    ));
    const input: ExperimentCsvInput = {
      metadata: {
        generatedTime: snapshotTime,
        conclusion,
        comparisonReason,
        selectedLargestResidualPower,
        computedLargestResidualPower,
        flow: { ...flowMetadata! },
        simulationSeed: 20260818,
        provenance: "simulated",
      },
      samples,
      proxySamples,
      comparisons: conditions.map(({ power, comparison }) => ({
        fanPowerPct: power,
        valid: comparison.valid,
        sampleCount: comparison.sampleCount,
        cfdPressureCoefficient: comparison.cfdPressureCoefficient,
        sensorPressureCoefficient: comparison.sensorPressureCoefficient,
        signedResidual: comparison.signedResidual,
        absoluteResidual: comparison.absoluteResidual,
        normalizedResidualPct: comparison.normalizedResidualPct,
        runtimeConfigurations: comparison.runtimeConfigurations.map((configuration) => ({ ...configuration })),
        mixedRuntimeConfiguration: comparison.mixedRuntimeConfiguration,
        requestedInletVelocityRange: comparison.requestedInletVelocityRange
          ? { ...comparison.requestedInletVelocityRange }
          : null,
        actualInletVelocityRange: comparison.actualInletVelocityRange
          ? { ...comparison.actualInletVelocityRange }
          : null,
      })),
      comparisonFormula: CFD_SENSOR_COMPARISON_FORMULA,
    };
    runExport({ input, generatedTime: snapshotTime });
  };

  return (
    <section className="report-panel" aria-labelledby="conclusion-title">
      <div>
        <label id="conclusion-title" htmlFor="experiment-conclusion">实验结论</label>
        <textarea
          id="experiment-conclusion"
          value={conclusion}
          minLength={12}
          rows={3}
          onChange={(event) => onConclusionChange(event.currentTarget.value)}
        />
        <small>{remainingCharacters > 0 ? `还需 ${remainingCharacters} 个字符` : "已满足至少 12 个字符"}</small>
      </div>
      <div className="report-actions">
        <button type="button" onClick={() => window.print()}>打印报告</button>
        <button type="button" disabled={!canExport} onClick={exportReport}>导出 CSV</button>
        {failedSnapshot && <button type="button" onClick={() => runExport(failedSnapshot)}>重试导出</button>}
      </div>
      <p className="report-runtime-metadata">
        {flowMetadata
          ? `最新接收流场：generation ${flowMetadata.generation} · ${flowMetadata.gridWidth}×${flowMetadata.gridHeight} · τ ${flowMetadata.tau} · inlet ${flowMetadata.requestedInletVelocity.toFixed(4)}→${flowMetadata.actualInletVelocity.toFixed(4)} lu · scale ${flowMetadata.velocityScale.toFixed(2)} · rebuild ${flowMetadata.rebuildReason}`
          : "尚无可冻结的求解器运行元数据"}
        {selectedLargestResidualPower === null ? "" : ` · 已选最大残差 ${selectedLargestResidualPower}%`}
      </p>
      {failedSnapshot && <p className="export-error" role="alert">导出失败，实验数据仍保留</p>}
    </section>
  );
}

type ExportSnapshot = {
  input: ExperimentCsvInput;
  generatedTime: string;
  csv?: string;
};

function ConditionCard({ power, summary }: { power: SweepPower; summary: RunSummary }) {
  return (
    <article className="condition-card">
      <div><h3>{power}%</h3><span className={summary.valid ? "summary-valid" : "summary-invalid"}>{summary.valid ? "有效" : "无效"}</span></div>
      <dl>
        <dt>稳定样本</dt><dd>{summary.sampleCount}</dd>
        <dt>RPM avg ± std</dt><dd>{format(summary.rpm.mean, 0)} ± {format(summary.rpm.standardDeviation, 0)} RPM</dd>
        <dt>RPM min–max</dt><dd>{format(summary.rpm.min, 0)}–{format(summary.rpm.max, 0)} RPM</dd>
        <dt>风速 avg ± std</dt><dd>{format(summary.windSpeedMps.mean, 2)} ± {format(summary.windSpeedMps.standardDeviation, 2)} m/s</dd>
        <dt>风速 min–max</dt><dd>{format(summary.windSpeedMps.min, 2)}–{format(summary.windSpeedMps.max, 2)} m/s</dd>
        <dt>压力 avg ± std</dt><dd>{format(summary.underbodyPressurePa.mean, 1)} ± {format(summary.underbodyPressurePa.standardDeviation, 1)} Pa</dd>
        <dt>压力 min–max</dt><dd>{format(summary.underbodyPressurePa.min, 1)}–{format(summary.underbodyPressurePa.max, 1)} Pa</dd>
        <dt>载荷 avg ± std</dt><dd>{format(summary.verticalLoadN.mean, 3)} ± {format(summary.verticalLoadN.standardDeviation, 3)} N</dd>
        <dt>载荷 min–max</dt><dd>{format(summary.verticalLoadN.min, 3)}–{format(summary.verticalLoadN.max, 3)} N</dd>
      </dl>
    </article>
  );
}

function buildConditionResults(sweep: SweepState | null): ConditionResult[] {
  const baseSummaries = SWEEP_POWERS.map((power) => ({
    power,
    summary: summarizeRun(sweep?.samplesByPower[power] ?? []),
    comparison: summarizeCfdSensorProxySamples(sweep?.proxySamplesByPower[power] ?? []),
  }));
  const comparisonReady = sweep?.status === "completed"
    && baseSummaries.every(({ summary, comparison }) => summary.valid && comparison.valid);
  return baseSummaries.map(({ power, summary, comparison }) => ({
    power,
    summary,
    comparison,
    residual: comparisonReady ? comparison.absoluteResidual : null,
  }));
}

function findLargestResidualPower(conditions: ConditionResult[]): SweepPower | null {
  const available = conditions.filter((condition) => condition.residual !== null);
  if (available.length === 0) return null;
  return available.reduce((largest, condition) => condition.residual! > largest.residual! ? condition : largest).power;
}

function statusLabel(sweep: SweepState): string {
  switch (sweep.status) {
    case "ramping": return `${sweep.commandedPowerPct}%：正在下发功率`;
    case "stabilizing": return `${sweep.commandedPowerPct}%：稳定 ${sweep.stableMs / 1_000}/2.0 s`;
    case "sampling": return `${sweep.commandedPowerPct}%：采样 ${sweep.samplingMs / 1_000}/4.0 s`;
    case "completed": return "30%、60%、90% 均已完成";
    case "failed": return `${sweep.commandedPowerPct}%：稳定超时`;
    case "idle": return "未开始";
  }
}

function format(value: number | null, digits: number): string {
  return value === null ? "—" : value.toFixed(digits);
}

function formatRuntimeConfigurations(summary: CfdSensorProxySummary): string {
  if (summary.runtimeConfigurations.length === 0) return "—";
  const labels = summary.runtimeConfigurations.map((configuration) => (
    `g${configuration.generation} ${configuration.gridWidth}×${configuration.gridHeight} τ${configuration.tau} scale ${configuration.velocityScale.toFixed(2)}${configuration.recovery === "none" ? "" : " recovered"} ${configuration.rebuildReason}`
  ));
  const requested = formatRange(summary.requestedInletVelocityRange);
  const actual = formatRange(summary.actualInletVelocityRange);
  return `${summary.mixedRuntimeConfiguration ? "混合：" : ""}${labels.join("；")}；inlet req ${requested} / actual ${actual} lu`;
}

function formatRange(range: { min: number; max: number } | null): string {
  if (range === null) return "—";
  return range.min === range.max ? range.min.toFixed(4) : `${range.min.toFixed(4)}–${range.max.toFixed(4)}`;
}
