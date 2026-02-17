import type { ExtMessage, ExtResponse } from '../types/index';
import * as store from '../savedResponses/storage';
import { findMatches } from '../savedResponses/matcher';
import { findDuplicates } from '../utils/fuzzy';
import * as queue from '../jobQueue/storage';

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
      const parsed = queue.parseJobCSV(p.csv);
      const added = await queue.addUrls(parsed);
      return { ok: true, data: { parsed: parsed.length, added } };
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

    // ─── Autofill (forwarded to content script via tabs) ───
    case 'START_AUTOFILL': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: 'START_AUTOFILL' });
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
});
