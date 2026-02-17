import type { ATSAdapter, ATSDetectionResult, FieldInfo } from '../../types/index';
import { extractFieldSignals, discoverFields } from '../../fieldMatcher/index';

function elType(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') return (el as HTMLInputElement).type || 'text';
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  return el.getAttribute('role') || 'unknown';
}

export const genericAdapter: ATSAdapter = {
  type: 'generic',

  detect(_doc: Document): ATSDetectionResult {
    return { type: 'generic', confidence: 0.1, signals: ['fallback'] };
  },

  getFields(doc: Document): FieldInfo[] {
    return discoverFields(doc);
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

        // Also fire React-compatible events
        field.dispatchEvent(new Event('focus', { bubbles: true }));
        return true;
      }
      if (field instanceof HTMLSelectElement) {
        const opt = Array.from(field.options).find(
          (o) => o.text.toLowerCase().includes(value.toLowerCase()) || o.value.toLowerCase() === value.toLowerCase()
        );
        if (opt) { field.value = opt.value; field.dispatchEvent(new Event('change', { bubbles: true })); return true; }
        return false;
      }
      // Custom select / combobox
      if (field.getAttribute('role') === 'combobox' || field.getAttribute('role') === 'listbox') {
        field.click();
        await new Promise((r) => setTimeout(r, 200));
        const inp = field.querySelector('input') as HTMLInputElement | null;
        if (inp) { inp.value = value; inp.dispatchEvent(new Event('input', { bubbles: true })); }
        await new Promise((r) => setTimeout(r, 300));
        for (const opt of document.querySelectorAll('[role="option"]')) {
          if (opt.textContent?.toLowerCase().includes(value.toLowerCase())) { (opt as HTMLElement).click(); return true; }
        }
        return false;
      }
      // Radio / Checkbox
      if (field instanceof HTMLInputElement && (field.type === 'radio' || field.type === 'checkbox')) {
        const lbl = field.closest('label')?.textContent?.trim() || '';
        if (lbl.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase() === 'yes' || value.toLowerCase() === 'true') {
          field.checked = true;
          field.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      }
      // Contenteditable
      if (field.contentEditable === 'true') {
        field.textContent = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    } catch { return false; }
  },
};
