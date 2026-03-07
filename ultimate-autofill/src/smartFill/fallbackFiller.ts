/**
 * Fallback Form Filler
 * Fills fields that the primary autofill missed, including:
 * - Text inputs and textareas via smart value guesser + answer bank
 * - Select dropdowns with EEO "Prefer not to say" fallback
 * - Radio button groups (Yes/No defaults)
 * - Required checkboxes
 */

import { guessValue } from './valueGuesser';
import { loadAnswerBank, getLearnedAnswer, type UserProfile } from '../answerBank/index';

// ─── DOM Helpers ───

function isVisible(el: HTMLElement): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && el.offsetParent !== null;
}

function nativeSet(el: HTMLElement, val: string): void {
  try {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, val);
    else (el as HTMLInputElement).value = val;
  } catch {
    (el as HTMLInputElement).value = val;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

function realClick(el: HTMLElement): void {
  if (!el) return;
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  el.click();
}

function getLabel(el: HTMLElement): string {
  if (!el) return '';
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel?.trim()) return ariaLabel.trim();

  if (el.id) {
    const lbl = el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl?.textContent?.trim()) return lbl.textContent.trim();
  }

  if ((el as HTMLInputElement).placeholder?.trim()) return (el as HTMLInputElement).placeholder.trim();

  const container = el.closest('.form-group,.field,.question,[class*="Field"],[class*="Question"],[class*="form-row"],li,.form-item,.ant-form-item,.ant-row');
  if (container) {
    const lbl = container.querySelector('label,[class*="label"],[class*="Label"]');
    if (lbl && lbl !== el && lbl.textContent?.trim()) return lbl.textContent.trim();
  }

  return el.getAttribute('name')?.replace(/[_\-]/g, ' ') || '';
}

function hasFieldValue(el: HTMLElement): boolean {
  if (el instanceof HTMLSelectElement) {
    const val = (el.value || '').trim();
    if (!val) return false;
    const idx = el.selectedIndex;
    if (idx >= 0) {
      const txt = (el.options[idx]?.textContent || '').trim().toLowerCase();
      if (!txt || /^(select|choose|please|--|—)/.test(txt)) return false;
    }
    return true;
  }
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') return !!el.checked;
    return !!el.value?.trim();
  }
  if (el instanceof HTMLTextAreaElement) return !!el.value?.trim();
  return false;
}

function isFieldRequired(el: HTMLElement): boolean {
  if ((el as HTMLInputElement).required || el.getAttribute('aria-required') === 'true') return true;
  const container = el.closest('.field,.question,[class*="field"],[class*="Field"],[class*="question"],li,div');
  const label = getLabel(el);
  if (/\*\s*$|required/i.test(label || '')) return true;
  if (container) {
    if (container.classList.contains('required')) return true;
    if (container.getAttribute('data-required') === 'true') return true;
    if (container.querySelector('.required,.asterisk,[aria-label*="required" i]')) return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function guessFieldValue(label: string, profile: UserProfile, el?: HTMLElement): string {
  return guessValue(label, profile) || getLearnedAnswer(label, el) || '';
}

// ─── Main Fallback Fill ───

/**
 * Fills unfilled form fields using smart guessing + answer bank.
 * Returns the number of fields filled.
 */
export async function fallbackFill(doc: Document, profile: UserProfile): Promise<number> {
  await loadAnswerBank();
  let filled = 0;

  // 1. Text inputs & textareas — only unfilled visible ones
  const inputs = Array.from(
    doc.querySelectorAll<HTMLElement>('input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]),textarea')
  ).filter((el) => isVisible(el) && !(el as HTMLInputElement).value?.trim());

  for (const inp of inputs) {
    const lbl = getLabel(inp);
    if (!lbl) continue;
    const val = guessFieldValue(lbl, profile, inp);
    if (!val) continue;
    inp.focus();
    nativeSet(inp, val);
    inp.classList.add('ua-filled');
    filled++;
    await sleep(60);
  }

  // 2. Select dropdowns — only unselected ones
  const selects = Array.from(doc.querySelectorAll<HTMLSelectElement>('select')).filter(
    (el) => isVisible(el) && !hasFieldValue(el)
  );

  for (const sel of selects) {
    const lbl = getLabel(sel);
    const val = guessFieldValue(lbl, profile, sel);
    if (!val) {
      // EEO fallback: select "Prefer not to say" for sensitive fields
      const lblLower = (lbl || '').toLowerCase();
      if (/gender|disability|veteran|race|ethnicity|sex\b|heritage/i.test(lblLower)) {
        const opts = Array.from(sel.options).filter((o) => o.value && o.index > 0);
        const fb = opts.find((o) => /prefer not|decline|not to|do not|don.t wish/i.test(o.text));
        if (fb) {
          sel.value = fb.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          sel.classList.add('ua-filled');
          filled++;
        }
      }
      continue;
    }
    // Try to find a matching option
    const opt = Array.from(sel.options).find((o) =>
      o.text.toLowerCase().includes(val.toLowerCase())
    );
    if (opt) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sel.classList.add('ua-filled');
      filled++;
    } else {
      // Fallback: select first valid option
      const opts = Array.from(sel.options).filter((o) => o.value && o.index > 0);
      if (opts.length) {
        sel.value = opts[0].value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        sel.classList.add('ua-filled');
        filled++;
      }
    }
  }

  // 3. Radio buttons — only unselected groups
  const groups: Record<string, HTMLInputElement[]> = {};
  const radios = Array.from(doc.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(isVisible);
  for (const r of radios) {
    const key = r.name || r.id;
    if (!key) continue;
    (groups[key] ||= []).push(r);
  }

  for (const [, radioGroup] of Object.entries(groups)) {
    if (radioGroup.some((r) => r.checked)) continue;
    const lbl = getLabel(radioGroup[0]);
    const guess = guessFieldValue(lbl, profile, radioGroup[0]);

    // Try matching by guess value
    const match = radioGroup.find((r) => {
      const labelEl = r.id ? doc.querySelector(`label[for="${CSS.escape(r.id)}"]`) : null;
      const t = (labelEl?.textContent || r.value || '').toLowerCase();
      return guess && t.includes(guess.toLowerCase());
    });
    if (match) {
      realClick(match);
      filled++;
      continue;
    }

    // Default: select "Yes" for yes/no questions
    const yesRadio = radioGroup.find((r) => {
      const labelEl = r.id ? doc.querySelector(`label[for="${CSS.escape(r.id)}"]`) : null;
      const t = (labelEl?.textContent || r.value || '').toLowerCase().trim();
      return ['yes', 'true', '1'].includes(t);
    });
    if (yesRadio) {
      realClick(yesRadio);
      filled++;
    }
  }

  // 4. Required checkboxes — auto-check
  const requiredCheckboxes = Array.from(
    doc.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][required],input[type="checkbox"][aria-required="true"]'
    )
  ).filter((el) => isVisible(el) && !el.checked);

  for (const cb of requiredCheckboxes) {
    realClick(cb);
    filled++;
  }

  return filled;
}

/**
 * Returns labels of required fields that are still missing values.
 */
export function getMissingRequired(doc: Document): string[] {
  const required = Array.from(
    doc.querySelectorAll<HTMLElement>('input:not([type="hidden"]),textarea,select')
  ).filter((el) => isVisible(el) && isFieldRequired(el));

  const missing: string[] = [];
  for (const el of required) {
    if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
      const group = Array.from(
        doc.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(el.name)}"]`)
      ).filter(isVisible);
      if (group.some((r) => r.checked)) continue;
    } else if (el instanceof HTMLInputElement && el.type === 'checkbox' && !el.checked) {
      // required checkbox must be checked
    } else if (hasFieldValue(el)) {
      continue;
    }
    const lbl = getLabel(el) || el.getAttribute('name') || el.id || 'Required field';
    if (!missing.includes(lbl)) missing.push(lbl);
  }
  return missing;
}
