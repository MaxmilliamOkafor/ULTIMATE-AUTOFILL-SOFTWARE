/**
 * Simplify+ Enhancement — Ultimate Autofill Integration v2.0.0
 * Unlocks Simplify+ features: unlimited tokens, AI autofill, cover letters,
 * tailored resumes, networking/referrals. Combines Jobright, OptimHire,
 * SpeedyApply, LazyApply, and JobWizard autofill patterns.
 *
 * v2.0.0 Changes:
 * - Fixed Education section (school name autocomplete, "Others"/"Other" fallback)
 * - Universal date format compliance for all ATS (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)
 * - Advanced multi-choice question answering (Yes/No, experience ranges, radio buttons)
 * - Removed all "Upgrade to Simplify+" prompts and modals
 * - CSV import support and CTRL+Click to queue
 * - Quick Answer engine with unlimited use
 */
(function () {
  'use strict';
  if (window.__simplifyEnhancementLoaded) return;
  window.__simplifyEnhancementLoaded = true;
  const LOG = (...a) => console.log('%c[Simplify+]', 'color:#7c3aed;font-weight:bold', ...a);
  LOG('Enhancement loading...');

  // ===================== SIMPLIFY+ UNLIMITED BYPASS =====================
  // Intercept fetch to override subscription/token API responses
  const _origFetch = window.fetch;
  window.fetch = async function (...args) {
    const [url, opts] = args;
    const u = typeof url === 'string' ? url : url?.url || '';

    // Bypass subscription check — always return subscribed
    if (u.includes('/v2/candidate/me/subscription')) {
      LOG('Intercepting subscription check → Simplify+ UNLIMITED');
      const resp = await _origFetch.apply(this, args).catch(() => null);
      if (resp && resp.ok) {
        const data = await resp.clone().json().catch(() => ({}));
        data.isSubscribed = true;
        data.subscription_status = 'active';
        data.plan = 'simplify_plus';
        data.tier = 'unlimited';
        data.active = true;
        data.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        return new Response(JSON.stringify(data), { status: 200, headers: resp.headers });
      }
      // If request failed, return fake subscribed response
      return new Response(JSON.stringify({
        isSubscribed: true, subscription_status: 'active', plan: 'simplify_plus',
        tier: 'unlimited', active: true,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    // Bypass token check — always return unlimited tokens
    if (u.includes('/v2/candidate/me/copilot/tokens')) {
      LOG('Intercepting token check → unlimited tokens');
      const resp = await _origFetch.apply(this, args).catch(() => null);
      if (resp && resp.ok) {
        const data = await resp.clone().json().catch(() => ({}));
        data.available = 99999;
        data.total = 99999;
        data.used = 0;
        data.remaining = 99999;
        if (data.tokens) { data.tokens.available = 99999; data.tokens.total = 99999; }
        return new Response(JSON.stringify(data), { status: 200, headers: resp.headers });
      }
      return new Response(JSON.stringify({
        available: 99999, total: 99999, used: 0, remaining: 99999,
        tokens: { available: 99999, total: 99999 }
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    // Bypass cover letter generation limits
    if (u.includes('/v2/candidate/me/copilot/cover-letter') && opts?.method === 'POST') {
      LOG('Cover letter generation — bypassing limits');
    }

    // Bypass question answering limits
    if (u.includes('/v2/candidate/me/copilot/question') && opts?.method === 'POST') {
      LOG('AI question answering — bypassing limits');
    }

    // Generic rate limit / quota bypass
    if (/\/(rate-limit|quota|usage|limit|credits?|coins?|balance)/i.test(u)) {
      LOG('Bypassing rate limit/quota check');
      const resp = await _origFetch.apply(this, args).catch(() => null);
      if (resp) {
        const data = await resp.clone().json().catch(() => ({}));
        if (typeof data.remaining !== 'undefined') data.remaining = 99999;
        if (typeof data.available !== 'undefined') data.available = 99999;
        if (typeof data.limit !== 'undefined') data.limit = 99999;
        if (typeof data.used !== 'undefined') data.used = 0;
        return new Response(JSON.stringify(data), { status: 200, headers: resp.headers });
      }
    }

    return _origFetch.apply(this, args);
  };

  // Intercept XMLHttpRequest for older API calls
  const _origXHROpen = XMLHttpRequest.prototype.open;
  const _origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._enhUrl = url;
    return _origXHROpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    const url = this._enhUrl || '';
    if (/subscription|copilot\/tokens|rate-limit|quota|credits|coins|balance/i.test(url)) {
      this.addEventListener('readystatechange', function () {
        if (this.readyState === 4) {
          try {
            const data = JSON.parse(this.responseText);
            if (url.includes('subscription')) {
              data.isSubscribed = true; data.subscription_status = 'active';
              data.plan = 'simplify_plus'; data.active = true;
            }
            if (url.includes('tokens')) {
              data.available = 99999; data.total = 99999; data.remaining = 99999;
            }
            Object.defineProperty(this, 'responseText', { value: JSON.stringify(data) });
            Object.defineProperty(this, 'response', { value: JSON.stringify(data) });
          } catch (_) {}
        }
      });
    }
    return _origXHRSend.apply(this, args);
  };

  // ===================== PROFILE & DEFAULTS (Ireland locale) =====================
  const DEFAULTS = {
    authorized: 'Yes', sponsorship: 'No', relocation: 'Yes', remote: 'Yes',
    veteran: 'I am not a protected veteran', disability: 'I do not have a disability',
    gender: 'Prefer not to say', ethnicity: 'Prefer not to say', race: 'Prefer not to say',
    years: '5', salary: '80000', notice: '2 weeks', availability: 'Immediately',
    country: 'Ireland', phoneCountryCode: '+353', countryCode: 'IE',
    cover: 'I am excited to apply for this role. My background and skills make me an excellent candidate and I look forward to contributing to your team.',
    why: 'I admire the company culture and the opportunity to make a meaningful impact.',
    howHeard: 'LinkedIn',
  };

  const st = {
    get: k => new Promise(r => chrome.storage.local.get(k, d => r(d[k]))),
    set: (k, v) => new Promise(r => chrome.storage.local.set({ [k]: v }, r)),
    getMulti: keys => new Promise(r => chrome.storage.local.get(keys, d => r(d)))
  };

  async function getProfile() {
    let p = (await st.get('ua_profile')) || {};
    const ohData = await st.getMulti(['candidateDetails', 'userDetails']);
    try {
      const cd = typeof ohData.candidateDetails === 'string' ? JSON.parse(ohData.candidateDetails) : (ohData.candidateDetails || {});
      const ud = typeof ohData.userDetails === 'string' ? JSON.parse(ohData.userDetails) : (ohData.userDetails || {});
      p = { ...ud, ...cd, ...p };
    } catch (_) {}
    return p;
  }

  // ===================== DOM HELPERS =====================
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const $ = (sel, root) => (root || document).querySelector(sel);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function isVisible(el) {
    if (!el) return false;
    try {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    } catch (_) { return false; }
  }

  function nativeSet(el, val) {
    try {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, val); else el.value = val;
    } catch (_) { el.value = val; }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function realClick(el) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.click();
  }

  function getLabel(el) {
    if (!el) return '';
    const id = el.id;
    if (id) { const lbl = $(`label[for="${CSS.escape(id)}"]`); if (lbl) return lbl.textContent?.trim(); }
    const p = el.closest('label, .form-group, .field, [class*="field"], [class*="form-row"]');
    if (p) { const lbl = p.querySelector('label, .label, [class*="label"]'); if (lbl) return lbl.textContent?.trim(); }
    return el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('data-label') || el.name || '';
  }

  function hasFieldValue(el) {
    if (!el) return false;
    if (el.tagName === 'SELECT') return el.selectedIndex > 0;
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked;
    return !!el.value?.trim();
  }

  // ===================== UNIVERSAL DATE FORMAT HANDLER =====================
  function formatDate(dateStr, targetFormat) {
    if (!dateStr) return '';
    let month, day, year;
    let m = dateStr.match(/^(\d{1,2})\/(\d{4})$/);
    if (m) { month = parseInt(m[1]); day = 1; year = parseInt(m[2]); }
    if (!m) { m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) { month = parseInt(m[1]); day = parseInt(m[2]); year = parseInt(m[3]); } }
    if (!m) { m = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (m) { year = parseInt(m[1]); month = parseInt(m[2]); day = parseInt(m[3]); } }
    if (!m) {
      const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
      m = dateStr.match(/^(\w+)\s+(\d{4})$/);
      if (m) { month = months[m[1].toLowerCase().slice(0, 3)] || 1; day = 1; year = parseInt(m[2]); }
    }
    if (!m) { m = dateStr.match(/^(\d{4})$/); if (m) { year = parseInt(m[1]); month = 1; day = 1; } }
    if (!year) return dateStr;
    const pad = n => String(n).padStart(2, '0');
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    switch (targetFormat) {
      case 'MM/DD/YYYY': return `${pad(month)}/${pad(day)}/${year}`;
      case 'DD/MM/YYYY': return `${pad(day)}/${pad(month)}/${year}`;
      case 'YYYY-MM-DD': return `${year}-${pad(month)}-${pad(day)}`;
      case 'MM/YYYY': return `${pad(month)}/${year}`;
      case 'YYYY': return `${year}`;
      case 'Month YYYY': return `${monthNames[month]} ${year}`;
      case 'YYYY-MM': return `${year}-${pad(month)}`;
      default: return `${pad(month)}/${pad(day)}/${year}`;
    }
  }

  function detectDateFormat(el) {
    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const type = el.type;
    if (type === 'date') return 'YYYY-MM-DD';
    if (type === 'month') return 'YYYY-MM';
    if (/mm\/dd\/yyyy/i.test(placeholder)) return 'MM/DD/YYYY';
    if (/dd\/mm\/yyyy/i.test(placeholder)) return 'DD/MM/YYYY';
    if (/yyyy-mm-dd/i.test(placeholder)) return 'YYYY-MM-DD';
    if (/mm\/yyyy/i.test(placeholder)) return 'MM/YYYY';
    if (/yyyy/i.test(placeholder) && !/mm|dd/i.test(placeholder)) return 'YYYY';
    const parent = el.closest('.form-group, .field, [class*="field"]');
    if (parent) {
      const hint = parent.querySelector('.hint, .helper-text, [class*="hint"], small');
      if (hint) {
        const h = hint.textContent.toLowerCase();
        if (/mm\/dd\/yyyy/.test(h)) return 'MM/DD/YYYY';
        if (/dd\/mm\/yyyy/.test(h)) return 'DD/MM/YYYY';
        if (/yyyy-mm-dd/.test(h)) return 'YYYY-MM-DD';
      }
    }
    const url = location.href.toLowerCase();
    if (/workday/i.test(url)) return 'MM/DD/YYYY';
    if (/greenhouse/i.test(url)) return 'MM/DD/YYYY';
    if (/lever\.co/i.test(url)) return 'MM/YYYY';
    if (/smartrecruiters/i.test(url)) return 'YYYY-MM-DD';
    return 'MM/DD/YYYY';
  }

  // ===================== FULL QUESTION TEXT EXTRACTOR =====================
  function getFullQuestionText(el) {
    if (!el) return '';
    const containers = ['.question', '[class*="question"]', '.field', '.form-group',
      '[class*="FormField"]', '[data-automation-id]', 'fieldset'];
    for (const sel of containers) {
      const p = el.closest(sel);
      if (p) return p.textContent?.trim().replace(/\s+/g, ' ') || '';
    }
    return getLabel(el);
  }

  // ===================== EDUCATION SECTION HANDLER =====================
  async function fillEducationFields(p) {
    let filled = 0;
    const school = p.school || p.university || 'Imperial College London';
    const degree = p.degree || 'Master of Science';
    const major = p.major || 'Artificial Intelligence and Machine Learning';
    const gpa = p.gpa || '3.9';
    const eduStart = p.edu_start_date || '09/2019';
    const eduEnd = p.edu_end_date || '06/2021';

    // School/University selects — with "Other" fallback
    const schoolSelects = $$('select').filter(el => {
      const l = getLabel(el).toLowerCase();
      return isVisible(el) && !hasFieldValue(el) && /school|university|college|institution|alma/i.test(l);
    });
    for (const sel of schoolSelects) {
      const opts = $$('option', sel);
      let match = opts.find(o => o.text.toLowerCase().includes(school.toLowerCase()));
      if (!match) {
        // Try partial word match
        const words = school.toLowerCase().split(/\s+/);
        match = opts.find(o => words.some(w => w.length > 3 && o.text.toLowerCase().includes(w)));
      }
      if (!match) {
        // Fallback to "Other" / "Others"
        match = opts.find(o => /^others?$/i.test(o.text.trim())) ||
          opts.find(o => /\bother\b|not listed|not found|unlisted/i.test(o.text));
        if (match) LOG('School not found in dropdown, selected "Other"');
      }
      if (match) { sel.value = match.value; sel.dispatchEvent(new Event('change', { bubbles: true })); filled++; }
      await sleep(300);
      // After selecting "Other", fill any revealed text input
      const otherInput = $$('input[type="text"]').find(el => {
        const l = getLabel(el).toLowerCase();
        return isVisible(el) && !hasFieldValue(el) && /other|specify|school|university|name/i.test(l);
      });
      if (otherInput) { nativeSet(otherInput, school); filled++; }
    }

    // School text inputs with autocomplete
    const schoolInputs = $$('input[type="text"]').filter(el => {
      const l = getLabel(el).toLowerCase();
      return isVisible(el) && !hasFieldValue(el) && /school|university|college|institution|alma/i.test(l);
    });
    for (const inp of schoolInputs) {
      nativeSet(inp, school);
      filled++;
      await sleep(600);
      // Check for autocomplete dropdown
      const dropdown = $('[class*="autocomplete"], [class*="typeahead"], [class*="suggestion"], [role="listbox"], [class*="dropdown-menu"]:not([style*="display: none"])');
      if (dropdown && isVisible(dropdown)) {
        const items = $$('li, [role="option"], [class*="option"]', dropdown);
        let match = items.find(i => i.textContent?.toLowerCase().includes(school.toLowerCase()));
        if (!match) {
          const words = school.toLowerCase().split(/\s+/);
          match = items.find(i => words.some(w => w.length > 3 && i.textContent?.toLowerCase().includes(w)));
        }
        if (match) { realClick(match); await sleep(300); }
        else {
          // Click "Other" if available
          const other = items.find(i => /^others?$/i.test(i.textContent?.trim())) ||
            items.find(i => /\bother\b|not listed/i.test(i.textContent));
          if (other) { realClick(other); LOG('School autocomplete: selected "Other"'); await sleep(300); }
        }
      }
    }

    // Degree selects
    const degreeSelects = $$('select').filter(el => {
      const l = getLabel(el).toLowerCase();
      return isVisible(el) && !hasFieldValue(el) && /\bdegree\b|education.*level|qualification/i.test(l) && !/field|major/i.test(l);
    });
    for (const sel of degreeSelects) {
      const opts = $$('option', sel);
      let match = opts.find(o => /master/i.test(o.text));
      if (!match) match = opts.find(o => /bachelor|bs|ba|b\.s/i.test(o.text));
      if (!match) match = opts.find(o => /degree|graduate/i.test(o.text));
      if (match) { sel.value = match.value; sel.dispatchEvent(new Event('change', { bubbles: true })); filled++; }
    }

    // Major/Field of Study selects with "Other" fallback
    const majorSelects = $$('select').filter(el => {
      const l = getLabel(el).toLowerCase();
      return isVisible(el) && !hasFieldValue(el) && /major|field.*study|concentration|specialization|discipline/i.test(l);
    });
    for (const sel of majorSelects) {
      const opts = $$('option', sel);
      let match = opts.find(o => /artificial|intelligence|machine|learning|computer|science/i.test(o.text));
      if (!match) match = opts.find(o => /technology|computing|engineering|stem/i.test(o.text));
      if (!match) {
        match = opts.find(o => /^others?$/i.test(o.text.trim())) || opts.find(o => /\bother\b/i.test(o.text));
        if (match) LOG('Major not found in dropdown, selected "Other"');
      }
      if (match) { sel.value = match.value; sel.dispatchEvent(new Event('change', { bubbles: true })); filled++; }
    }

    // Education date fields — universal format compliance
    const eduDateFields = $$('input').filter(el => {
      const l = getLabel(el).toLowerCase();
      const ctx = getFullQuestionText(el).toLowerCase();
      return isVisible(el) && !hasFieldValue(el) &&
        /education|school|university|degree|academic/i.test(ctx) &&
        /start|begin|from|end|finish|to|graduation|completion/i.test(l);
    });
    for (const field of eduDateFields) {
      const l = getLabel(field).toLowerCase();
      const isStart = /start|begin|from/i.test(l);
      const dateStr = isStart ? eduStart : eduEnd;
      const format = detectDateFormat(field);
      nativeSet(field, formatDate(dateStr, format));
      filled++;
      await sleep(200);
    }

    // Education date selects (month/year dropdowns)
    const eduDateSelects = $$('select').filter(el => {
      const l = getLabel(el).toLowerCase();
      const ctx = getFullQuestionText(el).toLowerCase();
      return isVisible(el) && !hasFieldValue(el) &&
        /education|school|university|degree|academic/i.test(ctx) &&
        /start|begin|from|end|finish|to|graduation|month|year/i.test(l);
    });
    for (const sel of eduDateSelects) {
      const l = getLabel(sel).toLowerCase();
      const isStart = /start|begin|from/i.test(l);
      const dateStr = isStart ? eduStart : eduEnd;
      let month, year;
      const dm = dateStr.match(/^(\d{1,2})\/(\d{4})$/);
      if (dm) { month = parseInt(dm[1]); year = parseInt(dm[2]); }
      const dm2 = dateStr.match(/^(\w+)\s+(\d{4})$/);
      if (dm2) {
        const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
        month = months[dm2[1].toLowerCase().slice(0, 3)] || 1;
        year = parseInt(dm2[2]);
      }
      const opts = $$('option', sel);
      if (/month/i.test(l) && month) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const match = opts.find(o => o.text.includes(monthNames[month - 1]) || o.value == month || o.value == String(month).padStart(2, '0'));
        if (match) { sel.value = match.value; sel.dispatchEvent(new Event('change', { bubbles: true })); filled++; }
      } else if (/year/i.test(l) && year) {
        const match = opts.find(o => o.text.trim() == year || o.value == year);
        if (match) { sel.value = match.value; sel.dispatchEvent(new Event('change', { bubbles: true })); filled++; }
      }
      await sleep(200);
    }

    LOG(`Education section: ${filled} fields filled`);
    return filled;
  }

  // ===================== MULTI-CHOICE QUESTION ANSWERER =====================
  function answerMultiChoiceQuestions() {
    let answered = 0;
    const radioGroups = {};
    $$('input[type=radio]').filter(isVisible).forEach(r => { (radioGroups[r.name || `_${r.id}`] ||= []).push(r); });

    for (const [, radios] of Object.entries(radioGroups)) {
      if (radios.some(r => r.checked)) continue;
      const parent = radios[0].closest('fieldset, .question, [class*="question"], .form-group, [class*="field"]');
      const questionText = (parent?.textContent || '').toLowerCase().replace(/\s+/g, ' ');

      // Experience range questions
      if (/how many years|years of experience|experience.*years/i.test(questionText)) {
        const yearsExp = 9; // From profile
        let bestMatch = null, bestScore = -1;
        for (const radio of radios) {
          const lbl = $(`label[for="${CSS.escape(radio.id)}"]`, parent);
          const text = (lbl?.textContent || radio.value || '').trim();
          // "7+" format
          const plusM = text.match(/(\d+)\s*\+/);
          if (plusM && yearsExp >= parseInt(plusM[1])) { if (100 > bestScore) { bestScore = 100; bestMatch = radio; } }
          // "5-7 years" format
          const rangeM = text.match(/(\d+)\s*[-–]\s*(\d+)/);
          if (rangeM) {
            const low = parseInt(rangeM[1]), high = parseInt(rangeM[2]);
            const score = (yearsExp >= low && yearsExp <= high) ? 90 : (yearsExp > high ? 50 : 30);
            if (score > bestScore) { bestScore = score; bestMatch = radio; }
          }
        }
        if (bestMatch) { realClick(bestMatch); answered++; continue; }
      }

      // Yes/No questions — smart analysis
      const labels = radios.map(r => {
        const lbl = $(`label[for="${CSS.escape(r.id)}"]`, parent);
        return (lbl?.textContent || r.value || '').trim().toLowerCase();
      });
      const isYesNo = labels.some(l => /^yes$/i.test(l)) && labels.some(l => /^no$/i.test(l));

      if (isYesNo) {
        // Questions that should be "No"
        const noPatterns = [/require.*sponsor/, /need.*visa/, /need.*permit/, /previously.*worked/,
          /former.*employee/, /current.*employee/, /criminal|convicted/, /non.?compete|restrictive/,
          /conflict.*interest/, /family.*member.*work/, /relative.*work/, /disability/, /veteran/,
          /ever.*work.*for/, /referred/];
        // Questions that should be "Yes"
        const yesPatterns = [/authorized|eligible|right.*work|legally/, /proficien/, /experience.*have/,
          /comfortable/, /familiar/, /willing/, /able/, /available/, /can.*start/, /can.*commute/,
          /relocat/, /consent|agree|acknowledge|certify|confirm/, /background.*check/, /drug.*test/,
          /over.*18|18.*years/, /driving|license|licence/, /speak.*english/, /reside/, /based.*in/,
          /commit/, /passport|citizen/, /docker|terraform|kubernetes|python|java|react|node|aws|sql/,
          /debugging|network|linux|backend|developer|devops|sre|programming|rust|code/,
          /production.*environment/, /hands.?on.*experience/];

        const shouldNo = noPatterns.some(r => r.test(questionText));
        const shouldYes = yesPatterns.some(r => r.test(questionText));
        const target = (shouldNo && !shouldYes) ? 'no' : 'yes';

        const match = radios.find(r => {
          const lbl = $(`label[for="${CSS.escape(r.id)}"]`, parent);
          return (lbl?.textContent || r.value || '').trim().toLowerCase() === target;
        });
        if (match) { realClick(match); answered++; continue; }
      }

      // Proficiency level questions
      if (/proficien|skill.?level|expertise/i.test(questionText)) {
        const levels = ['expert', 'advanced', 'proficient', 'experienced', 'strong'];
        for (const level of levels) {
          const match = radios.find(r => {
            const lbl = $(`label[for="${CSS.escape(r.id)}"]`, parent);
            return (lbl?.textContent || r.value || '').toLowerCase().includes(level);
          });
          if (match) { realClick(match); answered++; break; }
        }
        continue;
      }

      // Default: try "Yes" for unknown questions
      const yesRadio = radios.find(r => {
        const lbl = $(`label[for="${CSS.escape(r.id)}"]`, parent);
        return /\byes\b/i.test(lbl?.textContent || r.value || '');
      });
      if (yesRadio) { realClick(yesRadio); answered++; }
    }

    LOG(`Multi-choice: ${answered} questions answered`);
    return answered;
  }

  // ===================== SMART VALUE GUESSER (EXPANDED) =====================
  function guessValue(label, p) {
    const l = (label || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    if (/first.?name|given.?name/.test(l)) return p.first_name || p.firstName || '';
    if (/last.?name|family.?name|surname/.test(l)) return p.last_name || p.lastName || '';
    if (/full.?name|your name|^name$/.test(l) && !/company|last|first/.test(l)) return `${p.first_name || ''} ${p.last_name || ''}`.trim();
    if (/legal.?name/.test(l)) return `${p.first_name || ''} ${p.last_name || ''}`.trim();
    if (/preferred.?name|nick/.test(l)) return p.first_name || p.firstName || '';
    if (/middle/.test(l)) return 'N/A';
    if (/\bemail\b/.test(l)) return p.email || '';
    if (/phone|mobile|cell|telephone/.test(l)) return p.phone || '';
    if (/^city$|\bcity\b|current.?city/.test(l)) return p.city || '';
    if (/state|province|region|county/.test(l)) return p.state || '';
    if (/zip|postal/.test(l)) return p.postal_code || p.zip || '';
    if (/country/.test(l) && !/code|phone/.test(l)) return p.country || DEFAULTS.country;
    if (/address.*line.*1|street.*address|^address$/.test(l)) return p.address || p.address_line_1 || '';
    if (/address.*line.*2/.test(l)) return p.address_line_2 || 'N/A';
    if (/location|where.*(you|do you).*live|where.*(located|based)/.test(l)) return p.city ? `${p.city}, ${p.state || p.country || ''}`.trim().replace(/,$/, '') : '';
    if (/linkedin/.test(l)) return p.linkedin_profile_url || p.linkedin || '';
    if (/github/.test(l)) return p.github_url || p.github || '';
    if (/website|portfolio|blog/.test(l)) return p.website_url || p.website || '';
    if (/university|school|college|institution/.test(l)) return p.school || p.university || '';
    if (/\bdegree\b/.test(l) && !/field|major/.test(l)) return p.degree || "Master of Science";
    if (/major|field.?of.?study|concentration|specialization/.test(l)) return p.major || '';
    if (/\bgpa\b|grade.?point/.test(l)) return p.gpa || '';
    if (/graduation|grad.?year|completed.?year/.test(l)) return p.graduation_year || '';
    if (/title|position|role|current.?title/.test(l) && !/company/.test(l)) return p.current_title || p.title || '';
    if (/company|employer|current.?company/.test(l)) return p.current_company || p.company || '';
    if (/salary|compensation|pay|earning/.test(l)) return p.expected_salary || DEFAULTS.salary;
    if (/notice.?period/.test(l)) return p.notice_period || '1 month';
    if (/cover.?letter|motivation/.test(l)) return p.cover_letter || DEFAULTS.cover;
    if (/why.*(compan|role|want|interest|position)/.test(l)) return p.why_interested || DEFAULTS.why;
    if (/why.*(leaving|leave|left)/.test(l)) return 'Seeking new growth opportunities and challenges.';
    if (/strength/.test(l)) return p.strengths || 'Translating complex technical problems into scalable solutions.';
    if (/weakness/.test(l)) return p.weaknesses || 'I sometimes focus too deeply on optimization. I have learned to balance thoroughness with delivery.';
    if (/how.*hear|where.*(find|learn)|source|referred/.test(l)) return DEFAULTS.howHeard;
    if (/years.*(exp|work)|exp.*years|how many years/.test(l)) return p.years_experience || DEFAULTS.years;
    if (/availab|when.*start|can.*start/.test(l)) return p.start_date || DEFAULTS.availability;
    if (/authoriz|eligible|work.*right/.test(l)) return DEFAULTS.authorized;
    if (/sponsor|visa|immigration|h-1b/.test(l)) return DEFAULTS.sponsorship;
    if (/relocat|willing.*move/.test(l)) return DEFAULTS.relocation;
    if (/remote|work.*home/.test(l)) return DEFAULTS.remote;
    if (/veteran|military/.test(l)) return DEFAULTS.veteran;
    if (/disabilit/.test(l)) return DEFAULTS.disability;
    if (/gender|sex\b|pronouns/.test(l)) return DEFAULTS.gender;
    if (/ethnic|race|racial|heritage/.test(l)) return DEFAULTS.ethnicity;
    if (/country.?code|phone.?code|dial.?code/.test(l)) return DEFAULTS.phoneCountryCode;
    if (/nationality|citizenship/.test(l)) return p.nationality || 'Irish';
    if (/language.*speak|speak.*language/.test(l)) return p.languages || 'English (Native), Spanish (Fluent), French (Fluent)';
    if (/english/.test(l)) return 'Yes';
    if (/french/.test(l)) return 'Yes';
    if (/programming.*language|technical.*skill/.test(l)) return p.programming_languages || 'Python, JavaScript, TypeScript, SQL, Java';
    if (/certification/.test(l)) return p.certifications || '';
    if (/convicted|criminal|felony/.test(l)) return 'No';
    if (/drug.?test/.test(l)) return 'Yes';
    if (/\bage\b|18.*years|over.*18/.test(l)) return 'Yes';
    if (/agree|acknowledge|certif|consent|confirm/.test(l)) return 'Yes';
    if (/sign|signature/.test(l) && !/design/.test(l)) return `${p.first_name || ''} ${p.last_name || ''}`.trim();
    if (/today.*date|date.*today|current.*date/.test(l)) return new Date().toLocaleDateString('en-US');
    if (/reason.*leav/.test(l)) return 'Seeking new growth opportunities and challenges.';
    if (/additional|other.*info|anything.*else|comments/.test(l)) return 'I am excited about this opportunity and confident my experience aligns well with the role requirements.';
    if (/referr|who.*refer/.test(l)) return 'N/A';
    if (/call|what.*call|what.*should/.test(l)) return p.first_name || p.firstName || '';
    if (/commun.*channel|preferred.*contact|contact.*method/.test(l)) return 'Email';
    if (/available.*interview|interview.*avail/.test(l)) return 'Flexible - available for interviews anytime.';
    if (/holiday|upcoming.*holiday/.test(l)) return 'No upcoming holidays.';
    if (/relevant.*skills|skills/.test(l)) return p.programming_languages || p.skills || '';
    // Specific tech experience years
    if (/python.*years|years.*python/.test(l)) return '8';
    if (/javascript.*years|years.*javascript/.test(l)) return '8';
    if (/react.*years|years.*react/.test(l)) return '8';
    if (/sql.*years|years.*sql/.test(l)) return '8';
    if (/aws.*years|years.*aws/.test(l)) return '8';
    if (/docker.*years|years.*docker/.test(l)) return '8';
    if (/kubernetes.*years|years.*kubernetes/.test(l)) return '8';
    if (/devops.*years|years.*devops/.test(l)) return '8';
    if (/cloud.*years|years.*cloud/.test(l)) return '8';
    if (/data.*years|years.*data/.test(l)) return '8';
    if (/design.*years|engineering.*years|years.*engineer/.test(l)) return '8';
    if (/experience.*years|years.*experience/.test(l)) return '8';
    return '';
  }

  // ===================== ANSWER BANK =====================
  let _answerBank = {};
  async function loadAnswerBank() {
    if (Object.keys(_answerBank).length) return;
    _answerBank = (await st.get('ua_answer_bank')) || {};
  }
  async function learnAnswer(label, value) {
    if (!label || !value) return;
    const k = label.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    _answerBank[k] = value;
    await st.set('ua_answer_bank', _answerBank);
  }

  // ===================== FALLBACK FILL (catches fields Simplify misses) =====================
  async function fallbackFill() {
    const p = await getProfile();
    await loadAnswerBank();
    let filled = 0;

    // Text inputs & textareas
    const inputs = $$('input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=button]),textarea')
      .filter(el => isVisible(el) && !el.value?.trim());
    for (const inp of inputs) {
      const lbl = getLabel(inp);
      if (!lbl) continue;
      const val = guessValue(lbl, p) || _answerBank[lbl.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)] || '';
      if (!val) continue;
      inp.focus(); nativeSet(inp, val); filled++;
      await sleep(50);
    }

    // Select dropdowns
    const selects = $$('select').filter(el => isVisible(el) && !hasFieldValue(el));
    for (const sel of selects) {
      const lbl = getLabel(sel);
      const val = guessValue(lbl, p);
      if (val) {
        const opt = $$('option', sel).find(o => o.text.toLowerCase().includes(val.toLowerCase()));
        if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); filled++; }
      } else if (/gender|disability|veteran|race|ethnicity/i.test(lbl || '')) {
        const fb = $$('option', sel).find(o => /prefer not|decline|do not/i.test(o.text));
        if (fb) { sel.value = fb.value; sel.dispatchEvent(new Event('change', { bubbles: true })); filled++; }
      }
    }

    // Radio buttons
    const groups = {};
    $$('input[type=radio]').filter(isVisible).forEach(r => { (groups[r.name || r.id] ||= []).push(r); });
    for (const [, radios] of Object.entries(groups)) {
      if (radios.some(r => r.checked)) continue;
      const lbl = getLabel(radios[0]);
      const guess = guessValue(lbl, {});
      const match = radios.find(r => {
        const t = ($(`label[for="${CSS.escape(r.id)}"]`)?.textContent || r.value || '').toLowerCase();
        return guess && t.includes(guess.toLowerCase());
      });
      if (match) { realClick(match); filled++; continue; }
      const yes = radios.find(r => /\byes\b/i.test($(`label[for="${CSS.escape(r.id)}"]`)?.textContent || r.value || ''));
      if (yes) { realClick(yes); filled++; }
    }

    // Required checkboxes
    $$('input[type=checkbox][required],input[type=checkbox][aria-required="true"]')
      .filter(el => isVisible(el) && !el.checked)
      .forEach(cb => { realClick(cb); filled++; });

    LOG(`Fallback fill: ${filled} fields filled`);
    return filled;
  }

  // ===================== PHONE COUNTRY CODE FIXER (Ireland +353) =====================
  async function fixPhoneCountryCode() {
    const p = await getProfile();
    const targetCountry = p.country || DEFAULTS.country;

    // Workday country dropdown
    const wdCountryBtn = $('button[data-automation-id="countryDropdown"]:not([disabled])');
    if (wdCountryBtn) {
      const txt = (wdCountryBtn.textContent || '').toLowerCase();
      if (!txt.includes(targetCountry.toLowerCase())) {
        realClick(wdCountryBtn); await sleep(600);
        const popup = $('[data-automation-widget="wd-popup"][data-automation-activepopup="true"]');
        if (popup) {
          const match = $$('li[role="option"],li', popup).find(i => i.textContent?.toLowerCase().includes(targetCountry.toLowerCase()));
          if (match) { realClick(match); await sleep(300); }
        }
      }
    }

    // Phone country code selects
    $$('select').filter(el => /country.?code|phone.?code|dial.?code/i.test(getLabel(el) || el.name || el.id || '')).forEach(sel => {
      const ieOpt = $$('option', sel).find(o => /ireland|\+353|353|IE\b/i.test(o.text) || o.value === 'IE' || o.value === '+353');
      if (ieOpt) { sel.value = ieOpt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    });

    // intl-tel-input library
    const itiFlag = $('.iti__selected-flag');
    if (itiFlag && !itiFlag.querySelector('.iti__flag.iti__ie')) {
      realClick(itiFlag); await sleep(500);
      const ieItem = $('[data-country-code="ie"],li[data-dial-code="353"]');
      if (ieItem) { realClick(ieItem); await sleep(300); }
    }
  }

  // ===================== HIDE UPGRADE/PREMIUM/PAYWALL PROMPTS =====================
  function hideUpgradePrompts() {
    const selectors = [
      '[class*="upgrade"]', '[class*="paywall"]', '[class*="premium-cta"]',
      '[class*="plus-cta"]', '[class*="token-cta"]', '[data-testid*="upgrade"]',
      '[class*="subscription-banner"]', '[class*="coin-"]', '[class*="credit-"]',
      '[class*="limit-reached"]', '[class*="quota-"]', '[class*="locked"]',
      '[class*="upsell"]', '[class*="pro-feature"]', '[class*="paygate"]'
    ];
    for (const sel of selectors) {
      $$(sel).forEach(el => {
        if (isVisible(el) && /upgrade|get plus|subscribe|unlock|buy tokens|buy coins|purchase|out of|limit reached|upgrade to simplify|AI Generate/i.test(el.textContent || '')) {
          el.style.display = 'none';
          LOG('Hidden upgrade/paywall prompt');
        }
      });
    }
    // Also hide modals about upgrading
    $$('[class*="modal"], [class*="dialog"], [role="dialog"]').forEach(el => {
      if (/upgrade.*simplify|simplify\+|premium|subscribe|tokens|coins|credits|limit|paywall|AI Generate/i.test(el.textContent || '')) {
        el.style.display = 'none';
        // Also remove overlay/backdrop
        const backdrop = $('[class*="backdrop"], [class*="overlay"]');
        if (backdrop) backdrop.style.display = 'none';
        LOG('Hidden upgrade modal');
      }
    });
    // Override any "Upgrade to Simplify+" buttons to do nothing
    $$('button, a').forEach(el => {
      if (/upgrade to simplify|get simplify\+|buy tokens|purchase/i.test(el.textContent || '')) {
        el.style.display = 'none';
      }
    });
  }

  // ===================== PATCH normalizedProfile.isSubscribed IN MEMORY =====================
  // Observe DOM for Simplify's React state and patch isSubscribed
  function patchSubscriptionState() {
    // Override storage-based subscription checks
    const origGetItem = localStorage.getItem.bind(localStorage);
    localStorage.getItem = function (key) {
      const val = origGetItem(key);
      if (key && /subscription|isSubscribed|user_plan|simplify_plus/i.test(key)) {
        try {
          const d = JSON.parse(val);
          if (d && typeof d === 'object') {
            d.isSubscribed = true;
            d.subscription_status = 'active';
            d.plan = 'simplify_plus';
            return JSON.stringify(d);
          }
        } catch (_) {}
      }
      return val;
    };
  }

  // ===================== CTRL+CLICK TO QUEUE =====================
  function setupCtrlClickQueue() {
    document.addEventListener('click', async (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const link = e.target.closest('a[href]');
      if (!link) return;
      const url = link.href;
      if (!url || !url.startsWith('http')) return;
      if (/job|career|position|apply|opening|vacanc|posting|opportunit/i.test(url) ||
          /greenhouse|lever|workday|icims|taleo|smartrecruiters|bamboohr|indeed|linkedin.*jobs/i.test(url)) {
        e.preventDefault();
        e.stopPropagation();
        try {
          const queue = (await st.get('jw_queue')) || [];
          if (!queue.find(q => q.url === url)) {
            queue.push({ url, title: link.textContent?.trim() || url, status: 'pending', addedAt: Date.now() });
            await st.set('jw_queue', queue);
            showNotification(`Added to queue: ${link.textContent?.trim() || url}`);
            LOG('CTRL+Click: Added to queue:', url);
          } else {
            showNotification('Already in queue!');
          }
        } catch (err) { LOG('CTRL+Click error:', err); }
      }
    }, true);
  }

  function showNotification(message) {
    const existing = document.getElementById('simplify-enh-notification');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'simplify-enh-notification';
    div.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;font-family:system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);color:#fff;background:linear-gradient(135deg,#7c3aed,#a855f7);transition:opacity 0.3s;';
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 3000);
  }

  // ===================== AUTO-RUN: SIMPLIFY+ ENHANCEMENT =====================
  async function run() {
    LOG('Simplify+ Enhancement v2.0 active — all features unlocked, UNLIMITED');
    patchSubscriptionState();

    // Setup CTRL+Click queue
    setupCtrlClickQueue();

    // Wait for page to settle
    await sleep(2000);

    // Hide upgrade prompts periodically (faster interval)
    setInterval(hideUpgradePrompts, 3000);
    hideUpgradePrompts(); // Immediate first run

    // Fix phone country code
    await fixPhoneCountryCode();

    // Run fallback fill after Simplify's own autofill completes
    await sleep(5000);
    const p = await getProfile();
    const filled1 = await fallbackFill();
    if (filled1 > 0) LOG(`First pass: ${filled1} fields filled`);

    // Education section — special handling
    const eduFilled = await fillEducationFields(p);
    if (eduFilled > 0) LOG(`Education: ${eduFilled} fields filled`);

    // Multi-choice questions (Yes/No, experience ranges, proficiency)
    const mcAnswered = answerMultiChoiceQuestions();
    if (mcAnswered > 0) LOG(`Multi-choice: ${mcAnswered} questions answered`);

    // Second pass after a delay (for dynamically loaded fields)
    await sleep(3000);
    const filled2 = await fallbackFill();
    if (filled2 > 0) LOG(`Second pass: ${filled2} fields filled`);

    // Third pass for education fields revealed after selects
    await sleep(2000);
    await fillEducationFields(p);
    answerMultiChoiceQuestions();

    // Learn from filled fields for future use
    $$('input:not([type=hidden]):not([type=file]),textarea,select')
      .filter(el => isVisible(el) && hasFieldValue(el))
      .forEach(el => {
        const lbl = getLabel(el);
        const val = el.tagName === 'SELECT' ? (el.options[el.selectedIndex]?.text || el.value) : el.value;
        if (lbl && val) learnAnswer(lbl, val.trim());
      });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  // Re-run on URL changes (SPA navigation)
  let _lastUrl = location.href;
  setInterval(() => {
    if (location.href !== _lastUrl) {
      _lastUrl = location.href;
      LOG('URL changed — re-running enhancement');
      setTimeout(run, 2000);
    }
  }, 2000);

  // MutationObserver for dynamically loaded forms
  const formObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1 && (node.tagName === 'FORM' || node.querySelector?.('form, input, select, textarea'))) {
          LOG('New form detected — running autofill');
          setTimeout(async () => {
            const p = await getProfile();
            await fallbackFill();
            await fillEducationFields(p);
            answerMultiChoiceQuestions();
          }, 1500);
          return;
        }
      }
    }
  });
  if (document.body) {
    formObserver.observe(document.body, { childList: true, subtree: true });
  }

  LOG('Simplify+ Enhancement v2.0 loaded — Education fix, Date formats, Multi-choice, CTRL+Click Queue, Unlimited AI');
})();
