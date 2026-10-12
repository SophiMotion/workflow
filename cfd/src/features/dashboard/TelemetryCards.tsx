import { useState } from "react";
import { useLabStore } from "../experiment/labStore";
import type { TelemetryFrame } from "../experiment/model";

export type SensorId = "rpm" | "wind" | "pressure" | "load";

type TelemetryCardsProps = {
  onInspect(sensor: SensorId): void;
};

type TelemetryDefinition = {
  id: SensorId;
  label: string;
  unit: string;
  value(frame: TelemetryFrame): string;
  definition: string;
  simulation: string;
};

const TELEMETRY: readonly TelemetryDefinition[] = [
  {
    id: "rpm",
    label: "风扇转速",
    unit: "RPM",
    value: (frame) => frame.rpm.toFixed(0),
    definition: "风扇每分钟旋转圈数，表示电机与叶轮转速；它不是测试段真实风速。",
    simulation: "目标转速经过一阶惯性响应；当前样本无固定采集延迟，并叠加 ±0.35% 的固定种子确定性噪声，无额外零点漂移。",
  },
  {
    id: "wind",
    label: "来流速度",
    unit: "m/s",
    value: (frame) => frame.windSpeedMps.toFixed(2),
    definition: "测试段入口处空气的实际速度，用于区分风扇转速与真实来流。",
    simulation: "转速先经过第二个一阶惯性环节，再加入 1 个样本（50 ms）延迟与 ±0.5% 固定种子确定性噪声，无额外零点漂移。",
  },
  {
    id: "pressure",
    label: "车底相对压力",
    unit: "Pa",
    value: (frame) => frame.underbodyPressurePa.toFixed(1),
    definition: "车辆底部相对环境的局部压力；负值表示低于参考环境压力。",
    simulation: "由 q = 0.5ρv² 与教学压力系数生成，含 2 个样本（100 ms）延迟、±0.8 Pa 噪声和有界零点漂移。",
  },
  {
    id: "load",
    label: "垂向载荷",
    unit: "N",
    value: (frame) => frame.verticalLoadN.toFixed(3),
    definition: "模型台沿竖直方向测得的合力，和单点车底压力是不同物理量。",
    simulation: "由动压、参考面积与教学升力系数生成，含 2 个样本（100 ms）延迟、±0.015 N 噪声和有界零点漂移。",
  },
];

const QUALITY_LABELS: Record<TelemetryFrame["quality"], string> = {
  transient: "瞬态 / TRANSIENT",
  stable: "稳定 / STABLE",
  invalid: "无效 / INVALID",
};

export function TelemetryCards({ onInspect }: TelemetryCardsProps) {
  const frame = useLabStore((state) => state.telemetry);
  const [openSensor, setOpenSensor] = useState<SensorId | null>(null);

  const toggleExplanation = (sensor: SensorId) => {
    const opening = openSensor !== sensor;
    setOpenSensor(opening ? sensor : null);
    if (opening) onInspect(sensor);
  };

  return (
    <section className="dashboard-section telemetry-section" aria-labelledby="telemetry-title">
      <div className="dashboard-section-heading">
        <div>
          <p className="section-kicker">LIVE TELEMETRY</p>
          <h2 id="telemetry-title">虚拟传感器</h2>
        </div>
        <span className="sample-time">T+{(frame.simulationTimeMs / 1000).toFixed(2)} s</span>
      </div>
      <div className="telemetry-grid">
        {TELEMETRY.map((item) => (
          <article className="telemetry-card" key={item.id}>
            <div className="telemetry-meta">
              <h3>{item.label}</h3>
              <span>SIMULATED</span>
            </div>
            <p className="telemetry-reading">
              <strong>{item.value(frame)}</strong>
              <span>{item.unit}</span>
            </p>
            <div className="telemetry-quality">
              <span>{QUALITY_LABELS[frame.quality]}</span>
              <button
                type="button"
                aria-label={`查看${item.label}说明`}
                aria-expanded={openSensor === item.id}
                aria-controls={`sensor-explanation-${item.id}`}
                onClick={() => toggleExplanation(item.id)}
              >
                {openSensor === item.id ? "收起" : "查看"}
              </button>
            </div>
            {openSensor === item.id && (
              <div
                id={`sensor-explanation-${item.id}`}
                className="sensor-explanation"
                role="region"
                aria-label={`${item.label}传感器说明`}
              >
                <p><strong>定义：</strong>{item.definition}</p>
                <p><strong>单位：</strong>{item.unit}</p>
                <p><strong>采样频率：</strong>20 Hz（每 50 ms 一帧）</p>
                <p><strong>模拟来源：</strong>{item.simulation}</p>
                <small>SIMULATED / 模拟数据，不代表真实硬件测量。</small>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
