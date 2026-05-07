// === SPEEDYAPPLY ULTIMATE ENHANCEMENT v1.0 (built on 2.23.4) ===
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
//   8. Backstop fill for fields SpeedyApply doesn't recognise (LinkedIn/GitHub/
//      portfolio links, "How did you hear about", EEO, sponsorship, salary, location).

(function () {
  'use strict';
  if (window.__saEnhancementLoaded) return;
  window.__saEnhancementLoaded = true;

  const LOG = (...a) => console.log('[SA+]', ...a);

  // ===================== GLOBAL ERROR HANDLER =====================
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason || '');
    if (/Could not establish connection|Receiving end does not exist|Extension context invalidated/i.test(msg)) {
      event.preventDefault();
    }
  });

  // ===================== DOM HELPERS =====================
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.offsetParent !== null;
  }

  // Walks every reachable shadow root so React/Vue/Plasmo-injected forms inside
  // custom elements are visible to the watchdog.
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

  function realClick(el) {
    if (!el) return;
    el.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.click();
  }

  function xpath(expr, ctx) {
    try { return document.evaluate(expr, ctx || document, null, 9, null).singleNodeValue; }
    catch (_) { return null; }
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

  // ===================== STORAGE / SETTINGS =====================
  const st = {
    get: k => new Promise(r => chrome.storage.local.get(k, d => r(typeof k === 'string' ? d[k] : d))),
    set: obj => new Promise(r => chrome.storage.local.set(obj, r)),
  };

  // Force SpeedyApply's `autoClickNextPage` so Apply Manually + Next fire automatically.
  // Only flips the flag when it's currently false/undefined to respect explicit user opt-out.
  async function ensureAutoClickEnabled() {
    try {
      const settings = (await st.get('autofillSettings')) || {};
      let parsed = settings;
      if (typeof settings === 'string') { try { parsed = JSON.parse(settings); } catch (_) { parsed = {}; } }
      if (parsed && parsed.autoClickNextPage === true) return; // Respect existing on
      const next = { ...parsed, autoClickNextPage: true, saveApplications: parsed.saveApplications !== false, saveResponses: parsed.saveResponses !== false };
      // SpeedyApply stores autofillSettings as the parsed object in some versions,
      // and a JSON string in others. Mirror what we read.
      await st.set({ autofillSettings: typeof settings === 'string' ? JSON.stringify(next) : next });
      LOG('Enabled SpeedyApply autoClickNextPage');
    } catch (e) { LOG('Could not toggle autoClickNextPage: ' + e.message); }
  }

  async function getProfile() {
    try {
      const raw = await st.get('profile');
      if (!raw) return {};
      const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
      // SpeedyApply nests profile data — flatten the bits we need.
      const flat = {
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
      return flat;
    } catch (e) { return {}; }
  }

  // ===================== COOKIE / CONSENT BANNER DISMISSAL =====================
  function dismissCookieBanners() {
    // OneTrust
    const ot = $('#onetrust-accept-btn-handler,#onetrust-pc-btn-handler,button[id*="accept-recommended" i]');
    if (ot && isVisible(ot)) { LOG('Dismissing OneTrust banner'); ot.click(); }
    // Cookiebot
    const cb = $('#CybotCookiebotDialogBodyButtonAccept,#CybotCookiebotDialogBodyLevelButtonAccept');
    if (cb && isVisible(cb)) { LOG('Dismissing Cookiebot banner'); cb.click(); }
    // TrustArc
    const ta = $('.truste-button1,.truste-consent-button,#truste-consent-button');
    if (ta && isVisible(ta)) { LOG('Dismissing TrustArc banner'); ta.click(); }
    // Generic patterns
    const generic = $$('button, a').find(b => {
      if (!isVisible(b)) return false;
      const t = (b.textContent || b.getAttribute('aria-label') || '').trim().toLowerCase();
      return /^(accept(\s+all)?(\s+cookies)?|allow\s+all|got\s+it|i\s+(agree|accept)|ok|agree(\s+and\s+continue)?)$/i.test(t);
    });
    if (generic) { LOG('Dismissing generic banner: ' + (generic.textContent || '').trim()); generic.click(); }
    // Cookie/consent dialogs
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
    if (/tesla\.com\/careers/i.test(u)) return 'Tesla';
    if (/lifeattiktok\.com|careers\.tiktok/i.test(u)) return 'TikTok';
    return null;
  }

  // ===================== APPLY-BUTTON CLICKERS =====================
  // Click Apply on a Workday job listing.
  async function workdayClickApply() {
    if (/\/apply(\/|$)/i.test(location.pathname)) return true;
    if ($('[data-automation-id="quickApplyPage"],[data-automation-id="applyFlowAutoFillPage"],[data-automation-id="contactInformationPage"],[data-automation-id="applyFlowMyInfoPage"]')) return true;
    const sels = [
      '[data-automation-id="applyButton"]',
      '[data-automation-id="jobAction-apply"]',
      'a[data-automation-id="applyButton"]',
      'button[data-automation-id="applyButton"]',
    ];
    for (const sel of sels) {
      const btn = $(sel);
      if (btn && isVisible(btn)) {
        LOG('Workday Apply click (' + sel + ')');
        realClick(btn);
        await sleep(1500);
        return true;
      }
    }
    const txt = $$('a, button, [role="button"]').find(b =>
      isVisible(b) && /^\s*(apply(?: now| for job)?)\s*$/i.test((b.textContent || '').trim()) &&
      !/easy.?apply|with.?linkedin|with.?indeed/i.test(b.textContent || '')
    );
    if (txt) { realClick(txt); await sleep(1500); return true; }
    return false;
  }

  // Click Apply Manually in the Workday "Start Your Application" modal.
  // Skips "Use My Last Application", "Autofill With Resume", "Apply With LinkedIn".
  async function workdayClickApplyManually(maxMs) {
    const deadline = Date.now() + (maxMs || 12000);
    while (Date.now() < deadline) {
      const am = $('[data-automation-id="applyManually"]') ||
                 $('a[data-automation-id="applyManually"]') ||
                 $('button[data-automation-id="applyManually"]');
      if (am && isVisible(am)) {
        LOG('Workday Apply Manually click');
        await sleep(300);
        realClick(am);
        await sleep(2000);
        return true;
      }
      const modal = $('[role="dialog"],[data-automation-id*="modal" i],[data-automation-id*="popup" i],[class*="modal" i],[class*="dialog" i]') || document;
      const fallback = $$('button, a, [role="button"]', modal).find(b => {
        if (!isVisible(b)) return false;
        const t = (b.textContent || '').trim().toLowerCase();
        if (!t) return false;
        if (/use\s*my\s*last\s*application|autofill\s*with|with\s*linkedin|use\s*linkedin|with\s*indeed|sign\s*in/i.test(t)) return false;
        return /^apply\s*manually$|^manually(\s+apply)?$|^continue\s+manually$/i.test(t);
      });
      if (fallback) { LOG('Workday Apply Manually click (text)'); await sleep(300); realClick(fallback); await sleep(2000); return true; }
      await sleep(300);
    }
    return false;
  }

  // Generic "Apply" / "Apply Now" / "Apply for this Job" click for non-Workday ATS.
  // Skips Easy-Apply / LinkedIn / Indeed variants.
  async function genericApplyClick(ms) {
    const deadline = Date.now() + (ms || 3000);
    while (Date.now() < deadline) {
      // ATS-specific selectors first
      const sels = [
        'a.posting-btn-submit', 'a[data-qa="show-page-apply"]',                // Lever
        'button[data-test="apply-button"]', 'a[data-test="apply-button"]',     // SmartRecruiters
        '.st-apply-button', 'button.js-apply-button',
        '#apply_button', 'a#apply_button',                                     // Greenhouse
        '.application--button', '.application-button', '.apply-button',
        'button[aria-label="Apply" i]', 'a[aria-label="Apply" i]',
        'a[href*="/apply"]:not([href*="linkedin"]):not([href*="indeed"])',
        '[data-automation="job-detail-apply"]',                                // Workable
        '.posting-btn-submit', '.btn-apply', '.btn-primary-apply',
        '[data-qa="btn-apply"]', '[data-qa="apply"]',
        'button.application-action--cta',                                       // Ashby
      ];
      for (const sel of sels) {
        const btn = $(sel);
        if (btn && isVisible(btn)) {
          const t = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
          if (/easy.?apply|with\s*linkedin|with\s*indeed|sign\s*in/i.test(t)) continue;
          LOG('Generic Apply click: ' + sel);
          realClick(btn);
          await sleep(2000);
          return true;
        }
      }
      // Text fallback
      const txt = $$('a, button, [role="button"]').find(b => {
        if (!isVisible(b)) return false;
        const t = (b.textContent || '').trim();
        if (!t) return false;
        if (/easy.?apply|with\s*linkedin|with\s*indeed|sign\s*in|save\s*job|share|view/i.test(t)) return false;
        return /^apply(?:\s+now| for (?:this )?(?:job|position|role))?$/i.test(t);
      });
      if (txt) { LOG('Generic Apply (text): ' + (txt.textContent || '').trim()); realClick(txt); await sleep(2000); return true; }
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
      } else if (el.type === 'checkbox' && el.checked) {
        continue;
      } else if (hasFieldValue(el)) continue;
      const lbl = getLabel(el) || el.name || el.id || 'Required field';
      if (!missing.includes(lbl)) missing.push(lbl);
    }
    return missing;
  }

  // ===================== SMART VALUE GUESSER =====================
  const DEFAULTS = {
    sponsorship: 'No', authorized: 'Yes', relocation: 'Yes', remote: 'Yes',
    veteran: 'I am not a protected veteran', disability: 'I do not have a disability',
    gender: 'Prefer not to say', ethnicity: 'Prefer not to say',
    years: '5', salary: '80000', notice: '2 weeks',
    cover: 'I am excited to apply for this role. My background and skills make me an excellent candidate and I look forward to contributing to your team.',
    howHeard: 'LinkedIn',
  };

  function guessValue(label, p) {
    const l = (label || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    if (/first.?name|given.?name/.test(l)) return p.first_name || '';
    if (/last.?name|family.?name|surname/.test(l)) return p.last_name || '';
    if (/full.?name|^name$/.test(l) && !/company|user/.test(l)) return `${p.first_name || ''} ${p.last_name || ''}`.trim();
    if (/\bemail\b/.test(l)) return p.email || '';
    if (/phone|mobile|cell|telephone/.test(l)) return p.phone || '';
    if (/\bcity\b/.test(l)) return p.city || '';
    if (/state|province|region/.test(l)) return p.state || '';
    if (/zip|postal/.test(l)) return p.postal_code || '';
    if (/country/.test(l) && !/code|phone/.test(l)) return p.country || '';
    if (/address|street/.test(l)) return p.address || '';
    if (/location|where.*(you|do you).*live/.test(l)) return p.city ? `${p.city}, ${p.state || p.country || ''}`.replace(/,\s*$/, '') : '';
    if (/linkedin/.test(l)) return p.linkedin || '';
    if (/github/.test(l)) return p.github || '';
    if (/website|portfolio|personal/.test(l)) return p.website || p.linkedin || '';
    if (/years.*(exp|work)|exp.*years|total.*experience/.test(l)) return DEFAULTS.years;
    if (/salary|compensation|expected.?pay/.test(l)) return String(p.expected_salary || DEFAULTS.salary);
    if (/sponsor|visa|immigration/.test(l)) return DEFAULTS.sponsorship;
    if (/authoriz|eligible|legally|right.*work/.test(l)) return DEFAULTS.authorized;
    if (/relocat/.test(l)) return DEFAULTS.relocation;
    if (/remote|hybrid/.test(l)) return DEFAULTS.remote;
    if (/veteran|military/.test(l)) return DEFAULTS.veteran;
    if (/disabilit/.test(l)) return DEFAULTS.disability;
    if (/gender|sex\b|pronouns/.test(l)) return DEFAULTS.gender;
    if (/ethnic|race|heritage/.test(l)) return DEFAULTS.ethnicity;
    if (/how.*hear|where.*(find|learn|hear)|source|referred/.test(l)) return DEFAULTS.howHeard;
    if (/cover.?letter|why.*(role|company|interest)|message.?to/.test(l)) return p.cover_letter || DEFAULTS.cover;
    if (/notice/.test(l)) return DEFAULTS.notice;
    if (/agree|consent|acknowledge|certif|confirm/.test(l)) return 'Yes';
    if (/criminal|felony|convicted/.test(l)) return 'No';
    if (/over.?18|18.*years/.test(l)) return 'Yes';
    return '';
  }

  // ===================== FALLBACK FILL =====================
  // Backstops SpeedyApply by filling fields it didn't recognise.
  async function fallbackFill() {
    const p = await getProfile();
    let filled = 0;

    const inputs = deepQueryAll('input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=button]):not([type=password]),textarea')
      .filter(el => isVisible(el) && !el.value?.trim());
    for (const inp of inputs) {
      const lbl = getLabel(inp);
      if (!lbl) continue;
      const val = guessValue(lbl, p);
      if (!val) continue;
      inp.focus();
      await sleep(50);
      nativeSet(inp, val);
      filled++;
      await sleep(80);
    }

    const selects = deepQueryAll('select').filter(el => isVisible(el) && !hasFieldValue(el));
    for (const sel of selects) {
      const lbl = getLabel(sel);
      const val = guessValue(lbl, p);
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

    // Radio groups: pick "yes" for affirmative defaults, "no" for sponsor/criminal,
    // otherwise first non-decline.
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
      let target = 'yes';
      if (/sponsor|visa|criminal|felony|convicted|require.*sponsor/i.test(groupTxt)) target = 'no';
      else if (/gender|sex\b|disabilit|veteran|race|ethnic|hispanic/i.test(groupTxt)) target = 'prefer not';
      else if (/how.*hear|source|referred/i.test(groupTxt)) target = DEFAULTS.howHeard.toLowerCase();
      let pick = radios.find((r, i) => labels[i].includes(target));
      if (!pick && /authoriz|eligible|right.*work|over.?18|consent|agree|acknowledge/.test(groupTxt)) {
        pick = radios.find((r, i) => /^yes$/.test(labels[i]));
      }
      if (!pick) {
        pick = radios.find((r, i) => !/decline|prefer not|do not wish/.test(labels[i])) || radios[0];
      }
      if (pick) { realClick(pick); filled++; await sleep(80); }
    }

    // Required checkboxes (consent / acknowledgement)
    deepQueryAll('input[type=checkbox]').filter(el => isVisible(el) && !el.checked && (isFieldRequired(el) || el.required)).forEach(cb => { realClick(cb); filled++; });

    return filled;
  }

  // Type-aware aggressive fill — never writes "N/A" into URL/email/phone/number/date.
  async function aggressiveFillMissing() {
    const p = await getProfile();
    const required = deepQueryAll('input:not([type=hidden]):not([type=file]),textarea,select')
      .filter(el => isVisible(el) && isFieldRequired(el) && !hasFieldValue(el));
    for (const el of required) {
      const lbl = getLabel(el) || el.name || el.placeholder || '';
      const meta = ((lbl || '') + ' ' + (el.name || '') + ' ' + (el.id || '')).toLowerCase();
      let val = guessValue(lbl, p);
      if (!val) {
        if (el.type === 'email' || /\bemail\b/.test(meta)) val = p.email || '';
        else if (el.type === 'tel' || /phone|mobile|cell/.test(meta)) val = p.phone || '';
        else if (el.type === 'url' || /\burl\b|\blink\b|website|portfolio/.test(meta)) val = p.website || p.linkedin || '';
        else if (/linkedin/.test(meta)) val = p.linkedin || '';
        else if (/github/.test(meta)) val = p.github || '';
        else if (el.type === 'number' || /salary|years|experience|gpa|number/.test(meta)) {
          if (/salary|compensation/.test(meta)) val = String(p.expected_salary || DEFAULTS.salary);
          else if (/years|experience/.test(meta)) val = DEFAULTS.years;
          else if (/gpa/.test(meta)) val = '3.5';
          else val = '0';
        }
        else if (el.type === 'date') {
          const d = new Date(); d.setDate(d.getDate() + 14);
          val = d.toISOString().split('T')[0];
        }
        else if (el.tagName === 'TEXTAREA') val = p.cover_letter || DEFAULTS.cover;
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
      // Sanity guard
      if (val === 'N/A' && /^(email|tel|url|number|date)$/i.test(el.type || '')) val = '';
      if (val && el.tagName !== 'SELECT') { el.focus(); nativeSet(el, val); await sleep(80); }
    }
  }

  // ===================== GENERIC RESUME UPLOAD =====================
  // Uses the SpeedyApply DataTransfer pattern but applied to ANY ATS file input.
  async function uploadResumeGeneric() {
    const fileInputs = deepQueryAll('input[type="file"]').filter(el => {
      const meta = ((getLabel(el) || '') + ' ' + (el.name || '') + ' ' + (el.id || '') + ' ' + (el.accept || '')).toLowerCase();
      if (/photo|avatar|profile.?pic|headshot|signature/.test(meta)) return false;
      return /resume|cv|cover|document|upload|attach|file/.test(meta) || /pdf|application\/pdf|\.pdf|\.doc/.test(el.accept || '');
    });
    if (!fileInputs.length) return false;

    // SpeedyApply stores resume bytes under `resume` (object with base64 + name) in
    // some versions, and under `profile.resumeData` in others. Try both.
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
        LOG(`Resume uploaded via DataTransfer: ${data.fileName}`);
        uploaded++;
        await sleep(1200);
      } catch (e) { LOG('Resume upload failed: ' + e.message); }
    }
    return uploaded > 0;
  }

  // ===================== REQUIRED-FIELD WATCHDOG =====================
  // Re-runs the fill until every required field has a value (or maxAttempts
  // exhausted). Used before every Next/Submit click so we never advance with
  // missing required entries.
  async function requiredFieldWatchdog(maxAttempts) {
    const max = maxAttempts || 8;
    dismissCookieBanners();
    let last = -1, stuck = 0;
    for (let i = 1; i <= max; i++) {
      const missing = getMissingRequired();
      if (missing.length === 0) {
        if (i > 1) LOG(`Watchdog OK after ${i - 1} retries`);
        return { ok: true, missing: [], attempts: i };
      }
      LOG(`Watchdog ${i}/${max}: ${missing.length} missing — ${missing.slice(0, 4).join(' | ')}${missing.length > 4 ? '...' : ''}`);
      if (missing.length === last) {
        stuck++;
        if (stuck >= 2) { dismissCookieBanners(); await aggressiveFillMissing(); }
        else await fallbackFill();
      } else { stuck = 0; await fallbackFill(); }
      last = missing.length;
      await sleep(400);
    }
    const final = getMissingRequired();
    LOG(`Watchdog gave up: ${final.length} required still missing`);
    return { ok: final.length === 0, missing: final, attempts: max };
  }

  // ===================== NEXT/SUBMIT (gated on watchdog) =====================
  async function clickNextOrSubmit() {
    const watch = await requiredFieldWatchdog(6);
    if (!watch.ok) {
      LOG('Refusing to click Next/Submit — required fields still missing');
      return false;
    }
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
      if (btn && isVisible(btn)) { realClick(btn); await sleep(2500); return 'clicked'; }
    }
    const txtBtn = $$('button, a[role="button"], input[type="submit"]').find(b => {
      if (!isVisible(b)) return false;
      const t = (b.textContent || b.value || '').trim().toLowerCase();
      return /^(next|continue|proceed|save\s+(?:&|and)\s+continue|review|submit|apply|send|complete)\b/i.test(t) &&
        !/cancel|back|prev|close/i.test(t);
    });
    if (txtBtn) { realClick(txtBtn); await sleep(2500); return 'clicked'; }
    return false;
  }

  // ===================== SUCCESS DETECTION =====================
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
    // Walk every page
    const MAX_PAGES = 12;
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (checkSuccess()) { LOG('Workday: success'); break; }
      await sleep(1200);
      dismissCookieBanners();
      // Let SpeedyApply's bundled handlers fire first; backstop with our fallback.
      await sleep(800);
      await fallbackFill();
      await sleep(400);
      const res = await clickNextOrSubmit();
      if (!res) { LOG('Workday: no Next/Submit, stopping'); break; }
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
      if (checkSuccess()) { LOG('Success'); break; }
      await sleep(1500);
      dismissCookieBanners();
      await fallbackFill();
      await sleep(400);
      const res = await clickNextOrSubmit();
      if (!res) { LOG('No Next/Submit, stopping'); break; }
      await sleep(2500);
    }
  }

  // ===================== INIT =====================
  async function init() {
    if (window.self !== window.top) return; // top-frame only
    dismissCookieBanners();
    await ensureAutoClickEnabled();

    const ats = detectATS();
    if (!ats) return;
    LOG(`ATS detected: ${ats}`);

    [500, 1500, 3000, 6000].forEach(ms => setTimeout(dismissCookieBanners, ms));

    await sleep(2000);
    if (ats === 'Workday') await runWorkdayFlow();
    else await runGenericATSFlow();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
