import type { ATSAdapter, ATSDetectionResult, FieldInfo, FieldSignal } from '../../types/index';
import { extractFieldSignals, discoverFields } from '../../fieldMatcher/index';

function elType(el: HTMLElement): string {
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') return (el as HTMLInputElement).type || 'text';
    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'select';
    return el.getAttribute('role') || 'unknown';
}

export const icimsAdapter: ATSAdapter = {
    type: 'icims',

    detect(doc: Document): ATSDetectionResult {
        const signals: string[] = [];
        let conf = 0;
        const docHref = doc.location?.href;
        const url = (docHref && docHref !== 'about:blank' ? docHref : null) || (typeof window !== 'undefined' ? window.location?.href : '') || '';
        if (/icims\.com/i.test(url)) { conf += 0.6; signals.push('url'); }
        if (doc.querySelector('.iCIMS_MainWrapper,.iCIMS_Header,#iCIMS_Header')) { conf += 0.3; signals.push('icims-elements'); }
        if (doc.querySelector('form[action*="icims"]')) { conf += 0.2; signals.push('icims-form'); }
        return { type: 'icims', confidence: Math.min(conf, 1), signals };
    },

    getFields(doc: Document): FieldInfo[] {
        return discoverFields(doc);
    },

    async fillField(field: HTMLElement, value: string): Promise<boolean> {
        try {
            if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
                const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                if (setter) setter.call(field, value); else field.value = value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                field.dispatchEvent(new Event('blur', { bubbles: true }));
                return true;
            }
            if (field instanceof HTMLSelectElement) {
                const opt = Array.from(field.options).find(
                    o => o.text.toLowerCase().includes(value.toLowerCase()) || o.value.toLowerCase() === value.toLowerCase()
                );
                if (opt) { field.value = opt.value; field.dispatchEvent(new Event('change', { bubbles: true })); return true; }
                return false;
            }
            if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) {
                const lbl = field.closest('label')?.textContent?.trim() || '';
                if (lbl.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase() === 'yes') {
                    field.checked = true;
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
                return false;
            }
            return false;
        } catch { return false; }
    },
};
