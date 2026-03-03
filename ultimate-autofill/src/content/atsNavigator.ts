/**
 * ATS Navigator – platform-specific navigation handlers.
 * Clicks through Apply buttons, redirects, and modals before the autofill can run.
 * Ported from OptimHire patch.
 */

import type { ATSType } from '../types/index';

const LOG = (...a: unknown[]) => console.log('[UA-Nav]', ...a);
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const $$ = <T extends Element>(s: string, c: ParentNode = document): T[] => Array.from(c.querySelectorAll(s));

function isVisible(el: HTMLElement): boolean {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.offsetParent !== null;
}

function realClick(el: HTMLElement): void {
    if (!el) return;
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.click();
}

// ─── Indeed: "Apply on company site" navigation ──────────────────
export function handleIndeed(): void {
    if (!location.hostname.includes('indeed.com')) return;
    const click = () => {
        const btn = $$<HTMLElement>('button,a').find(el =>
            /apply on company site|apply externally|apply now/i.test(el.textContent || '') ||
            el.getAttribute('data-testid') === 'company-site-apply-button'
        );
        if (btn && isVisible(btn)) { LOG('Indeed: clicking Apply on company site'); realClick(btn); }

        const confirm = $$<HTMLElement>('button').find(el =>
            /continue|proceed|yes|ok/i.test(el.textContent || '') &&
            !!el.closest('[class*="modal"],[class*="dialog"],[role="dialog"]')
        );
        if (confirm) realClick(confirm);
    };
    setTimeout(click, 1500);
    new MutationObserver(click).observe(document.body, { childList: true, subtree: true });
}

// ─── LinkedIn: Easy Apply + direct apply ─────────────────────────
export function handleLinkedIn(): void {
    if (!location.hostname.includes('linkedin.com')) return;
    if (!location.pathname.startsWith('/jobs')) return;

    let acting = false;
    const act = async () => {
        if (acting) return;
        acting = true;
        try {
            // Direct apply button (non-Easy Apply)
            const direct = $$<HTMLElement>('.jobs-apply-button,.apply-button,[data-control-name*="apply"]')
                .find(el => {
                    const t = (el.textContent || '').trim().toLowerCase();
                    return t.includes('apply') && !t.includes('easy');
                });
            if (direct && isVisible(direct)) { LOG('LinkedIn: direct apply'); realClick(direct); return; }

            // Easy Apply button
            const easy = $$<HTMLElement>('.jobs-apply-button,[aria-label*="Easy Apply"]')
                .find(el => /easy apply/i.test(el.textContent || ''));
            if (easy && isVisible(easy)) {
                LOG('LinkedIn: Easy Apply');
                realClick(easy);
                await sleep(1500);
            }
        } finally {
            setTimeout(() => { acting = false; }, 3000);
        }
    };

    setTimeout(act, 2000);
    new MutationObserver(act).observe(document.body, { childList: true, subtree: false });
}

// ─── HiringCafe: "Apply Directly" + company-size filter ──────────
const GOOD_SIZES = [
    '51-200', '201-500', '501-1000', '501-1,000', '1001-2000', '1,001-2,000',
    '2001-5000', '2,001-5,000', '5001-10000', '5,001-10,000', '10001+', '10,001+',
    '51 to 200', '201 to 500', '501 to 1000',
];

export function handleHiringCafe(): void {
    if (!location.hostname.includes('hiring.cafe')) return;

    const sizeEl = $$<HTMLElement>('[class*="size"],[class*="employees"],[data-field*="size"]')
        .find(el => /\d/.test(el.textContent || ''));
    if (sizeEl) {
        const txt = (sizeEl.textContent || '').replace(/\s/g, '');
        const ok = GOOD_SIZES.some(s => txt.includes(s.replace(/\s/g, '')));
        if (!ok) {
            LOG('HiringCafe: company size not preferred — skipping');
            try { chrome.runtime.sendMessage({ type: 'JOB_SKIPPED', reason: 'company_size' }).catch(() => { }); } catch { }
            return;
        }
    }

    const tryClick = () => {
        const btn = $$<HTMLElement>('a,button').find(el =>
            /apply directly|apply now|apply for this/i.test(el.textContent || '')
        );
        if (btn && isVisible(btn)) { LOG('HiringCafe: Apply Directly'); realClick(btn); }
    };
    setTimeout(tryClick, 2000);
    new MutationObserver(tryClick).observe(document.body, { childList: true, subtree: true });
}

// ─── Workday: Apply → Apply Manually button flow ─────────────────
let _wdApplyFlowDone = false;
export async function workdayApplyButtonFlow(): Promise<void> {
    if (_wdApplyFlowDone) return;
    const host = location.hostname.toLowerCase();
    if (!host.includes('myworkdayjobs.com') && !host.includes('workday.com')) return;

    // Step 1: Click the primary "Apply" button
    const applySelectors = [
        '[data-automation-id="applyButton"]',
        '[data-automation-id="jobAction-apply"]',
        'button[data-automation-id="applyBtn"]',
        'a[data-automation-id*="apply"]',
    ];
    let applyBtn: HTMLElement | null = null;
    for (const sel of applySelectors) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && isVisible(el)) { applyBtn = el; break; }
    }
    if (!applyBtn) {
        applyBtn = $$<HTMLElement>('button, a[role="button"], a').find(el => {
            if (!isVisible(el)) return false;
            const t = (el.textContent || '').trim().toLowerCase();
            return t === 'apply' || t === 'apply now';
        }) || null;
    }
    if (applyBtn) {
        LOG('Workday: Clicking Apply button');
        realClick(applyBtn);
        await sleep(2000);
    }

    // Step 2: Click "Apply Manually" if it appears
    const manualSelectors = [
        '[data-automation-id="applyManually"]',
        '[data-automation-id="applyManuallyButton"]',
        '[data-automation-id="manuallyApply"]',
    ];
    let manualBtn: HTMLElement | null = null;
    for (const sel of manualSelectors) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && isVisible(el)) { manualBtn = el; break; }
    }
    if (!manualBtn) {
        manualBtn = $$<HTMLElement>('button, a[role="button"], a').find(el => {
            if (!isVisible(el)) return false;
            const t = (el.textContent || '').trim().toLowerCase();
            return t.includes('apply manually') || t.includes('manual apply');
        }) || null;
    }
    if (manualBtn) {
        LOG('Workday: Clicking Apply Manually');
        realClick(manualBtn);
        await sleep(3000);
    }

    _wdApplyFlowDone = true;
}

// ─── Generic: Click visible Apply button on unknown career pages ─
export async function clickApplyButton(): Promise<boolean> {
    const applyPatterns = ['apply', 'apply now', 'apply directly', 'easy apply',
        'apply for this job', 'submit application', 'start application'];
    const candidates = $$<HTMLElement>('a, button, [role="button"], input[type="submit"]');
    for (const el of candidates) {
        if (!isVisible(el)) continue;
        const text = ((el.textContent || (el as HTMLInputElement).value || '')).trim().toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        const combined = text + ' ' + aria;
        if (applyPatterns.some(p => combined === p || combined.startsWith(p + ' ') || combined.includes(p))) {
            const r = el.getBoundingClientRect();
            if (r.width >= 40 && r.height >= 20) {
                LOG('Generic page: Clicking Apply button');
                realClick(el);
                await sleep(3000);
                return true;
            }
        }
    }
    return false;
}

// ─── Run platform-specific navigation ────────────────────────────
export async function runAtsNavigation(atsType: ATSType): Promise<void> {
    switch (atsType) {
        case 'indeed': handleIndeed(); break;
        case 'linkedin': handleLinkedIn(); break;
        case 'hiringcafe': handleHiringCafe(); break;
        case 'workday': await workdayApplyButtonFlow(); break;
        default:
            // For unknown ATS / generic pages, try clicking an Apply button
            if (atsType === 'generic') await clickApplyButton();
            break;
    }
}
