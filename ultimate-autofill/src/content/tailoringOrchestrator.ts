/**
 * Tailoring Orchestrator – automates the Jobright sidebar tailoring workflow.
 * Flow: ATS detected → Generate Custom Resume → Improve My Resume → Full Edit
 *       → Select all skills → Generate My New Resume → Continue to Autofill
 */

const LOG = (...a: unknown[]) => console.log('[UA-Tailor]', ...a);
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── DOM helpers ─────────────────────────────────────────────────

function isVisible(el: HTMLElement): boolean {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
}

function realClick(el: HTMLElement): void {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.click();
}

/** Find a visible button/link by text pattern across the entire page */
function findButtonByText(pattern: RegExp, scope: ParentNode = document): HTMLElement | null {
    const candidates = Array.from(scope.querySelectorAll<HTMLElement>(
        'button, a, [role="button"], div[class*="btn"], span[class*="btn"]'
    ));
    return candidates.find(el => isVisible(el) && pattern.test((el.textContent || '').trim())) || null;
}

/** Wait for a button matching a pattern to appear on screen */
async function waitForButton(pattern: RegExp, timeoutMs: number = 60_000): Promise<HTMLElement | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const btn = findButtonByText(pattern);
        if (btn) return btn;
        await sleep(1000);
    }
    return null;
}

/** Wait for an element matching a selector to appear */
async function waitForSelector(sel: string, timeoutMs: number = 30_000): Promise<HTMLElement | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && isVisible(el)) return el;
        await sleep(500);
    }
    return null;
}

// ─── Jobright Sidebar Detection ──────────────────────────────────

/** Check if the Jobright sidebar/extension is present on the page */
export function detectJobrightSidebar(): HTMLElement | null {
    // The Jobright sidebar injects its UI into the page.
    // It may be in the regular DOM or inside a shadow root.
    // Try multiple known selectors:
    const selectors = [
        '#jobright-sidebar',
        '[class*="jobright"]',
        '[data-jobright]',
        '[id*="jobright"]',
        // The sidebar may also use a container with specific classes
        '.jr-sidebar',
        '#jr-extension-root',
    ];
    for (const s of selectors) {
        const el = document.querySelector<HTMLElement>(s);
        if (el) return el;
    }

    // Check for Jobright iframe
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
        const src = iframe.src || '';
        if (/jobright/i.test(src)) return iframe as HTMLElement;
    }

    return null;
}

/** Check if the tailoring UI is available (Generate Custom Resume, etc.) */
export function isTailoringAvailable(): boolean {
    // Look for tailoring-related buttons/text anywhere on the page
    return !!(
        findButtonByText(/generate.*custom.*resume|tailor.*resume|improve.*resume/i) ||
        findButtonByText(/continue.*auto\s*fill/i) ||
        document.querySelector('[class*="tailor"],[class*="resume-tailor"],[data-testid*="tailor"]')
    );
}

// ─── Tailoring Flow Steps ────────────────────────────────────────

/**
 * Run the complete Jobright tailoring workflow:
 * 1. Click "Generate Custom Resume" (or trigger tailoring)
 * 2. Wait for "Improve My Resume for This Job" → click
 * 3. Select "Full Edit" → click
 * 4. Click "Select all" for skill keywords
 * 5. Click "Generate My New Resume"
 * 6. Wait for generation to complete
 * 7. Click "Continue to Autofill"
 *
 * Returns true if tailoring was completed successfully, false if skipped/failed.
 */
export async function runTailoringSteps(): Promise<boolean> {
    LOG('Starting tailoring workflow...');

    // Step 1: Look for "Generate Custom Resume" or similar tailoring trigger
    let genBtn = findButtonByText(/generate.*custom.*resume|generate.*resume|tailor.*resume/i);
    if (!genBtn) {
        // Also check the Jobright Autofill button text for a tailoring trigger
        genBtn = findButtonByText(/autofill|auto\s*fill/i);
        if (genBtn) {
            LOG('Found Autofill button — clicking to start');
            realClick(genBtn);
            await sleep(2000);
            // After clicking autofill, the tailoring UI may appear
            genBtn = findButtonByText(/generate.*custom.*resume|generate.*resume|tailor/i);
        }
    }

    if (genBtn) {
        LOG('Step 1: Clicking Generate Custom Resume');
        realClick(genBtn);
        await sleep(3000);
    } else {
        LOG('No tailoring trigger found — checking if already in tailoring flow');
    }

    // Step 2: Wait for and click "Improve My Resume for This Job"
    const improveBtn = await waitForButton(/improve.*resume.*this.*job|improve.*my.*resume/i, 30_000);
    if (improveBtn) {
        LOG('Step 2: Clicking Improve My Resume');
        realClick(improveBtn);
        await sleep(2000);
    } else {
        LOG('Step 2: No "Improve My Resume" button found — continuing');
    }

    // Step 3: Select "Full Edit" option
    const fullEditBtn = await waitForButton(/full.*edit|all.*experiences/i, 15_000);
    if (fullEditBtn) {
        LOG('Step 3: Selecting Full Edit');
        realClick(fullEditBtn);
        await sleep(2000);
    } else {
        LOG('Step 3: No Full Edit option — continuing');
    }

    // Step 4: Click "Select all" for skill keywords
    const selectAllBtn = await waitForButton(/select\s*(all|everything)/i, 15_000);
    if (selectAllBtn) {
        LOG('Step 4: Clicking Select All for skills');
        realClick(selectAllBtn);
        await sleep(1000);
    } else {
        // Try clicking individual skill checkboxes
        const skillChecks = Array.from(document.querySelectorAll<HTMLInputElement>(
            'input[type="checkbox"]:not(:checked)'
        )).filter(cb => {
            const container = cb.closest('[class*="skill"],[class*="keyword"]');
            return container && isVisible(cb);
        });
        if (skillChecks.length > 0) {
            LOG(`Step 4: Clicking ${skillChecks.length} individual skill checkboxes`);
            for (const cb of skillChecks) {
                realClick(cb);
                await sleep(100);
            }
        } else {
            LOG('Step 4: No skill checkboxes found — continuing');
        }
    }

    // Step 5: Click "Generate My New Resume"
    const generateBtn = await waitForButton(/generate.*new.*resume|generate.*resume|create.*resume/i, 15_000);
    if (generateBtn) {
        LOG('Step 5: Clicking Generate My New Resume');
        realClick(generateBtn);
        // Wait for generation to complete (this can take 10-60s)
        LOG('Step 5: Waiting for resume generation...');
        await waitForGenerationComplete(120_000);
    } else {
        LOG('Step 5: No Generate button found — continuing');
    }

    // Step 6: Click "Continue to Autofill"
    const continueBtn = await waitForButton(/continue.*auto\s*fill|continue.*to.*auto/i, 60_000);
    if (continueBtn) {
        LOG('Step 6: Clicking Continue to Autofill');
        realClick(continueBtn);
        await sleep(2000);
        LOG('Tailoring workflow complete!');
        return true;
    }

    // Fallback: look for "Download Resume" as an indicator tailoring is done
    const downloadBtn = findButtonByText(/download.*resume/i);
    if (downloadBtn) {
        LOG('Step 6: Resume generated (Download available) — looking for Continue');
        // One more try for Continue to Autofill
        await sleep(3000);
        const retry = findButtonByText(/continue.*auto\s*fill|continue.*to.*auto/i);
        if (retry) {
            realClick(retry);
            await sleep(2000);
            return true;
        }
    }

    LOG('Tailoring workflow: could not complete all steps — proceeding to autofill anyway');
    return false;
}

/** Wait for resume generation to complete (loading indicator disappears) */
async function waitForGenerationComplete(timeoutMs: number): Promise<void> {
    const start = Date.now();
    let spinnerSeen = false;

    while (Date.now() - start < timeoutMs) {
        // Check for loading spinners / progress indicators
        const spinner = document.querySelector(
            '[class*="loading"],[class*="spinner"],[class*="progress"],[class*="generating"],' +
            '[role="progressbar"],.animate-spin,[class*="pulse"]'
        );
        const isLoading = spinner && isVisible(spinner as HTMLElement);

        if (isLoading) {
            spinnerSeen = true;
        } else if (spinnerSeen) {
            // Spinner was visible and now it's gone → generation complete
            LOG('Resume generation complete (spinner disappeared)');
            await sleep(1000); // Brief pause for UI to settle
            return;
        }

        // Also check if "Continue to Autofill" or "Download Resume" appeared
        if (findButtonByText(/continue.*auto\s*fill|download.*resume/i)) {
            LOG('Resume generation complete (action buttons appeared)');
            return;
        }

        await sleep(1000);
    }
    LOG('Resume generation: timeout reached');
}

/**
 * Wait for the tailoring to be complete, then click "Continue to Autofill"
 * and then click the Autofill button.
 */
export async function waitForTailoringAndTriggerAutofill(): Promise<boolean> {
    // First run all tailoring steps
    const tailored = await runTailoringSteps();

    // After tailoring, find and click the Autofill button
    await sleep(1500);
    const autofillBtn = findButtonByText(/^autofill$|^auto\s*fill$|start.*autofill/i);
    if (autofillBtn) {
        LOG('Clicking the Autofill button after tailoring');
        realClick(autofillBtn);
        await sleep(2000);
        return true;
    }

    return tailored;
}
