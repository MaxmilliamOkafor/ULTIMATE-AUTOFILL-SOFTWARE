/**
 * Smart Field Value Guesser
 * Ported from OptimHire patch – 90+ regex patterns for mapping field labels to profile values.
 * Enhanced with response bank lookup and robust required-field detection.
 */

// ─── Default Values ─────────────────────────────────────────────
export const DEFAULTS: Record<string, string> = {
    authorized: 'Yes',
    sponsorship: 'No',
    relocation: 'Yes',
    remote: 'Yes',
    veteran: 'I am not a protected veteran',
    disability: 'I do not have a disability',
    gender: 'Prefer not to say',
    ethnicity: 'Prefer not to say',
    race: 'Prefer not to say',
    years: '5',
    salary: '80000',
    notice: '2 weeks',
    availability: 'Immediately',
    cover: `I am excited to apply for this role. My background and skills make me an excellent candidate and I look forward to contributing to your team.`,
    why: 'I admire the company culture and the opportunity to make a meaningful impact.',
    howHeard: 'LinkedIn',
};

// ─── Profile Normalizer ─────────────────────────────────────────
export interface NormalizedProfile {
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    preferred_name?: string;
    email?: string;
    phone?: string;
    linkedin_profile_url?: string;
    website_url?: string;
    github_url?: string;
    twitter_url?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    address?: string;
    current_title?: string;
    current_company?: string;
    school?: string;
    university?: string;
    degree?: string;
    major?: string;
    gpa?: string;
    graduation_year?: string;
    expected_salary?: string;
    cover_letter?: string;
    summary?: string;
    languages?: string;
    certifications?: string;
    nationality?: string;
    years_of_experience?: string;
    resume_url?: string;
    [key: string]: string | undefined;
}

function pickFirst(...vals: unknown[]): string {
    for (const v of vals) {
        if (typeof v === 'string' && v.trim()) return v.trim();
        if (typeof v === 'number') return String(v);
    }
    return '';
}

export function normalizeProfile(raw: Record<string, any> = {}): NormalizedProfile {
    const p: Record<string, any> = { ...(raw || {}) };
    p.first_name = pickFirst(p.first_name, p.firstName, p.firstname, p.given_name, p.givenName);
    p.last_name = pickFirst(p.last_name, p.lastName, p.lastname, p.family_name, p.familyName);
    p.email = pickFirst(p.email, p.emailAddress, p.email_address, p.primaryEmail, p.workEmail);
    p.phone = pickFirst(p.phone, p.phoneNumber, p.phone_number, p.mobile, p.mobileNumber, p.contactNumber, p.telephone);
    p.linkedin_profile_url = pickFirst(p.linkedin_profile_url, p.linkedin, p.linkedIn, p.linkedinUrl, p.linkedin_url);
    p.website_url = pickFirst(p.website_url, p.website, p.portfolio, p.portfolio_url, p.personalWebsite);
    p.github_url = pickFirst(p.github_url, p.github, p.githubUrl);
    p.city = pickFirst(p.city, p.currentCity, p.locationCity);
    p.state = pickFirst(p.state, p.region, p.province);
    p.country = pickFirst(p.country, p.countryName);
    p.postal_code = pickFirst(p.postal_code, p.zip, p.zipCode, p.postcode);
    p.address = pickFirst(p.address, p.streetAddress, p.addressLine1);
    p.current_title = pickFirst(p.current_title, p.currentTitle, p.title);
    p.current_company = pickFirst(p.current_company, p.currentCompany, p.company);
    p.school = pickFirst(p.school, p.university);
    p.degree = pickFirst(p.degree);
    p.major = pickFirst(p.major);
    p.graduation_year = pickFirst(p.graduation_year, p.grad_year);
    p.expected_salary = pickFirst(p.expected_salary, p.desired_pay, p.desiredPay);
    p.cover_letter = pickFirst(p.cover_letter, p.coverLetter);
    p.summary = pickFirst(p.summary, p.bio, p.objective);
    p.resume_url = pickFirst(p.resume_url, p.resumeUrl, p.resume);

    // Also check nested profile/candidate/user/basics objects
    const nested = p.profile || p.candidate || p.user || p.basics || {};
    p.first_name = pickFirst(p.first_name, nested.first_name, nested.firstName, nested.firstname);
    p.last_name = pickFirst(p.last_name, nested.last_name, nested.lastName, nested.lastname);
    p.email = pickFirst(p.email, nested.email, nested.emailAddress, nested.email_address);
    p.phone = pickFirst(p.phone, nested.phone, nested.phoneNumber, nested.mobile, nested.mobileNumber);
    p.linkedin_profile_url = pickFirst(p.linkedin_profile_url, nested.linkedin_profile_url, nested.linkedin, nested.linkedIn, nested.linkedinUrl);
    p.website_url = pickFirst(p.website_url, nested.website_url, nested.website, nested.portfolio, nested.portfolio_url);

    return p as NormalizedProfile;
}

// ─── Smart Value Guesser ────────────────────────────────────────
/** Given a field label and user profile, guess the most appropriate value. */
export function guessValue(label: string, p: NormalizedProfile = {}): string {
    const l = label.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    if (/first.?name|given.?name|prenom/.test(l)) return p.first_name || '';
    if (/last.?name|family.?name|surname/.test(l)) return p.last_name || '';
    if (/middle.?name/.test(l)) return p.middle_name || '';
    if (/preferred.?name|nick.?name/.test(l)) return p.preferred_name || p.first_name || '';
    if (/full.?name|your name|name/.test(l) && !/company|last|first|user/.test(l)) return `${p.first_name || ''} ${p.last_name || ''}`.trim();
    if (/\bemail\b/.test(l)) return p.email || '';
    if (/phone|mobile|cell|telephone/.test(l)) return p.phone || '';
    if (/^city$|\bcity\b|current.?city/.test(l)) return p.city || '';
    if (/state|province|region/.test(l)) return p.state || '';
    if (/zip|postal/.test(l)) return p.postal_code || '';
    if (/country/.test(l)) return p.country || 'United States';
    if (/address|street/.test(l)) return p.address || '';
    if (/location|where.*(you|do you).*live/.test(l)) return p.city ? `${p.city}, ${p.state || ''}`.trim().replace(/,$/, '') : '';
    if (/linkedin/.test(l)) return p.linkedin_profile_url || '';
    if (/github/.test(l)) return p.github_url || '';
    if (/website|portfolio|personal.?url/.test(l)) return p.website_url || '';
    if (/twitter|x\.com/.test(l)) return p.twitter_url || '';
    if (/university|school|college|alma.?mater/.test(l)) return p.school || '';
    if (/\bdegree\b|qualification/.test(l)) return p.degree || "Bachelor's";
    if (/major|field.?of.?study|concentration|specialization/.test(l)) return p.major || '';
    if (/gpa|grade.?point/.test(l)) return p.gpa || '';
    if (/graduation|grad.?date|grad.?year/.test(l)) return p.graduation_year || '';
    if (/title|position|role|current.?title|job.?title/.test(l) && !/company/.test(l)) return p.current_title || '';
    if (/company|employer|org|current.?company/.test(l)) return p.current_company || '';
    if (/salary|compensation|pay|desired.?pay|expected.?comp/.test(l)) return p.expected_salary || DEFAULTS.salary;
    if (/cover.?letter|motivation|additional.?info|message.?to/.test(l)) return p.cover_letter || DEFAULTS.cover;
    if (/summary|about.?(yourself|you|me)|bio|objective|profile.?summary/.test(l)) return p.summary || p.cover_letter || DEFAULTS.cover;
    if (/why.*(compan|role|want|interest|position)/.test(l)) return DEFAULTS.why;
    if (/how.*hear|where.*(find|learn|discover)|source|referred.?by|referral/.test(l)) return DEFAULTS.howHeard;
    if (/years.*(exp|work)|exp.*years|total.*experience/.test(l)) return p.years_of_experience || DEFAULTS.years;
    if (/availab|start.?date|notice|when.*start|earliest.*start/.test(l)) return DEFAULTS.availability;
    if (/authoriz|eligible|work.*right|legal.*right|permitted.*work/.test(l)) return DEFAULTS.authorized;
    if (/sponsor|visa|immigration|work.?permit/.test(l)) return DEFAULTS.sponsorship;
    if (/relocat|willing.*move|open.*reloc/.test(l)) return DEFAULTS.relocation;
    if (/remote|work.*home|hybrid|on.?site|work.?model|work.?arrangement/.test(l)) return DEFAULTS.remote;
    if (/veteran|military|armed.?forces|served/.test(l)) return DEFAULTS.veteran;
    if (/disabilit/.test(l)) return DEFAULTS.disability;
    if (/gender|sex\b|pronouns/.test(l)) return DEFAULTS.gender;
    if (/ethnic|race|racial|heritage/.test(l)) return DEFAULTS.ethnicity;
    if (/nationality|citizenship/.test(l)) return p.nationality || p.country || 'United States';
    if (/language|fluency|fluent/.test(l)) return p.languages || 'English';
    if (/certif|license|credential/.test(l)) return p.certifications || '';
    if (/commute|travel|willing.*travel/.test(l)) return 'Yes';
    if (/convicted|criminal|felony|background.?check/.test(l)) return 'No';
    if (/drug.?test|screening/.test(l)) return 'Yes';
    if (/\bage\b|18.*years|over.*18|at.*least.*18/.test(l)) return 'Yes';
    if (/agree|acknowledge|certif|attest|confirm|consent/.test(l)) return 'Yes';
    return '';
}

// ─── Field Helpers ──────────────────────────────────────────────
export function getFieldLabel(el: HTMLElement): string {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label')!;
    if (el.id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl?.textContent?.trim()) return lbl.textContent.trim();
    }
    if ((el as HTMLInputElement).placeholder) return (el as HTMLInputElement).placeholder;
    const container = el.closest(
        '.form-group,.field,.question,[class*="Field"],[class*="Question"],[class*="form-row"]'
    );
    if (container) {
        const lbl = container.querySelector('label,[class*="label"],[class*="Label"]');
        if (lbl && lbl !== el) return lbl.textContent?.trim() || '';
    }
    const wrap = el.closest('label');
    if (wrap?.textContent?.trim()) return wrap.textContent.trim();
    return (el as HTMLInputElement).name?.replace(/[_\-]/g, ' ') || '';
}

export function isFieldRequired(el: HTMLElement): boolean {
    if (!el) return false;
    if ((el as HTMLInputElement).required || el.getAttribute('aria-required') === 'true') return true;
    if (el.getAttribute('required') !== null) return true;
    const container = el.closest(
        '.field,.application-field,.question,[class*="field"],[class*="Field"],[class*="question"],[class*="Question"],li,div'
    );
    const label = getFieldLabel(el);
    if (/\*\s*$|required/.test((label || '').toLowerCase())) return true;
    if (container) {
        if (container.classList.contains('required')) return true;
        if (container.getAttribute('data-required') === 'true') return true;
        if (container.querySelector('.required,.asterisk,[aria-label*="required" i]')) return true;
    }
    return false;
}

export function hasFieldValue(el: HTMLElement): boolean {
    if (!el) return false;
    if (el.tagName === 'SELECT') {
        const sel = el as HTMLSelectElement;
        const val = (sel.value || '').trim();
        if (!val) return false;
        const idx = sel.selectedIndex;
        if (idx >= 0) {
            const txt = (sel.options[idx]?.textContent || '').trim().toLowerCase();
            if (!txt || /select|choose|please|--/.test(txt)) return false;
        }
        return true;
    }
    if ((el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio') return !!(el as HTMLInputElement).checked;
    return !!(el as HTMLInputElement).value?.trim();
}

export function isVisible(el: HTMLElement): boolean {
    if (!el) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
}

// ─── React-compatible value setter ──────────────────────────────
export function nativeSet(el: HTMLElement, val: string): void {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, val); else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        el.dispatchEvent(new Event('focus', { bubbles: true }));
    } else if (el.contentEditable === 'true') {
        el.textContent = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// ─── Real click with pointer events ────────────────────────────
export function realClick(el: HTMLElement): void {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.click();
}

// ─── Profile loader from chrome.storage ─────────────────────────
export async function loadProfile(): Promise<NormalizedProfile> {
    try {
        const data = await chrome.storage.local.get(['candidateDetails', 'userDetails', 'profileData', 'ua_profile']);
        let raw: Record<string, any> = {};

        // Try multiple storage keys
        for (const key of ['ua_profile', 'profileData', 'candidateDetails', 'userDetails']) {
            if (data[key]) {
                try {
                    const parsed = typeof data[key] === 'string' ? JSON.parse(data[key]) : data[key];
                    raw = { ...raw, ...parsed };
                } catch { /* skip invalid JSON */ }
            }
        }
        return normalizeProfile(raw);
    } catch {
        return {};
    }
}

// ─── Response bank (cached Q&A from storage) ────────────────────
interface ResponseEntry { key: string; value: string; }

let _responseBankCache: { loaded: boolean; entries: ResponseEntry[]; ts: number } = { loaded: false, entries: [], ts: 0 };
const RESPONSE_BANK_TTL_MS = 10_000;

function normalizeText(v: unknown): string {
    return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function addResponseEntry(entries: ResponseEntry[], keyText: unknown, response: unknown): void {
    const key = normalizeText(keyText);
    const val = String(response || '').trim();
    if (!key || !val) return;
    if (entries.some(e => e.key === key && e.value === val)) return;
    entries.push({ key, value: val });
}

function collectResponseEntries(node: any, entries: ResponseEntry[]): void {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(item => collectResponseEntries(item, entries)); return; }
    if (typeof node !== 'object') return;
    const response = node.response || node.answer || node.value || node.selected || node.a || node.text;
    if (response && (node.question || node.key || node.id || node.label)) {
        addResponseEntry(entries, node.question, response);
        addResponseEntry(entries, node.key, response);
        addResponseEntry(entries, node.label, response);
        addResponseEntry(entries, node.id, response);
        if (Array.isArray(node.keywords)) node.keywords.forEach((k: string) => addResponseEntry(entries, k, response));
    }
    Object.values(node).forEach(v => collectResponseEntries(v, entries));
}

export async function getResponseBank(): Promise<ResponseEntry[]> {
    if (_responseBankCache.loaded && (Date.now() - _responseBankCache.ts) < RESPONSE_BANK_TTL_MS) {
        return _responseBankCache.entries;
    }
    const keys = [
        'applicationDetails', 'complexFormData', 'manualComplexInstructions',
        'manualApplicationDetail', 'responses', 'questionAnswers', 'candidateDetails',
        'missing_details', 'missingDetails', 'missingQuestionDetails', 'userDetails',
        'ua_responses',
    ];
    const raw = await chrome.storage.local.get(keys);
    const entries: ResponseEntry[] = [];
    for (const val of Object.values(raw || {})) {
        if (!val) continue;
        try {
            const parsed = typeof val === 'string' ? JSON.parse(val) : val;
            collectResponseEntries(parsed, entries);
        } catch { /* skip */ }
    }
    _responseBankCache = { loaded: true, entries, ts: Date.now() };
    return entries;
}

export function getResponseValue(label: string, el: HTMLElement | null, entries: ResponseEntry[]): string {
    if (!entries?.length) return '';
    const candidates = [
        label,
        el ? getFieldLabel(el) : '',
        (el as HTMLInputElement)?.name || '',
        el?.id || '',
        (el as HTMLInputElement)?.placeholder || '',
        el?.getAttribute?.('aria-label') || '',
    ].map(normalizeText).filter(Boolean);

    for (const c of candidates) {
        const exact = entries.find(e => e.key === c);
        if (exact) return exact.value;
    }
    for (const c of candidates) {
        const matched = entries.find(e => c.includes(e.key) || e.key.includes(c));
        if (matched) return matched.value;
    }
    return '';
}

/** Combined guesser: tries profile guess first, then response bank. */
export function guessFieldValue(label: string, profile: NormalizedProfile, el: HTMLElement | null, responseEntries: ResponseEntry[] = []): string {
    return guessValue(label, profile) || getResponseValue(label, el, responseEntries) || '';
}

// Invalidate response cache on storage changes
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        const refreshKeys = [
            'applicationDetails', 'complexFormData', 'manualComplexInstructions',
            'manualApplicationDetail', 'responses', 'questionAnswers', 'candidateDetails',
            'missing_details', 'missingDetails', 'missingQuestionDetails', 'userDetails',
            'ua_responses',
        ];
        for (const k of refreshKeys) {
            if (changes[k]) { _responseBankCache = { loaded: false, entries: [], ts: 0 }; break; }
        }
    });
}
