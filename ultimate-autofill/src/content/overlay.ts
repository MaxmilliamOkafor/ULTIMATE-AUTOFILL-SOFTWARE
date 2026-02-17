/**
 * Overlay module - injected as web-accessible resource for shadow DOM isolation if needed.
 * Currently the overlay is built inline in main.ts. This file is reserved for future
 * shadow-DOM-based overlay isolation.
 */

// Shadow DOM overlay wrapper (for sites that aggressively reset styles)
export function createIsolatedOverlay(content: string): HTMLElement {
  const host = document.createElement('div');
  host.id = 'ua-overlay-host';
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject our styles into shadow DOM
  const style = document.createElement('style');
  style.textContent = getOverlayStyles();
  shadow.appendChild(style);

  const container = document.createElement('div');
  container.innerHTML = content;
  shadow.appendChild(container);

  return host;
}

function getOverlayStyles(): string {
  return `
    .ua-overlay {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #1a1a2e;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 10px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      max-width: 360px;
      overflow: hidden;
    }
    .ua-overlay-header {
      padding: 10px 14px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
    }
    .ua-suggestion-item {
      padding: 10px 14px;
      border-bottom: 1px solid #f1f3f5;
      cursor: pointer;
    }
    .ua-suggestion-item:hover { background: #f8f9fa; }
    .ua-suggestion-insert {
      padding: 3px 10px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      margin-top: 4px;
    }
  `;
}
