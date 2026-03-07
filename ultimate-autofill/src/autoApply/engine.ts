/**
 * Auto-Apply Engine
 * Orchestrates the fully automatic job application pipeline.
 * Opens job URLs, detects ATS, runs autofill, optionally submits, closes tabs.
 * Now includes multi-page support, success detection, and Workday automation.
 */

import type { AutoApplyStatus, AutoApplySettings, JobQueueItem, JobStatus } from '../types/index';
import * as queue from '../jobQueue/storage';
import { loadSettings } from '../settings/storage';

let _status: AutoApplyStatus = {
  running: false,
  paused: false,
  currentJobId: null,
  currentJobUrl: null,
  totalJobs: 0,
  completedJobs: 0,
  failedJobs: 0,
  skippedJobs: 0,
  startedAt: null,
  estimatedRemaining: 0,
};

let _abortController: AbortController | null = null;
let _appliedThisHour = 0;
let _appliedToday = 0;

// Rate limiting counters
const RATE_KEY = 'ua_rate_limits';

async function loadRateLimits(): Promise<{ hour: number; day: number; hourReset: number; dayReset: number }> {
  const r = await chrome.storage.local.get(RATE_KEY);
  const data = r[RATE_KEY] as any;
  if (!data) return { hour: 0, day: 0, hourReset: Date.now() + 3600000, dayReset: Date.now() + 86400000 };
  // Reset if expired
  const now = Date.now();
  if (now > data.hourReset) data.hour = 0;
  if (now > data.dayReset) data.day = 0;
  return data;
}

async function incrementRateLimit(): Promise<void> {
  const limits = await loadRateLimits();
  limits.hour++;
  limits.day++;
  if (limits.hourReset < Date.now()) limits.hourReset = Date.now() + 3600000;
  if (limits.dayReset < Date.now()) limits.dayReset = Date.now() + 86400000;
  await chrome.storage.local.set({ [RATE_KEY]: limits });
  _appliedThisHour = limits.hour;
  _appliedToday = limits.day;
}

async function checkRateLimit(settings: AutoApplySettings): Promise<boolean> {
  const limits = await loadRateLimits();
  _appliedThisHour = limits.hour;
  _appliedToday = limits.day;
  return limits.hour < settings.rateLimit.maxPerHour && limits.day < settings.rateLimit.maxPerDay;
}

export function getStatus(): AutoApplyStatus {
  return { ..._status };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Add human-like randomized delay */
function humanDelay(baseMs: number): Promise<void> {
  const variance = baseMs * 0.3; // 30% variance
  const actual = baseMs + (Math.random() * variance * 2 - variance);
  return delay(Math.max(500, actual));
}

/**
 * Start the auto-apply pipeline.
 * Processes jobs from the queue one at a time:
 * 1. Get next pending job
 * 2. Open URL in a new tab
 * 3. Wait for page load
 * 4. Send START_AUTOFILL to the content script
 * 5. Wait for autofill completion (with multi-page support)
 * 6. Detect success or needs_input
 * 7. Update job status
 * 8. Close tab (if setting enabled)
 * 9. Wait for rate limit delay
 * 10. Repeat
 */
export async function startAutoApply(source?: 'all' | 'imported'): Promise<void> {
  if (_status.running) return;

  const settings = await loadSettings();
  if (!settings.autoApply.enabled) return;

  _abortController = new AbortController();
  const items = await queue.getItems();
  const pendingJobs = items.filter((j) => {
    if (j.status !== 'not_started') return false;
    if (source === 'imported' && j.source !== 'csv_import') return false;
    return true;
  });

  _status = {
    running: true,
    paused: false,
    currentJobId: null,
    currentJobUrl: null,
    totalJobs: pendingJobs.length,
    completedJobs: 0,
    failedJobs: 0,
    skippedJobs: 0,
    startedAt: new Date().toISOString(),
    estimatedRemaining: pendingJobs.length,
  };

  try {
    await processQueue(settings.autoApply, source);
  } finally {
    _status.running = false;
    _status.currentJobId = null;
    _status.currentJobUrl = null;
    _abortController = null;
  }
}

async function processQueue(settings: AutoApplySettings, source?: 'all' | 'imported'): Promise<void> {
  while (_status.running && !_abortController?.signal.aborted) {
    if (_status.paused) {
      await delay(1000);
      continue;
    }

    // Check rate limits
    const withinLimits = await checkRateLimit(settings);
    if (!withinLimits) {
      console.log('[UA] Rate limit reached, pausing auto-apply');
      _status.paused = true;
      // Auto-resume after rate limit window
      await delay(60000); // Wait 1 minute then recheck
      _status.paused = false;
      continue;
    }

    // Get next job
    const job = await queue.getNextJob();
    if (!job) {
      console.log('[UA] No more jobs in queue');
      break;
    }

    // Filter by source if specified
    if (source === 'imported' && job.source !== 'csv_import') {
      continue;
    }

    // Check if domain is allowed
    try {
      const domain = new URL(job.url).hostname;
      const isAllowed = settings.domainAllowlist.length === 0 ||
        settings.domainAllowlist.some((d) => domain.includes(d));
      if (!isAllowed) {
        await queue.updateStatus(job.id, 'skipped', 'Domain not in allowlist');
        _status.skippedJobs++;
        _status.estimatedRemaining--;
        continue;
      }
    } catch {
      await queue.updateStatus(job.id, 'failed', 'Invalid URL');
      _status.failedJobs++;
      _status.estimatedRemaining--;
      continue;
    }

    _status.currentJobId = job.id;
    _status.currentJobUrl = job.url;

    try {
      await processJob(job, settings);
      _status.completedJobs++;
      await incrementRateLimit();
    } catch (err) {
      console.error('[UA] Job failed:', job.url, err);
      // Retry logic
      const retryCount = (job.retryCount || 0) + 1;
      if (retryCount <= settings.retryFailedMax) {
        await queue.updateStatus(job.id, 'not_started', `Retry ${retryCount}/${settings.retryFailedMax}: ${String(err)}`);
        // Update retry count
        const items = await queue.getItems();
        const item = items.find((i) => i.id === job.id);
        if (item) {
          item.retryCount = retryCount;
          const state = await queue.loadQueue();
          const stateItem = state.items.find((i) => i.id === job.id);
          if (stateItem) stateItem.retryCount = retryCount;
          await chrome.storage.local.set({ ua_job_queue: state });
        }
      } else {
        await queue.updateStatus(job.id, 'failed', String(err));
        _status.failedJobs++;
      }
    }

    _status.estimatedRemaining--;

    // Human-like pacing between jobs
    if (settings.humanLikePacing) {
      await humanDelay(settings.delayBetweenJobs);
    } else {
      await delay(settings.delayBetweenJobs);
    }
  }
}

async function processJob(job: JobQueueItem, settings: AutoApplySettings): Promise<void> {
  // Update status to applying
  await queue.updateStatus(job.id, 'applying');

  // Open the job URL in a new tab
  const tab = await chrome.tabs.create({ url: job.url, active: false });
  if (!tab.id) throw new Error('Failed to create tab');

  // Wait for page to load
  await waitForTabLoad(tab.id, 30000);

  // Small delay for dynamic content to render
  await delay(2000);

  // Send autofill command to the content script
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'START_AUTOFILL',
      payload: { autoSubmit: settings.autoSubmit, jobId: job.id },
    });
  } catch {
    // Content script might not be loaded, try injecting it
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      await delay(1000);
      await chrome.tabs.sendMessage(tab.id, {
        type: 'START_AUTOFILL',
        payload: { autoSubmit: settings.autoSubmit, jobId: job.id },
      });
    } catch (e) {
      throw new Error(`Cannot inject content script: ${e}`);
    }
  }

  // Wait for autofill to complete (with extended timeout for multi-page)
  const result = await waitForAutofillComplete(tab.id, job.id, 120000);

  if (result === 'applied') {
    await queue.updateStatus(job.id, 'applied');
  } else if (result === 'prefilled') {
    await queue.updateStatus(job.id, 'prefilled');
  } else if (result === 'needs_input') {
    await queue.updateStatus(job.id, 'needs_input', 'Manual input required');
  } else {
    await queue.updateStatus(job.id, 'prefilled');
  }

  // Close tab if setting enabled and job was submitted
  if (settings.closeTabAfterApply && (result === 'applied' || result === 'completed')) {
    try { await chrome.tabs.remove(tab.id); } catch {}
  }
}

function waitForTabLoad(tabId: number, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(); // Don't reject on timeout, just continue
    }, timeout);

    function listener(id: number, info: chrome.tabs.TabChangeInfo) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function waitForAutofillComplete(tabId: number, jobId: string, timeout: number): Promise<string> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      resolve('prefilled'); // Default to prefilled on timeout
    }, timeout);

    function listener(msg: any, sender: chrome.runtime.MessageSender) {
      if (sender.tab?.id === tabId && msg.type === 'PAGE_AUTOFILL_COMPLETE') {
        clearTimeout(timer);
        chrome.runtime.onMessage.removeListener(listener);
        resolve(msg.payload?.status || 'prefilled');
      }
    }

    chrome.runtime.onMessage.addListener(listener);
  });
}

export function stopAutoApply(): void {
  _status.running = false;
  _abortController?.abort();
}

export function pauseAutoApply(): void {
  _status.paused = true;
}

export function resumeAutoApply(): void {
  _status.paused = false;
}

export async function retryFailedJobs(): Promise<number> {
  return queue.retryFailed();
}
