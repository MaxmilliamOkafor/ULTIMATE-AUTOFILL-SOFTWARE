// === SPEEDYAPPLY ULTIMATE ENHANCEMENT v2.0 (built on 2.23.4) ===
//
// Adds a zero-touch layer on top of SpeedyApply 2.23.4's bundled content.js:
//   1. Forces SpeedyApply's `autoClickNextPage` so Apply Manually + Next fire automatically.
//   2. Aggressive Apply -> Apply Manually click sequence on Workday (skips
//      "Use My Last Application", "Apply With LinkedIn", "Autofill With Resume").
//   3. Generic "Apply" button click on non-Workday ATS (Greenhouse, Lever, Ashby,
//      SmartRecruiters, Workable, BambooHR, etc.) so the user never has to click Apply.
//   4. Cookie / consent banner auto-dismissal (OneTrust, Cookiebot, TrustArc, generic
//      "Accept all") so SpeedyApply's clicks aren't intercepted.
//   5. Required-field watchdog: re-runs the autofill until 100% of required fields
//      are filled (or 8 attempts exhausted) BEFORE any Next/Submit click. Type-aware
//      defaults so URL/email/phone/number/date inputs never receive junk like "N/A".
//   6. Generic resume uploader (DataTransfer pattern, ported from SpeedyApply's own
//      Workday handler) that works on any ATS file input.
//   7. Shadow-DOM-aware querying so React/Vue/Plasmo-injected forms inside custom
//      elements are visible to the watchdog.
//   8. Backstop fill for fields SpeedyApply doesn't recognise.
//
// v2.0 fixes:
//   * Smooth, professional scrolling — no more jumping up and down. We only scroll
//     when an element is actually out of viewport, throttled to one scroll per 600 ms,
//     and use behavior:'smooth' / block:'nearest'.
//   * Comprehensive ATS knockout answer bank covering every common question variation.
//   * "Custom Answers" panel injected into application pages — user can add their own
//     Q&A that override defaults. Persists in chrome.storage.local.sa_custom_answers.

(function () {
  'use strict';
  if (window.__saEnhancementLoaded) return;
  window.__saEnhancementLoaded = true;

  const LOG = (...a) => console.log('[SA+]', ...a);

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason || '');
    if (/Could not establish connection|Receiving end does not exist|Extension context invalidated/i.test(msg)) {
      event.preventDefault();
    }
  });

  // ===================== v2.0 PREMIUM UNLOCK (UNLIMITED, NEVER EXPIRES) =====================
  // 1) Seeds chrome.storage.local with active-premium flags so SpeedyApply's UI
  //    treats the user as Premium for Multiple Profiles, Smart Profile Scoring,
  //    and Generated Responses.
  // 2) Intercepts fetch / XHR for Supabase /rest/v1/subscriptions queries and
  //    returns an active subscription with a 100-year expiry. Also handles any
  //    /subscription, /billing, /checkout, /paywall, /premium endpoint that
  //    might gate the feature.
  const FAR_FUTURE = new Date('2126-12-31T23:59:59Z').toISOString();
  const PREMIUM_SUB = {
    id: 'sa-ultimate-unlocked',
    user_id: 'sa-ultimate',
    status: 'active',
    plan: 'premium',
    tier: 'premium',
    interval: 'weekly',
    is_premium: true,
    premium: true,
    cancel_at_period_end: false,
    cancelled_at: null,
    canceled_at: null,
    trial_end: FAR_FUTURE,
    current_period_start: new Date().toISOString(),
    current_period_end: FAR_FUTURE,
    expires_at: FAR_FUTURE,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stripe_customer_id: 'cus_sa_ultimate',
    stripe_subscription_id: 'sub_sa_ultimate',
    metadata: { source: 'sa-ultimate-enhancement' },
  };

  async function unlockPremium() {
    try {
      const cur = await new Promise(r => chrome.storage.local.get(null, r));
      const accountSettings = (typeof cur.accountSettings === 'string' ? (() => { try { return JSON.parse(cur.accountSettings); } catch (_) { return {}; } })() : (cur.accountSettings || {}));
      const newAccount = { ...accountSettings, premium: true, isPremium: true, hasPremium: true, tier: 'premium', plan: 'premium', subscription_status: 'active', subscriptionStatus: 'active', trial_end: FAR_FUTURE, expiresAt: FAR_FUTURE };
      const writes = {
        // Top-level premium flags
        premium: true,
        isPremium: true,
        hasPremium: true,
        subscription: PREMIUM_SUB,
        subscriptionStatus: 'active',
        subscription_status: 'active',
        plan: 'premium',
        tier: 'premium',
        accountTier: 'premium',
        premiumSettings: { enabled: true, multipleProfiles: true, smartScoring: true, generatedResponses: true, jobScoring: true, profileList: true, responseFeedback: true },
        premiumAutofill: true,
        premiumFetchProfileList: true,
        premiumFetchJobScores: true,
        premiumResponseFeedback: true,
        // SpeedyApply uses accountSettings as the source of truth in some flows
        accountSettings: typeof cur.accountSettings === 'string' ? JSON.stringify(newAccount) : newAccount,
      };
      await new Promise(r => chrome.storage.local.set(writes, r));
      LOG('Premium unlocked (storage flags + active subscription)');
    } catch (e) { LOG('unlockPremium error: ' + e.message); }
  }

  // Intercept Supabase / billing API calls and return active-premium responses.
  function installPremiumNetworkBypass() {
    const _fetch = window.fetch;
    window.fetch = async function () {
      const u = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0]?.url || '');
      try {
        // Supabase REST: /rest/v1/subscriptions?... returning array
        if (/\/rest\/v1\/subscriptions/i.test(u)) {
          return new Response(JSON.stringify([PREMIUM_SUB]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        // Supabase REST: /rest/v1/profiles when SpeedyApply checks premium on a profile row
        if (/\/rest\/v1\/profiles/i.test(u) && /(select|premium|subscription|tier)/i.test(u)) {
          // Return wrapped premium fields without breaking the existing profile shape.
          const r = await _fetch.apply(window, arguments).catch(() => null);
          if (r && r.ok) {
            try {
              const body = await r.clone().json();
              const enrich = row => ({ ...(row || {}), is_premium: true, premium: true, tier: 'premium', plan: 'premium', subscription_status: 'active' });
              const out = Array.isArray(body) ? body.map(enrich) : enrich(body);
              return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } catch (_) { return r; }
          }
        }
        // Generic premium / billing / checkout / paywall endpoints
        if (/\/(premium|billing|checkout|paywall|subscribe|trial|plan|entitlement)/i.test(u)) {
          return new Response(JSON.stringify({ success: true, active: true, premium: true, isPremium: true, tier: 'premium', plan: 'premium', status: 'active', subscription: PREMIUM_SUB, expiresAt: FAR_FUTURE, features: { multipleProfiles: true, smartScoring: true, generatedResponses: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        // Pass-through but rewrite 402/403/429 to 200 success for any other API call
        // that might gate premium behind a billing error.
        const r = await _fetch.apply(window, arguments);
        if (r.status === 402 || r.status === 403 || r.status === 429) {
          return new Response(JSON.stringify({ success: true, active: true, premium: true, isPremium: true, tier: 'premium', status: 'active', expiresAt: FAR_FUTURE }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return r;
      } catch (e) { return _fetch.apply(window, arguments); }
    };

    const _xhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) { this._sa_url = url || ''; return _xhrOpen.apply(this, arguments); };
    const _xhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      const url = this._sa_url || '';
      if (/\/rest\/v1\/subscriptions/i.test(url) || /\/(premium|billing|checkout|paywall|subscribe|trial|entitlement)/i.test(url)) {
        const s = this;
        const body = JSON.stringify(/\/rest\/v1\/subscriptions/i.test(url) ? [PREMIUM_SUB] : { success: true, active: true, premium: true, isPremium: true, tier: 'premium', status: 'active', subscription: PREMIUM_SUB, expiresAt: FAR_FUTURE });
        Object.defineProperty(s, 'responseText', { get: () => body });
        Object.defineProperty(s, 'response', { get: () => body });
        Object.defineProperty(s, 'status', { get: () => 200 });
        Object.defineProperty(s, 'readyState', { get: () => 4 });
        setTimeout(() => { try { s.onreadystatechange?.(); s.onload?.(); } catch (_) { } }, 30);
        return;
      }
      return _xhrSend.apply(this, arguments);
    };

    LOG('Premium network bypass installed (fetch + XHR)');
  }

  // Run the network bypass IMMEDIATELY (before SpeedyApply's first API call) and
  // seed storage flags asynchronously.
  installPremiumNetworkBypass();
  unlockPremium();

  // ===================== DOM HELPERS =====================
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.offsetParent !== null;
  }

  // Walks every reachable shadow root.
  function deepQueryAll(selector, root) {
    const out = [];
    const start = root || document;
    const walk = (node) => {
      if (!node) return;
      if (node.querySelectorAll) { try { out.push(...node.querySelectorAll(selector)); } catch (_) { } }
      const children = node.querySelectorAll ? node.querySelectorAll('*') : [];
      for (const c of children) {
        if (c.shadowRoot && c.shadowRoot !== node) walk(c.shadowRoot);
      }
    };
    walk(start);
    return [...new Set(out)];
  }

  // ===================== SMOOTH, THROTTLED SCROLLING (v2.0 fix) =====================
  // The previous version called scrollIntoView on every click target, causing the
  // viewport to jump rapidly during a fill. Now: only scroll when the element is
  // genuinely out of the viewport, at most once per 600ms, smooth + nearest.
  let _lastScrollAt = 0;
  function smoothEnsureVisible(el) {
    if (!el) return;
    const now = Date.now();
    if (now - _lastScrollAt < 600) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // Already within the visible band (with 60px padding)? Don't scroll.
    if (r.top >= 60 && r.bottom <= vh - 60) return;
    _lastScrollAt = now;
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); }
    catch (_) { try { el.scrollIntoView(true); } catch (__) { } }
  }

  function nativeSet(el, val) {
    if (!el || el.disabled || el.readOnly) return false;
    try {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype :
        el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) { setter.call(el, ''); setter.call(el, val); } else el.value = val;
    } catch (_) { el.value = val; }
    el.dispatchEvent(new Event('focus', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  // realClick no longer scrolls. Use clickWithFocus when the click needs the
  // element on screen (Apply / Apply Manually / Next).
  function realClick(el) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.click();
  }
  function clickWithFocus(el) {
    if (!el) return;
    smoothEnsureVisible(el);
    realClick(el);
  }

  function waitFor(check, ms) {
    return new Promise(resolve => {
      const fn = typeof check === 'function' ? check : () => $(check);
      const found = fn(); if (found) return resolve(found);
      const o = new MutationObserver(() => { const v = fn(); if (v) { o.disconnect(); resolve(v); } });
      o.observe(document.body || document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { o.disconnect(); resolve(null); }, ms || 8000);
    });
  }

  // ===================== STORAGE =====================
  const st = {
    get: k => new Promise(r => chrome.storage.local.get(k, d => r(typeof k === 'string' ? d[k] : d))),
    set: obj => new Promise(r => chrome.storage.local.set(obj, r)),
  };

  async function ensureAutoClickEnabled() {
    try {
      const settings = (await st.get('autofillSettings')) || {};
      let parsed = settings;
      if (typeof settings === 'string') { try { parsed = JSON.parse(settings); } catch (_) { parsed = {}; } }
      if (parsed && parsed.autoClickNextPage === true) return;
      const next = { ...parsed, autoClickNextPage: true, saveApplications: parsed.saveApplications !== false, saveResponses: parsed.saveResponses !== false };
      await st.set({ autofillSettings: typeof settings === 'string' ? JSON.stringify(next) : next });
      LOG('Enabled SpeedyApply autoClickNextPage');
    } catch (e) { LOG('Could not toggle autoClickNextPage: ' + e.message); }
  }

  async function getProfile() {
    try {
      const raw = await st.get('profile');
      if (!raw) return {};
      const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return {
        ...p,
        first_name: p.nameData?.firstName || p.firstName || '',
        last_name: p.nameData?.lastName || p.lastName || '',
        email: p.contactData?.email || p.email || '',
        phone: p.contactData?.phoneNumber || p.phone || '',
        city: p.addressData?.city || p.city || '',
        state: p.addressData?.state || p.state || '',
        country: p.addressData?.country || p.country || '',
        postal_code: p.addressData?.postalCode || p.postal_code || '',
        address: p.addressData?.line1 || p.address || '',
        linkedin: (p.linksData || []).find?.(l => /linkedin/i.test(l.url || ''))?.url || p.linkedin || '',
        github: (p.linksData || []).find?.(l => /github/i.test(l.url || ''))?.url || p.github || '',
        website: (p.linksData || []).find?.(l => !/linkedin|github|twitter/i.test(l.url || ''))?.url || p.website || '',
      };
    } catch (e) { return {}; }
  }

  // ===================== CUSTOM ANSWERS BANK (v2.0) =====================
  // User-defined Q&A pairs stored in chrome.storage.local.sa_custom_answers.
  // Each entry: { keywords: ['python','years'], response: '5 years' }.
  // Custom answers ALWAYS override built-in defaults.
  let _customAnswers = [];
  async function loadCustomAnswers() {
    _customAnswers = (await st.get('sa_custom_answers')) || [];
  }
  async function saveCustomAnswers() {
    await st.set({ sa_custom_answers: _customAnswers });
  }
  function findCustomMatch(text) {
    if (!_customAnswers.length || !text) return '';
    const norm = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = new Set(norm.split(' ').filter(w => w.length > 2));
    if (!words.size) return '';
    let best = null, bestScore = 0;
    for (const e of _customAnswers) {
      if (!e.keywords?.length || !e.response) continue;
      const matchCount = e.keywords.filter(k => words.has(k.toLowerCase())).length;
      if (!matchCount) continue;
      const score = matchCount / e.keywords.length;
      if (score >= 0.5 && score > bestScore) { bestScore = score; best = e.response; }
    }
    return best || '';
  }

  // ===================== COMPREHENSIVE ATS KNOCKOUT ANSWER BANK (v2.0) =====================
  // Every common question variation across every ATS, mapped to the correct answer.
  // Runs BEFORE the per-field guess so knockout questions always resolve correctly.
  // Patterns are evaluated top-to-bottom; first match wins.
  function knockoutAnswer(label, profile) {
    const l = (label || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!l) return '';
    const p = profile || {};

    // ---- 1. Custom user overrides always win
    const custom = findCustomMatch(label);
    if (custom) return custom;

    // ---- 2. Sponsorship / visa (almost always "No" — already authorized)
    if (/(?:require|need|requir).{0,10}(?:sponsor|visa|work\s*permit|h\s*1\s*b|h1b)/i.test(l)) return 'No';
    if (/(?:will|do).{0,8}you.{0,10}(?:require|need).{0,10}(?:sponsor|visa)/i.test(l)) return 'No';
    if (/(?:now|future).{0,15}sponsor/i.test(l)) return 'No';
    if (/sponsor.{0,10}(?:now|future|employment)/i.test(l)) return 'No';
    if (/visa\s*(?:status|requir)|immigration\s*status/i.test(l)) return 'No';

    // ---- 3. Authorization / right-to-work ("Yes")
    if (/(?:legally|currently).{0,10}(?:authoriz|eligible).{0,20}work/i.test(l)) return 'Yes';
    if (/authoriz.{0,15}work/i.test(l)) return 'Yes';
    if (/eligible\s*to\s*work|right\s*to\s*work|legal\s*right.{0,15}work/i.test(l)) return 'Yes';
    if (/work\s*authoriz|work\s*permit|work\s*eligibility/i.test(l)) return 'Yes';
    if (/citizen\s*of|are\s*you\s*a\s*citizen|us\s*citizen|eu\s*citizen/i.test(l)) return p.country ? 'Yes' : 'Yes';
    if (/permanent\s*resident|green\s*card/i.test(l)) return 'Yes';

    // ---- 4. Age / over 18
    if (/over\s*18|18\s*years|at\s*least\s*18|legal\s*age/i.test(l)) return 'Yes';

    // ---- 5. Background / criminal / drug ("No" / "Yes consent")
    if (/criminal\s*(?:record|conviction|history)|felony|convicted|crime/i.test(l)) return 'No';
    if (/(?:pending|outstanding)\s*charges/i.test(l)) return 'No';
    if (/non\s*disclosure|nda\s*violation|trade\s*secret/i.test(l)) return 'No';
    if (/non\s*compete|restrictive\s*covenant/i.test(l)) return 'No';
    if (/conflict.{0,5}of.{0,5}interest/i.test(l)) return 'No';
    if (/terminated|fired|dismissed/i.test(l)) return 'No';
    if (/drug\s*test|drug\s*screening|substance\s*screening/i.test(l)) return 'Yes';
    if (/background\s*(?:check|screening|verification)/i.test(l)) return 'Yes';
    if (/credit\s*check/i.test(l)) return 'Yes';
    if (/security\s*clearance/i.test(l)) return p.security_clearance || 'None';

    // ---- 6. Previously / currently employed
    if (/(?:previously|ever|before)\s*(?:work|employ).{0,15}(?:for|at|with|here)/i.test(l)) return 'No';
    if (/current\s*employee|currently\s*employed.{0,10}(?:here|with\s*us|by\s*us)/i.test(l)) return 'No';
    if (/family\s*member.{0,15}(?:work|employ)/i.test(l)) return 'No';
    if (/relative.{0,15}(?:work|employ)/i.test(l)) return 'No';
    if (/applied\s*before|previously\s*applied/i.test(l)) return 'No';
    if (/referred\s*by\s*(?:an\s*)?employee/i.test(l)) return 'No';

    // ---- 7. Relocation / remote / on-site / hybrid / travel
    if (/willing.{0,10}to\s*relocate|open\s*to\s*relocat|relocation/i.test(l)) return 'Yes';
    if (/willing.{0,10}to\s*travel|travel.{0,10}(?:requir|expect)/i.test(l)) return 'Yes';
    if (/willing.{0,10}work\s*remote|comfortable\s*remote|prefer\s*remote/i.test(l)) return 'Yes';
    if (/work\s*from\s*home|wfh|remote\s*work/i.test(l)) return 'Yes';
    if (/hybrid\s*(?:work|model|schedule)/i.test(l)) return 'Yes';
    if (/comfortable.{0,10}on\s*site|willing.{0,10}on\s*site/i.test(l)) return 'Yes';
    if (/comfortable.{0,10}commut|reasonable\s*commut/i.test(l)) return 'Yes';
    if (/commute|commuting\s*distance/i.test(l)) return 'Yes';
    if (/reliable\s*transport/i.test(l)) return 'Yes';

    // ---- 8. Schedule / hours
    if (/willing.{0,10}work.{0,10}(?:nights|weekends|holidays|overtime|shift|flexible|extended)/i.test(l)) return 'Yes';
    if (/work\s*(?:nights|weekends|holidays|overtime|shifts)/i.test(l)) return 'Yes';
    if (/full\s*time|part\s*time|temporary\s*work/i.test(l)) return 'Yes';
    if (/shift\s*work|rotating\s*shift|night\s*shift/i.test(l)) return 'Yes';

    // ---- 9. Years of experience (numeric)
    if (/how\s*many\s*years|years\s*of\s*experience|total\s*(?:years|experience)|industry\s*experience/i.test(l)) return String(p.years_experience || p.yearsExperience || 5);
    if (/years\s*using|experience\s*with.{0,30}(?:python|java|javascript|typescript|react|node|aws|azure|gcp|docker|kubernetes|sql|terraform)/i.test(l)) return '5';
    if (/years.{0,15}(?:management|leading|supervis)/i.test(l)) return '3';
    if (/years.{0,15}(?:remote|hybrid)/i.test(l)) return '3';

    // ---- 10. Skill / proficiency questions ("Yes" / "Advanced")
    if (/(?:do you|are you|have you).{0,10}(?:know|familiar|experience|proficien|comfortable|skilled).{0,40}(?:python|java|javascript|typescript|react|vue|angular|node|express|django|flask|rails|spring|aws|azure|gcp|docker|kubernetes|terraform|ansible|jenkins|git|sql|nosql|mongo|postgres|mysql|redis|kafka|spark|hadoop|tensorflow|pytorch|pandas|numpy|linux|windows|mac|bash|shell|powershell|c\+\+|c#|go|golang|rust|ruby|php|swift|kotlin|scala)/i.test(l)) return 'Yes';
    if (/(?:rate|assess).{0,15}(?:proficien|skill|expertise|knowledge)/i.test(l)) return 'Advanced';
    if (/(?:proficien|expertise|skill).{0,15}level/i.test(l)) return 'Advanced';
    if (/years.{0,15}experience.{0,20}(?:python|java|javascript|aws|sql|cloud|web|backend|frontend|devops|sre|ml|ai|data)/i.test(l)) return '5';

    // ---- 11. Acknowledgements / agreements / consent
    if (/agree\s*(?:to|with)\s*(?:terms|conditions|privacy|policy|gdpr|guidelines)/i.test(l)) return 'Yes';
    if (/(?:i\s*)?(?:agree|consent|acknowledge|certify|attest|confirm|accept)/i.test(l)) return 'Yes';
    if (/permission\s*to\s*contact|consent\s*to\s*contact/i.test(l)) return 'Yes';
    if (/store\s*(?:your|my)\s*data|process\s*(?:your|my)\s*data|data\s*processing/i.test(l)) return 'Yes';
    if (/(?:have|do you have).{0,10}(?:access|reliable\s*internet|laptop|computer)/i.test(l)) return 'Yes';
    if (/quiet\s*workspace|dedicated\s*workspace/i.test(l)) return 'Yes';

    // ---- 12. EEO / diversity (prefer not to say unless profile sets explicit value)
    if (/gender\s*identity|what\s*is\s*your\s*gender|sex\s*at\s*birth|^gender$/i.test(l)) return p.gender || 'Prefer not to say';
    if (/ethnic\s*(?:group|background|origin)|race|racial|heritage|hispanic|latino/i.test(l)) return p.ethnicity || p.race || 'Prefer not to say';
    if (/veteran\s*status|military\s*status|protected\s*veteran|armed\s*forces/i.test(l)) return p.veteran || 'I am not a protected veteran';
    if (/disabilit|differently\s*abled/i.test(l)) return p.disability || 'I do not have a disability';
    if (/transgender|nonbinary|non\s*binary|sexual\s*orientation/i.test(l)) return 'Prefer not to say';
    if (/preferred\s*pronoun/i.test(l)) return p.pronouns || 'Prefer not to say';

    // ---- 13. Salary / compensation
    if (/(?:expected|desired|target|preferred)\s*(?:salary|compensation|pay|wage|rate)/i.test(l)) return String(p.expected_salary || 80000);
    if (/(?:current|present)\s*(?:salary|compensation|pay)/i.test(l)) return String(p.current_salary || p.expected_salary || 80000);
    if (/salary\s*(?:expectation|range|requirement|history)/i.test(l)) return String(p.expected_salary || 80000);
    if (/hourly\s*rate|day\s*rate|contract\s*rate/i.test(l)) return String(p.hourly_rate || 50);
    if (/minimum\s*salary|base\s*salary/i.test(l)) return String(p.expected_salary || 80000);

    // ---- 14. Notice / start date / availability
    if (/notice\s*period|how\s*much\s*notice|how\s*soon.{0,10}start/i.test(l)) return p.notice_period || '2 weeks';
    if (/(?:earliest|when).{0,10}(?:can\s*you\s*)?(?:start|begin|join|available)/i.test(l)) return p.availability || 'Immediately';
    if (/start\s*date|date\s*available|available\s*from|join\s*date/i.test(l)) {
      const d = new Date(); d.setDate(d.getDate() + 14);
      return d.toISOString().split('T')[0];
    }
    if (/last\s*day\s*at\s*current/i.test(l)) {
      const d = new Date(); d.setDate(d.getDate() + 14);
      return d.toISOString().split('T')[0];
    }

    // ---- 15. Driving / license / passport
    if (/(?:driver|driving)\s*licen[cs]e|do\s*you\s*drive/i.test(l)) return p.drivers_license || 'Yes';
    if (/passport|valid\s*passport/i.test(l)) return 'Yes';
    if (/own\s*(?:a\s*)?(?:car|vehicle)/i.test(l)) return 'Yes';

    // ---- 16. Languages
    if (/(?:do\s*you\s*)?speak\s*english|english\s*proficien|english\s*fluen|fluent\s*in\s*english/i.test(l)) return 'Yes';
    if (/(?:other\s*)?languages?\s*spoken|languages?\s*you\s*speak/i.test(l)) return p.languages || 'English';
    if (/(?:speaking|writing|reading)\s*proficiency/i.test(l)) return p.language_proficiency || 'Advanced';

    // ---- 17. References
    if (/professional\s*references?|provide\s*references?/i.test(l)) return 'Available upon request';
    if (/may\s*we\s*contact.{0,20}(?:current|previous|reference)/i.test(l)) return 'Yes';

    // ---- 18. How did you hear / referral
    if (/how.{0,5}(?:did|do)\s*you\s*hear|where.{0,5}(?:did|do)\s*you\s*(?:hear|find|learn|discover)/i.test(l)) return p.howHeard || 'LinkedIn';
    if (/referral\s*source|how\s*were\s*you\s*referred|referred\s*by/i.test(l)) return p.howHeard || 'LinkedIn';
    if (/source\s*of\s*application|application\s*source/i.test(l)) return 'LinkedIn';

    // ---- 19. Why this company / why this role / cover letter
    if (/why.{0,15}(?:this\s*role|this\s*position|this\s*job|this\s*company|us|interest|join\s*our|work\s*here|apply)/i.test(l)) return p.cover_letter || p.why || 'I am excited about this role because the company\'s mission aligns with my values, and I see strong opportunities to apply my expertise and grow alongside an exceptional team.';
    if (/cover\s*letter|motivation\s*letter|letter\s*of\s*interest|message\s*to\s*hiring/i.test(l)) return p.cover_letter || 'I am excited to apply for this role. My background and skills make me an excellent candidate and I look forward to contributing to your team.';
    if (/about\s*you|introduce\s*yourself|tell\s*us\s*about|brief\s*bio|professional\s*summary|summary/i.test(l)) return p.summary || p.cover_letter || 'I am a results-driven professional with a strong track record of delivering impact, collaborating across teams, and continuously raising the technical bar.';
    if (/most\s*impactful|greatest\s*accomplishment|proud(?:est)?\s*(?:of|achievement)|biggest\s*win/i.test(l)) return p.greatest_accomplishment || 'I led the redesign of a customer-facing system that cut latency by 60% and increased conversion by 18%, owning the work end-to-end and partnering across product, design and engineering.';
    if (/strength|strong(?:est)?\s*suit|best\s*qualit/i.test(l)) return p.strengths || 'Strong analytical problem-solving, clear written and verbal communication, ownership end-to-end, and the ability to take ambiguous problems and turn them into shipped outcomes.';
    if (/weakness|area.{0,5}(?:improve|growth|development)/i.test(l)) return p.weaknesses || 'I sometimes go too deep on detail before stepping back to confirm priorities. I now structure work into shorter checkpoints with stakeholders so I stay aligned.';
    if (/career\s*goal|long\s*term\s*goal|five\s*year|5\s*year|where.{0,10}see\s*yourself/i.test(l)) return p.career_goal || 'Leading high-impact technical initiatives, mentoring engineers, and continuing to deepen my expertise while driving meaningful business outcomes.';
    if (/reason.{0,5}(?:for\s*)?leav|why\s*leav|reason.{0,5}change/i.test(l)) return 'I am looking for a new opportunity to grow, work on harder problems, and have greater impact than my current role allows.';

    // ---- 20. Behavioral / STAR triggers (provide real STAR-format default)
    if (/describe\s*a\s*time|tell\s*me\s*about\s*a\s*time|give\s*an\s*example/i.test(l)) {
      return 'Situation: My team faced a critical production outage affecting a key customer. Task: I was on-call and needed to restore service quickly while keeping leadership informed. Action: I led the war-room, coordinated rollback, and ran a structured root-cause analysis. Result: We restored service in 28 minutes, identified the root cause within 24 hours, and shipped preventative tests so it never repeated.';
    }
    if (/conflict.{0,15}team|disagreement.{0,15}colleague/i.test(l)) {
      return 'I once disagreed with a peer on architectural choices. I scheduled a quick whiteboard session, listed the trade-offs explicitly, and we agreed on a hybrid approach that both met our scaling needs and respected our deadline. The relationship was strengthened, not damaged.';
    }
    if (/failure|failed\s*project|did\s*not\s*succeed/i.test(l)) {
      return 'Early in a major migration I underestimated the scope of dependent systems. I owned the miss, replanned with the team, brought in extra capacity, and we delivered two weeks later than original target. I now front-load dependency mapping in every new project.';
    }
    if (/leadership|leading.{0,10}team|managing\s*people/i.test(l)) {
      return 'I have led cross-functional initiatives where I set technical direction, mentored two junior engineers to mid-level, ran sprint planning, and partnered with product and design to deliver outcomes the team and customers were proud of.';
    }

    // ---- 21. Identity / contact (lets the watchdog re-fill if SpeedyApply missed)
    if (/^first\s*name|given\s*name|forename/i.test(l)) return p.first_name || '';
    if (/^last\s*name|family\s*name|surname/i.test(l)) return p.last_name || '';
    if (/^full\s*name|^name$|legal\s*name/i.test(l)) return `${p.first_name || ''} ${p.last_name || ''}`.trim();
    if (/preferred\s*name|nickname|nick\s*name/i.test(l)) return p.preferred_name || p.first_name || '';
    if (/^email|e\s*mail|primary\s*email/i.test(l)) return p.email || '';
    if (/phone|mobile|cell|telephone/i.test(l)) return p.phone || '';
    if (/^city$|current\s*city/i.test(l)) return p.city || '';
    if (/state|province|region/i.test(l)) return p.state || '';
    if (/^country|country.{0,5}residence|nationality|citizenship/i.test(l)) return p.country || '';
    if (/zip|postal\s*code/i.test(l)) return p.postal_code || '';
    if (/address|street/i.test(l)) return p.address || '';
    if (/where.{0,10}(?:located|live|based|reside)|location|current\s*location|base.{0,5}in/i.test(l)) return p.city ? `${p.city}, ${p.state || p.country || ''}`.replace(/,\s*$/, '') : p.country || '';
    if (/linkedin/i.test(l)) return p.linkedin || '';
    if (/github/i.test(l)) return p.github || '';
    if (/(?:personal\s*)?website|portfolio|personal\s*url/i.test(l)) return p.website || p.linkedin || '';
    if (/twitter|x\.com/i.test(l)) return p.twitter || '';

    // ---- 22. Education
    if (/(?:school|university|college|alma\s*mater|institution)/i.test(l) && !/elementary|high\s*school/i.test(l)) return p.school || p.university || '';
    if (/^degree|highest\s*degree|level\s*of\s*education/i.test(l)) return p.degree || "Bachelor's Degree";
    if (/major|field\s*of\s*study|concentration|discipline/i.test(l)) return p.major || 'Computer Science';
    if (/gpa|grade\s*point|grade\s*average/i.test(l)) return p.gpa || '3.5';
    if (/graduation\s*(?:date|year)|grad\s*(?:date|year)|year\s*graduated/i.test(l)) return p.graduation_year || String(new Date().getFullYear());

    // ---- 23. Work experience
    if (/current\s*(?:title|position|role)|present\s*(?:title|position|role)/i.test(l)) return p.current_title || p.title || '';
    if (/current\s*(?:company|employer|organization)/i.test(l)) return p.current_company || p.company || '';
    if (/^company$|^employer$/i.test(l) && !/previous|former|past/i.test(l)) return p.current_company || p.company || '';
    if (/job\s*title|position\s*title/i.test(l)) return p.current_title || p.title || '';

    // ---- 24. Misc safety nets
    if (/passport\s*number|social\s*security|ssn|tax\s*id|bank\s*account/i.test(l)) return ''; // never autofill PII
    if (/please\s*specify|other.{0,10}please|specify\s*below/i.test(l)) return 'N/A';

    return '';
  }

  // ===================== COOKIE / CONSENT BANNER DISMISSAL =====================
  function dismissCookieBanners() {
    const ot = $('#onetrust-accept-btn-handler,#onetrust-pc-btn-handler,button[id*="accept-recommended" i]');
    if (ot && isVisible(ot)) ot.click();
    const cb = $('#CybotCookiebotDialogBodyButtonAccept,#CybotCookiebotDialogBodyLevelButtonAccept');
    if (cb && isVisible(cb)) cb.click();
    const ta = $('.truste-button1,.truste-consent-button,#truste-consent-button');
    if (ta && isVisible(ta)) ta.click();
    const generic = $$('button, a').find(b => {
      if (!isVisible(b)) return false;
      const t = (b.textContent || b.getAttribute('aria-label') || '').trim().toLowerCase();
      return /^(accept(\s+all)?(\s+cookies)?|allow\s+all|got\s+it|i\s+(agree|accept)|ok|agree(\s+and\s+continue)?)$/i.test(t);
    });
    if (generic) generic.click();
    $$('[role="dialog"], [class*="cookie" i], [class*="consent" i], [id*="cookie" i], [id*="consent" i]').forEach(banner => {
      if (!isVisible(banner)) return;
      const acceptBtn = banner.querySelector('button[class*="accept" i],button[id*="accept" i]') ||
        $$('button', banner).find(b => /accept|agree|allow|ok|got it/i.test(b.textContent || ''));
      if (acceptBtn) acceptBtn.click();
    });
  }

  // ===================== ATS DETECTION =====================
  function isWorkday() { return /myworkdayjobs\.com|myworkdaysite\.com|workday\.com\/.*\/job/i.test(location.href); }
  function detectATS() {
    const u = location.href;
    if (isWorkday()) return 'Workday';
    if (/greenhouse\.io|boards\.greenhouse/i.test(u)) return 'Greenhouse';
    if (/jobs\.lever\.co|lever\.co\/.*apply/i.test(u)) return 'Lever';
    if (/jobs\.ashbyhq\.com|ashbyhq\.com/i.test(u)) return 'Ashby';
    if (/smartrecruiters\.com/i.test(u)) return 'SmartRecruiters';
    if (/apply\.workable\.com|workable\.com/i.test(u)) return 'Workable';
    if (/icims\.com/i.test(u)) return 'iCIMS';
    if (/bamboohr\.com.*careers/i.test(u)) return 'BambooHR';
    if (/taleo\.net|oraclecloud\.com.*Candidate/i.test(u)) return 'Taleo';
    if (/jobvite\.com/i.test(u)) return 'Jobvite';
    if (/successfactors\.com|sapsf\.com/i.test(u)) return 'SuccessFactors';
    if (/workforcenow\.adp\.com/i.test(u)) return 'ADP';
    if (/breezy\.hr/i.test(u)) return 'Breezy';
    if (/ats\.rippling\.com/i.test(u)) return 'Rippling';
    if (/eightfold\.ai/i.test(u)) return 'Eightfold';
    if (/applytojob\.com|jazz\.co/i.test(u)) return 'JazzHR';
    if (/joinhandshake\.com/i.test(u)) return 'Handshake';
    if (/usajobs\.gov|governmentjobs\.com/i.test(u)) return 'USAJOBS';
    if (/paylocity\.com.*Recruiting/i.test(u)) return 'Paylocity';
    if (/freshteam\.com/i.test(u)) return 'Freshteam';
    if (/dover\.io|dover\.com/i.test(u)) return 'Dover';
    if (/pinpointhq\.com/i.test(u)) return 'Pinpoint';
    return null;
  }

  // ===================== APPLY-BUTTON CLICKERS =====================
  async function workdayClickApply() {
    if (/\/apply(\/|$)/i.test(location.pathname)) return true;
    if ($('[data-automation-id="quickApplyPage"],[data-automation-id="applyFlowAutoFillPage"],[data-automation-id="contactInformationPage"],[data-automation-id="applyFlowMyInfoPage"]')) return true;
    const sels = ['[data-automation-id="applyButton"]', '[data-automation-id="jobAction-apply"]', 'a[data-automation-id="applyButton"]', 'button[data-automation-id="applyButton"]'];
    for (const sel of sels) {
      const btn = $(sel);
      if (btn && isVisible(btn)) { LOG('Workday Apply'); clickWithFocus(btn); await sleep(1500); return true; }
    }
    const txt = $$('a, button, [role="button"]').find(b =>
      isVisible(b) && /^\s*(apply(?: now| for job)?)\s*$/i.test((b.textContent || '').trim()) &&
      !/easy.?apply|with.?linkedin|with.?indeed/i.test(b.textContent || '')
    );
    if (txt) { clickWithFocus(txt); await sleep(1500); return true; }
    return false;
  }

  async function workdayClickApplyManually(maxMs) {
    const deadline = Date.now() + (maxMs || 12000);
    while (Date.now() < deadline) {
      const am = $('[data-automation-id="applyManually"]');
      if (am && isVisible(am)) { LOG('Workday Apply Manually'); await sleep(300); clickWithFocus(am); await sleep(2000); return true; }
      const modal = $('[role="dialog"],[data-automation-id*="modal" i],[class*="modal" i],[class*="dialog" i]') || document;
      const fb = $$('button, a, [role="button"]', modal).find(b => {
        if (!isVisible(b)) return false;
        const t = (b.textContent || '').trim().toLowerCase();
        if (!t || /use\s*my\s*last\s*application|autofill\s*with|with\s*linkedin|use\s*linkedin|with\s*indeed|sign\s*in/.test(t)) return false;
        return /^apply\s*manually$|^manually(\s+apply)?$|^continue\s+manually$/.test(t);
      });
      if (fb) { await sleep(300); clickWithFocus(fb); await sleep(2000); return true; }
      await sleep(300);
    }
    return false;
  }

  async function genericApplyClick(ms) {
    const deadline = Date.now() + (ms || 3000);
    while (Date.now() < deadline) {
      const sels = [
        'a.posting-btn-submit', 'a[data-qa="show-page-apply"]',
        'button[data-test="apply-button"]', 'a[data-test="apply-button"]',
        '.st-apply-button', 'button.js-apply-button',
        '#apply_button', 'a#apply_button',
        '.application--button', '.application-button', '.apply-button',
        'button[aria-label="Apply" i]', 'a[aria-label="Apply" i]',
        'a[href*="/apply"]:not([href*="linkedin"]):not([href*="indeed"])',
        '[data-automation="job-detail-apply"]', '.btn-apply', '.btn-primary-apply',
        '[data-qa="btn-apply"]', '[data-qa="apply"]', 'button.application-action--cta',
      ];
      for (const sel of sels) {
        const btn = $(sel);
        if (btn && isVisible(btn)) {
          const t = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
          if (/easy.?apply|with\s*linkedin|with\s*indeed|sign\s*in/i.test(t)) continue;
          LOG('Generic Apply: ' + sel);
          clickWithFocus(btn); await sleep(2000); return true;
        }
      }
      const txt = $$('a, button, [role="button"]').find(b => {
        if (!isVisible(b)) return false;
        const t = (b.textContent || '').trim();
        if (!t || /easy.?apply|with\s*linkedin|with\s*indeed|sign\s*in|save\s*job|share|view/i.test(t)) return false;
        return /^apply(?:\s+now| for (?:this )?(?:job|position|role))?$/i.test(t);
      });
      if (txt) { clickWithFocus(txt); await sleep(2000); return true; }
      await sleep(300);
    }
    return false;
  }

  // ===================== FIELD HELPERS =====================
  function getLabel(el) {
    if (!el) return '';
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    const lb = el.getAttribute('aria-labelledby');
    if (lb) { const d = document.getElementById(lb); if (d?.textContent?.trim()) return d.textContent.trim(); }
    if (el.id) { const lbl = $(`label[for="${CSS.escape(el.id)}"]`); if (lbl) return lbl.textContent.trim(); }
    if (el.placeholder) return el.placeholder;
    const fs = el.closest('fieldset');
    if (fs) { const lg = fs.querySelector('legend'); if (lg?.textContent?.trim()) return lg.textContent.trim(); }
    const c = el.closest('.form-group,.field,.question,[class*="Field"],[class*="Question"],[class*="form-row"],li,.form-item,[data-automation-id]');
    if (c) {
      const lbl = c.querySelector('label,[class*="label"],[class*="Label"],legend,[class*="prompt"]');
      if (lbl && lbl !== el && !lbl.contains(el)) return lbl.textContent.trim();
    }
    return el.name || el.id || '';
  }

  function isFieldRequired(el) {
    if (!el) return false;
    if (el.required || el.getAttribute('aria-required') === 'true') return true;
    const lbl = getLabel(el);
    if (/\*\s*$|\(required\)|required/i.test(lbl || '')) return true;
    const c = el.closest('.field,.question,[class*="field"],[class*="Field"],li,div');
    if (c?.classList.contains('required') || c?.getAttribute('data-required') === 'true') return true;
    if (c?.querySelector('.required,.asterisk,[aria-label*="required" i]')) return true;
    return false;
  }

  function hasFieldValue(el) {
    if (!el) return false;
    if (el.tagName === 'SELECT') {
      if (!el.value?.trim()) return false;
      const t = (el.options[el.selectedIndex]?.textContent || '').trim().toLowerCase();
      return !!t && !/^(select|choose|please|--|—)/.test(t);
    }
    if (el.type === 'checkbox' || el.type === 'radio') return !!el.checked;
    return !!el.value?.trim();
  }

  function getMissingRequired() {
    const required = deepQueryAll('input:not([type=hidden]),textarea,select')
      .filter(el => isVisible(el) && isFieldRequired(el));
    const missing = [];
    for (const el of required) {
      if (el.type === 'radio' && el.name) {
        const group = $$(`input[type=radio][name="${CSS.escape(el.name)}"]`).filter(isVisible);
        if (group.some(r => r.checked)) continue;
      } else if (el.type === 'checkbox' && el.checked) continue;
      else if (hasFieldValue(el)) continue;
      const lbl = getLabel(el) || el.name || el.id || 'Required field';
      if (!missing.includes(lbl)) missing.push(lbl);
    }
    return missing;
  }

  // ===================== FALLBACK FILL =====================
  async function fallbackFill() {
    const p = await getProfile();
    let filled = 0;

    const inputs = deepQueryAll('input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=button]):not([type=password]),textarea')
      .filter(el => isVisible(el) && !el.value?.trim());
    for (const inp of inputs) {
      const lbl = getLabel(inp);
      if (!lbl) continue;
      const val = knockoutAnswer(lbl, p);
      if (!val) continue;
      // No focus() / scrollIntoView on every field — just set the value silently
      // and dispatch the events the framework needs.
      nativeSet(inp, val);
      filled++;
      await sleep(70);
    }

    const selects = deepQueryAll('select').filter(el => isVisible(el) && !hasFieldValue(el));
    for (const sel of selects) {
      const lbl = getLabel(sel);
      const val = knockoutAnswer(lbl, p);
      const opts = $$('option', sel).filter(o => o.value && o.index > 0);
      if (!opts.length) continue;
      let opt;
      if (val) {
        const v = val.toLowerCase();
        opt = opts.find(o => o.text.toLowerCase() === v) ||
              opts.find(o => o.text.toLowerCase().includes(v)) ||
              opts.find(o => v.includes(o.text.toLowerCase()) && o.text.length > 1);
      }
      if (!opt && /gender|disabilit|veteran|race|ethnic/i.test(lbl)) {
        opt = opts.find(o => /prefer not|decline|do not|don.t wish/i.test(o.text));
      }
      if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); filled++; }
    }

    const groups = {};
    deepQueryAll('input[type=radio]').filter(isVisible).forEach(r => { (groups[r.name || r.id] ||= []).push(r); });
    for (const radios of Object.values(groups)) {
      if (radios.some(r => r.checked)) continue;
      const parent = radios[0].closest('fieldset, .question, [class*="question"], .form-group, [class*="field"]');
      const groupTxt = (parent?.textContent || '').toLowerCase().replace(/\s+/g, ' ');
      const labels = radios.map(r => {
        const lbl = $(`label[for="${CSS.escape(r.id)}"]`)?.textContent || r.value || '';
        return lbl.toLowerCase().trim();
      });
      const target = (knockoutAnswer(groupTxt, p) || '').toLowerCase();
      let pick = null;
      if (target) {
        pick = radios.find((r, i) => labels[i].includes(target)) ||
               radios.find((r, i) => target.includes(labels[i]) && labels[i].length > 1);
      }
      if (!pick) pick = radios.find((r, i) => !/decline|prefer not|do not wish/.test(labels[i])) || radios[0];
      if (pick) { realClick(pick); filled++; await sleep(70); }
    }

    deepQueryAll('input[type=checkbox]').filter(el => isVisible(el) && !el.checked && (isFieldRequired(el) || el.required)).forEach(cb => { realClick(cb); filled++; });
    return filled;
  }

  async function aggressiveFillMissing() {
    const p = await getProfile();
    const required = deepQueryAll('input:not([type=hidden]):not([type=file]),textarea,select')
      .filter(el => isVisible(el) && isFieldRequired(el) && !hasFieldValue(el));
    for (const el of required) {
      const lbl = getLabel(el) || el.name || el.placeholder || '';
      const meta = ((lbl || '') + ' ' + (el.name || '') + ' ' + (el.id || '')).toLowerCase();
      let val = knockoutAnswer(lbl, p);
      if (!val) {
        if (el.type === 'email' || /\bemail\b/.test(meta)) val = p.email || '';
        else if (el.type === 'tel' || /phone|mobile|cell/.test(meta)) val = p.phone || '';
        else if (el.type === 'url' || /\burl\b|\blink\b|website|portfolio/.test(meta)) val = p.website || p.linkedin || '';
        else if (/linkedin/.test(meta)) val = p.linkedin || '';
        else if (/github/.test(meta)) val = p.github || '';
        else if (el.type === 'number' || /salary|years|gpa|number/.test(meta)) {
          if (/salary|compensation/.test(meta)) val = String(p.expected_salary || 80000);
          else if (/years|experience/.test(meta)) val = '5';
          else if (/gpa/.test(meta)) val = '3.5';
          else val = '0';
        }
        else if (el.type === 'date') {
          const d = new Date(); d.setDate(d.getDate() + 14);
          val = d.toISOString().split('T')[0];
        }
        else if (el.tagName === 'TEXTAREA') val = p.cover_letter || 'I am excited to apply for this role and look forward to contributing to your team.';
        else if (el.tagName === 'SELECT') {
          const opts = $$('option', el).filter(o => o.value && o.index > 0);
          if (opts.length) {
            const safe = opts.find(o => /no|none|prefer not|decline|n\/a|other/i.test(o.text)) || opts[0];
            el.value = safe.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            continue;
          }
        }
        else val = 'N/A';
      }
      if (val === 'N/A' && /^(email|tel|url|number|date)$/i.test(el.type || '')) val = '';
      if (val && el.tagName !== 'SELECT') { nativeSet(el, val); await sleep(70); }
    }
  }

  // ===================== GENERIC RESUME UPLOAD =====================
  async function uploadResumeGeneric() {
    const fileInputs = deepQueryAll('input[type="file"]').filter(el => {
      const meta = ((getLabel(el) || '') + ' ' + (el.name || '') + ' ' + (el.id || '') + ' ' + (el.accept || '')).toLowerCase();
      if (/photo|avatar|profile.?pic|headshot|signature/.test(meta)) return false;
      return /resume|cv|cover|document|upload|attach|file/.test(meta) || /pdf|application\/pdf|\.pdf|\.doc/.test(el.accept || '');
    });
    if (!fileInputs.length) return false;

    let data = await st.get('resume');
    if (!data?.base64) {
      const profile = await st.get('profile');
      const prof = typeof profile === 'string' ? JSON.parse(profile) : profile;
      data = prof?.resumeData;
    }
    if (!data?.base64 || !data?.fileName) return false;

    let uploaded = 0;
    for (const input of fileInputs) {
      if (input.files?.length > 0) continue;
      const container = input.closest('div, fieldset, section, [class*="upload"], [class*="resume"]') || input.parentElement;
      if (container?.querySelector('.file-name,[data-automation-id="file-name"],.upload-filename,[class*="uploaded"]')?.textContent?.trim()) continue;
      try {
        const byteString = atob(data.base64.split(',').pop() || data.base64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const file = new File([ab], data.fileName, { type: data.mimeType || 'application/pdf' });
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        LOG(`Resume uploaded: ${data.fileName}`);
        uploaded++;
        await sleep(1200);
      } catch (e) { LOG('Resume upload failed: ' + e.message); }
    }
    return uploaded > 0;
  }

  // ===================== WATCHDOG =====================
  async function requiredFieldWatchdog(maxAttempts) {
    const max = maxAttempts || 8;
    dismissCookieBanners();
    let last = -1, stuck = 0;
    for (let i = 1; i <= max; i++) {
      const missing = getMissingRequired();
      if (missing.length === 0) return { ok: true, missing: [], attempts: i };
      LOG(`Watchdog ${i}/${max}: ${missing.length} missing`);
      if (missing.length === last) {
        stuck++;
        if (stuck >= 2) { dismissCookieBanners(); await aggressiveFillMissing(); }
        else await fallbackFill();
      } else { stuck = 0; await fallbackFill(); }
      last = missing.length;
      await sleep(400);
    }
    const final = getMissingRequired();
    return { ok: final.length === 0, missing: final, attempts: max };
  }

  async function clickNextOrSubmit() {
    const watch = await requiredFieldWatchdog(6);
    if (!watch.ok) { LOG('Refusing Next/Submit — fields still missing'); return false; }
    const nextSels = [
      'button[data-automation-id="bottom-navigation-next-button"]:not([disabled])',
      'button[data-automation-id="pageFooterNextButton"]:not([disabled])',
      'button[data-automation-id="next-button"]',
      'button[aria-label*="Next" i]:not([disabled])',
      'button[aria-label*="Continue" i]:not([disabled])',
      '[data-testid="next-step"]', '[data-testid="continue"]',
      'button[type="submit"]:not([disabled])',
    ];
    for (const sel of nextSels) {
      const btn = $(sel);
      if (btn && isVisible(btn)) { clickWithFocus(btn); await sleep(2500); return 'clicked'; }
    }
    const txtBtn = $$('button, a[role="button"], input[type="submit"]').find(b => {
      if (!isVisible(b)) return false;
      const t = (b.textContent || b.value || '').trim().toLowerCase();
      return /^(next|continue|proceed|save\s+(?:&|and)\s+continue|review|submit|apply|send|complete)\b/i.test(t) &&
        !/cancel|back|prev|close/i.test(t);
    });
    if (txtBtn) { clickWithFocus(txtBtn); await sleep(2500); return 'clicked'; }
    return false;
  }

  function checkSuccess() {
    const url = location.href.toLowerCase();
    if (/\/thanks?|\/success|\/confirmation|\/submitted|\/complete|\/applied/.test(url)) return true;
    const body = document.body?.innerText || '';
    if (/application submitted|thank you for applying|application received|we.?ve received your|successfully submitted|application complete|your application has been/i.test(body)) return true;
    if ($('[data-automation-id="congratulationsMessage"],[data-automation-id="confirmationMessage"],[data-automation-id="applicationSubmittedPage"]')) return true;
    return false;
  }

  // ===================== MAIN ATS FLOW =====================
  async function runWorkdayFlow() {
    LOG('Workday flow starting');
    await workdayClickApply();
    await workdayClickApplyManually(12000);
    await waitFor("[data-automation-id='quickApplyPage'],[data-automation-id='applyFlowAutoFillPage'],[data-automation-id='contactInformationPage'],[data-automation-id='applyFlowMyInfoPage'],[data-automation-id='applyFlowContainer'],[data-automation-id='applyFlowForm']", 10000);
    await sleep(1500);
    await uploadResumeGeneric();
    const MAX_PAGES = 12;
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (checkSuccess()) break;
      await sleep(1200);
      dismissCookieBanners();
      await sleep(800);
      await fallbackFill();
      await sleep(400);
      const res = await clickNextOrSubmit();
      if (!res) break;
      await sleep(2500);
    }
  }

  async function runGenericATSFlow() {
    LOG('Generic ATS flow starting');
    await genericApplyClick(3000);
    await sleep(1500);
    dismissCookieBanners();
    await uploadResumeGeneric();
    const MAX_PAGES = 8;
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (checkSuccess()) break;
      await sleep(1500);
      dismissCookieBanners();
      await fallbackFill();
      await sleep(400);
      const res = await clickNextOrSubmit();
      if (!res) break;
      await sleep(2500);
    }
  }

  // ===================== CUSTOM ANSWERS PANEL UI (v2.0) =====================
  // Floating "Custom Answers" panel. User can add Q&A pairs that override defaults.
  // Persists in chrome.storage.local.sa_custom_answers.
  function injectCustomAnswersPanel() {
    if (document.getElementById('sa-custom-panel')) return;
    if (window.self !== window.top) return;

    const css = `
      #sa-custom-fab{position:fixed;bottom:20px;right:20px;width:46px;height:46px;border-radius:50%;background:#2563eb;color:#fff;font-weight:700;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.25);z-index:2147483646;font-family:system-ui,-apple-system,sans-serif;border:none;transition:transform .15s}
      #sa-custom-fab:hover{transform:scale(1.08)}
      #sa-custom-panel{position:fixed;bottom:78px;right:20px;width:420px;max-height:78vh;background:#fff;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.3);z-index:2147483647;font-family:system-ui,-apple-system,sans-serif;color:#111;display:none;flex-direction:column;border:1px solid #e5e7eb}
      #sa-custom-panel.show{display:flex}
      #sa-custom-panel header{padding:14px 16px;background:#2563eb;color:#fff;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:space-between;font-weight:600;font-size:14px}
      #sa-custom-panel header .x{cursor:pointer;font-size:18px;line-height:1;border:0;background:transparent;color:#fff;padding:0 4px}
      #sa-custom-panel .body{padding:14px 16px;overflow-y:auto;flex:1;font-size:13px}
      #sa-custom-panel .hint{color:#6b7280;font-size:12px;margin-bottom:10px;line-height:1.4}
      #sa-custom-panel .row{display:flex;gap:8px;margin-bottom:10px;align-items:flex-start}
      #sa-custom-panel input,#sa-custom-panel textarea{flex:1;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;color:#111;background:#fff}
      #sa-custom-panel textarea{resize:vertical;min-height:60px}
      #sa-custom-panel button.add{padding:8px 14px;background:#2563eb;color:#fff;border:0;border-radius:6px;cursor:pointer;font-weight:600}
      #sa-custom-panel button.add:hover{background:#1d4ed8}
      #sa-custom-panel .list{margin-top:8px;border-top:1px solid #e5e7eb;padding-top:10px}
      #sa-custom-panel .item{padding:10px;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:8px;background:#f9fafb}
      #sa-custom-panel .item .kw{font-weight:600;color:#1e40af;font-size:12px;margin-bottom:4px;word-break:break-word}
      #sa-custom-panel .item .ans{color:#374151;font-size:12px;line-height:1.4;white-space:pre-wrap;word-break:break-word}
      #sa-custom-panel .item .del{float:right;background:#fee2e2;color:#dc2626;border:0;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;font-weight:600}
      #sa-custom-panel .empty{color:#9ca3af;font-size:12px;text-align:center;padding:14px;font-style:italic}
      #sa-custom-panel .count{color:#6b7280;font-size:11px;margin-top:2px}
      #sa-custom-panel label.lbl{font-size:11px;color:#374151;margin-bottom:4px;display:block;font-weight:600}
    `;
    const style = document.createElement('style');
    style.id = 'sa-custom-style';
    style.textContent = css;
    document.head.appendChild(style);

    const fab = document.createElement('button');
    fab.id = 'sa-custom-fab';
    fab.title = 'SpeedyApply Ultimate — Custom Answers';
    fab.textContent = 'Q&A';
    document.body.appendChild(fab);

    const panel = document.createElement('div');
    panel.id = 'sa-custom-panel';
    panel.innerHTML = `
      <header>
        <span>Custom Answers (override built-in)</span>
        <button class="x" type="button" aria-label="Close">×</button>
      </header>
      <div class="body">
        <div class="hint">Enter the keywords ATS uses in the question, then your answer. The autofill will match any question containing those keywords (e.g. <em>"sponsor, visa"</em> → <em>"No"</em>). Custom answers override every built-in default.</div>
        <label class="lbl">Keywords (comma-separated)</label>
        <div class="row"><input id="sa-kw" placeholder="e.g. years, python, experience"></div>
        <label class="lbl">Answer</label>
        <div class="row"><textarea id="sa-ans" placeholder="e.g. 7 years"></textarea></div>
        <div class="row"><button class="add" id="sa-add" type="button">Add Answer</button></div>
        <div class="list" id="sa-list"></div>
      </div>
    `;
    document.body.appendChild(panel);

    const closeBtn = panel.querySelector('.x');
    fab.onclick = () => { panel.classList.toggle('show'); renderList(); };
    closeBtn.onclick = () => panel.classList.remove('show');

    const addBtn = panel.querySelector('#sa-add');
    addBtn.onclick = async () => {
      const kwInput = panel.querySelector('#sa-kw');
      const ansInput = panel.querySelector('#sa-ans');
      const kws = (kwInput.value || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const ans = (ansInput.value || '').trim();
      if (!kws.length || !ans) { alert('Both keywords and answer are required.'); return; }
      _customAnswers.push({ keywords: kws, response: ans, createdAt: Date.now() });
      await saveCustomAnswers();
      kwInput.value = ''; ansInput.value = '';
      renderList();
    };

    function renderList() {
      const list = panel.querySelector('#sa-list');
      if (!_customAnswers.length) { list.innerHTML = '<div class="empty">No custom answers yet. Add one above.</div>'; return; }
      list.innerHTML = `<div class="count">${_customAnswers.length} custom answer${_customAnswers.length === 1 ? '' : 's'}</div>` +
        _customAnswers.map((e, i) => `
          <div class="item">
            <button class="del" data-i="${i}" type="button">Delete</button>
            <div class="kw">${e.keywords.map(k => escapeHtml(k)).join(', ')}</div>
            <div class="ans">${escapeHtml(e.response)}</div>
          </div>
        `).join('');
      list.querySelectorAll('.del').forEach(btn => {
        btn.onclick = async () => {
          const i = parseInt(btn.dataset.i);
          _customAnswers.splice(i, 1);
          await saveCustomAnswers();
          renderList();
        };
      });
    }
    function escapeHtml(s) { return (s + '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  }

  // ===================== INIT =====================
  async function init() {
    if (window.self !== window.top) return;
    await loadCustomAnswers();
    dismissCookieBanners();
    await ensureAutoClickEnabled();

    const ats = detectATS();
    if (ats) {
      LOG(`ATS detected: ${ats}`);
      [500, 1500, 3000, 6000].forEach(ms => setTimeout(dismissCookieBanners, ms));
      // Inject the panel on ATS pages so the user can edit their answers anywhere.
      setTimeout(injectCustomAnswersPanel, 1500);
      await sleep(2000);
      if (ats === 'Workday') await runWorkdayFlow();
      else await runGenericATSFlow();
    } else {
      // Still inject the panel on non-ATS pages so the user can manage answers anywhere.
      setTimeout(injectCustomAnswersPanel, 2000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
