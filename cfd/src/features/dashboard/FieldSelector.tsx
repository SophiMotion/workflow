import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useLabStore, type LabState } from "../experiment/labStore";
import { qualityProfile, type QualityProfile } from "../shell/quality";

export type FieldId = LabState["selectedField"];

type FieldSelectorProps = {
  onInspect(field: FieldId): void;
  quality?: QualityProfile;
};

const FIELDS: readonly { id: FieldId; label: string; english: string }[] = [
  { id: "speed", label: "速度", english: "VELOCITY" },
  { id: "pressure", label: "压力", english: "PRESSURE" },
  { id: "vorticity", label: "涡量", english: "VORTICITY" },
  { id: "streamlines", label: "流线", english: "STREAMLINES" },
];

const FLOW_STATUS: Record<LabState["flowStatus"], string> = {
  idle: "待机 / IDLE",
  loading: "求解中 / SOLVING",
  ready: "流场就绪 / READY",
  failed: "求解失败 / FAILED",
};

export function FieldSelector({ onInspect, quality = qualityProfile("medium") }: FieldSelectorProps) {
  const selectedField = useLabStore((state) => state.selectedField);
  const selectField = useLabStore((state) => state.selectField);
  const flowStatus = useLabStore((state) => state.flowStatus);
  const flowField = useLabStore((state) => state.flowField);
  const flowMetadata = useLabStore((state) => state.flowMetadata);
  const fieldReady = flowStatus === "ready" && flowField !== null && flowMetadata !== null;

  const select = (field: FieldId) => {
    if (!fieldReady) return;
    selectField(field);
    onInspect(field);
  };

  const moveSelection = (event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % FIELDS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + FIELDS.length) % FIELDS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = FIELDS.length - 1;
    }
    if (nextIndex === undefined) return;

    event.preventDefault();
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='radio']");
    buttons?.[nextIndex]?.focus();
    select(FIELDS[nextIndex]!.id);
  };

  return (
    <section className="dashboard-section field-section" aria-labelledby="field-selector-title">
      <div className="dashboard-section-heading">
        <div>
          <p className="section-kicker">FIELD SELECTOR</p>
          <h2 id="field-selector-title">场变量选择</h2>
        </div>
      </div>
      <div className="field-options" role="radiogroup" aria-label="场变量选择">
        {FIELDS.map((field, index) => (
          <button
            type="button"
            role="radio"
            aria-label={field.label}
            aria-checked={selectedField === field.id}
            disabled={!fieldReady}
            tabIndex={selectedField === field.id ? 0 : -1}
            className={selectedField === field.id ? "field-selected" : undefined}
            key={field.id}
            onClick={() => select(field.id)}
            onKeyDown={(event) => moveSelection(event, index)}
          >
            <span>{field.label}</span>
            <small>{field.english}</small>
          </button>
        ))}
      </div>
      {!fieldReady && <p className="field-evidence-notice">等待真实二维流场后可记录观察证据。</p>}
      <dl className="solver-status" aria-label="二维求解器状态">
        <div><dt>求解器</dt><dd>D2Q9 BGK</dd></div>
        <div><dt>活动质量</dt><dd>{quality.name.toUpperCase()}</dd></div>
        <div><dt>已接收网格</dt><dd>{flowMetadata ? `${flowMetadata.gridWidth} × ${flowMetadata.gridHeight}` : "等待首个有效场"}</dd></div>
        <div><dt>松弛参数</dt><dd>{flowMetadata ? `τ = ${flowMetadata.tau.toFixed(3)}` : "—"}</dd></div>
        <div><dt>求解代次</dt><dd>{flowMetadata ? `GEN ${flowMetadata.generation}` : "—"}</dd></div>
        <div>
          <dt>请求 → 实际入口</dt>
          <dd>{flowMetadata
            ? `${flowMetadata.requestedInletVelocity.toFixed(4)} → ${flowMetadata.actualInletVelocity.toFixed(4)} lu (${Math.round(flowMetadata.velocityScale * 100)}%)`
            : "—"}</dd>
        </div>
        <div>
          <dt>数值恢复</dt>
          <dd>{flowMetadata?.recovery === "non-finite-field-scale" ? "NON_FINITE_FIELD 受控缩放" : "无 / NONE"}</dd>
        </div>
        <div>
          <dt>重建原因</dt>
          <dd>{flowMetadata ? flowMetadata.rebuildReason.toUpperCase().replaceAll("-", "_") : "—"}</dd>
        </div>
        <div><dt>流场状态</dt><dd>{FLOW_STATUS[flowStatus]}</dd></div>
        <div><dt>模型范围</dt><dd>二维教学近似</dd></div>
      </dl>
    </section>
  );
}
