/**
 * Captcha Solver – handles simple captcha scenarios.
 * Ported from OptimHire patch.
 */
import { nativeSet, realClick, getFieldLabel } from '../fieldMatcher/smartGuesser';

const LOG = (...a: unknown[]) => console.log('[UA-Captcha]', ...a);

/** Attempt to solve simple captcha types. */
export async function solveCaptcha(): Promise<void> {
    // reCAPTCHA checkbox inside iframe
    document.querySelectorAll<HTMLIFrameElement>('iframe[src*="recaptcha"],iframe[src*="hcaptcha"]').forEach(f => {
        try {
            const cb = f.contentDocument?.querySelector<HTMLElement>('.recaptcha-checkbox,#recaptcha-anchor');
            if (cb && !cb.classList.contains('recaptcha-checkbox-checked')) realClick(cb);
        } catch { /* cross-origin blocked */ }
    });

    // Math captchas
    document.querySelectorAll<HTMLInputElement>('[class*="captcha"] input,[id*="captcha"] input,input[name*="captcha"]').forEach(inp => {
        const lbl = getFieldLabel(inp);
        const m = lbl.match(/(\d+)\s*([\+\-\*x×÷\/])\s*(\d+)/);
        if (!m) return;
        const [, a, op, b] = m;
        const n1 = +a, n2 = +b;
        const ops: Record<string, number | null> = {
            '+': n1 + n2, '-': n1 - n2, '*': n1 * n2, 'x': n1 * n2,
            '×': n1 * n2, '/': n2 ? Math.round(n1 / n2) : null, '÷': n2 ? Math.round(n1 / n2) : null,
        };
        const result = ops[op];
        if (result !== null && result !== undefined) {
            nativeSet(inp, String(result));
            LOG('Math captcha solved:', lbl, '=', result);
        }
    });

    // "I'm not a robot" checkboxes
    document.querySelectorAll<HTMLInputElement>('input[type=checkbox][id*="captcha"],input[type=checkbox][name*="captcha"]')
        .forEach(cb => { if (!cb.checked) realClick(cb); });
}

/**
 * Watch for captcha elements via MutationObserver and auto-solve.
 */
export function watchForCaptchas(): void {
    const observer = new MutationObserver(() => solveCaptcha());
    observer.observe(document.body, { childList: true, subtree: true });
    solveCaptcha();
}
