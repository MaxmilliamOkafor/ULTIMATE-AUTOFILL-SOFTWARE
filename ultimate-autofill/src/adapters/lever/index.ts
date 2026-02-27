import type { ATSAdapter, ATSDetectionResult, FieldInfo, FieldSignal } from '../../types/index';
import { extractFieldSignals } from '../../fieldMatcher/index';

const ID_MAP: Record<string, string> = {
  name: 'Full Name',
  email: 'Email Address',
  phone: 'Phone Number',
  org: 'Current Company',
  urls: 'LinkedIn / Website',
  resume: 'Resume',
  comments: 'Additional Information',
};

function elType(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') return (el as HTMLInputElement).type || 'text';
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  return el.getAttribute('role') || 'unknown';
}

export const leverAdapter: ATSAdapter = {
  type: 'lever',

  detect(doc: Document): ATSDetectionResult {
    const signals: string[] = [];
    let conf = 0;
    const docHref = doc.location?.href;
    const url = (docHref && docHref !== 'about:blank' ? docHref : null) || (typeof window !== 'undefined' ? window.location?.href : '') || '';
    if (/lever\.co/i.test(url)) { conf += 0.5; signals.push('url:lever'); }
    if (doc.querySelector('.lever-application-form')) { conf += 0.3; signals.push('lever-form'); }
    if (doc.querySelector('[data-qa="application-form"]')) { conf += 0.2; signals.push('data-qa'); }
    return { type: 'lever', confidence: Math.min(conf, 1), signals };
  },

  getFields(doc: Document): FieldInfo[] {
    const fields: FieldInfo[] = [];
    const container = doc.querySelector('.lever-application-form') || doc.querySelector('[data-qa="application-form"]') || doc;
    const els = container.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
    );

    for (const el of els) {
      if (el.offsetParent === null) continue;
      const signals: FieldSignal[] = extractFieldSignals(el);

      const name = el.getAttribute('name') || '';
      if (name && ID_MAP[name]) {
        signals.push({ source: 'lever-field-name', value: ID_MAP[name], weight: 1.0 });
      }

      const card = el.closest('.application-question');
      if (card) {
        const label = card.querySelector('.application-label');
        if (label?.textContent?.trim()) {
          signals.push({ source: 'lever-question-label', value: label.textContent.trim(), weight: 0.95 });
        }
      }

      fields.push({ element: el, type: elType(el), signals });
    }

    return fields;
  },

  async fillField(field: HTMLElement, value: string): Promise<boolean> {
    try {
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        field.focus();
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
      }
      if (field instanceof HTMLSelectElement) {
        const opt = Array.from(field.options).find(
          (o) => o.text.toLowerCase().includes(value.toLowerCase()) || o.value.toLowerCase() === value.toLowerCase()
        );
        if (opt) { field.value = opt.value; field.dispatchEvent(new Event('change', { bubbles: true })); return true; }
        return false;
      }
      if (field.contentEditable === 'true') {
        field.textContent = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    } catch { return false; }
  },
};
