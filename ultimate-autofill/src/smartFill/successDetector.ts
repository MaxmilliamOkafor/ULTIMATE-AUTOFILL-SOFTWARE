/**
 * Application Success Detector
 * Multiple detection methods:
 * - URL pattern matching (thanks, confirmation, success pages)
 * - Page text analysis (thank you messages, confirmation text)
 * - DOM element detection (confirmation elements, Workday-specific markers)
 */

/**
 * Check if the current page indicates a successful application submission.
 */
export function checkSuccess(doc: Document): boolean {
  const href = (doc.location?.href || '').toLowerCase();

  // URL-based detection
  if (/\/thanks|\/thank.you|\/success|\/confirmation|\/submitted|\/done|\/complete/i.test(href)) {
    return true;
  }

  // Body text analysis
  const body = doc.body?.innerText || '';
  if (/application submitted|thank you for applying|application received|we.ve received your|successfully submitted|application complete|thanks for applying|your application has been|application was submitted/i.test(body)) {
    return true;
  }

  // DOM element detection
  const confirmationSelectors = [
    '#application_confirmation',
    '.application-confirmation',
    '.confirmation-text',
    '.posting-confirmation',
    '[data-automation-id="congratulationsMessage"]',
    '[data-automation-id="confirmationMessage"]',
    '.success-message',
    '.submission-confirmation',
    '[data-testid="application-success"]',
    '[data-testid="confirmation-page"]',
  ];

  for (const sel of confirmationSelectors) {
    if (doc.querySelector(sel)) return true;
  }

  return false;
}

/**
 * Find a "Next" or "Continue" button on a multi-step form.
 */
export function findNextButton(doc: Document): HTMLElement | null {
  const nextSelectors = [
    'button[data-automation-id="bottom-navigation-next-button"]',
    'button[data-automation-id="pageFooterNextButton"]',
    'button[data-automation-id="next-button"]',
    'button[aria-label*="Next" i]',
    'button[aria-label*="Continue" i]',
    '[data-testid="next-step"]',
    '[data-testid="continue"]',
    '.btn-next',
    '.next-button',
  ];

  for (const sel of nextSelectors) {
    const btn = doc.querySelector(sel) as HTMLElement;
    if (btn && btn.offsetParent !== null) return btn;
  }

  // Text-based fallback
  const allBtns = doc.querySelectorAll('button,a[role="button"]');
  for (const btn of allBtns) {
    const t = (btn.textContent || '').trim().toLowerCase();
    if (/^(next|continue|proceed|save.*continue|review)\b/i.test(t) &&
        !/cancel|back|prev|close/i.test(t) &&
        (btn as HTMLElement).offsetParent !== null) {
      return btn as HTMLElement;
    }
  }

  return null;
}

/**
 * Find a submit/apply button.
 */
export function findSubmitButton(doc: Document): HTMLElement | null {
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[data-automation-id="submit"]',
    'button[data-automation-id="submitButton"]',
    '#submit_app',
    '.postings-btn-submit',
    'button.application-submit',
    'button[data-qa="btn-submit"]',
    'button[aria-label*="Submit" i]',
    '[data-testid="submit-application"]',
    '[data-testid="submit-button"]',
    '[data-testid="apply-button"]',
    'button.btn-submit',
    'button[aria-label="Submit application"]',
    'button[aria-label="Apply"]',
  ];

  for (const sel of submitSelectors) {
    const btn = doc.querySelector(sel) as HTMLElement;
    if (btn && btn.offsetParent !== null) return btn;
  }

  // Text-based fallback
  const allBtns = doc.querySelectorAll('button,a[role="button"],input[type="submit"]');
  for (const btn of allBtns) {
    const t = ((btn as HTMLElement).textContent || (btn as HTMLInputElement).value || '').trim().toLowerCase();
    if (/^(submit|apply|send|complete|finish)\b/i.test(t) &&
        !/cancel|back|prev|close/i.test(t) &&
        (btn as HTMLElement).offsetParent !== null) {
      return btn as HTMLElement;
    }
  }

  return null;
}
