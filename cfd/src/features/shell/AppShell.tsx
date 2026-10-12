import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

export type AppShellProps = {
  left: ReactNode;
  scene: ReactNode;
  right: ReactNode;
  bottom: ReactNode;
  headerActions?: ReactNode;
};

type CompactPanel = "tutorial" | "controls" | "charts";

const COMPACT_PANELS: readonly { id: CompactPanel; label: string }[] = [
  { id: "tutorial", label: "教程" },
  { id: "controls", label: "控制" },
  { id: "charts", label: "曲线" },
];

export function AppShell({ left, scene, right, bottom, headerActions }: AppShellProps) {
  const [compactPanel, setCompactPanel] = useState<CompactPanel>("tutorial");
  const [compactLayout, setCompactLayout] = useState(() => (
    typeof window !== "undefined" && window.matchMedia?.("(max-width: 1100px)").matches === true
  ));
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 1100px)");
    if (!query) return;
    const update = () => setCompactLayout(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const selectAdjacentTab = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % COMPACT_PANELS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + COMPACT_PANELS.length) % COMPACT_PANELS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = COMPACT_PANELS.length - 1;
    }
    if (nextIndex === undefined) return;
    event.preventDefault();
    const nextPanel = COMPACT_PANELS[nextIndex]!;
    setCompactPanel(nextPanel.id);
    tabRefs.current[nextIndex]?.focus();
  };
  const enterActivePanel = (event: ReactKeyboardEvent<HTMLButtonElement>, panel: CompactPanel) => {
    if (event.key !== "Tab" || event.shiftKey || !compactLayout || compactPanel !== panel) return;
    const target = document.getElementById(`compact-panel-${panel}`)?.querySelector<HTMLElement>(
      "input:not(:disabled), button:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex='-1'])",
    );
    if (!target) return;
    event.preventDefault();
    target.focus();
  };

  return (
    <div className="app-shell">
      <header className="topbar" role="banner">
        <div>
          <img className="studio-logo" src="data:image/png;base64,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" alt="SophiStudio" />
          <h1>SophiFlow Lab</h1>
        </div>
        <div className="topbar-actions">
          {headerActions}
          <span className="model-scope-badge">2D TEACHING CFD / 二维教学近似</span>
          <span className="provenance-badge">SIMULATED / 模拟数据</span>
        </div>
      </header>
      <div className="compact-panel-tabs" role="tablist" aria-label="窄屏实验面板">
        {COMPACT_PANELS.map((panel, index) => (
          <button
            type="button"
            role="tab"
            aria-controls={`compact-panel-${panel.id}`}
            aria-selected={compactPanel === panel.id}
            id={`compact-tab-${panel.id}`}
            key={panel.id}
            ref={(element) => { tabRefs.current[index] = element; }}
            tabIndex={compactPanel === panel.id ? 0 : -1}
            onClick={() => setCompactPanel(panel.id)}
            onKeyDown={(event) => {
              selectAdjacentTab(event, index);
              enterActivePanel(event, panel.id);
            }}
          >
            {panel.label}
          </button>
        ))}
      </div>
      <nav
        className="tutorial-rail"
        aria-label="教学章节"
        data-compact-active={compactPanel === "tutorial"}
      ><div
        aria-labelledby={compactLayout ? "compact-tab-tutorial" : undefined}
        hidden={compactLayout && compactPanel !== "tutorial"}
        id="compact-panel-tutorial"
        inert={compactLayout && compactPanel !== "tutorial" ? true : undefined}
        role={compactLayout ? "tabpanel" : undefined}
      >{left}</div></nav>
      <main className="scene-panel" aria-label="数字风洞">{scene}</main>
      <aside
        className="control-panel"
        aria-label="实验控制"
        data-compact-active={compactPanel === "controls"}
      ><div
        aria-labelledby={compactLayout ? "compact-tab-controls" : undefined}
        hidden={compactLayout && compactPanel !== "controls"}
        id="compact-panel-controls"
        inert={compactLayout && compactPanel !== "controls" ? true : undefined}
        role={compactLayout ? "tabpanel" : undefined}
      >{right}</div></aside>
      <section
        className="chart-drawer"
        aria-label="实验曲线"
        data-compact-active={compactPanel === "charts"}
      ><div
        aria-labelledby={compactLayout ? "compact-tab-charts" : undefined}
        hidden={compactLayout && compactPanel !== "charts"}
        id="compact-panel-charts"
        inert={compactLayout && compactPanel !== "charts" ? true : undefined}
        role={compactLayout ? "tabpanel" : undefined}
      >{bottom}</div></section>
    </div>
  );
}
