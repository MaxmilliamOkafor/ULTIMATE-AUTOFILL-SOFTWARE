import type { FieldInfo, FieldSignal, FieldMatchResult, SavedResponse } from '../types/index';
import { findBestMatch, type MatchOptions } from '../savedResponses/matcher';

// ─── Signal Extraction ───

export function extractFieldSignals(element: HTMLElement): FieldSignal[] {
  const signals: FieldSignal[] = [];

  // 1. Explicit <label for>
  if (element.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (lbl?.textContent?.trim()) signals.push({ source: 'label-for', value: lbl.textContent.trim(), weight: 1.0 });
  }

  // 2. Wrapping label
  const wrap = element.closest('label');
  if (wrap) {
    const t = directText(wrap).trim();
    if (t) signals.push({ source: 'label-wrap', value: t, weight: 0.95 });
  }

  // 3. aria-label
  const al = element.getAttribute('aria-label');
  if (al?.trim()) signals.push({ source: 'aria-label', value: al.trim(), weight: 0.9 });

  // 4. aria-labelledby
  const alb = element.getAttribute('aria-labelledby');
  if (alb) {
    const txt = alb.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
    if (txt) signals.push({ source: 'aria-labelledby', value: txt, weight: 0.9 });
  }

  // 5. placeholder
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const ph = element.placeholder;
    if (ph?.trim()) signals.push({ source: 'placeholder', value: ph.trim(), weight: 0.7 });
  }

  // 6. name
  const name = element.getAttribute('name');
  if (name?.trim()) signals.push({ source: 'name', value: humanize(name), weight: 0.6 });

  // 7. id
  if (element.id) signals.push({ source: 'id', value: humanize(element.id), weight: 0.5 });

  // 8. autocomplete
  const ac = element.getAttribute('autocomplete');
  if (ac?.trim() && ac !== 'off') signals.push({ source: 'autocomplete', value: ac.trim(), weight: 0.85 });

  // 9. role
  const role = element.getAttribute('role');
  if (role?.trim()) signals.push({ source: 'role', value: role.trim(), weight: 0.3 });

  // 10. Group context (fieldset/legend, heading)
  const gc = groupContext(element);
  if (gc) signals.push({ source: 'group-context', value: gc, weight: 0.4 });

  // 11. Nearby text
  const nt = nearbyText(element);
  if (nt) signals.push({ source: 'nearby-text', value: nt, weight: 0.35 });

  return signals;
}

function directText(el: Element): string {
  let t = '';
  for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE) t += n.textContent || '';
  return t;
}

function humanize(name: string): string {
  return name.replace(/[\[\]]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-\.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function groupContext(el: HTMLElement): string | null {
  const fs = el.closest('fieldset');
  if (fs) { const lg = fs.querySelector('legend'); if (lg?.textContent?.trim()) return lg.textContent.trim(); }
  let n: Element | null = el;
  while (n && n !== document.body) {
    const prev = n.previousElementSibling;
    if (prev && /^h[1-6]$/i.test(prev.tagName)) return prev.textContent?.trim() || null;
    n = n.parentElement;
  }
  return null;
}

function nearbyText(el: HTMLElement): string | null {
  const prev = el.previousElementSibling;
  if (prev && prev.textContent?.trim() && !isFormEl(prev)) {
    const t = prev.textContent.trim();
    if (t.length < 100) return t;
  }
  const par = el.parentElement;
  if (par) { const t = directText(par).trim(); if (t && t.length < 100) return t; }
  return null;
}

function isFormEl(el: Element): boolean {
  return ['input', 'textarea', 'select', 'button'].includes(el.tagName.toLowerCase());
}

// ─── Discovery ───

const FIELD_SELECTOR = [
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[role="combobox"]:not([disabled])',
  '[role="listbox"]:not([disabled])',
  '[role="textbox"]:not([disabled])',
  '[contenteditable="true"]',
].join(', ');

export function discoverFields(doc: Document): FieldInfo[] {
  const fields: FieldInfo[] = [];
  for (const el of doc.querySelectorAll<HTMLElement>(FIELD_SELECTOR)) {
    if (el.offsetParent === null && el.style.display !== 'contents') continue;
    const type = fieldType(el);
    const signals = extractFieldSignals(el);
    fields.push({ element: el, type, signals, groupContext: signals.find((s) => s.source === 'group-context')?.value });
  }
  return fields;
}

function fieldType(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') return (el as HTMLInputElement).type || 'text';
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  const r = el.getAttribute('role');
  if (r) return r;
  if (el.contentEditable === 'true') return 'contenteditable';
  return 'unknown';
}

// ─── Matching ───

export function buildFieldQuery(fi: FieldInfo): string {
  const sorted = [...fi.signals].sort((a, b) => b.weight - a.weight);
  if (!sorted.length) return '';
  const primary = sorted[0].value;
  const parts = [primary];
  for (let i = 1; i < Math.min(sorted.length, 3); i++) {
    if (sorted[i].value !== primary) parts.push(sorted[i].value);
  }
  return parts.join(' ');
}

export function matchFields(fields: FieldInfo[], responses: SavedResponse[], opts: MatchOptions = {}): FieldMatchResult[] {
  const results: FieldMatchResult[] = [];
  for (const f of fields) {
    const q = buildFieldQuery(f);
    if (!q) continue;
    const m = findBestMatch(q, responses, opts);
    if (m) results.push({ field: f.element, response: m.response, score: m.score, signals: f.signals, explanation: `Query: "${q}" | ${m.explanation}` });
  }
  return results.sort((a, b) => b.score - a.score);
}

export function explainMatch(fi: FieldInfo, responses: SavedResponse[], opts: MatchOptions = {}): string {
  const lines = [`Type: ${fi.type}`, 'Signals:'];
  for (const s of fi.signals) lines.push(`  [${s.source}] w=${s.weight}: "${s.value}"`);
  const q = buildFieldQuery(fi);
  lines.push(`Query: "${q}"`);
  if (!q) { lines.push('No query — no match'); return lines.join('\n'); }
  const m = findBestMatch(q, responses, opts);
  if (m) { lines.push(`Match: "${m.response.question}" score=${m.score.toFixed(4)}`); lines.push(`Detail: ${m.explanation}`); }
  else lines.push('No match above threshold');
  return lines.join('\n');
}
