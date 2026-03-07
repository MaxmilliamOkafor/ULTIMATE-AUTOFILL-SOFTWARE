/**
 * Multi-Page Form Handler
 * Handles multi-step application forms (up to 10 pages).
 * On each page: fill fields → fallback fill → submit/next → detect success.
 */

import { fallbackFill, getMissingRequired } from './fallbackFiller';
import { checkSuccess, findNextButton, findSubmitButton } from './successDetector';
import { learnFromPage, loadProfile, type UserProfile } from '../answerBank/index';

const MAX_PAGES = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function realClick(el: HTMLElement): void {
  if (!el) return;
  el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  el.click();
}

export type PageAction = 'submitted' | 'next_page' | 'no_action';

/**
 * Attempt to submit the form or click next/continue.
 * Learns from filled fields before navigating.
 * Returns the action taken.
 */
export async function autoSubmitOrNext(doc: Document): Promise<PageAction> {
  // Learn from the filled page before navigating
  await learnFromPage(doc);

  const missing = getMissingRequired(doc);

  // If no required fields missing, try submit first
  if (missing.length === 0) {
    const submitBtn = findSubmitButton(doc);
    if (submitBtn) {
      await sleep(500);
      realClick(submitBtn);
      return 'submitted';
    }
  }

  // Try next/continue button
  const nextBtn = findNextButton(doc);
  if (nextBtn) {
    await sleep(500);
    realClick(nextBtn);
    return 'next_page';
  }

  // If there are required missing but we have a submit button, still try (form might validate)
  if (missing.length > 0) {
    const submitBtn = findSubmitButton(doc);
    if (submitBtn) {
      await sleep(500);
      realClick(submitBtn);
      return 'submitted';
    }
  }

  return 'no_action';
}

export interface MultiPageResult {
  pagesProcessed: number;
  success: boolean;
  finalAction: PageAction;
  totalFieldsFilled: number;
}

/**
 * Process a multi-page application form.
 * Fills and submits/advances through up to MAX_PAGES pages.
 *
 * @param doc - The document to process
 * @param fillPageFn - A function that fills the current page (primary autofill).
 *                     Called before fallback fill on each page.
 * @param profile - User profile for smart value guessing
 */
export async function multiPageLoop(
  doc: Document,
  fillPageFn: () => Promise<number>,
  profile?: UserProfile,
): Promise<MultiPageResult> {
  const userProfile = profile || await loadProfile();
  let totalFilled = 0;
  let finalAction: PageAction = 'no_action';

  for (let page = 1; page <= MAX_PAGES; page++) {
    // Check for success before processing
    if (checkSuccess(doc)) {
      return { pagesProcessed: page - 1, success: true, finalAction, totalFieldsFilled: totalFilled };
    }

    // Wait for page content to render
    await sleep(2000);

    // Primary autofill
    const primaryFilled = await fillPageFn();
    totalFilled += primaryFilled;

    // Fallback fill to catch missed fields
    await sleep(1000);
    const fallback1 = await fallbackFill(doc, userProfile);
    totalFilled += fallback1;

    // Second pass fallback (catches fields revealed by first pass)
    await sleep(500);
    const fallback2 = await fallbackFill(doc, userProfile);
    totalFilled += fallback2;

    // Submit or next
    const action = await autoSubmitOrNext(doc);
    finalAction = action;

    if (action === 'submitted') {
      await sleep(3000);
      const success = checkSuccess(doc);
      return { pagesProcessed: page, success, finalAction: action, totalFieldsFilled: totalFilled };
    } else if (action === 'next_page') {
      await sleep(3000);
      continue;
    } else {
      // No button found — try one more fallback + submit attempt
      await sleep(2000);
      const extra = await fallbackFill(doc, userProfile);
      totalFilled += extra;
      const retry = await autoSubmitOrNext(doc);
      finalAction = retry;
      if (retry !== 'no_action') {
        await sleep(3000);
        const success = retry === 'submitted' ? checkSuccess(doc) : false;
        return { pagesProcessed: page, success, finalAction: retry, totalFieldsFilled: totalFilled };
      }
      break;
    }
  }

  return { pagesProcessed: MAX_PAGES, success: false, finalAction, totalFieldsFilled: totalFilled };
}
