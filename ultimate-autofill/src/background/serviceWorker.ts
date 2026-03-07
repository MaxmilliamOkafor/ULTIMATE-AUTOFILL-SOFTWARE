import type { ExtMessage, ExtResponse, CsvJobItem } from '../types/index';
import * as store from '../savedResponses/storage';
import { findMatches } from '../savedResponses/matcher';
import { findDuplicates } from '../utils/fuzzy';
import * as queue from '../jobQueue/storage';
import * as settings from '../settings/storage';
import * as autoApply from '../autoApply/engine';
import * as scraper from '../autoApply/scraper';
import * as answerBankModule from '../answerBank/index';

// ─── CSV Queue State ────────────────────────────────────────────
const CSV_QUEUE_KEY = 'csvJobQueue';
let csvQueueRunning = false;
let csvQueuePaused = false;
let _reuseTabId: number | null = null;
let _activeJobResolve: ((result: string) => void) | null = null;
let _activeJobId: string | null = null;

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'source', 'fbclid']
      .forEach(p => u.searchParams.delete(p));
    return u.origin + u.pathname;
  } catch { return url; }
}

async function isAlreadyApplied(url: string): Promise<boolean> {
  const { appliedJobs = [] } = await chrome.storage.local.get('appliedJobs');
  return appliedJobs.includes(normalizeUrl(url));
}

function randDelay(minS: number, maxS: number): Promise<void> {
  const ms = (minS + Math.random() * (maxS - minS)) * 1000;
  return new Promise(r => setTimeout(r, ms));
}

function broadcast(msg: Record<string, any>): void {
  chrome.runtime.sendMessage(msg).catch(() => { });
}

// ─── Message Handler ────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg: any, sender, sendResponse) => {
  // Intercept application success/error from content script (CSV queue)
  if (msg.type === 'COMPLEX_FORM_SUCCESS' && _activeJobResolve) {
    const r = _activeJobResolve;
    _activeJobResolve = null;
    r('done');
    return false;
  }
  if (msg.type === 'COMPLEX_FORM_ERROR' && _activeJobResolve) {
    const r = _activeJobResolve;
    _activeJobResolve = null;
    r(msg.errorType === 'alreadyApplied' ? 'duplicate' : 'failed');
    return false;
  }

  // Relay sidebar status messages
  if (msg.type === 'SIDEBAR_STATUS' || msg.type === 'SIDEBAR_FIELD_UPDATE') {
    chrome.runtime.sendMessage(msg).catch(() => { });
    return false;
  }

  handleMessage(msg as ExtMessage, sender).then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true; // async
});

async function handleMessage(msg: ExtMessage, sender?: chrome.runtime.MessageSender): Promise<ExtResponse> {
  const p = msg.payload as any;

  switch (msg.type) {
    // ─── Libraries ───
    case 'GET_LIBRARIES':
      return { ok: true, data: await store.getLibraries() };
    case 'GET_ACTIVE_LIBRARY':
      return { ok: true, data: await store.getActiveLibrary() };
    case 'SET_ACTIVE_LIBRARY':
      await store.setActiveLibrary(p.id);
      return { ok: true };
    case 'CREATE_LIBRARY':
      return { ok: true, data: await store.createLibrary(p.name) };
    case 'DELETE_LIBRARY':
      return { ok: true, data: await store.deleteLibrary(p.id) };

    // ─── Domain Mappings ───
    case 'GET_DOMAIN_MAPPINGS':
      return { ok: true, data: await store.getDomainMappings() };
    case 'SET_DOMAIN_MAPPING':
      await store.setDomainMapping(p.domain, p.libraryId);
      return { ok: true };
    case 'REMOVE_DOMAIN_MAPPING':
      await store.removeDomainMapping(p.domain);
      return { ok: true };

    // ─── Responses CRUD ───
    case 'GET_RESPONSES':
      return { ok: true, data: await store.getResponses(p?.libraryId) };
    case 'SAVE_RESPONSE':
      return { ok: true, data: await store.saveResponse(p.response, p.libraryId) };
    case 'DELETE_RESPONSE':
      await store.deleteResponse(p.id, p.libraryId);
      return { ok: true };
    case 'DELETE_RESPONSES':
      await store.deleteResponses(p.ids, p.libraryId);
      return { ok: true };
    case 'SEARCH_RESPONSES':
      return { ok: true, data: await store.searchResponses(p.query, p.libraryId) };
    case 'BULK_TAG':
      await store.bulkTag(p.ids, p.tags, p.libraryId);
      return { ok: true };
    case 'MERGE_RESPONSES':
      await store.mergeResponses(p.keepId, p.mergeId, p.libraryId);
      return { ok: true };
    case 'RECORD_USAGE':
      await store.recordUsage(p.id, p.libraryId);
      return { ok: true };

    // ─── Import / Export ───
    case 'IMPORT_RESPONSES':
      return { ok: true, data: await store.importResponses(p.data, p.libraryId, p.mode) };
    case 'EXPORT_RESPONSES':
      return { ok: true, data: await store.exportResponses(p?.libraryId) };
    case 'EXPORT_ENCRYPTED':
      return { ok: true, data: await store.exportEncrypted(p.passphrase, p.libraryId) };
    case 'IMPORT_ENCRYPTED':
      return { ok: true, data: await store.importEncrypted(p.data, p.passphrase, p.libraryId, p.mode) };

    // ─── Suggestions (for content script) ───
    case 'GET_SUGGESTIONS': {
      const lib = p.domain
        ? await store.getLibraryForDomain(p.domain)
        : await store.getActiveLibrary();
      const matches = findMatches(p.query, lib.responses, { domain: p.domain, atsType: p.atsType, maxResults: 3 });
      return { ok: true, data: matches };
    }

    // ─── Job Queue ───
    case 'GET_JOB_QUEUE':
      return { ok: true, data: await queue.getItems() };
    case 'ADD_JOB_URLS':
      return { ok: true, data: await queue.addUrls(p.urls) };
    case 'IMPORT_JOB_CSV': {
      const stats = await queue.importCSVJobs(p.csv);
      return { ok: true, data: stats };
    }
    case 'UPDATE_JOB_STATUS':
      await queue.updateStatus(p.id, p.status, p.reason);
      return { ok: true };
    case 'CLEAR_JOB_QUEUE':
      await queue.clearQueue();
      return { ok: true };
    case 'OPEN_JOB_TAB':
      await chrome.tabs.create({ url: p.url, active: true });
      await queue.updateStatus(p.id, 'opened');
      return { ok: true };
    case 'REMOVE_JOB':
      await queue.removeItem(p.id);
      return { ok: true };
    case 'RETRY_FAILED_JOBS': {
      const retried = await queue.retryFailed();
      return { ok: true, data: retried };
    }
    case 'GET_IMPORT_STATS':
      return { ok: true, data: await queue.getImportStats() };
    case 'EXPORT_JOB_RESULTS': {
      const csv = await queue.exportQueue();
      return { ok: true, data: csv };
    }

    // ─── Auto-Apply Pipeline ───
    case 'START_AUTO_APPLY':
      autoApply.startAutoApply(p?.source || 'all');
      return { ok: true };
    case 'STOP_AUTO_APPLY':
      autoApply.stopAutoApply();
      return { ok: true };
    case 'PAUSE_AUTO_APPLY':
      autoApply.pauseAutoApply();
      return { ok: true };
    case 'RESUME_AUTO_APPLY':
      autoApply.resumeAutoApply();
      return { ok: true };
    case 'GET_AUTO_APPLY_STATUS':
      return { ok: true, data: autoApply.getStatus() };

    // ─── Settings ───
    case 'GET_SETTINGS':
      return { ok: true, data: await settings.loadSettings() };
    case 'SAVE_SETTINGS':
      await settings.saveSettings(p);
      return { ok: true };

    // ─── Applications Account ───
    case 'SAVE_APP_ACCOUNT':
      await settings.saveAppAccount(p.email, p.password, p.passphrase);
      return { ok: true };
    case 'GET_APP_ACCOUNT': {
      const account = await settings.getAppAccount(p.passphrase);
      if (account) return { ok: true, data: { email: account.email } }; // Never return password to UI
      return { ok: false, error: 'Invalid passphrase or no account saved' };
    }
    case 'CLEAR_APP_ACCOUNT':
      await settings.clearAppAccount();
      return { ok: true };

    // ─── Credits ───
    case 'GET_CREDITS':
    case 'CHECK_CREDITS':
      return { ok: true, data: await settings.checkCredits() };

    // ─── Scraper ───
    case 'START_SCRAPER':
      await scraper.startScraper();
      return { ok: true };
    case 'STOP_SCRAPER':
      scraper.stopScraper();
      return { ok: true };
    case 'GET_SCRAPED_JOBS': {
      const jobs = await scraper.getRankedJobs(p?.targetCount);
      return { ok: true, data: jobs };
    }

    // ─── Autofill (forwarded to content script via tabs) ───
    case 'START_AUTOFILL': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: 'START_AUTOFILL', payload: p });
      }
      return { ok: true };
    }
    case 'STOP_AUTOFILL': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: 'STOP_AUTOFILL' });
      }
      return { ok: true };
    }
    case 'DETECT_ATS': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        const r = await chrome.tabs.sendMessage(tab.id, { type: 'DETECT_ATS' });
        return { ok: true, data: r };
      }
      return { ok: false, error: 'No active tab' };
    }
    case 'AUTO_DETECT_FILL': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: 'AUTO_DETECT_FILL' });
      }
      return { ok: true };
    }
    case 'PAGE_AUTOFILL_COMPLETE':
      // Content script reports completion - forwarded to auto-apply engine
      return { ok: true };

    // ─── One-click add current page to queue ───
    case 'ADD_CURRENT_PAGE_TO_QUEUE': {
      const url = p?.url;
      if (!url) return { ok: false, error: 'No URL provided' };
      // Check for duplicates
      const existing = await queue.getItems();
      const normalized = queue.normalizeUrl(url);
      const isDuplicate = existing.some((i) => queue.normalizeUrl(i.url) === normalized);
      if (isDuplicate) return { ok: false, error: 'Already in queue' };
      const added = await queue.addUrls([{
        url,
        company: p.company || undefined,
        role: p.role || undefined,
      }]);
      // Override source to 'one_click' by updating the just-added item
      if (added > 0 && p.source === 'one_click') {
        const items = await queue.getItems();
        const item = items.find((i) => queue.normalizeUrl(i.url) === normalized);
        if (item) {
          item.source = 'one_click';
          // Save directly since addUrls set it as 'manual'
          const state = await queue.loadQueue();
          const stateItem = state.items.find((i) => i.id === item.id);
          if (stateItem) stateItem.source = 'one_click';
          await chrome.storage.local.set({ ua_job_queue: state });
        }
      }
      return { ok: true, data: { added } };
    }

    // ─── AI Tailoring ───
    case 'TAILOR_RESPONSE':
      return { ok: true }; // Tailoring is handled in content script
    case 'GET_TAILORING_STATUS': {
      const s = await settings.loadSettings();
      return { ok: true, data: { enabled: s.tailoring.enabled, intensity: s.tailoring.intensity } };
    }

    // ─── Answer Bank & Profile ───
    case 'GET_ANSWER_BANK':
      return { ok: true, data: await answerBankModule.loadAnswerBank() };
    case 'SAVE_ANSWER':
      await answerBankModule.learnAnswer(p.label, p.value);
      return { ok: true };
    case 'CLEAR_ANSWER_BANK':
      await chrome.storage.local.remove('ua_answer_bank');
      return { ok: true };
    case 'GET_PROFILE':
      return { ok: true, data: await answerBankModule.loadProfile() };
    case 'SAVE_PROFILE':
      await answerBankModule.saveProfile(p);
      return { ok: true };

    // ─── CSV Queue Commands ───
    case 'START_CSV_QUEUE' as any:
      startCsvQueue();
      return { ok: true };
    case 'STOP_CSV_QUEUE' as any:
      stopCsvQueue();
      return { ok: true };
    case 'PAUSE_CSV_QUEUE' as any:
      csvQueuePaused = true;
      return { ok: true };
    case 'RESUME_CSV_QUEUE' as any:
      if (csvQueueRunning && csvQueuePaused) {
        csvQueuePaused = false;
        processNextCsvJob();
      }
      return { ok: true };
    case 'SKIP_CSV_JOB' as any:
      if (_activeJobResolve) {
        const r = _activeJobResolve;
        _activeJobResolve = null;
        r('skipped');
      }
      return { ok: true };
    case 'TRIGGER_AUTOFILL' as any: {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_AUTOFILL' });
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unknown message: ${msg.type}` };
  }
}

// ─── CSV Queue Processor ────────────────────────────────────────

function startCsvQueue(): void {
  if (csvQueueRunning) return;
  csvQueueRunning = true;
  csvQueuePaused = false;
  processNextCsvJob();
}

function stopCsvQueue(): void {
  csvQueueRunning = false;
  csvQueuePaused = false;
  if (_activeJobResolve) {
    const r = _activeJobResolve;
    _activeJobResolve = null;
    r('skipped');
  }
  _reuseTabId = null;
  chrome.storage.local.set({ csvQueueRunning: false, csvActiveJobId: null, csvActiveTabId: null });
  broadcast({ type: 'SIDEBAR_STATUS', event: 'queue_stopped' });
}

async function processNextCsvJob(): Promise<void> {
  if (!csvQueueRunning || csvQueuePaused) return;
  try {
    await _processNextCsvJobInner();
  } catch (err) {
    console.error('[UA-SW] processNextCsvJob error:', err);
    if (csvQueueRunning && !csvQueuePaused) setTimeout(processNextCsvJob, 3000);
  }
}

async function _processNextCsvJobInner(): Promise<void> {
  if (!csvQueueRunning || csvQueuePaused) return;

  // Find next pending job
  const { csvJobQueue: q = [] } = await chrome.storage.local.get(CSV_QUEUE_KEY);
  const job = q.find((j: CsvJobItem) => j.status === 'pending');
  if (!job) {
    // Queue exhausted
    csvQueueRunning = false;
    await chrome.storage.local.set({ csvQueueRunning: false, csvActiveJobId: null, csvActiveTabId: null });
    broadcast({ type: 'CSV_QUEUE_DONE' });
    return;
  }

  // Mark as running
  job.status = 'running';
  job.startedAt = Date.now();
  await chrome.storage.local.set({ [CSV_QUEUE_KEY]: q });

  // Dedup check
  if (await isAlreadyApplied(job.url)) {
    job.status = 'duplicate';
    job.finishedAt = Date.now();
    job.lastError = 'Already applied previously';
    await chrome.storage.local.set({ [CSV_QUEUE_KEY]: q });
    broadcast({ type: 'CSV_JOB_COMPLETE', jobId: job.id, status: 'duplicate' });
    setTimeout(processNextCsvJob, 600);
    return;
  }

  broadcast({ type: 'CSV_JOB_STARTED', jobId: job.id, url: job.url });

  // Open the job URL
  let tab: chrome.tabs.Tab;
  try {
    if (_reuseTabId) {
      try {
        await chrome.tabs.update(_reuseTabId, { url: job.url, active: true });
        tab = await chrome.tabs.get(_reuseTabId);
      } catch {
        _reuseTabId = null;
        tab = await chrome.tabs.create({ url: job.url, active: true });
        _reuseTabId = tab.id!;
      }
    } else {
      tab = await chrome.tabs.create({ url: job.url, active: true });
      _reuseTabId = tab.id!;
    }
  } catch (e: any) {
    job.status = 'failed';
    job.finishedAt = Date.now();
    job.lastError = 'Could not open tab: ' + e.message;
    await chrome.storage.local.set({ [CSV_QUEUE_KEY]: q });
    broadcast({ type: 'CSV_JOB_COMPLETE', jobId: job.id, status: 'failed', reason: e.message });
    setTimeout(processNextCsvJob, 2000);
    return;
  }

  _activeJobId = job.id;

  // Progress broadcasting
  const pendingCount = q.filter((j: CsvJobItem) => j.status === 'pending' || j.status === 'running').length;
  const totalCount = q.length;
  const jobIndex = totalCount - pendingCount + 1;
  broadcast({ type: 'CSV_QUEUE_PROGRESS', jobIndex, totalCount, jobId: job.id, url: job.url });

  // Store csvActiveJobId BEFORE navigating to prevent race condition
  // The content script's storage listener will pick this up even if it loads before the tab update event
  await chrome.storage.local.set({
    csvActiveJobId: job.id,
    csvActiveTabId: tab.id,
    csvQueueRunning: true,
  });

  // Wait for tab to finish loading, then verify content script is ready via PING before triggering
  const _triggerOnTabLoad = async (updTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
    if (updTabId !== tab.id || changeInfo.status !== 'complete') return;
    chrome.tabs.onUpdated.removeListener(_triggerOnTabLoad);
    // Wait for page JS to hydrate
    await new Promise(r => setTimeout(r, 3000));
    // Re-store in case storage was cleared
    await chrome.storage.local.set({ csvActiveJobId: job.id, csvActiveTabId: tab.id });

    // PING retry loop: verify content script is ready before sending TRIGGER_AUTOFILL
    let contentScriptReady = false;
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const resp = await chrome.tabs.sendMessage(tab.id!, { type: 'PING' });
        if (resp?.ready) {
          contentScriptReady = true;
          break;
        }
      } catch { /* content script not yet injected */ }
      await new Promise(r => setTimeout(r, 2000));
    }

    if (!contentScriptReady) {
      console.warn('[UA-SW] Content script did not respond to PING after 30s — trying TRIGGER anyway');
    }

    // Send TRIGGER_AUTOFILL with retries
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await chrome.tabs.sendMessage(tab.id!, { type: 'TRIGGER_AUTOFILL', jobId: job.id });
        break;
      } catch {
        await new Promise(r => setTimeout(r, 2000 + attempt * 2000));
      }
    }
  };
  chrome.tabs.onUpdated.addListener(_triggerOnTabLoad);

  // Wait for result (180s timeout)
  const result = await waitForCsvResult(tab.id!, job.id, 180_000);
  chrome.tabs.onUpdated.removeListener(_triggerOnTabLoad);
  _activeJobId = null;
  await chrome.storage.local.set({ csvActiveJobId: null, csvActiveTabId: null });

  // Process result
  const freshQ = (await chrome.storage.local.get(CSV_QUEUE_KEY))[CSV_QUEUE_KEY] || [];
  const freshJob = freshQ.find((j: CsvJobItem) => j.id === job.id);
  if (freshJob) {
    freshJob.finishedAt = Date.now();
    if (result === 'done') {
      freshJob.status = 'done';
    } else if (result === 'duplicate') {
      freshJob.status = 'duplicate';
      freshJob.lastError = 'Already applied';
    } else if (result === 'skipped') {
      freshJob.status = 'skipped';
      freshJob.lastError = 'Skipped';
    } else {
      freshJob.status = result?.startsWith('failed') ? 'failed' : 'skipped';
      freshJob.lastError = result || 'Timeout';
    }
    await chrome.storage.local.set({ [CSV_QUEUE_KEY]: freshQ });
  }
  broadcast({ type: 'CSV_JOB_COMPLETE', jobId: job.id, status: freshJob?.status || 'skipped' });

  // Pause check
  if (csvQueuePaused) {
    broadcast({ type: 'CSV_QUEUE_PAUSED' });
    return;
  }

  // Delay before next job
  await randDelay(2, 7);
  processNextCsvJob();
}

function waitForCsvResult(tabId: number, jobId: string, maxMs: number): Promise<string> {
  return new Promise(resolve => {
    let settled = false;
    const settle = (value: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onRemoved.removeListener(tabCloseListener);
      if (_activeJobResolve === resolve as any) _activeJobResolve = null;
      resolve(value);
    };

    _activeJobResolve = settle;

    // Tab closed
    const tabCloseListener = (closedTabId: number) => {
      if (closedTabId === tabId) settle('skipped');
    };
    chrome.tabs.onRemoved.addListener(tabCloseListener);

    // Hard timeout
    const timer = setTimeout(() => settle('timeout'), maxMs);
  });
}

// ─── On Install ─────────────────────────────────────────────────
chrome.runtime.onInstalled?.addListener(async () => {
  const state = await store.loadState();
  if (!state.libraries.length) {
    await store.saveState({
      libraries: [{
        id: 'default',
        name: 'Default',
        responses: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
      activeLibraryId: 'default',
      domainMappings: {},
    });
  }
  // Initialize settings with defaults
  await settings.loadSettings();
});

// Auto-detect ATS on tab updates and trigger autofill if enabled
// Now works universally on ALL pages (not just domain allowlist) when universal mode is on
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  // Skip chrome:// and extension pages
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;

  try {
    const s = await settings.loadSettings();
    if (!s.autoDetectAndFill) return;

    const url = tab.url;

    // If universal form detection is enabled, try on ALL pages
    // Otherwise, only on domain-allowlisted pages
    if (!s.universalFormDetection) {
      const isSupported = s.autoApply.domainAllowlist.some((d) => url.includes(d));
      if (!isSupported) return;
    }

    // Send auto-detect-and-fill to the content script
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'AUTO_DETECT_FILL' });
    } catch {
      // Content script not yet loaded, ignore
    }
  } catch {
    // Settings not yet initialized, ignore
  }
});
