import type { ATSAdapter, ATSDetectionResult, FieldInfo, FieldSignal } from '../../types/index';
import { extractFieldSignals } from '../../fieldMatcher/index';

const FIELD_MAP: Record<string, string> = {
  legalNameSection_firstName: 'First Name',
  legalNameSection_lastName: 'Last Name',
  addressSection_addressLine1: 'Address Line 1',
  addressSection_city: 'City',
  addressSection_countryRegion: 'Country',
  addressSection_postalCode: 'Postal Code',
  'phone-number': 'Phone Number',
  email: 'Email Address',
  source: 'How did you hear about us',
};

function humanizeId(id: string): string {
  return id.replace(/Section_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-]+/g, ' ').trim();
}

function elType(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') return (el as HTMLInputElement).type || 'text';
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  return el.getAttribute('role') || 'unknown';
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const workdayAdapter: ATSAdapter = {
  type: 'workday',

  detect(doc: Document): ATSDetectionResult {
    const signals: string[] = [];
    let conf = 0;
    const docHref = doc.location?.href;
    const url = (docHref && docHref !== 'about:blank' ? docHref : null) || (typeof window !== 'undefined' ? window.location?.href : '') || '';
    if (/myworkdayjobs\.com|myworkday\.com/i.test(url)) { conf += 0.5; signals.push('url'); }
    if (doc.querySelector('[data-automation-id]')) { conf += 0.3; signals.push('data-automation-id'); }
    if (doc.querySelector('[data-uxi-element-id]')) { conf += 0.2; signals.push('data-uxi-element-id'); }
    return { type: 'workday', confidence: Math.min(conf, 1), signals };
  },

  getFields(doc: Document): FieldInfo[] {
    const fields: FieldInfo[] = [];
    const els = doc.querySelectorAll<HTMLElement>(
      '[data-automation-id] input, [data-automation-id] textarea, [data-automation-id] select, [data-automation-id] [role="combobox"], [data-automation-id] [role="listbox"]'
    );

    for (const el of els) {
      if (el.offsetParent === null) continue;
      const signals: FieldSignal[] = extractFieldSignals(el);

      const container = el.closest('[data-automation-id]');
      if (container) {
        const aid = container.getAttribute('data-automation-id') || '';
        const mapped = FIELD_MAP[aid];
        signals.push({
          source: 'workday-automation-id',
          value: mapped || humanizeId(aid),
          weight: mapped ? 1.0 : 0.8,
        });
      }

      fields.push({ element: el, type: elType(el), signals });
    }

    // Catch any standard inputs not inside automation containers
    const seen = new Set(fields.map((f) => f.element));
    for (const el of doc.querySelectorAll<HTMLElement>('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])')) {
      if (seen.has(el) || el.offsetParent === null) continue;
      const signals = extractFieldSignals(el);
      if (signals.length) fields.push({ element: el, type: elType(el), signals });
    }

    return fields;
  },

  async fillField(field: HTMLElement, value: string): Promise<boolean> {
    try {
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
