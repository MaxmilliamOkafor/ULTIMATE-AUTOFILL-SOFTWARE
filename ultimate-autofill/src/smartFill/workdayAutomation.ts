/**
 * Workday-Specific Automation
 * Handles Workday's unique application flow:
 * - Clicks "Apply" button
 * - Clicks "Apply Manually" button
 * - Waits for form pages to load
 * - Integrates with multi-page handler
 */

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isVisible(el: HTMLElement): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && el.offsetParent !== null;
}

function realClick(el: HTMLElement): void {
  if (!el) return;
  el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  el.click();
}

function waitFor(doc: Document, selector: string, timeout: number, xpath = false): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const find = () => {
      if (xpath) {
        return doc.evaluate(selector, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
      }
      return doc.querySelector(selector) as HTMLElement;
    };

    const el = find();
    if (el) { resolve(el); return; }

    const observer = new MutationObserver(() => {
      const el = find();
      if (el) { observer.disconnect(); resolve(el); }
    });

    observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
  });
}

/**
 * Navigate through Workday's initial apply flow.
 * Returns true if we successfully reached the application form.
 */
export async function workdayNavigateToForm(doc: Document): Promise<boolean> {
  // Step 1: Click the "Apply" button
  const allBtns = doc.querySelectorAll('a, button');
  for (const b of allBtns) {
    if (/^\s*Apply\s*$/i.test(b.textContent || '') && isVisible(b as HTMLElement)) {
      realClick(b as HTMLElement);
      await sleep(2000);
      break;
    }
  }

  // Step 2: Click "Apply Manually" if present
  const applyManually = await waitFor(doc, "//*[@data-automation-id='applyManually']", 8000, true);
  if (applyManually) {
    await sleep(500);
    realClick(applyManually);
    await sleep(2000);
  }

  // Step 3: Wait for the form page to appear
  const formPageSelectors = [
    "[data-automation-id='quickApplyPage']",
    "[data-automation-id='applyFlowAutoFillPage']",
    "[data-automation-id='contactInformationPage']",
    "[data-automation-id='applyFlowMyInfoPage']",
    "[data-automation-id='ApplyFlowPage']",
  ].join(',');

  const formPage = await waitFor(doc, formPageSelectors, 10000);
  if (formPage) {
    await sleep(1000);
    return true;
  }

  return false;
}

/**
 * Check if the current page is a Workday application page.
 */
export function isWorkdayPage(url: string): boolean {
  return /myworkdayjobs\.com|myworkdaysite\.com|workday\.com\/.*\/job/i.test(url);
}
