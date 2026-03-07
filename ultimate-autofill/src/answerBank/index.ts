/**
 * Answer Bank / Learning System
 * Stores answers keyed by normalized field label for future reuse.
 * Learns from filled forms and provides answers for unfamiliar fields.
 */

const ANSWER_BANK_KEY = 'ua_answer_bank';
const PROFILE_KEY = 'ua_user_profile';

export interface UserProfile {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  preferred_name?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  address?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  twitter?: string;
  school?: string;
  degree?: string;
  major?: string;
  gpa?: string;
  graduation_year?: string;
  current_title?: string;
  current_company?: string;
  expected_salary?: string;
  cover_letter?: string;
  summary?: string;
  languages?: string;
  certifications?: string;
  nationality?: string;
  [key: string]: string | undefined;
}

let _answerBank: Record<string, string> = {};
let _loaded = false;

export function normalizeKey(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function loadAnswerBank(): Promise<Record<string, string>> {
  if (_loaded) return _answerBank;
  const r = await chrome.storage.local.get(ANSWER_BANK_KEY);
  _answerBank = r[ANSWER_BANK_KEY] || {};
  _loaded = true;
  return _answerBank;
}

export async function learnAnswer(label: string, value: string): Promise<void> {
  if (!label || !value) return;
  const key = normalizeKey(label);
  if (!key) return;
  _answerBank[key] = value;
  await chrome.storage.local.set({ [ANSWER_BANK_KEY]: _answerBank });
}

export function getLearnedAnswer(label: string, el?: HTMLElement): string {
  const candidates = [
    label,
    el?.getAttribute('name') || '',
    el?.id || '',
    (el as HTMLInputElement)?.placeholder || '',
    el?.getAttribute('aria-label') || '',
  ].filter(Boolean);

  // Exact match
  for (const c of candidates) {
    const k = normalizeKey(c);
    if (_answerBank[k]) return _answerBank[k];
  }

  // Partial match
  for (const c of candidates) {
    const k = normalizeKey(c);
    if (!k) continue;
    for (const [bk, bv] of Object.entries(_answerBank)) {
      if (k.includes(bk) || bk.includes(k)) return bv;
    }
  }

  return '';
}

/**
 * Capture all filled field values from the current page into the answer bank.
 */
export async function learnFromPage(doc: Document): Promise<number> {
  await loadAnswerBank();

  const selector = 'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]),textarea,select';
  const elements = doc.querySelectorAll<HTMLElement>(selector);
  let learned = 0;

  for (const el of elements) {
    if (!isVisible(el)) continue;
    if (!hasFieldValue(el)) continue;

    const lbl = getFieldLabel(el);
    if (!lbl) continue;

    let val: string;
    if (el instanceof HTMLSelectElement) {
      val = (el.options[el.selectedIndex]?.textContent || el.value || '').trim();
    } else {
      val = ((el as HTMLInputElement).value || '').trim();
    }

    if (val) {
      await learnAnswer(lbl, val);
      learned++;
    }
  }

  return learned;
}

export async function loadProfile(): Promise<UserProfile> {
  const r = await chrome.storage.local.get(PROFILE_KEY);
  return r[PROFILE_KEY] || {};
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await chrome.storage.local.set({ [PROFILE_KEY]: profile });
}

// ─── Helpers ───

function isVisible(el: HTMLElement): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && el.offsetParent !== null;
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

function getFieldLabel(el: HTMLElement): string {
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

  const name = el.getAttribute('name');
  if (name) return name.replace(/[_\-]/g, ' ');

  return '';
}
