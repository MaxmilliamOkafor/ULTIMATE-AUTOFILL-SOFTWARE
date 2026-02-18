// src/utils/helpers.ts
function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : r & 3 | 8).toString(16);
  });
}
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function parseCSV(text) {
  const rows = [];
  let field = "";
  let inQuotes = false;
  let row = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field.trim());
        field = "";
      } else if (ch === "\n" || ch === "\r" && next === "\n") {
        row.push(field.trim());
        if (row.some((c) => c !== ""))
          rows.push(row);
        row = [];
        field = "";
        if (ch === "\r")
          i++;
      } else {
        field += ch;
      }
    }
  }
  row.push(field.trim());
  if (row.some((c) => c !== ""))
    rows.push(row);
  return rows;
}
function isValidHttpsUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

// src/utils/crypto.ts
var SALT_LEN = 16;
var IV_LEN = 12;
var ITERATIONS = 1e5;
async function deriveKey(pass, salt) {
  const raw = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
async function encrypt(data, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(passphrase, salt);
  const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(data));
  const buf = new Uint8Array(SALT_LEN + IV_LEN + enc.byteLength);
  buf.set(salt, 0);
  buf.set(iv, SALT_LEN);
  buf.set(new Uint8Array(enc), SALT_LEN + IV_LEN);
  return btoa(String.fromCharCode(...buf));
}
async function decrypt(encoded, passphrase) {
  const buf = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const salt = buf.slice(0, SALT_LEN);
  const iv = buf.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const ct = buf.slice(SALT_LEN + IV_LEN);
  const key = await deriveKey(passphrase, salt);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(dec);
}

// src/savedResponses/storage.ts
var KEY = "ua_saved_responses";
var DEFAULT_ID = "default";
function defaultState() {
  return {
    libraries: [{
      id: DEFAULT_ID,
      name: "Default",
      responses: [],
      createdAt: now(),
      updatedAt: now()
    }],
    activeLibraryId: DEFAULT_ID,
    domainMappings: {}
  };
}
async function loadState() {
  const r = await chrome.storage.local.get(KEY);
  return r[KEY] || defaultState();
}
async function saveState(state) {
  await chrome.storage.local.set({ [KEY]: state });
}
async function getActiveLibrary() {
  const s = await loadState();
  return s.libraries.find((l) => l.id === s.activeLibraryId) || s.libraries[0];
}
async function getLibraryForDomain(domain) {
  const s = await loadState();
  const mapped = s.domainMappings[domain];
  if (mapped) {
    const l = s.libraries.find((x) => x.id === mapped);
    if (l)
      return l;
  }
  return s.libraries.find((l) => l.id === s.activeLibraryId) || s.libraries[0];
}
async function getLibraries() {
  return (await loadState()).libraries;
}
async function setActiveLibrary(id) {
  const s = await loadState();
  if (s.libraries.some((l) => l.id === id)) {
    s.activeLibraryId = id;
    await saveState(s);
  }
}
async function createLibrary(name) {
  const s = await loadState();
  const lib = { id: generateId(), name, responses: [], createdAt: now(), updatedAt: now() };
  s.libraries.push(lib);
  await saveState(s);
  return lib;
}
async function deleteLibrary(id) {
  const s = await loadState();
  if (s.libraries.length <= 1)
    return false;
  s.libraries = s.libraries.filter((l) => l.id !== id);
  for (const [d, lid] of Object.entries(s.domainMappings))
    if (lid === id)
      delete s.domainMappings[d];
  if (s.activeLibraryId === id)
    s.activeLibraryId = s.libraries[0].id;
  await saveState(s);
  return true;
}
async function setDomainMapping(domain, libId) {
  const s = await loadState();
  s.domainMappings[domain] = libId;
  await saveState(s);
}
async function removeDomainMapping(domain) {
  const s = await loadState();
  delete s.domainMappings[domain];
  await saveState(s);
}
async function getDomainMappings() {
  return (await loadState()).domainMappings;
}
async function getResponses(libId) {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  return s.libraries.find((l) => l.id === id)?.responses || [];
}
async function saveResponse(resp, libId) {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  const lib = s.libraries.find((l) => l.id === id);
  if (!lib)
    throw new Error("Library not found");
  const ts = now();
  const idx = lib.responses.findIndex((r) => r.id === resp.id);
  if (idx >= 0) {
    lib.responses[idx] = { ...resp, updatedAt: ts };
  } else {
    lib.responses.push({ ...resp, id: resp.id || generateId(), createdAt: resp.createdAt || ts, updatedAt: ts });
  }
  lib.updatedAt = ts;
  await saveState(s);
  return resp;
}
async function deleteResponse(respId, libId) {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  const lib = s.libraries.find((l) => l.id === id);
  if (!lib)
    return;
  lib.responses = lib.responses.filter((r) => r.id !== respId);
  lib.updatedAt = now();
  await saveState(s);
}
async function deleteResponses(ids, libId) {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  const lib = s.libraries.find((l) => l.id === id);
  if (!lib)
    return;
  const set = new Set(ids);
  lib.responses = lib.responses.filter((r) => !set.has(r.id));
  lib.updatedAt = now();
  await saveState(s);
}
async function bulkTag(ids, tags, libId) {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  const lib = s.libraries.find((l) => l.id === id);
  if (!lib)
    return;
  const set = new Set(ids);
  for (const r of lib.responses) {
    if (set.has(r.id)) {
      const existing = new Set(r.tags || []);
      for (const t of tags)
        existing.add(t);
      r.tags = [...existing];
      r.updatedAt = now();
    }
  }
  lib.updatedAt = now();
  await saveState(s);
}
async function mergeResponses(keepId, mergeId, libId) {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  const lib = s.libraries.find((l) => l.id === id);
  if (!lib)
    return;
  const keep = lib.responses.find((r) => r.id === keepId);
  const merge = lib.responses.find((r) => r.id === mergeId);
  if (!keep || !merge)
    return;
  keep.keywords = [.../* @__PURE__ */ new Set([...keep.keywords, ...merge.keywords])];
  keep.appearances += merge.appearances;
  keep.updatedAt = now();
  lib.responses = lib.responses.filter((r) => r.id !== mergeId);
  lib.updatedAt = now();
  await saveState(s);
}
async function recordUsage(respId, libId) {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  const lib = s.libraries.find((l) => l.id === id);
  if (!lib)
    return;
  const r = lib.responses.find((x) => x.id === respId);
  if (r) {
    r.appearances++;
    r.lastUsedAt = now();
    r.updatedAt = now();
    lib.updatedAt = now();
    await saveState(s);
  }
}
async function importResponses(data, libId, mode = "merge") {
  const s = await loadState();
  const id = libId || s.activeLibraryId;
  const lib = s.libraries.find((l) => l.id === id);
  if (!lib)
    throw new Error("Library not found");
  const ts = now();
  if (mode === "replace")
    lib.responses = [];
  let count = 0;
  for (const e of data) {
    const norm = {
      id: e.id || generateId(),
      key: e.key || "",
      keywords: Array.isArray(e.keywords) ? e.keywords : [],
      question: e.question || "",
      response: e.response || "",
      appearances: typeof e.appearances === "number" ? e.appearances : 0,
      fromAutofill: typeof e.fromAutofill === "boolean" ? e.fromAutofill : false,
      tags: e.tags,
      lastUsedAt: e.lastUsedAt,
      createdAt: e.createdAt || ts,
      updatedAt: e.updatedAt || ts,
      domains: e.domains,
      atsTypes: e.atsTypes
    };
    if (mode === "merge") {
      const existing = lib.responses.find((r) => r.id === norm.id || r.question === norm.question);
      if (existing) {
        existing.keywords = [.../* @__PURE__ */ new Set([...existing.keywords, ...norm.keywords])];
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
async function exportResponses(libId) {
  const responses = await getResponses(libId);
  return responses.map((r) => ({
    appearances: r.appearances,
    fromAutofill: r.fromAutofill,
    id: r.id,
    key: r.key,
    keywords: r.keywords,
    question: r.question,
    response: r.response,
    ...r.tags?.length ? { tags: r.tags } : {},
    ...r.lastUsedAt ? { lastUsedAt: r.lastUsedAt } : {},
    ...r.createdAt ? { createdAt: r.createdAt } : {},
    ...r.updatedAt ? { updatedAt: r.updatedAt } : {},
    ...r.domains?.length ? { domains: r.domains } : {},
    ...r.atsTypes?.length ? { atsTypes: r.atsTypes } : {}
  }));
}
async function exportEncrypted(passphrase, libId) {
  const data = await exportResponses(libId);
  return encrypt(JSON.stringify(data, null, 2), passphrase);
}
async function importEncrypted(encoded, passphrase, libId, mode = "merge") {
  const json = await decrypt(encoded, passphrase);
  return importResponses(JSON.parse(json), libId, mode);
}
async function searchResponses(query, libId) {
  const all = await getResponses(libId);
  if (!query.trim())
    return all;
  const q = query.toLowerCase();
  return all.filter(
    (r) => r.question.toLowerCase().includes(q) || r.response.toLowerCase().includes(q) || r.key.toLowerCase().includes(q) || r.keywords.some((k) => k.toLowerCase().includes(q)) || r.tags && r.tags.some((t) => t.toLowerCase().includes(q))
  );
}

// src/utils/fuzzy.ts
function normalize(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokenize(text) {
  return normalize(text).split(" ").filter(Boolean);
}
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0)
    return n;
  if (n === 0)
    return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
function stringSimilarity(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (na === nb)
    return 1;
  const max = Math.max(na.length, nb.length);
  return max === 0 ? 1 : 1 - levenshtein(na, nb) / max;
}
function tokenOverlap(a, b) {
  if (!a.length && !b.length)
    return 1;
  if (!a.length || !b.length)
    return 0;
  const sa = new Set(a), sb = new Set(b);
  let inter = 0;
  for (const t of sa)
    if (sb.has(t))
      inter++;
  return inter / (/* @__PURE__ */ new Set([...sa, ...sb])).size;
}
function fuzzyTokenMatch(a, b) {
  if (!a.length)
    return b.length === 0 ? 1 : 0;
  let total = 0;
  for (const ta of a) {
    let best = 0;
    for (const tb of b)
      best = Math.max(best, stringSimilarity(ta, tb));
    total += best;
  }
  return total / a.length;
}
function hybridSimilarity(query, target, keywords) {
  const qt = tokenize(query), tt = tokenize(target);
  const direct = stringSimilarity(query, target) * 0.3;
  const overlap = tokenOverlap(qt, tt) * 0.25;
  const fuzzy = fuzzyTokenMatch(qt, tt) * 0.25;
  let kw = 0;
  if (keywords.length) {
    const nq = normalize(query);
    let hit = 0;
    for (const k of keywords)
      if (nq.includes(normalize(k)))
        hit++;
    kw = hit / keywords.length * 0.2;
  }
  return direct + overlap + fuzzy + kw;
}

// src/savedResponses/matcher.ts
function scoreResponse(query, resp, opts = {}) {
  const parts = [];
  let score = 0;
  const qSim = hybridSimilarity(query, resp.question, resp.keywords);
  score += qSim * 0.45;
  parts.push(`q_sim=${qSim.toFixed(3)}`);
  const keyTokens = resp.key.split("|").filter(Boolean);
  const qTokens = tokenize(query);
  const keyOv = tokenOverlap(qTokens, keyTokens);
  score += keyOv * 0.2;
  parts.push(`key=${keyOv.toFixed(3)}`);
  const pop = Math.min(Math.log2(1 + resp.appearances) / 10, 1);
  score += pop * 0.1;
  parts.push(`pop=${pop.toFixed(3)}`);
  let rec = 0;
  if (resp.lastUsedAt) {
    const days = (Date.now() - new Date(resp.lastUsedAt).getTime()) / 864e5;
    rec = Math.max(0, 1 - days / 90);
  }
  score += rec * 0.1;
  parts.push(`rec=${rec.toFixed(3)}`);
  let ctx = 0;
  if (opts.domain && resp.domains?.includes(opts.domain)) {
    ctx += 0.5;
    parts.push("dom+");
  }
  if (opts.atsType && resp.atsTypes?.includes(opts.atsType)) {
    ctx += 0.5;
    parts.push("ats+");
  }
  score += Math.min(ctx, 1) * 0.1;
  let kwb = 0;
  if (resp.keywords.length) {
    const nq = normalize(query);
    let hit = 0;
    for (const k of resp.keywords)
      if (nq.includes(k.toLowerCase()))
        hit++;
    kwb = hit / resp.keywords.length;
  }
  score += kwb * 0.05;
  parts.push(`kw=${kwb.toFixed(3)}`);
  return { score: Math.min(score, 1), explanation: parts.join(", ") };
}
function findMatches(query, responses, opts = {}) {
  const max = opts.maxResults || 3;
  if (!query.trim() || !responses.length)
    return [];
  return responses.map((r) => {
    const { score, explanation } = scoreResponse(query, r, opts);
    return { response: r, score, explanation };
  }).filter((s) => s.score > 0.15).sort((a, b) => b.score - a.score).slice(0, max);
}

// src/jobQueue/storage.ts
var KEY2 = "ua_job_queue";
function defaultState2() {
  return { items: [], currentItemId: null };
}
async function loadQueue() {
  const r = await chrome.storage.local.get(KEY2);
  return r[KEY2] || defaultState2();
}
async function saveQueue(state) {
  await chrome.storage.local.set({ [KEY2]: state });
}
async function getItems() {
  return (await loadQueue()).items;
}
async function addUrls(urls) {
  const s = await loadQueue();
  const existing = new Set(s.items.map((i) => i.url));
  let added = 0;
  for (const u of urls) {
    if (!isValidHttpsUrl(u.url) || existing.has(u.url))
      continue;
    existing.add(u.url);
    s.items.push({
      id: generateId(),
      url: u.url,
      company: u.company,
      role: u.role,
      priority: u.priority,
      notes: u.notes,
      status: "not_started",
      createdAt: now(),
      updatedAt: now()
    });
    added++;
  }
  await saveQueue(s);
  return added;
}
async function updateStatus(itemId, status, reason) {
  const s = await loadQueue();
  const item = s.items.find((i) => i.id === itemId);
  if (item) {
    item.status = status;
    item.updatedAt = now();
    if (reason)
      item.blockedReason = reason;
    if (status === "opened" || status === "prefilled")
      s.currentItemId = itemId;
    if (status === "completed" || status === "blocked") {
      if (s.currentItemId === itemId)
        s.currentItemId = null;
    }
    await saveQueue(s);
  }
}
async function clearQueue() {
  await saveQueue(defaultState2());
}
function parseJobCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2)
    return [];
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const urlIdx = header.findIndex((h) => ["url", "job_url", "link"].includes(h));
  if (urlIdx < 0)
    return [];
  const companyIdx = header.indexOf("company");
  const roleIdx = header.indexOf("role");
  const priorityIdx = header.indexOf("priority");
  const notesIdx = header.indexOf("notes");
  const results = [];
  const seen = /* @__PURE__ */ new Set();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const url = row[urlIdx]?.trim();
    if (!url || !isValidHttpsUrl(url) || seen.has(url))
      continue;
    seen.add(url);
    results.push({
      url,
      company: companyIdx >= 0 ? row[companyIdx]?.trim() : void 0,
      role: roleIdx >= 0 ? row[roleIdx]?.trim() : void 0,
      priority: priorityIdx >= 0 ? parseInt(row[priorityIdx], 10) || void 0 : void 0,
      notes: notesIdx >= 0 ? row[notesIdx]?.trim() : void 0
    });
  }
  return results;
}

// src/background/serviceWorker.ts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true;
});
async function handleMessage(msg) {
  const p = msg.payload;
  switch (msg.type) {
    case "GET_LIBRARIES":
      return { ok: true, data: await getLibraries() };
    case "GET_ACTIVE_LIBRARY":
      return { ok: true, data: await getActiveLibrary() };
    case "SET_ACTIVE_LIBRARY":
      await setActiveLibrary(p.id);
      return { ok: true };
    case "CREATE_LIBRARY":
      return { ok: true, data: await createLibrary(p.name) };
    case "DELETE_LIBRARY":
      return { ok: true, data: await deleteLibrary(p.id) };
    case "GET_DOMAIN_MAPPINGS":
      return { ok: true, data: await getDomainMappings() };
    case "SET_DOMAIN_MAPPING":
      await setDomainMapping(p.domain, p.libraryId);
      return { ok: true };
    case "REMOVE_DOMAIN_MAPPING":
      await removeDomainMapping(p.domain);
      return { ok: true };
    case "GET_RESPONSES":
      return { ok: true, data: await getResponses(p?.libraryId) };
    case "SAVE_RESPONSE":
      return { ok: true, data: await saveResponse(p.response, p.libraryId) };
    case "DELETE_RESPONSE":
      await deleteResponse(p.id, p.libraryId);
      return { ok: true };
    case "DELETE_RESPONSES":
      await deleteResponses(p.ids, p.libraryId);
      return { ok: true };
    case "SEARCH_RESPONSES":
      return { ok: true, data: await searchResponses(p.query, p.libraryId) };
    case "BULK_TAG":
      await bulkTag(p.ids, p.tags, p.libraryId);
      return { ok: true };
    case "MERGE_RESPONSES":
      await mergeResponses(p.keepId, p.mergeId, p.libraryId);
      return { ok: true };
    case "RECORD_USAGE":
      await recordUsage(p.id, p.libraryId);
      return { ok: true };
    case "IMPORT_RESPONSES":
      return { ok: true, data: await importResponses(p.data, p.libraryId, p.mode) };
    case "EXPORT_RESPONSES":
      return { ok: true, data: await exportResponses(p?.libraryId) };
    case "EXPORT_ENCRYPTED":
      return { ok: true, data: await exportEncrypted(p.passphrase, p.libraryId) };
    case "IMPORT_ENCRYPTED":
      return { ok: true, data: await importEncrypted(p.data, p.passphrase, p.libraryId, p.mode) };
    case "GET_SUGGESTIONS": {
      const lib = p.domain ? await getLibraryForDomain(p.domain) : await getActiveLibrary();
      const matches = findMatches(p.query, lib.responses, { domain: p.domain, atsType: p.atsType, maxResults: 3 });
      return { ok: true, data: matches };
    }
    case "GET_JOB_QUEUE":
      return { ok: true, data: await getItems() };
    case "ADD_JOB_URLS":
      return { ok: true, data: await addUrls(p.urls) };
    case "IMPORT_JOB_CSV": {
      const parsed = parseJobCSV(p.csv);
      const added = await addUrls(parsed);
      return { ok: true, data: { parsed: parsed.length, added } };
    }
    case "UPDATE_JOB_STATUS":
      await updateStatus(p.id, p.status, p.reason);
      return { ok: true };
    case "CLEAR_JOB_QUEUE":
      await clearQueue();
      return { ok: true };
    case "OPEN_JOB_TAB":
      await chrome.tabs.create({ url: p.url, active: true });
      await updateStatus(p.id, "opened");
      return { ok: true };
    case "START_AUTOFILL": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: "START_AUTOFILL" });
      }
      return { ok: true };
    }
    case "STOP_AUTOFILL": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: "STOP_AUTOFILL" });
      }
      return { ok: true };
    }
    case "DETECT_ATS": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        const r = await chrome.tabs.sendMessage(tab.id, { type: "DETECT_ATS" });
        return { ok: true, data: r };
      }
      return { ok: false, error: "No active tab" };
    }
    default:
      return { ok: false, error: `Unknown message: ${msg.type}` };
  }
}
chrome.runtime.onInstalled?.addListener(async () => {
  const state = await loadState();
  if (!state.libraries.length) {
    await saveState({
      libraries: [{
        id: "default",
        name: "Default",
        responses: [],
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }],
      activeLibraryId: "default",
      domainMappings: {}
    });
  }
});
//# sourceMappingURL=background.js.map
