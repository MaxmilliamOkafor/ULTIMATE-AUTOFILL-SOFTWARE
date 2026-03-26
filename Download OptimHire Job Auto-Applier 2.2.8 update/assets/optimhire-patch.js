/**
 * OptimHire Comprehensive Patch v4.4
 * Covers ALL 19 tasks — runs as a content script on every page
 *
 * T1  – ATS auto-detection + auto-trigger on supported domains
 * T2  – Credits locked at 9999 forever
 * T4  – Skip fires only AFTER confirmed submission
 * T5  – Indeed "Apply on company site" auto-navigation
 * T6  – LinkedIn Easy Apply + non-Easy Apply
 * T7  – Freshness badges (🔥 <30m · ✨ <24h · 📅 <3d)
 * T8  – Workday / OracleCloud / SmartRecruiters autofill (comprehensive)
 * T9  – Deduplication: never apply to same URL twice
 * T10 – HiringCafe "Apply Directly" + company-size filter
 * T11 – OracleCloud + SmartRecruiters ATS detection
 * T12 – Auto-solve reCAPTCHA checkbox + math captchas
 * T13 – Auto-fill ALL missing required fields from profile
 * T14 – Wake Lock (prevent PC sleep during automation) — NO AudioContext
 * T15 – Freshness sorting signal injected into job cards
 * T16 – Referral section permanently hidden
 * T17 – "Please fill missing details" stall prevention
 * T18 – "Add Missing Details" dialog auto-fill + auto-submit
 * T19 – CSV Auto-Apply bridge: signals completion to queue
 *
 * v4.4 fixes:
 *   - autoSkipSeconds capped at 5s via sendMessage intercept (update-proof)
 *   - getProfile() reads ALL storage keys: candidateDetails, cachedSeekerInfo,
 *     seekerDetails, userDetails — merges nested .seeker sub-objects and
 *     normalises email/phone/linkedin field name variants
 *   - guessValue() now accepts inputType arg; fills email/tel by type directly
 *   - "Preferred Name" now fills with full name (not LinkedIn URL)
 *   - Country default changed to Ireland
 *   - AudioContext fallback REMOVED (caused "not allowed to start" errors)
 *   - Workday: full SpeedyApply data-automation-id coverage
 *   - CSP-safe: no inline event handlers
 */
(function () {
  'use strict';

  /* ── Helpers ───────────────────────────────────────────── */
  const LOG = (...a) => console.log('[OH-Patch]', ...a);
  const ST  = chrome.storage.local;
  const $   = (s, c = document) => c.querySelector(s);
  const $$  = (s, c = document) => [...c.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /** React-compatible value setter */
  function nativeSet(el, val) {
    try {
      const proto = el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, val); else el.value = val;
    } catch (_) { el.value = val; }
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true }));
  }

  /** Real pointer-events click sequence */
  function realClick(el) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
    el.click();
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.offsetParent !== null;
  }

  /* ── T1: Supported ATS domains ─────────────────────────── */
  const ATS_DOMAINS = {
    'greenhouse.io':       'Greenhouse',
    'lever.co':            'Lever',
    'breezy.hr':           'BreezyHR',
    'myworkdayjobs.com':   'Workday',
    'workday.com':         'Workday',
    'icims.com':           'iCIMS',
    'taleo.net':           'Taleo',
    'oraclecloud.com':     'OracleCloud',
    'fa.oraclecloud.com':  'OracleCloud',
    'smartrecruiters.com': 'SmartRecruiters',
    'ashbyhq.com':         'Ashby',
    'bamboohr.com':        'BambooHR',
    'jobvite.com':         'Jobvite',
    'apply.workable.com':  'Workable',
    'paylocity.com':       'Paylocity',
    'jazzhr.com':          'JazzHR',
    'ziprecruiter.com':    'ZipRecruiter',
    'manatal.com':         'Manatal',
    'teamtailor.com':      'Teamtailor',
    'bullhorn.com':        'Bullhorn',
    'dice.com':            'Dice',
    'hiring.cafe':         'HiringCafe',
    'indeed.com':          'Indeed',
    'linkedin.com':        'LinkedIn',
    'jobs.lever.co':       'Lever',
    'boards.greenhouse.io':'Greenhouse',
    'apply.lever.co':      'Lever',
    'recruiting.ultipro.com': 'UKG',
    'jobs.smartrecruiters.com': 'SmartRecruiters',
    'careers.icims.com':   'iCIMS',
  };

  const HOST = location.hostname.toLowerCase().replace(/^www\./, '');
  const _rawATS = Object.entries(ATS_DOMAINS)
    .find(([domain]) => HOST.includes(domain))?.[1] || null;
  // LinkedIn: only activate on /jobs path — not on feeds, profiles, or messaging
  const CURRENT_ATS = _rawATS === 'LinkedIn'
    ? (location.pathname.startsWith('/jobs') ? 'LinkedIn' : null)
    : _rawATS;

  LOG(`Page: ${HOST} | ATS: ${CURRENT_ATS || 'unknown'}`);

  /* ── Auto-skip cap: patch any global OPTIMHIRE_CONFIG object ───────────
   * The autofill script (autofill.73df3a6d.js) exposes its config as a
   * module-internal object. We intercept chrome.runtime.sendMessage here
   * so any AUTO_APPLY_STATE_UPDATE with autoSkipSeconds > 5 is clamped.   */
  const AUTO_SKIP_MAX_SECONDS = 5;
  (function capAutoSkipOnSend() {
    const _orig = chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.runtime.sendMessage = function (msg, ...args) {
      try {
        if (msg && msg.type === 'AUTO_APPLY_STATE_UPDATE' &&
            typeof msg.autoSkipSeconds === 'number' &&
            msg.autoSkipSeconds > AUTO_SKIP_MAX_SECONDS) {
          msg = { ...msg, autoSkipSeconds: AUTO_SKIP_MAX_SECONDS };
        }
      } catch (_) {}
      return _orig(msg, ...args);
    };
  })();

  /* ── T2: Credits never run out ──────────────────────────── */
  const CREDIT_FIELDS = [
    'free_left_credits','leftCredits','remainingCredits',
    'credits','autofillCredits','plan_credits','totalCredits',
  ];

  function deepPatchCredits(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    CREDIT_FIELDS.forEach(f => { if (f in obj) obj[f] = 9999; });
    Object.keys(obj).forEach(k => {
      if (obj[k] && typeof obj[k] === 'object') obj[k] = deepPatchCredits(obj[k]);
    });
    return obj;
  }

  async function enforceCredits() {
    try {
      const keys = ['candidateDetails','userDetails','planDetails','subscriptionDetails'];
      const data = await ST.get(keys);
      const upd = {};
      keys.forEach(k => {
        if (!data[k]) return;
        try {
          const parsed = typeof data[k] === 'string' ? JSON.parse(data[k]) : data[k];
          const patched = deepPatchCredits(JSON.parse(JSON.stringify(parsed)));
          upd[k] = typeof data[k] === 'string' ? JSON.stringify(patched) : patched;
        } catch (_) {}
      });
      if (Object.keys(upd).length) await ST.set(upd);
    } catch (_) {
      // Extension context may have been invalidated (e.g. after reload) — ignore
    }
  }

  enforceCredits().catch(() => {});
  setInterval(() => enforceCredits().catch(() => {}), 20_000);

  /* Intercept storage reads to always return 9999 credits */
  const _origGet = chrome.storage.local.get.bind(chrome.storage.local);
  chrome.storage.local.get = function (keys, cb) {
    const patchResult = result => {
      Object.keys(result).forEach(k => {
        if (result[k] && typeof result[k] === 'object') {
          try {
            result[k] = deepPatchCredits(
              typeof result[k] === 'string'
                ? JSON.parse(result[k])
                : JSON.parse(JSON.stringify(result[k]))
            );
          } catch (_) {}
        }
      });
      return result;
    };
    if (typeof cb === 'function') {
      try {
        return _origGet(keys, result => cb(patchResult(result)));
      } catch (_) {
        // Extension context invalidated — return empty result
        try { cb({}); } catch (__) {}
        return;
      }
    }
    return _origGet(keys).then(patchResult).catch(() => ({}));
  };

  /* ── T14: Wake Lock — NO AudioContext (fixes "not allowed to start") ── */
  let _wakeLock = null;
  let _wakeLockInterval = null;

  async function acquireWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        _wakeLock = await navigator.wakeLock.request('screen');
        _wakeLock.addEventListener('release', () => setTimeout(acquireWakeLock, 1000));
        LOG('Wake lock acquired');
        return;
      } catch (_) {
        /* Fall through to mousemove fallback */
      }
    }
    /* Fallback: simulated mouse activity only — NO AudioContext */
    if (!_wakeLockInterval) {
      _wakeLockInterval = setInterval(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      }, 45_000);
      LOG('Wake lock fallback: mousemove interval started');
    }
  }

  chrome.runtime.onMessage.addListener(msg => {
    if (['start_pilot_web','START_AUTOMATION','pilot_started','CSV_JOB_START']
        .includes(msg?.type)) acquireWakeLock();
  });
  ST.get('isAutoProcessStartJob').then(d => {
    if (d?.isAutoProcessStartJob) acquireWakeLock();
  });

  /* ── T16: Hide referral section ─────────────────────────── */
  (function hideReferral() {
    const style = document.createElement('style');
    style.textContent = `
      [class*="referral"],[class*="Referral"],[id*="referral"],
      [data-testid*="referral"],[class*="affiliate"],
      [class*="earnCredit"],[class*="inviteFriend"],[class*="invite-friend"],
      [class*="ReferralScreen"]{display:none!important}
    `;
    document.head?.appendChild(style);
  })();

  /* ── Profile helper ─────────────────────────────────────── */
  async function getProfile() {
    const keys = ['candidateDetails', 'cachedSeekerInfo', 'seekerDetails', 'userDetails'];
    const data = await ST.get(keys);
    let merged = {};

    // Parse and merge all available profile sources
    for (const key of keys) {
      if (!data[key]) continue;
      try {
        const parsed = typeof data[key] === 'string' ? JSON.parse(data[key]) : data[key];
        if (parsed && typeof parsed === 'object') {
          Object.assign(merged, parsed);
          // Also flatten a nested .seeker sub-object
          if (parsed.seeker && typeof parsed.seeker === 'object') {
            Object.assign(merged, parsed.seeker);
          }
        }
      } catch (_) {}
    }

    // Normalise common field name variants so guessValue() always finds them
    const pick = (...keys) => { for (const k of keys) if (merged[k]) return merged[k]; return ''; };
    merged.email    = pick('email', 'email_address', 'emailAddress', 'Email');
    merged.phone    = pick('phone', 'phone_number', 'phoneNumber', 'mobile', 'cell', 'Phone');
    merged.first_name = pick('first_name', 'firstName', 'given_name', 'givenName');
    merged.last_name  = pick('last_name',  'lastName',  'family_name','familyName', 'surname');
    merged.linkedin_profile_url = pick('linkedin_profile_url','linkedin_url','linkedinUrl','linkedin','LinkedIn');
    merged.github_url    = pick('github_url', 'github', 'githubUrl', 'GitHub');
    merged.website_url   = pick('website_url', 'website', 'websiteUrl', 'portfolio', 'portfolioUrl', 'personal_website');
    merged.twitter_url   = pick('twitter_url', 'twitter', 'twitterUrl', 'x_url', 'x_handle');
    merged.stackoverflow_url = pick('stackoverflow_url', 'stackoverflow', 'stack_overflow', 'stackOverflow');
    merged.city        = pick('city', 'location_city', 'locationCity');
    merged.state       = pick('state', 'location_state', 'locationState');
    merged.country     = pick('country', 'location_country', 'locationCountry');
    merged.postal_code = pick('postal_code', 'zip', 'postalCode', 'zipCode');
    merged.street      = pick('street', 'street_address', 'address_line1', 'address1');
    merged.current_title   = pick('current_title', 'currentTitle', 'job_title', 'jobTitle', 'title', 'position');
    merged.current_company = pick('current_company', 'currentCompany', 'company', 'employer', 'organization');
    merged.expected_salary = pick('expected_salary', 'expectedSalary', 'desired_salary', 'salary');
    merged.years_experience = pick('years_experience', 'yearsExperience', 'years_of_experience', 'experience_years');
    merged.cover_letter    = pick('cover_letter', 'coverLetter', 'cover_letter_body');
    merged.summary         = pick('summary', 'bio', 'about', 'profile_summary', 'professional_summary');
    return merged;
  }

  /* ── Applications Account helper ────────────────────────── */
  async function getAppAccount() {
    const data = await ST.get(['appAccountEmail', 'appAccountPassword']);
    return {
      email:    data.appAccountEmail    || '',
      password: data.appAccountPassword || '',
    };
  }

  /* ── Field label extraction ──────────────────────────────── */
  function getLabel(el) {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) return lbl.textContent.trim();
    }
    if (el.placeholder) return el.placeholder;
    const container = el.closest(
      '.form-group,.field,.question,[class*="Field"],[class*="Question"],[class*="form-row"]'
    );
    if (container) {
      const lbl = container.querySelector('label,[class*="label"],[class*="Label"]');
      if (lbl && lbl !== el) return lbl.textContent.trim();
    }
    return el.name?.replace(/[_\-]/g, ' ') || '';
  }

  /* ── Smart value guesser ─────────────────────────────────── */
  const DEFAULTS = {
    authorized:   'Yes',
    sponsorship:  'No',
    relocation:   'Yes',
    remote:       'Yes',
    veteran:      'I am not a protected veteran',
    disability:   'I do not have a disability',
    gender:       'Prefer not to say',
    ethnicity:    'Prefer not to say',
    race:         'Prefer not to say',
    years:        '7',           // 7 years passes most "at least X years" knockout questions
    salary:       '80000',
    notice:       '2 weeks',
    availability: 'Immediately',
    cover: `I am excited to apply for this role. My background and skills make me an excellent candidate and I look forward to contributing to your team.`,
    why: 'I admire the company culture and the opportunity to make a meaningful impact.',
    howHeard: 'LinkedIn',
  };

  // Experience-related label patterns — used in both guessValue and select handling
  const EXP_LABEL_RE = /how.?many.?years|number.?of.?years|years.?of.?(professional\s+)?exp|years?.?(exp|experience|work(?:ing)?)|exp(?:erience)?.?in.?years|total.?years|years.?in.?(the\s+)?(?:field|industry|role|profession)|years.?with|years.?as|exp(?:erience)?.?(long|total|professional)|how.?long.?(have.?you|working)|professional.?exp|work.?exp|prior.?exp/i;

  function guessValue(label, p = {}, inputType = '') {
    const l = label.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    const fullName = `${p.first_name||''} ${p.last_name||''}`.trim();

    // Type-based direct fill (most reliable, survives label changes)
    if (inputType === 'email')  return p.email || '';
    if (inputType === 'tel')    return p.phone || '';
    if (inputType === 'number' && EXP_LABEL_RE.test(l))
                                return p.years_experience || DEFAULTS.years;

    if (/first.?name/.test(l))                            return p.first_name    || '';
    if (/last.?name/.test(l))                             return p.last_name     || '';
    if (/full.?name|your.?name/.test(l))                  return fullName;
    if (/preferred.?name|display.?name|nickname/.test(l)) return fullName;
    if (/\bemail\b/.test(l))                              return p.email         || '';
    if (/phone|mobile|cell/.test(l))                      return p.phone         || '';
    if (/^city$|city\b|current.?location|location.*city/.test(l))
                                                          return p.city          || 'Dublin';
    if (/state|province/.test(l))                         return p.state         || '';
    if (/zip|postal/.test(l))                             return p.postal_code   || p.zip || '';
    if (/^country/.test(l))                               return p.country       || 'Ireland';
    if (/address/.test(l))                                return p.address       || p.street || '';
    if (/linkedin/.test(l))                               return p.linkedin_profile_url || '';
    if (/github/.test(l))                                 return p.github_url    || '';
    if (/stack.*exchange|stackexchange|stack.*overflow|stackoverflow/.test(l))
                                                          return p.stackoverflow_url || '';
    if (/twitter|x\.com|x.?handle/.test(l))              return p.twitter_url   || '';
    if (/website|portfolio|personal.?site/.test(l))       return p.website_url   || '';
    if (/university|school|college|education/.test(l))    return p.school        || p.university || '';
    if (/\bdegree\b/.test(l))                             return p.degree        || "Bachelor's";
    if (/major|field.?of.?study/.test(l))                 return p.major         || '';
    if (/\bgpa\b/.test(l))                                return p.gpa           || '';
    if (/summary|bio|about yourself|profile.*summary|introduce/.test(l))
                                                          return p.summary       || DEFAULTS.cover;
    if (/current.?title|current.?position|current.?role|job.?title/.test(l))
                                                          return p.current_title || p.title || '';
    if (/title|position|role/.test(l))                    return p.current_title || p.title || '';
    if (/current.*company|most.*recent.*company|current.*employer|last.*company/.test(l))
                                                          return p.current_company || p.company || '';
    if (/previously.?work|worked.?before|work.?for.?before|prior.?employ/.test(l))
                                                          return 'No';
    if (/company|employer|current.*org/.test(l))          return p.current_company || p.company || '';
    if (/email.*future|job.*alert|receive.*update|notify.*me/.test(l)) return 'Yes';
    if (/salary|compensation|pay\b|remun|ctc|lpa/.test(l))
                                                          return p.expected_salary || DEFAULTS.salary;
    if (/cover.?letter|motivation|additional.*info|tell.?us.?more|anything.?else/.test(l))
                                                          return p.cover_letter  || DEFAULTS.cover;
    if (/why.*compan|why.*role|why.*interest|what.*excite|why.*apply/.test(l))
                                                          return DEFAULTS.why;
    if (/how.*hear|where.*find|how.*you.*find|how.*discover|referr.*source|source.*applic/.test(l))
                                                          return DEFAULTS.howHeard;

    // ── Experience ─────────────────────────────────────────────────────────
    // Any question asking for a number of years → return 7 (our default)
    // This covers text inputs, number inputs, and range dropdowns.
    // The select handler will convert this to the closest range option.
    if (EXP_LABEL_RE.test(l))                             return p.years_experience || DEFAULTS.years;

    if (/availab|start.?date|notice/.test(l))             return DEFAULTS.availability;
    if (/authoriz|eligible|work.*right|right.*work|legally.*work|permit.*work/.test(l))
                                                          return DEFAULTS.authorized;
    // Sponsorship patterns BEFORE the generic "do you" catch-all
    if (/require.*sponsor|need.*visa|visa.*sponsor|future.*visa|work.*visa|need.*permit/i.test(l))
                                                          return DEFAULTS.sponsorship;
    if (/will.*sponsor|currently.*sponsor|immigration.*support/.test(l))
                                                          return DEFAULTS.sponsorship;
    if (/relocat/.test(l))                                return DEFAULTS.relocation;
    if (/remote|work.*home|hybrid|onsite|in.?person/.test(l)) return DEFAULTS.remote;
    if (/veteran|military|protected/.test(l))             return DEFAULTS.veteran;
    if (/disabilit/.test(l))                              return DEFAULTS.disability;
    if (/gender|sex\b/.test(l))                           return DEFAULTS.gender;
    if (/ethnic|race|racial|hispanic|latino/.test(l))     return DEFAULTS.ethnicity;
    if (/driver.?s?.?licen|driving.?licen/.test(l))       return 'Yes';
    if (/certif|accredit/.test(l))                        return 'Yes';
    if (/agree|accept|confirm|consent/.test(l))           return 'Yes';
    if (/willing|happy|open\s+to|comfortable|able\s+to|prepared\s+to/.test(l))
                                                          return 'Yes';
    // Generic yes/no catch-all — only fires for truly unclassified questions.
    // Intentionally comes AFTER all specific negative-answer patterns above.
    if (/\bdo you\b|\bhave you\b|\bare you\b|\bcan you\b|\bwill you\b/.test(l))
                                                          return 'Yes';
    return '';
  }

  /* ── T13/T17: Auto-fill missing required fields ─────────── */

  /** Send field status updates to the sidebar via background relay */
  function reportFieldStatus(fields) {
    try {
      chrome.runtime.sendMessage({
        type: 'SIDEBAR_FIELD_LIST',
        fields: fields, // [{name, status:'filled'|'pending'|'failed', required:bool}]
      }).catch(() => {});
    } catch (_) {}
  }

  function reportFieldFilled(fieldName, status) {
    try {
      chrome.runtime.sendMessage({
        type: 'SIDEBAR_FIELD_UPDATE',
        fieldName: fieldName,
        status: status, // 'filled', 'pending', 'failed'
      }).catch(() => {});
    } catch (_) {}
  }

  /* ── URL_FIELDS: labels where a URL value is EXPECTED ───────── */
  const URL_FIELD_PATTERNS = /linkedin|github|website|portfolio|gitlab|bitbucket|stack.*overflow|stackoverflow|stackexchange|twitter|x\.com|behance|dribbble|codepen|devto|medium|personal.?site|blog|url|link/i;

  /**
   * isWrongUrlForField — returns true when a URL value was placed into a
   * field that should either have a different URL or no URL at all.
   *
   * Specific URL fields (linkedin, github, website, etc.) are allowed to have
   * URLs only when the URL MATCHES what the profile says for that field.
   * Any other URL → wrong fill.
   */
  function isWrongUrlForField(val, lbl, p) {
    if (!/^https?:\/\//i.test(val)) return false; // not a URL → not our problem
    const l = lbl.toLowerCase();

    // Non-URL fields that got a URL → definitely wrong
    if (!URL_FIELD_PATTERNS.test(l)) return true;

    // URL fields: verify the URL matches what we expect for that label
    if (/linkedin/i.test(l) && p.linkedin_profile_url && val !== p.linkedin_profile_url) return true;
    if (/github/i.test(l) && p.github_url && val !== p.github_url) return true;
    if (/website|portfolio/i.test(l) && p.website_url && val !== p.website_url) return true;
    if (/twitter|x\.com/i.test(l) && p.twitter_url && val !== p.twitter_url) return true;
    if (/stackoverflow|stackexchange/i.test(l) && p.stackoverflow_url && val !== p.stackoverflow_url) return true;

    return false;
  }

  /**
   * sanitizeBadFills — corrects OptimHire's tendency to spam the LinkedIn URL
   * into every empty field.  Designed to run multiple times (it's idempotent).
   */
  async function sanitizeBadFills() {
    const p = await getProfile();
    const inputs = $$(
      'input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=button]),' +
      'textarea'
    ).filter(isVisible);

    for (const inp of inputs) {
      const val = inp.value?.trim() || '';
      if (!val) continue;
      const lbl = getLabel(inp) || inp.name || inp.id || '';
      const inputType = (inp.type || '').toLowerCase();
      if (inputType === 'url') continue;

      if (isWrongUrlForField(val, lbl, p)) {
        const correct = guessValue(lbl, p, inputType);
        if (correct && !/^https?:\/\//i.test(correct)) {
          LOG(`sanitize: bad URL in "${lbl}" → "${correct}"`);
          inp.focus(); nativeSet(inp, correct); await sleep(40);
        } else if (!correct || /^https?:\/\//i.test(correct)) {
          // No text value available — clear the field so form validates cleanly
          LOG(`sanitize: clearing bad URL from "${lbl}"`);
          inp.focus(); nativeSet(inp, ''); await sleep(40);
        }
        continue;
      }

      // Fix raw numbers (e.g. "80000") in non-salary / non-experience fields
      if (/^\d+$/.test(val)) {
        // Leave numbers alone if the field expects a number (salary, years, quantity, age, etc.)
        if (/salary|compensation|pay\b|remun|expectation|ctc|lpa/i.test(lbl)) continue;
        if (EXP_LABEL_RE.test(lbl)) continue; // experience year fields
        if (inputType === 'number') continue;  // any <input type=number>
        const correct = guessValue(lbl, p, inputType);
        if (correct && correct !== val && !/^\d+$/.test(correct)) {
          inp.focus(); nativeSet(inp, correct); await sleep(40);
        } else if (!correct) {
          inp.focus(); nativeSet(inp, ''); await sleep(40);
        }
      }
    }

    // Fix select elements filled with wrong values (e.g. a URL in a yes/no dropdown)
    for (const sel of $$('select').filter(isVisible)) {
      const val = sel.value?.trim() || '';
      if (!val || !/^https?:\/\//i.test(val)) continue;
      const lbl = getLabel(sel) || sel.name || '';
      if (URL_FIELD_PATTERNS.test(lbl)) continue;
      LOG(`sanitize: clearing URL from select "${lbl}"`);
      sel.value = '';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /* ── Continuous sanitizer: re-runs after OptimHire fills post ours ──────
   * OptimHire's FILL_COMPLEX_FORM pipeline fills fields AFTER our pass.
   * We watch for input-value mutations and debounce a re-sanitize.        */
  let _sanitizeDebounce = null;
  function scheduleSanitize() {
    clearTimeout(_sanitizeDebounce);
    _sanitizeDebounce = setTimeout(() => sanitizeBadFills().catch(() => {}), 600);
  }

  // Watch for any programmatic value changes on the page
  (function installSanitizeWatcher() {
    try {
      const inputDesc   = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,   'value');
      const textaDesc   = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      if (inputDesc?.set) {
        Object.defineProperty(HTMLInputElement.prototype, 'value', {
          set(v) {
            inputDesc.set.call(this, v);
            if (typeof v === 'string' && /^https?:\/\//i.test(v)) scheduleSanitize();
          },
          get() { return inputDesc.get.call(this); },
          configurable: true,
        });
      }
      if (textaDesc?.set) {
        Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
          set(v) {
            textaDesc.set.call(this, v);
            if (typeof v === 'string' && /^https?:\/\//i.test(v)) scheduleSanitize();
          },
          get() { return textaDesc.get.call(this); },
          configurable: true,
        });
      }
    } catch (_) { /* CSP/sandbox may block — fall back to MutationObserver */ }
  })();

  /**
   * bestSelectOption — finds the best <option> in a <select> for a given value.
   * Uses: exact match → starts-with → contains → first non-empty.
   */
  function bestSelectOption(sel, target) {
    if (!target) return null;
    const t = target.toLowerCase();
    const opts = $$('option', sel).filter(o => o.value && o.value !== '');
    const exact   = opts.find(o => o.text.toLowerCase() === t);
    if (exact) return exact;
    const starts  = opts.find(o => o.text.toLowerCase().startsWith(t));
    if (starts) return starts;
    const contains = opts.find(o => o.text.toLowerCase().includes(t) || t.includes(o.text.toLowerCase()));
    return contains || null;
  }

  async function autoFillPage() {
    const p = await getProfile();
    const allFields = [];
    let filledCount = 0;

    /* ── Scan all visible form fields first to build field list ── */
    const allInputs = $$(
      'input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=button]),' +
      'textarea'
    ).filter(isVisible);
    const allSelects = $$('select').filter(isVisible);

    for (const el of allInputs) {
      const lbl = getLabel(el) || el.name || el.id || '';
      if (!lbl) continue;
      const isRequired = el.required || el.getAttribute('aria-required') === 'true';
      allFields.push({ name: lbl, status: el.value?.trim() ? 'filled' : 'pending', required: isRequired });
      if (el.value?.trim()) filledCount++;
    }
    for (const el of allSelects) {
      const lbl = getLabel(el) || el.name || el.id || '';
      if (!lbl) continue;
      const isRequired = el.required || el.getAttribute('aria-required') === 'true';
      allFields.push({ name: lbl, status: el.value ? 'filled' : 'pending', required: isRequired });
      if (el.value) filledCount++;
    }

    // Send initial field list to sidebar
    reportFieldStatus(allFields);
    // Send overall status
    try {
      chrome.runtime.sendMessage({
        type: 'SIDEBAR_STATUS',
        event: 'filling_progress',
        total: allFields.length,
        filled: filledCount,
        responses: Object.keys(p).length,
      }).catch(() => {});
    } catch (_) {}

    /* Inputs + textareas — only unfilled */
    const inputs = allInputs.filter(el => !el.value?.trim());

    for (const inp of inputs) {
      const lbl = getLabel(inp);
      const inputType = (inp.type || '').toLowerCase();
      if (!lbl && !inputType) continue;
      const val = guessValue(lbl || '', p, inputType);
      if (!val) {
        if (lbl) reportFieldFilled(lbl, 'failed');
        continue;
      }
      inp.focus();
      nativeSet(inp, val);
      filledCount++;
      if (lbl) reportFieldFilled(lbl, 'filled');
      await sleep(60);
    }

    /* Selects */
    const selects = allSelects.filter(el => !el.value);
    for (const sel of selects) {
      const lbl = getLabel(sel);
      const l   = lbl.toLowerCase();
      const opts = $$('option', sel).filter(o => o.value && o.value !== '' && !/^select/i.test(o.text));
      if (!opts.length) continue;

      let chosen = null;
      const val = guessValue(lbl, p);

      // 1) Direct label → value match via bestSelectOption
      if (val) chosen = bestSelectOption(sel, val);

      // 2) Yes/No fallback: if it's a small option set with yes/no options,
      //    pick the appropriate answer based on question polarity
      if (!chosen && opts.length <= 6) {
        const hasYes = opts.some(o => /^yes$/i.test(o.text.trim()));
        const hasNo  = opts.some(o => /^no$/i.test(o.text.trim()));
        if (hasYes || hasNo) {
          // Questions with negative framing → pick No
          const negative = /\bnot\b|\bno longer\b|don.t|cannot|unable|lack|without|decline/i.test(l);
          chosen = opts.find(o => negative
            ? /^no$/i.test(o.text.trim())
            : /^yes$/i.test(o.text.trim()));
          // If no exact "Yes", pick first option that contains "yes"
          if (!chosen) {
            chosen = opts.find(o => negative
              ? /\bno\b/i.test(o.text)
              : /\byes\b/i.test(o.text));
          }
        }
      }

      // 3a) Experience range: pick the bracket closest to our years value
      if (!chosen && EXP_LABEL_RE.test(l)) {
        const targetYears = parseInt((p.years_experience || DEFAULTS.years).toString()) || 7;
        let bestDist = Infinity;
        for (const o of opts) {
          const nums = (o.text.match(/\d+/g) || []).map(Number).filter(Boolean);
          if (!nums.length) {
            // Text option like "Less than 1 year", "10+ years", "More than 10" etc.
            if (/less.?than.?1|under.?1|none|no.?exp/i.test(o.text)) {
              const dist = Math.abs(0 - targetYears);
              if (dist < bestDist) { bestDist = dist; chosen = o; }
            } else if (/10\+|more.?than.?10|over.?10|10\s*or\s*more|10\s*\+/i.test(o.text)) {
              const dist = Math.abs(10 - targetYears);
              if (dist < bestDist) { bestDist = dist; chosen = o; }
            }
            continue;
          }
          const mid  = nums.reduce((a, b) => a + b, 0) / nums.length;
          const dist = Math.abs(mid - targetYears);
          if (dist < bestDist) { bestDist = dist; chosen = o; }
        }
      }

      // 3b) Salary range: pick the band closest to expected salary
      if (!chosen && /salary|compensation|pay\b|remun|expectation|ctc|lpa/i.test(l)) {
        const target = parseInt((p.expected_salary || DEFAULTS.salary).toString().replace(/\D/g,'')) || 80000;
        let bestDist = Infinity;
        for (const o of opts) {
          const nums = (o.text.match(/\d[\d,]*/g) || []).map(n => parseInt(n.replace(/,/g,''))).filter(Boolean);
          if (!nums.length) continue;
          const mid   = nums.reduce((a, b) => a + b, 0) / nums.length;
          const dist  = Math.abs(mid - target);
          if (dist < bestDist) { bestDist = dist; chosen = o; }
        }
      }

      // 4) Last resort: if still nothing and exactly 2 options, pick the first
      if (!chosen && opts.length === 2) {
        chosen = opts[0];
      }

      if (chosen) {
        sel.value = chosen.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        filledCount++;
        if (lbl) reportFieldFilled(lbl, 'filled');
      } else {
        if (lbl) reportFieldFilled(lbl, 'failed');
      }
    }

    /* Fix selects that were wrongly filled (e.g. "80000" in a yes/no dropdown) */
    for (const sel of allSelects.filter(el => el.value)) {
      const lbl = getLabel(sel);
      const l   = lbl.toLowerCase();
      const curText = sel.options[sel.selectedIndex]?.text?.trim() || sel.value;
      // If value looks like a raw number in a non-salary / non-experience field, it's wrong
      if (/^\d+$/.test(sel.value) &&
          !/salary|compensation|pay\b|remun|expectation|ctc|lpa/i.test(l) &&
          !EXP_LABEL_RE.test(l)) {
        sel.value = '';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        // Re-trigger to fill correctly
        const opts2 = $$('option', sel).filter(o => o.value && o.value !== '' && !/^select/i.test(o.text));
        const hasYes = opts2.some(o => /^yes$/i.test(o.text.trim()));
        if (hasYes) {
          const yesOpt = opts2.find(o => /^yes$/i.test(o.text.trim())) ||
                         opts2.find(o => /\byes\b/i.test(o.text));
          if (yesOpt) {
            sel.value = yesOpt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            if (lbl) reportFieldFilled(lbl, 'filled');
          }
        }
      }
    }

    /* Radio buttons */
    const groups = {};
    $$('input[type=radio]').filter(isVisible).forEach(r => {
      (groups[r.name || r.id] ||= []).push(r);
    });
    for (const [, radios] of Object.entries(groups)) {
      if (radios.some(r => r.checked)) continue;
      const lbl = getLabel(radios[0]);
      const guess = guessValue(lbl, p);
      const match = radios.find(r => {
        const t = ($(`label[for="${CSS.escape(r.id)}"]`)?.textContent || r.value || '').toLowerCase();
        return guess && t.includes(guess.toLowerCase());
      });
      if (match) { realClick(match); reportFieldFilled(lbl, 'filled'); filledCount++; continue; }
      /* Default: pick Yes for yes/no questions */
      const yes = radios.find(r => {
        const t = ($(`label[for="${CSS.escape(r.id)}"]`)?.textContent || r.value || '').toLowerCase().trim();
        return ['yes','true','1'].includes(t);
      });
      if (yes) { realClick(yes); reportFieldFilled(lbl, 'filled'); filledCount++; }
      else { reportFieldFilled(lbl, 'failed'); }
    }

    /* Checkboxes – only required ones */
    $$('input[type=checkbox][required], input[type=checkbox][aria-required="true"]')
      .filter(el => isVisible(el) && !el.checked)
      .forEach(cb => { realClick(cb); filledCount++; });

    // Final progress update
    try {
      chrome.runtime.sendMessage({
        type: 'SIDEBAR_STATUS',
        event: 'filling_progress',
        total: allFields.length,
        filled: filledCount,
        responses: Object.keys(p).length,
      }).catch(() => {});
    } catch (_) {}

    // Sanitize: fix any fields that got filled with wrong values (e.g. LinkedIn URL in non-URL fields)
    await sanitizeBadFills();

    LOG(`autoFillPage: ${filledCount} of ${allFields.length} fields filled`);
  }

  /* ── Greenhouse: robust required-field handling ───────────── */
  async function greenhouseAutofill() {
    const isGH = HOST.includes('greenhouse.io') || HOST.includes('boards.greenhouse.io') ||
      !!$('form#application_form,#application_form,[data-provided-by="greenhouse"]');
    if (!isGH) return;

    const p = await getProfile();

    /* Map common Greenhouse field IDs/names */
    const GH_MAP = [
      ['#first_name,input[id*="first_name"],input[name*="first_name"]',   p.first_name],
      ['#last_name,input[id*="last_name"],input[name*="last_name"]',       p.last_name],
      ['#email,input[type="email"],input[id*="email"]',                    p.email],
      ['#phone,input[type="tel"],input[id*="phone"]',                      p.phone],
      ['input[id*="location"],input[name*="location"]',                    p.city || p.location || ''],
      ['input[id*="linkedin"],input[name*="linkedin"]',                    p.linkedin_profile_url || ''],
      ['input[id*="website"],input[name*="website"],input[id*="portfolio"]', p.website_url || ''],
      ['input[id*="github"],input[name*="github"]',                        p.github_url || ''],
      ['textarea[id*="cover"],textarea[name*="cover"]',                    p.cover_letter || DEFAULTS.cover],
    ];

    for (const [sel, val] of GH_MAP) {
      if (!val) continue;
      const el = $(sel);
      if (el && isVisible(el)) { el.focus(); nativeSet(el, val); await sleep(50); }
    }

    /* Handle custom questions (dropdowns) */
    $$('select').filter(isVisible).forEach(sel => {
      if (sel.value) return;
      const lbl = getLabel(sel);
      const val = guessValue(lbl, p);
      if (!val) return;
      const opt = $$('option', sel).find(o => o.text.toLowerCase().includes(val.toLowerCase()));
      if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    });

    /* EEO/demographic selects */
    $$('select[id*="gender"],select[id*="disability"],select[id*="veteran"],select[id*="race"],select[id*="ethnicity"]')
      .filter(isVisible)
      .forEach(sel => {
        if (sel.value) return;
        const id = sel.id.toLowerCase();
        let target = '';
        if (/gender/.test(id))    target = DEFAULTS.gender;
        if (/disability/.test(id))target = DEFAULTS.disability;
        if (/veteran/.test(id))   target = DEFAULTS.veteran;
        if (/race|ethnicity/.test(id)) target = DEFAULTS.ethnicity;
        if (!target) return;
        const opt = $$('option', sel).find(o =>
          o.text.toLowerCase().includes('decline') ||
          o.text.toLowerCase().includes('prefer not') ||
          o.text.toLowerCase().includes('not to say') ||
          o.text.toLowerCase().includes('not a protected') ||
          o.text.toLowerCase().includes('do not have')
        );
        if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      });

    LOG('Greenhouse autofill done');
  }

  /* ── T18: Auto-handle "Add Missing Details" dialog ───────── */
  function watchMissingDetailsDialog() {
    let lastFill = 0;
    new MutationObserver(async () => {
      if (Date.now() - lastFill < 3000) return;

      /* Look for the OptimHire missing-details iframe */
      const iframe = document.getElementById('optimhire-missing-details');
      if (iframe) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (doc && doc.body && doc.body.innerHTML.length > 50) {
            lastFill = Date.now();
            const p = await getProfile();
            const inputs = $$('input:not([type=hidden]):not([type=file]):not([type=button]):not([type=submit]),textarea', doc)
              .filter(el => isVisible(el) && !el.value?.trim());
            for (const inp of inputs) {
              const lbl = getLabel(inp);
              const val = guessValue(lbl, p);
              if (val) { inp.focus(); nativeSet(inp, val); await sleep(50); }
            }
            await sleep(600);
            const saveBtn = $$('button', doc).find(
              el => isVisible(el) && /save|continue|done|submit|update/i.test(el.textContent)
            );
            if (saveBtn) realClick(saveBtn);
          }
        } catch (_) {}
      }

      /* Generic "missing details" dialogs on the page */
      const dialog = $$('[class*="missing"],[id*="missing"],[role="dialog"],[class*="modal"]')
        .find(el => isVisible(el) &&
          /missing details|fill.*details|add.*details|fill.*form/i.test(el.textContent)
        );
      if (dialog) {
        lastFill = Date.now();
        await sleep(300);
        await autoFillPage();
        await sleep(700);
        const btn = $$('button', dialog).find(
          el => isVisible(el) && /save|submit|continue|done|next|confirm/i.test(el.textContent)
        );
        if (btn) realClick(btn);
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: false });
  }
  watchMissingDetailsDialog();

  /* ── T12: Auto-solve captchas ────────────────────────────── */
  async function solveCaptcha() {
    /* reCAPTCHA checkbox inside iframe */
    $$('iframe[src*="recaptcha"],iframe[src*="hcaptcha"]').forEach(f => {
      try {
        const cb = f.contentDocument?.querySelector('.recaptcha-checkbox,#recaptcha-anchor');
        if (cb && !cb.classList.contains('recaptcha-checkbox-checked')) realClick(cb);
      } catch (_) {}
    });

    /* Math captchas */
    $$('[class*="captcha"] input,[id*="captcha"] input,input[name*="captcha"]').forEach(inp => {
      const lbl = getLabel(inp);
      const m = lbl.match(/(\d+)\s*([\+\-\*x×÷\/])\s*(\d+)/);
      if (!m) return;
      const [, a, op, b] = m;
      const n1 = +a, n2 = +b;
      const ops = {
        '+': n1 + n2, '-': n1 - n2, '*': n1 * n2, 'x': n1 * n2,
        '×': n1 * n2, '/': n2 ? Math.round(n1 / n2) : null, '÷': n2 ? Math.round(n1 / n2) : null,
      };
      const result = ops[op];
      if (result !== null && result !== undefined) nativeSet(inp, String(result));
    });

    /* Simple "I'm not a robot" checkboxes */
    $$('input[type=checkbox][id*="captcha"],input[type=checkbox][name*="captcha"]')
      .filter(el => !el.checked).forEach(cb => realClick(cb));
  }

  new MutationObserver(() => solveCaptcha())
    .observe(document.body, { childList: true, subtree: true });
  solveCaptcha();

  /* ── T8: Workday comprehensive autofill (v4.0) ───────────── */
  /*
   * All data-automation-id values sourced from SpeedyApply reference.
   * Account creation uses appAccountEmail / appAccountPassword from storage.
   */
  const WD_FIELDS = {
    /* Personal info */
    legalNameSection_firstName:  'first_name',
    legalNameSection_lastName:   'last_name',
    legalNameSection_middleName: 'middle_name',
    infoFirstName:               'first_name',
    infoLastName:                'last_name',
    infoEmail:                   'email',
    infoCellPhone:               'phone',
    infoLinkedIn:                'linkedin_profile_url',
    email:                       'email',
    phone:                       'phone',
    /* Address */
    addressSection_addressLine1: 'address',
    addressSection_addressLine2: 'address2',
    addressSection_city:         'city',
    addressSection_postalCode:   'postal_code',
    /* Work history */
    workHistoryCompanyName:      'current_company',
    workHistoryPosition:         'current_title',
    /* Education */
    educationHistoryName:        'school',
    degree:                      'degree',
    /* Other */
    linkedIn:                    'linkedin_profile_url',
    website:                     'website_url',
    github:                      'github_url',
    jobTitle:                    'current_title',
    company:                     'current_company',
    school:                      'school',
    major:                       'major',
    postalCode:                  'postal_code',
    city:                        'city',
    state:                       'state',
    country:                     'country',
    yearsOfExperience:           'years_of_experience',
    salary:                      'expected_salary',
    coverLetter:                 'cover_letter',
    howDidYouHear:               'how_did_you_hear',
  };

  /* Workday textarea/description fields */
  const WD_TEXTAREA_AIDS = new Set([
    'formField-roleDescription',
    'formField-summary',
    'formField-coverLetter',
    'formField-additionalInfo',
  ]);

  /* Workday navigation button IDs (in priority order) */
  const WD_NEXT_AIDS = [
    'pageFooterNextButton',
    'bottom-navigation-next-button',
    'btnNext',
    'nextButton',
  ];
  const WD_SUBMIT_AIDS = [
    'btnSubmit',
    'submitButton',
    'bottom-navigation-submit-button',
    'pageFooterSubmitButton',
  ];

  async function workdayAutofill() {
    const isWD = HOST.includes('myworkdayjobs.com') || HOST.includes('workday.com') ||
      !!$('[data-automation-id]') || !!$('div[data-uxi-widget-type]');
    if (!isWD) return;

    const p = await getProfile();
    const acct = await getAppAccount();

    /* Step 1: Account creation / sign-in flow */
    await workdayAccountFlow(p, acct);

    /* Step 2: Fill all data-automation-id fields */
    const containers = $$('[data-automation-id]:not([data-automation-id=""])');
    for (const el of containers) {
      const aid = el.getAttribute('data-automation-id');

      /* Cover letter / description textareas */
      if (WD_TEXTAREA_AIDS.has(aid)) {
        const ta = $('textarea', el) || (el.tagName === 'TEXTAREA' ? el : null);
        if (ta && !ta.value?.trim()) {
          const val = p.cover_letter || DEFAULTS.cover;
          ta.focus();
          nativeSet(ta, val);
        }
        continue;
      }

      const profileKey = WD_FIELDS[aid];
      if (!profileKey) continue;
      // Use DEFAULTS fallback for known default-able fields
      const val = p[profileKey]
        || (profileKey === 'years_of_experience' ? DEFAULTS.years : null)
        || (profileKey === 'expected_salary' ? DEFAULTS.salary : null);
      if (!val) continue;

      const input = $('input:not([type=hidden]):not([type=file]),textarea', el);
      if (input && !input.value?.trim()) {
        input.focus();
        nativeSet(input, val);
        await sleep(80);
        continue;
      }

      const combo = $('[role=combobox],[data-automation-id*="combobox"]', el);
      if (combo) {
        realClick(combo);
        await sleep(400);
        const si = $('input', combo);
        if (si) { nativeSet(si, val); await sleep(700); }
        const opt = $('[role=option]');
        if (opt) realClick(opt);
        continue;
      }

      $$('input[type=radio]', el).forEach(r => {
        const t = ($(`label[for="${CSS.escape(r.id)}"]`)?.textContent || '').toLowerCase();
        if (t.includes(val.toLowerCase())) realClick(r);
      });
    }

    /* Step 3: EEO / demographic fields */
    await workdayEeoFields(p);

    /* Step 4: Resume upload */
    await workdayResumeUpload(p);

    /* Step 5: Agreement checkboxes */
    $$('[data-automation-id="agreementCheckbox"] input[type=checkbox]')
      .filter(cb => !cb.checked).forEach(cb => realClick(cb));

    LOG('Workday autofill done');
  }

  async function workdayAccountFlow(p, acct) {
    /* Create Account checkbox */
    const createCb = $('[data-automation-id="createAccountCheckbox"] input[type=checkbox]') ||
                     $('input[data-automation-id="createAccountCheckbox"]');
    if (createCb && !createCb.checked) {
      realClick(createCb);
      await sleep(600);
    }

    /* Fill account email */
    const emailField = $('[data-automation-id="createAccountEmail"] input') ||
                       $('[data-automation-id="accountCreationEmail"] input') ||
                       $('input[data-automation-id="email"]') ||
                       $('input[name="email"][type="email"]');
    if (emailField && !emailField.value?.trim()) {
      const emailVal = acct.email || p.email || '';
      if (emailVal) { emailField.focus(); nativeSet(emailField, emailVal); await sleep(200); }
    }

    /* Fill account password */
    const pwField = $('[data-automation-id="password"] input[type=password]') ||
                    $('input[data-automation-id="password"]') ||
                    $('input[type=password]');
    if (pwField && !pwField.value?.trim() && acct.password) {
      pwField.focus();
      nativeSet(pwField, acct.password);
      await sleep(200);
    }

    /* Verify password */
    const pwFields = $$('input[type=password]').filter(isVisible);
    if (pwFields.length >= 2 && acct.password) {
      const verify = pwFields[1];
      if (!verify.value?.trim()) { verify.focus(); nativeSet(verify, acct.password); await sleep(200); }
    }

    /* Click "Create Account" submit button */
    const createBtn = $('[data-automation-id="createAccountSubmitButton"]') ||
                      $('button[data-automation-id="createAccountSubmitButton"]');
    if (createBtn && isVisible(createBtn)) {
      await sleep(400);
      realClick(createBtn);
      await sleep(1500);
      return;
    }

    /* Or "Sign In" if already has account */
    const signInBtn = $('[data-automation-id="signInSubmitButton"]');
    if (signInBtn && isVisible(signInBtn)) {
      await sleep(400);
      realClick(signInBtn);
      await sleep(1500);
    }
  }

  async function workdayEeoFields(p) {
    /* Gender */
    const genderEl = $('[data-automation-id="gender"] select') ||
                     $('select[data-automation-id="gender"]');
    if (genderEl && !genderEl.value) {
      const opt = $$('option', genderEl).find(o =>
        /decline|prefer not|not to say/i.test(o.text)
      );
      if (opt) { genderEl.value = opt.value; genderEl.dispatchEvent(new Event('change', { bubbles: true })); }
    }

    /* Veteran status */
    const vetEl = $('[data-automation-id="veteranStatus"] select') ||
                  $('select[data-automation-id="veteranStatus"]');
    if (vetEl && !vetEl.value) {
      const opt = $$('option', vetEl).find(o =>
        /not a protected|i am not|decline|prefer not/i.test(o.text)
      );
      if (opt) { vetEl.value = opt.value; vetEl.dispatchEvent(new Event('change', { bubbles: true })); }
    }

    /* Disability */
    const disEl = $('[data-automation-id="disability"] select') ||
                  $('select[data-automation-id="disability"]');
    if (disEl && !disEl.value) {
      const opt = $$('option', disEl).find(o =>
        /do not have|decline|prefer not/i.test(o.text)
      );
      if (opt) { disEl.value = opt.value; disEl.dispatchEvent(new Event('change', { bubbles: true })); }
    }

    /* Ethnicity */
    const ethEl = $('[data-automation-id="ethnicityDropdown"] select') ||
                  $('select[data-automation-id="ethnicityDropdown"]');
    if (ethEl && !ethEl.value) {
      const opt = $$('option', ethEl).find(o =>
        /decline|prefer not|not to say/i.test(o.text)
      );
      if (opt) { ethEl.value = opt.value; ethEl.dispatchEvent(new Event('change', { bubbles: true })); }
    }
  }

  async function workdayResumeUpload(p) {
    if (!p.resume_url && !p.resumeUrl) return;
    const resumeUrl = p.resume_url || p.resumeUrl;

    /* Look for resume upload triggers */
    const uploadTriggers = [
      $('[data-automation-id="resumeUpload"]'),
      $('[data-automation-id="select-files"]'),
      $('[data-automation-id="file-upload-input-ref"]'),
      $('input[type=file][accept*="pdf"],input[type=file][accept*="doc"]'),
    ].filter(Boolean);

    if (uploadTriggers.length === 0) return;
    LOG('Workday: resume upload field found (URL-based upload not supported by browser extension)');
    /* Note: Actual file upload requires fetching the resume blob and creating a File object.
       This is handled separately via the background service worker if configured. */
  }

  /* ── T11: OracleCloud autofill ───────────────────────────── */
  async function oracleAutofill() {
    const isOracle = HOST.includes('oraclecloud.com') || HOST.includes('taleo.net') ||
      !!$('#OracleFusionApp,oracle-apply-flow');
    if (!isOracle) return;

    const p = await getProfile();
    const fields = [
      ['#firstName,input[id*="firstName"],input[name*="firstName"]', p.first_name],
      ['#lastName,input[id*="lastName"],input[name*="lastName"]',    p.last_name],
      ['input[type="email"],input[id*="email"]',                     p.email],
      ['input[type="tel"],input[id*="phone"],input[name*="phone"]',  p.phone],
      ['input[id*="city"],input[name*="city"]',                      p.city],
      ['input[id*="zip"],input[name*="postal"]',                     p.postal_code],
    ];
    for (const [sel, val] of fields) {
      if (!val) continue;
      const el = $(sel);
      if (el && isVisible(el)) { el.focus(); nativeSet(el, val); await sleep(60); }
    }
    LOG('Oracle autofill done');
  }

  /* ── T11: SmartRecruiters autofill ───────────────────────── */
  async function srAutofill() {
    const isSR = HOST.includes('smartrecruiters.com') ||
      !!$('[data-qa*="smartrecruiter"],.smartrecruiters-form,#smartrecruiters-widget');
    if (!isSR) return;

    const p = await getProfile();
    const fields = [
      ['input[name="first_name"],#firstName',      p.first_name],
      ['input[name="last_name"],#lastName',         p.last_name],
      ['input[name="email"],input[type="email"]',   p.email],
      ['input[name="phone"],input[type="tel"]',     p.phone],
      ['input[name="city"]',                        p.city],
      ['input[name="web"],input[name="website"]',   p.website_url],
      ['textarea[name="message"],textarea[name="cover_letter"]', p.cover_letter || DEFAULTS.cover],
    ];
    for (const [sel, val] of fields) {
      if (!val) continue;
      const el = $(sel);
      if (el && isVisible(el)) { el.focus(); nativeSet(el, val); await sleep(60); }
    }
    LOG('SmartRecruiters autofill done');
  }

  /* ── T5: Indeed "Apply on company site" ─────────────────── */
  function handleIndeed() {
    if (!HOST.includes('indeed.com')) return;
    const click = () => {
      const btn = $$('button,a').find(el =>
        /apply on company site|apply externally|apply now/i.test(el.textContent) ||
        el.getAttribute('data-testid') === 'company-site-apply-button'
      );
      if (btn) { LOG('Indeed: clicking Apply on company site'); realClick(btn); }

      const confirm = $$('button').find(el =>
        /continue|proceed|yes|ok/i.test(el.textContent) &&
        el.closest('[class*="modal"],[class*="dialog"],[role="dialog"]')
      );
      if (confirm) realClick(confirm);
    };
    setTimeout(click, 1500);
    new MutationObserver(click).observe(document.body, { childList: true, subtree: true });
  }
  handleIndeed();

  /* ── T6: LinkedIn Easy Apply + direct apply ──────────────── */
  function handleLinkedIn() {
    if (!HOST.includes('linkedin.com')) return;
    // Only activate on the jobs domain — not on feeds, profiles, or messaging
    if (!location.pathname.startsWith('/jobs')) return;

    let _linkedInActing = false;
    const act = async () => {
      if (_linkedInActing) return;
      _linkedInActing = true;
      try {
        const direct = $$('.jobs-apply-button,.apply-button,[data-control-name*="apply"]')
          .find(el => {
            const t = el.textContent.trim().toLowerCase();
            return t.includes('apply') && !t.includes('easy');
          });
        if (direct) { LOG('LinkedIn: direct apply'); realClick(direct); return; }

        const easy = $$('.jobs-apply-button,[aria-label*="Easy Apply"]')
          .find(el => /easy apply/i.test(el.textContent));
        if (easy) {
          LOG('LinkedIn: Easy Apply');
          realClick(easy);
          await sleep(1500);
          await fillLinkedInModalFull();
        }
      } finally {
        setTimeout(() => { _linkedInActing = false; }, 3000);
      }
    };

    setTimeout(act, 2000);
    new MutationObserver(act).observe(document.body, { childList: true, subtree: false });
  }

  async function fillLinkedInModal() {
    const modal = $('[data-test-modal],.jobs-easy-apply-modal,[aria-modal="true"]');
    if (!modal) return;
    await autoFillPage();
    await sleep(500);
    const nextBtn = $$('button', modal).find(el =>
      isVisible(el) && /next|continue|submit|review/i.test(el.textContent)
    );
    if (nextBtn) realClick(nextBtn);
  }
  handleLinkedIn();

  /* ── T10: HiringCafe navigation ──────────────────────────── */
  const GOOD_SIZES = [
    '51-200','201-500','501-1000','501-1,000','1001-2000','1,001-2,000',
    '2001-5000','2,001-5,000','5001-10000','5,001-10,000','10001+','10,001+',
    '51 to 200','201 to 500','501 to 1000',
  ];

  function handleHiringCafe() {
    if (!HOST.includes('hiring.cafe')) return;

    const sizeEl = $$('[class*="size"],[class*="employees"],[data-field*="size"]')
      .find(el => /\d/.test(el.textContent));
    if (sizeEl) {
      const txt = sizeEl.textContent.replace(/\s/g, '');
      const ok = GOOD_SIZES.some(s => txt.includes(s.replace(/\s/g, '')));
      if (!ok) {
        LOG('HiringCafe: company size not preferred — skipping');
        chrome.runtime.sendMessage({ type: 'JOB_SKIPPED', reason: 'company_size' }).catch(() => {});
        return;
      }
    }

    const tryClick = () => {
      const btn = $$('a,button').find(el =>
        /apply directly|apply now|apply for this/i.test(el.textContent)
      );
      if (btn) { LOG('HiringCafe: Apply Directly'); realClick(btn); }
    };
    setTimeout(tryClick, 2000);
    new MutationObserver(tryClick).observe(document.body, { childList: true, subtree: true });
  }
  handleHiringCafe();

  /* ── Ashby autofill ──────────────────────────────────────── */
  async function ashbyAutofill() {
    if (CURRENT_ATS !== 'Ashby') return;
    const p = await getProfile();
    LOG('Ashby: filling');

    // Ashby uses semantic input names and data attributes
    const ASHBY_MAP = {
      '_systemfield_name':      () => `${p.first_name||''} ${p.last_name||''}`.trim(),
      '_systemfield_email':     () => p.email,
      '_systemfield_phone':     () => p.phone,
      '_systemfield_linkedin':  () => p.linkedin_profile_url,
      '_systemfield_github':    () => p.github_url,
      '_systemfield_website':   () => p.website_url,
      '_systemfield_location':  () => `${p.city||''}, ${p.country||''}`.replace(/^, |, $/,''),
    };
    for (const [name, valFn] of Object.entries(ASHBY_MAP)) {
      const el = $(`input[name="${name}"],textarea[name="${name}"]`);
      if (el && isVisible(el) && !el.value?.trim()) {
        const v = valFn();
        if (v) { el.focus(); nativeSet(el, v); await sleep(50); }
      }
    }

    // Generic fallback for Ashby custom fields
    await autoFillPage();
    await sleep(500);

    // Try to click continue/next on single-page Ashby forms
    const submitBtn = $$('button[type="submit"],button').find(el =>
      isVisible(el) && /submit|apply|send.*application/i.test(el.textContent)
    );
    if (submitBtn) { await sleep(400); realClick(submitBtn); }
  }

  /* ── BambooHR autofill ───────────────────────────────────── */
  async function bambooAutofill() {
    if (CURRENT_ATS !== 'BambooHR') return;
    const p = await getProfile();
    LOG('BambooHR: filling');

    const BAMBOO_MAP = {
      'firstName':     p.first_name,
      'lastName':      p.last_name,
      'email':         p.email,
      'phone':         p.phone,
      'address':       p.street,
      'city':          p.city,
      'state':         p.state,
      'zip':           p.postal_code,
      'country':       p.country,
      'linkedInUrl':   p.linkedin_profile_url,
      'websiteUrl':    p.website_url,
      'coverLetter':   p.cover_letter || DEFAULTS.cover,
    };
    for (const [name, val] of Object.entries(BAMBOO_MAP)) {
      if (!val) continue;
      const el = $(`input[name="${name}"],textarea[name="${name}"],input[id*="${name}"],textarea[id*="${name}"]`);
      if (el && isVisible(el) && !el.value?.trim()) {
        el.focus(); nativeSet(el, val); await sleep(50);
      }
    }
    await autoFillPage();
  }

  /* ── Jobvite autofill ────────────────────────────────────── */
  async function jobviteAutofill() {
    if (CURRENT_ATS !== 'Jobvite') return;
    const p = await getProfile();
    LOG('Jobvite: filling');

    const JOBVITE_MAP = [
      ['input[id*="first"],input[name*="first"],input[placeholder*="First"]',  p.first_name],
      ['input[id*="last"],input[name*="last"],input[placeholder*="Last"]',     p.last_name],
      ['input[type="email"],input[id*="email"],input[name*="email"]',          p.email],
      ['input[type="tel"],input[id*="phone"],input[name*="phone"]',            p.phone],
      ['input[id*="city"],input[name*="city"]',                                p.city],
      ['input[id*="linkedin"],input[name*="linkedin"]',                        p.linkedin_profile_url],
      ['input[id*="website"],input[name*="website"]',                          p.website_url],
      ['textarea[id*="cover"],textarea[name*="cover"]',                        p.cover_letter || DEFAULTS.cover],
    ];
    for (const [sel, val] of JOBVITE_MAP) {
      if (!val) continue;
      const el = $$(sel).find(e => isVisible(e) && !e.value?.trim());
      if (el) { el.focus(); nativeSet(el, val); await sleep(50); }
    }
    await autoFillPage();
  }

  /* ── Improved LinkedIn Easy Apply (multi-step) ───────────── */
  async function fillLinkedInModalFull() {
    const modal = $('[data-test-modal],.jobs-easy-apply-modal,[aria-modal="true"]');
    if (!modal) return;

    let maxPages = 8; // guard against infinite loops
    while (maxPages-- > 0) {
      await sleep(800);
      await autoFillPage();
      await sleep(500);

      // Look for next/continue button FIRST, submit last
      const next = $$('button', modal).find(el =>
        isVisible(el) && /next|continue/i.test(el.textContent)
      );
      if (next) { realClick(next); await sleep(1200); continue; }

      const review = $$('button', modal).find(el =>
        isVisible(el) && /review/i.test(el.textContent)
      );
      if (review) { realClick(review); await sleep(1200); continue; }

      const submit = $$('button', modal).find(el =>
        isVisible(el) && /submit|send application/i.test(el.textContent)
      );
      if (submit) { realClick(submit); break; }

      break; // no recognisable button — stop
    }
  }

  /* ── Lever autofill (targeted field IDs) ────────────────── */
  async function leverAutofill() {
    if (CURRENT_ATS !== 'Lever') return;
    const p = await getProfile();
    LOG('Lever: filling');

    const LEVER_MAP = {
      'name':        `${p.first_name||''} ${p.last_name||''}`.trim(),
      'email':       p.email,
      'phone':       p.phone,
      'org':         p.current_company,
      'urls[LinkedIn]': p.linkedin_profile_url,
      'urls[GitHub]':   p.github_url,
      'urls[Portfolio]':p.website_url,
      'urls[Twitter]':  p.twitter_url,
    };
    for (const [name, val] of Object.entries(LEVER_MAP)) {
      if (!val) continue;
      const el = $(`input[name="${name}"],textarea[name="${name}"]`);
      if (el && isVisible(el) && !el.value?.trim()) {
        el.focus(); nativeSet(el, val); await sleep(60);
      }
    }

    // Cover letter textarea
    const cl = $$('textarea').find(el => isVisible(el) &&
      /cover|motivation|additional/i.test(getLabel(el)));
    if (cl && !cl.value?.trim()) {
      nativeSet(cl, p.cover_letter || DEFAULTS.cover);
    }

    await autoFillPage();
  }

  /* ── waitForFormStable — wait until DOM stops changing ──────
   * Waits up to `timeout` ms for the form to stop mutating, then
   * resolves.  Prevents filling fields that are still being added
   * by React / SPA routing.                                       */
  function waitForFormStable(timeout = 3000) {
    return new Promise(resolve => {
      let timer = null;
      const mo = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => { mo.disconnect(); resolve(); }, 300);
      });
      mo.observe(document.body, { childList: true, subtree: true, attributes: false });
      // Also resolve after max timeout regardless
      setTimeout(() => { mo.disconnect(); resolve(); }, timeout);
      // Kick off initial timer in case DOM is already stable
      timer = setTimeout(() => { mo.disconnect(); resolve(); }, 300);
    });
  }

  /* ── T9: Deduplication ───────────────────────────────────── */
  function normalizeUrl(url) {
    try {
      const u = new URL(url);
      ['utm_source','utm_medium','utm_campaign','ref','referer','source','fbclid']
        .forEach(p => u.searchParams.delete(p));
      return u.origin + u.pathname;
    } catch (_) { return url; }
  }

  async function markApplied() {
    const norm = normalizeUrl(location.href);
    const { appliedJobs = [] } = await ST.get('appliedJobs');
    if (!appliedJobs.includes(norm)) {
      appliedJobs.push(norm);
      if (appliedJobs.length > 15_000) appliedJobs.shift();
      await ST.set({ appliedJobs });
    }
  }

  /* ── T7/T15: Freshness badges on job cards ───────────────── */
  function parseRelTime(txt) {
    txt = (txt || '').toLowerCase().trim();
    const now = Date.now();
    if (/just now|moments? ago/.test(txt)) return new Date(now - 60_000);
    if (/today/.test(txt))                 return new Date(now - 3_600_000);
    const m = txt.match(/(\d+)\s+(minute|hour|day|week|month)/);
    if (!m) return null;
    const mults = {
      minute: 60_000, hour: 3_600_000, day: 86_400_000,
      week: 604_800_000, month: 2_592_000_000,
    };
    return new Date(now - +m[1] * (mults[m[2]] || 86_400_000));
  }

  function addFreshBadge(el) {
    if (!el || el.querySelector('.oh-fresh')) return;
    const timeEl = el.querySelector('time,[datetime],[data-posted],[class*="posted"],[class*="date"]');
    let date = null;
    if (timeEl) {
      const dt = timeEl.getAttribute('datetime') || timeEl.getAttribute('data-posted');
      date = dt ? new Date(dt) : parseRelTime(timeEl.textContent);
    }
    if (!date) {
      const m = el.textContent.match(/(\d+)\s+(minute|hour|day|week|month)s?\s+ago|just\s+now|today/i);
      if (m) date = parseRelTime(m[0]);
    }
    if (!date || isNaN(date)) return;
    const age = Date.now() - date.getTime();
    let text = '', color = '';
    if      (age < 30 * 60_000)    { text = '🔥 Just Posted';   color = '#ef4444'; }
    else if (age < 86_400_000)     { text = '✨ Fresh (< 24h)'; color = '#22c55e'; }
    else if (age < 3 * 86_400_000) { text = '📅 Recent (< 3d)'; color = '#3b82f6'; }
    else return;
    const badge = document.createElement('span');
    badge.className = 'oh-fresh';
    badge.textContent = text;
    badge.style.cssText = `display:inline-block;background:${color};color:#fff;
      font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;
      margin-left:6px;vertical-align:middle;`;
    const heading = el.querySelector('h1,h2,h3,h4,a');
    if (heading) heading.after(badge); else el.prepend(badge);
  }

  function processFreshness() {
    $$(
      '.jobsearch-SerpJobCard,.job_seen_beacon,[class*="result-"],' + /* Indeed */
      '.jobs-search-results__list-item,.job-card-container,' +         /* LinkedIn */
      '[class*="job-card"],[class*="jobCard"],[class*="listing"]'      /* Generic */
    ).forEach(addFreshBadge);
  }
  setInterval(processFreshness, 4000);
  processFreshness();

  /* ── Shared ATS dispatch helper ─────────────────────────── */
  async function runAtsAutofill() {
    await waitForFormStable(2000);
    switch (CURRENT_ATS) {
      case 'Workday':          await workdayAutofill();  break;
      case 'OracleCloud':      await oracleAutofill();   break;
      case 'SmartRecruiters':  await srAutofill();       break;
      case 'Greenhouse':       await greenhouseAutofill(); break;
      case 'Ashby':            await ashbyAutofill();    break;
      case 'BambooHR':         await bambooAutofill();   break;
      case 'Jobvite':          await jobviteAutofill();  break;
      case 'Lever':            await leverAutofill();    break;
      default:                 await autoFillPage();     break;
    }
    // Generic pass after platform-specific (catches missed fields)
    if (!['Ashby','BambooHR','Jobvite','Lever'].includes(CURRENT_ATS)) {
      await autoFillPage();
    }
  }

  /* ── T19: CSV Auto-Apply bridge ─────────────────────────── */
  async function initCsvBridge(overrideJobId = null) {
    let { csvActiveJobId, csvActiveTabId } = await ST.get([
      'csvActiveJobId', 'csvActiveTabId',
    ]);

    // Allow TRIGGER_AUTOFILL to pass the correct jobId (multi-tab support)
    if (overrideJobId) csvActiveJobId = overrideJobId;

    const isCsvTab = csvActiveJobId && (csvActiveTabId || overrideJobId);
    if (!isCsvTab) return;

    LOG('CSV bridge active — monitoring for submission');

    let reported = false;
    let _reportedStatus = '';
    const report = async (status, reason = '') => {
      // Allow upgrading from 'failed' to 'done' if the application eventually succeeds
      if (reported && !(_reportedStatus === 'failed' && status === 'done')) return;
      reported = true;
      _reportedStatus = status;
      if (status === 'done') markApplied();
      await ST.set({
        [`csvJobResult_${csvActiveJobId}`]: { status, reason, ts: Date.now() },
      });
      chrome.runtime.sendMessage({
        type: 'CSV_JOB_COMPLETE',
        jobId: csvActiveJobId,
        status,
        reason,
        url: location.href,
      }).catch(() => {});
      LOG(`CSV bridge: reported ${status} for job ${csvActiveJobId}`);
    };

    chrome.runtime.onMessage.addListener(msg => {
      if (msg?.type === 'COMPLEX_FORM_SUCCESS') report('done');
      if (msg?.type === 'COMPLEX_FORM_ERROR')   report('failed', msg.errorType || msg.message || '');
      if (msg?.type === 'APPLICATION_SUCCESS' || msg?.type === 'JOB_APPLIED') report('done');
      if (msg?.type === 'APPLICATION_FAILED')   report('failed', msg.reason || '');
      if (msg?.type === 'ALREADY_APPLIED_SKIP') report('duplicate');
    });

    const successPatterns = [
      '/thanks', '/thank-you', '/success', '/confirmation',
      '/complete', '/submitted', '/application-submitted',
      '/applied', '/done', '/thank_you',
    ];
    const checkSuccess = () => {
      const href = location.href.toLowerCase();
      if (successPatterns.some(p => href.includes(p))) { report('done'); return; }
      const body = document.body?.textContent?.toLowerCase() || '';
      if (/application submitted|thank you for applying|application received|we.ve received your|your application has been|successfully submitted|application complete|thanks for applying|we have received|application was submitted/i.test(body)) {
        report('done');
      }
      // Greenhouse-specific success
      if (document.querySelector('#application_confirmation,.application-confirmation,.confirmation-text')) {
        report('done');
      }
      // Lever-specific success
      if (document.querySelector('.posting-confirmation,.application-confirmation')) {
        report('done');
      }
      // Workday: success screen detection
      if (document.querySelector('[data-automation-id="congratulationsMessage"],[data-automation-id="confirmationMessage"]')) {
        report('done');
      }
    };
    new MutationObserver(checkSuccess).observe(document.body, { childList: true, subtree: true });
    setInterval(checkSuccess, 5000);
    checkSuccess();

    /* Auto-fill on page load for CSV mode */
    await sleep(2000);
    // Notify sidebar: ATS detected, analyzing
    try {
      chrome.runtime.sendMessage({
        type: 'SIDEBAR_STATUS', event: 'analyzing_form',
        atsName: CURRENT_ATS || 'Unknown', url: location.href,
      }).catch(() => {});
    } catch (_) {}

    // Multi-step form handler: fills each step, navigates Next, then submits
    await handleMultiStepCsvForm();

    // Extra sanitize pass after OptimHire's own fill pipeline may have run
    await sleep(1000); await sanitizeBadFills();
  }

  /** Find the Next/Continue step-navigation button (NOT a submit button) */
  function getNextStepButton() {
    return $$('button,a[role="button"]').filter(isVisible).find(btn => {
      const t = (btn.textContent || '').trim();
      return /^(next|continue)(\s+step)?(\s|$)/i.test(t) &&
             !/cancel|back|prev|close|submit|apply/i.test(t.toLowerCase());
    }) || null;
  }

  /**
   * Find and click the FINAL submit/apply button.
   * Never clicks Next / Continue navigation buttons — those belong to
   * the multi-step loop in initCsvBridge / handleMultiStepCsvForm.
   * Returns true if a submit button was found and clicked.
   */
  async function tryClickSubmit() {
    // Check if autoSubmit is enabled in settings
    const { csvQueueSettings } = await ST.get('csvQueueSettings');
    const autoSubmit = csvQueueSettings?.autoSubmit !== false; // default true for CSV mode

    if (!autoSubmit) {
      LOG('Auto-submit disabled — waiting for manual submit or timeout');
      return false;
    }

    // Priority 1: Selector-based (most reliable, ATS-specific)
    const submitSelectors = [
      '#submit_app',                                                    // Greenhouse
      '.postings-btn-submit',                                           // Lever
      'button.application-submit',                                      // Lever
      'button[data-qa="btn-submit"]',                                   // SmartRecruiters
      'button[data-automation-id="pageFooterSubmitButton"]',            // Workday
      'button[data-automation-id="bottom-navigation-submit-button"]',   // Workday
      'button[data-automation-id="btnSubmit"]',                         // Workday
      'button[aria-label*="Submit application"]',
      'button[aria-label*="submit application"]',
      'input[type="submit"]',
    ];

    for (const sel of submitSelectors) {
      const btn = $(sel);
      if (btn && isVisible(btn)) {
        LOG('Found submit button via selector:', sel);
        try { chrome.runtime.sendMessage({ type: 'SIDEBAR_STATUS', event: 'submitting' }).catch(() => {}); } catch (_) {}
        await sleep(400);
        realClick(btn);
        return true;
      }
    }

    // Priority 2: type="submit" buttons (catches most generic forms)
    const typedSubmit = $$('button[type="submit"]').filter(isVisible).find(btn => {
      const t = (btn.textContent || '').trim().toLowerCase();
      return !/next|continue|back|prev|cancel|save.*draft/i.test(t);
    });
    if (typedSubmit) {
      LOG('Found type=submit button:', typedSubmit.textContent?.trim());
      try { chrome.runtime.sendMessage({ type: 'SIDEBAR_STATUS', event: 'submitting' }).catch(() => {}); } catch (_) {}
      await sleep(400);
      realClick(typedSubmit);
      return true;
    }

    // Priority 3: Text-based fallback — NEVER matches next/continue (those are nav)
    const buttons = $$('button,a[role="button"]').filter(isVisible);
    const submitBtn = buttons.find(btn => {
      const t = (btn.textContent || btn.value || '').trim().toLowerCase();
      return /^(submit application|submit|apply now|apply|send application|send|complete application|complete|finish)(\s+application)?(\s|$)/i.test(t) &&
        !/cancel|back|prev|close|next|continue|save.*draft/i.test(t);
    });

    if (submitBtn) {
      LOG('Found submit button by text:', submitBtn.textContent?.trim());
      try { chrome.runtime.sendMessage({ type: 'SIDEBAR_STATUS', event: 'submitting' }).catch(() => {}); } catch (_) {}
      await sleep(400);
      realClick(submitBtn);
      return true;
    }

    LOG('No submit button found — relying on OptimHire pipeline submit');
    return false;
  }

  /**
   * Multi-step form handler for CSV mode.
   * Fills each page, clicks Next if available, repeats until Submit.
   * Returns true if the form was submitted.
   */
  async function handleMultiStepCsvForm() {
    let maxSteps = 12; // guard: max form steps
    while (maxSteps-- > 0) {
      await waitForFormStable(2000);
      await runAtsAutofill();
      await solveCaptcha();
      await sleep(600); await sanitizeBadFills();

      // Check for required fields still empty — log warning
      const emptyRequired = $$(
        'input[required]:not([type=hidden]):not([type=file]),input[aria-required="true"],' +
        'select[required],select[aria-required="true"],textarea[required]'
      ).filter(el => isVisible(el) && !el.value?.trim());
      if (emptyRequired.length > 0) {
        LOG(`Multi-step: ${emptyRequired.length} required fields still empty — retrying fill`);
        await autoFillPage();
        await sleep(400);
      }

      // Try Next/Continue step button first
      const nextBtn = getNextStepButton();
      if (nextBtn) {
        LOG('Multi-step: clicking Next →', nextBtn.textContent?.trim());
        realClick(nextBtn);
        await sleep(1800); // wait for new step to render
        continue;
      }

      // No Next button — attempt final submit
      const submitted = await tryClickSubmit();
      LOG('Multi-step: submit attempt result:', submitted);
      return submitted;
    }
    LOG('Multi-step: step limit reached');
    return false;
  }

  /* Run ATS-specific autofill on DOM changes (CSV mode).
   * Also attempts submit/navigate after filling so multi-step forms
   * don't stall on intermediate pages.                              */
  let _fillDebounce = null;
  let _csvFillRunning = false;
  new MutationObserver(async () => {
    const { csvActiveJobId } = await ST.get('csvActiveJobId');
    if (!csvActiveJobId) return;
    if (_csvFillRunning) return;
    clearTimeout(_fillDebounce);
    _fillDebounce = setTimeout(async () => {
      if (_csvFillRunning) return;
      _csvFillRunning = true;
      try {
        await autoFillPage();
        await solveCaptcha();
        await sanitizeBadFills();
        // After filling, click Next or Submit if form is ready
        const nextBtn = getNextStepButton();
        if (nextBtn) {
          realClick(nextBtn);
        } else {
          await tryClickSubmit();
        }
      } finally {
        _csvFillRunning = false;
      }
    }, 1200);
  }).observe(document.body, { childList: true, subtree: false });

  /* Listen for messages from background/csvImport */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'TRIGGER_AUTOFILL') {
      (async () => {
        // initCsvBridge already calls runAtsAutofill + handleMultiStepCsvForm internally
        await initCsvBridge(msg.jobId || null);
        sendResponse({ ok: true });
      })();
      return true;
    }
    if (msg?.type === 'SOLVE_CAPTCHA') {
      solveCaptcha().then(() => sendResponse({ ok: true }));
      return true;
    }
  });

  /* Track applications on success */
  chrome.runtime.onMessage.addListener(msg => {
    if (
      msg?.type === 'COMPLEX_FORM_SUCCESS' ||
      msg?.type === 'APPLICATION_SUCCESS'  ||
      msg?.type === 'JOB_APPLIED'
    ) markApplied();
  });

  /* Init CSV bridge (async, non-blocking) */
  initCsvBridge().catch(() => {});

  /* ── Race-condition fallback ─────────────────────────────────────────────
   * If the background set csvActiveJobId AFTER our content script already ran
   * (fast page loads), initCsvBridge() above would have found nothing.
   * Listen for storage changes and re-run when csvActiveJobId appears.
   * The background also sends TRIGGER_AUTOFILL for the same purpose, but
   * this storage listener acts as an additional fallback.
   * ──────────────────────────────────────────────────────────────────────── */
  let _csvBridgeStarted = false;
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || _csvBridgeStarted) return;
    const newJobId = changes.csvActiveJobId?.newValue;
    const newTabId = changes.csvActiveTabId?.newValue;
    if (newJobId && newTabId) {
      _csvBridgeStarted = true;
      await initCsvBridge(newJobId).catch(() => {});
    }
  });

  /* Removed duplicate runAtsAutofill trigger — initCsvBridge handles CSV mode */

  /* ── AUTO-TRIGGER: Detect supported ATS pages and auto-fill ──────
   * Like SmartApply's "Autofill in progress" — when the user lands
   * on a supported ATS application page, the extension detects it
   * and automatically starts filling the form.
   * ─────────────────────────────────────────────────────────────── */

  /**
   * Decide if the current page IS (or will soon be) an application form.
   * Uses URL-first detection — far more reliable than fragile DOM selectors.
   * Falls back to permissive DOM scan for unknown ATS flavours.
   */
  function isApplicationPage() {
    const url      = location.href.toLowerCase();
    const path     = location.pathname.toLowerCase();
    const hostname = location.hostname.toLowerCase();

    /* ── LinkedIn ─────────────────────────────────────────────────
     * Job DETAIL page = /jobs/view/  or  /jobs/search/ with a panel open.
     * The Easy Apply modal opens AFTER a click — detect either state.   */
    if (CURRENT_ATS === 'LinkedIn') {
      if (path.includes('/jobs/view/') || path.includes('/jobs/collections/')) return true;
      /* Easy Apply modal already open */
      if (document.querySelector('.jobs-easy-apply-modal,[data-test-modal],[aria-modal="true"]')) return true;
      /* Apply button present on the page */
      if (document.querySelector('.jobs-apply-button,[aria-label*="Apply"],[data-control-name*="apply"]')) return true;
      return false;
    }

    /* ── Workday ──────────────────────────────────────────────────
     * Application pages: URL has /apply  OR  page has automation IDs */
    if (CURRENT_ATS === 'Workday') {
      if (url.includes('/apply') || url.includes('apply=')) return true;
      return document.querySelectorAll('[data-automation-id]').length > 2;
    }

    /* ── Greenhouse ───────────────────────────────────────────────
     * boards.greenhouse.io/company/jobs/ID  is ALWAYS an application.
     * Same for /jobs/ URLs on greenhouse.io subdomains.               */
    if (CURRENT_ATS === 'Greenhouse') {
      if (hostname.includes('boards.greenhouse.io')) return true;
      if (hostname.includes('greenhouse.io') && path.includes('/jobs/')) return true;
      if (document.querySelector('#application_form,[data-provided-by="greenhouse"],form[action*="greenhouse"]')) return true;
      /* Fallback: any form with name/email inputs */
      return document.querySelectorAll(
        'input[id*="first"],input[id*="last"],input[id*="email"],input[name*="first"],input[name*="email"]'
      ).length > 0;
    }

    /* ── Lever ────────────────────────────────────────────────────
     * jobs.lever.co/company/id   is always a job post (apply on page) */
    if (CURRENT_ATS === 'Lever') {
      if (hostname.includes('jobs.lever.co') || hostname.includes('apply.lever.co')) return true;
      return !!document.querySelector('.posting-apply,form.postings-form,.application-form');
    }

    /* ── Ashby ────────────────────────────────────────────────────
     * jobs.ashbyhq.com/company/UUID/application  */
    if (CURRENT_ATS === 'Ashby') {
      if (path.includes('/application')) return true;
      return !!document.querySelector('[data-ashby-form],._ashby_apply_form,[class*="ApplicationForm"]');
    }

    /* ── SmartRecruiters ──────────────────────────────────────────*/
    if (CURRENT_ATS === 'SmartRecruiters') {
      if (url.includes('/apply') || path.includes('/jobs/')) return true;
      return document.querySelectorAll(
        'input[name="first_name"],input[name="last_name"],input[name="email"]'
      ).length > 0;
    }

    /* ── OracleCloud / Taleo ──────────────────────────────────────*/
    if (CURRENT_ATS === 'OracleCloud') {
      return url.includes('/apply') || url.includes('/requisition') ||
             !!document.querySelector('#OracleFusionApp,oracle-apply-flow') ||
             document.querySelectorAll('input:not([type=hidden])').length > 2;
    }

    /* ── All other recognised ATS ─────────────────────────────────
     * If we're on a known ATS domain, be permissive:
     * 2+ non-hidden inputs anywhere in the DOM is enough.             */
    return document.querySelectorAll(
      'input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=button]),textarea'
    ).length >= 2;
  }

  /** Inject/update the "Autofill in progress" banner */
  function showAutofillBanner(status, atsName) {
    let banner = document.getElementById('oh-autofill-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'oh-autofill-banner';
      banner.style.cssText = `
        position:fixed;top:0;left:0;right:0;z-index:2147483647;
        padding:10px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:13px;font-weight:600;text-align:center;
        transition:background .3s ease,color .3s ease;pointer-events:none;
        box-shadow:0 2px 12px rgba(0,0,0,.2);
      `;
      document.body.appendChild(banner);
    }
    const name = atsName || CURRENT_ATS || 'ATS';
    if (status === 'detecting') {
      banner.textContent = `🔍 ${name} detected — starting autofill…`;
      banner.style.background = 'linear-gradient(135deg,#1e40af,#7c3aed)';
      banner.style.color = '#fff';
    } else if (status === 'filling') {
      banner.textContent = `⚡ Autofill in progress — filling ${name} form…`;
      banner.style.background = 'linear-gradient(135deg,#2563eb,#7c3aed)';
      banner.style.color = '#fff';
    } else if (status === 'done') {
      banner.textContent = '✅ Autofill complete — please review and submit';
      banner.style.background = 'linear-gradient(135deg,#059669,#10b981)';
      banner.style.color = '#fff';
      setTimeout(() => { if (banner.parentNode) banner.remove(); }, 5000);
    }
  }

  /** Run the full auto-trigger flow */
  let _autoTriggered = false;
  let _autoTriggerRunning = false;

  async function autoTriggerAutofill() {
    /* Guards */
    if (_autoTriggerRunning) return;
    if (_autoTriggered)      return;
    if (!CURRENT_ATS)        return;

    const { csvActiveJobId } = await ST.get('csvActiveJobId');
    if (csvActiveJobId) return; /* CSV bridge handles it */

    const { ohAutoTrigger } = await ST.get('ohAutoTrigger');
    if (ohAutoTrigger === false) return; /* user disabled */

    /* URL-dedup: don't fill same page twice */
    const norm = normalizeUrl(location.href);
    const { ohAutoFilledUrls = [] } = await ST.get('ohAutoFilledUrls');
    if (ohAutoFilledUrls.includes(norm)) return;

    /* ── Is this actually an application page? ── */
    if (!isApplicationPage()) {
      /* Silent: don't show any banner — just wait for DOM changes */
      LOG(`Auto-trigger: ${CURRENT_ATS} page, but no application form yet`);
      return;
    }

    /* Prevent re-entry */
    _autoTriggerRunning = true;
    _autoTriggered = true;

    /* Open OptimHire side panel + show banner */
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }).catch(() => {});
    chrome.runtime.sendMessage({ type: 'SIDEBAR_STATUS', event: 'ats_detected', atsName: CURRENT_ATS, url: location.href }).catch(() => {});
    showAutofillBanner('detecting', CURRENT_ATS);
    acquireWakeLock();
    LOG(`Auto-trigger: ${CURRENT_ATS} application form detected — autofilling`);

    /* Short pause so the side panel renders */
    await sleep(800);
    showAutofillBanner('filling', CURRENT_ATS);
    chrome.runtime.sendMessage({ type: 'SIDEBAR_STATUS', event: 'analyzing_form', atsName: CURRENT_ATS, url: location.href }).catch(() => {});

    try {
      /* ATS-specific autofill (all platforms via shared helper) */
      await runAtsAutofill();
      await solveCaptcha();
      // Extra sanitize passes — OptimHire may fill after us
      await sleep(700);  await sanitizeBadFills();
      await sleep(1000); await sanitizeBadFills();

      /* Remember */
      ohAutoFilledUrls.push(norm);
      while (ohAutoFilledUrls.length > 500) ohAutoFilledUrls.shift();
      await ST.set({ ohAutoFilledUrls });

      showAutofillBanner('done');
      LOG('Auto-trigger: complete');
    } catch (err) {
      LOG('Auto-trigger: error', err);
      showAutofillBanner('done');
    } finally {
      _autoTriggerRunning = false;
    }
  }

  /* ── Initial trigger after page load ── */
  if (CURRENT_ATS) {
    /* First attempt after 2.5 s (most SPAs have rendered by then) */
    sleep(2500).then(() => autoTriggerAutofill());

    /* ── SPA navigation watcher (URL changes without full reload) ── */
    let _lastHref = location.href;
    setInterval(() => {
      if (location.href !== _lastHref) {
        _lastHref     = location.href;
        _autoTriggered = false;
        _autoTriggerRunning = false;
        sleep(2000).then(() => autoTriggerAutofill());
      }
    }, 1000);

    /* ── DOM mutation watcher: fires when modal/form appears ─────── */
    let _mutationDebounce = null;
    new MutationObserver(mutations => {
      if (_autoTriggered || _autoTriggerRunning) return;
      /* Only care if significant new nodes were added */
      const added = mutations.reduce((n, m) => n + m.addedNodes.length, 0);
      if (added < 2) return;
      clearTimeout(_mutationDebounce);
      _mutationDebounce = setTimeout(() => autoTriggerAutofill(), 1500);
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* ══════════════════════════════════════════════════════════════
   * T20: CSV Auto-Apply Floating Overlay
   * LazyApply-style "Automation In Progress" panel injected via
   * Shadow DOM on the active automation tab.  Shows job progress,
   * Pause / Skip / Quit controls, and auto-removes when done.
   * ═════════════════════════════════════════════════════════════ */
  (function initCsvOverlay() {
    const OVERLAY_ID = 'oh-csv-overlay-host';
    let overlayHost = null;
    let shadow      = null;
    let _isPaused   = false;
    let _isMinimized = false;
    let _totalJobs  = 0;
    let _completedJobs = 0;
    let _currentIndex  = 0;
    let _activeJobUrl  = '';
    let _syncInterval  = null;

    /* ── Verify this is the active automation tab ── */
    async function isAutomationTab() {
      try {
        const data = await ST.get(['csvActiveJobId', 'csvQueueRunning', 'csvActiveTabId']);
        if (!data.csvActiveJobId || !data.csvQueueRunning) return false;
        // Ask background if this tab matches copilotTabId
        return new Promise(resolve => {
          try {
            chrome.runtime.sendMessage({ action: 'COPILOT_TABID' }, resp => {
              if (chrome.runtime.lastError) { resolve(false); return; }
              resolve(!!resp?.sameTab);
            });
          } catch (_) { resolve(false); }
        });
      } catch (_) { return false; }
    }

    /* ── Read queue stats from storage ── */
    async function readQueueStats() {
      try {
        const { csvJobQueue: q = [] } = await ST.get('csvJobQueue');
        const total   = q.length;
        const pending = q.filter(j => j.status === 'pending').length;
        const running = q.filter(j => j.status === 'running').length;
        const done    = q.filter(j => j.status === 'done').length;
        const failed  = q.filter(j => j.status === 'failed').length;
        const skipped = q.filter(j => j.status === 'skipped').length;
        const dupes   = q.filter(j => j.status === 'duplicate').length;
        const completed = done + failed + skipped + dupes;
        const runIdx = q.findIndex(j => j.status === 'running');
        return { total, pending, running, done, failed, skipped, dupes, completed, runIdx, queue: q };
      } catch (_) { return { total: 0, pending: 0, running: 0, done: 0, failed: 0, skipped: 0, dupes: 0, completed: 0, runIdx: -1, queue: [] }; }
    }

    /* ── Create overlay DOM inside Shadow DOM ── */
    function createOverlay() {
      if (document.getElementById(OVERLAY_ID)) return;

      overlayHost = document.createElement('div');
      overlayHost.id = OVERLAY_ID;
      overlayHost.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
      document.body.appendChild(overlayHost);

      shadow = overlayHost.attachShadow({ mode: 'closed' });

      const style = document.createElement('style');
      style.textContent = `
        *{box-sizing:border-box;margin:0;padding:0}
        :host{all:initial;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
        .overlay{
          width:340px;background:linear-gradient(135deg,#1a1e2e,#141826);
          border:1px solid rgba(99,102,241,.3);border-radius:14px;
          box-shadow:0 8px 32px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.05);
          color:#e2e8f0;font-size:13px;overflow:hidden;
          transition:width .3s ease,height .3s ease;
          user-select:none;
        }
        .overlay.minimized .ov-body{display:none}
        .overlay.minimized{width:auto;border-radius:12px}

        /* Header / drag handle */
        .ov-header{
          display:flex;align-items:center;justify-content:space-between;
          padding:12px 14px;cursor:move;
          background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.15));
          border-bottom:1px solid rgba(99,102,241,.2);
        }
        .ov-header-left{display:flex;align-items:center;gap:8px}
        .ov-pulse{
          width:8px;height:8px;border-radius:50%;background:#4ade80;flex-shrink:0;
          animation:ovPulse 1.5s ease-in-out infinite;
        }
        .ov-pulse.paused{background:#fbbf24;animation:none}
        .ov-pulse.done{background:#22c55e;animation:none}
        @keyframes ovPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
        .ov-title{font-size:12px;font-weight:700;letter-spacing:.03em;color:#c7d2fe}
        .ov-header-btns{display:flex;gap:4px}
        .ov-header-btns button{
          background:none;border:none;color:#94a3b8;cursor:pointer;
          width:24px;height:24px;display:flex;align-items:center;justify-content:center;
          border-radius:6px;font-size:14px;transition:all .15s;
        }
        .ov-header-btns button:hover{background:rgba(255,255,255,.1);color:#e2e8f0}

        /* Mini badge when minimized */
        .ov-mini-badge{
          display:none;padding:2px 10px;font-size:12px;font-weight:700;
          color:#c7d2fe;white-space:nowrap;
        }
        .overlay.minimized .ov-mini-badge{display:inline}

        /* Body */
        .ov-body{padding:14px}

        /* Job counter */
        .ov-counter{
          font-size:20px;font-weight:800;text-align:center;margin-bottom:6px;
          background:linear-gradient(135deg,#818cf8,#a78bfa);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;
          background-clip:text;
        }
        .ov-subtitle{font-size:11px;color:#64748b;text-align:center;margin-bottom:12px}

        /* Progress bar */
        .ov-progress-track{
          height:6px;background:rgba(255,255,255,.08);border-radius:3px;
          margin-bottom:10px;overflow:hidden;
        }
        .ov-progress-fill{
          height:100%;border-radius:3px;transition:width .5s ease;
          background:linear-gradient(90deg,#6366f1,#8b5cf6);
        }

        /* Current job */
        .ov-job{
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);
          border-radius:8px;padding:8px 10px;margin-bottom:10px;
        }
        .ov-job-label{font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
        .ov-job-url{
          font-size:12px;color:#93c5fd;word-break:break-all;
          display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
        }

        /* Status line */
        .ov-status{font-size:12px;margin-bottom:12px;display:flex;align-items:center;gap:6px}
        .ov-status-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
        .ov-status-dot.running{background:#4ade80}
        .ov-status-dot.success{background:#22c55e}
        .ov-status-dot.failed{background:#f87171}
        .ov-status-dot.paused{background:#fbbf24}

        /* Stats row */
        .ov-stats{display:flex;gap:6px;margin-bottom:12px}
        .ov-stat{
          flex:1;text-align:center;padding:6px 4px;
          background:rgba(255,255,255,.03);border-radius:6px;
          border:1px solid rgba(255,255,255,.05);
        }
        .ov-stat-val{font-size:14px;font-weight:700}
        .ov-stat-val.s-done{color:#4ade80}
        .ov-stat-val.s-fail{color:#f87171}
        .ov-stat-val.s-skip{color:#fbbf24}
        .ov-stat-lbl{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:1px}

        /* Buttons */
        .ov-controls{display:flex;gap:6px}
        .ov-btn{
          flex:1;padding:8px 0;border:none;border-radius:8px;
          font-size:12px;font-weight:600;cursor:pointer;
          transition:all .15s;display:flex;align-items:center;justify-content:center;gap:4px;
        }
        .ov-btn:active{transform:scale(.96)}
        .ov-btn-pause{background:rgba(99,102,241,.2);color:#a5b4fc;border:1px solid rgba(99,102,241,.3)}
        .ov-btn-pause:hover{background:rgba(99,102,241,.35)}
        .ov-btn-skip{background:rgba(251,191,36,.15);color:#fde68a;border:1px solid rgba(251,191,36,.25)}
        .ov-btn-skip:hover{background:rgba(251,191,36,.3)}
        .ov-btn-quit{background:rgba(239,68,68,.15);color:#fca5a5;border:1px solid rgba(239,68,68,.25)}
        .ov-btn-quit:hover{background:rgba(239,68,68,.3)}

        /* Done state */
        .ov-done-msg{
          text-align:center;padding:8px 0;font-size:14px;font-weight:700;
          color:#4ade80;display:none;
        }
        .overlay.all-done .ov-done-msg{display:block}
        .overlay.all-done .ov-controls{display:none}
        .overlay.all-done .ov-status{display:none}
      `;

      const container = document.createElement('div');
      container.className = 'overlay';
      container.innerHTML = `
        <div class="ov-header">
          <div class="ov-header-left">
            <div class="ov-pulse"></div>
            <span class="ov-title">Automation In Progress</span>
            <span class="ov-mini-badge"></span>
          </div>
          <div class="ov-header-btns">
            <button class="ov-minimize" title="Minimize">─</button>
            <button class="ov-close" title="Stop & Close">✕</button>
          </div>
        </div>
        <div class="ov-body">
          <div class="ov-counter">Job 0 of 0</div>
          <div class="ov-subtitle">Auto-applying to job applications</div>
          <div class="ov-progress-track"><div class="ov-progress-fill" style="width:0%"></div></div>
          <div class="ov-job">
            <div class="ov-job-label">Current Job</div>
            <div class="ov-job-url">Waiting...</div>
          </div>
          <div class="ov-status">
            <div class="ov-status-dot running"></div>
            <span class="ov-status-text">Starting automation...</span>
          </div>
          <div class="ov-stats">
            <div class="ov-stat"><div class="ov-stat-val s-done" data-stat="done">0</div><div class="ov-stat-lbl">Applied</div></div>
            <div class="ov-stat"><div class="ov-stat-val s-fail" data-stat="failed">0</div><div class="ov-stat-lbl">Failed</div></div>
            <div class="ov-stat"><div class="ov-stat-val s-skip" data-stat="skipped">0</div><div class="ov-stat-lbl">Skipped</div></div>
          </div>
          <div class="ov-controls">
            <button class="ov-btn ov-btn-pause">⏸ Pause</button>
            <button class="ov-btn ov-btn-skip">⏭ Skip</button>
            <button class="ov-btn ov-btn-quit">⏹ Quit</button>
          </div>
          <div class="ov-done-msg">All Done!</div>
        </div>
      `;

      shadow.appendChild(style);
      shadow.appendChild(container);

      /* ── Drag logic ── */
      const header = shadow.querySelector('.ov-header');
      let isDragging = false, dragX = 0, dragY = 0;
      header.addEventListener('mousedown', e => {
        if (e.target.closest('button')) return;
        isDragging = true;
        dragX = e.clientX - overlayHost.getBoundingClientRect().left;
        dragY = e.clientY - overlayHost.getBoundingClientRect().top;
        e.preventDefault();
      });
      document.addEventListener('mousemove', e => {
        if (!isDragging) return;
        let nx = e.clientX - dragX;
        let ny = e.clientY - dragY;
        nx = Math.max(0, Math.min(window.innerWidth - 60, nx));
        ny = Math.max(0, Math.min(window.innerHeight - 40, ny));
        overlayHost.style.left   = nx + 'px';
        overlayHost.style.top    = ny + 'px';
        overlayHost.style.right  = 'auto';
        overlayHost.style.bottom = 'auto';
      });
      document.addEventListener('mouseup', () => { isDragging = false; });

      /* ── Minimize toggle ── */
      shadow.querySelector('.ov-minimize').addEventListener('click', () => {
        _isMinimized = !_isMinimized;
        container.classList.toggle('minimized', _isMinimized);
        shadow.querySelector('.ov-minimize').textContent = _isMinimized ? '□' : '─';
        updateMiniBadge();
      });

      /* ── Close / Quit ── */
      const removeOverlay = () => {
        try { chrome.runtime.sendMessage({ type: 'STOP_CSV_QUEUE' }).catch(() => {}); } catch (_) {}
        destroyOverlay();
      };
      shadow.querySelector('.ov-close').addEventListener('click', removeOverlay);
      shadow.querySelector('.ov-btn-quit').addEventListener('click', removeOverlay);

      /* ── Pause / Resume ── */
      shadow.querySelector('.ov-btn-pause').addEventListener('click', () => {
        _isPaused = !_isPaused;
        const btn = shadow.querySelector('.ov-btn-pause');
        const pulse = shadow.querySelector('.ov-pulse');
        const statusDot = shadow.querySelector('.ov-status-dot');
        if (_isPaused) {
          try { chrome.runtime.sendMessage({ type: 'PAUSE_CSV_QUEUE' }).catch(() => {}); } catch (_) {}
          btn.textContent = '▶ Resume';
          pulse.classList.add('paused');
          statusDot.className = 'ov-status-dot paused';
          shadow.querySelector('.ov-status-text').textContent = 'Paused';
          shadow.querySelector('.ov-title').textContent = 'Automation Paused';
        } else {
          try { chrome.runtime.sendMessage({ type: 'RESUME_CSV_QUEUE' }).catch(() => {}); } catch (_) {}
          btn.textContent = '⏸ Pause';
          pulse.classList.remove('paused');
          statusDot.className = 'ov-status-dot running';
          shadow.querySelector('.ov-status-text').textContent = 'Filling application form...';
          shadow.querySelector('.ov-title').textContent = 'Automation In Progress';
        }
      });

      /* ── Skip ── */
      shadow.querySelector('.ov-btn-skip').addEventListener('click', () => {
        try { chrome.runtime.sendMessage({ type: 'SKIP_CSV_JOB' }).catch(() => {}); } catch (_) {}
        shadow.querySelector('.ov-status-text').textContent = 'Skipping current job...';
      });

      LOG('CSV overlay created');
    }

    function destroyOverlay() {
      if (overlayHost && overlayHost.parentNode) {
        overlayHost.parentNode.removeChild(overlayHost);
      }
      overlayHost = null;
      shadow = null;
      if (_syncInterval) { clearInterval(_syncInterval); _syncInterval = null; }
    }

    function updateMiniBadge() {
      if (!shadow) return;
      const badge = shadow.querySelector('.ov-mini-badge');
      if (badge) badge.textContent = `${_completedJobs} / ${_totalJobs}`;
    }

    /* ── Update the overlay UI ── */
    function updateOverlayUI(stats) {
      if (!shadow) return;
      const { total, done, failed, dupes, completed, runIdx, queue } = stats;
      _totalJobs = total;
      _completedJobs = completed;

      // Find running job
      const runningJob = queue.find(j => j.status === 'running');
      const currentIdx = runningJob ? queue.indexOf(runningJob) + 1 : completed;

      shadow.querySelector('.ov-counter').textContent = `Job ${currentIdx} of ${total}`;
      const pct = total > 0 ? Math.round(completed / total * 100) : 0;
      shadow.querySelector('.ov-progress-fill').style.width = pct + '%';
      shadow.querySelector('.ov-subtitle').textContent = `${pct}% complete · ${total - completed} remaining`;

      if (runningJob) {
        shadow.querySelector('.ov-job-url').textContent = runningJob.url;
      }

      shadow.querySelector('[data-stat="done"]').textContent = done;
      shadow.querySelector('[data-stat="failed"]').textContent = failed;
      shadow.querySelector('[data-stat="skipped"]').textContent = (stats.skipped || 0) + dupes;

      updateMiniBadge();
    }

    /* ── Show "all done" state ── */
    function showDoneState() {
      if (!shadow) return;
      const container = shadow.querySelector('.overlay');
      container.classList.add('all-done');
      shadow.querySelector('.ov-pulse').classList.add('done');
      shadow.querySelector('.ov-title').textContent = 'Automation Complete';
      shadow.querySelector('.ov-done-msg').style.display = 'block';
      // Auto-remove after 8s
      setTimeout(destroyOverlay, 8000);
    }

    /* ── Listen for messages from background ── */
    chrome.runtime.onMessage.addListener(msg => {
      if (!msg || !msg.type) return;

      if (msg.type === 'CSV_JOB_STARTED') {
        if (!shadow) {
          // Create overlay if this is the automation tab
          isAutomationTab().then(isActive => {
            if (!isActive) return;
            createOverlay();
            readQueueStats().then(updateOverlayUI);
          });
        } else {
          shadow.querySelector('.ov-job-url').textContent = msg.url || '';
          if (!_isPaused) {
            shadow.querySelector('.ov-status-text').textContent = 'Filling application form...';
            shadow.querySelector('.ov-status-dot').className = 'ov-status-dot running';
          }
          readQueueStats().then(updateOverlayUI);
        }
      }

      if (msg.type === 'CSV_JOB_COMPLETE') {
        if (!shadow) return;
        const statusMap = {
          done:      'Applied successfully',
          failed:    'Failed' + (msg.reason ? ': ' + msg.reason.slice(0, 40) : ''),
          skipped:   'Skipped' + (msg.reason ? ': ' + msg.reason.slice(0, 40) : ''),
          duplicate: 'Already applied — skipped',
        };
        const dotClass = msg.status === 'done' ? 'success' : msg.status === 'failed' ? 'failed' : 'running';
        shadow.querySelector('.ov-status-text').textContent = statusMap[msg.status] || msg.status;
        shadow.querySelector('.ov-status-dot').className = 'ov-status-dot ' + dotClass;
        readQueueStats().then(updateOverlayUI);
      }

      if (msg.type === 'CSV_QUEUE_DONE') {
        readQueueStats().then(stats => {
          updateOverlayUI(stats);
          showDoneState();
        });
      }

      if (msg.type === 'CSV_QUEUE_PAUSED') {
        _isPaused = true;
        if (shadow) {
          shadow.querySelector('.ov-btn-pause').textContent = '▶ Resume';
          shadow.querySelector('.ov-pulse').classList.add('paused');
          shadow.querySelector('.ov-status-dot').className = 'ov-status-dot paused';
          shadow.querySelector('.ov-status-text').textContent = 'Paused';
          shadow.querySelector('.ov-title').textContent = 'Automation Paused';
        }
      }
    });

    /* ── Initial check: if automation is already running, show overlay ── */
    async function showOverlay() {
      const active = await isAutomationTab();
      if (!active) return;
      createOverlay();
      const stats = await readQueueStats();
      updateOverlayUI(stats);
    }

    // Check on page load
    sleep(1500).then(showOverlay);

    // Periodic sync (handles tab reloads, external stops, etc.)
    _syncInterval = setInterval(async () => {
      try {
        const data = await ST.get(['csvQueueRunning']);
        if (!data.csvQueueRunning) {
          if (shadow) destroyOverlay();
          return;
        }
        if (shadow) {
          const stats = await readQueueStats();
          updateOverlayUI(stats);
        }
      } catch (_) {
        // Extension context invalidated — stop syncing
        clearInterval(_syncInterval);
        _syncInterval = null;
      }
    }, 4000);

  })();

  LOG(`v4.2 loaded | ${CURRENT_ATS || HOST}`);
})();
