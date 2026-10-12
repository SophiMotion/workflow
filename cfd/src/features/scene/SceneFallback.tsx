type SceneFallbackProps = {
  message?: string;
  announce?: boolean;
};

export function SceneFallback({
  message = "浏览器无法初始化 WebGL，当前显示程序化风洞结构图。",
  announce = false,
}: SceneFallbackProps) {
  return (
    <div className="scene-fallback">
      <svg
        aria-label="模块化数字风洞示意图"
        className="scene-fallback-diagram"
        role="img"
        viewBox="0 0 960 360"
      >
        <defs>
          <linearGradient id="fallback-duct" x1="0" x2="1">
            <stop offset="0" stopColor="#eeeae0" />
            <stop offset="0.56" stopColor="#d9dfdc" stopOpacity="0.28" />
            <stop offset="1" stopColor="#eeeae0" />
          </linearGradient>
          <pattern id="fallback-grid" width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M 34 0 L 0 0 0 34" fill="none" stroke="#24414a" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="960" height="360" fill="#09151a" />
        <rect width="960" height="360" fill="url(#fallback-grid)" opacity="0.55" />
        <g transform="translate(54 105)">
          <path d="M0 30 H180 L275 4 H610 L710 35 H850 V190 H710 L610 222 H275 L180 196 H0 Z" fill="url(#fallback-duct)" stroke="#30383b" strokeWidth="8" />
          <rect x="280" y="5" width="330" height="216" fill="#7ddbd2" fillOpacity="0.08" stroke="#313a3d" strokeWidth="8" />
          <g stroke="#42d8cc" strokeWidth="2" fill="none" opacity="0.85">
            <path d="M80 90 C260 88 360 100 520 82 S710 72 800 76" />
            <path d="M80 116 C260 114 350 108 505 122 S700 132 800 126" />
            <path d="M80 142 C265 142 355 128 505 150 S700 162 800 152" />
          </g>
          <g transform="translate(414 102)">
            <path d="M0 32 L24 6 H116 L152 30 V58 H0 Z" fill="#eeeae0" stroke="#2b3235" strokeWidth="5" />
            <path d="M45 7 L66 -17 H108 L126 7" fill="#a9bcbe" stroke="#2b3235" strokeWidth="5" />
            <circle cx="33" cy="62" r="18" fill="#242a2d" /><circle cx="123" cy="62" r="18" fill="#242a2d" />
          </g>
          <rect x="442" y="174" width="126" height="13" rx="4" fill="#d9473f" />
          <rect x="764" y="34" width="70" height="158" rx="8" fill="#d9473f" fillOpacity="0.75" />
        </g>
        <g fill="#e9f2f3" fontFamily="system-ui, sans-serif" fontSize="16" textAnchor="middle">
          <text x="118" y="84">整流段</text>
          <text x="260" y="84">收缩段</text>
          <text x="490" y="84">透明测试段</text>
          <text x="520" y="326">模型台</text>
          <text x="845" y="84">风扇段</text>
        </g>
      </svg>
      <p role={announce ? "status" : undefined} aria-live={announce ? "polite" : undefined}>
        <strong>示意模式</strong>　{message}
      </p>
      <p><strong>2D TEACHING CFD / 二维教学近似</strong>　仅用于教学趋势观察，不代表完整三维工程 CFD 结论。</p>
    </div>
  );
}
