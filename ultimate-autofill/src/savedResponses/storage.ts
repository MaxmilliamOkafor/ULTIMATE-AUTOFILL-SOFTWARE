import type { SavedResponse, ResponseLibrary, SavedResponsesState } from '../types/index';
import { generateId, now } from '../utils/helpers';
import { encrypt, decrypt } from '../utils/crypto';

const KEY = 'ua_saved_responses';
const DEFAULT_ID = 'default';

function defaultState(): SavedResponsesState {
  return {
    libraries: [{
      id: DEFAULT_ID, name: 'Default', responses: [],
      createdAt: now(), updatedAt: now(),
    }],
    activeLibraryId: DEFAULT_ID,
    domainMappings: {},
  };
}

export async function loadState(): Promise<SavedResponsesState> {
  const r = await chrome.storage.local.get(KEY);
  return (r[KEY] as SavedResponsesState) || defaultState();
}

export async function saveState(state: SavedResponsesState): Promise<void> {
  await chrome.storage.local.set({ [KEY]: state });
}

export async function getActiveLibrary(): Promise<ResponseLibrary> {
  const s = await loadState();
  return s.libraries.find((l) => l.id === s.activeLibraryId) || s.libraries[0];
}

export async function getLibraryForDomain(domain: string): Promise<ResponseLibrary> {
  const s = await loadState();
  const mapped = s.domainMappings[domain];
  if (mapped) { const l = s.libraries.find((x) => x.id === mapped); if (l) return l; }
  return s.libraries.find((l) => l.id === s.activeLibraryId) || s.libraries[0];
}

export async function getLibraries(): Promise<ResponseLibrary[]> {
  return (await loadState()).libraries;
}

export async function setActiveLibrary(id: string): Promise<void> {
  const s = await loadState();
  if (s.libraries.some((l) => l.id === id)) { s.activeLibraryId = id; await saveState(s); }
}

export async function createLibrary(name: string): Promise<ResponseLibrary> {
  const s = await loadState();
  const lib: ResponseLibrary = { id: generateId(), name, responses: [], createdAt: now(), updatedAt: now() };
  s.libraries.push(lib);
  await saveState(s);
  return lib;
}

export async function deleteLibrary(id: string): Promise<boolean> {
  const s = await loadState();
  if (s.libraries.length <= 1) return false;
  s.libraries = s.libraries.filter((l) => l.id !== id);
  for (const [d, lid] of Object.entries(s.domainMappings)) if (lid === id) delete s.domainMappings[d];
  if (s.activeLibraryId === id) s.activeLibraryId = s.libraries[0].id;
  await saveState(s);
  return true;
}

export async function setDomainMapping(domain: string, libId: string): Promise<void> {
  const s = await loadState();
  s.domainMappings[domain] = libId;
  await saveState(s);
}

export async function removeDomainMapping(domain: string): Promise<void> {
  const s = await loadState();
  delete s.domainMappings[domain];
  await saveState(s);
}

export async function getDomainMappings(): Promise<Record<string, string>> {
  return (await loadState()).domainMappings;
}

// ─── CRUD ───

export async function getResponses(libId?: string): Promise<SavedResponse[]> {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  return s.libraries.find((l) => l.id === id)?.responses || [];
}

export async function saveResponse(resp: SavedResponse, libId?: string): Promise<SavedResponse> {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  const lib = s.libraries.find((l) => l.id === id);
  if (!lib) throw new Error('Library not found');
  const ts = now();
  const idx = lib.responses.findIndex((r) => r.id === resp.id);
  if (idx >= 0) { lib.responses[idx] = { ...resp, updatedAt: ts }; }
  else { lib.responses.push({ ...resp, id: resp.id || generateId(), createdAt: resp.createdAt || ts, updatedAt: ts }); }
  lib.updatedAt = ts;
  await saveState(s);
  return resp;
}

export async function deleteResponse(respId: string, libId?: string): Promise<void> {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  const lib = s.libraries.find((l) => l.id === id);
  if (!lib) return;
  lib.responses = lib.responses.filter((r) => r.id !== respId);
  lib.updatedAt = now();
  await saveState(s);
}

export async function deleteResponses(ids: string[], libId?: string): Promise<void> {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  const lib = s.libraries.find((l) => l.id === id);
  if (!lib) return;
  const set = new Set(ids);
  lib.responses = lib.responses.filter((r) => !set.has(r.id));
  lib.updatedAt = now();
  await saveState(s);
}

export async function bulkTag(ids: string[], tags: string[], libId?: string): Promise<void> {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  const lib = s.libraries.find((l) => l.id === id);
  if (!lib) return;
  const set = new Set(ids);
  for (const r of lib.responses) {
    if (set.has(r.id)) {
      const existing = new Set(r.tags || []);
      for (const t of tags) existing.add(t);
      r.tags = [...existing];
      r.updatedAt = now();
    }
  }
  lib.updatedAt = now();
  await saveState(s);
}

export async function mergeResponses(keepId: string, mergeId: string, libId?: string): Promise<void> {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  const lib = s.libraries.find((l) => l.id === id);
  if (!lib) return;
  const keep = lib.responses.find((r) => r.id === keepId);
  const merge = lib.responses.find((r) => r.id === mergeId);
  if (!keep || !merge) return;
  keep.keywords = [...new Set([...keep.keywords, ...merge.keywords])];
  keep.appearances += merge.appearances;
  keep.updatedAt = now();
  lib.responses = lib.responses.filter((r) => r.id !== mergeId);
  lib.updatedAt = now();
  await saveState(s);
}

export async function recordUsage(respId: string, libId?: string): Promise<void> {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  const lib = s.libraries.find((l) => l.id === id);
  if (!lib) return;
  const r = lib.responses.find((x) => x.id === respId);
  if (r) { r.appearances++; r.lastUsedAt = now(); r.updatedAt = now(); lib.updatedAt = now(); await saveState(s); }
}

// ─── Import / Export ───

export async function importResponses(data: SavedResponse[], libId?: string, mode: 'merge' | 'replace' = 'merge'): Promise<number> {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  const lib = s.libraries.find((l) => l.id === id);
  if (!lib) throw new Error('Library not found');
  const ts = now();
  if (mode === 'replace') lib.responses = [];
  let count = 0;
  for (const e of data) {
    const norm: SavedResponse = {
      id: e.id || generateId(),
      key: e.key || '',
      keywords: Array.isArray(e.keywords) ? e.keywords : [],
      question: e.question || '',
      response: e.response || '',
      appearances: typeof e.appearances === 'number' ? e.appearances : 0,
      fromAutofill: typeof e.fromAutofill === 'boolean' ? e.fromAutofill : false,
      tags: e.tags, lastUsedAt: e.lastUsedAt, createdAt: e.createdAt || ts,
      updatedAt: e.updatedAt || ts, domains: e.domains, atsTypes: e.atsTypes,
    };
    if (mode === 'merge') {
      const existing = lib.responses.find((r) => r.id === norm.id || r.question === norm.question);
      if (existing) {
        existing.keywords = [...new Set([...existing.keywords, ...norm.keywords])];
        existing.appearances = Math.max(existing.appearances, norm.appearances);
        existing.response = norm.response;
        existing.updatedAt = ts;
        continue;
      }
    }
    lib.responses.push(norm);
    count++;
  }
  lib.updatedAt = ts;
  await saveState(s);
  return count;
}

export async function exportResponses(libId?: string): Promise<SavedResponse[]> {
  const responses = await getResponses(libId);
  return responses.map((r) => ({
    appearances: r.appearances,
    fromAutofill: r.fromAutofill,
    id: r.id,
    key: r.key,
    keywords: r.keywords,
    question: r.question,
    response: r.response,
    ...(r.tags?.length ? { tags: r.tags } : {}),
    ...(r.lastUsedAt ? { lastUsedAt: r.lastUsedAt } : {}),
    ...(r.createdAt ? { createdAt: r.createdAt } : {}),
    ...(r.updatedAt ? { updatedAt: r.updatedAt } : {}),
    ...(r.domains?.length ? { domains: r.domains } : {}),
    ...(r.atsTypes?.length ? { atsTypes: r.atsTypes } : {}),
  }));
}

export async function exportEncrypted(passphrase: string, libId?: string): Promise<string> {
  const data = await exportResponses(libId);
  return encrypt(JSON.stringify(data, null, 2), passphrase);
}

export async function importEncrypted(encoded: string, passphrase: string, libId?: string, mode: 'merge' | 'replace' = 'merge'): Promise<number> {
  const json = await decrypt(encoded, passphrase);
  return importResponses(JSON.parse(json), libId, mode);
}

export async function searchResponses(query: string, libId?: string): Promise<SavedResponse[]> {
  const all = await getResponses(libId);
  if (!query.trim()) return all;
  const q = query.toLowerCase();
  return all.filter((r) =>
    r.question.toLowerCase().includes(q) ||
    r.response.toLowerCase().includes(q) ||
    r.key.toLowerCase().includes(q) ||
    r.keywords.some((k) => k.toLowerCase().includes(q)) ||
    (r.tags && r.tags.some((t) => t.toLowerCase().includes(q)))
  );
}
