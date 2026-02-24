/**
 * Content script - runs on every page.
 * Handles autofill orchestration, ATS detection, and MutationObserver for dynamic pages.
 */

import type { ExtMessage, FieldMatchResult, SavedResponse, ATSType } from '../types/index';
import { detectATS } from '../atsDetector/index';
import { getAdapter } from '../adapters/index';
import { matchFields } from '../fieldMatcher/index';
import { findMatches } from '../savedResponses/matcher';

let isRunning = false;
let observer: MutationObserver | null = null;

// ─── Message handling from background / popup ───
chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
  if (msg.type === 'START_AUTOFILL') {
    startAutofill().then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === 'STOP_AUTOFILL') {
    stopAutofill();
    sendResponse({ ok: true });
  }
  if (msg.type === 'DETECT_ATS') {
    const result = detectATS(document);
    sendResponse(result);
  }
});

async function send(msg: ExtMessage): Promise<any> {
  return chrome.runtime.sendMessage(msg);
}

async function getResponses(): Promise<SavedResponse[]> {
  const domain = location.hostname;
  const r = await send({ type: 'GET_RESPONSES', payload: { domain } });
  return r?.data || [];
}

async function startAutofill() {
  if (isRunning) return;
  isRunning = true;

  showControlBar();

  const ats = detectATS(document);
  const adapter = getAdapter(ats.type);
  const responses = await getResponses();

  // Initial fill
  await fillPage(adapter, responses, ats.type);

  // Watch for dynamic changes
  observer = new MutationObserver(async (mutations) => {
    if (!isRunning) return;
    // Only re-fill if new nodes were added
    const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
    if (hasNewNodes) {
      await fillPage(adapter, responses, ats.type);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function stopAutofill() {
  isRunning = false;
  if (observer) { observer.disconnect(); observer = null; }
  removeControlBar();
}

async function fillPage(adapter: ReturnType<typeof getAdapter>, responses: SavedResponse[], atsType: ATSType) {
  const fields = adapter.getFields(document);
  const domain = location.hostname;
  const matches = matchFields(fields, responses, { domain, atsType });

  let filled = 0;
  for (const match of matches) {
    if (!isRunning) break;
    if (isAlreadyFilled(match.field)) continue;

    const ok = await adapter.fillField(match.field, match.response.response);
    if (ok) {
      filled++;
      match.field.classList.add('ua-filled');
      match.field.classList.add('ua-filled-flash');

      // Record usage
      send({ type: 'RECORD_USAGE', payload: { id: match.response.id } });

      // Remove flash after animation
      setTimeout(() => match.field.classList.remove('ua-filled-flash'), 600);
    }
  }

  updateControlBar(filled, matches.length);
}

function isAlreadyFilled(el: HTMLElement): boolean {
  if (el.classList.contains('ua-filled')) return true;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value.trim().length > 0;
  }
  if (el instanceof HTMLSelectElement) {
    return el.selectedIndex > 0;
  }
  return false;
}

// ─── Control Bar (floating UI) ───

function showControlBar() {
  removeControlBar();
  const bar = document.createElement('div');
  bar.id = 'ua-control-bar';
  bar.className = 'ua-control-bar';
  bar.innerHTML = `
    <span class="ua-status">Ultimate Autofill</span>
    <span id="ua-fill-status" style="font-size:12px;color:#868e96;">Scanning...</span>
    <button class="ua-btn-stop" id="ua-btn-stop">Stop</button>
  `;
  document.body.appendChild(bar);

  bar.querySelector('#ua-btn-stop')?.addEventListener('click', () => {
    stopAutofill();
  });
}

function updateControlBar(filled: number, total: number) {
  const el = document.getElementById('ua-fill-status');
  if (el) el.textContent = `${filled}/${total} fields filled`;
}

function removeControlBar() {
  document.getElementById('ua-control-bar')?.remove();
}

// ─── Overlay for textarea / question suggestions ───
// Attach focus listener to show suggestions on textareas and long text inputs

document.addEventListener('focusin', async (e) => {
  const el = e.target as HTMLElement;
  if (!isTextareaLike(el)) return;

  // Get label/question for this field
  const label = getFieldLabel(el);
  if (!label) return;

  const r = await send({ type: 'GET_SUGGESTIONS', payload: { query: label, domain: location.hostname } });
  if (r?.ok && r.data?.length) {
    showSuggestionOverlay(el, r.data, label);
  }
}, true);

document.addEventListener('focusout', (e) => {
  // Delay removal to allow click on suggestion
  setTimeout(() => {
    const overlay = document.getElementById('ua-suggestion-overlay');
    if (overlay && !overlay.matches(':hover')) overlay.remove();
  }, 200);
}, true);

function isTextareaLike(el: HTMLElement): boolean {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el.contentEditable === 'true') return true;
  if (el instanceof HTMLInputElement && el.type === 'text') {
    // Heuristic: if the field seems to expect a long answer
    const label = getFieldLabel(el);
    if (label && label.length > 30) return true;
  }
  return false;
}

function getFieldLabel(el: HTMLElement): string | null {
  // Check label
  if (el.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl?.textContent?.trim()) return lbl.textContent.trim();
  }
  const wrap = el.closest('label');
  if (wrap?.textContent?.trim()) return wrap.textContent.trim();
  const al = el.getAttribute('aria-label');
  if (al?.trim()) return al.trim();
  const ph = (el as HTMLInputElement).placeholder;
  if (ph?.trim()) return ph.trim();
  return null;
}

function showSuggestionOverlay(target: HTMLElement, suggestions: any[], label: string) {
  // Remove existing
  document.getElementById('ua-suggestion-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ua-suggestion-overlay';
  overlay.className = 'ua-overlay';

  const rect = target.getBoundingClientRect();
  overlay.style.top = `${rect.bottom + window.scrollY + 4}px`;
  overlay.style.left = `${rect.left + window.scrollX}px`;

  let html = `<div class="ua-overlay-header">
    <span>Suggestions for: ${escapeHtml(label.slice(0, 40))}</span>
    <button class="ua-overlay-close" id="ua-close-overlay">&times;</button>
  </div><div class="ua-suggestion-list">`;

  for (const s of suggestions) {
    const resp = s.response;
    const preview = resp.response.length > 120 ? resp.response.slice(0, 120) + '...' : resp.response;
    html += `<div class="ua-suggestion-item" data-response-id="${escapeHtml(resp.id)}">
      <div class="ua-suggestion-question">${escapeHtml(resp.question)}</div>
      <div class="ua-suggestion-response">${escapeHtml(preview)}</div>
      <div class="ua-suggestion-meta">Score: ${(s.score * 100).toFixed(0)}% | Used ${resp.appearances}x</div>
      <button class="ua-suggestion-insert" data-value="${escapeAttr(resp.response)}" data-id="${escapeHtml(resp.id)}">Insert</button>
    </div>`;
  }

  html += '</div>';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  // Event handlers
  overlay.querySelector('#ua-close-overlay')?.addEventListener('click', () => overlay.remove());

  overlay.querySelectorAll('.ua-suggestion-insert').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const value = (btn as HTMLElement).dataset.value || '';
      const id = (btn as HTMLElement).dataset.id || '';
      insertValue(target, value);
      send({ type: 'RECORD_USAGE', payload: { id } });
      overlay.remove();
    });
  });
}

function insertValue(el: HTMLElement, value: string) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
    )?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (el.contentEditable === 'true') {
    el.textContent = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  el.classList.add('ua-filled');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
