import type { ATSAdapter, ATSDetectionResult, FieldInfo, FieldSignal } from '../../types/index';
import { extractFieldSignals } from '../../fieldMatcher/index';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function elType(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') return (el as HTMLInputElement).type || 'text';
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  return el.getAttribute('role') || 'unknown';
}

export const indeedAdapter: ATSAdapter = {
  type: 'indeed',

  detect(doc: Document): ATSDetectionResult {
    const signals: string[] = [];
    let conf = 0;
    const docHref = doc.location?.href;
    const url = (docHref && docHref !== 'about:blank' ? docHref : null) || (typeof window !== 'undefined' ? window.location?.href : '') || '';
    if (/indeed\.com/i.test(url)) { conf += 0.5; signals.push('url:indeed'); }
    if (/apply\.indeed\.com/i.test(url)) { conf += 0.3; signals.push('url:indeed-apply'); }
    if (doc.querySelector('#ia-container') || doc.querySelector('[data-testid="apply-button"]')) { conf += 0.2; signals.push('indeed-apply-ui'); }
    return { type: 'indeed', confidence: Math.min(conf, 1), signals };
  },

  getFields(doc: Document): FieldInfo[] {
    const fields: FieldInfo[] = [];
    // Indeed Apply uses a specific container
    const container = doc.querySelector('#ia-container') || doc.querySelector('.ia-BasePage') || doc;
    const els = container.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"], [role="listbox"]'
    );

    for (const el of els) {
      if (el.offsetParent === null) continue;
      const signals: FieldSignal[] = extractFieldSignals(el);

      // Indeed uses data-testid for component identification
      const testId = el.getAttribute('data-testid') || el.closest('[data-testid]')?.getAttribute('data-testid');
      if (testId) {
        signals.push({ source: 'indeed-testid', value: testId.replace(/[-_]/g, ' '), weight: 0.85 });
      }

      // Indeed Apply labels are often in a specific parent structure
      const questionContainer = el.closest('.ia-Questions-item') || el.closest('[data-testid]');
      if (questionContainer) {
        const label = questionContainer.querySelector('label, .ia-Questions-label');
        if (label?.textContent?.trim()) {
          signals.push({ source: 'indeed-question', value: label.textContent.trim(), weight: 0.95 });
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
        const opt = Array.from(field.options).find(
          (o) => o.text.toLowerCase().includes(value.toLowerCase()) || o.value.toLowerCase() === value.toLowerCase()
        );
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
