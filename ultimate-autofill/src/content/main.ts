/**
 * Content script - runs on every page.
 * Enhanced with: tailoring-first flow, auto-trigger on ATS detection, smart field guesser,
 * multi-page form handling, CSV queue integration, resume upload,
 * captcha solving, ATS-specific navigation, and missing dialog handling.
 */

import type { ExtMessage, FieldMatchResult, SavedResponse, ATSType } from '../types/index';
import { detectATS } from '../atsDetector/index';
import { getAdapter } from '../adapters/index';
import { matchFields } from '../fieldMatcher/index';
import {
  guessValue, normalizeProfile, loadProfile, getFieldLabel as smartGetLabel,
  isFieldRequired, hasFieldValue, nativeSet, isVisible, realClick,
  getResponseBank, guessFieldValue, NormalizedProfile,
  getMissingRequiredFields, reportFieldStatus, reportFieldFilled,
} from '../fieldMatcher/smartGuesser';
import { tryClickSubmitOrNext, detectSuccess, markApplied, NavAction } from './formNavigator';
import { tryResumeUpload } from './resumeUpload';
import { solveCaptcha, watchForCaptchas } from './captchaSolver';
import { runAtsNavigation } from './atsNavigator';
import { runTailoringSteps, isTailoringAvailable, detectJobrightSidebar } from './tailoringOrchestrator';

const LOG = (...a: unknown[]) => console.log('[UA]', ...a);
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const $$ = <T extends Element>(s: string): T[] => Array.from(document.querySelectorAll(s));

let isRunning = false;
let observer: MutationObserver | null = null;
let _autoTriggered = false;
let _autoTriggerRunning = false;

// ─── Message handling from background / popup ───
chrome.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
  if (msg.type === 'START_AUTOFILL') {
    startAutofill().then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === 'STOP_AUTOFILL') {
    stopAutofill();
    sendResponse({ ok: true });
  }
  if (msg.type === 'DETECT_ATS') {
    const result = detectATS(document);
    sendResponse(result);
  }
  // CSV queue / automation trigger
  if (msg.type === 'TRIGGER_AUTOFILL') {
    runFullAutofill().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  // OptimHire-compatible message: FILL_COMPLEX_FORM
  if (msg.type === 'FILL_COMPLEX_FORM') {
    runFullAutofill().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === 'TRIGGER_TAILORING') {
    runTailoringSteps().then(ok => sendResponse({ ok })).catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === 'PING') {
    sendResponse({ ready: true });
  }
  if (msg.type === 'SOLVE_CAPTCHA') {
    solveCaptcha().then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function send(msg: ExtMessage | Record<string, any>): Promise<any> {
  try { return await chrome.runtime.sendMessage(msg); } catch { return null; }
}

async function getResponses(): Promise<SavedResponse[]> {
  const domain = location.hostname;
  const r = await send({ type: 'GET_RESPONSES', payload: { domain } });
  return r?.data || [];
}

// ─── Original autofill (field-by-field with suggestions) ───
async function startAutofill() {
  if (isRunning) return;
  isRunning = true;
  showControlBar();

  const ats = detectATS(document);
  const adapter = getAdapter(ats.type);
  const responses = await getResponses();

  // Run ATS-specific navigation first (click Apply buttons, etc.)
  await runAtsNavigation(ats.type);

  // ATS-specific fill
  await atsSpecificFill(ats.type);

  // Initial fill with existing saved responses
  await fillPage(adapter, responses, ats.type);

  // Enhanced: also run the smart guesser for any remaining empty fields
  await enhancedFillPass();

  // Watch for dynamic changes
  observer = new MutationObserver(async (mutations) => {
    if (!isRunning) return;
    const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
    if (hasNewNodes) {
      await fillPage(adapter, responses, ats.type);
      await enhancedFillPass();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function stopAutofill() {
  isRunning = false;
  if (observer) { observer.disconnect(); observer = null; }
  removeControlBar();
}

async function fillPage(adapter: ReturnType<typeof getAdapter>, responses: SavedResponse[], atsType: ATSType) {
  const fields = adapter.getFields(document);
  const domain = location.hostname;
  const matches = matchFields(fields, responses, { domain, atsType });

  let filled = 0;
  for (const match of matches) {
    if (!isRunning) break;
    if (isAlreadyFilled(match.field)) continue;

    const ok = await adapter.fillField(match.field, match.response.response);
    if (ok) {
      filled++;
      match.field.classList.add('ua-filled');
      match.field.classList.add('ua-filled-flash');
      send({ type: 'RECORD_USAGE', payload: { id: match.response.id } });
      setTimeout(() => match.field.classList.remove('ua-filled-flash'), 600);
    }
  }
  updateControlBar(filled, matches.length);
}

// ─── ATS-Specific Fill (ported from OptimHire) ───

// Workday comprehensive field mapping
const WD_FIELDS: Record<string, string> = {
  legalNameSection_firstName: 'first_name', legalNameSection_lastName: 'last_name',
  legalNameSection_middleName: 'middle_name',
  infoFirstName: 'first_name', infoLastName: 'last_name',
  infoEmail: 'email', infoCellPhone: 'phone', infoLinkedIn: 'linkedin_profile_url',
  email: 'email', phone: 'phone',
  addressSection_addressLine1: 'address', addressSection_addressLine2: 'address2',
  addressSection_city: 'city', addressSection_postalCode: 'postal_code',
  workHistoryCompanyName: 'current_company', workHistoryPosition: 'current_title',
  educationHistoryName: 'school', degree: 'degree',
  linkedIn: 'linkedin_profile_url', website: 'website_url', github: 'github_url',
  jobTitle: 'current_title', company: 'current_company', school: 'school',
  major: 'major', postalCode: 'postal_code', city: 'city', state: 'state',
  country: 'country', yearsOfExperience: 'years_of_experience',
  salary: 'expected_salary', coverLetter: 'cover_letter', howDidYouHear: 'how_did_you_hear',
};

const WD_TEXTAREA_AIDS = new Set([
  'formField-roleDescription', 'formField-summary',
  'formField-coverLetter', 'formField-additionalInfo',
]);

async function atsSpecificFill(atsType: ATSType): Promise<void> {
  const host = location.hostname.toLowerCase();
  const profile = await loadProfile();

  if (atsType === 'workday' || host.includes('myworkdayjobs.com') || host.includes('workday.com')) {
    await workdayFill(profile);
  } else if (atsType === 'greenhouse' || host.includes('greenhouse.io')) {
    await greenhouseFill(profile);
  } else if (atsType === 'taleo' || host.includes('oraclecloud.com') || host.includes('taleo.net')) {
    await oracleFill(profile);
  } else if (atsType === 'smartrecruiters' || host.includes('smartrecruiters.com')) {
    await smartRecruitersFill(profile);
  }
}

async function workdayFill(p: NormalizedProfile): Promise<void> {
  LOG('Running Workday-specific fill');
  const responseEntries = await getResponseBank();

  // Account flow (create account / sign-in)
  await workdayAccountFlow(p);

  // Fill all data-automation-id fields
  const containers = $$<HTMLElement>('[data-automation-id]:not([data-automation-id=""])');
  for (const el of containers) {
    const aid = el.getAttribute('data-automation-id') || '';

    // Textarea fields
    if (WD_TEXTAREA_AIDS.has(aid)) {
      const ta = el.querySelector<HTMLTextAreaElement>('textarea') || (el.tagName === 'TEXTAREA' ? el as HTMLTextAreaElement : null);
      if (ta && !ta.value?.trim()) {
        const val = p.cover_letter || guessValue('cover letter', p);
        if (val) { ta.focus(); nativeSet(ta, val); }
      }
      continue;
    }

    const profileKey = WD_FIELDS[aid];
    if (!profileKey) continue;
    const val = p[profileKey];
    if (!val) continue;

    const input = el.querySelector<HTMLInputElement>('input:not([type=hidden]):not([type=file]),textarea');
    if (input && !input.value?.trim()) {
      input.focus(); nativeSet(input, val); await sleep(80);
      continue;
    }

    // Combobox handling
    const combo = el.querySelector<HTMLElement>('[role=combobox],[data-automation-id*="combobox"]');
    if (combo) {
      realClick(combo); await sleep(400);
      const si = combo.querySelector<HTMLInputElement>('input');
      if (si) { nativeSet(si, val); await sleep(700); }
      const opt = document.querySelector<HTMLElement>('[role=option]');
      if (opt) realClick(opt);
      continue;
    }

    // Radio buttons
    $$<HTMLInputElement>('input[type=radio]').forEach(r => {
      const t = (document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.textContent || '').toLowerCase();
      if (t.includes(val.toLowerCase())) realClick(r);
    });
  }

  // EEO fields
  await workdayEeoFields();

  // Agreement checkboxes
  $$<HTMLInputElement>('[data-automation-id="agreementCheckbox"] input[type=checkbox]')
    .filter(cb => !cb.checked).forEach(cb => realClick(cb));

  LOG('Workday fill done');
}

async function workdayAccountFlow(p: NormalizedProfile): Promise<void> {
  const { appAccountEmail, appAccountPassword } = await chrome.storage.local.get(['appAccountEmail', 'appAccountPassword']);
  const acctEmail = appAccountEmail || p.email || '';
  const acctPassword = appAccountPassword || '';

  // Create Account checkbox
  const createCb = document.querySelector<HTMLInputElement>(
    '[data-automation-id="createAccountCheckbox"] input[type=checkbox],input[data-automation-id="createAccountCheckbox"]'
  );
  if (createCb && !createCb.checked) { realClick(createCb); await sleep(600); }

  // Fill email
  const emailField = document.querySelector<HTMLInputElement>(
    '[data-automation-id="createAccountEmail"] input,[data-automation-id="accountCreationEmail"] input,input[data-automation-id="email"],input[name="email"][type="email"]'
  );
  if (emailField && !emailField.value?.trim() && acctEmail) {
    emailField.focus(); nativeSet(emailField, acctEmail); await sleep(200);
  }

  // Fill password
  if (acctPassword) {
    const pwFields = Array.from(document.querySelectorAll<HTMLInputElement>('input[type=password]')).filter(el => isVisible(el));
    for (const pw of pwFields) {
      if (!pw.value?.trim()) { pw.focus(); nativeSet(pw, acctPassword); await sleep(200); }
    }
  }

  // Click Create Account or Sign In
  const createBtn = document.querySelector<HTMLElement>('[data-automation-id="createAccountSubmitButton"]');
  if (createBtn && isVisible(createBtn)) { await sleep(400); realClick(createBtn); await sleep(1500); return; }
  const signInBtn = document.querySelector<HTMLElement>('[data-automation-id="signInSubmitButton"]');
  if (signInBtn && isVisible(signInBtn)) { await sleep(400); realClick(signInBtn); await sleep(1500); }
}

async function workdayEeoFields(): Promise<void> {
  const eeoSelectors: [string, RegExp][] = [
    ['[data-automation-id="gender"] select,select[data-automation-id="gender"]', /decline|prefer not|not to say/i],
    ['[data-automation-id="veteranStatus"] select,select[data-automation-id="veteranStatus"]', /not a protected|i am not|decline|prefer not/i],
    ['[data-automation-id="disability"] select,select[data-automation-id="disability"]', /do not have|decline|prefer not/i],
    ['[data-automation-id="ethnicityDropdown"] select,select[data-automation-id="ethnicityDropdown"]', /decline|prefer not|not to say/i],
  ];
  for (const [sel, pat] of eeoSelectors) {
    const el = document.querySelector<HTMLSelectElement>(sel);
    if (el && !el.value) {
      const opt = Array.from(el.options).find(o => pat.test(o.textContent || ''));
      if (opt) { el.value = opt.value; el.dispatchEvent(new Event('change', { bubbles: true })); }
    }
  }
}

async function greenhouseFill(p: NormalizedProfile): Promise<void> {
  LOG('Running Greenhouse-specific fill');
  const responseEntries = await getResponseBank();
  const GH_MAP: [string, string][] = [
    ['#first_name,input[id*="first_name"],input[name*="first_name"]', p.first_name || ''],
    ['#last_name,input[id*="last_name"],input[name*="last_name"]', p.last_name || ''],
    ['#email,input[type="email"],input[id*="email"]', p.email || ''],
    ['#phone,input[type="tel"],input[id*="phone"]', p.phone || ''],
    ['input[id*="location"],input[name*="location"]', p.city || ''],
    ['input[id*="linkedin"],input[name*="linkedin"]', p.linkedin_profile_url || ''],
    ['input[id*="website"],input[name*="website"],input[id*="portfolio"]', p.website_url || ''],
    ['input[id*="github"],input[name*="github"]', p.github_url || ''],
    ['textarea[id*="cover"],textarea[name*="cover"]', p.cover_letter || guessValue('cover letter', p)],
  ];
  for (const [sel, val] of GH_MAP) {
    if (!val) continue;
    const el = document.querySelector<HTMLInputElement>(sel);
    if (el && isVisible(el) && !el.value?.trim()) { el.focus(); nativeSet(el, val); await sleep(50); }
  }

  // EEO selects
  $$<HTMLSelectElement>('select[id*="gender"],select[id*="disability"],select[id*="veteran"],select[id*="race"],select[id*="ethnicity"]')
    .filter(sel => isVisible(sel) && !sel.value).forEach(sel => {
      const opt = Array.from(sel.options).find(o =>
        /decline|prefer not|not to say|not a protected|do not have/i.test(o.textContent || '')
      );
      if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  LOG('Greenhouse fill done');
}

async function oracleFill(p: NormalizedProfile): Promise<void> {
  LOG('Running Oracle/Taleo-specific fill');
  const fields: [string, string][] = [
    ['#firstName,input[id*="firstName"],input[name*="firstName"]', p.first_name || ''],
    ['#lastName,input[id*="lastName"],input[name*="lastName"]', p.last_name || ''],
    ['input[type="email"],input[id*="email"]', p.email || ''],
    ['input[type="tel"],input[id*="phone"],input[name*="phone"]', p.phone || ''],
    ['input[id*="city"],input[name*="city"]', p.city || ''],
    ['input[id*="zip"],input[name*="postal"]', p.postal_code || ''],
  ];
  for (const [sel, val] of fields) {
    if (!val) continue;
    const el = document.querySelector<HTMLInputElement>(sel);
    if (el && isVisible(el) && !el.value?.trim()) { el.focus(); nativeSet(el, val); await sleep(60); }
  }
  LOG('Oracle fill done');
}

async function smartRecruitersFill(p: NormalizedProfile): Promise<void> {
  LOG('Running SmartRecruiters-specific fill');
  const fields: [string, string][] = [
    ['input[name="first_name"],#firstName', p.first_name || ''],
    ['input[name="last_name"],#lastName', p.last_name || ''],
    ['input[name="email"],input[type="email"]', p.email || ''],
    ['input[name="phone"],input[type="tel"]', p.phone || ''],
    ['input[name="city"]', p.city || ''],
    ['input[name="web"],input[name="website"]', p.website_url || ''],
    ['textarea[name="message"],textarea[name="cover_letter"]', p.cover_letter || guessValue('cover letter', p)],
  ];
  for (const [sel, val] of fields) {
    if (!val) continue;
    const el = document.querySelector<HTMLInputElement>(sel);
    if (el && isVisible(el) && !el.value?.trim()) { el.focus(); nativeSet(el, val); await sleep(60); }
  }
  LOG('SmartRecruiters fill done');
}

// ─── Enhanced Fill Pass (Smart Guesser) ───
// Fills any remaining empty fields using the smart guesser profile + response bank
async function enhancedFillPass(): Promise<number> {
  const profile = await loadProfile();
  const responseEntries = await getResponseBank();
  let filled = 0;

  // Text inputs and textareas
  $$<HTMLInputElement | HTMLTextAreaElement>(
    'input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=checkbox]):not([type=radio]),textarea'
  ).forEach(el => {
    if (!isVisible(el) || hasFieldValue(el) || el.classList.contains('ua-filled')) return;
    const label = smartGetLabel(el);
    if (!label) return;
    const val = guessFieldValue(label, profile, el, responseEntries);
    if (val) {
      el.focus();
      nativeSet(el, val);
      el.classList.add('ua-filled');
      reportFieldFilled(label, 'filled');
      filled++;
    }
  });

  // Select dropdowns
  $$<HTMLSelectElement>('select').forEach(sel => {
    if (!isVisible(sel) || hasFieldValue(sel) || sel.classList.contains('ua-filled')) return;
    const label = smartGetLabel(sel);
    if (!label) return;
    const val = guessValue(label, profile);
    const opts = Array.from(sel.options);
    let match: HTMLOptionElement | undefined;

    if (val) {
      // Exact match first
      match = opts.find(o => (o.textContent || '').trim().toLowerCase() === val.toLowerCase());
      // Partial match
      if (!match) match = opts.find(o => (o.textContent || '').trim().toLowerCase().includes(val.toLowerCase()));
    }

    // EEO fallback: select "Prefer not to say" / "Decline"
    if (!match) {
      const l = label.toLowerCase();
      if (/gender|ethnic|race|veteran|disabil|sex\b|heritage/i.test(l)) {
        match = opts.find(o => /prefer not|decline|not (wish|want)|choose not|do not have|i am not/i.test(o.textContent || ''));
      }
    }

    // Last resort: pick the first valid option (non-placeholder)
    if (!match) {
      const validOpts = opts.filter(o => o.value && o.value !== '' && o.index > 0 &&
        !/select|choose|please|--/i.test((o.textContent || '').trim()));
      if (validOpts.length > 0 && isFieldRequired(sel)) {
        match = validOpts[0];
      }
    }

    if (match) {
      sel.value = match.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sel.classList.add('ua-filled');
      reportFieldFilled(label, 'filled');
      filled++;
    }
  });

  // Radio button groups
  const radioGroups = new Map<string, HTMLInputElement[]>();
  $$<HTMLInputElement>('input[type=radio]').forEach(r => {
    if (!isVisible(r)) return;
    const name = r.name;
    if (!name) return;
    if (!radioGroups.has(name)) radioGroups.set(name, []);
    radioGroups.get(name)!.push(r);
  });
  for (const [name, radios] of radioGroups) {
    if (radios.some(r => r.checked)) continue; // Already selected
    const label = smartGetLabel(radios[0]) || name;
    const val = guessValue(label, profile);
    let matched = false;

    if (val) {
      for (const radio of radios) {
        const radioLabel = (radio.closest('label')?.textContent ||
          document.querySelector(`label[for="${CSS.escape(radio.id)}"]`)?.textContent ||
          radio.value || '').trim().toLowerCase();
        if (radioLabel.includes(val.toLowerCase()) || (val.toLowerCase() === 'yes' && /yes|true|accept/i.test(radioLabel))) {
          realClick(radio);
          reportFieldFilled(label, 'filled');
          filled++;
          matched = true;
          break;
        }
      }
    }

    // Fallback: default to "Yes" for yes/no questions
    if (!matched) {
      const yesRadio = radios.find(r => {
        const t = (r.closest('label')?.textContent ||
          document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.textContent ||
          r.value || '').trim().toLowerCase();
        return ['yes', 'true', '1'].includes(t);
      });
      if (yesRadio) {
        realClick(yesRadio);
        reportFieldFilled(label, 'filled');
        filled++;
      }
    }
  }

  // Agreement checkboxes
  $$<HTMLInputElement>('input[type=checkbox]').forEach(cb => {
    if (cb.checked || !isVisible(cb)) return;
    const label = smartGetLabel(cb);
    if (/agree|acknowledge|certif|attest|confirm|consent|accept|terms|privacy/i.test(label)) {
      realClick(cb);
      reportFieldFilled(label, 'filled');
      filled++;
    }
  });

  // Required checkboxes that are still unchecked
  $$<HTMLInputElement>('input[type=checkbox][required],input[type=checkbox][aria-required="true"]')
    .filter(cb => isVisible(cb) && !cb.checked)
    .forEach(cb => { realClick(cb); filled++; });

  return filled;
}

// ─── Full Autofill (for CSV queue / auto-trigger) ───
// Runs the complete pipeline: tailoring → ATS fill → enhanced fill → resume upload → captcha → submit/next
async function runFullAutofill(): Promise<void> {
  LOG('Starting full autofill pipeline');
  const ats = detectATS(document);
  const adapter = getAdapter(ats.type);
  const responses = await getResponses();
  const initialUrl = location.href;
  let submitClickedTs = 0;
  let reported = false;

  const MAX_PAGES = 10;
  const checkAndReport = () => {
    if (reported) return;
    const result = detectSuccess(initialUrl, submitClickedTs);
    if (result === 'success') {
      reported = true;
      markApplied();
      send({ type: 'COMPLEX_FORM_SUCCESS', message: 'Application submitted successfully' } as any);
      LOG('Application submitted successfully!');
    } else if (result === 'duplicate') {
      reported = true;
      send({ type: 'COMPLEX_FORM_ERROR', errorType: 'alreadyApplied', message: 'Already applied to this job' } as any);
      LOG('Already applied to this job');
    }
  };

  // Watch for success via MutationObserver
  const successObserver = new MutationObserver(checkAndReport);
  successObserver.observe(document.body, { childList: true, subtree: true });
  const successInterval = setInterval(checkAndReport, 3000);
  checkAndReport(); // Initial check

  // Wait for page to settle
  await sleep(3000);

  // Notify sidebar
  send({ type: 'SIDEBAR_STATUS', event: 'filling_form', atsName: ats.type, url: location.href } as any);

  // Run ATS-specific navigation (click Apply buttons, etc.)
  await runAtsNavigation(ats.type);

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (reported) break;
    LOG(`── Page ${page}/${MAX_PAGES}: Filling fields ──`);

    // 1. ATS-specific fill
    await atsSpecificFill(ats.type);

    // 2. Standard adapter fill
    await fillPage(adapter, responses, ats.type);

    // 3. Enhanced fill (smart guesser for missed fields)
    await enhancedFillPass();

    // 4. Resume upload
    await tryResumeUpload();

    // 5. Captcha solving
    await solveCaptcha();

    // 6. Wait and retry for lazy-rendered fields
    await sleep(2000);
    if (reported) break;
    await enhancedFillPass();

    // 7. Count missing required fields
    const missingLabels = getMissingRequiredFields();
    const missingCount = missingLabels.length;

    // Report missing fields
    if (missingCount > 0) {
      LOG(`${missingCount} required fields still missing:`, missingLabels);
      missingLabels.forEach(n => reportFieldFilled(n, 'failed'));
    }

    // 8. Click submit or next
    await sleep(1000);
    if (reported) break;
    const action = await tryClickSubmitOrNext(missingCount);

    if (action === 'submitted') {
      LOG('Submit clicked — waiting for success confirmation');
      submitClickedTs = Date.now();
      for (let i = 0; i < 15; i++) {
        await sleep(1000);
        if (reported) break;
        checkAndReport();
      }
      if (!reported) {
        LOG('No success confirmation after 15s — reporting done (submit was clicked)');
        reported = true;
        markApplied();
        send({ type: 'COMPLEX_FORM_SUCCESS', message: 'Application submitted (submit clicked)' } as any);
      }
      break;
    } else if (action === 'next_page') {
      LOG('Next/Continue clicked — waiting for page transition');
      send({ type: 'SIDEBAR_STATUS', event: 'filling_form', atsName: ats.type, url: location.href, page: page + 1 } as any);
      await sleep(3000);
      continue; // Loop to fill next page
    } else {
      LOG('No submit/next button found — final fill attempt');
      await sleep(2000);
      await enhancedFillPass();
      const retry = await tryClickSubmitOrNext(0);
      if (retry === 'submitted') {
        submitClickedTs = Date.now();
        for (let i = 0; i < 10; i++) {
          await sleep(1000);
          if (reported) break;
          checkAndReport();
        }
        if (!reported) {
          reported = true;
          markApplied();
          send({ type: 'COMPLEX_FORM_SUCCESS', message: 'Application submitted (final attempt)' } as any);
        }
      }
      break;
    }
  }

  // Cleanup
  successObserver.disconnect();
  clearInterval(successInterval);
  LOG('Full autofill pipeline complete');
}

function countMissingRequired(): number {
  return getMissingRequiredFields().length;
}

// ─── Auto-Trigger on ATS Detection ───
// When the user lands on a supported ATS application page, manages tailoring-first flow.

async function autoTriggerAutofill(): Promise<void> {
  if (_autoTriggerRunning || _autoTriggered) return;

  // Check if auto-trigger is enabled
  const { ua_autoTrigger } = await chrome.storage.local.get('ua_autoTrigger');
  if (ua_autoTrigger === false) return;

  // Don't auto-trigger if CSV queue is managing this tab
  const { csvActiveJobId } = await chrome.storage.local.get('csvActiveJobId');
  if (csvActiveJobId) return;

  const ats = detectATS(document);
  if (ats.confidence < 0.3) return; // Not an ATS page

  // Check if this is actually an application form
  if (!isApplicationPage(ats.type)) {
    LOG(`Auto-trigger: ${ats.type} detected but no application form yet`);
    return;
  }

  _autoTriggerRunning = true;
  _autoTriggered = true;
  LOG(`Auto-trigger: ${ats.type} application form detected — starting pipeline`);

  showControlBar();
  updateControlBar(0, 0);
  const statusEl = document.getElementById('ua-fill-status');
  if (statusEl) statusEl.textContent = `${ats.type} detected — preparing...`;

  try {
    isRunning = true;

    // ─── TAILORING-FIRST FLOW ───
    // Check if Jobright sidebar is present and tailoring is available
    const sidebar = detectJobrightSidebar();
    if (sidebar || isTailoringAvailable()) {
      LOG('Auto-trigger: Jobright sidebar detected — running tailoring first');
      if (statusEl) statusEl.textContent = `${ats.type} detected — tailoring resume...`;
      send({ type: 'SIDEBAR_STATUS', event: 'tailoring_started', atsName: ats.type, url: location.href } as any);

      const tailored = await runTailoringSteps();
      LOG(`Auto-trigger: tailoring ${tailored ? 'completed' : 'skipped'}`);
      if (statusEl) statusEl.textContent = tailored ? 'Resume tailored — autofilling...' : 'Tailoring skipped — autofilling...';
      await sleep(1500);
    }

    // ─── Run ATS navigation (click Apply buttons, etc.) ───
    await runAtsNavigation(ats.type);

    // ─── ATS-specific fill ───
    await atsSpecificFill(ats.type);

    // ─── Standard fill pass ───
    const adapter = getAdapter(ats.type);
    const responses = await getResponses();
    await fillPage(adapter, responses, ats.type);
    await enhancedFillPass();
    await tryResumeUpload();
    await solveCaptcha();

    // Retry after 3s for lazy-rendering fields
    await sleep(3000);
    await enhancedFillPass();

    // ─── Auto-submit / next page ───
    const missingCount = countMissingRequired();
    if (missingCount === 0) {
      if (statusEl) statusEl.textContent = 'All fields filled — submitting...';
      await sleep(1000);
      const action = await tryClickSubmitOrNext(0);
      if (action === 'submitted') {
        if (statusEl) statusEl.textContent = 'Application submitted!';
        markApplied();
        send({ type: 'COMPLEX_FORM_SUCCESS', message: 'Application submitted' } as any);
      } else if (action === 'next_page') {
        if (statusEl) statusEl.textContent = 'Proceeding to next page...';
        // Reset auto-trigger for next page
        _autoTriggered = false;
        _autoTriggerRunning = false;
        await sleep(3000);
        autoTriggerAutofill(); // Re-run for next page
        return;
      } else {
        if (statusEl) statusEl.textContent = 'Autofill complete — review and submit';
      }
    } else {
      if (statusEl) statusEl.textContent = `Autofill complete (${missingCount} fields need review)`;
    }

    LOG('Auto-trigger: complete');
  } catch (err) {
    LOG('Auto-trigger: error', err);
  } finally {
    _autoTriggerRunning = false;
  }
}

function isApplicationPage(atsType: ATSType): boolean {
  const url = location.href.toLowerCase();
  const path = location.pathname.toLowerCase();

  // URL-based detection
  if (/\/apply|\/application|\/jobs\/\d|\/requisition/i.test(path)) return true;

  // ATS-specific
  if (atsType === 'workday') {
    return url.includes('/apply') || document.querySelectorAll('[data-automation-id]').length > 2;
  }
  if (atsType === 'greenhouse') {
    return !!document.querySelector('#application_form,form[action*="greenhouse"],[data-provided-by="greenhouse"]') ||
      location.hostname.includes('boards.greenhouse.io');
  }
  if (atsType === 'lever') {
    return !!document.querySelector('.posting-apply,.postings-form,.application-form') ||
      location.hostname.includes('jobs.lever.co');
  }
  if (atsType === 'icims') {
    return document.querySelectorAll('input:not([type=hidden])').length > 2;
  }
  if (atsType === 'smartrecruiters') {
    return url.includes('/apply') || document.querySelectorAll('input[name]').length > 2;
  }
  if (atsType === 'taleo') {
    return url.includes('/apply') || !!document.querySelector('#OracleFusionApp,oracle-apply-flow');
  }
  if (atsType === 'indeed') {
    return path.includes('/viewjob') || path.includes('/applystart') ||
      !!document.querySelector('#indeedApplyModal,.ia-container,[id*="indeedApply"]');
  }
  if (atsType === 'linkedin') {
    return path.includes('/jobs/view/') || path.includes('/jobs/collections/') ||
      !!document.querySelector('.jobs-easy-apply-modal,[data-test-modal],.jobs-apply-button');
  }
  if (atsType === 'hiringcafe') {
    return !!Array.from(document.querySelectorAll('a, button')).find(el =>
      /apply directly|apply now/i.test((el as HTMLElement).textContent || '') && isVisible(el as HTMLElement)
    );
  }
  if (atsType === 'ashby') {
    return path.includes('/application') || !!document.querySelector('[data-ashby-form]');
  }

  // Generic: check for Apply button or form with name/email inputs
  const hasApply = $$<HTMLElement>('a, button, [role="button"]').some(el => {
    const t = (el.textContent || '').trim().toLowerCase();
    return /^(apply|apply now|apply directly|easy apply)\b/.test(t) && isVisible(el);
  });
  if (hasApply) return true;

  const hasName = !!document.querySelector('input[name*="name" i],input[autocomplete="given-name"]');
  const hasEmail = !!document.querySelector('input[type="email"],input[name*="email" i],input[autocomplete="email"]');
  return hasName && hasEmail;
}

// ─── Missing Details Dialog Watcher ───
// Auto-fills "Add Missing Details" dialogs that appear as modals

let _dialogFillDebounce: ReturnType<typeof setTimeout> | null = null;
function watchMissingDetailsDialog(): void {
  new MutationObserver(async () => {
    if (_dialogFillDebounce) return;

    const dialog = Array.from(document.querySelectorAll<HTMLElement>(
      '[class*="missing"],[id*="missing"],[role="dialog"],[class*="modal"]'
    )).find(el =>
      isVisible(el) && /missing details|fill.*details|add.*details|fill.*form/i.test(el.textContent || '')
    );

    if (dialog) {
      _dialogFillDebounce = setTimeout(() => { _dialogFillDebounce = null; }, 3000);
      LOG('Missing details dialog detected — auto-filling');
      await sleep(300);
      await enhancedFillPass();
      await sleep(700);
      const btn = Array.from(dialog.querySelectorAll<HTMLElement>('button')).find(
        el => isVisible(el) && /save|submit|continue|done|next|confirm/i.test(el.textContent || '')
      );
      if (btn) realClick(btn);
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: false });
}

// ─── SPA Navigation Watcher ───
let _lastHref = location.href;
setInterval(() => {
  if (location.href !== _lastHref) {
    _lastHref = location.href;
    _autoTriggered = false;
    _autoTriggerRunning = false;
    sleep(2000).then(() => autoTriggerAutofill());
  }
}, 1000);

// ─── DOM Mutation Watcher for auto-trigger ───
let _mutationDebounce: ReturnType<typeof setTimeout> | null = null;
const _autoTriggerObserver = new MutationObserver(mutations => {
  if (_autoTriggered || _autoTriggerRunning) return;
  const added = mutations.reduce((n, m) => n + m.addedNodes.length, 0);
  if (added < 2) return;
  if (_mutationDebounce) clearTimeout(_mutationDebounce);
  _mutationDebounce = setTimeout(() => autoTriggerAutofill(), 1500);
});
if (document.body) {
  _autoTriggerObserver.observe(document.body, { childList: true, subtree: true });
}

// Initial auto-trigger after page load
sleep(2500).then(() => autoTriggerAutofill());

// Start watching for missing details dialogs
if (document.body) watchMissingDetailsDialog();

// ─── CSV Bridge Storage Listener (race-condition fallback) ───
let _csvBridgeStarted = false;
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || _csvBridgeStarted) return;
    const newJobId = changes.csvActiveJobId?.newValue;
    const newTabId = changes.csvActiveTabId?.newValue;
    if (newJobId && newTabId) {
      _csvBridgeStarted = true;
      LOG('CSV bridge: storage change detected — triggering autofill');
      await sleep(3000);
      runFullAutofill().catch(() => { });
    }
  });
}

// ─── DOM Mutation Fill Debounce (CSV mode) ───
let _csvFillDebounce: ReturnType<typeof setTimeout> | null = null;
if (typeof chrome !== 'undefined' && chrome.storage?.local) {
  new MutationObserver(async () => {
    try {
      const { csvActiveJobId } = await chrome.storage.local.get('csvActiveJobId');
      if (!csvActiveJobId) return;
      if (_csvFillDebounce) clearTimeout(_csvFillDebounce);
      _csvFillDebounce = setTimeout(async () => {
        await enhancedFillPass();
        await solveCaptcha();
      }, 800);
    } catch { }
  }).observe(document.body, { childList: true, subtree: false });
}

function isAlreadyFilled(el: HTMLElement): boolean {
  if (el.classList.contains('ua-filled')) return true;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value.trim().length > 0;
  }
  if (el instanceof HTMLSelectElement) {
    return el.selectedIndex > 0;
  }
  return false;
}

// ─── Control Bar (floating UI) ───

function showControlBar() {
  removeControlBar();
  const bar = document.createElement('div');
  bar.id = 'ua-control-bar';
  bar.className = 'ua-control-bar';
  bar.innerHTML = `
    <span class="ua-status">Ultimate Autofill</span>
    <span id="ua-fill-status" style="font-size:12px;color:#868e96;">Scanning...</span>
    <button class="ua-btn-stop" id="ua-btn-stop">Stop</button>
  `;
  document.body.appendChild(bar);
  bar.querySelector('#ua-btn-stop')?.addEventListener('click', () => {
    stopAutofill();
  });
}

function updateControlBar(filled: number, total: number) {
  const el = document.getElementById('ua-fill-status');
  if (el) el.textContent = `${filled}/${total} fields filled`;
}

function removeControlBar() {
  document.getElementById('ua-control-bar')?.remove();
}

// ─── Overlay for textarea / question suggestions ───

document.addEventListener('focusin', async (e) => {
  const el = e.target as HTMLElement;
  if (!isTextareaLike(el)) return;
  const label = getFieldLabel(el);
  if (!label) return;
  const r = await send({ type: 'GET_SUGGESTIONS', payload: { query: label, domain: location.hostname } });
  if (r?.ok && r.data?.length) {
    showSuggestionOverlay(el, r.data, label);
  }
}, true);

document.addEventListener('focusout', (e) => {
  setTimeout(() => {
    const overlay = document.getElementById('ua-suggestion-overlay');
    if (overlay && !overlay.matches(':hover')) overlay.remove();
  }, 200);
}, true);

function isTextareaLike(el: HTMLElement): boolean {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el.contentEditable === 'true') return true;
  if (el instanceof HTMLInputElement && el.type === 'text') {
    const label = getFieldLabel(el);
    if (label && label.length > 30) return true;
  }
  return false;
}

function getFieldLabel(el: HTMLElement): string | null {
  if (el.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl?.textContent?.trim()) return lbl.textContent.trim();
  }
  const wrap = el.closest('label');
  if (wrap?.textContent?.trim()) return wrap.textContent.trim();
  const al = el.getAttribute('aria-label');
  if (al?.trim()) return al.trim();
  const ph = (el as HTMLInputElement).placeholder;
  if (ph?.trim()) return ph.trim();
  return null;
}

function showSuggestionOverlay(target: HTMLElement, suggestions: any[], label: string) {
  document.getElementById('ua-suggestion-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'ua-suggestion-overlay';
  overlay.className = 'ua-overlay';

  const rect = target.getBoundingClientRect();
  overlay.style.top = `${rect.bottom + window.scrollY + 4}px`;
  overlay.style.left = `${rect.left + window.scrollX}px`;

  let html = `<div class="ua-overlay-header">
    <span>Suggestions for: ${escapeHtml(label.slice(0, 40))}</span>
    <button class="ua-overlay-close" id="ua-close-overlay">&times;</button>
  </div><div class="ua-suggestion-list">`;

  for (const s of suggestions) {
    const resp = s.response;
    const preview = resp.response.length > 120 ? resp.response.slice(0, 120) + '...' : resp.response;
    html += `<div class="ua-suggestion-item" data-response-id="${escapeHtml(resp.id)}">
      <div class="ua-suggestion-question">${escapeHtml(resp.question)}</div>
      <div class="ua-suggestion-response">${escapeHtml(preview)}</div>
      <div class="ua-suggestion-meta">Score: ${(s.score * 100).toFixed(0)}% | Used ${resp.appearances}x</div>
      <button class="ua-suggestion-insert" data-value="${escapeAttr(resp.response)}" data-id="${escapeHtml(resp.id)}">Insert</button>
    </div>`;
  }
  html += '</div>';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  overlay.querySelector('#ua-close-overlay')?.addEventListener('click', () => overlay.remove());
  overlay.querySelectorAll('.ua-suggestion-insert').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const value = (btn as HTMLElement).dataset.value || '';
      const id = (btn as HTMLElement).dataset.id || '';
      insertValue(target, value);
      send({ type: 'RECORD_USAGE', payload: { id } });
      overlay.remove();
    });
  });
}

function insertValue(el: HTMLElement, value: string) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
    )?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (el.contentEditable === 'true') {
    el.textContent = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  el.classList.add('ua-filled');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

LOG('v3.0 loaded — enhanced autofill with tailoring ready');
