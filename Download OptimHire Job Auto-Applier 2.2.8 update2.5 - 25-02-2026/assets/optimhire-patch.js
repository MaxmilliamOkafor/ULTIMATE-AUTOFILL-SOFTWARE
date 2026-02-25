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
  const ST = chrome.storage.local;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
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
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  /** Real pointer-events click sequence */
  function realClick(el) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.click();
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.offsetParent !== null;
  }

  /* ── T1: Supported ATS domains ─────────────────────────── */
  const ATS_DOMAINS = {
    'greenhouse.io': 'Greenhouse',
    'lever.co': 'Lever',
    'breezy.hr': 'BreezyHR',
    'myworkdayjobs.com': 'Workday',
    'workday.com': 'Workday',
    'icims.com': 'iCIMS',
    'taleo.net': 'Taleo',
    'oraclecloud.com': 'OracleCloud',
    'fa.oraclecloud.com': 'OracleCloud',
    'smartrecruiters.com': 'SmartRecruiters',
    'ashbyhq.com': 'Ashby',
    'bamboohr.com': 'BambooHR',
    'jobvite.com': 'Jobvite',
    'apply.workable.com': 'Workable',
    'paylocity.com': 'Paylocity',
    'jazzhr.com': 'JazzHR',
    'ziprecruiter.com': 'ZipRecruiter',
    'manatal.com': 'Manatal',
    'teamtailor.com': 'Teamtailor',
    'bullhorn.com': 'Bullhorn',
    'dice.com': 'Dice',
    'hiring.cafe': 'HiringCafe',
    'indeed.com': 'Indeed',
    'linkedin.com': 'LinkedIn',
    'jobs.lever.co': 'Lever',
    'boards.greenhouse.io': 'Greenhouse',
    'apply.lever.co': 'Lever',
    'recruiting.ultipro.com': 'UKG',
    'jobs.smartrecruiters.com': 'SmartRecruiters',
    'careers.icims.com': 'iCIMS',
  };

  const HOST = location.hostname.toLowerCase().replace(/^www\./, '');
  const _rawATS = Object.entries(ATS_DOMAINS)
    .find(([domain]) => HOST.includes(domain))?.[1] || null;
  // LinkedIn: activate on /jobs, /in/, and company pages — not on feeds or messaging
  const CURRENT_ATS = _rawATS === 'LinkedIn'
    ? (/^\/(jobs|in|company|hiring)/.test(location.pathname) ? 'LinkedIn' : null)
    : _rawATS;

  LOG(`Page: ${HOST} | ATS: ${CURRENT_ATS || 'unknown'}`);

  /* ── T2: Credits never run out ──────────────────────────── */
  const CREDIT_FIELDS = [
    'free_left_credits', 'leftCredits', 'remainingCredits',
    'credits', 'autofillCredits', 'plan_credits', 'totalCredits',
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
      const keys = ['candidateDetails', 'userDetails', 'planDetails', 'subscriptionDetails'];
      const data = await ST.get(keys);
      const upd = {};
      keys.forEach(k => {
        if (!data[k]) return;
        try {
          const parsed = typeof data[k] === 'string' ? JSON.parse(data[k]) : data[k];
          const patched = deepPatchCredits(JSON.parse(JSON.stringify(parsed)));
          upd[k] = typeof data[k] === 'string' ? JSON.stringify(patched) : patched;
        } catch (_) { }
      });
      if (Object.keys(upd).length) await ST.set(upd);
    } catch (_) {
      // Extension context may have been invalidated (e.g. after reload) — ignore
    }
  }

  enforceCredits().catch(() => { });
  setInterval(() => enforceCredits().catch(() => { }), 20_000);

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
          } catch (_) { }
        }
      });
      return result;
    };
    if (typeof cb === 'function') {
      try {
        return _origGet(keys, result => cb(patchResult(result)));
      } catch (_) {
        // Extension context invalidated — return empty result
        try { cb({}); } catch (__) { }
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
    if (['start_pilot_web', 'START_AUTOMATION', 'pilot_started', 'CSV_JOB_START']
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
    const { candidateDetails, userDetails } = await ST.get(['candidateDetails', 'userDetails']);
    try {
      const parsed = typeof candidateDetails === 'string'
        ? JSON.parse(candidateDetails)
        : (candidateDetails || {});
      const userParsed = typeof userDetails === 'string'
        ? JSON.parse(userDetails)
        : (userDetails || {});
      return normalizeProfile({ ...userParsed, ...parsed });
    } catch (_) { return {}; }
  }

  function pickFirst(...vals) {
    for (const v of vals) {
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number') return String(v);
    }
    return '';
  }

  function normalizeProfile(raw = {}) {
    const p = { ...(raw || {}) };
    p.first_name = pickFirst(p.first_name, p.firstName, p.firstname, p.given_name, p.givenName);
    p.last_name = pickFirst(p.last_name, p.lastName, p.lastname, p.family_name, p.familyName);
    p.email = pickFirst(p.email, p.emailAddress, p.email_address, p.primaryEmail, p.workEmail);
    p.phone = pickFirst(
      p.phone, p.phoneNumber, p.phone_number, p.mobile, p.mobileNumber,
      p.contactNumber, p.telephone
    );
    p.linkedin_profile_url = pickFirst(
      p.linkedin_profile_url, p.linkedin, p.linkedIn, p.linkedinUrl, p.linkedin_url
    );
    p.website_url = pickFirst(p.website_url, p.website, p.portfolio, p.portfolio_url, p.personalWebsite);
    p.github_url = pickFirst(p.github_url, p.github, p.githubUrl);
    p.city = pickFirst(p.city, p.currentCity, p.locationCity);
    p.state = pickFirst(p.state, p.region, p.province);
    p.country = pickFirst(p.country, p.countryName);
    p.postal_code = pickFirst(p.postal_code, p.zip, p.zipCode, p.postcode);
    p.address = pickFirst(p.address, p.streetAddress, p.addressLine1);
    p.current_title = pickFirst(p.current_title, p.currentTitle, p.title);
    p.current_company = pickFirst(p.current_company, p.currentCompany, p.company);

    const nested = p.profile || p.candidate || p.user || p.basics || {};
    p.first_name = pickFirst(p.first_name, nested.first_name, nested.firstName, nested.firstname);
    p.last_name = pickFirst(p.last_name, nested.last_name, nested.lastName, nested.lastname);
    p.email = pickFirst(p.email, nested.email, nested.emailAddress, nested.email_address);
    p.phone = pickFirst(p.phone, nested.phone, nested.phoneNumber, nested.mobile, nested.mobileNumber);
    p.linkedin_profile_url = pickFirst(
      p.linkedin_profile_url,
      nested.linkedin_profile_url,
      nested.linkedin,
      nested.linkedIn,
      nested.linkedinUrl
    );
    p.website_url = pickFirst(p.website_url, nested.website_url, nested.website, nested.portfolio, nested.portfolio_url);

    return p;
  }

  const _responseBankCache = { loaded: false, entries: [], ts: 0 };
  const RESPONSE_BANK_TTL_MS = 10_000;

  function normalizeText(v) {
    return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function addResponseEntry(entries, keyText, response) {
    const key = normalizeText(keyText);
    const val = String(response || '').trim();
    if (!key || !val) return;
    if (entries.some(e => e.key === key && e.value === val)) return;
    entries.push({ key, value: val });
  }

  function collectResponseEntries(node, entries) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(item => collectResponseEntries(item, entries));
      return;
    }
    if (typeof node !== 'object') return;

    const response = node.response || node.answer || node.value || node.selected || node.a || node.text;
    if (response && (node.question || node.key || node.id || node.label)) {
      addResponseEntry(entries, node.question, response);
      addResponseEntry(entries, node.key, response);
      addResponseEntry(entries, node.label, response);
      addResponseEntry(entries, node.id, response);
      if (Array.isArray(node.keywords)) node.keywords.forEach(k => addResponseEntry(entries, k, response));
    }

    Object.values(node).forEach(v => collectResponseEntries(v, entries));
  }

  async function getResponseBank() {
    if (_responseBankCache.loaded && (Date.now() - _responseBankCache.ts) < RESPONSE_BANK_TTL_MS) {
      return _responseBankCache.entries;
    }
    const keys = [
      'applicationDetails', 'complexFormData', 'manualComplexInstructions',
      'manualApplicationDetail', 'responses', 'questionAnswers', 'candidateDetails',
      'missing_details', 'missingDetails', 'missingQuestionDetails', 'userDetails',
    ];
    const raw = await ST.get(keys);
    const entries = [];

    for (const val of Object.values(raw || {})) {
      if (!val) continue;
      try {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        collectResponseEntries(parsed, entries);
      } catch (_) { }
    }

    _responseBankCache.loaded = true;
    _responseBankCache.entries = entries;
    _responseBankCache.ts = Date.now();
    return entries;
  }

  function getResponseValue(label, el, entries) {
    if (!entries?.length) return '';
    const candidates = [
      label,
      getLabel(el),
      el?.name,
      el?.id,
      el?.placeholder,
      el?.getAttribute?.('aria-label'),
    ].map(normalizeText).filter(Boolean);

    for (const c of candidates) {
      const exact = entries.find(e => e.key === c);
      if (exact) return exact.value;
    }

    for (const c of candidates) {
      const matched = entries.find(e => c.includes(e.key) || e.key.includes(c));
      if (matched) return matched.value;
    }

    return '';
  }

  function guessFieldValue(label, p, el, responseEntries = []) {
    return guessValue(label, p) || getResponseValue(label, el, responseEntries) || '';
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const refreshKeys = [
      'applicationDetails', 'complexFormData', 'manualComplexInstructions',
      'manualApplicationDetail', 'responses', 'questionAnswers', 'candidateDetails',
      'missing_details', 'missingDetails', 'missingQuestionDetails', 'userDetails',
    ];
    for (const k of refreshKeys) {
      if (changes[k]) {
        _responseBankCache.loaded = false;
        _responseBankCache.entries = [];
        _responseBankCache.ts = 0;
        break;
      }
    }
  });

  /* ── Applications Account helper ────────────────────────── */
  async function getAppAccount() {
    const data = await ST.get(['appAccountEmail', 'appAccountPassword']);
    return {
      email: data.appAccountEmail || '',
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
    authorized: 'Yes',
    sponsorship: 'No',
    relocation: 'Yes',
    remote: 'Yes',
    veteran: 'I am not a protected veteran',
    disability: 'I do not have a disability',
    gender: 'Prefer not to say',
    ethnicity: 'Prefer not to say',
    race: 'Prefer not to say',
    years: '5',
    salary: '80000',
    notice: '2 weeks',
    availability: 'Immediately',
    cover: `I am excited to apply for this role. My background and skills make me an excellent candidate and I look forward to contributing to your team.`,
    why: 'I admire the company culture and the opportunity to make a meaningful impact.',
    howHeard: 'LinkedIn',
  };

  function guessValue(label, p = {}) {
    const l = label.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    if (/first.?name|given.?name|prenom/.test(l)) return p.first_name || p.firstName || '';
    if (/last.?name|family.?name|surname/.test(l)) return p.last_name || p.lastName || '';
    if (/middle.?name/.test(l)) return p.middle_name || '';
    if (/preferred.?name|nick.?name/.test(l)) return p.preferred_name || p.first_name || '';
    if (/full.?name|your name|name/.test(l) && !/company|last|first|user/.test(l)) return `${p.first_name || ''} ${p.last_name || ''}`.trim();
    if (/\bemail\b/.test(l)) return p.email || '';
    if (/phone|mobile|cell|telephone/.test(l)) return p.phone || '';
    if (/^city$|\bcity\b|current.?city/.test(l)) return p.city || '';
    if (/state|province|region/.test(l)) return p.state || '';
    if (/zip|postal/.test(l)) return p.postal_code || p.zip || '';
    if (/country/.test(l)) return p.country || 'United States';
    if (/address|street/.test(l)) return p.address || '';
    if (/location|where.*(you|do you).*live/.test(l)) return p.city ? `${p.city}, ${p.state || ''}`.trim().replace(/,$/, '') : '';
    if (/linkedin/.test(l)) return p.linkedin_profile_url || p.linkedin || '';
    if (/github/.test(l)) return p.github_url || p.github || '';
    if (/website|portfolio|personal.?url/.test(l)) return p.website_url || p.website || '';
    if (/twitter|x\.com/.test(l)) return p.twitter_url || p.twitter || '';
    if (/university|school|college|alma.?mater/.test(l)) return p.school || p.university || '';
    if (/\bdegree\b|qualification/.test(l)) return p.degree || "Bachelor's";
    if (/major|field.?of.?study|concentration|specialization/.test(l)) return p.major || '';
    if (/gpa|grade.?point/.test(l)) return p.gpa || '';
    if (/graduation|grad.?date|grad.?year/.test(l)) return p.graduation_year || p.grad_year || '';
    if (/title|position|role|current.?title|job.?title/.test(l) && !/company/.test(l)) return p.current_title || p.title || '';
    if (/company|employer|org|current.?company/.test(l)) return p.current_company || p.company || '';
    if (/salary|compensation|pay|desired.?pay|expected.?comp/.test(l)) return p.expected_salary || DEFAULTS.salary;
    if (/cover.?letter|motivation|additional.?info|message.?to/.test(l)) return p.cover_letter || DEFAULTS.cover;
    if (/summary|about.?(yourself|you|me)|bio|objective|profile.?summary/.test(l)) return p.summary || p.cover_letter || DEFAULTS.cover;
    if (/why.*(compan|role|want|interest|position)/.test(l)) return DEFAULTS.why;
    if (/how.*hear|where.*(find|learn|discover)|source|referred.?by|referral/.test(l)) return DEFAULTS.howHeard;
    if (/years.*(exp|work)|exp.*years|total.*experience/.test(l)) return DEFAULTS.years;
    if (/availab|start.?date|notice|when.*start|earliest.*start/.test(l)) return DEFAULTS.availability;
    if (/authoriz|eligible|work.*right|legal.*right|permitted.*work/.test(l)) return DEFAULTS.authorized;
    if (/sponsor|visa|immigration|work.?permit/.test(l)) return DEFAULTS.sponsorship;
    if (/relocat|willing.*move|open.*reloc/.test(l)) return DEFAULTS.relocation;
    if (/remote|work.*home|hybrid|on.?site|work.?model|work.?arrangement/.test(l)) return DEFAULTS.remote;
    if (/veteran|military|armed.?forces|served/.test(l)) return DEFAULTS.veteran;
    if (/disabilit/.test(l)) return DEFAULTS.disability;
    if (/gender|sex\b|pronouns/.test(l)) return DEFAULTS.gender;
    if (/ethnic|race|racial|heritage/.test(l)) return DEFAULTS.ethnicity;
    if (/nationality|citizenship/.test(l)) return p.nationality || p.country || 'United States';
    if (/language|fluency|fluent/.test(l)) return p.languages || 'English';
    if (/certif|license|credential/.test(l)) return p.certifications || '';
    if (/commute|travel|willing.*travel/.test(l)) return 'Yes';
    if (/convicted|criminal|felony|background.?check/.test(l)) return 'No';
    if (/drug.?test|screening/.test(l)) return 'Yes';
    if (/\bage\b|18.*years|over.*18|at.*least.*18/.test(l)) return 'Yes';
    if (/agree|acknowledge|certif|attest|confirm|consent/.test(l)) return 'Yes';
    return '';
  }

  /* ── T13/T17: Auto-fill missing required fields ─────────── */

  /** Send field status updates to the sidebar via background relay */
  function reportFieldStatus(fields) {
    try {
      chrome.runtime.sendMessage({
        type: 'SIDEBAR_FIELD_LIST',
        fields: fields, // [{name, status:'filled'|'pending'|'failed', required:bool}]
      }).catch(() => { });
    } catch (_) { }
  }

  function reportFieldFilled(fieldName, status) {
    try {
      chrome.runtime.sendMessage({
        type: 'SIDEBAR_FIELD_UPDATE',
        fieldName: fieldName,
        status: status, // 'filled', 'pending', 'failed'
      }).catch(() => { });
    } catch (_) { }
  }

  function isFieldRequired(el) {
    if (!el) return false;
    if (el.required || el.getAttribute('aria-required') === 'true') return true;
    if (el.getAttribute('required') !== null) return true;

    const container = el.closest(
      '.field,.application-field,.question,[class*="field"],[class*="Field"],[class*="question"],[class*="Question"],li,div'
    );
    const label = getLabel(el);
    const labelText = (label || '').toLowerCase();
    if (/\*\s*$|required/.test(labelText)) return true;

    if (container) {
      if (container.classList.contains('required')) return true;
      if (container.getAttribute('data-required') === 'true') return true;
      if (container.querySelector('.required,.asterisk,[aria-label*="required" i]')) return true;
    }
    return false;
  }

  function hasFieldValue(el) {
    if (!el) return false;
    if (el.tagName === 'SELECT') {
      const val = (el.value || '').trim();
      if (!val) return false;
      const idx = el.selectedIndex;
      if (idx >= 0) {
        const opt = el.options[idx];
        const txt = (opt?.textContent || '').trim().toLowerCase();
        if (!txt || /select|choose|please|--/.test(txt)) return false;
      }
      return true;
    }
    if (el.type === 'checkbox' || el.type === 'radio') return !!el.checked;
    return !!el.value?.trim();
  }

  function getMissingRequiredFields() {
    const required = $$('input,textarea,select').filter(el => isVisible(el) && isFieldRequired(el));
    const missing = [];
    for (const el of required) {
      if (el.type === 'radio' && el.name) {
        const group = $$(`input[type="radio"][name="${CSS.escape(el.name)}"]`).filter(isVisible);
        if (group.some(r => r.checked)) continue;
      } else if (el.type === 'checkbox' && !el.checked) {
        // required checkbox must be checked
      } else if (hasFieldValue(el)) {
        continue;
      }
      const lbl = getLabel(el) || el.name || el.id || 'Required field';
      if (!missing.includes(lbl)) missing.push(lbl);
    }
    return missing;
  }

  async function autoFillPage(options = {}) {
    const p = await getProfile();
    const responseEntries = await getResponseBank();
    const requiredOnly = options.requiredOnly !== false;
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
      const isRequired = isFieldRequired(el);
      allFields.push({ name: lbl, status: hasFieldValue(el) ? 'filled' : 'pending', required: isRequired });
      if (isRequired && hasFieldValue(el)) filledCount++;
    }
    for (const el of allSelects) {
      const lbl = getLabel(el) || el.name || el.id || '';
      if (!lbl) continue;
      const isRequired = isFieldRequired(el);
      allFields.push({ name: lbl, status: hasFieldValue(el) ? 'filled' : 'pending', required: isRequired });
      if (isRequired && hasFieldValue(el)) filledCount++;
    }

    const requiredFields = allFields.filter(f => f.required);

    // Send initial field list to sidebar
    reportFieldStatus(allFields);
    // Send overall status
    try {
      chrome.runtime.sendMessage({
        type: 'SIDEBAR_STATUS',
        event: 'filling_progress',
        total: requiredFields.length,
        filled: filledCount,
        responses: Math.max(Object.keys(p).length, responseEntries.length),
      }).catch(() => { });
    } catch (_) { }

    /* Inputs + textareas — only unfilled */
    const inputs = allInputs.filter(el => !el.value?.trim() && (!requiredOnly || isFieldRequired(el)));

    for (const inp of inputs) {
      const lbl = getLabel(inp);
      if (!lbl) continue;
      const val = guessFieldValue(lbl, p, inp, responseEntries);
      if (!val) {
        reportFieldFilled(lbl, 'failed');
        continue;
      }
      inp.focus();
      nativeSet(inp, val);
      if (isFieldRequired(inp)) filledCount++;
      reportFieldFilled(lbl, 'filled');
      await sleep(60);
    }

    /* Selects */
    const selects = allSelects.filter(el => !el.value && (!requiredOnly || isFieldRequired(el)));
    for (const sel of selects) {
      const lbl = getLabel(sel);
      const val = guessFieldValue(lbl, p, sel, responseEntries);
      if (!val) {
        if (lbl) reportFieldFilled(lbl, 'failed');
        continue;
      }
      const opt = $$('option', sel).find(
        o => o.text.toLowerCase().includes(val.toLowerCase())
      );
      if (opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        if (isFieldRequired(sel)) filledCount++;
        reportFieldFilled(lbl, 'filled');
      } else {
        // Fallback: try to pick a reasonable default option
        const lblLower = (lbl || '').toLowerCase();
        const isEeo = /gender|disability|veteran|race|ethnicity|sex\b|heritage/i.test(lblLower);
        const options = $$('option', sel).filter(o => o.value && o.value !== '' && o.index > 0);
        let fallback = null;
        if (isEeo) {
          // EEO fields: prefer "Prefer not to say/Decline/I don't wish"
          fallback = options.find(o => /prefer not|decline|not to|do not|don.t wish/i.test(o.text));
        }
        if (!fallback && options.length > 0) {
          fallback = options[0]; // First valid option
        }
        if (fallback) {
          sel.value = fallback.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          if (isFieldRequired(sel)) filledCount++;
          reportFieldFilled(lbl, 'filled');
        } else {
          reportFieldFilled(lbl, 'failed');
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
      if (requiredOnly && !isFieldRequired(radios[0])) continue;
      const guess = guessFieldValue(lbl, p, radios[0], responseEntries);
      const match = radios.find(r => {
        const t = ($(`label[for="${CSS.escape(r.id)}"]`)?.textContent || r.value || '').toLowerCase();
        return guess && t.includes(guess.toLowerCase());
      });
      if (match) {
        realClick(match);
        reportFieldFilled(lbl, 'filled');
        if (isFieldRequired(radios[0])) filledCount++;
        continue;
      }
      /* Default: pick Yes for yes/no questions */
      const yes = radios.find(r => {
        const t = ($(`label[for="${CSS.escape(r.id)}"]`)?.textContent || r.value || '').toLowerCase().trim();
        return ['yes', 'true', '1'].includes(t);
      });
      if (yes) {
        realClick(yes);
        reportFieldFilled(lbl, 'filled');
        if (isFieldRequired(radios[0])) filledCount++;
      }
      else { reportFieldFilled(lbl, 'failed'); }
    }

    /* Checkboxes – only required ones */
    $$('input[type=checkbox][required], input[type=checkbox][aria-required="true"]')
      .filter(el => isVisible(el) && !el.checked)
      .forEach(cb => { realClick(cb); filledCount++; });

    const missingRequired = getMissingRequiredFields();

    // Final progress update
    try {
      chrome.runtime.sendMessage({
        type: 'SIDEBAR_STATUS',
        event: 'filling_progress',
        total: requiredFields.length,
        filled: Math.max(requiredFields.length - missingRequired.length, 0),
        responses: Math.max(Object.keys(p).length, responseEntries.length),
      }).catch(() => { });
    } catch (_) { }

    LOG(`autoFillPage: ${requiredFields.length - missingRequired.length} of ${requiredFields.length} required fields filled`);
    return {
      totalRequired: requiredFields.length,
      missingRequired,
    };
  }

  /* ── Greenhouse: robust required-field handling ───────────── */
  async function greenhouseAutofill() {
    const isGH = HOST.includes('greenhouse.io') || HOST.includes('boards.greenhouse.io') ||
      !!$('form#application_form,#application_form,[data-provided-by="greenhouse"]');
    if (!isGH) return;

    const p = await getProfile();
    const responseEntries = await getResponseBank();

    /* Map common Greenhouse field IDs/names */
    const GH_MAP = [
      ['#first_name,input[id*="first_name"],input[name*="first_name"]', p.first_name],
      ['#last_name,input[id*="last_name"],input[name*="last_name"]', p.last_name],
      ['#email,input[type="email"],input[id*="email"]', p.email],
      ['#phone,input[type="tel"],input[id*="phone"]', p.phone],
      ['input[id*="location"],input[name*="location"]', p.city || p.location || ''],
      ['input[id*="linkedin"],input[name*="linkedin"]', p.linkedin_profile_url || ''],
      ['input[id*="website"],input[name*="website"],input[id*="portfolio"]', p.website_url || ''],
      ['input[id*="github"],input[name*="github"]', p.github_url || ''],
      ['textarea[id*="cover"],textarea[name*="cover"]', p.cover_letter || DEFAULTS.cover],
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
      const val = guessFieldValue(lbl, p, sel, responseEntries);
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
        if (/gender/.test(id)) target = DEFAULTS.gender;
        if (/disability/.test(id)) target = DEFAULTS.disability;
        if (/veteran/.test(id)) target = DEFAULTS.veteran;
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
        } catch (_) { }
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
      } catch (_) { }
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
    legalNameSection_firstName: 'first_name',
    legalNameSection_lastName: 'last_name',
    legalNameSection_middleName: 'middle_name',
    infoFirstName: 'first_name',
    infoLastName: 'last_name',
    infoEmail: 'email',
    infoCellPhone: 'phone',
    infoLinkedIn: 'linkedin_profile_url',
    email: 'email',
    phone: 'phone',
    /* Address */
    addressSection_addressLine1: 'address',
    addressSection_addressLine2: 'address2',
    addressSection_city: 'city',
    addressSection_postalCode: 'postal_code',
    /* Work history */
    workHistoryCompanyName: 'current_company',
    workHistoryPosition: 'current_title',
    /* Education */
    educationHistoryName: 'school',
    degree: 'degree',
    /* Other */
    linkedIn: 'linkedin_profile_url',
    website: 'website_url',
    github: 'github_url',
    jobTitle: 'current_title',
    company: 'current_company',
    school: 'school',
    major: 'major',
    postalCode: 'postal_code',
    city: 'city',
    state: 'state',
    country: 'country',
    yearsOfExperience: 'years_of_experience',
    salary: 'expected_salary',
    coverLetter: 'cover_letter',
    howDidYouHear: 'how_did_you_hear',
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
      ['#lastName,input[id*="lastName"],input[name*="lastName"]', p.last_name],
      ['input[type="email"],input[id*="email"]', p.email],
      ['input[type="tel"],input[id*="phone"],input[name*="phone"]', p.phone],
      ['input[id*="city"],input[name*="city"]', p.city],
      ['input[id*="zip"],input[name*="postal"]', p.postal_code],
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
      ['input[name="first_name"],#firstName', p.first_name],
      ['input[name="last_name"],#lastName', p.last_name],
      ['input[name="email"],input[type="email"]', p.email],
      ['input[name="phone"],input[type="tel"]', p.phone],
      ['input[name="city"]', p.city],
      ['input[name="web"],input[name="website"]', p.website_url],
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
    '51-200', '201-500', '501-1000', '501-1,000', '1001-2000', '1,001-2,000',
    '2001-5000', '2,001-5,000', '5001-10000', '5,001-10,000', '10001+', '10,001+',
    '51 to 200', '201 to 500', '501 to 1000',
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
        chrome.runtime.sendMessage({ type: 'JOB_SKIPPED', reason: 'company_size' }).catch(() => { });
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
      ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'referer', 'source', 'fbclid']
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
    if (/today/.test(txt)) return new Date(now - 3_600_000);
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
    if (age < 30 * 60_000) { text = '🔥 Just Posted'; color = '#ef4444'; }
    else if (age < 86_400_000) { text = '✨ Fresh (< 24h)'; color = '#22c55e'; }
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
      }).catch(() => { });
      LOG(`CSV bridge: reported ${status} for job ${csvActiveJobId}`);
    };

    chrome.runtime.onMessage.addListener(msg => {
      if (msg?.type === 'COMPLEX_FORM_SUCCESS') report('done');
      if (msg?.type === 'COMPLEX_FORM_ERROR') report('failed', msg.errorType || msg.message || '');
      if (msg?.type === 'APPLICATION_SUCCESS' || msg?.type === 'JOB_APPLIED') report('done');
      if (msg?.type === 'APPLICATION_FAILED') report('failed', msg.reason || '');
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
      // Already-applied detection — prevents freezing on duplicate jobs
      if (/already applied|already submitted|you.ve applied|you have already|previously applied|duplicate application/i.test(body)) {
        report('duplicate');
      }
    };
    new MutationObserver(checkSuccess).observe(document.body, { childList: true, subtree: true });
    setInterval(checkSuccess, 5000);
    checkSuccess();

    /* ── Multi-page form loop ──────────────────────────────────
     * Fill all fields → click Submit/Next → if Next, wait for page change → re-fill.
     * Handles Workday multi-step, Greenhouse, Lever, and generic multi-page forms.
     * Up to 10 pages max to prevent infinite loops.
     * ─────────────────────────────────────────────────────────── */
    await sleep(3000); // Initial wait for page DOM to settle
    try {
      chrome.runtime.sendMessage({
        type: 'SIDEBAR_STATUS', event: 'analyzing_form',
        atsName: CURRENT_ATS || 'Unknown', url: location.href,
      }).catch(() => { });
    } catch (_) { }

    const MAX_PAGES = 10;
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (reported) break; // Success already detected by MutationObserver

      LOG(`── Page ${page}/${MAX_PAGES}: Filling fields ──`);

      // 1. ATS-specific fill
      if (CURRENT_ATS === 'Workday') await workdayAutofill();
      else if (CURRENT_ATS === 'OracleCloud') await oracleAutofill();
      else if (CURRENT_ATS === 'SmartRecruiters') await srAutofill();
      else if (CURRENT_ATS === 'Greenhouse') await greenhouseAutofill();

      // 2. Generic fill (catches fields ATS-specific handlers missed)
      await autoFillPage({ requiredOnly: false });
      await solveCaptcha();

      // 3. Wait and retry for lazy-rendered fields
      await sleep(3000);
      if (reported) break;
      await autoFillPage({ requiredOnly: false });

      // 4. Click submit or next
      await sleep(1000);
      if (reported) break;
      const action = await tryClickSubmit();

      if (action === 'submitted') {
        LOG('Submit clicked — waiting for success confirmation');
        // Wait for success detection (checkSuccess watcher will trigger report)
        await sleep(10000);
        break;
      } else if (action === 'next_page') {
        LOG('Next/Continue clicked — waiting for page transition');
        // Wait for new page content to load
        await sleep(5000);
        // Re-analyze the new page
        try {
          chrome.runtime.sendMessage({
            type: 'SIDEBAR_STATUS', event: 'filling_form',
            atsName: CURRENT_ATS || 'Unknown', url: location.href,
            page: page + 1,
          }).catch(() => { });
        } catch (_) { }
        continue; // Loop back to fill the next page
      } else {
        LOG('No submit/next button — final fill attempt');
        await sleep(3000);
        await autoFillPage({ requiredOnly: false });
        const retry = await tryClickSubmit();
        if (retry) LOG(`Final attempt: ${retry}`);
        break;
      }
    }
  }

  /** Find and click the submit / apply button to ensure the application is sent.
   *  Returns: 'submitted' | 'next_page' | false */
  async function tryClickSubmit() {
    const { csvQueueSettings } = await ST.get('csvQueueSettings');
    const autoSubmit = csvQueueSettings?.autoSubmit !== false;
    if (!autoSubmit) { LOG('Auto-submit disabled'); return false; }

    // Resume upload — handle input[type=file] fields
    await tryResumeUpload();

    const missingRequired = getMissingRequiredFields();

    // ── Submit selectors (only click if ALL required fields filled) ──
    const submitSelectors = [
      'button[type="submit"]', 'input[type="submit"]',
      'button[data-automation-id="submit"]',
      '#submit_app', '.postings-btn-submit', 'button.application-submit',
      'button[data-qa="btn-submit"]',
      'button[aria-label*="Submit" i]',
      '[data-testid="submit-application"]',
      'button.btn-submit', '#resumeSubmitForm',
    ];
    if (missingRequired.length === 0) {
      for (const sel of submitSelectors) {
        const btn = document.querySelector(sel);
        if (btn && isVisible(btn)) {
          LOG('Clicking submit:', sel);
          try { chrome.runtime.sendMessage({ type: 'SIDEBAR_STATUS', event: 'submitting' }).catch(() => { }); } catch (_) { }
          await sleep(500);
          realClick(btn);
          return 'submitted';
        }
      }
      // Fallback: button by text
      const btns = $$('button,a[role="button"],input[type="submit"]').filter(isVisible);
      const submitBtn = btns.find(b => {
        const t = (b.textContent || b.value || '').trim().toLowerCase();
        return /^(submit|apply|send|complete|finish)\b/i.test(t) && !/cancel|back|prev|close/i.test(t);
      });
      if (submitBtn) {
        LOG('Clicking submit (text):', submitBtn.textContent?.trim());
        try { chrome.runtime.sendMessage({ type: 'SIDEBAR_STATUS', event: 'submitting' }).catch(() => { }); } catch (_) { }
        await sleep(500);
        realClick(submitBtn);
        return 'submitted';
      }
    } else {
      LOG(`${missingRequired.length} required fields missing — trying Next/Continue`);
      missingRequired.forEach(n => reportFieldFilled(n, 'failed'));
    }

    // ── Next/Continue selectors (click even with missing fields for multi-page) ──
    const nextSelectors = [
      'button[data-automation-id="bottom-navigation-next-button"]', // Workday
      'button[data-automation-id="next-button"]',
      'button[aria-label*="Next" i]', 'button[aria-label*="Continue" i]',
      '[data-testid="next-step"]', '[data-testid="continue"]',
    ];
    for (const sel of nextSelectors) {
      const btn = document.querySelector(sel);
      if (btn && isVisible(btn)) {
        LOG('Clicking Next/Continue:', sel);
        await sleep(500);
        realClick(btn);
        return 'next_page';
      }
    }
    // Fallback: Next/Continue by text
    const allBtns = $$('button,a[role="button"]').filter(isVisible);
    const nextBtn = allBtns.find(b => {
      const t = (b.textContent || b.value || '').trim().toLowerCase();
      return /^(next|continue|proceed|save.*continue|review)\b/i.test(t) && !/cancel|back|prev|close/i.test(t);
    });
    if (nextBtn) {
      LOG('Clicking Next (text):', nextBtn.textContent?.trim());
      await sleep(500);
      realClick(nextBtn);
      return 'next_page';
    }

    // Last resort: if fields are filled, submit even through generic submit button
    if (missingRequired.length === 0) {
      const anySubmitish = allBtns.find(b => {
        const t = (b.textContent || b.value || '').trim().toLowerCase();
        return /submit|apply|send|go|done/i.test(t) && !/cancel|back|close/i.test(t);
      });
      if (anySubmitish) {
        LOG('Last resort submit:', anySubmitish.textContent?.trim());
        await sleep(500);
        realClick(anySubmitish);
        return 'submitted';
      }
    }

    LOG('No submit/next button found');
    return false;
  }

  /** Attempt to upload resume to visible file input fields */
  async function tryResumeUpload() {
    const fileInputs = $$('input[type="file"]'); // File inputs are often hidden by design
    if (fileInputs.length === 0) return;

    // Check if we have a stored resume
    const { resumeFile, resumeFileName } = await ST.get(['resumeFile', 'resumeFileName']);
    if (!resumeFile) {
      LOG('No stored resume for upload');
      return;
    }

    for (const fi of fileInputs) {
      if (fi.files && fi.files.length > 0) continue; // Already has file
      const lbl = getLabel(fi) || fi.name || fi.accept || '';
      const l = lbl.toLowerCase();
      // Only attach to resume/CV fields
      if (/resume|cv|curriculum|document|upload|attach|file/i.test(l) || fi.accept?.includes('.pdf') || fi.accept?.includes('.doc')) {
        try {
          // resumeFile is expected to be a base64 data URI
          const resp = await fetch(resumeFile);
          const blob = await resp.blob();
          const file = new File([blob], resumeFileName || 'resume.pdf', { type: blob.type || 'application/pdf' });
          const dt = new DataTransfer();
          dt.items.add(file);
          fi.files = dt.files;
          fi.dispatchEvent(new Event('change', { bubbles: true }));
          fi.dispatchEvent(new Event('input', { bubbles: true }));
          LOG('Resume uploaded to:', lbl);
          reportFieldFilled(lbl || 'Resume', 'filled');
        } catch (e) {
          LOG('Resume upload failed:', e);
        }
      }
    }
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
        // Run our patch autofill as a HELPER alongside native autofill.js
        // Native autofill.js handles field-by-field progress tracking
        if (CURRENT_ATS === 'Workday') await workdayAutofill();
        else if (CURRENT_ATS === 'OracleCloud') await oracleAutofill();
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
      msg?.type === 'APPLICATION_SUCCESS' ||
      msg?.type === 'JOB_APPLIED'
    ) markApplied();
  });

  /* Init CSV bridge on page load — sets up success detection watchers
   * AND does the actual form filling for CSV jobs */
  initCsvBridge().catch(() => { });

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
      await initCsvBridge(newJobId).catch(() => { });
    }
  });

  /* Run platform autofill in CSV mode */
  ST.get('csvActiveJobId').then(({ csvActiveJobId }) => {
    if (!csvActiveJobId) return;
    sleep(2000).then(async () => {
      if (CURRENT_ATS === 'Workday') await workdayAutofill();
      else if (CURRENT_ATS === 'OracleCloud') await oracleAutofill();
      else if (CURRENT_ATS === 'SmartRecruiters') await srAutofill();
      else if (CURRENT_ATS === 'Greenhouse') await greenhouseAutofill();
      else await autoFillPage();
    });
  }).catch(() => { });

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
    const url = location.href.toLowerCase();
    const path = location.pathname.toLowerCase();
    const hostname = location.hostname.toLowerCase();

    /* ── LinkedIn ─────────────────────────────────────────────
     * Job DETAIL page = /jobs/view/  or  /jobs/search/ with a panel open.
     * The Easy Apply modal opens AFTER a click — detect either state.   */
    if (CURRENT_ATS === 'LinkedIn') {
      if (path.includes('/jobs/view/') || path.includes('/jobs/collections/')) return true;
      /* Easy Apply modal already open */
      if (document.querySelector('.jobs-easy-apply-modal,[data-test-modal],[aria-modal="true"]')) return true;
      /* Apply button present on the page (Easy Apply OR direct Apply) */
      if (document.querySelector('.jobs-apply-button,[aria-label*="Apply"],[data-control-name*="apply"],.jobs-s-apply button')) return true;
      /* LinkedIn job search with detail panel open */
      if (path.includes('/jobs/search/') && document.querySelector('.jobs-details,.job-details,.jobs-search__right-rail')) return true;
      return false;
    }

    /* ── Indeed ──────────────────────────────────────────────
     * /viewjob page with Easy Apply modal or Apply Now button.
     * Also detect the Indeed Apply iframe that opens on company sites. */
    if (CURRENT_ATS === 'Indeed') {
      if (path.includes('/viewjob') || path.includes('/rc/clk') || path.includes('/applystart')) return true;
      /* Easy Apply modal */
      if (document.querySelector('#indeedApplyModal,.ia-container,[id*="indeedApply"],[class*="ia-BasePage"]')) return true;
      /* Apply Now / Apply on company site buttons */
      if (document.querySelector('[id*="applyButton"],[class*="apply-button"],button[aria-label*="Apply"],.jobsearch-IndeedApplyButton')) return true;
      /* Indeed resume form */
      if (document.querySelector('#resume-upload-container,form[action*="applystart"]')) return true;
      return false;
    }

    /* ── HiringCafe ───────────────────────────────────────────
     * hiring.cafe job pages with "Apply Directly" button */
    if (CURRENT_ATS === 'HiringCafe') {
      if (document.querySelector('a[href*="apply"],button:has-text("Apply"),[class*="apply-btn"],[class*="applyBtn"]')) return true;
      /* Any visible link/button with Apply text */
      const applyEls = $$('a, button').filter(el => {
        const t = el.textContent.trim().toLowerCase();
        return (t === 'apply' || t === 'apply now' || t === 'apply directly' || t.includes('apply directly')) && isVisible(el);
      });
      return applyEls.length > 0;
    }

    /* ── Workday ────────────────────────────────────────────
     * Application pages: URL has /apply  OR  page has automation IDs */
    if (CURRENT_ATS === 'Workday') {
      if (url.includes('/apply') || url.includes('apply=')) return true;
      return document.querySelectorAll('[data-automation-id]').length > 2;
    }

    /* ── Greenhouse ─────────────────────────────────────────
     * boards.greenhouse.io/company/jobs/ID is ALWAYS an application. */
    if (CURRENT_ATS === 'Greenhouse') {
      if (hostname.includes('boards.greenhouse.io')) return true;
      if (hostname.includes('greenhouse.io') && path.includes('/jobs/')) return true;
      if (document.querySelector('#application_form,[data-provided-by="greenhouse"],form[action*="greenhouse"]')) return true;
      return document.querySelectorAll(
        'input[id*="first"],input[id*="last"],input[id*="email"],input[name*="first"],input[name*="email"]'
      ).length > 0;
    }

    /* ── Lever ────────────────────────────────────────────
     * jobs.lever.co/company/id is always a job post (apply on page) */
    if (CURRENT_ATS === 'Lever') {
      if (hostname.includes('jobs.lever.co') || hostname.includes('apply.lever.co')) return true;
      return !!document.querySelector('.posting-apply,form.postings-form,.application-form');
    }

    /* ── Ashby ────────────────────────────────────────────
     * jobs.ashbyhq.com/company/UUID/application */
    if (CURRENT_ATS === 'Ashby') {
      if (path.includes('/application')) return true;
      return !!document.querySelector('[data-ashby-form],._ashby_apply_form,[class*="ApplicationForm"]');
    }

    /* ── SmartRecruiters ──────────────────────────────────────*/
    if (CURRENT_ATS === 'SmartRecruiters') {
      if (url.includes('/apply') || path.includes('/jobs/')) return true;
      return document.querySelectorAll(
        'input[name="first_name"],input[name="last_name"],input[name="email"]'
      ).length > 0;
    }

    /* ── OracleCloud / Taleo ──────────────────────────────────*/
    if (CURRENT_ATS === 'OracleCloud') {
      return url.includes('/apply') || url.includes('/requisition') ||
        !!document.querySelector('#OracleFusionApp,oracle-apply-flow') ||
        document.querySelectorAll('input:not([type=hidden])').length > 2;
    }

    /* ── Known ATS fallback ───────────────────────────────────
     * If we're on a known ATS domain, 2+ non-hidden inputs is enough */
    if (CURRENT_ATS) {
      return document.querySelectorAll(
        'input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=button]),textarea'
      ).length >= 2;
    }

    /* ── Generic / Unknown sites (company career pages) ──────────
     * Detect Apply / Apply Now / Apply Directly buttons on any page.
     * Also detect common career page indicators.                    */
    return hasApplyButton() || hasApplicationForm();
  }

  /**
   * Detect visible "Apply", "Apply Now", "Apply Directly" buttons/links.
   * Works on company career pages, HiringCafe, and any unknown ATS.
   */
  function hasApplyButton() {
    const applyPatterns = ['apply', 'apply now', 'apply directly', 'easy apply', 'apply for this job',
      'submit application', 'apply to this job', 'apply for job', 'start application'];
    const candidates = $$('a, button, [role="button"], input[type="submit"]');
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const text = (el.textContent || el.value || '').trim().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const title = (el.getAttribute('title') || '').toLowerCase();
      const combined = text + ' ' + aria + ' ' + title;
      if (applyPatterns.some(p => combined === p || combined.startsWith(p + ' ') || combined.includes(p))) {
        // Exclude tiny/navigation elements — apply buttons are typically 40px+ wide
        const r = el.getBoundingClientRect();
        if (r.width >= 40 && r.height >= 20) return true;
      }
    }
    return false;
  }

  /**
   * Detect a visible application form on the page (name/email inputs, file uploads for resume).
   */
  function hasApplicationForm() {
    const url = location.href.toLowerCase();
    const path = location.pathname.toLowerCase();
    // URL hints: /apply, /application, /career, /jobs
    if (url.includes('/apply') || path.includes('/application') || path.includes('/career')) {
      return document.querySelectorAll(
        'input:not([type=hidden]):not([type=submit]):not([type=button]),textarea'
      ).length >= 2;
    }
    // Strong form signals: name + email inputs together
    const hasName = !!document.querySelector(
      'input[name*="name" i],input[id*="name" i],input[placeholder*="name" i],input[autocomplete="name"],input[autocomplete="given-name"]'
    );
    const hasEmail = !!document.querySelector(
      'input[type="email"],input[name*="email" i],input[id*="email" i],input[placeholder*="email" i],input[autocomplete="email"]'
    );
    const hasResume = !!document.querySelector(
      'input[type="file"],input[name*="resume" i],input[id*="resume" i],input[name*="cv" i],input[accept*="pdf"]'
    );
    return (hasName && hasEmail) || (hasEmail && hasResume);
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
    if (_autoTriggered) return;
    /* No CURRENT_ATS guard — we detect generic Apply button pages too */

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
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }).catch(() => { });
    chrome.runtime.sendMessage({ type: 'SIDEBAR_STATUS', event: 'ats_detected', atsName: CURRENT_ATS || 'Career Page', url: location.href }).catch(() => { });
    showAutofillBanner('detecting', CURRENT_ATS || 'Career Page');
    acquireWakeLock();
    LOG(`Auto-trigger: ${CURRENT_ATS || 'generic'} application form detected — autofilling`);

    /* Short pause so the side panel renders */
    await sleep(800);
    showAutofillBanner('filling', CURRENT_ATS || 'Career Page');
    chrome.runtime.sendMessage({ type: 'SIDEBAR_STATUS', event: 'analyzing_form', atsName: CURRENT_ATS || 'Career Page', url: location.href }).catch(() => { });

    try {
      /* ── LinkedIn: Click Easy Apply / Apply button first ── */
      if (CURRENT_ATS === 'LinkedIn') {
        const easyApplyBtn = document.querySelector('.jobs-apply-button,.jobs-s-apply button,[aria-label*="Easy Apply"],[data-control-name*="apply"]');
        if (easyApplyBtn && isVisible(easyApplyBtn)) {
          LOG('LinkedIn: Clicking Easy Apply button');
          realClick(easyApplyBtn);
          await sleep(2000); // Wait for modal to open
        }
        // Also try the direct "Apply" link (company site redirect)
        const directApply = document.querySelector('a[href*="/jobs/view/"][class*="apply"],a[data-control-name="jobdetail_apply"]');
        if (directApply && isVisible(directApply) && !easyApplyBtn) {
          LOG('LinkedIn: Clicking direct Apply link');
          realClick(directApply);
          await sleep(2000);
        }
      }

      /* ── Indeed: Click Easy Apply / Apply Now button first ── */
      if (CURRENT_ATS === 'Indeed') {
        const indeedApply = document.querySelector('.jobsearch-IndeedApplyButton,[id*="applyButton"],button[aria-label*="Apply"],.ia-IndeedApplyButton');
        if (indeedApply && isVisible(indeedApply)) {
          LOG('Indeed: Clicking Apply button');
          realClick(indeedApply);
          await sleep(2000); // Wait for apply modal/iframe
        }
      }

      /* ── HiringCafe: Click "Apply Directly" button ── */
      if (CURRENT_ATS === 'HiringCafe') {
        const cafeApply = $$('a, button').find(el => {
          const t = el.textContent.trim().toLowerCase();
          return (t.includes('apply directly') || t === 'apply' || t === 'apply now') && isVisible(el);
        });
        if (cafeApply) {
          LOG('HiringCafe: Clicking Apply button');
          realClick(cafeApply);
          await sleep(2000);
        }
      }

      /* ── Generic career page: Click visible Apply button ── */
      if (!CURRENT_ATS && hasApplyButton()) {
        const applyPatterns = ['apply', 'apply now', 'apply directly', 'easy apply',
          'apply for this job', 'submit application', 'start application'];
        const applyBtn = $$('a, button, [role="button"], input[type="submit"]').find(el => {
          if (!isVisible(el)) return false;
          const text = (el.textContent || el.value || '').trim().toLowerCase();
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          const combined = text + ' ' + aria;
          return applyPatterns.some(p => combined === p || combined.startsWith(p) || combined.includes(p));
        });
        if (applyBtn) {
          LOG('Generic page: Clicking Apply button');
          realClick(applyBtn);
          await sleep(3000); // Wait for form/redirect
        }
      }

      /* ATS-specific autofill */
      if (CURRENT_ATS === 'Workday') await workdayAutofill();
      else if (CURRENT_ATS === 'OracleCloud') await oracleAutofill();
      else if (CURRENT_ATS === 'SmartRecruiters') await srAutofill();
      else if (CURRENT_ATS === 'Greenhouse') await greenhouseAutofill();
      /* LinkedIn/Lever/Ashby/Indeed/HiringCafe/others: generic fill covers them */

      await autoFillPage();
      await solveCaptcha();

      /* Retry fill after 3s for late-rendering fields */
      await sleep(3000);
      await autoFillPage();

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
  /* Run on ALL pages, not just known ATS — catches generic Apply button pages */
  {
    /* First attempt after 2.5s (most SPAs have rendered by then) */
    sleep(2500).then(() => autoTriggerAutofill());

    /* ── SPA navigation watcher (URL changes without full reload) ── */
    let _lastHref = location.href;
    setInterval(() => {
      if (location.href !== _lastHref) {
        _lastHref = location.href;
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

  /* T20 floating overlay REMOVED — progress now shown via OptimHire's native React UI */

  LOG(`v4.0 loaded | ${CURRENT_ATS || HOST}`);
})();
