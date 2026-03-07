import type { ExtMessage, ExtResponse } from '../types/index';
import * as store from '../savedResponses/storage';
import { findMatches } from '../savedResponses/matcher';
import { findDuplicates } from '../utils/fuzzy';
import * as queue from '../jobQueue/storage';
import * as settings from '../settings/storage';
import * as autoApply from '../autoApply/engine';
import * as scraper from '../autoApply/scraper';
import * as answerBankModule from '../answerBank/index';

chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true; // async
});

async function handleMessage(msg: ExtMessage): Promise<ExtResponse> {
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

    default:
      return { ok: false, error: `Unknown message: ${msg.type}` };
  }
}

// On install, initialize storage
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
