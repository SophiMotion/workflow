import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  failed: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("SophiFlow application render failure", error, info);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="application-fallback" role="alert" aria-live="polite">
        <p className="eyebrow">SOPHIFLOW RECOVERY</p>
        <h1>界面渲染失败</h1>
        <p>遥测与实验数据仍保留在当前页面内存中。请重新加载实验台以恢复界面。</p>
        <p className="fallback-declarations">
          <span>2D TEACHING CFD / 二维教学近似</span>
          <span>SIMULATED / 模拟数据</span>
        </p>
        <button type="button" onClick={() => window.location.reload()}>重新加载实验台</button>
      </main>
    );
  }
}
