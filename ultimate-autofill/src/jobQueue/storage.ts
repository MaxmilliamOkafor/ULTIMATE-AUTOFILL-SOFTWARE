import type { JobQueueItem, JobQueueState, JobStatus, CSVImportStats } from '../types/index';
import { generateId, now, parseCSV, isValidHttpsUrl } from '../utils/helpers';

const KEY = 'ua_job_queue';

function defaultState(): JobQueueState {
  return { items: [], currentItemId: null };
}

export async function loadQueue(): Promise<JobQueueState> {
  const r = await chrome.storage.local.get(KEY);
  return (r[KEY] as JobQueueState) || defaultState();
}

async function saveQueue(state: JobQueueState): Promise<void> {
  await chrome.storage.local.set({ [KEY]: state });
}

export async function getItems(): Promise<JobQueueItem[]> {
  return (await loadQueue()).items;
}

/** Normalize a URL: trim, lowercase host, remove tracking params, remove trailing slash */
export function normalizeUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr.trim());
    url.hostname = url.hostname.toLowerCase();
    // Remove common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'fbclid', 'gclid', 'source', 'trackingId'];
    for (const p of trackingParams) {
      url.searchParams.delete(p);
    }
    // Remove trailing slash
    let path = url.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    url.pathname = path;
    return url.toString();
  } catch {
    return urlStr.trim();
  }
}

/** Validate a URL is HTTP or HTTPS */
export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function addUrls(urls: Array<{ url: string; company?: string; role?: string; priority?: number; notes?: string }>): Promise<number> {
  const s = await loadQueue();
  const existing = new Set(s.items.map((i) => normalizeUrl(i.url)));
  let added = 0;
  for (const u of urls) {
    const normalized = normalizeUrl(u.url);
    if (!isValidUrl(normalized) || existing.has(normalized)) continue;
    existing.add(normalized);
    s.items.push({
      id: generateId(),
      url: u.url.trim(),
      normalizedUrl: normalized,
      company: u.company,
      role: u.role,
      priority: u.priority,
      notes: u.notes,
      status: 'not_started',
      source: 'manual',
      retryCount: 0,
      createdAt: now(),
      updatedAt: now(),
    });
    added++;
  }
  await saveQueue(s);
  return added;
}

export async function updateStatus(itemId: string, status: JobStatus, reason?: string): Promise<void> {
  const s = await loadQueue();
  const item = s.items.find((i) => i.id === itemId);
  if (item) {
    item.status = status;
    item.updatedAt = now();
    if (reason) {
      if (status === 'blocked') item.blockedReason = reason;
      if (status === 'failed') item.failReason = reason;
    }
    if (status === 'applied') item.appliedAt = now();
    if (status === 'opened' || status === 'applying' || status === 'prefilled') s.currentItemId = itemId;
    if (status === 'completed' || status === 'blocked' || status === 'applied' || status === 'failed' || status === 'skipped') {
      if (s.currentItemId === itemId) s.currentItemId = null;
    }
    await saveQueue(s);
  }
}

export async function removeItem(itemId: string): Promise<void> {
  const s = await loadQueue();
  s.items = s.items.filter((i) => i.id !== itemId);
  if (s.currentItemId === itemId) s.currentItemId = null;
  await saveQueue(s);
}

export async function clearQueue(): Promise<void> {
  await saveQueue(defaultState());
}

export async function retryFailed(): Promise<number> {
  const s = await loadQueue();
  let count = 0;
  for (const item of s.items) {
    if (item.status === 'failed' && (item.retryCount || 0) < 3) {
      item.status = 'not_started';
      item.retryCount = (item.retryCount || 0) + 1;
      item.failReason = undefined;
      item.updatedAt = now();
      count++;
    }
  }
  await saveQueue(s);
  return count;
}

export async function getNextJob(): Promise<JobQueueItem | null> {
  const s = await loadQueue();
  // Priority ordering: higher priority first, then by creation time
  const pending = s.items
    .filter((i) => i.status === 'not_started')
    .sort((a, b) => {
      const pa = a.priority ?? 0;
      const pb = b.priority ?? 0;
      if (pb !== pa) return pb - pa;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  return pending[0] || null;
}

export async function exportQueue(): Promise<string> {
  const items = await getItems();
  const header = 'url,company,role,priority,notes,status,source,applied_at,fail_reason';
  const rows = items.map((i) =>
    [i.url, i.company || '', i.role || '', i.priority ?? '', i.notes || '', i.status, i.source || '', i.appliedAt || '', i.failReason || '']
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header, ...rows].join('\n');
}

/** Enhanced CSV parsing with detailed import stats */
export function parseJobCSVWithStats(text: string): CSVImportStats {
  const stats: CSVImportStats = {
    totalParsed: 0,
    validUrls: 0,
    invalidUrls: 0,
    duplicates: 0,
    added: 0,
    invalidRows: [],
  };

  const rows = parseCSV(text);
  if (rows.length < 1) return stats;

  // Try to detect header row
  const firstRow = rows[0].map((h) => h.toLowerCase().trim());
  let urlIdx = firstRow.findIndex((h) => ['url', 'job_url', 'link', 'job_link', 'application_url'].includes(h));
  let hasHeader = urlIdx >= 0;

  // If no header found, check if first row is a single-column CSV with a URL
  if (!hasHeader) {
    if (rows[0].length === 1 && isValidUrl(rows[0][0].trim())) {
      urlIdx = 0;
      hasHeader = false;
    } else {
      // Try treating first column as URL column
      urlIdx = 0;
      hasHeader = false;
    }
  }

  const companyIdx = hasHeader ? firstRow.indexOf('company') : -1;
  const roleIdx = hasHeader ? firstRow.findIndex((h) => ['role', 'title', 'job_title', 'position'].includes(h)) : -1;
  const priorityIdx = hasHeader ? firstRow.indexOf('priority') : -1;
  const notesIdx = hasHeader ? firstRow.indexOf('notes') : -1;

  const seen = new Set<string>();
  const startRow = hasHeader ? 1 : 0;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    stats.totalParsed++;
    const rawUrl = row[urlIdx]?.trim();

    if (!rawUrl) {
      stats.invalidUrls++;
      stats.invalidRows.push({ row: i + 1, url: rawUrl || '(empty)', reason: 'Empty URL' });
      continue;
    }

    if (!isValidUrl(rawUrl)) {
      stats.invalidUrls++;
      stats.invalidRows.push({ row: i + 1, url: rawUrl, reason: 'Invalid URL format' });
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

/** Parse CSV and extract job URLs with full dedup and validation */
export function parseJobCSV(text: string): Array<{ url: string; company?: string; role?: string; priority?: number; notes?: string }> {
  const rows = parseCSV(text);
  if (rows.length < 1) return [];

  const firstRow = rows[0].map((h) => h.toLowerCase().trim());
  let urlIdx = firstRow.findIndex((h) => ['url', 'job_url', 'link', 'job_link', 'application_url'].includes(h));
  let hasHeader = urlIdx >= 0;

  if (!hasHeader) {
    urlIdx = 0;
    hasHeader = false;
    // Check if first row looks like a header
    if (firstRow[0] && !isValidUrl(rows[0][0].trim())) {
      hasHeader = true;
    }
  }

  const companyIdx = hasHeader ? firstRow.indexOf('company') : -1;
  const roleIdx = hasHeader ? firstRow.findIndex((h) => ['role', 'title', 'job_title', 'position'].includes(h)) : -1;
  const priorityIdx = hasHeader ? firstRow.indexOf('priority') : -1;
  const notesIdx = hasHeader ? firstRow.indexOf('notes') : -1;

  const results: Array<{ url: string; company?: string; role?: string; priority?: number; notes?: string }> = [];
  const seen = new Set<string>();
  const startRow = hasHeader ? 1 : 0;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const rawUrl = row[urlIdx]?.trim();
    if (!rawUrl || !isValidUrl(rawUrl)) continue;

    const normalized = normalizeUrl(rawUrl);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    results.push({
      url: rawUrl,
      company: companyIdx >= 0 ? row[companyIdx]?.trim() : undefined,
      role: roleIdx >= 0 ? row[roleIdx]?.trim() : undefined,
      priority: priorityIdx >= 0 ? parseInt(row[priorityIdx], 10) || undefined : undefined,
      notes: notesIdx >= 0 ? row[notesIdx]?.trim() : undefined,
    });
  }
  return results;
}

/** Import CSV jobs with source tracking */
export async function importCSVJobs(text: string): Promise<CSVImportStats> {
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
      status: 'not_started',
      source: 'csv_import',
      retryCount: 0,
      createdAt: now(),
      updatedAt: now(),
    });
    added++;
  }

  await saveQueue(s);
  stats.added = added;
  return stats;
}

/** Get imported jobs only (from CSV) */
export async function getImportedJobs(): Promise<JobQueueItem[]> {
  const s = await loadQueue();
  return s.items.filter((i) => i.source === 'csv_import');
}

/** Get import pipeline stats */
export async function getImportStats(): Promise<{
  total: number; pending: number; applying: number; applied: number;
  failed: number; skipped: number; completed: number;
}> {
  const items = await getImportedJobs();
  return {
    total: items.length,
    pending: items.filter((i) => i.status === 'not_started').length,
    applying: items.filter((i) => i.status === 'applying' || i.status === 'opened' || i.status === 'prefilled').length,
    applied: items.filter((i) => i.status === 'applied').length,
    failed: items.filter((i) => i.status === 'failed').length,
    skipped: items.filter((i) => i.status === 'skipped').length,
    completed: items.filter((i) => i.status === 'completed').length,
  };
}
