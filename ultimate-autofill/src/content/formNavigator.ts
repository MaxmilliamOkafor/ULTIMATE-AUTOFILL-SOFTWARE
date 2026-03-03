/**
 * Form Navigator – handles submit/next button detection, multi-page forms,
 * and success detection. Ported from OptimHire patch.
 */
import { isVisible, realClick } from '../fieldMatcher/smartGuesser';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Submit / Next button detection ─────────────────────────────
const SUBMIT_SELECTORS = [
    'button[type="submit"]', 'input[type="submit"]',
    'button[data-automation-id="submit"]',
    '#submit_app', '.postings-btn-submit', 'button.application-submit',
    'button[data-qa="btn-submit"]',
    'button[aria-label*="Submit" i]',
    '[data-testid="submit-application"]',
    'button.btn-submit', '#resumeSubmitForm',
    // Workday
    ...['btnSubmit', 'submitButton', 'bottom-navigation-submit-button', 'pageFooterSubmitButton']
        .map(id => `[data-automation-id="${id}"]`),
];

const NEXT_SELECTORS = [
    'button[data-automation-id="bottom-navigation-next-button"]',
    'button[data-automation-id="next-button"]',
    'button[data-automation-id="pageFooterNextButton"]',
    'button[aria-label*="Next" i]', 'button[aria-label*="Continue" i]',
    '[data-testid="next-step"]', '[data-testid="continue"]',
];

export type NavAction = 'submitted' | 'next_page' | false;

/**
 * Find and click the submit button. Returns 'submitted' | 'next_page' | false.
 * Only clicks submit if all required fields are filled (missingCount === 0).
 */
export async function tryClickSubmitOrNext(missingRequiredCount: number): Promise<NavAction> {
    // ── Submit (only if no missing required fields) ──
    if (missingRequiredCount === 0) {
        for (const sel of SUBMIT_SELECTORS) {
            const btn = document.querySelector<HTMLElement>(sel);
            if (btn && isVisible(btn)) {
                await sleep(500);
                realClick(btn);
                return 'submitted';
            }
        }
        // Fallback: button by text
        const btns = Array.from(document.querySelectorAll<HTMLElement>('button,a[role="button"],input[type="submit"]')).filter(isVisible);
        const submitBtn = btns.find(b => {
            const t = (b.textContent || (b as HTMLInputElement).value || '').trim().toLowerCase();
            return /^(submit|apply|send|complete|finish)\b/i.test(t) && !/cancel|back|prev|close/i.test(t);
        });
        if (submitBtn) {
            await sleep(500);
            realClick(submitBtn);
            return 'submitted';
        }
    }

    // ── Next / Continue ──
    for (const sel of NEXT_SELECTORS) {
        const btn = document.querySelector<HTMLElement>(sel);
        if (btn && isVisible(btn)) {
            await sleep(500);
            realClick(btn);
            return 'next_page';
        }
    }
    // Fallback: text match
    const allBtns = Array.from(document.querySelectorAll<HTMLElement>('button,a[role="button"]')).filter(isVisible);
    const nextBtn = allBtns.find(b => {
        const t = (b.textContent || (b as HTMLInputElement).value || '').trim().toLowerCase();
        return /^(next|continue|proceed|save.*continue|review)\b/i.test(t) && !/cancel|back|prev|close/i.test(t);
    });
    if (nextBtn) {
        await sleep(500);
        realClick(nextBtn);
        return 'next_page';
    }

    // Last resort: if all fields filled, try any submit-like button
    if (missingRequiredCount === 0) {
        const lastResort = allBtns.find(b => {
            const t = (b.textContent || (b as HTMLInputElement).value || '').trim().toLowerCase();
            return /submit|apply|send|go|done/i.test(t) && !/cancel|back|close/i.test(t);
        });
        if (lastResort) {
            await sleep(500);
            realClick(lastResort);
            return 'submitted';
        }
    }
    return false;
}

// ─── Success Detection ──────────────────────────────────────────
const SUCCESS_URL_PATTERNS = [
    '/thanks', '/thank-you', '/success', '/confirmation',
    '/complete', '/submitted', '/application-submitted',
    '/applied', '/done', '/thank_you',
];

const SUCCESS_TEXT_PATTERNS = /application submitted|thank you for applying|application received|we.ve received your|your application has been|successfully submitted|application complete|thanks for applying|we have received|application was submitted/i;

const ALREADY_APPLIED_PATTERNS = /already applied|already submitted|you.ve applied|you have already|previously applied|duplicate application/i;

/** Get page text excluding extension-injected elements. */
function getPageTextClean(): string {
    const exclusions = '#ua-control-bar,#ua-suggestion-overlay,#ua-overlay-host,[data-oh-patch]';
    const mainContent = document.querySelectorAll<HTMLElement>(
        'main, article, form, [role="main"], .content, .application, #content, #main, #app'
    );
    let text = '';
    if (mainContent.length > 0) {
        mainContent.forEach(el => {
            const clone = el.cloneNode(true) as HTMLElement;
            clone.querySelectorAll(exclusions).forEach(x => x.remove());
            text += ' ' + clone.textContent;
        });
    } else {
        const clone = document.body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(exclusions).forEach(x => x.remove());
        text = clone.textContent || '';
    }
    return text.toLowerCase();
}

export type SuccessResult = 'success' | 'duplicate' | 'none';

/** Check if the page indicates a successful application submission. */
export function detectSuccess(initialUrl: string, submitClickedTs: number): SuccessResult {
    const href = location.href.toLowerCase();

    // URL-based detection (most reliable)
    if (SUCCESS_URL_PATTERNS.some(p => href.includes(p))) return 'success';

    // ATS-specific confirmation elements
    if (document.querySelector('#application_confirmation,.application-confirmation,.confirmation-text')) return 'success';
    if (document.querySelector('.posting-confirmation,.application-confirmation')) return 'success';
    if (document.querySelector('[data-automation-id="congratulationsMessage"],[data-automation-id="confirmationMessage"]')) return 'success';

    // Text-based detection
    const body = getPageTextClean();
    if (SUCCESS_TEXT_PATTERNS.test(body)) return 'success';

    // URL changed after submit
    if (submitClickedTs > 0 && location.href !== initialUrl && (Date.now() - submitClickedTs > 2000)) {
        const newPath = location.pathname.toLowerCase();
        if (!/\/apply|\/step|\/page\d|\/form/i.test(newPath)) return 'success';
    }

    // Already applied
    if (ALREADY_APPLIED_PATTERNS.test(body)) return 'duplicate';

    return 'none';
}

// ─── Deduplication via appliedJobs ───────────────────────────────
function normalizeUrl(url: string): string {
    try {
        const u = new URL(url);
        ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'referer', 'source', 'fbclid']
            .forEach(p => u.searchParams.delete(p));
        return u.origin + u.pathname;
    } catch { return url; }
}

export async function markApplied(): Promise<void> {
    const norm = normalizeUrl(location.href);
    const { appliedJobs = [] } = await chrome.storage.local.get('appliedJobs');
    if (!appliedJobs.includes(norm)) {
        appliedJobs.push(norm);
        if (appliedJobs.length > 15_000) appliedJobs.shift();
        await chrome.storage.local.set({ appliedJobs });
    }
}

export async function isAlreadyApplied(url: string): Promise<boolean> {
    const { appliedJobs = [] } = await chrome.storage.local.get('appliedJobs');
    return appliedJobs.includes(normalizeUrl(url));
}
