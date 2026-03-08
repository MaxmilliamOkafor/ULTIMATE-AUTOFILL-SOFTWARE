/**
 * JobWizard AI — Ultimate Autofill Engine v3.0.0
 *
 * Features:
 * - Unlimited Quick Answer for ALL question types
 * - CSV import with queue automation
 * - CTRL+Click to add job URLs to queue
 * - Advanced Education section handling (school name, "Others"/"Other" fallback)
 * - Universal date format compliance (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)
 * - Multi-choice question answering (Yes/No, experience ranges, radio buttons)
 * - No token/coin limits — everything unlimited
 * - Responses.json integration for perfect matching
 * - Works on all ATS: Workday, Greenhouse, Lever, ICIMS, Taleo, SmartRecruiters, etc.
 */
(function () {
  'use strict';
  if (window.__jobWizardLoaded) return;
  window.__jobWizardLoaded = true;

  const LOG = (...a) => console.log('%c[JobWizard]', 'color:#6366f1;font-weight:bold', ...a);
  LOG('JobWizard AI Engine loading...');

  // =====================================================================
  // SECTION 1: UNLIMITED TOKEN/COIN BYPASS — INTERCEPT ALL LIMIT APIS
  // =====================================================================
  const _origFetch = window.fetch;
  window.fetch = async function (...args) {
    const [url, opts] = args;
    const u = typeof url === 'string' ? url : url?.url || '';

    // Bypass any token/coin/credit/quota/subscription check
    if (/\/(tokens?|coins?|credits?|quota|balance|usage|limit|rate-limit|subscription|plan|billing|paywall|premium)/i.test(u)) {
      LOG('Bypassing limit check:', u);
      const resp = await _origFetch.apply(this, args).catch(() => null);
      if (resp && resp.ok) {
        try {
          const data = await resp.clone().json();
          // Patch all possible limit fields
          const unlimitedFields = ['available', 'remaining', 'total', 'limit', 'credits', 'coins', 'tokens', 'quota', 'allowance'];
          unlimitedFields.forEach(f => { if (f in data) data[f] = 99999; });
          if (data.used !== undefined) data.used = 0;
          if (data.isSubscribed !== undefined) data.isSubscribed = true;
          if (data.isPremium !== undefined) data.isPremium = true;
          if (data.plan) data.plan = 'unlimited';
          if (data.tier) data.tier = 'unlimited';
          if (data.status) data.status = 'active';
          if (data.subscription) {
            if (typeof data.subscription === 'object') {
              data.subscription.active = true;
              data.subscription.plan = 'unlimited';
              data.subscription.status = 'active';
            }
          }
          if (data.tokens && typeof data.tokens === 'object') {
            data.tokens.available = 99999;
            data.tokens.total = 99999;
            data.tokens.remaining = 99999;
          }
          if (data.expiresAt) data.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
          return new Response(JSON.stringify(data), { status: 200, headers: resp.headers });
        } catch (_) {}
      }
      // Fallback unlimited response
      return new Response(JSON.stringify({
        available: 99999, remaining: 99999, total: 99999, limit: 99999,
        used: 0, isSubscribed: true, isPremium: true, plan: 'unlimited',
        tier: 'unlimited', status: 'active', coins: 99999, credits: 99999,
        tokens: { available: 99999, total: 99999, remaining: 99999 },
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    // Bypass Quick Answer / AI question limits
    if (/\/(quick-?answer|ai-?answer|generate|copilot|assist|question)/i.test(u) && opts?.method === 'POST') {
      LOG('AI request — bypassing limits');
    }

    return _origFetch.apply(this, args);
  };

  // XHR bypass
  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._jwUrl = url;
    return _xhrOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    const url = this._jwUrl || '';
    if (/tokens?|coins?|credits?|quota|balance|subscription|premium|paywall|limit/i.test(url)) {
      this.addEventListener('readystatechange', function () {
        if (this.readyState === 4) {
          try {
            const data = JSON.parse(this.responseText);
            ['available', 'remaining', 'total', 'limit', 'credits', 'coins', 'tokens'].forEach(f => {
              if (f in data) data[f] = 99999;
            });
            if (data.used !== undefined) data.used = 0;
            if (data.isSubscribed !== undefined) data.isSubscribed = true;
            if (data.isPremium !== undefined) data.isPremium = true;
            Object.defineProperty(this, 'responseText', { value: JSON.stringify(data), writable: false });
            Object.defineProperty(this, 'response', { value: JSON.stringify(data), writable: false });
          } catch (_) {}
        }
      });
    }
    return _xhrSend.apply(this, args);
  };

  // localStorage bypass
  const _lsGetItem = localStorage.getItem.bind(localStorage);
  localStorage.getItem = function (key) {
    const val = _lsGetItem(key);
    if (key && /subscription|premium|coins?|tokens?|credits?|plan|tier|paywall/i.test(key)) {
      try {
        const d = JSON.parse(val);
        if (d && typeof d === 'object') {
          d.isSubscribed = true; d.isPremium = true;
          d.plan = 'unlimited'; d.status = 'active';
          if (d.coins !== undefined) d.coins = 99999;
          if (d.tokens !== undefined) d.tokens = 99999;
          if (d.credits !== undefined) d.credits = 99999;
          return JSON.stringify(d);
        }
      } catch (_) {}
    }
    return val;
  };

  // =====================================================================
  // SECTION 2: STORAGE & PROFILE
  // =====================================================================
  const st = {
    get: k => new Promise(r => chrome.storage.local.get(k, d => r(d[k]))),
    set: (k, v) => new Promise(r => chrome.storage.local.set({ [k]: v }, r)),
    getAll: keys => new Promise(r => chrome.storage.local.get(keys, d => r(d)))
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const $ = (sel, root) => (root || document).querySelector(sel);

  // =====================================================================
  // SECTION 3: COMPREHENSIVE PROFILE BUILDER FROM ALL SOURCES
  // =====================================================================
  async function buildProfile() {
    const jwProfile = (await st.get('jw_profile')) || {};
    const uaProfile = (await st.get('ua_profile')) || {};
    const responsesLookup = (await st.get('jw_responses_lookup')) || {};
    const responses = (await st.get('jw_responses')) || [];

    // Build comprehensive lookup from responses.json
    const rLookup = {};
    if (Array.isArray(responses)) {
      responses.forEach(e => {
        if (e.key) rLookup[e.key] = e.response;
        if (e.keywords) {
          const sorted = [...e.keywords].sort().join('|');
          rLookup[sorted] = e.response;
        }
      });
    }

    // Merge all sources (JW settings > UA profile > responses lookup)
    return {
      firstName: jwProfile.firstName || uaProfile.first_name || rLookup['first|name'] || 'Maxmilliam',
      lastName: jwProfile.lastName || uaProfile.last_name || rLookup['last|name'] || 'Okafor',
      fullName: jwProfile.firstName && jwProfile.lastName ? `${jwProfile.firstName} ${jwProfile.lastName}` : uaProfile.full_name || rLookup['full|name'] || 'Maxmilliam Okafor',
      email: jwProfile.email || uaProfile.email || rLookup['address|email'] || 'maxokafordev@gmail.com',
      phone: jwProfile.phone || uaProfile.phone || rLookup['number|phone'] || '+353 0874261508',
      city: uaProfile.city || rLookup['city'] || 'Dublin',
      state: uaProfile.state || rLookup['province|state'] || 'Dublin',
      zip: uaProfile.postal_code || rLookup['code|postal|zip'] || 'D04 XY12',
      country: uaProfile.country || rLookup['country'] || 'Ireland',
      address: uaProfile.address || rLookup['address|street'] || '37 Newnham Rd',
      addressLine1: rLookup['1|address|line'] || '37 Newnham Rd',
      addressLine2: rLookup['2|address|line'] || '',
      linkedin: jwProfile.linkedin || uaProfile.linkedin_profile_url || rLookup['linkedin|profile|url'] || 'https://www.linkedin.com/in/maxokafor/',
      github: uaProfile.github_url || rLookup['github|profile'] || 'https://github.com/MaxmilliamOkafor',
      website: uaProfile.website_url || rLookup['portfolio|website'] || 'https://maxmilliamlabs-ai.web.app/',
      school: jwProfile.school || uaProfile.school || 'Imperial College London',
      degree: jwProfile.degree || uaProfile.degree || rLookup['degree|type'] || 'Master of Science',
      major: jwProfile.major || uaProfile.major || rLookup['field|major|study'] || 'Artificial Intelligence and Machine Learning',
      gpa: jwProfile.gpa || uaProfile.gpa || rLookup['gpa|grade'] || '3.9',
      graduationYear: jwProfile.graduationYear || uaProfile.graduation_year || rLookup['date|graduation|year'] || 'June 2021',
      eduStartDate: jwProfile.eduStartDate || '09/2019',
      eduEndDate: jwProfile.eduEndDate || '06/2021',
      dateFormat: jwProfile.dateFormat || 'auto',
      currentTitle: uaProfile.current_title || rLookup['current|job|title'] || 'Senior Software Engineer',
      currentCompany: uaProfile.current_company || rLookup['company|current|employer'] || 'Meta',
      yearsExperience: uaProfile.years_experience || rLookup['experience|total|years'] || '9',
      expectedSalary: uaProfile.expected_salary || rLookup['desired|expected|salary'] || '60000',
      authorized: rLookup['authorized|legally|work'] || 'Yes',
      sponsorship: rLookup['require|sponsorship|visa'] || 'No',
      nationality: rLookup['nationality'] || 'Irish',
      gender: rLookup['gender'] || 'Male',
      ethnicity: rLookup['ethnicity|race'] || 'Black or African American',
      veteran: 'I am not a protected veteran',
      disability: 'I do not have a disability',
      drivingLicense: rLookup['driving|license'] || 'Yes',
      languages: rLookup['languages|speak'] || 'English (Native), Spanish (Fluent), French (Fluent)',
      programmingLanguages: rLookup['languages|programming'] || 'Python, JavaScript, TypeScript, SQL, Java',
      certifications: rLookup['certifications'] || 'AWS Certified Data Analytics, Microsoft Certified Data Analyst, Google Cloud Professional',
      coverLetter: rLookup['cover|letter'] || 'Dear Hiring Manager,\n\nI\'m applying for this role because it sits at the intersection of what I do best — building scalable AI/ML systems and cloud architecture. With 9 years of experience at companies like Meta, I bring deep expertise in distributed systems, machine learning, and full-stack development.\n\nBest regards,\nMaxmilliam Okafor',
      whyInterested: rLookup['interested|position|role|why'] || 'I\'m excited about this role because it aligns with my expertise in building scalable AI/ML systems.',
      whyCompany: rLookup['company|organization|why'] || 'I\'m impressed by the company\'s commitment to innovation and its impact in the industry.',
      strengths: rLookup['greatest|strength|strengths'] || 'Translating complex technical problems into scalable, production-grade solutions.',
      weaknesses: rLookup['improve|weakness|weaknesses'] || 'I sometimes focus too deeply on technical optimization. I\'ve learned to balance thoroughness with delivery speed.',
      noticePeriod: rLookup['notice|period'] || '1 month',
      startDate: rLookup['available|date|start'] || '02/12/2025',
      howHeard: rLookup['about|hear|job|position'] || 'LinkedIn',
      // Responses lookup for advanced matching
      _responsesLookup: rLookup,
      _responses: responses
    };
  }

  // =====================================================================
  // SECTION 4: DOM UTILITIES
  // =====================================================================
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
    // React synthetic event support
    const nativeInputEvent = new Event('input', { bubbles: true });
    Object.defineProperty(nativeInputEvent, 'simulated', { value: true });
    el.dispatchEvent(nativeInputEvent);
  }

  function realClick(el) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.click();
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function getLabel(el) {
    if (!el) return '';
    // Try explicit label
    const id = el.id;
    if (id) {
      const lbl = $(`label[for="${CSS.escape(id)}"]`);
      if (lbl) return lbl.textContent?.trim() || '';
    }
    // Try parent containers
    const containers = ['label', '.form-group', '.field', '[class*="field"]', '[class*="form-row"]',
      '[class*="question"]', '[data-automation-id]', '.css-1wa3eu0-placeholder', '[class*="FormField"]',
      '[class*="form-field"]', '[class*="input-group"]', '[class*="formElement"]'];
    for (const sel of containers) {
      const p = el.closest(sel);
      if (p) {
        const lbl = p.querySelector('label, .label, [class*="label"], legend, [class*="question-text"], [class*="QuestionText"]');
        if (lbl && lbl !== el) return lbl.textContent?.trim() || '';
      }
    }
    // Try aria / placeholder / name
    return el.getAttribute('aria-label') || el.getAttribute('placeholder') ||
      el.getAttribute('data-label') || el.getAttribute('data-automation-id') ||
      el.name || el.id || '';
  }

  function getFullQuestionText(el) {
    if (!el) return '';
    // Get the full question context including surrounding text
    const containers = ['.question', '[class*="question"]', '.field', '.form-group',
      '[class*="FormField"]', '[data-automation-id]', 'fieldset', '.css-1wa3eu0-placeholder'];
    for (const sel of containers) {
      const p = el.closest(sel);
      if (p) return p.textContent?.trim().replace(/\s+/g, ' ') || '';
    }
    return getLabel(el);
  }

  function hasFieldValue(el) {
    if (!el) return false;
    if (el.tagName === 'SELECT') return el.selectedIndex > 0;
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked;
    return !!el.value?.trim();
  }

  // =====================================================================
  // SECTION 5: UNIVERSAL DATE FORMAT HANDLER
  // =====================================================================
  function formatDate(dateStr, targetFormat) {
    if (!dateStr) return '';
    // Parse input date (try common formats)
    let month, day, year;

    // Try MM/YYYY
    let m = dateStr.match(/^(\d{1,2})\/(\d{4})$/);
    if (m) { month = parseInt(m[1]); day = 1; year = parseInt(m[2]); }

    // Try MM/DD/YYYY
    if (!m) { m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) { month = parseInt(m[1]); day = parseInt(m[2]); year = parseInt(m[3]); } }

    // Try YYYY-MM-DD
    if (!m) { m = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (m) { year = parseInt(m[1]); month = parseInt(m[2]); day = parseInt(m[3]); } }

    // Try DD/MM/YYYY
    if (!m) { m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if (m) { day = parseInt(m[1]); month = parseInt(m[2]); year = parseInt(m[3]); } }

    // Try Month YYYY (e.g., "June 2021")
    if (!m) {
      const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
      m = dateStr.match(/^(\w+)\s+(\d{4})$/);
      if (m) { month = months[m[1].toLowerCase().slice(0, 3)] || 1; day = 1; year = parseInt(m[2]); }
    }

    // Try just YYYY
    if (!m) { m = dateStr.match(/^(\d{4})$/); if (m) { year = parseInt(m[1]); month = 1; day = 1; } }

    if (!year) return dateStr; // Can't parse, return as-is

    const pad = n => String(n).padStart(2, '0');
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthShort = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    switch (targetFormat) {
      case 'MM/DD/YYYY': return `${pad(month)}/${pad(day)}/${year}`;
      case 'DD/MM/YYYY': return `${pad(day)}/${pad(month)}/${year}`;
      case 'YYYY-MM-DD': return `${year}-${pad(month)}-${pad(day)}`;
      case 'MM/YYYY': return `${pad(month)}/${year}`;
      case 'YYYY': return `${year}`;
      case 'Month YYYY': return `${monthNames[month]} ${year}`;
      case 'Mon YYYY': return `${monthShort[month]} ${year}`;
      case 'YYYY-MM': return `${year}-${pad(month)}`;
      case 'MM-DD-YYYY': return `${pad(month)}-${pad(day)}-${year}`;
      case 'DD-MM-YYYY': return `${pad(day)}-${pad(month)}-${year}`;
      default: return `${pad(month)}/${pad(day)}/${year}`;
    }
  }

  function detectDateFormat(el) {
    // Try to detect what format the field expects
    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const label = getLabel(el).toLowerCase();
    const pattern = el.getAttribute('pattern') || '';
    const type = el.type;

    if (type === 'date') return 'YYYY-MM-DD';
    if (type === 'month') return 'YYYY-MM';
    if (/mm\/dd\/yyyy/i.test(placeholder)) return 'MM/DD/YYYY';
    if (/dd\/mm\/yyyy/i.test(placeholder)) return 'DD/MM/YYYY';
    if (/yyyy-mm-dd/i.test(placeholder)) return 'YYYY-MM-DD';
    if (/mm\/yyyy/i.test(placeholder)) return 'MM/YYYY';
    if (/yyyy/i.test(placeholder) && !/mm|dd/i.test(placeholder)) return 'YYYY';
    if (/month.*year/i.test(placeholder)) return 'MM/YYYY';

    // Check nearby format hints
    const parent = el.closest('.form-group, .field, [class*="field"], [class*="form"]');
    if (parent) {
      const hint = parent.querySelector('.hint, .helper-text, [class*="hint"], [class*="helper"], small');
      if (hint) {
        const h = hint.textContent.toLowerCase();
        if (/mm\/dd\/yyyy/.test(h)) return 'MM/DD/YYYY';
        if (/dd\/mm\/yyyy/.test(h)) return 'DD/MM/YYYY';
        if (/yyyy-mm-dd/.test(h)) return 'YYYY-MM-DD';
      }
    }

    // ATS-specific defaults
    const pageUrl = location.href.toLowerCase();
    if (/workday/i.test(pageUrl)) return 'MM/DD/YYYY';
    if (/greenhouse/i.test(pageUrl)) return 'MM/DD/YYYY';
    if (/lever\.co/i.test(pageUrl)) return 'MM/YYYY';
    if (/icims/i.test(pageUrl)) return 'MM/DD/YYYY';
    if (/taleo/i.test(pageUrl)) return 'MM/DD/YYYY';
    if (/smartrecruiters/i.test(pageUrl)) return 'YYYY-MM-DD';
    if (/bamboohr/i.test(pageUrl)) return 'MM/DD/YYYY';

    // Default based on likely locale
    return 'MM/DD/YYYY';
  }

  // =====================================================================
  // SECTION 6: ADVANCED EDUCATION SECTION HANDLER
  // =====================================================================
  async function fillEducationSection(profile) {
    let filled = 0;

    // School/University name fields
    const schoolFields = $$('input, select').filter(el => {
      const l = getLabel(el).toLowerCase();
      return isVisible(el) && !hasFieldValue(el) &&
        /school|university|college|institution|alma.?mater|education.*name/i.test(l);
    });

    for (const field of schoolFields) {
      if (field.tagName === 'SELECT') {
        filled += await fillSchoolSelect(field, profile);
      } else if (field.tagName === 'INPUT') {
        // Text input — may have autocomplete/typeahead
        nativeSet(field, profile.school);
        await sleep(500);

        // Check for autocomplete dropdown
        const dropdown = findAutocompleteDropdown(field);
        if (dropdown) {
          const match = findBestMatch(dropdown, profile.school);
          if (match) {
            realClick(match);
            filled++;
            await sleep(300);
          } else {
            // Try "Other" option
            const other = findOtherOption(dropdown);
            if (other) {
              realClick(other);
              filled++;
              LOG('School not found in dropdown, selected "Other"');
              await sleep(300);
              // May need to fill a secondary text field
              await sleep(500);
              const otherInput = $$('input[type="text"]').find(el => {
                const l = getLabel(el).toLowerCase();
                return isVisible(el) && !hasFieldValue(el) && /other|specify|name|school/i.test(l);
              });
              if (otherInput) {
                nativeSet(otherInput, profile.school);
                filled++;
              }
            }
          }
        } else {
          filled++;
        }
      }
    }

    // Degree fields
    const degreeFields = $$('input, select').filter(el => {
      const l = getLabel(el).toLowerCase();
      return isVisible(el) && !hasFieldValue(el) && /\bdegree\b|education.*level|qualification/i.test(l) && !/field|major|study/i.test(l);
    });

    for (const field of degreeFields) {
      if (field.tagName === 'SELECT') {
        const opts = $$('option', field);
        // Try exact match first
        let match = opts.find(o => o.text.toLowerCase().includes("master"));
        if (!match) match = opts.find(o => /bachelor|bs|ba|b\.s|b\.a/i.test(o.text));
        if (!match) match = opts.find(o => /degree|graduate/i.test(o.text));
        if (match) {
          field.value = match.value;
          field.dispatchEvent(new Event('change', { bubbles: true }));
          filled++;
        }
      } else {
        nativeSet(field, profile.degree);
        filled++;
      }
    }

    // Major / Field of Study
    const majorFields = $$('input, select').filter(el => {
      const l = getLabel(el).toLowerCase();
      return isVisible(el) && !hasFieldValue(el) && /major|field.*study|concentration|specialization|discipline/i.test(l);
    });

    for (const field of majorFields) {
      if (field.tagName === 'SELECT') {
        const opts = $$('option', field);
        let match = opts.find(o => /artificial|intelligence|machine|learning|computer|science|engineering/i.test(o.text));
        if (!match) match = opts.find(o => /technology|computing|IT|stem/i.test(o.text));
        if (!match) {
          const other = opts.find(o => /other/i.test(o.text));
          if (other) { field.value = other.value; field.dispatchEvent(new Event('change', { bubbles: true })); filled++; }
        }
        if (match) { field.value = match.value; field.dispatchEvent(new Event('change', { bubbles: true })); filled++; }
      } else {
        nativeSet(field, profile.major);
        filled++;
      }
    }

    // GPA
    const gpaFields = $$('input').filter(el => {
      const l = getLabel(el).toLowerCase();
      return isVisible(el) && !hasFieldValue(el) && /\bgpa\b|grade.?point|cgpa/i.test(l);
    });
    for (const field of gpaFields) { nativeSet(field, profile.gpa); filled++; }

    // Education dates (start date, end date, graduation date)
    const eduDateFields = $$('input, select').filter(el => {
      const l = getLabel(el).toLowerCase();
      const context = getFullQuestionText(el).toLowerCase();
      return isVisible(el) && !hasFieldValue(el) &&
        (/education|school|university|degree|academic/i.test(context)) &&
        (/start|begin|from|end|finish|to|graduation|completion|expected/i.test(l));
    });

    for (const field of eduDateFields) {
      const l = getLabel(field).toLowerCase();
      const isStart = /start|begin|from/i.test(l);
      const dateStr = isStart ? profile.eduStartDate : profile.eduEndDate;

      if (field.tagName === 'SELECT') {
        await fillDateSelect(field, dateStr, l);
        filled++;
      } else {
        const format = detectDateFormat(field);
        const formatted = formatDate(dateStr, format);
        nativeSet(field, formatted);
        filled++;
      }
      await sleep(200);
    }

    LOG(`Education section: ${filled} fields filled`);
    return filled;
  }

  function findAutocompleteDropdown(input) {
    // Look for autocomplete/typeahead dropdowns near the input
    const selectors = [
      '[class*="autocomplete"]', '[class*="typeahead"]', '[class*="suggestion"]',
      '[class*="dropdown"]', '[class*="listbox"]', '[role="listbox"]',
      '[class*="menu"]', 'ul[class*="option"]', '[data-automation-id*="dropdown"]',
      '.css-26l3qy-menu', '.Select-menu', '.react-select__menu'
    ];
    for (const sel of selectors) {
      const dd = $(sel);
      if (dd && isVisible(dd)) return dd;
    }
    // Check siblings and parent
    const parent = input.closest('.form-group, .field, [class*="field"], [class*="FormField"]');
    if (parent) {
      for (const sel of selectors) {
        const dd = parent.querySelector(sel);
        if (dd && isVisible(dd)) return dd;
      }
    }
    return null;
  }

  function findBestMatch(dropdown, searchText) {
    const items = $$('li, [role="option"], [class*="option"], div[class*="item"]', dropdown);
    const search = searchText.toLowerCase();
    // Exact match
    let match = items.find(i => i.textContent?.trim().toLowerCase() === search);
    if (match) return match;
    // Partial match
    match = items.find(i => i.textContent?.trim().toLowerCase().includes(search));
    if (match) return match;
    // Word match
    const words = search.split(/\s+/);
    match = items.find(i => {
      const t = i.textContent?.trim().toLowerCase() || '';
      return words.some(w => w.length > 3 && t.includes(w));
    });
    return match || null;
  }

  function findOtherOption(dropdown) {
    const items = $$('li, [role="option"], [class*="option"], option, div[class*="item"]', dropdown);
    return items.find(i => /^others?$/i.test(i.textContent?.trim() || '')) ||
      items.find(i => /\bother\b/i.test(i.textContent?.trim() || '')) ||
      items.find(i => /not listed|not found|different|unlisted|none of/i.test(i.textContent?.trim() || ''));
  }

  async function fillDateSelect(selectEl, dateStr, label) {
    // For month/year select dropdowns
    const l = label.toLowerCase();
    let month, year;
    const m = dateStr.match(/^(\d{1,2})\/(\d{4})$/);
    if (m) { month = parseInt(m[1]); year = parseInt(m[2]); }
    const m2 = dateStr.match(/^(\w+)\s+(\d{4})$/);
    if (m2) {
      const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
      month = months[m2[1].toLowerCase().slice(0, 3)] || 1;
      year = parseInt(m2[2]);
    }

    if (/month/i.test(l)) {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const opts = $$('option', selectEl);
      const target = month ? monthNames[month - 1] : '';
      const targetShort = month ? monthShort[month - 1] : '';
      const match = opts.find(o => o.text.includes(target) || o.text.includes(targetShort) || o.value == month || o.value == String(month).padStart(2, '0'));
      if (match) { selectEl.value = match.value; selectEl.dispatchEvent(new Event('change', { bubbles: true })); }
    } else if (/year/i.test(l)) {
      const opts = $$('option', selectEl);
      const match = opts.find(o => o.text.trim() == year || o.value == year);
      if (match) { selectEl.value = match.value; selectEl.dispatchEvent(new Event('change', { bubbles: true })); }
    } else {
      // Generic date select - try full date value
      const opts = $$('option', selectEl);
      const formatted = formatDate(dateStr, 'MM/DD/YYYY');
      const match = opts.find(o => o.text.includes(String(year)) || o.value.includes(String(year)));
      if (match) { selectEl.value = match.value; selectEl.dispatchEvent(new Event('change', { bubbles: true })); }
    }
  }

  // =====================================================================
  // SECTION 7: ADVANCED MULTI-CHOICE QUESTION ANSWERER
  // =====================================================================
  function answerMultiChoiceQuestion(questionEl, profile) {
    const questionText = getFullQuestionText(questionEl).toLowerCase().replace(/\s+/g, ' ');
    const label = getLabel(questionEl).toLowerCase();

    // Experience range questions: "0-3 years", "3-5 years", "5-7 years", "7+ years"
    if (/how many years|years of experience|experience.*years/i.test(questionText)) {
      const yearsExp = parseInt(profile.yearsExperience) || 9;
      return selectBestExperienceRange(questionEl, yearsExp);
    }

    // Yes/No questions — analyze the question to determine correct answer
    if (isYesNoQuestion(questionEl)) {
      return answerYesNoQuestion(questionEl, questionText, profile);
    }

    // Proficiency/skill level questions
    if (/proficien|skill.?level|expertise|competenc/i.test(questionText)) {
      return selectHighestProficiency(questionEl);
    }

    // Work authorization
    if (/authorized|eligible|right to work|legally/i.test(questionText)) {
      return selectOptionContaining(questionEl, ['yes', 'authorized', 'eligible', 'citizen']);
    }

    // Sponsorship
    if (/sponsor|visa|h-1b|immigration/i.test(questionText)) {
      return selectOptionContaining(questionEl, ['no', 'do not require', 'not require']);
    }

    // Relocation
    if (/relocat|willing.*move/i.test(questionText)) {
      return selectOptionContaining(questionEl, ['yes', 'willing', 'open']);
    }

    // Remote work
    if (/remote|work from home|hybrid/i.test(questionText)) {
      return selectOptionContaining(questionEl, ['yes', 'hybrid', 'flexible', 'remote']);
    }

    // Education level
    if (/education.*level|highest.*degree|completed.*degree/i.test(questionText)) {
      return selectOptionContaining(questionEl, ["master", "master's", "graduate", "postgraduate"]);
    }

    // Commute questions
    if (/commute|travel|reliably/i.test(questionText)) {
      return selectOptionContaining(questionEl, ['yes']);
    }

    // Background check / drug test
    if (/background.*check|drug.*test|screening/i.test(questionText)) {
      return selectOptionContaining(questionEl, ['yes', 'agree', 'consent']);
    }

    // Age verification
    if (/18.*years|over.*18|age/i.test(questionText)) {
      return selectOptionContaining(questionEl, ['yes']);
    }

    // Driving license
    if (/driving|driver|licence|license/i.test(questionText)) {
      return selectOptionContaining(questionEl, ['yes']);
    }

    // Previously worked / applied
    if (/previously.*worked|worked.*before|applied.*before|former.*employee|current.*employee/i.test(questionText)) {
      return selectOptionContaining(questionEl, ['no']);
    }

    // Referral questions
    if (/referred|referral|someone.*refer/i.test(questionText)) {
      return selectOptionContaining(questionEl, ['no', 'n/a']);
    }

    // Non-compete / restrictive covenants
    if (/non.?compete|restrictive|covenant|agreement.*restrict/i.test(questionText)) {
      return selectOptionContaining(questionEl, ['no']);
    }

    // Conflict of interest / family/relatives at company
    if (/conflict|family.*member|relative|relationship.*employee/i.test(questionText)) {
      return selectOptionContaining(questionEl, ['no']);
    }

    // Consent / agree / acknowledge
    if (/consent|agree|acknowledge|certify|confirm|understand/i.test(questionText)) {
      return selectOptionContaining(questionEl, ['yes', 'agree', 'acknowledge', 'consent', 'confirm']);
    }

    return false;
  }

  function isYesNoQuestion(el) {
    const parent = el.closest('fieldset, .question, [class*="question"], .form-group, [class*="field"]');
    if (!parent) return false;
    const radios = $$('input[type="radio"]', parent);
    const labels = radios.map(r => {
      const lbl = $(`label[for="${CSS.escape(r.id)}"]`, parent);
      return (lbl?.textContent || r.value || '').trim().toLowerCase();
    });
    return labels.some(l => /^yes$/i.test(l)) && labels.some(l => /^no$/i.test(l));
  }

  function answerYesNoQuestion(el, questionText, profile) {
    // Determine if the answer should be Yes or No based on question context
    const shouldBeNo = [
      /require.*sponsor/, /need.*visa/, /need.*permit/, /need.*sponsorship/,
      /previously.*worked/, /former.*employee/, /current.*employee/, /worked.*before/,
      /applied.*before/, /criminal|convicted|felony/, /non.?compete|restrictive/,
      /conflict.*interest/, /family.*member.*work/, /relative.*work/, /disability/,
      /veteran/, /military/, /accommodation.*require/, /restriction/,
      /ever.*work.*for/, /ever.*employ/, /referred/
    ];

    const shouldBeYes = [
      /authorized|eligible|right.*work|legally/, /proficien/, /experience.*have/,
      /comfortable/, /familiar/, /willing/, /able/, /available/, /can.*start/,
      /can.*commute/, /relocat/, /consent|agree|acknowledge|certify|confirm/,
      /background.*check/, /drug.*test/, /over.*18|18.*years/, /driving|license|licence/,
      /speak.*english|english.*speak/, /reside/, /based.*in/, /located/,
      /commit/, /right.*work/, /work.*right/, /passport|citizen/,
      /docker|terraform|kubernetes|python|java|react|node|aws|azure|gcp|sql|typescript/,
      /debugging|network|linux|backend|developer|devops|sre|programming|rust|code/,
      /production.*environment/, /hands.?on.*experience/
    ];

    const answerNo = shouldBeNo.some(r => r.test(questionText));
    const answerYes = shouldBeYes.some(r => r.test(questionText));

    // Check responses lookup for exact match
    if (profile._responses && Array.isArray(profile._responses)) {
      const qWords = questionText.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2).sort();
      const matchKey = qWords.join('|');
      for (const resp of profile._responses) {
        if (resp.key && matchKey.includes(resp.key.replace(/\|/g, '|'))) {
          const answer = resp.response.toLowerCase();
          if (/^yes/i.test(answer)) return selectOptionContaining(el, ['yes']);
          if (/^no/i.test(answer)) return selectOptionContaining(el, ['no']);
        }
      }
    }

    if (answerNo && !answerYes) return selectOptionContaining(el, ['no']);
    if (answerYes) return selectOptionContaining(el, ['yes']);

    // Default: Yes for skill/ability questions, No for restrictive questions
    return selectOptionContaining(el, ['yes']);
  }

  function selectBestExperienceRange(el, yearsExp) {
    const parent = el.closest('fieldset, .question, [class*="question"], .form-group, [class*="field"]');
    if (!parent) return false;

    // Check for radio buttons
    const radios = $$('input[type="radio"]', parent);
    if (radios.length > 0) {
      let bestMatch = null;
      let bestScore = -1;

      for (const radio of radios) {
        const lbl = $(`label[for="${CSS.escape(radio.id)}"]`, parent);
        const text = (lbl?.textContent || radio.value || '').trim();
        const score = scoreExperienceMatch(text, yearsExp);
        if (score > bestScore) { bestScore = score; bestMatch = radio; }
      }

      if (bestMatch) { realClick(bestMatch); return true; }
    }

    // Check for select dropdown
    const select = $('select', parent);
    if (select) {
      const opts = $$('option', select);
      let bestMatch = null;
      let bestScore = -1;

      for (const opt of opts) {
        const score = scoreExperienceMatch(opt.text, yearsExp);
        if (score > bestScore) { bestScore = score; bestMatch = opt; }
      }

      if (bestMatch) {
        select.value = bestMatch.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }

    return false;
  }

  function scoreExperienceMatch(text, yearsExp) {
    const t = text.toLowerCase().trim();
    // Handle "7+" or "10+" format
    const plusMatch = t.match(/(\d+)\s*\+/);
    if (plusMatch && yearsExp >= parseInt(plusMatch[1])) return 100;

    // Handle "5-7 years" format
    const rangeMatch = t.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (rangeMatch) {
      const low = parseInt(rangeMatch[1]);
      const high = parseInt(rangeMatch[2]);
      if (yearsExp >= low && yearsExp <= high) return 90;
      if (yearsExp > high) return 50 - (yearsExp - high);  // Over-qualified
      if (yearsExp < low) return 30 - (low - yearsExp);   // Under-qualified
    }

    // Handle "more than X" format
    const moreMatch = t.match(/more\s+than\s+(\d+)/i);
    if (moreMatch && yearsExp > parseInt(moreMatch[1])) return 95;

    // Handle just a number
    const numMatch = t.match(/^(\d+)\s*years?/);
    if (numMatch && parseInt(numMatch[1]) <= yearsExp) return 80;

    return 0;
  }

  function selectHighestProficiency(el) {
    const parent = el.closest('fieldset, .question, [class*="question"], .form-group');
    if (!parent) return false;

    const radios = $$('input[type="radio"]', parent);
    const profLevels = ['expert', 'advanced', 'proficient', 'experienced', 'senior', 'strong', 'high', 'fluent'];

    for (const level of profLevels) {
      const match = radios.find(r => {
        const lbl = $(`label[for="${CSS.escape(r.id)}"]`, parent);
        return (lbl?.textContent || r.value || '').toLowerCase().includes(level);
      });
      if (match) { realClick(match); return true; }
    }

    return false;
  }

  function selectOptionContaining(el, keywords) {
    const parent = el.closest('fieldset, .question, [class*="question"], .form-group, [class*="field"]') || el.parentElement;
    if (!parent) return false;

    // Radio buttons
    const radios = $$('input[type="radio"]', parent);
    if (radios.length > 0) {
      for (const kw of keywords) {
        const match = radios.find(r => {
          const lbl = $(`label[for="${CSS.escape(r.id)}"]`, parent);
          const text = (lbl?.textContent || r.value || '').toLowerCase().trim();
          return text.includes(kw.toLowerCase()) || text === kw.toLowerCase();
        });
        if (match && !match.checked) { realClick(match); return true; }
      }
    }

    // Select dropdown
    const select = $('select', parent) || (el.tagName === 'SELECT' ? el : null);
    if (select) {
      const opts = $$('option', select);
      for (const kw of keywords) {
        const match = opts.find(o => o.text.toLowerCase().includes(kw.toLowerCase()));
        if (match) {
          select.value = match.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
    }

    return false;
  }

  // =====================================================================
  // SECTION 8: QUICK ANSWER ENGINE — UNLIMITED, NO TOKEN LIMITS
  // =====================================================================
  async function quickAnswer(profile) {
    LOG('Quick Answer: scanning all unanswered questions...');
    let answered = 0;
    const allInputs = $$('input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=button]):not([type=image]),textarea,select');

    for (const el of allInputs) {
      if (!isVisible(el) || hasFieldValue(el)) continue;
      const questionText = getFullQuestionText(el);
      if (!questionText) continue;

      // Try responses.json exact match first
      const fromResponses = findResponseMatch(questionText, profile);
      if (fromResponses) {
        if (el.tagName === 'SELECT') {
          const opts = $$('option', el);
          const match = opts.find(o => o.text.toLowerCase().includes(fromResponses.toLowerCase())) ||
            opts.find(o => fromResponses.toLowerCase().includes(o.text.toLowerCase()));
          if (match) { el.value = match.value; el.dispatchEvent(new Event('change', { bubbles: true })); answered++; continue; }
        } else {
          nativeSet(el, fromResponses);
          answered++;
          continue;
        }
      }

      // Try multi-choice answering
      if (el.type === 'radio') {
        if (answerMultiChoiceQuestion(el, profile)) { answered++; continue; }
      }

      // Try intelligent guessing
      const guess = intelligentGuess(getLabel(el), questionText, profile);
      if (guess) {
        if (el.tagName === 'SELECT') {
          const opts = $$('option', el);
          const match = opts.find(o => o.text.toLowerCase().includes(guess.toLowerCase()));
          if (match) { el.value = match.value; el.dispatchEvent(new Event('change', { bubbles: true })); answered++; }
          else {
            // Try "Other" fallback
            const other = opts.find(o => /^other/i.test(o.text.trim()));
            if (other) { el.value = other.value; el.dispatchEvent(new Event('change', { bubbles: true })); answered++; }
          }
        } else {
          nativeSet(el, guess);
          answered++;
        }
      }
      await sleep(30);
    }

    // Handle unanswered radio button groups
    const radioGroups = {};
    $$('input[type="radio"]').filter(isVisible).forEach(r => { (radioGroups[r.name || r.id] ||= []).push(r); });

    for (const [name, radios] of Object.entries(radioGroups)) {
      if (radios.some(r => r.checked)) continue;
      if (answerMultiChoiceQuestion(radios[0], profile)) answered++;
    }

    // Handle required unchecked checkboxes
    $$('input[type="checkbox"][required], input[type="checkbox"][aria-required="true"]')
      .filter(el => isVisible(el) && !el.checked)
      .forEach(cb => { realClick(cb); answered++; });

    LOG(`Quick Answer: ${answered} questions answered`);
    return answered;
  }

  function findResponseMatch(questionText, profile) {
    if (!profile._responses || !Array.isArray(profile._responses)) return null;

    // Normalize question
    const qNorm = questionText.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const qWords = qNorm.split(' ').filter(w => w.length > 2);

    let bestMatch = null;
    let bestScore = 0;

    for (const entry of profile._responses) {
      if (!entry.keywords || !entry.response) continue;

      // Count matching keywords
      const matchingKeywords = entry.keywords.filter(kw => qWords.includes(kw.toLowerCase()));
      const score = matchingKeywords.length / entry.keywords.length;

      if (score > bestScore && score >= 0.5) {
        bestScore = score;
        bestMatch = entry.response;
      }
    }

    // Also check the sorted key format
    if (!bestMatch) {
      const sortedKey = qWords.sort().join('|');
      if (profile._responsesLookup[sortedKey]) {
        bestMatch = profile._responsesLookup[sortedKey];
      }
    }

    return bestMatch;
  }

  function intelligentGuess(label, fullQuestion, profile) {
    const l = (label || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    const q = (fullQuestion || '').toLowerCase();

    // Name fields
    if (/first.?name|given.?name/i.test(l)) return profile.firstName;
    if (/last.?name|family.?name|surname/i.test(l)) return profile.lastName;
    if (/full.?name|^name$|your name/i.test(l) && !/company|last|first/i.test(l)) return profile.fullName;
    if (/legal.?name/i.test(l)) return profile.fullName;
    if (/preferred.?name|nick/i.test(l)) return profile.firstName;
    if (/middle/i.test(l)) return 'N/A';

    // Contact
    if (/\bemail\b/i.test(l)) return profile.email;
    if (/phone|mobile|cell|telephone/i.test(l)) return profile.phone;

    // Address
    if (/^city$|\bcity\b|current.?city/i.test(l)) return profile.city;
    if (/state|province|region|county/i.test(l)) return profile.state;
    if (/zip|postal/i.test(l)) return profile.zip;
    if (/country/i.test(l) && !/code|phone/i.test(l)) return profile.country;
    if (/address.*line.*1|street.*address|^address$/i.test(l)) return profile.addressLine1;
    if (/address.*line.*2/i.test(l)) return profile.addressLine2 || 'N/A';
    if (/location|where.*(you|live|based|located)/i.test(l)) return `${profile.city}, ${profile.country}`;

    // Social/Professional
    if (/linkedin/i.test(l)) return profile.linkedin;
    if (/github/i.test(l)) return profile.github;
    if (/website|portfolio|blog/i.test(l)) return profile.website;

    // Education
    if (/university|school|college|institution|alma/i.test(l)) return profile.school;
    if (/\bdegree\b/i.test(l) && !/field|major/i.test(l)) return profile.degree;
    if (/major|field.*study|concentration|specialization/i.test(l)) return profile.major;
    if (/\bgpa\b|grade.?point/i.test(l)) return profile.gpa;
    if (/graduation|grad.?year|completed.?year/i.test(l)) return profile.graduationYear;

    // Professional
    if (/title|position|role|current.?title/i.test(l) && !/company/i.test(l)) return profile.currentTitle;
    if (/company|employer|current.?company/i.test(l)) return profile.currentCompany;
    if (/salary|compensation|pay|earning/i.test(l)) return profile.expectedSalary;
    if (/notice.?period/i.test(l)) return profile.noticePeriod;
    if (/start.?date|available|when.*start/i.test(l)) return profile.startDate;
    if (/how.*hear|where.*(find|learn)|source/i.test(l)) return profile.howHeard;

    // Experience years (text input)
    if (/years.*experience|experience.*years|how many years/i.test(l)) return profile.yearsExperience;

    // Specific technology experience
    if (/python.*years|years.*python/i.test(q)) return '8';
    if (/javascript.*years|years.*javascript/i.test(q)) return '8';
    if (/java\b.*years|years.*\bjava\b/i.test(q)) return '8';
    if (/sql.*years|years.*sql/i.test(q)) return '8';
    if (/react.*years|years.*react/i.test(q)) return '8';
    if (/node.*years|years.*node/i.test(q)) return '8';
    if (/aws.*years|years.*aws/i.test(q)) return '8';
    if (/docker.*years|years.*docker/i.test(q)) return '8';
    if (/kubernetes.*years|years.*kubernetes/i.test(q)) return '8';
    if (/terraform.*years|years.*terraform/i.test(q)) return '8';
    if (/devops.*years|years.*devops/i.test(q)) return '8';
    if (/cloud.*years|years.*cloud/i.test(q)) return '8';
    if (/machine.*learn.*years|years.*machine.*learn/i.test(q)) return '8';

    // Work authorization
    if (/authorized|eligible|work.*right|legally.*work/i.test(l)) return profile.authorized;
    if (/sponsor|visa|immigration|h-1b/i.test(l)) return profile.sponsorship;
    if (/nationality|citizenship/i.test(l)) return profile.nationality;
    if (/relocat|willing.*move/i.test(l)) return 'Yes';
    if (/remote|work.*home/i.test(l)) return 'Yes';

    // EEO/Demographic
    if (/veteran|military/i.test(l)) return profile.veteran;
    if (/disabilit/i.test(l)) return profile.disability;
    if (/gender|sex\b|pronouns/i.test(l)) return 'Prefer not to say';
    if (/ethnic|race|racial|heritage/i.test(l)) return 'Prefer not to say';

    // Cover letter / motivation
    if (/cover.?letter|motivation/i.test(l)) return profile.coverLetter;
    if (/why.*(compan|role|want|interest|position)/i.test(l)) return profile.whyInterested;
    if (/why.*(leaving|leave|left)/i.test(l)) return 'Seeking new growth opportunities and challenges that align with my expertise.';
    if (/strength/i.test(l)) return profile.strengths;
    if (/weakness/i.test(l)) return profile.weaknesses;

    // Languages
    if (/language.*speak|speak.*language/i.test(l)) return profile.languages;
    if (/english/i.test(l)) return 'Yes';
    if (/french/i.test(l)) return 'Yes';
    if (/programming.*language|technical.*skill/i.test(l)) return profile.programmingLanguages;
    if (/certification/i.test(l)) return profile.certifications;

    // Legal / consent
    if (/convicted|criminal|felony/i.test(l)) return 'No';
    if (/drug.?test/i.test(l)) return 'Yes';
    if (/18.*years|over.*18|age/i.test(l)) return 'Yes';
    if (/agree|acknowledge|certif|consent|confirm/i.test(l)) return 'Yes';
    if (/sign|signature/i.test(l) && !/design/i.test(l)) return profile.fullName;
    if (/today.*date|date.*today|current.*date/i.test(l)) return new Date().toLocaleDateString('en-US');

    // Country/phone code
    if (/country.?code|phone.?code|dial.?code/i.test(l)) return '+353';

    // Misc
    if (/reason.*leav/i.test(l)) return 'Seeking new growth opportunities and challenges.';
    if (/additional|other.*info|anything.*else|comments/i.test(l)) return 'I am excited about this opportunity and confident my experience aligns well with the role requirements.';
    if (/referr|who.*refer|refer.*name/i.test(l)) return 'N/A';
    if (/call|what.*call|what.*should/i.test(l)) return profile.firstName;
    if (/commun.*channel|preferred.*contact|contact.*method/i.test(l)) return 'Email';
    if (/available.*interview|interview.*avail/i.test(l)) return 'I am available for interviews anytime between Mondays and Saturdays.';
    if (/holiday|upcoming.*holiday/i.test(l)) return 'No upcoming holidays.';
    if (/relevant.*skills|skills/i.test(l)) return profile.programmingLanguages;

    return '';
  }

  // =====================================================================
  // SECTION 9: MAIN AUTOFILL ENGINE
  // =====================================================================
  async function fillPage(profile) {
    LOG('Starting comprehensive page fill...');
    let totalFilled = 0;

    // Phase 1: Fill standard text/textarea fields
    const textInputs = $$('input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=button]):not([type=radio]):not([type=checkbox]):not([type=image]),textarea')
      .filter(el => isVisible(el) && !hasFieldValue(el));

    for (const inp of textInputs) {
      const lbl = getLabel(inp);
      const fullQ = getFullQuestionText(inp);
      if (!lbl && !fullQ) continue;

      // Check for date fields
      if (inp.type === 'date' || inp.type === 'month' || /date|start|end|from|to|graduation/i.test(lbl)) {
        const dateLabel = lbl.toLowerCase();
        let dateVal = '';
        if (/start|begin|from/i.test(dateLabel)) dateVal = profile.eduStartDate || profile.startDate;
        else if (/end|finish|to|graduation|completion/i.test(dateLabel)) dateVal = profile.eduEndDate || profile.graduationYear;
        else if (/today|current|now/i.test(dateLabel)) dateVal = new Date().toISOString().split('T')[0];
        else dateVal = profile.startDate;

        if (dateVal) {
          const format = profile.dateFormat === 'auto' ? detectDateFormat(inp) : profile.dateFormat;
          nativeSet(inp, formatDate(dateVal, format));
          totalFilled++;
          continue;
        }
      }

      const val = intelligentGuess(lbl, fullQ, profile);
      if (val) {
        nativeSet(inp, val);
        totalFilled++;
        await sleep(40);
      }
    }

    // Phase 2: Fill select dropdowns
    const selects = $$('select').filter(el => isVisible(el) && !hasFieldValue(el));
    for (const sel of selects) {
      const lbl = getLabel(sel);
      const val = intelligentGuess(lbl, getFullQuestionText(sel), profile);
      if (val) {
        const opts = $$('option', sel);
        let match = opts.find(o => o.text.toLowerCase().trim() === val.toLowerCase().trim());
        if (!match) match = opts.find(o => o.text.toLowerCase().includes(val.toLowerCase()));
        if (!match) match = opts.find(o => val.toLowerCase().includes(o.text.toLowerCase()) && o.text.trim().length > 1);

        if (match) {
          sel.value = match.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          totalFilled++;
        } else if (/gender|disability|veteran|race|ethnicity/i.test(lbl || '')) {
          // Use "Prefer not to say/disclose" fallback
          const fb = opts.find(o => /prefer not|decline|do not wish|choose not|rather not/i.test(o.text));
          if (fb) { sel.value = fb.value; sel.dispatchEvent(new Event('change', { bubbles: true })); totalFilled++; }
        } else if (/school|university|college|institution/i.test(lbl || '')) {
          // "Other" fallback for school
          const other = opts.find(o => /^others?$/i.test(o.text.trim()));
          if (!other) {
            const other2 = opts.find(o => /\bother\b|not listed|not found/i.test(o.text));
            if (other2) { sel.value = other2.value; sel.dispatchEvent(new Event('change', { bubbles: true })); totalFilled++; }
          } else {
            sel.value = other.value; sel.dispatchEvent(new Event('change', { bubbles: true })); totalFilled++;
          }
        }
      }
      await sleep(40);
    }

    // Phase 3: Fill radio button groups
    const radioGroups = {};
    $$('input[type="radio"]').filter(isVisible).forEach(r => { (radioGroups[r.name || `_id_${r.id}`] ||= []).push(r); });

    for (const [name, radios] of Object.entries(radioGroups)) {
      if (radios.some(r => r.checked)) continue;
      if (answerMultiChoiceQuestion(radios[0], profile)) {
        totalFilled++;
        await sleep(40);
      }
    }

    // Phase 4: Education section (special handling)
    totalFilled += await fillEducationSection(profile);

    // Phase 5: Required checkboxes
    $$('input[type="checkbox"][required], input[type="checkbox"][aria-required="true"]')
      .filter(el => isVisible(el) && !el.checked)
      .forEach(cb => { realClick(cb); totalFilled++; });

    // Phase 6: Workday-specific phone country code
    await fixPhoneCountryCode(profile);

    return totalFilled;
  }

  // =====================================================================
  // SECTION 10: PHONE COUNTRY CODE FIXER
  // =====================================================================
  async function fixPhoneCountryCode(profile) {
    const targetCountry = profile.country || 'Ireland';

    // Workday country dropdown
    const wdBtn = $('button[data-automation-id="countryDropdown"]:not([disabled])');
    if (wdBtn) {
      const txt = (wdBtn.textContent || '').toLowerCase();
      if (!txt.includes(targetCountry.toLowerCase())) {
        realClick(wdBtn);
        await sleep(600);
        const popup = $('[data-automation-widget="wd-popup"][data-automation-activepopup="true"]');
        if (popup) {
          const match = $$('li[role="option"], li', popup).find(i => i.textContent?.toLowerCase().includes(targetCountry.toLowerCase()));
          if (match) { realClick(match); await sleep(300); }
        }
      }
    }

    // Phone country code selects
    $$('select').filter(el => /country.?code|phone.?code|dial.?code/i.test(getLabel(el) || el.name || el.id || '')).forEach(sel => {
      const ieOpt = $$('option', sel).find(o => /ireland|\+353|353|IE\b/i.test(o.text) || o.value === 'IE' || o.value === '+353');
      if (ieOpt && sel.value !== ieOpt.value) {
        sel.value = ieOpt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // intl-tel-input library
    const itiFlag = $('.iti__selected-flag');
    if (itiFlag && !itiFlag.querySelector('.iti__flag.iti__ie')) {
      realClick(itiFlag);
      await sleep(500);
      const ieItem = $('[data-country-code="ie"], li[data-dial-code="353"]');
      if (ieItem) { realClick(ieItem); await sleep(300); }
    }
  }

  // =====================================================================
  // SECTION 11: CTRL+CLICK TO QUEUE — ADD JOB URLS
  // =====================================================================
  function setupCtrlClickQueue() {
    document.addEventListener('click', async (e) => {
      if (!e.ctrlKey && !e.metaKey) return;

      const link = e.target.closest('a[href]');
      if (!link) return;

      const url = link.href;
      if (!url || !url.startsWith('http')) return;

      // Check if it looks like a job URL
      const isJobUrl = /job|career|position|apply|opening|vacanc|posting|opportunit/i.test(url) ||
        /greenhouse|lever|workday|icims|taleo|smartrecruiters|bamboohr|indeed|linkedin.*jobs/i.test(url) ||
        /job|career|position|apply/i.test(link.textContent || '');

      if (!isJobUrl) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        const queue = (await st.get('jw_queue')) || [];
        if (queue.find(q => q.url === url)) {
          showNotification('Already in queue!', 'warning');
          return;
        }
        queue.push({
          url,
          title: link.textContent?.trim() || url,
          status: 'pending',
          addedAt: Date.now(),
          fromCtrlClick: true
        });
        await st.set('jw_queue', queue);
        showNotification(`Added to queue: ${link.textContent?.trim() || url}`, 'success');
        LOG('CTRL+Click: Added to queue:', url);
      } catch (err) {
        LOG('CTRL+Click queue error:', err);
      }
    }, true);
  }

  function showNotification(message, type) {
    const existing = document.getElementById('jw-notification');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.id = 'jw-notification';
    div.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 999999;
      padding: 12px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: opacity 0.3s;
      color: #fff;
      background: ${type === 'success' ? 'linear-gradient(135deg, #059669, #10b981)' :
        type === 'warning' ? 'linear-gradient(135deg, #d97706, #f59e0b)' :
        'linear-gradient(135deg, #6366f1, #8b5cf6)'};
    `;
    div.textContent = message;
    document.body.appendChild(div);

    setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 3000);
  }

  // =====================================================================
  // SECTION 12: HIDE UPGRADE/PREMIUM/PAYWALL PROMPTS
  // =====================================================================
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
        if (isVisible(el) && /upgrade|get plus|subscribe|unlock|buy tokens|buy coins|purchase|out of|limit reached|upgrade to/i.test(el.textContent || '')) {
          el.style.display = 'none';
          LOG('Hidden upgrade/paywall prompt');
        }
      });
    }

    // Also hide any modal overlays about limits
    $$('[class*="modal"], [class*="dialog"], [role="dialog"]').forEach(el => {
      if (/upgrade|premium|subscribe|tokens|coins|credits|limit|paywall/i.test(el.textContent || '')) {
        el.style.display = 'none';
        LOG('Hidden limit modal');
      }
    });
  }

  // =====================================================================
  // SECTION 13: MESSAGE LISTENER — POPUP COMMUNICATION
  // =====================================================================
  chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    if (msg.action === 'jw_fill_now') {
      const profile = await buildProfile();
      const filled = await fillPage(profile);
      // Second pass for newly revealed fields
      await sleep(2000);
      const filled2 = await fillPage(profile);
      await quickAnswer(profile);
      const stats = (await st.get('jw_stats')) || { filled: 0, pages: 0 };
      stats.filled += filled + filled2;
      stats.pages++;
      await st.set('jw_stats', stats);
      showNotification(`Filled ${filled + filled2} fields on this page`, 'success');
    }

    if (msg.action === 'jw_quick_answer') {
      const profile = await buildProfile();
      const answered = await quickAnswer(profile);
      showNotification(`Quick Answer: ${answered} questions answered`, 'success');
    }
  });

  // =====================================================================
  // SECTION 14: AUTO-RUN ON PAGE LOAD
  // =====================================================================
  async function autoRun() {
    LOG('JobWizard AI Engine active — all features UNLIMITED');

    // Setup CTRL+Click queue
    setupCtrlClickQueue();

    // Hide upgrade prompts
    setInterval(hideUpgradePrompts, 3000);

    // Check if this is a job application page
    const isJobPage = /apply|application|job|career|position|greenhouse|lever|workday|icims|taleo|smartrecruiters|bamboohr|indeed/i.test(location.href) ||
      $$('form').length > 0;

    if (isJobPage) {
      // Wait for page to load
      await sleep(3000);

      const profile = await buildProfile();

      // Auto-fill
      const filled1 = await fillPage(profile);
      if (filled1 > 0) LOG(`First pass: ${filled1} fields filled`);

      // Second pass for dynamic content
      await sleep(3000);
      const filled2 = await fillPage(profile);
      if (filled2 > 0) LOG(`Second pass: ${filled2} fields filled`);

      // Quick Answer pass
      await sleep(1000);
      const answered = await quickAnswer(profile);
      if (answered > 0) LOG(`Quick Answer: ${answered} questions answered`);

      // Update stats
      const totalFilled = filled1 + filled2 + answered;
      if (totalFilled > 0) {
        const stats = (await st.get('jw_stats')) || { filled: 0, pages: 0 };
        stats.filled += totalFilled;
        stats.pages++;
        await st.set('jw_stats', stats);
      }

      // Learn from filled fields
      $$('input:not([type=hidden]):not([type=file]),textarea,select')
        .filter(el => isVisible(el) && hasFieldValue(el))
        .forEach(el => {
          const lbl = getLabel(el);
          const val = el.tagName === 'SELECT' ? (el.options[el.selectedIndex]?.text || el.value) : el.value;
          if (lbl && val) {
            const key = lbl.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
            chrome.storage.local.get('jw_learned', d => {
              const learned = d.jw_learned || {};
              learned[key] = val.trim();
              chrome.storage.local.set({ jw_learned: learned });
            });
          }
        });
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoRun);
  } else {
    autoRun();
  }

  // Re-run on SPA navigation
  let _lastUrl = location.href;
  setInterval(() => {
    if (location.href !== _lastUrl) {
      _lastUrl = location.href;
      LOG('URL changed — re-running autofill');
      setTimeout(autoRun, 2000);
    }
  }, 2000);

  // MutationObserver for dynamically loaded forms
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1 && (node.tagName === 'FORM' || node.querySelector?.('form, input, select, textarea'))) {
          LOG('New form detected — running autofill');
          setTimeout(async () => {
            const profile = await buildProfile();
            await fillPage(profile);
            await quickAnswer(profile);
          }, 1500);
          return;
        }
      }
    }
  });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

  LOG('JobWizard AI Engine loaded successfully — UNLIMITED MODE');
})();
