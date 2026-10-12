### Task 1: Project Foundation and Accessible Application Shell

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `eslint.config.js`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.test.tsx`
- Create: `src/test/setup.ts`
- Create: `src/styles/global.css`
- Create: `src/features/shell/AppShell.tsx`

**Interfaces:**
- Consumes: none; this is the project foundation.
- Produces: `AppShellProps { left: ReactNode; scene: ReactNode; right: ReactNode; bottom: ReactNode; headerActions?: ReactNode }`, shared CSS tokens, Vitest commands, and the five named application regions used by later tasks.

- [ ] **Step 1: Create the TypeScript/Vite test harness**

Run:

```bash
npm init -y
npm install react react-dom three @react-three/fiber @react-three/drei zustand recharts lucide-react
npm install -D typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom @types/three @types/node eslint typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals @playwright/test
```

Set these exact scripts in `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "lint": "eslint ."
  }
}
```

Import `defineConfig` from `vitest/config` in `vite.config.ts`, then configure `plugins: [react()]`, `test.environment = "jsdom"`, `test.setupFiles = ["./src/test/setup.ts"]`, and `test.css = true`. Configure `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`, `jsx: "react-jsx"`, `moduleResolution: "Bundler"`, `types: ["vite/client", "vitest/globals", "node"]`, and libraries `ES2022`, `DOM`, and `DOM.Iterable`. Put `/// <reference lib="webworker" />` only at the top of `lbm.worker.ts` to avoid global DOM/Worker declaration conflicts.

Create `eslint.config.js` with `typescript-eslint` recommended rules, React Hooks recommended rules, browser globals for `src/**`, Node globals for `vite.config.ts` and `playwright.config.ts`, and ignores for `dist`, `coverage`, and `playwright-report`. Do not disable `react-hooks/rules-of-hooks` or `react-hooks/exhaustive-deps`.

- [ ] **Step 2: Write the failing shell test**

```tsx
// src/App.test.tsx
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { App } from "./App";

it("renders the five digital wind-tunnel workbench regions", () => {
  render(<App />);
  expect(screen.getByRole("banner")).toHaveTextContent("SophiFlow Lab");
  expect(screen.getByRole("navigation", { name: "教学章节" })).toBeInTheDocument();
  expect(screen.getByRole("main", { name: "数字风洞" })).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "实验控制" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "实验曲线" })).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the test and verify the expected red state**

Run: `npm run test:run -- src/App.test.tsx`

Expected: FAIL because `./App` and the named workbench regions do not exist.

- [ ] **Step 4: Implement the minimal shell and visual tokens**

Use this public shell contract:

```tsx
// src/features/shell/AppShell.tsx
import type { ReactNode } from "react";

export type AppShellProps = {
  left: ReactNode;
  scene: ReactNode;
  right: ReactNode;
  bottom: ReactNode;
  headerActions?: ReactNode;
};

export function AppShell({ left, scene, right, bottom, headerActions }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar" role="banner">
        <div><span className="eyebrow">CFD TEACHING CONSOLE</span><h1>SophiFlow Lab</h1></div>
        <div className="topbar-actions">{headerActions}<span className="provenance-badge">SIMULATED / 模拟数据</span></div>
      </header>
      <nav className="tutorial-rail" aria-label="教学章节">{left}</nav>
      <main className="scene-panel" aria-label="数字风洞">{scene}</main>
      <aside className="control-panel" aria-label="实验控制">{right}</aside>
      <section className="chart-drawer" aria-label="实验曲线">{bottom}</section>
    </div>
  );
}
```

Define CSS tokens `--bg: #071014`, `--panel: #0d181d`, `--panel-raised: #132229`, `--tunnel: #e9e6df`, `--ink: #e9f2f3`, `--muted: #8da3aa`, `--flow: #50e3c2`, `--warning: #f2bd4f`, and `--danger: #e44b43`. Implement a four-area CSS grid with 240 px left rail, flexible scene, 320 px right rail, and 220 px bottom drawer. Do not use gradients.

- [ ] **Step 5: Verify the green state and production build**

Run: `npm run test:run -- src/App.test.tsx`

Expected: PASS, 1 test.

Run: `npm run build`

Expected: exit 0 with a generated `dist/` directory.

- [ ] **Step 6: Commit the foundation if repository integrity permits**

```bash
git add package.json package-lock.json index.html tsconfig.json vite.config.ts eslint.config.js src/main.tsx src/App.tsx src/App.test.tsx src/test/setup.ts src/styles/global.css src/features/shell/AppShell.tsx
git commit -m "feat: scaffold digital wind tunnel web"
```

If the known missing parent-repository blob blocks the commit, preserve the exact staged set and record the command output; do not stage or repair unrelated paths.

---

