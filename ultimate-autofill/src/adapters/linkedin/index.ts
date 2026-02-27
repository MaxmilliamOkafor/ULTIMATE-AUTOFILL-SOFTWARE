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

export const linkedinAdapter: ATSAdapter = {
  type: 'linkedin',

  detect(doc: Document): ATSDetectionResult {
    const signals: string[] = [];
    let conf = 0;
    const docHref = doc.location?.href;
    const url = (docHref && docHref !== 'about:blank' ? docHref : null) || (typeof window !== 'undefined' ? window.location?.href : '') || '';
    if (/linkedin\.com\/jobs/i.test(url)) { conf += 0.5; signals.push('url:linkedin-jobs'); }
    if (doc.querySelector('.jobs-apply-button') || doc.querySelector('[data-job-id]')) { conf += 0.3; signals.push('linkedin-job-ui'); }

    // Check for Easy Apply - we skip these
    const easyApplyBtn = doc.querySelector('.jobs-apply-button--top-card');
    if (easyApplyBtn?.textContent?.toLowerCase().includes('easy apply')) {
      return { type: 'linkedin', confidence: 0, signals: ['easy-apply-skipped'] };
    }

    return { type: 'linkedin', confidence: Math.min(conf, 1), signals };
  },

  getFields(doc: Document): FieldInfo[] {
    const fields: FieldInfo[] = [];
    // LinkedIn external apply redirects to company ATS, but some have embedded forms
    const container = doc.querySelector('.jobs-easy-apply-content') || doc.querySelector('.jobs-apply-form') || doc;
    const els = container.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]'
    );

    for (const el of els) {
      if (el.offsetParent === null) continue;
      const signals: FieldSignal[] = extractFieldSignals(el);

      // LinkedIn-specific data attributes
      const formComponent = el.closest('[data-test-form-element]');
      if (formComponent) {
        const testLabel = formComponent.getAttribute('data-test-form-element');
        if (testLabel) signals.push({ source: 'linkedin-form-element', value: testLabel, weight: 0.9 });
      }

      fields.push({ element: el, type: elType(el), signals });
    }

    return fields;
  },

  async fillField(field: HTMLElement, value: string): Promise<boolean> {
    try {
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        field.focus();
        await delay(50);
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
      if (field.getAttribute('role') === 'combobox') {
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
