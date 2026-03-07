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
function normalizeUrl(urlStr) {
  try {
    const url = new URL(urlStr.trim());
    url.hostname = url.hostname.toLowerCase();
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "fbclid", "gclid", "source", "trackingId"];
    for (const p of trackingParams) {
      url.searchParams.delete(p);
    }
    let path = url.pathname;
    if (path.length > 1 && path.endsWith("/"))
      path = path.slice(0, -1);
    url.pathname = path;
    return url.toString();
  } catch {
    return urlStr.trim();
  }
}
function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
async function addUrls(urls) {
  const s = await loadQueue();
  const existing = new Set(s.items.map((i) => normalizeUrl(i.url)));
  let added = 0;
  for (const u of urls) {
    const normalized = normalizeUrl(u.url);
    if (!isValidUrl(normalized) || existing.has(normalized))
      continue;
    existing.add(normalized);
    s.items.push({
      id: generateId(),
      url: u.url.trim(),
      normalizedUrl: normalized,
      company: u.company,
      role: u.role,
      priority: u.priority,
      notes: u.notes,
      status: "not_started",
      source: "manual",
      retryCount: 0,
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
    if (reason) {
      if (status === "blocked")
        item.blockedReason = reason;
      if (status === "failed")
        item.failReason = reason;
    }
    if (status === "applied")
      item.appliedAt = now();
    if (status === "opened" || status === "applying" || status === "prefilled")
      s.currentItemId = itemId;
    if (status === "completed" || status === "blocked" || status === "applied" || status === "failed" || status === "skipped") {
      if (s.currentItemId === itemId)
        s.currentItemId = null;
    }
    await saveQueue(s);
  }
}
async function removeItem(itemId) {
  const s = await loadQueue();
  s.items = s.items.filter((i) => i.id !== itemId);
  if (s.currentItemId === itemId)
    s.currentItemId = null;
  await saveQueue(s);
}
async function clearQueue() {
  await saveQueue(defaultState2());
}
async function retryFailed() {
  const s = await loadQueue();
  let count = 0;
  for (const item of s.items) {
    if (item.status === "failed" && (item.retryCount || 0) < 3) {
      item.status = "not_started";
      item.retryCount = (item.retryCount || 0) + 1;
      item.failReason = void 0;
      item.updatedAt = now();
      count++;
    }
  }
  await saveQueue(s);
  return count;
}
async function getNextJob() {
  const s = await loadQueue();
  const pending = s.items.filter((i) => i.status === "not_started").sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pb !== pa)
      return pb - pa;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  return pending[0] || null;
}
async function exportQueue() {
  const items = await getItems();
  const header = "url,company,role,priority,notes,status,source,applied_at,fail_reason";
  const rows = items.map(
    (i) => [i.url, i.company || "", i.role || "", i.priority ?? "", i.notes || "", i.status, i.source || "", i.appliedAt || "", i.failReason || ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
  );
  return [header, ...rows].join("\n");
}
function parseJobCSVWithStats(text) {
  const stats = {
    totalParsed: 0,
    validUrls: 0,
    invalidUrls: 0,
    duplicates: 0,
    added: 0,
    invalidRows: []
  };
  const rows = parseCSV(text);
  if (rows.length < 1)
    return stats;
  const firstRow = rows[0].map((h) => h.toLowerCase().trim());
  let urlIdx = firstRow.findIndex((h) => ["url", "job_url", "link", "job_link", "application_url"].includes(h));
  let hasHeader = urlIdx >= 0;
  if (!hasHeader) {
    if (rows[0].length === 1 && isValidUrl(rows[0][0].trim())) {
      urlIdx = 0;
      hasHeader = false;
    } else {
      urlIdx = 0;
      hasHeader = false;
    }
  }
  const companyIdx = hasHeader ? firstRow.indexOf("company") : -1;
  const roleIdx = hasHeader ? firstRow.findIndex((h) => ["role", "title", "job_title", "position"].includes(h)) : -1;
  const priorityIdx = hasHeader ? firstRow.indexOf("priority") : -1;
  const notesIdx = hasHeader ? firstRow.indexOf("notes") : -1;
  const seen = /* @__PURE__ */ new Set();
  const startRow = hasHeader ? 1 : 0;
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    stats.totalParsed++;
    const rawUrl = row[urlIdx]?.trim();
    if (!rawUrl) {
      stats.invalidUrls++;
      stats.invalidRows.push({ row: i + 1, url: rawUrl || "(empty)", reason: "Empty URL" });
      continue;
    }
    if (!isValidUrl(rawUrl)) {
      stats.invalidUrls++;
      stats.invalidRows.push({ row: i + 1, url: rawUrl, reason: "Invalid URL format" });
      continue;
    }
    const normalized = normalizeUrl(rawUrl);
    if (seen.has(normalized)) {
      stats.duplicates++;
      continue;
    }
    seen.add(normalized);
    stats.validUrls++;
  }
  return stats;
}
function parseJobCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 1)
    return [];
  const firstRow = rows[0].map((h) => h.toLowerCase().trim());
  let urlIdx = firstRow.findIndex((h) => ["url", "job_url", "link", "job_link", "application_url"].includes(h));
  let hasHeader = urlIdx >= 0;
  if (!hasHeader) {
    urlIdx = 0;
    hasHeader = false;
    if (firstRow[0] && !isValidUrl(rows[0][0].trim())) {
      hasHeader = true;
    }
  }
  const companyIdx = hasHeader ? firstRow.indexOf("company") : -1;
  const roleIdx = hasHeader ? firstRow.findIndex((h) => ["role", "title", "job_title", "position"].includes(h)) : -1;
  const priorityIdx = hasHeader ? firstRow.indexOf("priority") : -1;
  const notesIdx = hasHeader ? firstRow.indexOf("notes") : -1;
  const results = [];
  const seen = /* @__PURE__ */ new Set();
  const startRow = hasHeader ? 1 : 0;
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const rawUrl = row[urlIdx]?.trim();
    if (!rawUrl || !isValidUrl(rawUrl))
      continue;
    const normalized = normalizeUrl(rawUrl);
    if (seen.has(normalized))
      continue;
    seen.add(normalized);
    results.push({
      url: rawUrl,
      company: companyIdx >= 0 ? row[companyIdx]?.trim() : void 0,
      role: roleIdx >= 0 ? row[roleIdx]?.trim() : void 0,
      priority: priorityIdx >= 0 ? parseInt(row[priorityIdx], 10) || void 0 : void 0,
      notes: notesIdx >= 0 ? row[notesIdx]?.trim() : void 0
    });
  }
  return results;
}
async function importCSVJobs(text) {
  const stats = parseJobCSVWithStats(text);
  const parsed = parseJobCSV(text);
  const s = await loadQueue();
  const existing = new Set(s.items.map((i) => normalizeUrl(i.url)));
  let added = 0;
  for (const u of parsed) {
    const normalized = normalizeUrl(u.url);
    if (existing.has(normalized)) {
      stats.duplicates++;
      continue;
    }
    existing.add(normalized);
    s.items.push({
      id: generateId(),
      url: u.url.trim(),
      normalizedUrl: normalized,
      company: u.company,
      role: u.role,
      priority: u.priority,
      notes: u.notes,
      status: "not_started",
      source: "csv_import",
      retryCount: 0,
      createdAt: now(),
      updatedAt: now()
    });
    added++;
  }
  await saveQueue(s);
  stats.added = added;
  return stats;
}
async function getImportedJobs() {
  const s = await loadQueue();
  return s.items.filter((i) => i.source === "csv_import");
}
async function getImportStats() {
  const items = await getImportedJobs();
  return {
    total: items.length,
    pending: items.filter((i) => i.status === "not_started").length,
    applying: items.filter((i) => i.status === "applying" || i.status === "opened" || i.status === "prefilled").length,
    applied: items.filter((i) => i.status === "applied").length,
    failed: items.filter((i) => i.status === "failed").length,
    skipped: items.filter((i) => i.status === "skipped").length,
    completed: items.filter((i) => i.status === "completed").length
  };
}

// src/settings/storage.ts
var KEY3 = "ua_settings";
function defaultAutoApply() {
  return {
    enabled: true,
    autoSubmit: false,
    // Default OFF for safety
    autoSubmitPerSite: {},
    maxConcurrency: 1,
    delayBetweenJobs: 3e3,
    // 3 seconds between jobs
    humanLikePacing: true,
    closeTabAfterApply: false,
    retryFailedMax: 2,
    requireResumeForSubmit: true,
    domainAllowlist: [
      "myworkdayjobs.com",
      "myworkday.com",
      "greenhouse.io",
      "lever.co",
      "smartrecruiters.com",
      "icims.com",
      "taleo.net",
      "ashbyhq.com",
      "bamboohr.com",
      "oraclecloud.com",
      "indeed.com",
      "linkedin.com"
    ],
    rateLimit: { maxPerHour: 30, maxPerDay: 200 },
    paused: false
  };
}
function defaultScraper() {
  return {
    enabled: false,
    intervalMinutes: 10,
    sources: { ats: true, indeed: true, linkedinNonEasyApply: true },
    targetCountPerSession: 50,
    freshnessTiers: { tierA: 30, tierB: 1440, tierC: 4320 },
    filters: {
      keywords: [],
      geoRadius: 50,
      location: "",
      seniority: [],
      remoteOnly: false,
      hybridAllowed: true
    }
  };
}
function defaultTailoring() {
  return {
    enabled: true,
    intensity: 0.8,
    // High tailoring by default
    profileKeywords: [],
    targetKeywords: [],
    profileSummary: ""
  };
}
function defaultSettings() {
  return {
    autoApply: defaultAutoApply(),
    scraper: defaultScraper(),
    tailoring: defaultTailoring(),
    applicationsAccount: null,
    creditsUnlimited: true,
    // Unlimited credits by default
    autoDetectAndFill: true,
    // Auto-detect ATS and fill on page load
    universalFormDetection: true,
    // Detect ALL forms, not just known ATS
    supportedPlatforms: {
      workday: true,
      greenhouse: true,
      lever: true,
      smartrecruiters: true,
      icims: true,
      taleo: true,
      ashby: true,
      bamboohr: true,
      oraclecloud: true,
      linkedin: true,
      indeed: true,
      companysite: true
    }
  };
}
async function loadSettings() {
  const r = await chrome.storage.local.get(KEY3);
  const saved = r[KEY3];
  if (!saved)
    return defaultSettings();
  const defaults = defaultSettings();
  return {
    ...defaults,
    ...saved,
    autoApply: { ...defaults.autoApply, ...saved.autoApply },
    scraper: { ...defaults.scraper, ...saved.scraper, filters: { ...defaults.scraper.filters, ...saved.scraper?.filters || {} } },
    tailoring: { ...defaults.tailoring, ...saved.tailoring || {} },
    supportedPlatforms: { ...defaults.supportedPlatforms, ...saved.supportedPlatforms }
  };
}
async function saveSettings(settings) {
  await chrome.storage.local.set({ [KEY3]: settings });
}
async function saveAppAccount(email, password, passphrase) {
  const s = await loadSettings();
  const encryptedPassword = await encrypt(password, passphrase);
  s.applicationsAccount = {
    email,
    encryptedPassword,
    salt: crypto.getRandomValues(new Uint8Array(16)).toString()
  };
  await saveSettings(s);
}
async function getAppAccount(passphrase) {
  const s = await loadSettings();
  if (!s.applicationsAccount)
    return null;
  try {
    const password = await decrypt(s.applicationsAccount.encryptedPassword, passphrase);
    return { email: s.applicationsAccount.email, password };
  } catch {
    return null;
  }
}
async function clearAppAccount() {
  const s = await loadSettings();
  s.applicationsAccount = null;
  await saveSettings(s);
}
async function checkCredits() {
  const s = await loadSettings();
  return { unlimited: s.creditsUnlimited, remaining: Infinity };
}

// src/autoApply/engine.ts
var _status = {
  running: false,
  paused: false,
  currentJobId: null,
  currentJobUrl: null,
  totalJobs: 0,
  completedJobs: 0,
  failedJobs: 0,
  skippedJobs: 0,
  startedAt: null,
  estimatedRemaining: 0
};
var _abortController = null;
var _appliedThisHour = 0;
var _appliedToday = 0;
var RATE_KEY = "ua_rate_limits";
async function loadRateLimits() {
  const r = await chrome.storage.local.get(RATE_KEY);
  const data = r[RATE_KEY];
  if (!data)
    return { hour: 0, day: 0, hourReset: Date.now() + 36e5, dayReset: Date.now() + 864e5 };
  const now2 = Date.now();
  if (now2 > data.hourReset)
    data.hour = 0;
  if (now2 > data.dayReset)
    data.day = 0;
  return data;
}
async function incrementRateLimit() {
  const limits = await loadRateLimits();
  limits.hour++;
  limits.day++;
  if (limits.hourReset < Date.now())
    limits.hourReset = Date.now() + 36e5;
  if (limits.dayReset < Date.now())
    limits.dayReset = Date.now() + 864e5;
  await chrome.storage.local.set({ [RATE_KEY]: limits });
  _appliedThisHour = limits.hour;
  _appliedToday = limits.day;
}
async function checkRateLimit(settings) {
  const limits = await loadRateLimits();
  _appliedThisHour = limits.hour;
  _appliedToday = limits.day;
  return limits.hour < settings.rateLimit.maxPerHour && limits.day < settings.rateLimit.maxPerDay;
}
function getStatus() {
  return { ..._status };
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function humanDelay(baseMs) {
  const variance = baseMs * 0.3;
  const actual = baseMs + (Math.random() * variance * 2 - variance);
  return delay(Math.max(500, actual));
}
async function startAutoApply(source) {
  if (_status.running)
    return;
  const settings = await loadSettings();
  if (!settings.autoApply.enabled)
    return;
  _abortController = new AbortController();
  const items = await getItems();
  const pendingJobs = items.filter((j) => {
    if (j.status !== "not_started")
      return false;
    if (source === "imported" && j.source !== "csv_import")
      return false;
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
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    estimatedRemaining: pendingJobs.length
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
async function processQueue(settings, source) {
  while (_status.running && !_abortController?.signal.aborted) {
    if (_status.paused) {
      await delay(1e3);
      continue;
    }
    const withinLimits = await checkRateLimit(settings);
    if (!withinLimits) {
      console.log("[UA] Rate limit reached, pausing auto-apply");
      _status.paused = true;
      await delay(6e4);
      _status.paused = false;
      continue;
    }
    const job = await getNextJob();
    if (!job) {
      console.log("[UA] No more jobs in queue");
      break;
    }
    if (source === "imported" && job.source !== "csv_import") {
      continue;
    }
    try {
      const domain = new URL(job.url).hostname;
      const isAllowed = settings.domainAllowlist.length === 0 || settings.domainAllowlist.some((d) => domain.includes(d));
      if (!isAllowed) {
        await updateStatus(job.id, "skipped", "Domain not in allowlist");
        _status.skippedJobs++;
        _status.estimatedRemaining--;
        continue;
      }
    } catch {
      await updateStatus(job.id, "failed", "Invalid URL");
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
      console.error("[UA] Job failed:", job.url, err);
      const retryCount = (job.retryCount || 0) + 1;
      if (retryCount <= settings.retryFailedMax) {
        await updateStatus(job.id, "not_started", `Retry ${retryCount}/${settings.retryFailedMax}: ${String(err)}`);
        const items = await getItems();
        const item = items.find((i) => i.id === job.id);
        if (item) {
          item.retryCount = retryCount;
          const state = await loadQueue();
          const stateItem = state.items.find((i) => i.id === job.id);
          if (stateItem)
            stateItem.retryCount = retryCount;
          await chrome.storage.local.set({ ua_job_queue: state });
        }
      } else {
        await updateStatus(job.id, "failed", String(err));
        _status.failedJobs++;
      }
    }
    _status.estimatedRemaining--;
    if (settings.humanLikePacing) {
      await humanDelay(settings.delayBetweenJobs);
    } else {
      await delay(settings.delayBetweenJobs);
    }
  }
}
async function processJob(job, settings) {
  await updateStatus(job.id, "applying");
  const tab = await chrome.tabs.create({ url: job.url, active: false });
  if (!tab.id)
    throw new Error("Failed to create tab");
  await waitForTabLoad(tab.id, 3e4);
  await delay(2e3);
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "START_AUTOFILL",
      payload: { autoSubmit: settings.autoSubmit, jobId: job.id }
    });
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      await delay(1e3);
      await chrome.tabs.sendMessage(tab.id, {
        type: "START_AUTOFILL",
        payload: { autoSubmit: settings.autoSubmit, jobId: job.id }
      });
    } catch (e) {
      throw new Error(`Cannot inject content script: ${e}`);
    }
  }
  const result = await waitForAutofillComplete(tab.id, job.id, 12e4);
  if (result === "applied") {
    await updateStatus(job.id, "applied");
  } else if (result === "prefilled") {
    await updateStatus(job.id, "prefilled");
  } else if (result === "needs_input") {
    await updateStatus(job.id, "needs_input", "Manual input required");
  } else {
    await updateStatus(job.id, "prefilled");
  }
  if (settings.closeTabAfterApply && (result === "applied" || result === "completed")) {
    try {
      await chrome.tabs.remove(tab.id);
    } catch {
    }
  }
}
function waitForTabLoad(tabId, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeout);
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}
function waitForAutofillComplete(tabId, jobId, timeout) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      resolve("prefilled");
    }, timeout);
    function listener(msg, sender) {
      if (sender.tab?.id === tabId && msg.type === "PAGE_AUTOFILL_COMPLETE") {
        clearTimeout(timer);
        chrome.runtime.onMessage.removeListener(listener);
        resolve(msg.payload?.status || "prefilled");
      }
    }
    chrome.runtime.onMessage.addListener(listener);
  });
}
function stopAutoApply() {
  _status.running = false;
  _abortController?.abort();
}
function pauseAutoApply() {
  _status.paused = true;
}
function resumeAutoApply() {
  _status.paused = false;
}

// src/autoApply/scraper.ts
var SCRAPED_KEY = "ua_scraped_jobs";
var _scraperInterval = null;
var _running = false;
function getFreshnessTier(ageMinutes, tiers) {
  if (ageMinutes <= tiers.tierA)
    return "A";
  if (ageMinutes <= tiers.tierB)
    return "B";
  if (ageMinutes <= tiers.tierC)
    return "C";
  return "old";
}
async function loadScrapedJobs() {
  const r = await chrome.storage.local.get(SCRAPED_KEY);
  return r[SCRAPED_KEY] || [];
}
async function saveScrapedJobs(jobs) {
  await chrome.storage.local.set({ [SCRAPED_KEY]: jobs });
}
async function getRankedJobs(targetCount) {
  const settings = await loadSettings();
  const target = targetCount || settings.scraper.targetCountPerSession;
  const jobs = await loadScrapedJobs();
  const now2 = Date.now();
  for (const job of jobs) {
    const firstSeen = new Date(job.firstSeenAt);
    const ageMinutes = (now2 - firstSeen.getTime()) / 6e4;
    job.freshnessTier = getFreshnessTier(ageMinutes, settings.scraper.freshnessTiers);
  }
  const tierOrder = { A: 0, B: 1, C: 2, old: 3 };
  const sorted = jobs.filter((j) => j.status === "new").sort((a, b) => {
    const tierDiff = tierOrder[a.freshnessTier] - tierOrder[b.freshnessTier];
    if (tierDiff !== 0)
      return tierDiff;
    return new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime();
  });
  const result = [];
  for (const job of sorted) {
    if (result.length >= target) {
      if (job.freshnessTier === "old")
        break;
    }
    result.push(job);
  }
  return result.slice(0, target);
}
async function startScraper() {
  if (_running)
    return;
  _running = true;
  const settings = await loadSettings();
  if (!settings.scraper.enabled) {
    _running = false;
    return;
  }
  const intervalMs = settings.scraper.intervalMinutes * 60 * 1e3;
  _scraperInterval = setInterval(async () => {
    if (!_running)
      return;
    const jobs = await loadScrapedJobs();
    const now2 = Date.now();
    for (const job of jobs) {
      const firstSeen = new Date(job.firstSeenAt);
      const ageMinutes = (now2 - firstSeen.getTime()) / 6e4;
      job.freshnessTier = getFreshnessTier(ageMinutes, settings.scraper.freshnessTiers);
    }
    await saveScrapedJobs(jobs);
  }, intervalMs);
}
function stopScraper() {
  _running = false;
  if (_scraperInterval) {
    clearInterval(_scraperInterval);
    _scraperInterval = null;
  }
}

// src/answerBank/index.ts
var ANSWER_BANK_KEY = "ua_answer_bank";
var PROFILE_KEY = "ua_user_profile";
var _answerBank = {};
var _loaded = false;
function normalizeKey(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
async function loadAnswerBank() {
  if (_loaded)
    return _answerBank;
  const r = await chrome.storage.local.get(ANSWER_BANK_KEY);
  _answerBank = r[ANSWER_BANK_KEY] || {};
  _loaded = true;
  return _answerBank;
}
async function learnAnswer(label, value) {
  if (!label || !value)
    return;
  const key = normalizeKey(label);
  if (!key)
    return;
  _answerBank[key] = value;
  await chrome.storage.local.set({ [ANSWER_BANK_KEY]: _answerBank });
}
async function loadProfile() {
  const r = await chrome.storage.local.get(PROFILE_KEY);
  return r[PROFILE_KEY] || {};
}
async function saveProfile(profile) {
  await chrome.storage.local.set({ [PROFILE_KEY]: profile });
}

// src/background/serviceWorker.ts
var CSV_QUEUE_KEY = "csvJobQueue";
var csvQueueRunning = false;
var csvQueuePaused = false;
var _reuseTabId = null;
var _activeJobResolve = null;
var _activeJobId = null;
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    ["utm_source", "utm_medium", "utm_campaign", "ref", "source", "fbclid"].forEach((p) => u.searchParams.delete(p));
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}
async function isAlreadyApplied(url) {
  const { appliedJobs = [] } = await chrome.storage.local.get("appliedJobs");
  return appliedJobs.includes(normalizeUrl(url));
}
function randDelay(minS, maxS) {
  const ms = (minS + Math.random() * (maxS - minS)) * 1e3;
  return new Promise((r) => setTimeout(r, ms));
}
function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {
  });
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "COMPLEX_FORM_SUCCESS" && _activeJobResolve) {
    const r = _activeJobResolve;
    _activeJobResolve = null;
    r("done");
    return false;
  }
  if (msg.type === "COMPLEX_FORM_ERROR" && _activeJobResolve) {
    const r = _activeJobResolve;
    _activeJobResolve = null;
    r(msg.errorType === "alreadyApplied" ? "duplicate" : "failed");
    return false;
  }
  if (msg.type === "SIDEBAR_STATUS" || msg.type === "SIDEBAR_FIELD_UPDATE") {
    chrome.runtime.sendMessage(msg).catch(() => {
    });
    return false;
  }
  handleMessage(msg, sender).then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true;
});
async function handleMessage(msg, sender) {
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
      const stats = await importCSVJobs(p.csv);
      return { ok: true, data: stats };
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
    case "REMOVE_JOB":
      await removeItem(p.id);
      return { ok: true };
    case "RETRY_FAILED_JOBS": {
      const retried = await retryFailed();
      return { ok: true, data: retried };
    }
    case "GET_IMPORT_STATS":
      return { ok: true, data: await getImportStats() };
    case "EXPORT_JOB_RESULTS": {
      const csv = await exportQueue();
      return { ok: true, data: csv };
    }
    case "START_AUTO_APPLY":
      startAutoApply(p?.source || "all");
      return { ok: true };
    case "STOP_AUTO_APPLY":
      stopAutoApply();
      return { ok: true };
    case "PAUSE_AUTO_APPLY":
      pauseAutoApply();
      return { ok: true };
    case "RESUME_AUTO_APPLY":
      resumeAutoApply();
      return { ok: true };
    case "GET_AUTO_APPLY_STATUS":
      return { ok: true, data: getStatus() };
    case "GET_SETTINGS":
      return { ok: true, data: await loadSettings() };
    case "SAVE_SETTINGS":
      await saveSettings(p);
      return { ok: true };
    case "SAVE_APP_ACCOUNT":
      await saveAppAccount(p.email, p.password, p.passphrase);
      return { ok: true };
    case "GET_APP_ACCOUNT": {
      const account = await getAppAccount(p.passphrase);
      if (account)
        return { ok: true, data: { email: account.email } };
      return { ok: false, error: "Invalid passphrase or no account saved" };
    }
    case "CLEAR_APP_ACCOUNT":
      await clearAppAccount();
      return { ok: true };
    case "GET_CREDITS":
    case "CHECK_CREDITS":
      return { ok: true, data: await checkCredits() };
    case "START_SCRAPER":
      await startScraper();
      return { ok: true };
    case "STOP_SCRAPER":
      stopScraper();
      return { ok: true };
    case "GET_SCRAPED_JOBS": {
      const jobs = await getRankedJobs(p?.targetCount);
      return { ok: true, data: jobs };
    }
    case "START_AUTOFILL": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: "START_AUTOFILL", payload: p });
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
    case "AUTO_DETECT_FILL": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: "AUTO_DETECT_FILL" });
      }
      return { ok: true };
    }
    case "PAGE_AUTOFILL_COMPLETE":
      return { ok: true };
    case "ADD_CURRENT_PAGE_TO_QUEUE": {
      const url = p?.url;
      if (!url)
        return { ok: false, error: "No URL provided" };
      const existing = await getItems();
      const normalized = normalizeUrl(url);
      const isDuplicate = existing.some((i) => normalizeUrl(i.url) === normalized);
      if (isDuplicate)
        return { ok: false, error: "Already in queue" };
      const added = await addUrls([{
        url,
        company: p.company || void 0,
        role: p.role || void 0
      }]);
      if (added > 0 && p.source === "one_click") {
        const items = await getItems();
        const item = items.find((i) => normalizeUrl(i.url) === normalized);
        if (item) {
          item.source = "one_click";
          const state = await loadQueue();
          const stateItem = state.items.find((i) => i.id === item.id);
          if (stateItem)
            stateItem.source = "one_click";
          await chrome.storage.local.set({ ua_job_queue: state });
        }
      }
      return { ok: true, data: { added } };
    }
    case "TAILOR_RESPONSE":
      return { ok: true };
    case "GET_TAILORING_STATUS": {
      const s = await loadSettings();
      return { ok: true, data: { enabled: s.tailoring.enabled, intensity: s.tailoring.intensity } };
    }
    case "GET_ANSWER_BANK":
      return { ok: true, data: await loadAnswerBank() };
    case "SAVE_ANSWER":
      await learnAnswer(p.label, p.value);
      return { ok: true };
    case "CLEAR_ANSWER_BANK":
      await chrome.storage.local.remove("ua_answer_bank");
      return { ok: true };
    case "GET_PROFILE":
      return { ok: true, data: await loadProfile() };
    case "SAVE_PROFILE":
      await saveProfile(p);
      return { ok: true };
    case "START_CSV_QUEUE":
      startCsvQueue();
      return { ok: true };
    case "STOP_CSV_QUEUE":
      stopCsvQueue();
      return { ok: true };
    case "PAUSE_CSV_QUEUE":
      csvQueuePaused = true;
      return { ok: true };
    case "RESUME_CSV_QUEUE":
      if (csvQueueRunning && csvQueuePaused) {
        csvQueuePaused = false;
        processNextCsvJob();
      }
      return { ok: true };
    case "SKIP_CSV_JOB":
      if (_activeJobResolve) {
        const r = _activeJobResolve;
        _activeJobResolve = null;
        r("skipped");
      }
      return { ok: true };
    case "TRIGGER_AUTOFILL": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_AUTOFILL" });
      }
      return { ok: true };
    }
    default:
      return { ok: false, error: `Unknown message: ${msg.type}` };
  }
}
function startCsvQueue() {
  if (csvQueueRunning)
    return;
  csvQueueRunning = true;
  csvQueuePaused = false;
  processNextCsvJob();
}
function stopCsvQueue() {
  csvQueueRunning = false;
  csvQueuePaused = false;
  if (_activeJobResolve) {
    const r = _activeJobResolve;
    _activeJobResolve = null;
    r("skipped");
  }
  _reuseTabId = null;
  chrome.storage.local.set({ csvQueueRunning: false, csvActiveJobId: null, csvActiveTabId: null });
  broadcast({ type: "SIDEBAR_STATUS", event: "queue_stopped" });
}
async function processNextCsvJob() {
  if (!csvQueueRunning || csvQueuePaused)
    return;
  try {
    await _processNextCsvJobInner();
  } catch (err) {
    console.error("[UA-SW] processNextCsvJob error:", err);
    if (csvQueueRunning && !csvQueuePaused)
      setTimeout(processNextCsvJob, 3e3);
  }
}
async function _processNextCsvJobInner() {
  if (!csvQueueRunning || csvQueuePaused)
    return;
  const { csvJobQueue: q = [] } = await chrome.storage.local.get(CSV_QUEUE_KEY);
  const job = q.find((j) => j.status === "pending");
  if (!job) {
    csvQueueRunning = false;
    await chrome.storage.local.set({ csvQueueRunning: false, csvActiveJobId: null, csvActiveTabId: null });
    broadcast({ type: "CSV_QUEUE_DONE" });
    return;
  }
  job.status = "running";
  job.startedAt = Date.now();
  await chrome.storage.local.set({ [CSV_QUEUE_KEY]: q });
  if (await isAlreadyApplied(job.url)) {
    job.status = "duplicate";
    job.finishedAt = Date.now();
    job.lastError = "Already applied previously";
    await chrome.storage.local.set({ [CSV_QUEUE_KEY]: q });
    broadcast({ type: "CSV_JOB_COMPLETE", jobId: job.id, status: "duplicate" });
    setTimeout(processNextCsvJob, 600);
    return;
  }
  broadcast({ type: "CSV_JOB_STARTED", jobId: job.id, url: job.url });
  let tab;
  try {
    if (_reuseTabId) {
      try {
        await chrome.tabs.update(_reuseTabId, { url: job.url, active: true });
        tab = await chrome.tabs.get(_reuseTabId);
      } catch {
        _reuseTabId = null;
        tab = await chrome.tabs.create({ url: job.url, active: true });
        _reuseTabId = tab.id;
      }
    } else {
      tab = await chrome.tabs.create({ url: job.url, active: true });
      _reuseTabId = tab.id;
    }
  } catch (e) {
    job.status = "failed";
    job.finishedAt = Date.now();
    job.lastError = "Could not open tab: " + e.message;
    await chrome.storage.local.set({ [CSV_QUEUE_KEY]: q });
    broadcast({ type: "CSV_JOB_COMPLETE", jobId: job.id, status: "failed", reason: e.message });
    setTimeout(processNextCsvJob, 2e3);
    return;
  }
  _activeJobId = job.id;
  const pendingCount = q.filter((j) => j.status === "pending" || j.status === "running").length;
  const totalCount = q.length;
  const jobIndex = totalCount - pendingCount + 1;
  broadcast({ type: "CSV_QUEUE_PROGRESS", jobIndex, totalCount, jobId: job.id, url: job.url });
  await chrome.storage.local.set({
    csvActiveJobId: job.id,
    csvActiveTabId: tab.id,
    csvQueueRunning: true
  });
  const _triggerOnTabLoad = async (updTabId, changeInfo) => {
    if (updTabId !== tab.id || changeInfo.status !== "complete")
      return;
    chrome.tabs.onUpdated.removeListener(_triggerOnTabLoad);
    await new Promise((r) => setTimeout(r, 3e3));
    await chrome.storage.local.set({ csvActiveJobId: job.id, csvActiveTabId: tab.id });
    let contentScriptReady = false;
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const resp = await chrome.tabs.sendMessage(tab.id, { type: "PING" });
        if (resp?.ready) {
          contentScriptReady = true;
          break;
        }
      } catch {
      }
      await new Promise((r) => setTimeout(r, 2e3));
    }
    if (!contentScriptReady) {
      console.warn("[UA-SW] Content script did not respond to PING after 30s \u2014 trying TRIGGER anyway");
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_AUTOFILL", jobId: job.id });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 2e3 + attempt * 2e3));
      }
    }
  };
  chrome.tabs.onUpdated.addListener(_triggerOnTabLoad);
  const result = await waitForCsvResult(tab.id, job.id, 18e4);
  chrome.tabs.onUpdated.removeListener(_triggerOnTabLoad);
  _activeJobId = null;
  await chrome.storage.local.set({ csvActiveJobId: null, csvActiveTabId: null });
  const freshQ = (await chrome.storage.local.get(CSV_QUEUE_KEY))[CSV_QUEUE_KEY] || [];
  const freshJob = freshQ.find((j) => j.id === job.id);
  if (freshJob) {
    freshJob.finishedAt = Date.now();
    if (result === "done") {
      freshJob.status = "done";
    } else if (result === "duplicate") {
      freshJob.status = "duplicate";
      freshJob.lastError = "Already applied";
    } else if (result === "skipped") {
      freshJob.status = "skipped";
      freshJob.lastError = "Skipped";
    } else {
      freshJob.status = result?.startsWith("failed") ? "failed" : "skipped";
      freshJob.lastError = result || "Timeout";
    }
    await chrome.storage.local.set({ [CSV_QUEUE_KEY]: freshQ });
  }
  broadcast({ type: "CSV_JOB_COMPLETE", jobId: job.id, status: freshJob?.status || "skipped" });
  if (csvQueuePaused) {
    broadcast({ type: "CSV_QUEUE_PAUSED" });
    return;
  }
  await randDelay(2, 7);
  processNextCsvJob();
}
function waitForCsvResult(tabId, jobId, maxMs) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled)
        return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onRemoved.removeListener(tabCloseListener);
      if (_activeJobResolve === resolve)
        _activeJobResolve = null;
      resolve(value);
    };
    _activeJobResolve = settle;
    const tabCloseListener = (closedTabId) => {
      if (closedTabId === tabId)
        settle("skipped");
    };
    chrome.tabs.onRemoved.addListener(tabCloseListener);
    const timer = setTimeout(() => settle("timeout"), maxMs);
  });
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
  await loadSettings();
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url)
    return;
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://"))
    return;
  try {
    const s = await loadSettings();
    if (!s.autoDetectAndFill)
      return;
    const url = tab.url;
    if (!s.universalFormDetection) {
      const isSupported = s.autoApply.domainAllowlist.some((d) => url.includes(d));
      if (!isSupported)
        return;
    }
    try {
      await chrome.tabs.sendMessage(tabId, { type: "AUTO_DETECT_FILL" });
    } catch {
    }
  } catch {
  }
});
//# sourceMappingURL=background.js.map
