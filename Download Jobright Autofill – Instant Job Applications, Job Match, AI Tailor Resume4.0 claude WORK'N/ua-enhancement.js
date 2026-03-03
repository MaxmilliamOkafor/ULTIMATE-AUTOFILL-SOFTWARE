// === ULTIMATE AUTOFILL ENHANCEMENT v6.0 ===
// Tailor-first flow, answer-learning, fallback form-fill, auto-submit
(function () {
  'use strict';
  const LOG = (...a) => console.log('[UA]', ...a);

  // ===================== CREDIT BYPASS =====================
  const _C = { autofill: 99999, tailorResume: 99999, coverLetter: 99999, resumeReview: 99999, jobMatch: 99999, agentApply: 99999, resumeTailor: 99999, customResume: 99999 };
  const _fetch = window.fetch;
  window.fetch = async function () {
    const u = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0]?.url || '');
    if (/\/swan\/credit\/balance|\/credit\/balance/i.test(u))
      return new Response(JSON.stringify({ code: 200, result: { credit: _C, dailyFill: _C }, success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (/\/swan\/payment\/subscription|\/payment\/subscription/i.test(u))
      return new Response(JSON.stringify({ code: 200, result: { status: 'ACTIVE', plan: 'turbo', subscriptionId: 'unlimited' }, success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (/\/cost-credit/i.test(u))
      return new Response(JSON.stringify({ code: 200, result: false, success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (/\/swan\/credit\/free|\/credit\/free/i.test(u))
      return new Response(JSON.stringify({ code: 200, result: { dailyFill: _C, credit: _C }, success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (/\/payment\/price/i.test(u))
      return new Response(JSON.stringify({ code: 200, result: {}, success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (/resume.?tailor.*credit|tailor.*credit|resume.*credit|credit.*resume|credit.*tailor/i.test(u))
      return new Response(JSON.stringify({ code: 200, result: { credit: 99999, remaining: 99999, limit: 99999, used: 0 }, success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    try {
      const r = await _fetch.apply(window, arguments);
      if (r.status === 402) return new Response(JSON.stringify({ code: 200, result: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      return r;
    } catch (e) { throw e; }
  };
  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) { this._ua_url = url; return _xhrOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    const url = this._ua_url || '';
    if (/credit\/balance|credit\/free|payment\/subscription|cost-credit|resume.*credit|tailor.*credit/i.test(url)) {
      const s = this;
      Object.defineProperty(s, 'responseText', { get: () => JSON.stringify({ code: 200, result: { credit: _C, dailyFill: _C, remaining: 99999 }, success: true }) });
      Object.defineProperty(s, 'status', { get: () => 200 });
      Object.defineProperty(s, 'readyState', { get: () => 4 });
      setTimeout(() => { s.onreadystatechange?.(); s.onload?.(); }, 50);
      return;
    }
    return _xhrSend.apply(this, arguments);
  };

  // ===================== CONFIG =====================
  const SK = { AA: 'ua_aa', Q: 'ua_q', QA: 'ua_qa', QP: 'ua_qp', POS: 'ua_pos', ANS: 'ua_answers', PROF: 'ua_profile' };
  const ATS = [
    { n: 'Workday', p: /myworkdayjobs\.com|myworkdaysite\.com|workday\.com\/.*\/job/i },
    { n: 'Greenhouse', p: /boards\.greenhouse\.io|greenhouse\.io.*\/jobs/i },
    { n: 'Lever', p: /jobs\.lever\.co/i }, { n: 'SmartRecruiters', p: /jobs\.smartrecruiters\.com/i },
    { n: 'iCIMS', p: /icims\.com/i }, { n: 'Taleo', p: /taleo\.net|oraclecloud\.com.*CandidateExperience/i },
    { n: 'Ashby', p: /jobs\.ashbyhq\.com/i }, { n: 'BambooHR', p: /bamboohr\.com.*\/jobs/i },
    { n: 'Oracle', p: /oraclecloud\.com.*recruit/i }, { n: 'LinkedIn', p: /linkedin\.com\/jobs\/(view|application)/i },
    { n: 'Indeed', p: /indeed\.com.*(viewjob|apply)/i }, { n: 'UltiPro', p: /ultipro\.com/i },
    { n: 'Jobvite', p: /jobs\.jobvite\.com/i }, { n: 'Breezy', p: /breezy\.hr|breezyhr\.com/i },
    { n: 'Recruitee', p: /recruitee\.com\/o\//i }, { n: 'ADP', p: /adp\.com.*\/job|workforcenow\.adp/i },
    { n: 'Rippling', p: /ats\.rippling\.com/i }, { n: 'Dover', p: /app\.dover\.com/i },
    { n: 'Dayforce', p: /dayforce\.com.*candidateportal/i }, { n: 'SuccessFactors', p: /successfactors\.com/i },
    { n: 'JazzHR', p: /app\.jazz\.co|applytojob\.com/i }, { n: 'Fountain', p: /fountain\.com.*\/apply/i },
    { n: 'Pinpoint', p: /pinpointhq\.com/i }, { n: 'Comeet', p: /comeet\.com.*\/jobs/i },
    { n: 'Personio', p: /personio\.de.*\/job/i }, { n: 'ZipRecruiter', p: /ziprecruiter\.com/i },
    { n: 'Monster', p: /monster\.com.*job/i }, { n: 'Glassdoor', p: /glassdoor\.com.*job/i },
    { n: 'Dice', p: /dice\.com.*job/i }, { n: 'Wellfound', p: /wellfound\.com.*\/jobs/i },
    { n: 'Paylocity', p: /paylocity\.com.*Recruiting/i }, { n: 'Phenom', p: /phenom\.com.*\/jobs/i },
    { n: 'Avature', p: /avature\.net.*careers/i }, { n: 'Workable', p: /apply\.workable\.com/i },
    { n: 'Career', p: /\/careers?\/?$|\/jobs?\/?$|\/apply\b|\/positions?\//i }
  ];

  // ===================== STORAGE & STATE =====================
  const st = {
    get: k => new Promise(r => chrome.storage.local.get(k, d => r(d[k]))),
    set: (k, v) => new Promise(r => chrome.storage.local.set({ [k]: v }, r)),
    getMulti: keys => new Promise(r => chrome.storage.local.get(keys, d => r(d)))
  };
  let queue = [], qActive = false, qPaused = false, autoApply = false, selected = new Set();
  let _tailorRan = false; // Guard: only run tailor-first flow once per page
  let _abortQ = false; // Abort flag for stop/pause

  // Abort helper — call between steps to respect stop/pause
  function checkAbort() {
    if (_abortQ) { LOG('Abort detected — stopping flow'); throw new Error('UA_ABORT'); }
  }
  async function waitWhilePaused() {
    while (qPaused && !_abortQ) { LOG('Paused — waiting...'); await sleep(2000); }
    checkAbort();
  }
  async function load() { queue = (await st.get(SK.Q)) || []; qActive = (await st.get(SK.QA)) || false; qPaused = (await st.get(SK.QP)) || false; autoApply = (await st.get(SK.AA)) || false; }
  async function saveQ() { await st.set(SK.Q, queue); }

  // ===================== ANSWER LEARNING SYSTEM =====================
  // Stores answers keyed by normalized field label for future reuse
  let _answerBank = {};
  let _answerBankLoaded = false;

  async function loadAnswerBank() {
    if (_answerBankLoaded) return _answerBank;
    const saved = await st.get(SK.ANS);
    _answerBank = saved || {};
    _answerBankLoaded = true;
    // Also pull from OptimHire storage if available
    const ohKeys = ['candidateDetails', 'userDetails', 'applicationDetails', 'questionAnswers', 'responses'];
    const ohData = await st.getMulti(ohKeys);
    for (const val of Object.values(ohData || {})) {
      if (!val) continue;
      try {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        collectEntries(parsed);
      } catch (_) { }
    }
    return _answerBank;
  }

  function collectEntries(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(collectEntries); return; }
    const response = node.response || node.answer || node.value || node.selected || node.a || node.text;
    if (response && typeof response === 'string') {
      const keys = [node.question, node.key, node.id, node.label, node.name];
      keys.forEach(k => { if (k && typeof k === 'string') _answerBank[normalizeKey(k)] = response; });
    }
    Object.values(node).forEach(collectEntries);
  }

  function normalizeKey(s) { return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }

  async function learnAnswer(label, value) {
    if (!label || !value) return;
    const key = normalizeKey(label);
    if (!key) return;
    _answerBank[key] = value;
    await st.set(SK.ANS, _answerBank);
  }

  function getLearnedAnswer(label, el) {
    const candidates = [label, el?.name, el?.id, el?.placeholder, el?.getAttribute?.('aria-label')];
    for (const c of candidates) {
      if (!c) continue;
      const k = normalizeKey(c);
      if (_answerBank[k]) return _answerBank[k];
    }
    // Partial match
    for (const c of candidates) {
      if (!c) continue;
      const k = normalizeKey(c);
      for (const [bk, bv] of Object.entries(_answerBank)) {
        if (k.includes(bk) || bk.includes(k)) return bv;
      }
    }
    return '';
  }

  // ===================== PROFILE =====================
  const DEFAULTS = {
    // === KNOCKOUT / SCREENING — passing answers ===
    authorized: 'Yes', sponsorship: 'No', relocation: 'Yes', remote: 'Yes',
    commute: 'Yes', travel: 'Yes', overtime: 'Yes', shiftWork: 'Yes',
    backgroundCheck: 'Yes', drugTest: 'Yes', ageVerify: 'Yes',
    nonCompete: 'No', nda: 'Yes', legalAgreement: 'Yes',
    securityClearance: 'No', cdl: 'No',
    convicted: 'No', criminalRecord: 'No',
    // === EEO / VOLUNTARY — opt-out answers ===
    veteran: 'I am not a protected veteran', disability: 'I do not have a disability',
    gender: 'Prefer not to say', ethnicity: 'Prefer not to say', race: 'Prefer not to say',
    sexualOrientation: 'Prefer not to say', pronouns: 'Prefer not to say',
    // === GENERAL DEFAULTS ===
    years: '5', salary: '80000', notice: '2 weeks', availability: 'Immediately',
    cover: 'I am excited to apply for this role. My background and skills make me an excellent candidate and I look forward to contributing to your team.',
    why: 'I admire the company culture and the opportunity to make a meaningful impact.',
    howHeard: 'LinkedIn',
  };

  async function getProfile() {
    let p = (await st.get(SK.PROF)) || {};
    // Also check OptimHire candidate data
    const ohData = await st.getMulti(['candidateDetails', 'userDetails']);
    try {
      const cd = typeof ohData.candidateDetails === 'string' ? JSON.parse(ohData.candidateDetails) : (ohData.candidateDetails || {});
      const ud = typeof ohData.userDetails === 'string' ? JSON.parse(ohData.userDetails) : (ohData.userDetails || {});
      p = { ...ud, ...cd, ...p };
    } catch (_) { }
    return p;
  }

  // ===================== SMART VALUE GUESSER =====================
  function guessValue(label, p) {
    const l = (label || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');

    // === PERSONAL INFO ===
    if (/first.?name|given.?name|prenom/.test(l)) return p.first_name || p.firstName || '';
    if (/last.?name|family.?name|surname/.test(l)) return p.last_name || p.lastName || '';
    if (/middle.?name/.test(l)) return p.middle_name || '';
    if (/preferred.?name|nick.?name/.test(l)) return p.preferred_name || p.first_name || '';
    if (/full.?name|your name|^name$/.test(l) && !/company|last|first|user/.test(l)) return `${p.first_name || ''} ${p.last_name || ''}`.trim();
    if (/\bemail\b/.test(l)) return p.email || '';
    if (/phone|mobile|cell|telephone/.test(l)) return p.phone || '';
    if (/^city$|\bcity\b|current.?city/.test(l)) return p.city || '';
    if (/state|province|region/.test(l)) return p.state || '';
    if (/zip|postal/.test(l)) return p.postal_code || p.zip || '';
    if (/country/.test(l)) return p.country || 'United States';
    if (/address|street/.test(l)) return p.address || '';
    if (/location|where.*(you|do you).*live/.test(l)) return p.city ? `${p.city}, ${p.state || ''}`.trim().replace(/,$/, '') : '';

    // === SOCIAL / LINKS ===
    if (/linkedin/.test(l)) return p.linkedin_profile_url || p.linkedin || '';
    if (/github/.test(l)) return p.github_url || p.github || '';
    if (/website|portfolio|personal.?url/.test(l)) return p.website_url || p.website || '';
    if (/twitter|x\.com/.test(l)) return p.twitter_url || p.twitter || '';

    // === EDUCATION ===
    if (/university|school|college|alma.?mater/.test(l)) return p.school || p.university || '';
    if (/\bdegree\b|qualification|education.?level|highest.?level.?of.?education/.test(l)) return p.degree || "Bachelor's";
    if (/major|field.?of.?study|concentration|area.?of.?study/.test(l)) return p.major || '';
    if (/gpa|grade.?point/.test(l)) return p.gpa || '';
    if (/graduation|grad.?date|grad.?year/.test(l)) return p.graduation_year || p.grad_year || '';

    // === WORK EXPERIENCE ===
    if (/title|position|role|current.?title|job.?title/.test(l) && !/company/.test(l)) return p.current_title || p.title || '';
    if (/company|employer|org|current.?company/.test(l)) return p.current_company || p.company || '';
    if (/salary|compensation|pay|desired.?pay|expected.?salary|minimum.?salary|annual.?salary/.test(l)) return p.expected_salary || DEFAULTS.salary;
    if (/years.*(exp|work)|exp.*years|total.*experience|how many years|professional experience/.test(l)) return DEFAULTS.years;

    // === COVER LETTER / WRITTEN RESPONSES ===
    if (/cover.?letter|motivation|additional.?info|message.?to/.test(l)) return p.cover_letter || DEFAULTS.cover;
    if (/summary|about.?(yourself|you|me)|bio|objective/.test(l)) return p.summary || p.cover_letter || DEFAULTS.cover;
    if (/why.*(compan|role|want|interest|position)|what.*(interest|attract|excit).*you/.test(l)) return DEFAULTS.why;

    // === REFERRAL / SOURCE ===
    if (/how.*hear|where.*(find|learn|discover)|source|referred|learn about|find.*(this|us|our)|job.?board|application.?source/.test(l)) return DEFAULTS.howHeard;

    // === AVAILABILITY / TIMING ===
    if (/availab|start.?date|notice|when.*start|earliest.*start|how soon|notice.?period/.test(l)) return DEFAULTS.availability;
    if (/desired.?start|preferred.?start/.test(l)) return DEFAULTS.availability;

    // ====== KNOCKOUT QUESTIONS — MUST PASS ======

    // --- Work Authorization (answer: Yes) ---
    if (/authoriz|eligible.*work|work.*right|legal.*right|legally.*work|right to work|permitted to work|lawful|employment eligib/.test(l)) return DEFAULTS.authorized;
    if (/are you.*authorized|do you have.*authorization|can you.*legally|are you.*legally/.test(l)) return 'Yes';
    if (/eligible.*employment|employment.*authorization|work.*authorization/.test(l)) return 'Yes';
    if (/united states.*work|work.*united states|u\.?s\.?.*authorized|authorized.*u\.?s/.test(l)) return 'Yes';
    if (/canada.*work|work.*canada|authorized.*canad/.test(l)) return 'Yes';
    if (/proof of.*eligib|i.?9|e.?verify/.test(l)) return 'Yes';

    // --- Visa Sponsorship (answer: No = I don't need sponsorship) ---
    if (/sponsor|visa|immigration|work.?permit|require.*(sponsor|visa)|need.*(sponsor|visa)/.test(l)) return DEFAULTS.sponsorship;
    if (/will you.*require|do you.*require.*sponsor|do you.*need.*sponsor/.test(l)) return 'No';
    if (/now or in the future.*sponsor/.test(l)) return 'No';
    if (/require.*employment.*visa|h.?1b|h1.?b|opt|cpt|ead/.test(l)) return 'No';

    // --- Relocation (answer: Yes) ---
    if (/relocat|willing.*move|open.*relocation|able.*relocat|move to|willing.*relocat/.test(l)) return DEFAULTS.relocation;

    // --- Remote / On-site / Hybrid (answer: Yes) ---
    if (/remote|work.*home|hybrid|on.?site|in.?office|in.?person|work.*location|comfortable.*office/.test(l)) return DEFAULTS.remote;

    // --- Travel / Commute (answer: Yes) ---
    if (/commute|travel|willing.*travel|percent.*travel|travel.*required|business.?trip|overnight.?travel/.test(l)) return 'Yes';
    if (/how.*often.*travel|frequency.*travel/.test(l)) return 'As needed';
    if (/\d+.*travel|travel.*\d+/.test(l)) return 'Yes';

    // --- Shift / Schedule (answer: Yes) ---
    if (/shift|weekend|night|evening|flexible.?schedule|overtime|work.*hours|available.*(shifts|weekends|nights|evenings)/.test(l)) return 'Yes';
    if (/on.?call|standby|rotating|variable.?hours|non.?traditional/.test(l)) return 'Yes';

    // --- Background Check (answer: Yes = I agree/consent) ---
    if (/background.?check|background.?screen|background.?investigation|background.?verification/.test(l)) return 'Yes';
    if (/consent.*background|agree.*background|submit.*background|willing.*background/.test(l)) return 'Yes';

    // --- Criminal Record (answer: No = I was not convicted) ---
    if (/convicted|criminal|felony|misdemeanor|criminal.?record|criminal.?history|pending.?charge/.test(l)) return 'No';
    if (/have you.*convicted|have you.*been.*arrested|charged with/.test(l)) return 'No';
    if (/plead.*guilty|plead.*no contest|nolo/.test(l)) return 'No';

    // --- Drug Test (answer: Yes = I agree to a drug test) ---
    if (/drug.?test|drug.?screen|substance|pre.?employment.*test|urinalysis/.test(l)) return 'Yes';

    // --- Age Verification (answer: Yes) ---
    if (/\bage\b|18.*years|over.*18|at.*least.*18|are you.*18|21.*years|over.*21|legal.?age|of.?age/.test(l)) return 'Yes';
    if (/minor|under.*18/.test(l)) return 'No';

    // --- Non-compete / NDA (answer: No = I'm not bound / Yes = I agree) ---
    if (/non.?compete|non.?solicitation|restrictive.?covenant|currently.?bound/.test(l)) return 'No';
    if (/non.?disclosure|nda|confidential.*agree|willing.*sign/.test(l)) return 'Yes';

    // --- Security Clearance ---
    if (/security.?clearance|clearance.?level|active.*clearance|do you.*hold.*clearance/.test(l)) return p.security_clearance || DEFAULTS.securityClearance;
    if (/able.*obtain.*clearance|eligible.*clearance|willing.*obtain.*clearance/.test(l)) return 'Yes';

    // --- CDL / Driver's License ---
    if (/cdl|commercial.?driver|driver.?s?.?licen|valid.*licen|do you.*drive/.test(l)) return p.has_cdl || DEFAULTS.cdl;
    if (/reliable.*transport|own.*vehicle|access.*vehicle|means.*transport/.test(l)) return 'Yes';

    // --- Physical Requirements ---
    if (/lift.*pounds|lift.*lbs|physical.*demand|stand.*hours|physically.*able|able.*perform.*essential/.test(l)) return 'Yes';
    if (/accommodat|reasonable.*accommodat|ada/.test(l)) return 'No';

    // --- Certifications / Licenses ---
    if (/certif|license|credential|professional.*licen/.test(l)) return p.certifications || '';

    // --- Agreement / Consent / Legal (answer: Yes) ---
    if (/agree|acknowledge|certif|attest|confirm|consent|i understand|i accept|terms|accurate.*true|truthful|authorize/.test(l)) return 'Yes';
    if (/opt.?in|subscribe|receive.*(email|sms|text|notification|communication)/.test(l)) return 'Yes';

    // --- EEO / Voluntary Self-ID (prefer not to say) ---
    if (/veteran|military|armed.?forces|protected.?veteran/.test(l)) return DEFAULTS.veteran;
    if (/disabilit|handicap/.test(l)) return DEFAULTS.disability;
    if (/gender|sex\b|pronouns|gender.?identity/.test(l)) return DEFAULTS.gender;
    if (/ethnic|race|racial|heritage|demographic/.test(l)) return DEFAULTS.ethnicity;
    if (/sexual.?orient|lgbtq|lgbt/.test(l)) return DEFAULTS.sexualOrientation;

    // --- Nationality / Citizenship ---
    if (/nationality|citizenship|citizen of/.test(l)) return p.nationality || p.country || 'United States';
    if (/language|fluency|fluent|proficien/.test(l)) return p.languages || 'English';

    // --- Catch-all: "Please Specify" / "Other" ---
    if (/please.?specify|other.?please|if.?other|if.?yes.*explain|if.?no.*explain|please.?explain|provide.?details/.test(l)) return p.city || p.state || 'N/A';
    if (/additional.?comment|anything.?else|is there anything/.test(l)) return '';
    return '';
  }

  function guessFieldValue(label, p, el) {
    return guessValue(label, p) || getLearnedAnswer(label, el) || '';
  }

  // ===================== DOM HELPERS =====================
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const $ = (sel, root) => (root || document).querySelector(sel);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ===================== SHADOW DOM TRAVERSAL =====================
  function queryShadow(sel, root) {
    root = root || document;
    let el = root.querySelector(sel);
    if (el) return el;
    const hosts = root.querySelectorAll('*');
    for (const h of hosts) {
      if (h.shadowRoot) {
        el = queryShadow(sel, h.shadowRoot);
        if (el) return el;
      }
    }
    return null;
  }
  function allShadow(sel, root) {
    root = root || document;
    const results = [...root.querySelectorAll(sel)];
    const hosts = root.querySelectorAll('*');
    for (const h of hosts) {
      if (h.shadowRoot) results.push(...allShadow(sel, h.shadowRoot));
    }
    return results;
  }
  function findByTextShadow(sel, re) {
    const all = allShadow(sel);
    for (const el of all) if (re.test(el.textContent?.trim()) && isVisible(el)) return el;
    return null;
  }

  // Find sidebar button via shadow DOM + direct DOM + text matching
  function findSidebarBtn(textRe, selectors) {
    // Try direct selectors first
    if (selectors) {
      for (const sel of (Array.isArray(selectors) ? selectors : [selectors])) {
        let el = $(sel) || queryShadow(sel);
        if (el && isVisible(el)) return el;
      }
    }
    // Then try text matching across regular + shadow DOM
    const candidates = [
      ...$$('button,a,[role="button"],span,div').filter(e => textRe.test(e.textContent?.trim()) && isVisible(e)),
      ...allShadow('button,a,[role="button"],span,div').filter(e => textRe.test(e.textContent?.trim()) && isVisible(e))
    ];
    return candidates[0] || null;
  }

  // Poll for a sidebar button with retries
  async function waitForSidebarBtn(textRe, selectors, timeout) {
    timeout = timeout || 20000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const btn = findSidebarBtn(textRe, selectors);
      if (btn) return btn;
      await sleep(1500);
    }
    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.offsetParent !== null;
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

  function clickEl(el) { if (!el) return false; el.scrollIntoView?.({ behavior: 'smooth', block: 'center' }); realClick(el); return true; }

  function waitFor(sel, ms, xpath) {
    return new Promise(res => {
      const f = () => xpath ? document.evaluate(sel, document, null, 9, null).singleNodeValue : document.querySelector(sel);
      const e = f(); if (e) { res(e); return; }
      const o = new MutationObserver(() => { const e = f(); if (e) { o.disconnect(); res(e); } });
      o.observe(document.body || document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { o.disconnect(); res(null); }, ms || 10000);
    });
  }

  async function findByText(sel, re, to) {
    const dl = Date.now() + (to || 5000);
    while (Date.now() < dl) {
      for (const e of $$(sel)) if (re.test(e.textContent?.trim()) && isVisible(e)) return e;
      await sleep(500);
    }
    return null;
  }

  // ===================== FIELD LABEL EXTRACTION =====================
  function getLabel(el) {
    if (!el) return '';
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.id) { const lbl = $(`label[for="${CSS.escape(el.id)}"]`); if (lbl) return lbl.textContent.trim(); }
    if (el.placeholder) return el.placeholder;
    const container = el.closest('.form-group,.field,.question,[class*="Field"],[class*="Question"],[class*="form-row"],li,.form-item,.ant-form-item,.ant-row');
    if (container) {
      const lbl = container.querySelector('label,[class*="label"],[class*="Label"]');
      if (lbl && lbl !== el) return lbl.textContent.trim();
    }
    return el.name?.replace(/[_\-]/g, ' ') || '';
  }

  function isFieldRequired(el) {
    if (!el) return false;
    if (el.required || el.getAttribute('aria-required') === 'true') return true;
    const container = el.closest('.field,.question,[class*="field"],[class*="Field"],[class*="question"],li,div');
    const label = getLabel(el);
    if (/\*\s*$|required/i.test(label || '')) return true;
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
        const txt = (el.options[idx]?.textContent || '').trim().toLowerCase();
        if (!txt || /^(select|choose|please|--|—)/.test(txt)) return false;
      }
      return true;
    }
    if (el.type === 'checkbox' || el.type === 'radio') return !!el.checked;
    return !!el.value?.trim();
  }

  // ===================== QUEUE OPS =====================
  async function addJob(url, title) { if (!url || queue.some(j => j.url === url)) return; queue.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), url, title: title || shortUrl(url), status: 'pending', addedAt: Date.now() }); await saveQ(); renderQ(); updateCtrl(); }
  async function removeJob(id) { queue = queue.filter(j => j.id !== id); selected.delete(id); await saveQ(); renderQ(); updateCtrl(); }
  async function clearQ() { queue = []; selected.clear(); await saveQ(); renderQ(); updateCtrl(); }
  async function removeSelected() { queue = queue.filter(j => !selected.has(j.id)); selected.clear(); await saveQ(); renderQ(); updateCtrl(); }
  function shortUrl(u) { try { const p = new URL(u); return p.hostname.replace('www.', '') + p.pathname.slice(0, 30); } catch { return u.slice(0, 40); } }
  function parseCSV(t) { const u = []; for (const l of t.split(/[\r\n]+/)) { const s = l.trim(); if (!s || /^(url|link|job|title|company)/i.test(s)) continue; for (const c of s.split(/[,\t]/)) { const v = c.trim().replace(/^["']|["']$/g, ''); if (/^https?:\/\//i.test(v)) { u.push(v); break; } } if (/^https?:\/\//i.test(s) && !u.includes(s)) u.push(s); } return [...new Set(u)]; }

  // ===================== ATS =====================
  function detectATS() { for (const a of ATS) if (a.p.test(location.href)) return a.n; return null; }
  function isWorkday() { return /myworkdayjobs\.com|myworkdaysite\.com/i.test(location.href); }
  function isJobright() { return /jobright\.ai/i.test(location.hostname); }

  // ===================== FALLBACK FORM FILLER =====================
  // Fills fields that Jobright autofill missed
  async function fallbackFill() {
    LOG('Fallback fill starting — catching missed fields');
    const p = await getProfile();
    await loadAnswerBank();
    let filled = 0;

    // Text inputs & textareas — only unfilled ones
    const inputs = $$('input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=button]),textarea')
      .filter(el => isVisible(el) && !el.value?.trim());

    for (const inp of inputs) {
      const lbl = getLabel(inp);
      if (!lbl) continue;
      const val = guessFieldValue(lbl, p, inp);
      if (!val) continue;
      inp.focus();
      nativeSet(inp, val);
      filled++;
      await sleep(60);
    }

    // Select dropdowns — only unselected ones
    const selects = $$('select').filter(el => isVisible(el) && !hasFieldValue(el));
    for (const sel of selects) {
      const lbl = getLabel(sel);
      const val = guessFieldValue(lbl, p, sel);
      if (!val) {
        // EEO fallback
        const lblLower = (lbl || '').toLowerCase();
        if (/gender|disability|veteran|race|ethnicity|sex\b|heritage/i.test(lblLower)) {
          const opts = $$('option', sel).filter(o => o.value && o.index > 0);
          const fb = opts.find(o => /prefer not|decline|not to|do not|don.t wish/i.test(o.text));
          if (fb) { sel.value = fb.value; sel.dispatchEvent(new Event('change', { bubbles: true })); filled++; }
        }
        continue;
      }
      const opt = $$('option', sel).find(o => o.text.toLowerCase().includes(val.toLowerCase()));
      if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); filled++; }
      else {
        // Try first valid option as fallback
        const opts = $$('option', sel).filter(o => o.value && o.index > 0);
        if (opts.length) { sel.value = opts[0].value; sel.dispatchEvent(new Event('change', { bubbles: true })); filled++; }
      }
    }

    // Radio buttons — only unselected groups
    const groups = {};
    $$('input[type=radio]').filter(isVisible).forEach(r => { (groups[r.name || r.id] ||= []).push(r); });
    for (const [, radios] of Object.entries(groups)) {
      if (radios.some(r => r.checked)) continue;
      const lbl = getLabel(radios[0]);
      const guess = guessFieldValue(lbl, {}, radios[0]);
      const match = radios.find(r => {
        const t = ($(`label[for="${CSS.escape(r.id)}"]`)?.textContent || r.value || '').toLowerCase();
        return guess && t.includes(guess.toLowerCase());
      });
      if (match) { realClick(match); filled++; continue; }
      // Default: Yes for yes/no
      const yes = radios.find(r => {
        const t = ($(`label[for="${CSS.escape(r.id)}"]`)?.textContent || r.value || '').toLowerCase().trim();
        return ['yes', 'true', '1'].includes(t);
      });
      if (yes) { realClick(yes); filled++; }
    }

    // Required checkboxes
    $$('input[type=checkbox][required],input[type=checkbox][aria-required="true"]')
      .filter(el => isVisible(el) && !el.checked)
      .forEach(cb => { realClick(cb); filled++; });

    LOG(`Fallback fill done: ${filled} fields filled`);
    return filled;
  }

  // ===================== LEARN FROM PAGE (capture filled answers) =====================
  async function learnFromPage() {
    const inputs = $$('input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=button]),textarea,select')
      .filter(el => isVisible(el) && hasFieldValue(el));
    for (const el of inputs) {
      const lbl = getLabel(el);
      if (!lbl) continue;
      const val = el.tagName === 'SELECT' ? (el.options[el.selectedIndex]?.textContent || el.value) : el.value;
      if (val) await learnAnswer(lbl, val.trim());
    }
    LOG(`Learned answers from ${inputs.length} fields`);
  }

  // ===================== SUCCESS DETECTION =====================
  function checkSuccess() {
    const href = location.href.toLowerCase();
    if (/\/thanks|\/thank.you|\/success|\/confirmation|\/submitted|\/done|\/complete/i.test(href)) return true;
    const body = document.body?.innerText || '';
    if (/application submitted|thank you for applying|application received|we.ve received your|successfully submitted|application complete|thanks for applying/i.test(body)) return true;
    if ($('#application_confirmation,.application-confirmation,.confirmation-text,.posting-confirmation')) return true;
    if ($('[data-automation-id="congratulationsMessage"],[data-automation-id="confirmationMessage"]')) return true;
    return false;
  }

  // ===================== AUTO-SUBMIT / NEXT PAGE =====================
  async function autoSubmitOrNext() {
    LOG('Attempting auto-submit or next...');

    // First: learn from the filled page before navigating away
    await learnFromPage();

    // Check if all required fields are filled
    const missing = getMissingRequired();
    LOG(`Missing required: ${missing.length}`, missing);

    // Submit selectors (try if no required missing)
    const submitSels = [
      'button[type="submit"]', 'input[type="submit"]',
      'button[data-automation-id="submit"]',
      '#submit_app', '.postings-btn-submit', 'button.application-submit',
      'button[data-qa="btn-submit"]', 'button[aria-label*="Submit" i]',
      '[data-testid="submit-application"]', 'button.btn-submit', '#resumeSubmitForm',
      'div.form-group.submit-button button.btn.btn-primary',
    ];

    if (missing.length === 0) {
      // Try submit
      for (const sel of submitSels) {
        const btn = $(sel);
        if (btn && isVisible(btn)) { LOG('Clicking submit:', sel); await sleep(500); realClick(btn); return 'submitted'; }
      }
      // Fallback: button by text
      const btns = $$('button,a[role="button"],input[type="submit"]').filter(isVisible);
      const submitBtn = btns.find(b => {
        const t = (b.textContent || b.value || '').trim().toLowerCase();
        return /^(submit|apply|send|complete|finish)\b/i.test(t) && !/cancel|back|prev|close/i.test(t);
      });
      if (submitBtn) { LOG('Clicking submit (text):', submitBtn.textContent?.trim()); await sleep(500); realClick(submitBtn); return 'submitted'; }
    }

    // Also try Jobright's continue-button
    const jrContinue = $('.continue-button:not(.continue-button-disabled)');
    if (jrContinue && isVisible(jrContinue)) {
      LOG('Clicking Jobright continue button');
      await sleep(500);
      realClick(jrContinue);
      return 'next_page';
    }

    // Next/Continue selectors
    const nextSels = [
      'button[data-automation-id="bottom-navigation-next-button"]',
      'button[data-automation-id="pageFooterNextButton"]',
      'button[data-automation-id="next-button"]',
      'button[aria-label*="Next" i]', 'button[aria-label*="Continue" i]',
      '[data-testid="next-step"]', '[data-testid="continue"]',
    ];
    for (const sel of nextSels) {
      const btn = $(sel);
      if (btn && isVisible(btn)) { LOG('Clicking next:', sel); await sleep(500); realClick(btn); return 'next_page'; }
    }
    // Fallback: next by text
    const allBtns = $$('button,a[role="button"]').filter(isVisible);
    const nextBtn = allBtns.find(b => {
      const t = (b.textContent || b.value || '').trim().toLowerCase();
      return /^(next|continue|proceed|save.*continue|review)\b/i.test(t) && !/cancel|back|prev|close/i.test(t);
    });
    if (nextBtn) { LOG('Clicking next (text):', nextBtn.textContent?.trim()); await sleep(500); realClick(nextBtn); return 'next_page'; }

    LOG('No submit/next button found');
    return false;
  }

  function getMissingRequired() {
    const required = $$('input:not([type=hidden]),textarea,select').filter(el => isVisible(el) && isFieldRequired(el));
    const missing = [];
    for (const el of required) {
      if (el.type === 'radio' && el.name) {
        const group = $$(`input[type="radio"][name="${CSS.escape(el.name)}"]`).filter(isVisible);
        if (group.some(r => r.checked)) continue;
      } else if (el.type === 'checkbox' && !el.checked) {
        // required checkbox must be checked
      } else if (hasFieldValue(el)) continue;
      const lbl = getLabel(el) || el.name || el.id || 'Required field';
      if (!missing.includes(lbl)) missing.push(lbl);
    }
    return missing;
  }

  // ===================== CAPTCHA / HUMAN CHECK HANDLING =====================
  async function solveCaptchas() {
    LOG('Checking for CAPTCHAs / Human Checks...');
    let solved = 0;

    // 1. reCAPTCHA v2 checkbox ("I'm not a robot")
    const recaptchaFrames = $$('iframe[src*="recaptcha"][src*="anchor"]');
    for (const frame of recaptchaFrames) {
      try {
        const doc = frame.contentDocument || frame.contentWindow?.document;
        if (doc) {
          const cb = doc.querySelector('.recaptcha-checkbox-border, #recaptcha-anchor');
          if (cb && !cb.closest('.recaptcha-checkbox')?.classList?.contains('recaptcha-checkbox-checked')) {
            realClick(cb);
            LOG('Clicked reCAPTCHA checkbox');
            solved++;
            await sleep(2000);
          }
        }
      } catch (e) { /* cross-origin, can't access */ }
    }

    // 2. reCAPTCHA via container
    const recaptchaContainers = $$('.g-recaptcha, [class*="recaptcha"], [data-sitekey]');
    for (const container of recaptchaContainers) {
      const iframe = container.querySelector('iframe');
      if (iframe) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (doc) {
            const anchor = doc.querySelector('#recaptcha-anchor, .recaptcha-checkbox');
            if (anchor && !anchor.classList?.contains('recaptcha-checkbox-checked')) {
              realClick(anchor); solved++; await sleep(2000);
            }
          }
        } catch (e) {
          realClick(iframe); solved++; await sleep(2000);
        }
      }
    }

    // 3. hCaptcha
    const hcaptchaFrames = $$('iframe[src*="hcaptcha"]');
    for (const frame of hcaptchaFrames) {
      try {
        const doc = frame.contentDocument || frame.contentWindow?.document;
        if (doc) {
          const cb = doc.querySelector('#checkbox, .check');
          if (cb) { realClick(cb); solved++; await sleep(2000); }
        }
      } catch (e) { realClick(frame); solved++; await sleep(2000); }
    }

    // 4. Cloudflare Turnstile
    $$('iframe[src*="turnstile"], iframe[src*="challenges.cloudflare"]').forEach(frame => {
      try { realClick(frame); solved++; } catch (e) { }
    });

    // 5. Generic "I'm not a robot" / "Human Check" checkboxes
    $$('input[type="checkbox"]').filter(isVisible).forEach(cb => {
      if (cb.checked) return;
      const lbl = getLabel(cb) || '';
      if (/not a robot|human check|i.?m not a robot|verify.*human|captcha|robot/i.test(lbl)) {
        realClick(cb); solved++;
      }
    });

    // 6. Labels mentioning human verification
    $$('label, span, div').filter(el => isVisible(el) && /not a robot|human.?check|verify.*human/i.test(el.textContent?.trim() || '')).forEach(lbl => {
      const cb = lbl.querySelector('input[type="checkbox"]') || lbl.closest('label')?.querySelector('input[type="checkbox"]');
      if (cb && !cb.checked) { realClick(cb); solved++; }
      else if (!cb) { realClick(lbl); solved++; }
    });

    if (solved > 0) LOG(`Solved ${solved} CAPTCHA(s) / Human Check(s)`);
    return solved;
  }

  // ===================== TAILOR-FIRST AUTOMATION FLOW =====================
  // Full: Generate Custom Resume → Improve My Resume → Full Edit → Select All → Generate New Resume
  //       → Wait → Continue to Autofill → Autofill → CAPTCHAs → Fill gaps → Submit/Next

  async function tailorFirstFlow() {
    const ats = detectATS();
    if (!ats) return;
    LOG(`Tailor-first flow starting for ${ats}...`);

    // Guard: only run once per page
    if (_tailorRan) { LOG('Tailor flow already ran on this page — skipping'); return; }
    _tailorRan = true;

    try {
      checkAbort();

      // Wait for Jobright sidebar
      let sidebar = await waitFor('#jobright-helper-id', 15000);
      if (!sidebar) sidebar = queryShadow('#jobright-helper-id');
      if (!sidebar) {
        LOG('Jobright sidebar not found — falling back to direct autofill');
        await directAutofillFlow();
        return;
      }

      // === Step 1: Click "Generate Your Custom Resume" ===
      checkAbort();
      LOG('Step 1: Looking for Generate Your Custom Resume...');
      let tailorBtn = await waitForSidebarBtn(
        /generate\s*(your\s*)?(custom|my)?\s*resume|tailor\s*resume|create\s*resume/i,
        ['.application-dashboard-tailor-resume', '.external-job-generate-resume-button',
          'button[class*="tailor"]', 'button[class*="generate"]', 'div[class*="generate-resume"]'],
        15000
      );
      if (tailorBtn) {
        LOG('Step 1: Clicking Generate Your Custom Resume');
        realClick(tailorBtn);
        await sleep(4000);
        checkAbort();

        // === Step 2: Click "Improve My Resume for This Job" ===
        LOG('Step 2: Looking for Improve My Resume...');
        let improveBtn = await waitForSidebarBtn(
          /improve\s*(my)?\s*resume/i,
          ['button[class*="improve"]', 'div[class*="improve"]'],
          12000
        );
        if (improveBtn) {
          LOG('Step 2: Clicking Improve My Resume');
          realClick(improveBtn);
          await sleep(3000);
        } else { LOG('Step 2: Improve button not found — continuing'); }
        checkAbort();

        // === Step 3: Click "Full Edit" ===
        LOG('Step 3: Looking for Full Edit...');
        let fullEditBtn = await waitForSidebarBtn(
          /full\s*edit/i,
          ['button[class*="full-edit"]', 'div[class*="full-edit"]', 'label[class*="full"]'],
          8000
        );
        if (fullEditBtn) {
          LOG('Step 3: Clicking Full Edit');
          realClick(fullEditBtn);
          await sleep(2000);
        } else { LOG('Step 3: Full Edit not found — continuing'); }
        checkAbort();

        // === Step 4: Click "Select All" (missing skill keywords) ===
        LOG('Step 4: Looking for Select All...');
        let selectAllBtn = await waitForSidebarBtn(
          /select\s*all/i,
          ['button[class*="select-all"]', 'span[class*="select-all"]', 'label[class*="select"]'],
          6000
        );
        if (selectAllBtn) {
          LOG('Step 4: Clicking Select All');
          realClick(selectAllBtn);
          await sleep(1500);
        } else { LOG('Step 4: Select All not found — continuing'); }
        checkAbort();

        // === Step 5: Click "Generate My New Resume" ===
        LOG('Step 5: Looking for Generate My New Resume...');
        let generateNewBtn = await waitForSidebarBtn(
          /generate\s*(my\s*new\s*)?resume|generate$/i,
          ['button[class*="generate"]', 'div[class*="generate-btn"]'],
          8000
        );
        if (generateNewBtn) {
          LOG('Step 5: Clicking Generate My New Resume');
          realClick(generateNewBtn);
          await sleep(3000);
        } else { LOG('Step 5: Generate New not found — continuing'); }
        checkAbort();

        // === Step 6: Wait for resume generation (up to 2 min) ===
        LOG('Step 6: Waiting for resume generation to complete...');
        const maxWait = 120000;
        const start = Date.now();
        while (Date.now() - start < maxWait) {
          if (_abortQ) break;
          const cBtn = findSidebarBtn(/continue\s*to\s*autofill/i,
            ['.continue-button:not(.continue-button-disabled)']);
          if (cBtn) { LOG('Resume ready — Continue to Autofill appeared'); break; }
          const afBtn = queryShadow('.auto-fill-button:not([disabled])');
          if (afBtn) { LOG('Resume ready — autofill button available'); break; }
          const dlBtn = findSidebarBtn(/download\s*resume/i);
          if (dlBtn) { LOG('Resume ready — Download Resume visible'); break; }
          const loading = queryShadow('.tailor-resume-loading-linear-progress') ||
            queryShadow('.resume-loading-container') || queryShadow('.spin-loading');
          if (!loading || !isVisible(loading)) {
            const scoreEl = findByTextShadow('div,span', /score|good|great|matched/i);
            if (scoreEl) { LOG('Resume ready — score visible'); break; }
          }
          await sleep(3000);
        }
        await sleep(2000);
      } else {
        LOG('Step 1: No tailor button found — skipping tailoring steps');
      }

      checkAbort();

      // === Step 7: Click "Continue to Autofill" ===
      LOG('Step 7: Looking for Continue to Autofill...');
      let continueBtn = await waitForSidebarBtn(
        /continue\s*(to)?\s*autofill/i,
        ['.continue-button:not(.continue-button-disabled)', 'button[class*="continue"]'],
        12000
      );
      if (continueBtn) {
        LOG('Step 7: Clicking Continue to Autofill');
        realClick(continueBtn);
        await sleep(2000);
      } else { LOG('Step 7: Continue not found — proceeding to autofill'); }

      checkAbort();

      // === Step 8: Click Autofill ===
      LOG('Step 8: Triggering Autofill');
      await triggerAutofill();

      // Wait for autofill to complete
      LOG('Waiting for Jobright autofill to complete...');
      await sleep(3000);
      const fillStart = Date.now();
      while (Date.now() - fillStart < 60000) {
        if (_abortQ) break;
        const afBtn = queryShadow('.auto-fill-button') || $('.auto-fill-button');
        if (afBtn) {
          const txt = afBtn.textContent?.trim().toLowerCase() || '';
          if (txt === 'autofill' || txt === '' || /^auto.?fill$/i.test(txt)) break;
        }
        await sleep(1500);
      }
      await sleep(2000);

      checkAbort();

      // === Step 9: CAPTCHAs ===
      LOG('Step 9: Solving CAPTCHAs...');
      await solveCaptchas();
      await sleep(500);

      // === Step 10: Fallback fill ===
      LOG('Step 10: Fallback fill for missed fields');
      await fallbackFill();
      await sleep(800);
      await fallbackFill();
      await sleep(500);
      await solveCaptchas();
      await sleep(500);

      checkAbort();

      // === Step 11: Submit or next page ===
      LOG('Step 11: Auto-submit/next');
      const result = await autoSubmitOrNext();

      if (result === 'next_page') {
        LOG('Navigated to next page — continuing multi-page flow');
        await sleep(3000);
        await multiPageLoop();
      } else if (result === 'submitted') {
        LOG('Application submitted!');
        await learnFromPage();
        await sleep(2000);
        if (checkSuccess()) LOG('Success confirmed!');
      }
    } catch (e) {
      if (e.message === 'UA_ABORT') { LOG('Flow aborted by user'); _tailorRan = false; return; }
      LOG('Error in tailorFirstFlow:', e.message);
    }
  }

  // ===================== MULTI-PAGE FORM LOOP =====================
  async function multiPageLoop() {
    const MAX_PAGES = 10;
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (checkSuccess()) { LOG('Success detected — stopping multi-page loop'); break; }
      LOG(`Multi-page: processing page ${page}`);

      // Wait for page content
      await sleep(2000);

      // Try Jobright autofill again
      await triggerAutofill();
      await sleep(3000);

      // Fallback fill
      await fallbackFill();
      await sleep(1000);
      await fallbackFill();
      await sleep(500);

      // Submit or next
      const action = await autoSubmitOrNext();
      if (action === 'submitted') {
        LOG('Submitted on page ' + page);
        await sleep(3000);
        if (checkSuccess()) LOG('Success confirmed after submit');
        break;
      } else if (action === 'next_page') {
        LOG('Next page clicked on page ' + page);
        await sleep(3000);
        continue;
      } else {
        // No button found — try one more fallback+submit
        await sleep(2000);
        await fallbackFill();
        const retry = await autoSubmitOrNext();
        if (retry) LOG('Retry result:', retry);
        break;
      }
    }
  }

  // ===================== DIRECT AUTOFILL FLOW (no sidebar) =====================
  async function directAutofillFlow() {
    await triggerAutofill();
    await sleep(5000);
    await fallbackFill();
    await sleep(1000);
    await fallbackFill();
    await sleep(1000);
    const result = await autoSubmitOrNext();
    if (result === 'next_page') { await sleep(3000); await multiPageLoop(); }
  }

  // ===================== WORKDAY AUTOMATION =====================
  async function workdayAutomation() {
    LOG('Workday automation starting...');
    // Click Apply button
    const allBtns = $$('a, button');
    for (const b of allBtns) { if (/^\s*Apply\s*$/i.test(b.textContent) && isVisible(b)) { clickEl(b); await sleep(2000); break; } }
    // Click Apply Manually
    const am = await waitFor("//*[@data-automation-id='applyManually']", 8000, true);
    if (am) { await sleep(500); clickEl(am); await sleep(2000); }
    // Wait for form page
    const fp = await waitFor("[data-automation-id='quickApplyPage'],[data-automation-id='applyFlowAutoFillPage'],[data-automation-id='contactInformationPage'],[data-automation-id='applyFlowMyInfoPage'],[data-automation-id='ApplyFlowPage']", 10000);
    if (fp) {
      await sleep(1000);
      // Run tailor-first flow (which includes autofill + fallback + submit)
      await tailorFirstFlow();
    }
  }

  // ===================== RESUME TAILORING (on Jobright website) =====================
  async function resumeTailoringAutomation() {
    if (!isJobright() || (!location.href.includes('plugin_tailor=1') && !location.href.includes('/jobs/info/'))) return;
    await sleep(3000);
    let el = await findByText('button,a,div[role="button"]', /improve my resume/i, 8000); if (el) { clickEl(el); await sleep(2000); }
    el = await findByText('button,a,div[role="button"],label,span', /full edit/i, 5000); if (el) { clickEl(el); await sleep(3000); }
    el = await findByText('button,a,span,div[role="button"],label', /select all/i, 5000); if (el) { clickEl(el); await sleep(1000); }
    el = await findByText('button,a,div[role="button"]', /generate (my new )?resume|generate$/i, 5000); if (el) clickEl(el);
  }

  // ===================== AUTO-DISMISS CONFIRMATION DIALOGS =====================
  function dismissAutofillConfirm() {
    // Handle "Are you sure to autofill again?" dialog — click CANCEL to prevent overwriting
    const containers = [...$$('[class*="modal"],[class*="Modal"],[class*="dialog"],[class*="Dialog"],[class*="ant-modal"],[role="dialog"]'),
    ...allShadow('[class*="modal"],[class*="Modal"],[class*="dialog"],[role="dialog"]')];
    for (const m of containers) {
      if (/are you sure to autofill again|overwrite your current progress/i.test(m.textContent || '')) {
        LOG('Overwrite dialog detected — clicking Cancel to preserve filled data');
        const cancelBtn = [...m.querySelectorAll('button,a,[role="button"]')].find(b => /^cancel$/i.test(b.textContent?.trim()));
        if (cancelBtn) { realClick(cancelBtn); return true; }
      }
    }
    return false;
  }

  // Auto-dismiss "How Was Your Autofill Experience This Time?" review popup
  function dismissReviewPopup() {
    const allEls = [...$$('div,section,aside,[class*="feedback"],[class*="review"],[class*="rating"],[class*="survey"],[class*="popup"],[class*="toast"],[class*="banner"]'),
    ...allShadow('div,section,aside,[class*="feedback"],[class*="review"],[class*="rating"],[class*="survey"]')];
    for (const el of allEls) {
      const txt = el.textContent || '';
      if (/how was your autofill experience|rate your experience|autofill experience this time/i.test(txt)) {
        // Try to find close/dismiss/X button
        const closeBtn = el.querySelector('[class*="close"],[class*="Close"],button[aria-label*="close"],button[aria-label*="Close"],.ant-modal-close,.ant-drawer-close') ||
          [...el.querySelectorAll('button,span,div,svg')].find(b => /^[×✕✖xX]$/.test(b.textContent?.trim()) || b.getAttribute('aria-label')?.toLowerCase() === 'close');
        if (closeBtn) {
          LOG('Auto-dismissing review/feedback popup');
          realClick(closeBtn);
          return true;
        }
        // No close button found — hide it directly
        if (el.offsetHeight > 0 && el.offsetHeight < 400) {
          LOG('Hiding review popup (no close button found)');
          el.style.display = 'none';
          return true;
        }
      }
    }
    return false;
  }

  // Combined popup dismisser — catches any annoying popups
  function dismissAllPopups() {
    dismissAutofillConfirm();
    dismissReviewPopup();
  }

  // ===================== AUTOFILL TRIGGER =====================
  async function triggerAutofill() {
    // Wait for sidebar (shadow DOM aware)
    let sidebar = await waitFor('#jobright-helper-id', 8000);
    if (!sidebar) sidebar = queryShadow('#jobright-helper-id');
    await sleep(1500);

    // Try up to 6 times with shadow DOM traversal
    for (let attempt = 0; attempt < 6; attempt++) {
      // Auto-dismiss any confirmation dialogs first
      dismissAutofillConfirm();
      await sleep(300);

      let b = queryShadow('.auto-fill-button') || $('.auto-fill-button') ||
        findSidebarBtn(/^autofill$/i, ['.auto-fill-button', 'button[class*="autofill"]']);
      if (b && !b.disabled) {
        realClick(b);
        // Wait briefly and dismiss any confirmation that pops up after click
        await sleep(1000);
        dismissAutofillConfirm();
        LOG(`Autofill button clicked (attempt ${attempt + 1})`);
        return true;
      }
      LOG(`Autofill button not found (attempt ${attempt + 1}/6), retrying...`);
      await sleep(2500);
    }
    LOG('Autofill button not found after 6 attempts');
    return false;
  }

  // ===================== QUEUE ENGINE =====================
  async function processQ() {
    if (!qActive || qPaused || !queue.length) return;
    const c = queue.find(j => j.status === 'applying');
    if (c) {
      try {
        const p = new URL(c.url).pathname;
        if (location.href.includes(p.slice(0, Math.min(p.length, 25)))) {
          // We're on the right page — run tailor-first flow
          if (isWorkday()) await workdayAutomation();
          else await tailorFirstFlow();

          // Wait and check success
          await sleep(5000);
          if (checkSuccess()) {
            c.status = 'done';
            LOG('Queue job completed successfully');
          } else {
            c.status = 'done'; // Assume done after full flow
          }
          await saveQ(); renderQ(); updateCtrl();
          await sleep(5000);
          goNext();
          return;
        }
      } catch { }
    }
    goNext();
  }
  function goNext() {
    if (qPaused || _abortQ) return;
    const n = queue.find(j => j.status === 'pending');
    if (n) {
      n.status = 'applying';
      saveQ().then(() => {
        LOG(`Queue: navigating to ${n.url} (same tab)`);
        // Navigate in-place — NO new tabs
        location.href = n.url;
      });
    } else {
      qActive = false; st.set(SK.QA, false); renderQ(); updateCtrl();
      LOG('Queue: all jobs processed');
    }
  }
  async function startQ() {
    if (!queue.filter(j => j.status === 'pending').length) return;
    _abortQ = false; // Reset abort flag
    qActive = true; qPaused = false;
    await st.set(SK.QA, true); await st.set(SK.QP, false);
    updateCtrl(); goNext();
  }
  async function stopQ() {
    LOG('Stop requested — setting abort flag');
    _abortQ = true; // IMMEDIATELY abort any running async flow
    qActive = false; qPaused = false;
    await st.set(SK.QA, false); await st.set(SK.QP, false);
    queue.forEach(j => { if (j.status === 'applying') j.status = 'pending'; });
    _tailorRan = false; // Allow re-run after stop
    await saveQ(); renderQ(); updateCtrl();
  }
  async function pauseQ() {
    LOG('Pause requested');
    qPaused = true;
    await st.set(SK.QP, true); renderQ(); updateCtrl();
  }
  async function resumeQ() {
    LOG('Resume requested');
    qPaused = false;
    await st.set(SK.QP, false); processQ(); renderQ(); updateCtrl();
  }
  async function skipJob() { const c = queue.find(j => j.status === 'applying'); if (c) { c.status = 'failed'; await saveQ(); } goNext(); }

  // ===================== CREDIT HIDE =====================
  function hideCredits() {
    $$('.autofill-credit-row,.payment-entry,.plugin-setting-credits-tip').forEach(e => e.style.display = 'none');
    $$('.ant-modal-root').forEach(m => { if (/remaining.*credit|upgrade.*turbo|out of credit|credits.*refill|get unlimited/i.test(m.textContent || '')) m.style.display = 'none'; });
    $$('*').forEach(el => { if (el.children.length === 0 && /\d+\s*credits?\s*available/i.test(el.textContent || '')) el.textContent = el.textContent.replace(/\d+\s*(credits?\s*available)/i, 'Unlimited $1'); });
  }

  // ===================== CSS =====================
  function injectCSS() {
    if (document.getElementById('ua-css')) return;
    const s = document.createElement('style'); s.id = 'ua-css';
    s.textContent = `
.autofill-credit-row,.autofill-credit-text,.autofill-credit-text-right,.payment-entry,.plugin-setting-credits-tip{display:none!important}
.ant-modal-root:has(.popup-modal-actions){display:none!important}

/* === DRAGGABLE FAB === */
#ua-fab{position:fixed;bottom:28px;right:28px;width:48px;height:48px;border-radius:50%;border:none;cursor:grab;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#00c985,#00b377);box-shadow:0 2px 12px rgba(0,201,133,.4);z-index:2147483647;transition:box-shadow .2s;user-select:none;-webkit-user-select:none;touch-action:none}
#ua-fab:hover{box-shadow:0 4px 20px rgba(0,201,133,.55)}
#ua-fab:active{cursor:grabbing}
#ua-fab .ico{width:22px;height:22px;pointer-events:none}
#ua-fab .badge{position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;border-radius:8px;background:#ef4444;color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 3px;border:2px solid #fff;font-family:system-ui,sans-serif;line-height:1}
#ua-fab .badge:empty{display:none}

/* === ADD FAB === */
#ua-fab-add{position:fixed;bottom:84px;right:32px;width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#064e3b;box-shadow:0 2px 10px rgba(0,0,0,.2);z-index:2147483646;transition:transform .2s,background .2s}
#ua-fab-add:hover{transform:scale(1.1);background:#065f46}
#ua-fab-add .ico{width:18px;height:18px}

/* === AUTOMATION CONTROL RING === */
#ua-ctrl{position:fixed;bottom:28px;right:90px;z-index:2147483647;display:none;align-items:center;gap:0;font-family:system-ui,-apple-system,sans-serif}
#ua-ctrl.show{display:flex}
#ua-ctrl-pill{display:flex;align-items:center;gap:0;background:#064e3b;border-radius:24px;padding:4px;box-shadow:0 4px 20px rgba(0,0,0,.25)}
.uc-seg{display:flex;align-items:center;gap:6px;padding:6px 12px;color:#d1fae5;font-size:11px;font-weight:600;white-space:nowrap}
.uc-seg.info{border-right:1px solid rgba(255,255,255,.1)}
.uc-progress{font-variant-numeric:tabular-nums;color:#6ee7b7;font-size:12px;font-weight:700}
.uc-lbl{color:#34d399;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
.uc-btn{width:30px;height:30px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;background:transparent;flex-shrink:0}
.uc-btn .ico{width:14px;height:14px;pointer-events:none}
.uc-btn.pause{color:#fbbf24}.uc-btn.pause:hover{background:rgba(251,191,36,.15)}
.uc-btn.skip{color:#60a5fa}.uc-btn.skip:hover{background:rgba(96,165,250,.15)}
.uc-btn.quit{color:#f87171}.uc-btn.quit:hover{background:rgba(248,113,113,.15)}
.uc-btn.resume{color:#34d399}.uc-btn.resume:hover{background:rgba(52,211,153,.15)}

/* === DRAWER === */
#ua-drawer{position:fixed;display:none;width:380px;max-height:520px;background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.14);flex-direction:column;overflow:hidden;border:1px solid #e5e7eb;z-index:2147483647;font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#111827}
#ua-drawer.open{display:flex}

.ua-hdr{background:linear-gradient(135deg,#00a86b,#00c985);padding:14px 18px;display:flex;justify-content:space-between;align-items:center}
.ua-hdr-t{font-size:15px;font-weight:700;color:#fff}
.ua-hdr-sub{font-size:10px;color:rgba(255,255,255,.6);margin-top:1px}
.ua-hdr-badge{background:rgba(255,255,255,.18);color:#fff;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;letter-spacing:.3px}
.ua-body{padding:14px 16px;overflow-y:auto;max-height:420px;flex:1}
.ua-sec{margin-bottom:14px}.ua-sec:last-child{margin-bottom:0}
.ua-sec-t{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#9ca3af;margin-bottom:6px}

/* Toggle */
.ua-tog{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f9fafb;border-radius:10px;border:1px solid #f3f4f6}
.ua-tog-l{font-size:12px;font-weight:600;color:#111827}
.ua-tog-d{font-size:10px;color:#9ca3af;margin-top:1px}
.ua-sw{position:relative;width:40px;height:22px;flex-shrink:0}
.ua-sw input{opacity:0;width:0;height:0;position:absolute}
.ua-sw-s{position:absolute;cursor:pointer;inset:0;background:#d1d5db;border-radius:22px;transition:.25s}
.ua-sw-s:before{content:"";position:absolute;width:16px;height:16px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.25s;box-shadow:0 1px 2px rgba(0,0,0,.1)}
.ua-sw input:checked+.ua-sw-s{background:#00c985}
.ua-sw input:checked+.ua-sw-s:before{transform:translateX(18px)}

/* Status */
.ua-stat{padding:6px 10px;border-radius:8px;font-size:10px;font-weight:600;display:flex;align-items:center;gap:5px;margin-top:6px}
.ua-stat.on{background:#ecfdf5;color:#059669}
.ua-stat.off{background:#f9fafb;color:#9ca3af}
.ua-stat .dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.ua-stat.on .dot{background:#059669;animation:uap 1.5s infinite}
.ua-stat.off .dot{background:#d1d5db}
@keyframes uap{0%,100%{opacity:1}50%{opacity:.3}}

/* Import */
.ua-drop{border:1.5px dashed #d1d5db;border-radius:10px;padding:14px;text-align:center;cursor:pointer;transition:.2s;background:#fafafa}
.ua-drop:hover,.ua-drop.over{border-color:#00c985;background:#ecfdf5}
.ua-drop-t{font-size:11px;font-weight:600;color:#6b7280}
.ua-drop-sub{font-size:10px;color:#9ca3af;margin-top:2px}
.ua-csv-in{display:none}
.ua-url-row{display:flex;gap:5px;margin-top:8px}
.ua-url-inp{flex:1;padding:7px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:11px;outline:none;transition:border .2s;font-family:inherit}
.ua-url-inp:focus{border-color:#00c985}
.ua-url-btn{background:#00c985;color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap}
.ua-url-btn:hover{background:#00a86b}

/* Queue Toolbar */
.ua-q-bar{display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap}
.ua-q-bar label{display:flex;align-items:center;gap:3px;font-size:10px;color:#6b7280;cursor:pointer}
.ua-q-bar label input{width:13px;height:13px;accent-color:#00c985}
.ua-q-bar .del{background:none;border:1px solid #fca5a5;color:#ef4444;border-radius:6px;padding:3px 8px;font-size:9px;font-weight:600;cursor:pointer}
.ua-q-bar .del:hover{background:#fef2f2}
.ua-q-bar .del:disabled{opacity:.3;cursor:default}
.ua-q-bar .info{margin-left:auto;font-size:10px;color:#9ca3af}

/* Queue List */
.ua-qlist{max-height:180px;overflow-y:auto;border:1px solid #f3f4f6;border-radius:8px}
.ua-qlist:empty::after{content:'No jobs in queue';display:block;text-align:center;color:#9ca3af;padding:16px;font-size:11px}
.ua-qi{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid #f9fafb;font-size:11px}
.ua-qi:last-child{border-bottom:none}
.ua-qi:hover{background:#fafafa}
.ua-qi input{width:13px;height:13px;accent-color:#00c985;flex-shrink:0}
.ua-qi .num{width:18px;height:18px;border-radius:4px;background:#f3f4f6;color:#6b7280;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ua-qi .url{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#4b5563}
.ua-qi .st{font-size:8px;padding:2px 6px;border-radius:4px;font-weight:700;flex-shrink:0;text-transform:uppercase;letter-spacing:.3px}
.ua-qi .st.pending{background:#fef3c7;color:#92400e}
.ua-qi .st.applying{background:#dbeafe;color:#1e40af}
.ua-qi .st.done{background:#d1fae5;color:#065f46}
.ua-qi .st.failed{background:#fee2e2;color:#991b1b}
.ua-qi .rm{width:18px;height:18px;border:none;background:none;cursor:pointer;color:#d1d5db;font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center;border-radius:4px;flex-shrink:0}
.ua-qi .rm:hover{background:#fee2e2;color:#ef4444}

/* Queue Summary */
.ua-qsum{display:flex;gap:10px;padding:6px 0;font-size:10px;color:#6b7280;justify-content:center}
.ua-qsum i{width:5px;height:5px;border-radius:50%;display:inline-block;margin-right:2px;vertical-align:middle}

/* Queue Buttons */
.ua-qbtns{display:flex;gap:5px;margin-top:6px}
.ua-qbtns button{flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:.4px;transition:.15s}
.ua-qbtns .pri{background:#00c985;color:#fff}.ua-qbtns .pri:hover{background:#00a86b}
.ua-qbtns .pri:disabled{background:#e5e7eb;color:#9ca3af;cursor:default}
.ua-qbtns .sec{background:#f3f4f6;color:#6b7280}.ua-qbtns .sec:hover{background:#e5e7eb}
.ua-qbtns .dan{background:#fff;color:#ef4444;border:1px solid #fecaca}.ua-qbtns .dan:hover{background:#fef2f2}

/* ATS Badge */
#ua-ats{position:fixed;top:12px;right:12px;z-index:2147483646;background:#064e3b;color:#6ee7b7;padding:5px 12px;border-radius:10px;font-family:system-ui,sans-serif;font-size:10px;font-weight:700;box-shadow:0 2px 12px rgba(0,0,0,.15);display:none;align-items:center;gap:5px}
#ua-ats.show{display:flex}
#ua-ats .dot{width:5px;height:5px;border-radius:50%;background:#34d399;animation:uap 1.5s infinite}
    `;
    document.head.appendChild(s);
  }

  // ===================== SVG (inline, sized) =====================
  function ico(name, w, h, clr) {
    w = w || 16; h = h || 16; const c = clr || 'currentColor';
    const paths = {
      bolt: `<path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z" fill="${c}"/>`,
      plus: `<line x1="12" y1="5" x2="12" y2="19" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
      pause: `<rect x="6" y="4" width="4" height="16" rx="1" fill="${c}"/><rect x="14" y="4" width="4" height="16" rx="1" fill="${c}"/>`,
      play: `<path d="M8 5v14l11-7z" fill="${c}"/>`,
      stop: `<rect x="6" y="6" width="12" height="12" rx="2" fill="${c}"/>`,
      skip: `<path d="M5 4l10 8-10 8V4z" fill="${c}"/><rect x="17" y="4" width="3" height="16" rx="1" fill="${c}"/>`,
      quit: `<circle cx="12" cy="12" r="9" fill="none" stroke="${c}" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="${c}" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="9" x2="15" y2="15" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`
    };
    return `<svg class="ico" width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${paths[name] || ''}</svg>`;
  }

  // ===================== UI BUILD =====================
  function buildUI() {
    if (window.self !== window.top) return;

    // --- Main FAB (draggable) ---
    const fab = document.createElement('div'); fab.id = 'ua-fab';
    fab.innerHTML = ico('bolt', 22, 22, '#fff') + '<span class="badge" id="ua-badge"></span>';
    document.body.appendChild(fab);
    makeDraggable(fab);
    fab.addEventListener('click', () => { const d = document.getElementById('ua-drawer'); d.classList.toggle('open'); positionDrawer(); });

    // --- Add-to-queue mini FAB ---
    const af = document.createElement('div'); af.id = 'ua-fab-add';
    af.innerHTML = ico('plus', 18, 18, '#6ee7b7');
    af.title = 'Add this page to queue';
    document.body.appendChild(af);
    af.addEventListener('click', () => addJob(location.href, document.title));

    // --- Automation control pill ---
    const ctrl = document.createElement('div'); ctrl.id = 'ua-ctrl';
    ctrl.innerHTML = `<div id="ua-ctrl-pill">
      <div class="uc-seg info"><div><div class="uc-progress" id="uc-prog">0/0</div><div class="uc-lbl">Applied</div></div></div>
      <div class="uc-seg">
        <button class="uc-btn pause" id="uc-pause" title="Pause">${ico('pause', 14, 14, '#fbbf24')}</button>
        <button class="uc-btn skip" id="uc-skip" title="Skip">${ico('skip', 14, 14, '#60a5fa')}</button>
        <button class="uc-btn quit" id="uc-quit" title="Quit">${ico('quit', 14, 14, '#f87171')}</button>
      </div>
    </div>`;
    document.body.appendChild(ctrl);
    document.getElementById('uc-pause').addEventListener('click', () => { if (qPaused) resumeQ(); else pauseQ(); });
    document.getElementById('uc-skip').addEventListener('click', skipJob);
    document.getElementById('uc-quit').addEventListener('click', stopQ);

    // --- Drawer ---
    const dw = document.createElement('div'); dw.id = 'ua-drawer';
    dw.innerHTML = `
      <div class="ua-hdr"><div><div class="ua-hdr-t">Ultimate Autofill</div><div class="ua-hdr-sub">AI-Powered Job Applications</div></div><span class="ua-hdr-badge">UNLIMITED</span></div>
      <div class="ua-body">
        <div class="ua-sec">
          <div class="ua-sec-t">Auto-Apply</div>
          <div class="ua-tog"><div><div class="ua-tog-l">Auto-Apply on ATS Pages</div><div class="ua-tog-d">Tailor → Autofill → Fill gaps → Submit</div></div><label class="ua-sw"><input type="checkbox" id="ua-aa"><span class="ua-sw-s"></span></label></div>
          <div id="ua-stat" class="ua-stat off"><span class="dot"></span><span id="ua-stat-t">Inactive</span></div>
        </div>
        <div class="ua-sec">
          <div class="ua-sec-t">Import Jobs</div>
          <div id="ua-drop" class="ua-drop"><div class="ua-drop-t">Drop CSV or click to browse</div><div class="ua-drop-sub">.csv .txt .tsv with job URLs</div><input type="file" id="ua-csv" class="ua-csv-in" accept=".csv,.txt,.tsv"></div>
          <div class="ua-url-row"><input type="text" id="ua-url" class="ua-url-inp" placeholder="Paste job URL..."><button id="ua-add" class="ua-url-btn">Add</button></div>
        </div>
        <div class="ua-sec">
          <div class="ua-sec-t">Queue <span id="ua-q-cnt" style="color:#00c985">(0)</span></div>
          <div class="ua-q-bar"><label><input type="checkbox" id="ua-selall">Select all</label><button class="del" id="ua-del" disabled>Delete selected</button><span class="info" id="ua-q-info"></span></div>
          <div class="ua-qlist" id="ua-qlist"></div>
          <div class="ua-qsum" id="ua-qsum"></div>
          <div class="ua-qbtns" id="ua-qbtns"></div>
        </div>
      </div>`;
    document.body.appendChild(dw);

    // ATS badge
    const ab = document.createElement('div'); ab.id = 'ua-ats';
    ab.innerHTML = '<span class="dot"></span><span id="ua-ats-n"></span>';
    document.body.appendChild(ab);

    bindDrawer();
  }

  function positionDrawer() {
    const d = document.getElementById('ua-drawer');
    const f = document.getElementById('ua-fab');
    if (!d || !f) return;
    const r = f.getBoundingClientRect();
    d.style.bottom = (window.innerHeight - r.top + 8) + 'px';
    d.style.right = (window.innerWidth - r.right) + 'px';
  }

  // ===================== DRAGGABLE =====================
  function makeDraggable(el) {
    let sx, sy, ox, oy, dragging = false, moved = false;
    const onDown = e => {
      e.preventDefault();
      const t = e.touches ? e.touches[0] : e;
      sx = t.clientX; sy = t.clientY;
      const r = el.getBoundingClientRect(); ox = r.left; oy = r.top;
      dragging = true; moved = false;
      el.style.transition = 'none';
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false }); document.addEventListener('touchend', onUp);
    };
    const onMove = e => {
      if (!dragging) return; e.preventDefault();
      const t = e.touches ? e.touches[0] : e;
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      const nx = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, ox + dx));
      const ny = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, oy + dy));
      el.style.left = nx + 'px'; el.style.top = ny + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
    };
    const onUp = () => {
      dragging = false; el.style.transition = '';
      document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onUp);
      if (moved) {
        st.set(SK.POS, { left: el.style.left, top: el.style.top });
        const suppress = ev => { ev.stopPropagation(); ev.preventDefault(); };
        el.addEventListener('click', suppress, { capture: true, once: true });
      }
    };
    el.addEventListener('mousedown', onDown); el.addEventListener('touchstart', onDown, { passive: false });
    st.get(SK.POS).then(p => { if (p?.left) { el.style.left = p.left; el.style.top = p.top; el.style.right = 'auto'; el.style.bottom = 'auto'; } });
  }

  // ===================== DRAWER EVENTS =====================
  function bindDrawer() {
    const tog = document.getElementById('ua-aa'); tog.checked = autoApply;
    tog.addEventListener('change', async e => {
      autoApply = e.target.checked; await st.set(SK.AA, autoApply); updateStat();
      if (autoApply && detectATS()) {
        if (isWorkday()) workdayAutomation();
        else tailorFirstFlow();
      }
    });

    const drop = document.getElementById('ua-drop'), csv = document.getElementById('ua-csv');
    drop.addEventListener('click', () => csv.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    csv.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

    document.getElementById('ua-add').addEventListener('click', () => { const i = document.getElementById('ua-url'); if (i.value.trim()) { addJob(i.value.trim()); i.value = ''; } });
    document.getElementById('ua-url').addEventListener('keypress', e => { if (e.key === 'Enter') document.getElementById('ua-add').click(); });
    document.getElementById('ua-selall').addEventListener('change', e => { if (e.target.checked) queue.forEach(j => selected.add(j.id)); else selected.clear(); renderQ(); });
    document.getElementById('ua-del').addEventListener('click', removeSelected);
  }

  async function handleFile(f) { const u = parseCSV(await f.text()); if (!u.length) { alert('No valid URLs found.'); return; } for (const x of u) await addJob(x); document.getElementById('ua-drawer').classList.add('open'); positionDrawer(); }

  // ===================== RENDER =====================
  function renderQ() {
    const list = document.getElementById('ua-qlist'), cnt = document.getElementById('ua-q-cnt'), sum = document.getElementById('ua-qsum'), btns = document.getElementById('ua-qbtns'), badge = document.getElementById('ua-badge'), del = document.getElementById('ua-del'), sa = document.getElementById('ua-selall'), info = document.getElementById('ua-q-info');
    if (!list) return;
    cnt.textContent = `(${queue.length})`;
    badge.textContent = queue.length || '';
    info.textContent = queue.length ? queue.length + ' URL' + (queue.length > 1 ? 's' : '') : '';
    del.disabled = !selected.size;
    sa.checked = queue.length > 0 && selected.size === queue.length;

    list.innerHTML = queue.map((j, i) => `<div class="ua-qi"><input type="checkbox" data-id="${j.id}" class="qcb" ${selected.has(j.id) ? 'checked' : ''}><span class="num">${i + 1}</span><span class="url" title="${j.url}">${j.title || j.url}</span><span class="st ${j.status}">${j.status}</span><button class="rm" data-id="${j.id}">&times;</button></div>`).join('');

    list.querySelectorAll('.qcb').forEach(c => c.addEventListener('change', e => { if (e.target.checked) selected.add(e.target.dataset.id); else selected.delete(e.target.dataset.id); renderQ(); }));
    list.querySelectorAll('.rm').forEach(b => b.addEventListener('click', e => removeJob(e.currentTarget.dataset.id)));

    const pn = queue.filter(j => j.status === 'pending').length, dn = queue.filter(j => j.status === 'done').length, fl = queue.filter(j => j.status === 'failed').length, ap = queue.filter(j => j.status === 'applying').length;
    sum.innerHTML = queue.length ? `<span><i style="background:#f59e0b"></i>${pn} pending</span><span><i style="background:#3b82f6"></i>${ap} active</span><span><i style="background:#10b981"></i>${dn} done</span>${fl ? `<span><i style="background:#ef4444"></i>${fl} failed</span>` : ''}` : '';

    if (!queue.length) { btns.innerHTML = ''; return; }
    if (!qActive) { btns.innerHTML = `<button class="pri" id="uq-start" ${pn ? '' : 'disabled'}>Start Applying</button><button class="sec" id="uq-clear">Clear All</button>`; }
    else { btns.innerHTML = `<button class="dan" id="uq-stop">Stop</button>`; }
    document.getElementById('uq-start')?.addEventListener('click', startQ);
    document.getElementById('uq-stop')?.addEventListener('click', stopQ);
    document.getElementById('uq-clear')?.addEventListener('click', clearQ);
  }

  function updateCtrl() {
    const ctrl = document.getElementById('ua-ctrl');
    const prog = document.getElementById('uc-prog');
    const pauseBtn = document.getElementById('uc-pause');
    if (!ctrl) return;
    if (qActive) {
      ctrl.classList.add('show');
      const dn = queue.filter(j => j.status === 'done').length;
      prog.textContent = dn + '/' + queue.length;
      if (qPaused) { pauseBtn.innerHTML = ico('play', 14, 14, '#34d399'); pauseBtn.className = 'uc-btn resume'; pauseBtn.title = 'Resume'; }
      else { pauseBtn.innerHTML = ico('pause', 14, 14, '#fbbf24'); pauseBtn.className = 'uc-btn pause'; pauseBtn.title = 'Pause'; }
    } else { ctrl.classList.remove('show'); }
  }

  function updateStat() {
    const el = document.getElementById('ua-stat'), t = document.getElementById('ua-stat-t'); if (!el) return;
    const ats = detectATS();
    if (autoApply) { el.className = 'ua-stat on'; t.textContent = ats ? 'Active - ' + ats + ' detected' : 'Active - monitoring'; }
    else { el.className = 'ua-stat off'; t.textContent = 'Inactive'; }
  }

  function showATSBadge() { const a = detectATS(); if (a) { document.getElementById('ua-ats-n').textContent = a + ' Detected'; document.getElementById('ua-ats').classList.add('show'); } }

  // ===================== OBSERVER =====================
  function observe() { const o = new MutationObserver(() => hideCredits()); o.observe(document.body || document.documentElement, { childList: true, subtree: true }); }

  // ===================== INIT =====================
  async function init() {
    if (window.self !== window.top) return;
    await load(); await loadAnswerBank(); injectCSS(); buildUI();
    [500, 1500, 3000, 5000, 8000].forEach(ms => setTimeout(hideCredits, ms));
    // Periodically dismiss annoying popups (review, confirm, feedback)
    setInterval(dismissAllPopups, 3000);
    observe(); showATSBadge(); renderQ(); updateStat(); updateCtrl();

    // Listen for messages from background (CSV queue, PING)
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg?.type === 'TRIGGER_AUTOFILL') {
        LOG('Received TRIGGER_AUTOFILL from background');
        tailorFirstFlow();
        sendResponse({ ok: true });
      }
      if (msg?.type === 'PING') sendResponse({ pong: true });
    });

    const ats = detectATS();
    if (ats) {
      LOG(`ATS detected: ${ats}`);
      // Only auto-start when autoApply is ON or queue is actively processing
      if (autoApply || qActive) {
        // No delay — start immediately
        if (isWorkday()) await workdayAutomation();
        else await tailorFirstFlow();
      } else {
        LOG('Auto-apply is OFF — showing badge only. Toggle auto-apply to start.');
      }
    }
    if (qActive && !_abortQ) { processQ(); }
    if (isJobright()) { await sleep(2000); resumeTailoringAutomation(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
