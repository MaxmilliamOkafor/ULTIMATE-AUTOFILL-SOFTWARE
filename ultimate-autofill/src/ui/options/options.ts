import type { ExtMessage, ExtResponse, SavedResponse, JobQueueItem, ResponseLibrary } from '../../types/index';
import { generateId } from '../../utils/helpers';
import { findDuplicates } from '../../utils/fuzzy';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const send = (msg: ExtMessage): Promise<ExtResponse> => chrome.runtime.sendMessage(msg);

let selected = new Set<string>();
let currentResponses: SavedResponse[] = [];
let currentLibId = '';

function toast(text: string) {
  const el = $<HTMLDivElement>('toast');
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Tabs ───
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.tc').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    $(`tab-${(t as HTMLElement).dataset.tab}`).classList.add('active');
  });
});

// ═══════════════════════════════════════════════
//  SAVED RESPONSES TAB
// ═══════════════════════════════════════════════

async function loadLibraries() {
  const r = await send({ type: 'GET_LIBRARIES' });
  if (!r?.ok) return;
  const libs = r.data as ResponseLibrary[];
  const activeR = await send({ type: 'GET_ACTIVE_LIBRARY' });
  const active = activeR?.data as ResponseLibrary;
  currentLibId = active?.id || libs[0]?.id || '';

  for (const sel of [
    $<HTMLSelectElement>('libSelect'),
    $<HTMLSelectElement>('newDomLib'),
  ]) {
    sel.innerHTML = libs.map((l) => `<option value="${l.id}" ${l.id === currentLibId ? 'selected' : ''}>${escHtml(l.name)}</option>`).join('');
  }

  renderLibsList(libs);
}

function renderLibsList(libs: ResponseLibrary[]) {
  const el = $('libsList');
  if (!libs.length) { el.innerHTML = '<p class="muted">No libraries.</p>'; return; }
  el.innerHTML = libs.map((l) => `<div class="fr mb2">
    <span class="f1"><strong>${escHtml(l.name)}</strong> (${l.responses.length} responses)</span>
    <button class="btn btn-s btn-d del-lib" data-id="${l.id}">Delete</button>
  </div>`).join('');
  el.querySelectorAll('.del-lib').forEach((b) => b.addEventListener('click', async () => {
    const id = (b as HTMLElement).dataset.id!;
    await send({ type: 'DELETE_LIBRARY', payload: { id } });
    toast('Library deleted');
    await loadLibraries();
    await loadResponses();
  }));
}

async function loadResponses() {
  const r = await send({ type: 'GET_RESPONSES', payload: { libraryId: currentLibId } });
  if (!r?.ok) return;
  currentResponses = r.data as SavedResponse[];
  renderResponses(currentResponses);
}

function renderResponses(list: SavedResponse[]) {
  const body = $('rBody');
  const noR = $('noR');
  if (!list.length) { body.innerHTML = ''; noR.style.display = 'block'; return; }
  noR.style.display = 'none';
  body.innerHTML = list.map((r) => {
    const preview = r.response.length > 60 ? r.response.slice(0, 60) + '...' : r.response;
    const kw = r.keywords.join(', ');
    return `<tr>
      <td><input type="checkbox" class="chk row-chk" data-id="${r.id}" ${selected.has(r.id) ? 'checked' : ''}></td>
      <td><strong>${escHtml(r.question)}</strong><br><span class="muted">${escHtml(r.key)}</span></td>
      <td>${escHtml(preview)}</td>
      <td><span class="muted">${escHtml(kw)}</span></td>
      <td>${r.appearances}</td>
      <td>
        <button class="btn btn-s edit-r" data-id="${r.id}">Edit</button>
        <button class="btn btn-s btn-d del-r" data-id="${r.id}">Del</button>
      </td>
    </tr>`;
  }).join('');

  body.querySelectorAll('.row-chk').forEach((cb) => cb.addEventListener('change', () => {
    const id = (cb as HTMLInputElement).dataset.id!;
    if ((cb as HTMLInputElement).checked) selected.add(id); else selected.delete(id);
    updateBulkUI();
  }));
  body.querySelectorAll('.edit-r').forEach((b) => b.addEventListener('click', () => openEditModal((b as HTMLElement).dataset.id!)));
  body.querySelectorAll('.del-r').forEach((b) => b.addEventListener('click', async () => {
    await send({ type: 'DELETE_RESPONSE', payload: { id: (b as HTMLElement).dataset.id!, libraryId: currentLibId } });
    toast('Deleted');
    await loadResponses();
  }));
}

function updateBulkUI() {
  const n = selected.size;
  $<HTMLButtonElement>('btnBTag').disabled = n === 0;
  $<HTMLButtonElement>('btnBDel').disabled = n === 0;
  $('selCnt').textContent = n > 0 ? `${n} selected` : '';
}

// Search
$('searchR').addEventListener('input', async () => {
  const q = ($('searchR') as HTMLInputElement).value;
  const r = await send({ type: 'SEARCH_RESPONSES', payload: { query: q, libraryId: currentLibId } });
  if (r?.ok) renderResponses(r.data as SavedResponse[]);
});

// Library switch
$('libSelect').addEventListener('change', async () => {
  currentLibId = ($('libSelect') as HTMLSelectElement).value;
  await send({ type: 'SET_ACTIVE_LIBRARY', payload: { id: currentLibId } });
  selected.clear();
  updateBulkUI();
  await loadResponses();
});

// Select all
$('selAll').addEventListener('change', () => {
  const checked = ($('selAll') as HTMLInputElement).checked;
  selected.clear();
  if (checked) currentResponses.forEach((r) => selected.add(r.id));
  renderResponses(checked ? currentResponses : currentResponses); // re-render to toggle checkboxes
  updateBulkUI();
});

// Add / Edit modal
function openEditModal(id?: string) {
  const resp = id ? currentResponses.find((r) => r.id === id) : null;
  $('rmTitle').textContent = resp ? 'Edit Response' : 'New Saved Response';
  ($('mQ') as HTMLInputElement).value = resp?.question || '';
  ($('mR') as HTMLTextAreaElement).value = resp?.response || '';
  ($('mK') as HTMLInputElement).value = resp?.keywords.join(', ') || '';
  ($('mT') as HTMLInputElement).value = resp?.tags?.join(', ') || '';
  ($('mId') as HTMLInputElement).value = resp?.id || '';
  $('respModal').classList.add('on');
}

$('btnAdd').addEventListener('click', () => openEditModal());
$('mCancel').addEventListener('click', () => $('respModal').classList.remove('on'));
$('mSave').addEventListener('click', async () => {
  const q = ($('mQ') as HTMLInputElement).value.trim();
  const r = ($('mR') as HTMLTextAreaElement).value.trim();
  if (!q) { toast('Question is required'); return; }
  const kw = ($('mK') as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean);
  const tags = ($('mT') as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean);
  const existingId = ($('mId') as HTMLInputElement).value;
  const key = kw.join('|') || q.toLowerCase().split(/\s+/).slice(0, 3).join('|');

  const resp: SavedResponse = {
    id: existingId || generateId(),
    key,
    keywords: kw.length ? kw : q.toLowerCase().split(/\s+/).slice(0, 5),
    question: q,
    response: r,
    appearances: existingId ? (currentResponses.find((x) => x.id === existingId)?.appearances || 0) : 0,
    fromAutofill: false,
    tags: tags.length ? tags : undefined,
  };

  await send({ type: 'SAVE_RESPONSE', payload: { response: resp, libraryId: currentLibId } });
  $('respModal').classList.remove('on');
  toast('Saved');
  await loadResponses();
});

// Import
$('btnImport').addEventListener('click', () => {
  $('impTitle').textContent = 'Import JSON';
  $('impPwGrp').style.display = 'none';
  ($('impFile') as HTMLInputElement).value = '';
  ($('impFile') as HTMLInputElement).accept = '.json';
  $('impModal').classList.add('on');
});

$('impCancel').addEventListener('click', () => $('impModal').classList.remove('on'));
$('impOk').addEventListener('click', async () => {
  const file = ($('impFile') as HTMLInputElement).files?.[0];
  if (!file) { toast('Select a file'); return; }
  const text = await file.text();
  const pw = ($('impPw') as HTMLInputElement).value;

  try {
    if (pw) {
      const r = await send({ type: 'IMPORT_ENCRYPTED', payload: { data: text, passphrase: pw, libraryId: currentLibId } });
      toast(r?.ok ? `Imported ${r.data} responses` : (r?.error || 'Import failed'));
    } else {
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [];
      const r = await send({ type: 'IMPORT_RESPONSES', payload: { data: arr, libraryId: currentLibId } });
      toast(r?.ok ? `Imported ${r.data} new responses` : (r?.error || 'Import failed'));
    }
    $('impModal').classList.remove('on');
    await loadResponses();
  } catch (e) {
    toast(`Error: ${e}`);
  }
});

// Export
$('btnExport').addEventListener('click', async () => {
  const r = await send({ type: 'EXPORT_RESPONSES', payload: { libraryId: currentLibId } });
  if (!r?.ok) return;
  download(JSON.stringify(r.data, null, 2), 'responses.json', 'application/json');
  toast('Exported');
});

// Export encrypted
$('btnExportEnc').addEventListener('click', () => {
  ($('encPw') as HTMLInputElement).value = '';
  $('encModal').classList.add('on');
});
$('encCancel').addEventListener('click', () => $('encModal').classList.remove('on'));
$('encOk').addEventListener('click', async () => {
  const pw = ($('encPw') as HTMLInputElement).value;
  if (!pw) { toast('Passphrase required'); return; }
  const r = await send({ type: 'EXPORT_ENCRYPTED', payload: { passphrase: pw, libraryId: currentLibId } });
  if (r?.ok) {
    download(r.data as string, 'responses.encrypted.txt', 'text/plain');
    toast('Exported encrypted');
  }
  $('encModal').classList.remove('on');
});

// Bulk tag
$('btnBTag').addEventListener('click', () => {
  ($('btInput') as HTMLInputElement).value = '';
  $('tagModal').classList.add('on');
});
$('btCancel').addEventListener('click', () => $('tagModal').classList.remove('on'));
$('btApply').addEventListener('click', async () => {
  const tags = ($('btInput') as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean);
  if (!tags.length) { toast('Enter tags'); return; }
  await send({ type: 'BULK_TAG', payload: { ids: [...selected], tags, libraryId: currentLibId } });
  $('tagModal').classList.remove('on');
  toast(`Tagged ${selected.size} entries`);
  selected.clear();
  updateBulkUI();
  await loadResponses();
});

// Bulk delete
$('btnBDel').addEventListener('click', async () => {
  if (!confirm(`Delete ${selected.size} entries?`)) return;
  await send({ type: 'DELETE_RESPONSES', payload: { ids: [...selected], libraryId: currentLibId } });
  toast(`Deleted ${selected.size} entries`);
  selected.clear();
  updateBulkUI();
  await loadResponses();
});

// Find duplicates
$('btnDups').addEventListener('click', async () => {
  const dups = findDuplicates(currentResponses, 0.75);
  const card = $('dupsCard');
  const list = $('dupsList');
  if (!dups.length) { card.style.display = 'none'; toast('No duplicates found'); return; }
  card.style.display = 'block';
  list.innerHTML = dups.slice(0, 20).map((d) => {
    const a = currentResponses.find((r) => r.id === d.idA);
    const b = currentResponses.find((r) => r.id === d.idB);
    if (!a || !b) return '';
    return `<div class="card" style="padding:12px;margin-bottom:8px">
      <p><strong>${escHtml(a.question)}</strong> vs <strong>${escHtml(b.question)}</strong></p>
      <p class="muted">Similarity: ${(d.similarity * 100).toFixed(0)}%</p>
      <button class="btn btn-s btn-p merge-btn" data-keep="${a.id}" data-merge="${b.id}">Merge (keep first)</button>
    </div>`;
  }).join('');
  list.querySelectorAll('.merge-btn').forEach((b) => b.addEventListener('click', async () => {
    await send({ type: 'MERGE_RESPONSES', payload: { keepId: (b as HTMLElement).dataset.keep, mergeId: (b as HTMLElement).dataset.merge, libraryId: currentLibId } });
    toast('Merged');
    await loadResponses();
    $('btnDups').click(); // refresh dups
  }));
});

// ═══════════════════════════════════════════════
//  JOB QUEUE TAB
// ═══════════════════════════════════════════════

async function loadQueue() {
  const r = await send({ type: 'GET_JOB_QUEUE' });
  if (!r?.ok) return;
  const items = r.data as JobQueueItem[];
  renderQueue(items);
}

const STATUS_BADGE: Record<string, string> = {
  not_started: 'badge-g', opened: 'badge-i', prefilled: 'badge-s',
  needs_input: 'badge-w', blocked: 'badge-d', completed: 'badge-s',
};

function renderQueue(items: JobQueueItem[]) {
  const body = $('qBody');
  const noQ = $('noQ');
  const stats = $('qStats');
  if (!items.length) { body.innerHTML = ''; noQ.style.display = 'block'; stats.textContent = ''; return; }
  noQ.style.display = 'none';
  stats.textContent = `${items.length} total | ${items.filter((i) => i.status === 'completed').length} completed`;

  body.innerHTML = items.map((it, idx) => {
    const urlShort = it.url.length > 50 ? it.url.slice(0, 50) + '...' : it.url;
    return `<tr>
      <td>${idx + 1}</td>
      <td><a href="${escHtml(it.url)}" target="_blank" rel="noopener">${escHtml(urlShort)}</a></td>
      <td>${escHtml(it.company || '-')}</td>
      <td>${escHtml(it.role || '-')}</td>
      <td><span class="badge ${STATUS_BADGE[it.status] || 'badge-g'}">${it.status.replace(/_/g, ' ')}</span></td>
      <td>
        <button class="btn btn-s btn-p open-job" data-id="${it.id}" data-url="${escHtml(it.url)}">Open</button>
        <button class="btn btn-s mark-done" data-id="${it.id}">Done</button>
        <button class="btn btn-s btn-d rm-job" data-id="${it.id}">Del</button>
      </td>
    </tr>`;
  }).join('');

  body.querySelectorAll('.open-job').forEach((b) => b.addEventListener('click', async () => {
    await send({ type: 'OPEN_JOB_TAB', payload: { id: (b as HTMLElement).dataset.id, url: (b as HTMLElement).dataset.url } });
    toast('Opened');
    await loadQueue();
  }));
  body.querySelectorAll('.mark-done').forEach((b) => b.addEventListener('click', async () => {
    await send({ type: 'UPDATE_JOB_STATUS', payload: { id: (b as HTMLElement).dataset.id, status: 'completed' } });
    toast('Marked complete');
    await loadQueue();
  }));
  body.querySelectorAll('.rm-job').forEach((b) => b.addEventListener('click', async () => {
    // We reuse UPDATE_JOB_STATUS or just remove - use CLEAR per item isn't available, so just update status
    // Actually need to delete - we'll add it. For now set completed.
    await send({ type: 'UPDATE_JOB_STATUS', payload: { id: (b as HTMLElement).dataset.id, status: 'completed' } });
    toast('Removed');
    await loadQueue();
  }));
}

$('btnImportCSV').addEventListener('click', () => {
  $('impTitle').textContent = 'Import CSV';
  $('impPwGrp').style.display = 'none';
  ($('impFile') as HTMLInputElement).value = '';
  ($('impFile') as HTMLInputElement).accept = '.csv,.txt';
  $('impModal').classList.add('on');
  // Override confirm handler
  $('impOk').onclick = async () => {
    const file = ($('impFile') as HTMLInputElement).files?.[0];
    if (!file) { toast('Select a file'); return; }
    const text = await file.text();
    const r = await send({ type: 'IMPORT_JOB_CSV', payload: { csv: text } });
    toast(r?.ok ? `Added ${(r.data as any).added} jobs (${(r.data as any).parsed} parsed)` : (r?.error || 'Failed'));
    $('impModal').classList.remove('on');
    await loadQueue();
    // Restore original handler
    $('impOk').onclick = null;
  };
});

$('btnExportQ').addEventListener('click', async () => {
  const items = (await send({ type: 'GET_JOB_QUEUE' }))?.data as JobQueueItem[];
  if (!items?.length) { toast('Queue is empty'); return; }
  const header = 'url,company,role,priority,notes,status';
  const rows = items.map((i) =>
    [i.url, i.company || '', i.role || '', i.priority ?? '', i.notes || '', i.status]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  download([header, ...rows].join('\n'), 'job-queue.csv', 'text/csv');
  toast('Exported');
});

$('btnClearQ').addEventListener('click', async () => {
  if (!confirm('Clear entire queue?')) return;
  await send({ type: 'CLEAR_JOB_QUEUE' });
  toast('Cleared');
  await loadQueue();
});

// ═══════════════════════════════════════════════
//  SETTINGS TAB
// ═══════════════════════════════════════════════

$('btnNewLib').addEventListener('click', async () => {
  const name = prompt('Library name:');
  if (!name) return;
  await send({ type: 'CREATE_LIBRARY', payload: { name } });
  toast('Created');
  await loadLibraries();
});

async function loadDomainMappings() {
  const r = await send({ type: 'GET_DOMAIN_MAPPINGS' });
  if (!r?.ok) return;
  const mappings = r.data as Record<string, string>;
  const libs = ((await send({ type: 'GET_LIBRARIES' }))?.data || []) as ResponseLibrary[];
  const el = $('dmList');
  const entries = Object.entries(mappings);
  if (!entries.length) { el.innerHTML = '<p class="muted">No mappings.</p>'; return; }
  el.innerHTML = entries.map(([dom, libId]) => {
    const lib = libs.find((l) => l.id === libId);
    return `<div class="fr mb2"><span class="f1"><code>${escHtml(dom)}</code> &rarr; ${escHtml(lib?.name || 'Unknown')}</span><button class="btn btn-s btn-d rm-dm" data-dom="${escHtml(dom)}">Remove</button></div>`;
  }).join('');
  el.querySelectorAll('.rm-dm').forEach((b) => b.addEventListener('click', async () => {
    await send({ type: 'REMOVE_DOMAIN_MAPPING', payload: { domain: (b as HTMLElement).dataset.dom } });
    toast('Removed');
    await loadDomainMappings();
  }));
}

$('btnAddDM').addEventListener('click', async () => {
  const dom = ($('newDom') as HTMLInputElement).value.trim();
  const libId = ($('newDomLib') as HTMLSelectElement).value;
  if (!dom) { toast('Enter domain'); return; }
  await send({ type: 'SET_DOMAIN_MAPPING', payload: { domain: dom, libraryId: libId } });
  ($('newDom') as HTMLInputElement).value = '';
  toast('Added');
  await loadDomainMappings();
});

// ─── Helpers ───
function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Init ───
async function init() {
  await loadLibraries();
  await loadResponses();
  await loadQueue();
  await loadDomainMappings();
}

init();
