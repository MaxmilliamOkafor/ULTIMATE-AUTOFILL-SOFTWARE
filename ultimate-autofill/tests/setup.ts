const store: Record<string, unknown> = {};

const chromeMock = {
  storage: {
    local: {
      get: jest.fn((keys: string | string[]) => {
        if (typeof keys === 'string') return Promise.resolve({ [keys]: store[keys] });
        const r: Record<string, unknown> = {};
        for (const k of Array.isArray(keys) ? keys : [keys]) if (k in store) r[k] = store[k];
        return Promise.resolve(r);
      }),
      set: jest.fn((items: Record<string, unknown>) => { Object.assign(store, items); return Promise.resolve(); }),
      remove: jest.fn((keys: string | string[]) => { for (const k of (typeof keys === 'string' ? [keys] : keys)) delete store[k]; return Promise.resolve(); }),
    },
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
    getURL: jest.fn((p: string) => `chrome-extension://test/${p}`),
  },
  tabs: { create: jest.fn(), query: jest.fn(), sendMessage: jest.fn() },
  scripting: { executeScript: jest.fn() },
};

Object.defineProperty(globalThis, 'chrome', { value: chromeMock, writable: true });

// Polyfill CSS.escape for jsdom
if (typeof CSS === 'undefined') {
  (globalThis as any).CSS = {
    escape: (s: string) => s.replace(/([^\w-])/g, '\\$1'),
  };
} else if (!CSS.escape) {
  CSS.escape = (s: string) => s.replace(/([^\w-])/g, '\\$1');
}
