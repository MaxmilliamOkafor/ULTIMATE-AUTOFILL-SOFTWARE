import type { ATSAdapter, ATSDetectionResult, FieldInfo, FieldSignal } from '../../types/index';
import { extractFieldSignals } from '../../fieldMatcher/index';

const FIELD_MAP: Record<string, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  email: 'Email Address',
  phoneNumber: 'Phone Number',
  addressLine1: 'Address Line 1',
  city: 'City',
  state: 'State',
  postalCode: 'Postal Code',
  country: 'Country',
  resume: 'Resume',
  coverLetter: 'Cover Letter',
  linkedInUrl: 'LinkedIn Profile',
};

function humanizeId(id: string): string {
  return id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-]+/g, ' ').trim();
}

function elType(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') return (el as HTMLInputElement).type || 'text';
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  return el.getAttribute('role') || 'unknown';
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const oraclecloudAdapter: ATSAdapter = {
  type: 'oraclecloud',

  detect(doc: Document): ATSDetectionResult {
    const signals: string[] = [];
    let conf = 0;
    const docHref = doc.location?.href;
    const url = (docHref && docHref !== 'about:blank' ? docHref : null) || (typeof window !== 'undefined' ? window.location?.href : '') || '';
    if (/oraclecloud\.com/i.test(url)) { conf += 0.5; signals.push('url:oraclecloud'); }
    if (doc.querySelector('[id*="oj-"]') || doc.querySelector('[data-oj-binding-provider]')) { conf += 0.3; signals.push('oracle-jet-ui'); }
    if (doc.querySelector('.oj-flex') || doc.querySelector('#ojAppRoot')) { conf += 0.2; signals.push('oj-components'); }
    return { type: 'oraclecloud', confidence: Math.min(conf, 1), signals };
  },

  getFields(doc: Document): FieldInfo[] {
    const fields: FieldInfo[] = [];
    // Oracle JET uses oj- prefixed elements with knockout bindings
    const selectors = [
      'input:not([type="hidden"]):not([type="submit"]):not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      'oj-input-text', 'oj-input-password', 'oj-select-single', 'oj-select-many',
      'oj-combobox-one', 'oj-combobox-many', 'oj-text-area',
      '[role="combobox"]', '[role="listbox"]',
    ].join(', ');

    for (const el of doc.querySelectorAll<HTMLElement>(selectors)) {
      if (el.offsetParent === null) continue;
      const signals: FieldSignal[] = extractFieldSignals(el);

      // Oracle-specific: check id and label-hint attributes
      const ojId = el.getAttribute('id') || '';
      if (ojId) {
        const key = ojId.replace(/^oj-/, '').replace(/[\d-]+$/, '');
        const mapped = FIELD_MAP[key];
        if (mapped) {
          signals.push({ source: 'oracle-field-id', value: mapped, weight: 1.0 });
        }
      }
      const labelHint = el.getAttribute('label-hint');
      if (labelHint) {
        signals.push({ source: 'oracle-label-hint', value: labelHint, weight: 0.95 });
      }

      fields.push({ element: el, type: elType(el), signals });
    }

    return fields;
  },

  async fillField(field: HTMLElement, value: string): Promise<boolean> {
    try {
      // Handle Oracle JET custom elements
      const tagName = field.tagName.toLowerCase();

      if (tagName.startsWith('oj-')) {
        // Oracle JET component - find the internal input
        const inp = field.querySelector('input') || field.querySelector('textarea');
        if (inp) {
          (inp as HTMLInputElement).focus();
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(inp, value); else (inp as HTMLInputElement).value = value;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          inp.dispatchEvent(new Event('blur', { bubbles: true }));
          return true;
        }
        // For select-type OJ components
        if (tagName.includes('select') || tagName.includes('combobox')) {
          field.click();
          await delay(300);
          for (const opt of document.querySelectorAll('[role="option"], oj-option')) {
            if (opt.textContent?.toLowerCase().includes(value.toLowerCase())) {
              (opt as HTMLElement).click();
              return true;
            }
          }
        }
        return false;
      }

      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        const setter = Object.getOwnPropertyDescriptor(
          field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
        )?.set;
        if (setter) setter.call(field, value); else field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
      }
      if (field instanceof HTMLSelectElement) {
        const opt = Array.from(field.options).find((o) => o.text.toLowerCase().includes(value.toLowerCase()) || o.value.toLowerCase() === value.toLowerCase());
        if (opt) { field.value = opt.value; field.dispatchEvent(new Event('change', { bubbles: true })); return true; }
        return false;
      }
      if (field.getAttribute('role') === 'combobox' || field.getAttribute('role') === 'listbox') {
        field.click();
        await delay(200);
        const inp = field.querySelector('input') as HTMLInputElement | null;
        if (inp) { inp.value = value; inp.dispatchEvent(new Event('input', { bubbles: true })); }
        await delay(300);
        for (const opt of document.querySelectorAll('[role="option"]')) {
          if (opt.textContent?.toLowerCase().includes(value.toLowerCase())) { (opt as HTMLElement).click(); return true; }
        }
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
