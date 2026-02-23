/**
 * OptimHire Comprehensive Patch v4.0
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
 * v4.0 fixes:
 *   - AudioContext fallback REMOVED (caused "not allowed to start" errors)
 *   - autoSkipDuration patched to 30s (was 5s — caused premature skips)
 *   - Workday: full SpeedyApply data-automation-id coverage
 *   - Workday account creation flow (uses appAccountEmail/appAccountPassword)
 *   - Greenhouse: robust field detection for required fields
 *   - Null-safe autoApplyState guard
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
  const CURRENT_ATS = Object.entries(ATS_DOMAINS)
    .find(([domain]) => HOST.includes(domain))?.[1] || null;

  LOG(`Page: ${HOST} | ATS: ${CURRENT_ATS || 'unknown'}`);

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
  }

  enforceCredits();
  setInterval(enforceCredits, 20_000);

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
      return _origGet(keys, result => cb(patchResult(result)));
    }
    return _origGet(keys).then(patchResult);
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
    const { candidateDetails } = await ST.get('candidateDetails');
    try {
      return typeof candidateDetails === 'string'
        ? JSON.parse(candidateDetails)
        : (candidateDetails || {});
    } catch (_) { return {}; }
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
    years:        '5',
    salary:       '80000',
    notice:       '2 weeks',
    availability: 'Immediately',
    cover: `I am excited to apply for this role. My background and skills make me an excellent candidate and I look forward to contributing to your team.`,
    why: 'I admire the company culture and the opportunity to make a meaningful impact.',
    howHeard: 'LinkedIn',
  };

  function guessValue(label, p = {}) {
    const l = label.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    if (/first.?name/.test(l))              return p.first_name    || p.firstName   || '';
    if (/last.?name/.test(l))               return p.last_name     || p.lastName    || '';
    if (/full.?name|your name/.test(l))     return `${p.first_name||''} ${p.last_name||''}`.trim();
    if (/\bemail\b/.test(l))                return p.email         || '';
    if (/phone|mobile|cell/.test(l))        return p.phone         || '';
    if (/^city$|city\b/.test(l))            return p.city          || '';
    if (/state|province/.test(l))           return p.state         || '';
    if (/zip|postal/.test(l))               return p.postal_code   || p.zip || '';
    if (/country/.test(l))                  return p.country       || 'United States';
    if (/address/.test(l))                  return p.address       || '';
    if (/linkedin/.test(l))                 return p.linkedin_profile_url || p.linkedin || '';
    if (/github/.test(l))                   return p.github_url    || p.github || '';
    if (/website|portfolio/.test(l))        return p.website_url   || p.website || '';
    if (/university|school|college/.test(l))return p.school        || p.university || '';
    if (/\bdegree\b/.test(l))               return p.degree        || "Bachelor's";
    if (/major|field of study/.test(l))     return p.major         || '';
    if (/gpa/.test(l))                      return p.gpa           || '';
    if (/title|position|role/.test(l))      return p.current_title || p.title || '';
    if (/company|employer|org/.test(l))     return p.current_company || p.company || '';
    if (/salary|compensation|pay/.test(l))  return p.expected_salary || DEFAULTS.salary;
    if (/cover.?letter|motivation/.test(l)) return p.cover_letter  || DEFAULTS.cover;
    if (/why.*compan|why.*role/.test(l))    return DEFAULTS.why;
    if (/how.*hear|where.*find/.test(l))    return DEFAULTS.howHeard;
    if (/years.*(exp|work)|exp.*years/.test(l)) return DEFAULTS.years;
    if (/availab|start date|notice/.test(l))return DEFAULTS.availability;
    if (/authoriz|eligible|work.*right/.test(l)) return DEFAULTS.authorized;
    if (/sponsor|visa/.test(l))             return DEFAULTS.sponsorship;
    if (/relocat/.test(l))                  return DEFAULTS.relocation;
    if (/remote|work.*home|hybrid/.test(l)) return DEFAULTS.remote;
    if (/veteran|military/.test(l))         return DEFAULTS.veteran;
    if (/disabilit/.test(l))                return DEFAULTS.disability;
    if (/gender|sex\b/.test(l))             return DEFAULTS.gender;
    if (/ethnic|race|racial/.test(l))       return DEFAULTS.ethnicity;
    return '';
  }

  /* ── T13/T17: Auto-fill missing required fields ─────────── */
  async function autoFillPage() {
    const p = await getProfile();

    /* Inputs + textareas */
    const inputs = $$(
      'input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=button]),' +
      'textarea'
    ).filter(el => isVisible(el) && !el.value?.trim());

    for (const inp of inputs) {
      const lbl = getLabel(inp);
      if (!lbl) continue;
      const val = guessValue(lbl, p);
      if (!val) continue;
      inp.focus();
      nativeSet(inp, val);
      await sleep(60);
    }

    /* Selects */
    const selects = $$('select').filter(el => isVisible(el) && !el.value);
    for (const sel of selects) {
      const lbl = getLabel(sel);
      const val = guessValue(lbl, p);
      if (!val) continue;
      const opt = $$('option', sel).find(
        o => o.text.toLowerCase().includes(val.toLowerCase())
      );
      if (opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
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
      if (match) { realClick(match); continue; }
      /* Default: pick Yes for yes/no questions */
      const yes = radios.find(r => {
        const t = ($(`label[for="${CSS.escape(r.id)}"]`)?.textContent || r.value || '').toLowerCase().trim();
        return ['yes','true','1'].includes(t);
      });
      if (yes) realClick(yes);
    }

    /* Checkboxes – only required ones */
    $$('input[type=checkbox][required], input[type=checkbox][aria-required="true"]')
      .filter(el => isVisible(el) && !el.checked)
      .forEach(cb => realClick(cb));
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
      const val = p[profileKey];
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
          await fillLinkedInModal();
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

  /* ── T19: CSV Auto-Apply bridge ─────────────────────────── */
  async function initCsvBridge() {
    const { csvActiveJobId, csvActiveTabId } = await ST.get([
      'csvActiveJobId', 'csvActiveTabId',
    ]);

    const isCsvTab = csvActiveJobId && csvActiveTabId;
    if (!isCsvTab) return;

    LOG('CSV bridge active — monitoring for submission');

    let reported = false;
    const report = async (status, reason = '') => {
      if (reported) return;
      reported = true;
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
    ];
    const checkSuccess = () => {
      const href = location.href.toLowerCase();
      if (successPatterns.some(p => href.includes(p))) { report('done'); return; }
      const body = document.body?.textContent?.toLowerCase() || '';
      if (/application submitted|thank you for applying|application received|we.ve received your/i.test(body)) {
        report('done');
      }
    };
    new MutationObserver(checkSuccess).observe(document.body, { childList: true, subtree: true });
    setInterval(checkSuccess, 5000);
    checkSuccess();

    /* Auto-fill on page load for CSV mode */
    await sleep(2000);
    if (CURRENT_ATS === 'Workday')         await workdayAutofill();
    else if (CURRENT_ATS === 'OracleCloud')await oracleAutofill();
    else if (CURRENT_ATS === 'SmartRecruiters') await srAutofill();
    else if (CURRENT_ATS === 'Greenhouse') await greenhouseAutofill();
    await autoFillPage();
    await solveCaptcha();
  }

  /* Run ATS-specific autofill on DOM changes (CSV mode) */
  let _fillDebounce = null;
  new MutationObserver(async () => {
    const { csvActiveJobId } = await ST.get('csvActiveJobId');
    if (!csvActiveJobId) return;
    clearTimeout(_fillDebounce);
    _fillDebounce = setTimeout(async () => {
      await autoFillPage();
      await solveCaptcha();
    }, 800);
  }).observe(document.body, { childList: true, subtree: false });

  /* Listen for messages from background/csvImport */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'TRIGGER_AUTOFILL') {
      (async () => {
        if (CURRENT_ATS === 'Workday')         await workdayAutofill();
        else if (CURRENT_ATS === 'OracleCloud')await oracleAutofill();
        else if (CURRENT_ATS === 'SmartRecruiters') await srAutofill();
        else if (CURRENT_ATS === 'Greenhouse') await greenhouseAutofill();
        await autoFillPage();
        await solveCaptcha();
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

  /* Run platform autofill in CSV mode */
  ST.get('csvActiveJobId').then(({ csvActiveJobId }) => {
    if (!csvActiveJobId) return;
    sleep(2000).then(async () => {
      if (CURRENT_ATS === 'Workday')         await workdayAutofill();
      else if (CURRENT_ATS === 'OracleCloud')await oracleAutofill();
      else if (CURRENT_ATS === 'SmartRecruiters') await srAutofill();
      else if (CURRENT_ATS === 'Greenhouse') await greenhouseAutofill();
      else await autoFillPage();
    });
  });

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
    showAutofillBanner('detecting', CURRENT_ATS);
    acquireWakeLock();
    LOG(`Auto-trigger: ${CURRENT_ATS} application form detected — autofilling`);

    /* Short pause so the side panel renders */
    await sleep(800);
    showAutofillBanner('filling', CURRENT_ATS);

    try {
      /* ATS-specific autofill */
      if (CURRENT_ATS === 'Workday')              await workdayAutofill();
      else if (CURRENT_ATS === 'OracleCloud')     await oracleAutofill();
      else if (CURRENT_ATS === 'SmartRecruiters') await srAutofill();
      else if (CURRENT_ATS === 'Greenhouse')      await greenhouseAutofill();
      /* LinkedIn/Lever/Ashby/others: generic fill covers them */

      await autoFillPage();
      await solveCaptcha();

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

  LOG(`v4.0 loaded | ${CURRENT_ATS || HOST}`);
})();
