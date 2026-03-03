/**
 * Content script - runs on every page.
 * Enhanced with: auto-trigger on ATS detection, smart field guesser,
 * multi-page form handling, CSV queue integration, resume upload,
 * captcha solving, and tailoring-first flow.
 */

import type { ExtMessage, FieldMatchResult, SavedResponse, ATSType } from '../types/index';
import { detectATS } from '../atsDetector/index';
import { getAdapter } from '../adapters/index';
import { matchFields } from '../fieldMatcher/index';
import { findMatches } from '../savedResponses/matcher';
import {
  guessValue, normalizeProfile, loadProfile, getFieldLabel as smartGetLabel,
  isFieldRequired, hasFieldValue, nativeSet, isVisible, realClick,
  getResponseBank, guessFieldValue, NormalizedProfile,
} from '../fieldMatcher/smartGuesser';
import { tryClickSubmitOrNext, detectSuccess, markApplied, NavAction } from './formNavigator';
import { tryResumeUpload } from './resumeUpload';
import { solveCaptcha, watchForCaptchas } from './captchaSolver';

const LOG = (...a: unknown[]) => console.log('[UA]', ...a);
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const $$ = <T extends Element>(s: string): T[] => Array.from(document.querySelectorAll(s));

let isRunning = false;
let observer: MutationObserver | null = null;
let _autoTriggered = false;
let _autoTriggerRunning = false;

// ─── Message handling from background / popup ───
chrome.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
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
  // CSV queue / automation trigger
  if (msg.type === 'TRIGGER_AUTOFILL') {
    runFullAutofill().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  // OptimHire-compatible message: FILL_COMPLEX_FORM
  if (msg.type === 'FILL_COMPLEX_FORM') {
    runFullAutofill().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === 'PING') {
    sendResponse({ ready: true });
  }
  if (msg.type === 'SOLVE_CAPTCHA') {
    solveCaptcha().then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function send(msg: ExtMessage | Record<string, any>): Promise<any> {
  try { return await chrome.runtime.sendMessage(msg); } catch { return null; }
}

async function getResponses(): Promise<SavedResponse[]> {
  const domain = location.hostname;
  const r = await send({ type: 'GET_RESPONSES', payload: { domain } });
  return r?.data || [];
}

// ─── Original autofill (field-by-field with suggestions) ───
async function startAutofill() {
  if (isRunning) return;
  isRunning = true;
  showControlBar();

  const ats = detectATS(document);
  const adapter = getAdapter(ats.type);
  const responses = await getResponses();

  // Initial fill with existing saved responses
  await fillPage(adapter, responses, ats.type);

  // Enhanced: also run the smart guesser for any remaining empty fields
  await enhancedFillPass();

  // Watch for dynamic changes
  observer = new MutationObserver(async (mutations) => {
    if (!isRunning) return;
    const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
    if (hasNewNodes) {
      await fillPage(adapter, responses, ats.type);
      await enhancedFillPass();
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
      send({ type: 'RECORD_USAGE', payload: { id: match.response.id } });
      setTimeout(() => match.field.classList.remove('ua-filled-flash'), 600);
    }
  }
  updateControlBar(filled, matches.length);
}

// ─── Enhanced Fill Pass (Smart Guesser) ───
// Fills any remaining empty fields using the smart guesser profile + response bank
async function enhancedFillPass(): Promise<number> {
  const profile = await loadProfile();
  const responseEntries = await getResponseBank();
  let filled = 0;

  // Text inputs and textareas
  $$<HTMLInputElement | HTMLTextAreaElement>(
    'input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=checkbox]):not([type=radio]),textarea'
  ).forEach(el => {
    if (!isVisible(el) || hasFieldValue(el) || el.classList.contains('ua-filled')) return;
    const label = smartGetLabel(el);
    if (!label) return;
    const val = guessFieldValue(label, profile, el, responseEntries);
    if (val) {
      nativeSet(el, val);
      el.classList.add('ua-filled');
      filled++;
    }
  });

  // Select dropdowns
  $$<HTMLSelectElement>('select').forEach(sel => {
    if (!isVisible(sel) || hasFieldValue(sel) || sel.classList.contains('ua-filled')) return;
    const label = smartGetLabel(sel);
    if (!label) return;
    const val = guessValue(label, profile);
    if (!val) return;
    const opts = Array.from(sel.options);
    // Exact match first
    let match = opts.find(o => (o.textContent || '').trim().toLowerCase() === val.toLowerCase());
    // Partial match
    if (!match) match = opts.find(o => (o.textContent || '').trim().toLowerCase().includes(val.toLowerCase()));
    // For EEO fields, select "Prefer not to say" / "Decline" options
    if (!match) {
      const l = label.toLowerCase();
      if (/gender|ethnic|race|veteran|disabil/i.test(l)) {
        match = opts.find(o => /prefer not|decline|not (wish|want)|choose not/i.test(o.textContent || ''));
      }
    }
    if (match) {
      sel.value = match.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sel.classList.add('ua-filled');
      filled++;
    }
  });

  // Radio button groups
  const radioGroups = new Map<string, HTMLInputElement[]>();
  $$<HTMLInputElement>('input[type=radio]').forEach(r => {
    if (!isVisible(r)) return;
    const name = r.name;
    if (!name) return;
    if (!radioGroups.has(name)) radioGroups.set(name, []);
    radioGroups.get(name)!.push(r);
  });
  for (const [name, radios] of radioGroups) {
    if (radios.some(r => r.checked)) continue; // Already selected
    const label = smartGetLabel(radios[0]) || name;
    const val = guessValue(label, profile);
    if (!val) continue;
    for (const radio of radios) {
      const radioLabel = (radio.closest('label')?.textContent || radio.value || '').trim().toLowerCase();
      if (radioLabel.includes(val.toLowerCase()) || (val.toLowerCase() === 'yes' && /yes|true|accept/i.test(radioLabel))) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
        break;
      }
    }
  }

  // Agreement checkboxes
  $$<HTMLInputElement>('input[type=checkbox]').forEach(cb => {
    if (cb.checked || !isVisible(cb)) return;
    const label = smartGetLabel(cb);
    if (/agree|acknowledge|certif|attest|confirm|consent|accept|terms|privacy/i.test(label)) {
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
      filled++;
    }
  });

  return filled;
}

// ─── Full Autofill (for CSV queue / auto-trigger) ───
// Runs the complete pipeline: ATS fill → enhanced fill → resume upload → captcha → submit/next
async function runFullAutofill(): Promise<void> {
  LOG('Starting full autofill pipeline');
  const ats = detectATS(document);
  const adapter = getAdapter(ats.type);
  const responses = await getResponses();
  const initialUrl = location.href;
  let submitClickedTs = 0;
  let reported = false;

  const MAX_PAGES = 10;
  const checkAndReport = () => {
    if (reported) return;
    const result = detectSuccess(initialUrl, submitClickedTs);
    if (result === 'success') {
      reported = true;
      markApplied();
      send({ type: 'COMPLEX_FORM_SUCCESS', message: 'Application submitted successfully' } as any);
      LOG('Application submitted successfully!');
    } else if (result === 'duplicate') {
      reported = true;
      send({ type: 'COMPLEX_FORM_ERROR', errorType: 'alreadyApplied', message: 'Already applied to this job' } as any);
      LOG('Already applied to this job');
    }
  };

  // Watch for success via MutationObserver
  const successObserver = new MutationObserver(checkAndReport);
  successObserver.observe(document.body, { childList: true, subtree: true });
  const successInterval = setInterval(checkAndReport, 3000);
  checkAndReport(); // Initial check

  // Wait for page to settle
  await sleep(3000);

  // Notify sidebar
  send({ type: 'SIDEBAR_STATUS', event: 'filling_form', atsName: ats.type, url: location.href } as any);

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (reported) break;
    LOG(`── Page ${page}/${MAX_PAGES}: Filling fields ──`);

    // 1. ATS-specific fill via adapter
    await fillPage(adapter, responses, ats.type);

    // 2. Enhanced fill (smart guesser for missed fields)
    await enhancedFillPass();

    // 3. Resume upload
    await tryResumeUpload();

    // 4. Captcha solving
    await solveCaptcha();

    // 5. Wait and retry for lazy-rendered fields
    await sleep(2000);
    if (reported) break;
    await enhancedFillPass();

    // 6. Count missing required fields
    const missingCount = countMissingRequired();

    // 7. Click submit or next
    await sleep(1000);
    if (reported) break;
    const action = await tryClickSubmitOrNext(missingCount);

    if (action === 'submitted') {
      LOG('Submit clicked — waiting for success confirmation');
      submitClickedTs = Date.now();
      for (let i = 0; i < 15; i++) {
        await sleep(1000);
        if (reported) break;
        checkAndReport();
      }
      if (!reported) {
        LOG('No success confirmation after 15s — reporting done (submit was clicked)');
        reported = true;
        markApplied();
        send({ type: 'COMPLEX_FORM_SUCCESS', message: 'Application submitted (submit clicked)' } as any);
      }
      break;
    } else if (action === 'next_page') {
      LOG('Next/Continue clicked — waiting for page transition');
      await sleep(3000);
      continue; // Loop to fill next page
    } else {
      LOG('No submit/next button found — final fill attempt');
      await sleep(2000);
      await enhancedFillPass();
      const retry = await tryClickSubmitOrNext(0);
      if (retry === 'submitted') {
        submitClickedTs = Date.now();
        for (let i = 0; i < 10; i++) {
          await sleep(1000);
          if (reported) break;
          checkAndReport();
        }
        if (!reported) {
          reported = true;
          markApplied();
          send({ type: 'COMPLEX_FORM_SUCCESS', message: 'Application submitted (final attempt)' } as any);
        }
      }
      break;
    }
  }

  // Cleanup
  successObserver.disconnect();
  clearInterval(successInterval);
  LOG('Full autofill pipeline complete');
}

function countMissingRequired(): number {
  let count = 0;
  $$<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input:not([type=hidden]):not([type=submit]):not([type=button]),textarea,select'
  ).forEach(el => {
    if (!isVisible(el)) return;
    if (isFieldRequired(el) && !hasFieldValue(el)) count++;
  });
  return count;
}

// ─── Auto-Trigger on ATS Detection ───
// When the user lands on a supported ATS application page, automatically starts filling.

async function autoTriggerAutofill(): Promise<void> {
  if (_autoTriggerRunning || _autoTriggered) return;

  // Check if auto-trigger is enabled
  const { ua_autoTrigger } = await chrome.storage.local.get('ua_autoTrigger');
  if (ua_autoTrigger === false) return;

  // Don't auto-trigger if CSV queue is managing this tab
  const { csvActiveJobId } = await chrome.storage.local.get('csvActiveJobId');
  if (csvActiveJobId) return;

  const ats = detectATS(document);
  if (ats.confidence < 0.3) return; // Not an ATS page

  // Check if this is actually an application form
  if (!isApplicationPage(ats.type)) {
    LOG(`Auto-trigger: ${ats.type} detected but no application form yet`);
    return;
  }

  _autoTriggerRunning = true;
  _autoTriggered = true;
  LOG(`Auto-trigger: ${ats.type} application form detected — starting autofill`);

  showControlBar();
  updateControlBar(0, 0);
  const statusEl = document.getElementById('ua-fill-status');
  if (statusEl) statusEl.textContent = `${ats.type} detected — autofilling...`;

  try {
    isRunning = true;
    const adapter = getAdapter(ats.type);
    const responses = await getResponses();

    // Fill page
    await fillPage(adapter, responses, ats.type);
    await enhancedFillPass();
    await tryResumeUpload();
    await solveCaptcha();

    // Retry after 3s for lazy-rendering fields
    await sleep(3000);
    await enhancedFillPass();

    if (statusEl) statusEl.textContent = 'Autofill complete';
    LOG('Auto-trigger: complete');
  } catch (err) {
    LOG('Auto-trigger: error', err);
  } finally {
    _autoTriggerRunning = false;
  }
}

function isApplicationPage(atsType: ATSType): boolean {
  const url = location.href.toLowerCase();
  const path = location.pathname.toLowerCase();

  // URL-based detection
  if (/\/apply|\/application|\/jobs\/\d|\/requisition/i.test(path)) return true;

  // ATS-specific
  if (atsType === 'workday') {
    return url.includes('/apply') || document.querySelectorAll('[data-automation-id]').length > 2;
  }
  if (atsType === 'greenhouse') {
    return !!document.querySelector('#application_form,form[action*="greenhouse"],[data-provided-by="greenhouse"]');
  }
  if (atsType === 'lever') {
    return !!document.querySelector('.posting-apply,.postings-form,.application-form');
  }
  if (atsType === 'icims') {
    return document.querySelectorAll('input:not([type=hidden])').length > 2;
  }
  if (atsType === 'smartrecruiters') {
    return url.includes('/apply') || document.querySelectorAll('input[name]').length > 2;
  }
  if (atsType === 'taleo') {
    return url.includes('/apply') || !!document.querySelector('#OracleFusionApp,oracle-apply-flow');
  }

  // Generic: check for Apply button or form with name/email inputs
  const hasApply = $$<HTMLElement>('a, button, [role="button"]').some(el => {
    const t = (el.textContent || '').trim().toLowerCase();
    return /^(apply|apply now|apply directly|easy apply)\b/.test(t) && isVisible(el);
  });
  if (hasApply) return true;

  const hasName = !!document.querySelector('input[name*="name" i],input[autocomplete="given-name"]');
  const hasEmail = !!document.querySelector('input[type="email"],input[name*="email" i],input[autocomplete="email"]');
  return hasName && hasEmail;
}

// ─── SPA Navigation Watcher ───
let _lastHref = location.href;
setInterval(() => {
  if (location.href !== _lastHref) {
    _lastHref = location.href;
    _autoTriggered = false;
    _autoTriggerRunning = false;
    sleep(2000).then(() => autoTriggerAutofill());
  }
}, 1000);

// ─── DOM Mutation Watcher for auto-trigger ───
let _mutationDebounce: ReturnType<typeof setTimeout> | null = null;
const _autoTriggerObserver = new MutationObserver(mutations => {
  if (_autoTriggered || _autoTriggerRunning) return;
  const added = mutations.reduce((n, m) => n + m.addedNodes.length, 0);
  if (added < 2) return;
  if (_mutationDebounce) clearTimeout(_mutationDebounce);
  _mutationDebounce = setTimeout(() => autoTriggerAutofill(), 1500);
});
if (document.body) {
  _autoTriggerObserver.observe(document.body, { childList: true, subtree: true });
}

// Initial auto-trigger after page load
sleep(2500).then(() => autoTriggerAutofill());

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

document.addEventListener('focusin', async (e) => {
  const el = e.target as HTMLElement;
  if (!isTextareaLike(el)) return;
  const label = getFieldLabel(el);
  if (!label) return;
  const r = await send({ type: 'GET_SUGGESTIONS', payload: { query: label, domain: location.hostname } });
  if (r?.ok && r.data?.length) {
    showSuggestionOverlay(el, r.data, label);
  }
}, true);

document.addEventListener('focusout', (e) => {
  setTimeout(() => {
    const overlay = document.getElementById('ua-suggestion-overlay');
    if (overlay && !overlay.matches(':hover')) overlay.remove();
  }, 200);
}, true);

function isTextareaLike(el: HTMLElement): boolean {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el.contentEditable === 'true') return true;
  if (el instanceof HTMLInputElement && el.type === 'text') {
    const label = getFieldLabel(el);
    if (label && label.length > 30) return true;
  }
  return false;
}

function getFieldLabel(el: HTMLElement): string | null {
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

LOG('v2.0 loaded — enhanced autofill ready');
