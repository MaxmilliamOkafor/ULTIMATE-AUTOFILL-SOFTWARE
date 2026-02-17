import type { JobQueueItem, JobQueueState, JobStatus } from '../types/index';
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

export async function addUrls(urls: Array<{ url: string; company?: string; role?: string; priority?: number; notes?: string }>): Promise<number> {
  const s = await loadQueue();
  const existing = new Set(s.items.map((i) => i.url));
  let added = 0;
  for (const u of urls) {
    if (!isValidHttpsUrl(u.url) || existing.has(u.url)) continue;
    existing.add(u.url);
    s.items.push({
      id: generateId(),
      url: u.url,
      company: u.company,
      role: u.role,
      priority: u.priority,
      notes: u.notes,
      status: 'not_started',
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
    if (reason) item.blockedReason = reason;
    if (status === 'opened' || status === 'prefilled') s.currentItemId = itemId;
    if (status === 'completed' || status === 'blocked') {
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

export async function exportQueue(): Promise<string> {
  const items = await getItems();
  const header = 'url,company,role,priority,notes,status';
  const rows = items.map((i) =>
    [i.url, i.company || '', i.role || '', i.priority ?? '', i.notes || '', i.status]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header, ...rows].join('\n');
}

/** Parse CSV and extract job URLs. Columns: url|job_url|link (case-insensitive), optional company/role/priority/notes. */
export function parseJobCSV(text: string): Array<{ url: string; company?: string; role?: string; priority?: number; notes?: string }> {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const urlIdx = header.findIndex((h) => ['url', 'job_url', 'link'].includes(h));
  if (urlIdx < 0) return [];
  const companyIdx = header.indexOf('company');
  const roleIdx = header.indexOf('role');
  const priorityIdx = header.indexOf('priority');
  const notesIdx = header.indexOf('notes');

  const results: Array<{ url: string; company?: string; role?: string; priority?: number; notes?: string }> = [];
  const seen = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const url = row[urlIdx]?.trim();
    if (!url || !isValidHttpsUrl(url) || seen.has(url)) continue;
    seen.add(url);
    results.push({
      url,
      company: companyIdx >= 0 ? row[companyIdx]?.trim() : undefined,
      role: roleIdx >= 0 ? row[roleIdx]?.trim() : undefined,
      priority: priorityIdx >= 0 ? parseInt(row[priorityIdx], 10) || undefined : undefined,
      notes: notesIdx >= 0 ? row[notesIdx]?.trim() : undefined,
    });
  }
  return results;
}
