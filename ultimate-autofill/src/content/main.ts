/**
 * Content script - runs on every page.
 * Handles autofill orchestration, ATS detection, universal form detection,
 * AI tailoring, answer bank learning, fallback filling, multi-page form
 * handling, success detection, Workday automation, one-click queue button,
 * auto-apply, and MutationObserver for dynamic pages.
 */

import type { ExtMessage, FieldMatchResult, SavedResponse, ATSType, TailoringContext } from '../types/index';
import { detectATS, isApplicationPage, hasApplicationForm } from '../atsDetector/index';
import { getAdapter } from '../adapters/index';
import { matchFields } from '../fieldMatcher/index';
import { findMatches } from '../savedResponses/matcher';
import { extractJobContext, tailorResponse } from '../autoApply/tailoring';
import { loadAnswerBank, learnFromPage, loadProfile } from '../answerBank/index';
import { fallbackFill, getMissingRequired } from '../smartFill/fallbackFiller';
import { checkSuccess, findNextButton, findSubmitButton as findSubmitBtn } from '../smartFill/successDetector';
import { multiPageLoop, autoSubmitOrNext } from '../smartFill/multiPageHandler';
import { workdayNavigateToForm, isWorkdayPage } from '../smartFill/workdayAutomation';

let isRunning = false;
let observer: MutationObserver | null = null;
let autoApplyJobId: string | null = null;
let autoSubmitEnabled = false;

// Anti-loop protection: track which pages we've already auto-detected
const autoDetectedPages = new Set<string>();

// One-click button state
let queueButtonInjected = false;

// ─── Message handling from background / popup ───
chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
  if (msg.type === 'START_AUTOFILL') {
    const payload = msg.payload as any;
    autoSubmitEnabled = payload?.autoSubmit || false;
    autoApplyJobId = payload?.jobId || null;
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
  if (msg.type === 'AUTO_DETECT_FILL') {
    handleAutoDetectFill().then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
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

/**
 * Auto-detect ATS (or any application form) and immediately start autofill.
 * Works on ALL supported ATS platforms AND unknown company career sites.
 */
async function handleAutoDetectFill() {
  const pageKey = location.href;

  // Anti-loop: don't re-detect the same page
  if (autoDetectedPages.has(pageKey)) return;
  autoDetectedPages.add(pageKey);

  const ats = detectATS(document);

  // Accept known ATS, company sites, AND any page with an application form
  const isKnownATS = ats.type !== 'generic' && ats.confidence >= 0.3;
  const isCompanySite = ats.type === 'companysite' && ats.confidence >= 0.3;
  const hasForm = hasApplicationForm(document);

  if (!isKnownATS && !isCompanySite && !hasForm) {
    // Still inject the one-click button if this looks remotely like a job page
    maybeInjectQueueButton();
    return;
  }

  // Check credits (always unlimited)
  const credits = await send({ type: 'CHECK_CREDITS' });
  if (!credits?.ok || (!credits.data?.unlimited && credits.data?.remaining <= 0)) return;

  // Load answer bank for this session
  await loadAnswerBank();

  // Auto-start autofill
  if (!isRunning) {
    await startAutofill();
  }

  // Always inject the one-click queue button on job pages
  maybeInjectQueueButton();
}

async function startAutofill() {
  if (isRunning) return;
  isRunning = true;

  showControlBar();

  // Load answer bank
  await loadAnswerBank();

  const ats = detectATS(document);
  const adapter = getAdapter(ats.type);
  const responses = await getResponses();

  // Extract job context for AI tailoring
  const jobContext = extractJobContext(document);

  // Workday-specific: navigate to the form first
  if (isWorkdayPage(location.href)) {
    updateControlBar(0, 0, 'Navigating Workday form...');
    const reached = await workdayNavigateToForm(document);
    if (!reached) {
      updateControlBar(0, 0, 'Workday form not found - trying direct fill');
    }
  }

  // Initial fill with tailoring
  const fillResult = await fillPage(adapter, responses, ats.type, jobContext);

  // Fallback fill to catch fields the primary autofill missed
  const profile = await loadProfile();
  await randomDelay(500, 1000);
  const fallbackCount = await fallbackFill(document, profile);
  if (fallbackCount > 0) {
    updateControlBar(fillResult.filled + fallbackCount, fillResult.total + fallbackCount, `${fillResult.filled + fallbackCount} fields filled (${fallbackCount} by smart fill)`);
  }

  // Watch for dynamic changes (multi-step forms)
  observer = new MutationObserver(async (mutations) => {
    if (!isRunning) return;
    const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
    if (hasNewNodes) {
      await fillPage(adapter, responses, ats.type, jobContext);
      // Run fallback on new content too
      await fallbackFill(document, profile);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Auto-submit if enabled
  if (autoSubmitEnabled && (fillResult.filled > 0 || fallbackCount > 0)) {
    await handleAutoSubmitFlow(ats.type, fillResult.filled + fallbackCount, fillResult.total + fallbackCount, adapter, responses, jobContext, profile);
  }
}

/**
 * Enhanced auto-submit flow with multi-page support and success detection.
 */
async function handleAutoSubmitFlow(
  atsType: ATSType,
  filledCount: number,
  totalCount: number,
  adapter: ReturnType<typeof getAdapter>,
  responses: SavedResponse[],
  jobContext: TailoringContext,
  profile: Awaited<ReturnType<typeof loadProfile>>,
) {
  if (!autoSubmitEnabled) return;

  // Wait for any dynamic updates to settle
  await randomDelay(1000, 2000);

  // Check if resume is required but missing
  const resumeInput = document.querySelector('input[type="file"][accept*=".pdf"], input[type="file"][accept*=".doc"], input[name*="resume"], input[name*="cv"]');
  if (resumeInput && !(resumeInput as HTMLInputElement).files?.length) {
    const settingsR = await send({ type: 'GET_SETTINGS' });
    if (settingsR?.ok && settingsR.data?.autoApply?.requireResumeForSubmit) {
      updateControlBar(filledCount, totalCount, 'Resume required - manual upload needed');
      reportCompletion('needs_input');
      return;
    }
  }

  // Use multi-page handler for the full flow
  const fillPageFn = async () => {
    const result = await fillPage(adapter, responses, atsType, jobContext);
    const fb = await fallbackFill(document, profile);
    return result.filled + fb;
  };

  const result = await multiPageLoop(document, fillPageFn, profile);

  if (result.success) {
    updateControlBar(result.totalFieldsFilled, result.totalFieldsFilled, 'Application submitted successfully!');
    reportCompletion('applied');
  } else if (result.finalAction === 'submitted') {
    // Submitted but couldn't confirm success
    updateControlBar(result.totalFieldsFilled, result.totalFieldsFilled, 'Application submitted!');
    reportCompletion('applied');
  } else if (result.finalAction === 'next_page') {
    updateControlBar(result.totalFieldsFilled, result.totalFieldsFilled, `Processed ${result.pagesProcessed} pages`);
    reportCompletion('prefilled');
  } else {
    // Check for success one more time
    if (checkSuccess(document)) {
      updateControlBar(result.totalFieldsFilled, result.totalFieldsFilled, 'Application submitted!');
      reportCompletion('applied');
    } else {
      updateControlBar(result.totalFieldsFilled, result.totalFieldsFilled, 'Form filled - manual review needed');
      reportCompletion('needs_input');
    }
  }

  // Learn from the final page state
  await learnFromPage(document);
}

function stopAutofill() {
  isRunning = false;
  if (observer) { observer.disconnect(); observer = null; }
  removeControlBar();
}

async function fillPage(
  adapter: ReturnType<typeof getAdapter>,
  responses: SavedResponse[],
  atsType: ATSType,
  jobContext: TailoringContext,
): Promise<{ filled: number; total: number }> {
  const fields = adapter.getFields(document);
  const domain = location.hostname;
  const matches = matchFields(fields, responses, { domain, atsType });

  // Load tailoring settings
  let tailoringSettings: any = null;
  try {
    const settingsR = await send({ type: 'GET_SETTINGS' });
    if (settingsR?.ok) tailoringSettings = settingsR.data?.tailoring;
  } catch {}

  let filled = 0;
  for (const match of matches) {
    if (!isRunning) break;
    if (isAlreadyFilled(match.field)) continue;

    // Human-like pacing: small random delay between fields
    await randomDelay(50, 200);

    // ─── AI Tailoring: tailor the response to fit the job context ───
    let responseText = match.response.response;
    if (tailoringSettings?.enabled && jobContext.jobTitle) {
      const fieldLabel = match.signals.find((s) => s.source === 'label-for' || s.source === 'label-wrap' || s.source === 'aria-label')?.value || '';
      const tailored = tailorResponse(responseText, fieldLabel, jobContext, tailoringSettings);
      responseText = tailored.tailoredResponse;
    }

    const ok = await adapter.fillField(match.field, responseText);
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
  return { filled, total: matches.length };
}

function reportCompletion(status: string) {
  send({
    type: 'PAGE_AUTOFILL_COMPLETE',
    payload: { status, jobId: autoApplyJobId, url: location.href },
  });
}

function randomDelay(min: number, max: number): Promise<void> {
  const ms = min + Math.random() * (max - min);
  return new Promise((r) => setTimeout(r, ms));
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

function updateControlBar(filled: number, total: number, message?: string) {
  const el = document.getElementById('ua-fill-status');
  if (el) el.textContent = message || `${filled}/${total} fields filled`;
}

function removeControlBar() {
  document.getElementById('ua-control-bar')?.remove();
}

// ═══════════════════════════════════════════════
//  ONE-CLICK "ADD TO QUEUE" BUTTON
//  Injected as a floating button on any job page
// ═══════════════════════════════════════════════

function maybeInjectQueueButton() {
  if (queueButtonInjected) return;

  // Check if this page looks like a job listing/posting (not necessarily an application form)
  const url = location.href.toLowerCase();
  const title = document.title.toLowerCase();
  const h1 = document.querySelector('h1')?.textContent?.toLowerCase() || '';
  const combined = url + ' ' + title + ' ' + h1;

  const isJobPage = /job|career|position|opening|apply|hiring|vacancy|recruit|opportunity/i.test(combined);
  const isAppPage = isApplicationPage(document);

  if (!isJobPage && !isAppPage) return;

  queueButtonInjected = true;
  injectQueueButton();
}

function injectQueueButton() {
  // Remove if already exists
  document.getElementById('ua-queue-btn-wrapper')?.remove();

  const wrapper = document.createElement('div');
  wrapper.id = 'ua-queue-btn-wrapper';
  wrapper.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Main "Add to Queue" button
  const btn = document.createElement('button');
  btn.id = 'ua-add-queue-btn';
  btn.innerHTML = `<span style="font-size:16px;margin-right:6px;">+</span> Add to Queue`;
  btn.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: #fff;
    border: none;
    border-radius: 50px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    transition: all 0.2s ease;
    font-family: inherit;
  `;
  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.05)';
    btn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
  });

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.innerHTML = '<span style="font-size:14px;">&#8987;</span> Adding...';

    try {
      // Extract job info from the page
      const jobContext = extractJobContext(document);

      const r = await send({
        type: 'ADD_CURRENT_PAGE_TO_QUEUE',
        payload: {
          url: location.href,
          company: jobContext.companyName || undefined,
          role: jobContext.jobTitle || undefined,
          source: 'one_click',
        },
      });

      if (r?.ok) {
        btn.innerHTML = '<span style="font-size:16px;">&#10003;</span> Added!';
        btn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';

        // Show toast
        showQueueToast(`Added to queue: ${jobContext.jobTitle || location.href.substring(0, 50)}...`);

        // Reset after 3 seconds
        setTimeout(() => {
          btn.innerHTML = `<span style="font-size:16px;margin-right:6px;">+</span> Add to Queue`;
          btn.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
          btn.disabled = false;
        }, 3000);
      } else {
        btn.innerHTML = `<span style="font-size:16px;">&#10007;</span> ${r?.error || 'Already in queue'}`;
        btn.style.background = '#dc3545';
        setTimeout(() => {
          btn.innerHTML = `<span style="font-size:16px;margin-right:6px;">+</span> Add to Queue`;
          btn.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
          btn.disabled = false;
        }, 2000);
      }
    } catch (e) {
      btn.innerHTML = `<span style="font-size:16px;">&#10007;</span> Error`;
      setTimeout(() => {
        btn.innerHTML = `<span style="font-size:16px;margin-right:6px;">+</span> Add to Queue`;
        btn.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
        btn.disabled = false;
      }, 2000);
    }
  });

  wrapper.appendChild(btn);
  document.body.appendChild(wrapper);
}

function showQueueToast(message: string) {
  const existing = document.getElementById('ua-queue-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'ua-queue-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 24px;
    z-index: 2147483647;
    padding: 12px 20px;
    background: #343a40;
    color: #fff;
    border-radius: 8px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.3s ease;
  `;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Overlay for textarea / question suggestions ───
// Attach focus listener to show suggestions on textareas and long text inputs

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

// ─── Auto-inject queue button on page load for job pages ───
// Run after a short delay to let the page render
setTimeout(() => {
  maybeInjectQueueButton();
}, 1500);
