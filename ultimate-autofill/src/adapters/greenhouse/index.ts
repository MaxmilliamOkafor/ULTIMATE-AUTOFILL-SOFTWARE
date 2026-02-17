import type { ATSAdapter, ATSDetectionResult, FieldInfo, FieldSignal } from '../../types/index';
import { extractFieldSignals } from '../../fieldMatcher/index';

const ID_MAP: Record<string, string> = {
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email Address',
  phone: 'Phone Number',
  resume: 'Resume',
  cover_letter: 'Cover Letter',
  linkedin_profile: 'LinkedIn Profile',
  website: 'Website',
  location: 'Location',
  how_did_you_hear: 'How did you hear about us',
};

function humanize(s: string): string {
  return s.replace(/[\[\]]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function elType(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') return (el as HTMLInputElement).type || 'text';
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  return el.getAttribute('role') || 'unknown';
}

export const greenhouseAdapter: ATSAdapter = {
  type: 'greenhouse',

  detect(doc: Document): ATSDetectionResult {
    const signals: string[] = [];
    let conf = 0;
    const docHref = doc.location?.href;
    const url = (docHref && docHref !== 'about:blank' ? docHref : null) || (typeof window !== 'undefined' ? window.location?.href : '') || '';
    if (/greenhouse\.io/i.test(url)) { conf += 0.5; signals.push('url'); }
    if (doc.querySelector('#greenhouse_application') || doc.querySelector('#grnhse_app')) { conf += 0.3; signals.push('greenhouse container'); }
    if (doc.querySelector('form#application_form')) { conf += 0.2; signals.push('application_form'); }
    return { type: 'greenhouse', confidence: Math.min(conf, 1), signals };
  },

  getFields(doc: Document): FieldInfo[] {
    const fields: FieldInfo[] = [];
    const container = doc.querySelector('#greenhouse_application') || doc.querySelector('#grnhse_app') || doc;
    const els = container.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
    );

    for (const el of els) {
      if (el.offsetParent === null) continue;
      const signals: FieldSignal[] = extractFieldSignals(el);

      // Greenhouse-specific: field name patterns like "job_application[first_name]"
      const name = el.getAttribute('name') || '';
      const bracketMatch = name.match(/\[(\w+)\]$/);
      if (bracketMatch) {
        const key = bracketMatch[1];
        const mapped = ID_MAP[key];
        signals.push({
          source: 'greenhouse-field-key',
          value: mapped || humanize(key),
          weight: mapped ? 1.0 : 0.75,
        });
      }

      // Greenhouse uses data-question for custom questions
      const dataQ = el.closest('[data-question]');
      if (dataQ) {
        const qText = dataQ.getAttribute('data-question') || '';
        if (qText) signals.push({ source: 'greenhouse-data-question', value: qText, weight: 0.95 });
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
