import { HOTSPOT_IDS, type HotspotId } from "./hotspotTypes";

const HOTSPOT_COPY: Record<HotspotId, { title: string; detail: string }> = {
  straightener: { title: "整流段", detail: "蜂窝格栅削弱横向扰动，让来流更均匀。" },
  contraction: { title: "收缩段", detail: "渐缩流道平顺加速气流并降低入口湍动。" },
  "test-section": { title: "透明测试段", detail: "观察车体周围的速度、压力与尾迹结构。" },
  "model-stand": { title: "模型台", detail: "红色支架定位模型，并代表教学测力平台。" },
  fan: { title: "风扇段", detail: "六叶风扇提供从 x = -6 到 x = 6 的可控来流。" },
};

type HotspotsProps = {
  selected: HotspotId | null;
  onSelect(id: HotspotId): void;
};

export function Hotspots({ selected, onSelect }: HotspotsProps) {
  const active = selected ? HOTSPOT_COPY[selected] : null;

  return (
    <aside className="scene-hotspots" aria-label="风洞模块热点">
      <div className="scene-hotspot-buttons">
        {HOTSPOT_IDS.map((id, index) => (
          <button
            aria-label={`${id}：${HOTSPOT_COPY[id].title}`}
            aria-pressed={selected === id}
            className="scene-hotspot"
            data-hotspot-id={id}
            key={id}
            onClick={() => onSelect(id)}
            type="button"
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {HOTSPOT_COPY[id].title}
          </button>
        ))}
      </div>
      <div className="scene-hotspot-card">
        {active ? (
          <>
            <strong>{active.title}</strong>
            <span>{active.detail}</span>
            {selected === "test-section" && <em>剖视已开启 · 车辆与中心流场保持可见</em>}
          </>
        ) : (
          <span>选择模块，查看风洞构造与教学说明。</span>
        )}
      </div>
    </aside>
  );
}
