import "@testing-library/jest-dom/vitest";

class TestResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    this.callback([{
      target,
      contentRect: {
        x: 0,
        y: 0,
        top: 0,
        right: 320,
        bottom: 140,
        left: 0,
        width: 320,
        height: 140,
        toJSON: () => ({}),
      },
      borderBoxSize: [{ inlineSize: 320, blockSize: 140 }],
      contentBoxSize: [{ inlineSize: 320, blockSize: 140 }],
      devicePixelContentBoxSize: [{ inlineSize: 320, blockSize: 140 }],
    } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
