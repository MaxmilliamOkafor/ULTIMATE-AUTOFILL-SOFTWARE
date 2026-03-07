// === ULTIMATE AUTOFILL ENHANCEMENT v9.0 ===
// Simplify+ integration, SpeedyApply Workday, LazyApply automation, review bypass, Ireland locale
(function () {
  'use strict';
  const LOG = (...a) => console.log('[UA]', ...a);

  // ===================== CREDIT BYPASS (Jobright + Simplify+ Unlimited) =====================
  const _C = {autofill:99999,tailorResume:99999,coverLetter:99999,resumeReview:99999,jobMatch:99999,agentApply:99999,resumeTailor:99999,customResume:99999,aiApply:99999,smartApply:99999,quickApply:99999,bulkApply:99999,networkScan:99999,referralRequest:99999,aiResponse:99999,essayAnswer:99999,coins:99999,tokens:99999};
  const _fetch = window.fetch;
  window.fetch = async function () {
    const u = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0]?.url || '');
    if (/\/swan\/credit\/balance|\/credit\/balance/i.test(u))
      return new Response(JSON.stringify({code:200,result:{credit:_C,dailyFill:_C},success:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if (/\/swan\/payment\/subscription|\/payment\/subscription/i.test(u))
      return new Response(JSON.stringify({code:200,result:{status:'ACTIVE',plan:'turbo_plus',subscriptionId:'unlimited',tier:'premium',features:['unlimited_autofill','unlimited_resume','unlimited_cover_letter','unlimited_ai_response','unlimited_network','unlimited_referral']},success:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if (/\/cost-credit/i.test(u))
      return new Response(JSON.stringify({code:200,result:false,success:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if (/\/swan\/credit\/free|\/credit\/free/i.test(u))
      return new Response(JSON.stringify({code:200,result:{dailyFill:_C,credit:_C},success:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if (/\/payment\/price/i.test(u))
      return new Response(JSON.stringify({code:200,result:{},success:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if (/resume.?tailor.*credit|tailor.*credit|resume.*credit|credit.*resume|credit.*tailor|cover.?letter.*credit/i.test(u))
      return new Response(JSON.stringify({code:200,result:{credit:99999,remaining:99999,limit:99999,used:0},success:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if (/\/usage\/limit|\/rate.?limit|\/quota/i.test(u))
      return new Response(JSON.stringify({code:200,result:{remaining:99999,limit:99999,used:0},success:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if (/\/feature.?flag|\/feature.?gate|\/entitlement/i.test(u))
      return new Response(JSON.stringify({code:200,result:{enabled:true,tier:'premium',plan:'turbo_plus',simplify_plus:true,unlimited:true},success:true}),{status:200,headers:{'Content-Type':'application/json'}});
    // Simplify+ bypass: coin/token balance, subscription, limits
    if (/\/api\/(coins?|tokens?|balance|credits?|subscription|plan|usage|limit)/i.test(u))
      return new Response(JSON.stringify({coins:99999,tokens:99999,balance:99999,credits:99999,plan:'plus',tier:'premium',status:'active',unlimited:true,remaining:99999,limit:99999,used:0,success:true}),{status:200,headers:{'Content-Type':'application/json'}});
    // Simplify+ bypass: resume generation, cover letter, AI response limits
    if (/\/(generate|create|tailor).*(resume|cover|letter|response|essay|network|referral)/i.test(u)) {
      try {
        const r = await _fetch.apply(window, arguments);
        if (r.status === 402 || r.status === 429 || r.status === 403)
          return new Response(JSON.stringify({success:true,result:{},remaining:99999}),{status:200,headers:{'Content-Type':'application/json'}});
        return r;
      } catch(e) { throw e; }
    }
    // Simplify+ bypass: paywall/upgrade prompts
    if (/\/(paywall|upgrade|pricing|checkout|subscribe)/i.test(u))
      return new Response(JSON.stringify({success:true,bypass:true,plan:'plus',tier:'premium'}),{status:200,headers:{'Content-Type':'application/json'}});
    try {
      const r = await _fetch.apply(window, arguments);
      if (r.status === 402 || r.status === 429) return new Response(JSON.stringify({code:200,result:{}}),{status:200,headers:{'Content-Type':'application/json'}});
      return r;
    } catch(e) { throw e; }
  };
  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) { this._ua_url = url; return _xhrOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function() {
    const url = this._ua_url || '';
    if (/credit\/balance|credit\/free|payment\/subscription|cost-credit|resume.*credit|tailor.*credit|coins?\/balance|tokens?\/balance|api\/(coins|tokens|balance|credits|usage|limit)/i.test(url)) {
      const s = this;
      Object.defineProperty(s,'responseText',{get:()=>JSON.stringify({code:200,result:{credit:_C,dailyFill:_C,remaining:99999,coins:99999,tokens:99999,balance:99999},success:true})});
      Object.defineProperty(s,'status',{get:()=>200});
      Object.defineProperty(s,'readyState',{get:()=>4});
      setTimeout(()=>{s.onreadystatechange?.();s.onload?.();},50);
      return;
    }
    return _xhrSend.apply(this, arguments);
  };

  // ===================== CONFIG =====================
  const SK = {AA:'ua_aa',Q:'ua_q',QA:'ua_qa',QP:'ua_qp',POS:'ua_pos',ANS:'ua_answers',PROF:'ua_profile'};
  const ATS = [
    {n:'Workday',p:/myworkdayjobs\.com|myworkdaysite\.com|workday\.com\/.*\/job/i},
    {n:'Greenhouse',p:/boards\.greenhouse\.io|greenhouse\.io.*\/jobs/i},
    {n:'Lever',p:/jobs\.lever\.co/i},{n:'SmartRecruiters',p:/jobs\.smartrecruiters\.com/i},
    {n:'iCIMS',p:/icims\.com/i},{n:'Taleo',p:/taleo\.net|oraclecloud\.com.*CandidateExperience/i},
    {n:'Ashby',p:/jobs\.ashbyhq\.com/i},{n:'BambooHR',p:/bamboohr\.com.*\/jobs/i},
    {n:'Oracle',p:/oraclecloud\.com.*recruit/i},{n:'LinkedIn',p:/linkedin\.com\/jobs\/(view|application)/i},
    {n:'Indeed',p:/indeed\.com.*(viewjob|apply)/i},{n:'UltiPro',p:/ultipro\.com/i},
    {n:'Jobvite',p:/jobs\.jobvite\.com/i},{n:'Breezy',p:/breezy\.hr|breezyhr\.com/i},
    {n:'Recruitee',p:/recruitee\.com\/o\//i},{n:'ADP',p:/adp\.com.*\/job|workforcenow\.adp/i},
    {n:'Rippling',p:/ats\.rippling\.com/i},{n:'Dover',p:/app\.dover\.com/i},
    {n:'Dayforce',p:/dayforce\.com.*candidateportal/i},{n:'SuccessFactors',p:/successfactors\.com/i},
    {n:'JazzHR',p:/app\.jazz\.co|applytojob\.com/i},{n:'Fountain',p:/fountain\.com.*\/apply/i},
    {n:'Pinpoint',p:/pinpointhq\.com/i},{n:'Comeet',p:/comeet\.com.*\/jobs/i},
    {n:'Personio',p:/personio\.de.*\/job/i},{n:'ZipRecruiter',p:/ziprecruiter\.com/i},
    {n:'Monster',p:/monster\.com.*job/i},{n:'Glassdoor',p:/glassdoor\.com.*job/i},
    {n:'Dice',p:/dice\.com.*job/i},{n:'Wellfound',p:/wellfound\.com.*\/jobs/i},
    {n:'Paylocity',p:/paylocity\.com.*Recruiting/i},{n:'Phenom',p:/phenom\.com.*\/jobs/i},
    {n:'Avature',p:/avature\.net.*careers/i},{n:'Workable',p:/apply\.workable\.com/i},
    {n:'ClearCompany',p:/clearcompany\.com.*careers/i},{n:'Paycom',p:/paycomonline\.net.*Recruiting/i},
    {n:'SAP',p:/sap\.com.*careers|jobs\.sap\.com/i},{n:'Ceridian',p:/ceridian\.com.*careers/i},
    {n:'Bullhorn',p:/bullhornstaffing\.com/i},{n:'iSolved',p:/isolved\.com.*careers/i},
    {n:'Loxo',p:/app\.loxo\.co/i},{n:'Hireology',p:/hireology\.com.*careers/i},
    {n:'ApplicantPro',p:/applicantpro\.com/i},{n:'GovernmentJobs',p:/governmentjobs\.com/i},
    {n:'USAJOBS',p:/usajobs\.gov/i},{n:'Handshake',p:/joinhandshake\.com.*jobs/i},
    {n:'AngelList',p:/angel\.co.*jobs|wellfound\.com.*jobs/i},
    // Simplify-supported ATS platforms
    {n:'Myworkday',p:/myworkday\.com/i},{n:'GreenhouseEmbed',p:/greenhouse\.io.*embed/i},
    {n:'LeverEmbed',p:/lever\.co.*\/apply/i},{n:'Eightfold',p:/eightfold\.ai.*careers/i},
    {n:'Gem',p:/gem\.com.*jobs/i},{n:'HireVue',p:/hirevue\.com/i},
    {n:'Cornerstone',p:/csod\.com.*careers|cornerstoneondemand/i},
    {n:'TeamTailor',p:/teamtailor\.com|career\..*\.com/i},
    {n:'Jobscore',p:/jobscore\.com/i},{n:'RecruitCRM',p:/recruitcrm\.io/i},
    {n:'TalentLyft',p:/talentlyft\.com/i},{n:'Homerun',p:/homerun\.co/i},
    {n:'Traffit',p:/traffit\.com/i},{n:'Manatal',p:/manatal\.com/i},
    // LazyApply-supported ATS platforms
    {n:'SimplyHired',p:/simplyhired\.com/i},{n:'CareerBuilder',p:/careerbuilder\.com/i},
    {n:'Foundit',p:/foundit\.in|iimjobs\.com/i},{n:'Seek',p:/seek\.com\.au/i},
    {n:'Naukri',p:/naukri\.com/i},{n:'Reed',p:/reed\.co\.uk/i},
    {n:'TotalJobs',p:/totaljobs\.com/i},{n:'Adzuna',p:/adzuna\.com/i},
    {n:'Jobsite',p:/jobsite\.co\.uk/i},{n:'CVLibrary',p:/cv-library\.co\.uk/i},
    // Generic career page patterns
    {n:'Career',p:/\/careers?\/?$|\/jobs?\/?$|\/apply\b|\/positions?\/?$|\/openings?\/?$/i}
  ];

  // ===================== STORAGE & STATE =====================
  const st={
    get:k=>new Promise(r=>chrome.storage.local.get(k,d=>r(d[k]))),
    set:(k,v)=>new Promise(r=>chrome.storage.local.set({[k]:v},r)),
    getMulti:keys=>new Promise(r=>chrome.storage.local.get(keys,d=>r(d)))
  };
  let queue=[],qActive=false,qPaused=false,autoApply=false,selected=new Set();
  async function load(){queue=(await st.get(SK.Q))||[];qActive=(await st.get(SK.QA))||false;qPaused=(await st.get(SK.QP))||false;autoApply=(await st.get(SK.AA))||false;}
  async function saveQ(){await st.set(SK.Q,queue);}

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
    const ohKeys = ['candidateDetails','userDetails','applicationDetails','questionAnswers','responses'];
    const ohData = await st.getMulti(ohKeys);
    for (const val of Object.values(ohData || {})) {
      if (!val) continue;
      try {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        collectEntries(parsed);
      } catch (_) {}
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
    authorized: 'Yes', sponsorship: 'No', relocation: 'Yes', remote: 'Yes',
    veteran: 'I am not a protected veteran', disability: 'I do not have a disability',
    gender: 'Prefer not to say', ethnicity: 'Prefer not to say', race: 'Prefer not to say',
    years: '5', salary: '80000', notice: '2 weeks', availability: 'Immediately',
    country: 'Ireland', phoneCountryCode: '+353', countryCode: 'IE',
    cover: 'I am excited to apply for this role. My background and skills make me an excellent candidate and I look forward to contributing to your team.',
    why: 'I admire the company culture and the opportunity to make a meaningful impact.',
    howHeard: 'LinkedIn',
  };

  async function getProfile() {
    let p = (await st.get(SK.PROF)) || {};
    // Also check OptimHire candidate data
    const ohData = await st.getMulti(['candidateDetails','userDetails']);
    try {
      const cd = typeof ohData.candidateDetails === 'string' ? JSON.parse(ohData.candidateDetails) : (ohData.candidateDetails || {});
      const ud = typeof ohData.userDetails === 'string' ? JSON.parse(ohData.userDetails) : (ohData.userDetails || {});
      p = {...ud, ...cd, ...p};
    } catch (_) {}
    return p;
  }

  // ===================== SMART VALUE GUESSER =====================
  function guessValue(label, p) {
    const l = (label || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
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
    if (/country/.test(l) && !/code|phone|dial/.test(l)) return p.country || DEFAULTS.country;
    if (/address|street/.test(l)) return p.address || '';
    if (/location|where.*(you|do you).*live/.test(l)) return p.city ? `${p.city}, ${p.state || ''}`.trim().replace(/,$/, '') : '';
    if (/linkedin/.test(l)) return p.linkedin_profile_url || p.linkedin || '';
    if (/github/.test(l)) return p.github_url || p.github || '';
    if (/website|portfolio|personal.?url/.test(l)) return p.website_url || p.website || '';
    if (/twitter|x\.com/.test(l)) return p.twitter_url || p.twitter || '';
    if (/university|school|college|alma.?mater/.test(l)) return p.school || p.university || '';
    if (/\bdegree\b|qualification/.test(l)) return p.degree || "Bachelor's";
    if (/major|field.?of.?study|concentration/.test(l)) return p.major || '';
    if (/gpa|grade.?point/.test(l)) return p.gpa || '';
    if (/graduation|grad.?date|grad.?year/.test(l)) return p.graduation_year || p.grad_year || '';
    if (/title|position|role|current.?title|job.?title/.test(l) && !/company/.test(l)) return p.current_title || p.title || '';
    if (/company|employer|org|current.?company/.test(l)) return p.current_company || p.company || '';
    if (/salary|compensation|pay|desired.?pay/.test(l)) return p.expected_salary || DEFAULTS.salary;
    if (/cover.?letter|motivation|additional.?info|message.?to/.test(l)) return p.cover_letter || DEFAULTS.cover;
    if (/summary|about.?(yourself|you|me)|bio|objective/.test(l)) return p.summary || p.cover_letter || DEFAULTS.cover;
    if (/why.*(compan|role|want|interest|position)/.test(l)) return DEFAULTS.why;
    if (/how.*hear|where.*(find|learn|discover)|source|referred/.test(l)) return DEFAULTS.howHeard;
    if (/years.*(exp|work)|exp.*years|total.*experience/.test(l)) return DEFAULTS.years;
    if (/availab|start.?date|notice|when.*start/.test(l)) return DEFAULTS.availability;
    if (/authoriz|eligible|work.*right|legal.*right/.test(l)) return DEFAULTS.authorized;
    if (/sponsor|visa|immigration|work.?permit/.test(l)) return DEFAULTS.sponsorship;
    if (/relocat|willing.*move/.test(l)) return DEFAULTS.relocation;
    if (/remote|work.*home|hybrid|on.?site/.test(l)) return DEFAULTS.remote;
    if (/veteran|military|armed.?forces/.test(l)) return DEFAULTS.veteran;
    if (/disabilit/.test(l)) return DEFAULTS.disability;
    if (/gender|sex\b|pronouns/.test(l)) return DEFAULTS.gender;
    if (/ethnic|race|racial|heritage/.test(l)) return DEFAULTS.ethnicity;
    if (/country.?code|phone.?code|dial.?code|calling.?code/.test(l)) return p.phoneCountryCode || DEFAULTS.phoneCountryCode;
    if (/nationality|citizenship/.test(l)) return p.nationality || p.country || DEFAULTS.country;
    if (/language|fluency|fluent/.test(l)) return p.languages || 'English';
    if (/certif|license|credential/.test(l)) return p.certifications || '';
    if (/commute|travel|willing.*travel/.test(l)) return 'Yes';
    if (/convicted|criminal|felony|background/.test(l)) return 'No';
    if (/drug.?test|screening/.test(l)) return 'Yes';
    if (/\bage\b|18.*years|over.*18|at.*least.*18/.test(l)) return 'Yes';
    if (/agree|acknowledge|certif|attest|confirm|consent/.test(l)) return 'Yes';
    if (/please.?specify|other.?please/.test(l)) return p.city || p.state || '';
    if (/hear.?about.*position|referral.?source/.test(l)) return DEFAULTS.howHeard;
    if (/earliest.?start|when.*available|join.?date/.test(l)) return DEFAULTS.availability;
    if (/current.?salary|previous.?salary|last.?salary/.test(l)) return p.current_salary || DEFAULTS.salary;
    if (/desired.?salary|expected.?compensation|salary.?expectation/.test(l)) return p.expected_salary || DEFAULTS.salary;
    if (/reason.*leav|why.*leav|motivation.*change/.test(l)) return 'Seeking new growth opportunities and challenges.';
    if (/strength|strong.?suit|best.?quality/.test(l)) return p.strengths || 'Strong problem-solving skills, effective communication, and attention to detail.';
    if (/weakness|area.*improve|development.?area/.test(l)) return p.weaknesses || 'I sometimes focus too much on details, but I have learned to balance thoroughness with efficiency.';
    if (/reference|referee/.test(l) && !/number|phone|email/.test(l)) return 'Available upon request';
    if (/security.?clearance/.test(l)) return p.security_clearance || 'None';
    if (/date.?of.?birth|dob|birth.?date/.test(l)) return p.dob || '';
    if (/social.?security|ssn/.test(l)) return ''; // Never auto-fill SSN
    if (/driver.?licen/.test(l)) return p.drivers_license || 'Yes';
    if (/shift|work.?schedule|flexible.?hours/.test(l)) return 'Yes';
    if (/overtime/.test(l)) return 'Yes';
    if (/clearance.?level/.test(l)) return p.clearance_level || '';
    return '';
  }

  function guessFieldValue(label, p, el) {
    return guessValue(label, p) || getLearnedAnswer(label, el) || '';
  }

  // ===================== DOM HELPERS =====================
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const $ = (sel, root) => (root || document).querySelector(sel);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

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

  function clickEl(el) { if (!el) return false; el.scrollIntoView?.({behavior:'smooth',block:'center'}); realClick(el); return true; }

  function waitFor(sel, ms, xpath) {
    return new Promise(res => {
      const f = () => xpath ? document.evaluate(sel, document, null, 9, null).singleNodeValue : document.querySelector(sel);
      const e = f(); if (e) { res(e); return; }
      const o = new MutationObserver(() => { const e = f(); if (e) { o.disconnect(); res(e); } });
      o.observe(document.body || document.documentElement, {childList:true,subtree:true});
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
    const container = el.closest('.form-group,.field,.question,[class*="Field"],[class*="Question"],[class*="form-row"],li,.form-item,.ant-form-item,.ant-row,[data-testid],[role="group"],.css-1wa3eu0-placeholder,.MuiFormControl-root,.MuiGrid-item,fieldset');
    if (container) {
      const lbl = container.querySelector('label,[class*="label"],[class*="Label"],legend,[class*="title"],[class*="prompt"]');
      if (lbl && lbl !== el) return lbl.textContent.trim();
    }
    // Also try previous sibling
    const prev = el.previousElementSibling;
    if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'DIV') && prev.textContent?.trim().length < 100) return prev.textContent.trim();
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
  async function addJob(url,title){if(!url||queue.some(j=>j.url===url))return;queue.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),url,title:title||shortUrl(url),status:'pending',addedAt:Date.now()});await saveQ();renderQ();updateCtrl();}
  async function removeJob(id){queue=queue.filter(j=>j.id!==id);selected.delete(id);await saveQ();renderQ();updateCtrl();}
  async function clearQ(){queue=[];selected.clear();await saveQ();renderQ();updateCtrl();}
  async function removeSelected(){queue=queue.filter(j=>!selected.has(j.id));selected.clear();await saveQ();renderQ();updateCtrl();}
  function shortUrl(u){try{const p=new URL(u);return p.hostname.replace('www.','')+p.pathname.slice(0,30);}catch{return u.slice(0,40);}}
  function parseCSV(t){const u=[];for(const l of t.split(/[\r\n]+/)){const s=l.trim();if(!s||/^(url|link|job|title|company)/i.test(s))continue;for(const c of s.split(/[,\t]/)){const v=c.trim().replace(/^["']|["']$/g,'');if(/^https?:\/\//i.test(v)){u.push(v);break;}}if(/^https?:\/\//i.test(s)&&!u.includes(s))u.push(s);}return[...new Set(u)];}

  // ===================== ATS =====================
  function detectATS(){for(const a of ATS)if(a.p.test(location.href))return a.n;return null;}
  function isWorkday(){return/myworkdayjobs\.com|myworkdaysite\.com|workday\.com\/.*\/job/i.test(location.href);}
  function isJobright(){return/jobright\.ai/i.test(location.hostname);}

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
          if (fb) { sel.value = fb.value; sel.dispatchEvent(new Event('change', {bubbles:true})); filled++; }
        }
        continue;
      }
      const opt = $$('option', sel).find(o => o.text.toLowerCase().includes(val.toLowerCase()));
      if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', {bubbles:true})); filled++; }
      else {
        // Try first valid option as fallback
        const opts = $$('option', sel).filter(o => o.value && o.index > 0);
        if (opts.length) { sel.value = opts[0].value; sel.dispatchEvent(new Event('change', {bubbles:true})); filled++; }
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
        return ['yes','true','1'].includes(t);
      });
      if (yes) { realClick(yes); filled++; }
    }

    // Required checkboxes
    $$('input[type=checkbox][required],input[type=checkbox][aria-required="true"]')
      .filter(el => isVisible(el) && !el.checked)
      .forEach(cb => { realClick(cb); filled++; });

    // Date fields — try to fill with reasonable defaults
    const dateInputs = $$('input[type=date]').filter(el => isVisible(el) && !el.value);
    for (const d of dateInputs) {
      const lbl = getLabel(d);
      const l = (lbl || '').toLowerCase();
      let val = '';
      if (/start|available|earliest|begin/.test(l)) {
        const today = new Date(); today.setDate(today.getDate() + 14);
        val = today.toISOString().split('T')[0];
      } else if (/grad|completion|end/.test(l)) {
        val = p.graduation_year ? `${p.graduation_year}-05-15` : '';
      } else if (/birth|dob/.test(l)) {
        val = p.dob || '';
      }
      if (val) { nativeSet(d, val); filled++; }
    }

    // Number fields (years of experience, salary, etc.)
    const numInputs = $$('input[type=number]').filter(el => isVisible(el) && !el.value);
    for (const n of numInputs) {
      const lbl = getLabel(n);
      const val = guessFieldValue(lbl, p, n);
      if (val && !isNaN(Number(val))) { nativeSet(n, val); filled++; }
    }

    // Contenteditable divs (rich text editors)
    const editables = $$('[contenteditable="true"]').filter(el => isVisible(el) && !el.textContent?.trim());
    for (const ed of editables) {
      const lbl = getLabel(ed) || ed.getAttribute('data-placeholder') || '';
      const val = guessFieldValue(lbl, p, ed);
      if (val) { ed.textContent = val; ed.dispatchEvent(new Event('input', {bubbles:true})); filled++; }
    }

    // Fix phone country code on every fallback fill pass
    await fixPhoneCountryCode();

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
    if (/\/thanks|\/thank.you|\/success|\/confirmation|\/submitted|\/done|\/complete|\/applied/i.test(href)) return true;
    const body = document.body?.innerText || '';
    if (/application submitted|thank you for applying|application received|we.ve received your|successfully submitted|application complete|thanks for applying|your application has been|application was submitted|you.ve applied|we have received|you.re all set|application is under review/i.test(body)) return true;
    if ($('#application_confirmation,.application-confirmation,.confirmation-text,.posting-confirmation,.success-message,.submission-confirmation')) return true;
    if ($('[data-automation-id="congratulationsMessage"],[data-automation-id="confirmationMessage"],[data-automation-id="applicationSubmittedPage"]')) return true;
    // Greenhouse specific
    if ($('#application_confirmation,#post_application_page,.application-submitted')) return true;
    // Lever specific
    if ($('.posting-confirmation,.application-complete')) return true;
    // iCIMS specific
    if ($('.iCIMS_ConfirmMessage,.iCIMS_SuccessMessage')) return true;
    // Generic success toast/alert
    if ($('[role="alert"],.alert-success,.toast-success')) {
      const alert = $('[role="alert"],.alert-success,.toast-success');
      if (alert && /submit|success|thank|received|complete/i.test(alert.textContent || '')) return true;
    }
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
      'button[type="submit"]','input[type="submit"]',
      'button[data-automation-id="submit"]','button[data-automation-id="submitButton"]',
      '#submit_app','.postings-btn-submit','button.application-submit',
      'button[data-qa="btn-submit"]','button[aria-label*="Submit" i]','button[aria-label*="Apply" i]',
      '[data-testid="submit-application"]','[data-testid="submit-button"]','[data-testid="apply-button"]',
      'button.btn-submit','#resumeSubmitForm',
      'div.form-group.submit-button button.btn.btn-primary',
      '.application-submit-button','#application-submit','[name="submit_app"]',
      'button[data-qa="submit-application"]',
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
      'button[aria-label*="Next" i]','button[aria-label*="Continue" i]',
      '[data-testid="next-step"]','[data-testid="continue"]',
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

  // ===================== TAILOR-FIRST AUTOMATION FLOW =====================
  // Step 1: Click "Generate Custom Resume" (in Jobright sidebar)
  // Step 2: Wait for tailoring to complete
  // Step 3: Click "Continue to Autofill" / continue button
  // Step 4: Click "Autofill" button
  // Step 5: Fallback fill missed fields
  // Step 6: Submit or Next

  async function tailorFirstFlow() {
    const ats = detectATS();
    if (!ats) return;
    LOG(`Tailor-first flow starting for ${ats}...`);

    // Wait for Jobright sidebar to load
    const sidebar = await waitFor('#jobright-helper-id', 15000);
    if (!sidebar) { LOG('Jobright sidebar not found — falling back to direct autofill'); await directAutofillFlow(); return; }
    await sleep(2000);

    // Step 1: Click "Generate Custom Resume" if available
    const tailorBtn = sidebar.querySelector('.application-dashboard-tailor-resume') ||
                       sidebar.querySelector('.external-job-generate-resume-button');
    if (tailorBtn && isVisible(tailorBtn)) {
      LOG('Step 1: Clicking Generate Custom Resume');
      realClick(tailorBtn);
      await sleep(3000);

      // Wait for tailoring to complete (watch for loading to finish)
      LOG('Waiting for resume tailoring to complete...');
      const maxWait = 120000; // 2 min max
      const start = Date.now();
      while (Date.now() - start < maxWait) {
        // Check if loading indicator is gone
        const loading = sidebar.querySelector('.tailor-resume-loading-linear-progress,.resume-loading-container,.spin-loading');
        if (!loading || !isVisible(loading)) {
          // Check if tailored resume is ready (button text changed or autofill button available)
          const autofillBtn = sidebar.querySelector('.auto-fill-button:not([disabled])');
          if (autofillBtn) { LOG('Tailoring complete — autofill button ready'); break; }
        }
        await sleep(2000);
      }
      await sleep(1500);
    } else {
      LOG('Step 1: No tailor button found — skipping to autofill');
    }

    // Step 2-3: Click "Continue to Autofill" / continue button if present
    const continueBtn = sidebar.querySelector('.continue-button:not(.continue-button-disabled)');
    if (continueBtn && isVisible(continueBtn)) {
      LOG('Step 2: Clicking Continue button');
      realClick(continueBtn);
      await sleep(2000);
    }

    // Step 4: Click the Autofill button
    LOG('Step 3: Triggering Autofill');
    await triggerAutofill();

    // Wait for Jobright autofill to complete (watch for "Filling" → "Autofill" text change)
    LOG('Waiting for Jobright autofill to complete...');
    await sleep(3000);
    const fillStart = Date.now();
    while (Date.now() - fillStart < 60000) {
      const afBtn = sidebar.querySelector('.auto-fill-button');
      if (afBtn) {
        const txt = afBtn.textContent?.trim().toLowerCase() || '';
        if (txt === 'autofill' || txt === '') break; // Done filling
      }
      await sleep(1500);
    }
    await sleep(2000);

    // Step 5: Try resume upload if needed
    await tryResumeUpload();

    // Step 6: Fallback fill to catch missed fields
    LOG('Step 4: Running fallback fill for missed fields');
    await fallbackFill();
    await sleep(1000);
    // Second pass
    await fallbackFill();
    await sleep(500);
    // Fix any validation errors
    await handleValidationErrors();
    await sleep(500);

    // Step 7: Auto submit or next
    LOG('Step 5: Auto-submit/next');
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
  }

  // ===================== MULTI-PAGE FORM LOOP =====================
  async function multiPageLoop() {
    const MAX_PAGES = 10;
    let prevPageHash = getPageHash();
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (checkSuccess()) { LOG('Success detected — stopping multi-page loop'); break; }
      LOG(`Multi-page: processing page ${page}`);

      // Wait for page content to change
      await sleep(2000);

      // Detect if page actually changed (URL hash, DOM content, or form fields)
      const newHash = getPageHash();
      if (page > 1 && newHash === prevPageHash) {
        LOG('Page did not change — waiting longer');
        await sleep(3000);
        if (getPageHash() === prevPageHash) {
          LOG('Still no change — stopping multi-page loop');
          break;
        }
      }
      prevPageHash = getPageHash();

      // Try Jobright autofill again
      await triggerAutofill();
      await sleep(3000);

      // Fallback fill — two passes + validation fix
      await fallbackFill();
      await sleep(1000);
      await fallbackFill();
      await sleep(500);
      await handleValidationErrors();
      await sleep(300);

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

  // Generate a hash of the current page state to detect page changes
  function getPageHash() {
    const fields = $$('input:not([type=hidden]),textarea,select').filter(isVisible);
    const labels = fields.map(f => getLabel(f)).join('|');
    return location.href + '::' + fields.length + '::' + labels.slice(0, 200);
  }

  // ===================== DIRECT AUTOFILL FLOW (no sidebar) =====================
  async function directAutofillFlow() {
    await triggerAutofill();
    await sleep(5000);
    await fixPhoneCountryCode();
    await fallbackFill();
    await sleep(1000);
    await fallbackFill();
    await sleep(1000);
    const result = await autoSubmitOrNext();
    if (result === 'next_page') { await sleep(3000); await multiPageLoop(); }
  }

  // ===================== ASHBY AUTOMATION (from LazyApply) =====================
  async function ashbyAutomation() {
    LOG('Ashby automation starting...');
    const form = await waitFor('form,.ashby-application-form,[data-testid="application-form"]', 10000);
    if (!form) { LOG('No Ashby form found'); await directAutofillFlow(); return; }
    await sleep(1500);
    await fixPhoneCountryCode();
    await tailorFirstFlow();
  }

  // ===================== BAMBOOHR AUTOMATION =====================
  async function bamboohrAutomation() {
    LOG('BambooHR automation starting...');
    const form = await waitFor('.RenderForm,form#applicationForm,.positionapply', 10000);
    if (!form) { LOG('No BambooHR form found'); await directAutofillFlow(); return; }
    await sleep(1500);
    await fixPhoneCountryCode();
    await tailorFirstFlow();
  }

  // ===================== PHONE COUNTRY CODE FIXER (Ireland +353) =====================
  async function fixPhoneCountryCode() {
    const p = await getProfile();
    const targetCountry = p.country || DEFAULTS.country;
    const targetCode = p.phoneCountryCode || DEFAULTS.phoneCountryCode;
    LOG(`Fixing phone country code to ${targetCountry} (${targetCode})`);

    // Strategy 1: Workday country dropdown (data-automation-id)
    const wdCountryBtn = $('button[data-automation-id="countryDropdown"]:not([disabled]), button[id="country--country"]:not([disabled])');
    if (wdCountryBtn) {
      const txt = (wdCountryBtn.textContent || '').toLowerCase();
      if (!txt.includes(targetCountry.toLowerCase()) && !txt.includes('ireland')) {
        await selectFromWorkdayDropdown(wdCountryBtn, targetCountry);
      }
    }

    // Strategy 2: Phone country code select dropdowns
    const countrySelects = $$('select').filter(el => {
      const lbl = getLabel(el);
      return /country.?code|phone.?code|dial.?code|calling.?code|country.*phone|phone.*country/i.test(lbl || el.name || el.id || el.className);
    });
    for (const sel of countrySelects) {
      const ieOpt = $$('option', sel).find(o =>
        /ireland|\+353|353|IE\b/i.test(o.text) || o.value === 'IE' || o.value === '+353' || o.value === '353'
      );
      if (ieOpt) {
        sel.value = ieOpt.value;
        sel.dispatchEvent(new Event('change', {bubbles:true}));
        LOG('Phone country code set to Ireland via select');
      }
    }

    // Strategy 3: Country flag/code button dropdowns (common in modern UIs)
    const codeButtons = $$('button,div[role="button"],.country-code-selector,.phone-country,.iti__selected-flag,[class*="country-code"],[class*="countryCode"],[class*="dial-code"],[class*="phone-prefix"]')
      .filter(el => isVisible(el) && /\+1|\+\d{1,3}|🇺🇸|flag/i.test(el.textContent + el.innerHTML));
    for (const btn of codeButtons) {
      if (btn.textContent?.includes('+353') || btn.innerHTML?.includes('🇮🇪')) continue; // Already Ireland
      realClick(btn);
      await sleep(500);
      // Look for Ireland in the opened dropdown
      const items = $$('li,div[role="option"],a,.iti__country,.country-option,[class*="option"],[class*="menu-item"]')
        .filter(el => isVisible(el) && /ireland|\+353|🇮🇪/i.test(el.textContent || ''));
      if (items.length) {
        realClick(items[0]);
        LOG('Phone country code set to Ireland via dropdown click');
        await sleep(300);
      }
    }

    // Strategy 4: intl-tel-input library (very common)
    const itiFlag = $('.iti__selected-flag,.iti__flag-container button');
    if (itiFlag && !itiFlag.querySelector('.iti__flag.iti__ie')) {
      realClick(itiFlag);
      await sleep(500);
      const ieItem = $('[data-country-code="ie"],.iti__country[data-country-code="ie"],li[data-dial-code="353"]');
      if (ieItem) { realClick(ieItem); LOG('Phone country code set to Ireland via intl-tel-input'); await sleep(300); }
    }
  }

  // Helper: select value from Workday popup dropdown
  async function selectFromWorkdayDropdown(btn, value) {
    realClick(btn);
    await sleep(600);
    const popup = $('[data-automation-widget="wd-popup"][data-automation-activepopup="true"]');
    if (!popup) return false;
    const items = $$('[data-automation-id="menuItem"],li[role="option"],li', popup);
    const match = items.find(i => i.textContent?.toLowerCase().includes(value.toLowerCase()));
    if (match) { realClick(match); await sleep(300); return true; }
    // Try search input within popup
    const searchInput = popup.querySelector('input[type="text"],input[type="search"]');
    if (searchInput) {
      nativeSet(searchInput, value);
      await sleep(500);
      const filtered = $$('[data-automation-id="menuItem"],li[role="option"],li', popup).filter(isVisible);
      if (filtered.length) { realClick(filtered[0]); await sleep(300); return true; }
    }
    return false;
  }

  // ===================== WORKDAY AUTOMATION (SpeedyApply-enhanced) =====================
  async function workdayAutomation() {
    LOG('Workday automation starting (SpeedyApply-enhanced)...');
    const p = await getProfile();

    // Phase 1: Navigate to application form
    let clicked = false;
    // Strategy 1: data-automation-id Apply button
    const applyBtnWd = $('[data-automation-id="applyButton"],[data-automation-id="jobAction-apply"]');
    if (applyBtnWd && isVisible(applyBtnWd)) { clickEl(applyBtnWd); clicked = true; await sleep(2000); }
    // Strategy 2: Text-based Apply button
    if (!clicked) {
      const allBtns = $$('a, button');
      for (const b of allBtns) { if (/^\s*(Apply|Apply Now|Apply for Job)\s*$/i.test(b.textContent) && isVisible(b)) { clickEl(b); clicked = true; await sleep(2000); break; } }
    }
    // Click Apply Manually (skip Easy Apply / external links)
    const am = await waitFor("//*[@data-automation-id='applyManually']", 8000, true);
    if (am) { await sleep(500); clickEl(am); await sleep(2000); }
    // Handle "Use My Last Application" — skip it for fresh fill
    const useLastApp = await findByText('button,a', /use my last application|autofill with/i, 3000);
    if (useLastApp) { LOG('Skipping "Use My Last Application"'); }

    // Handle sign-in/create account pages
    const signInBtn = $('[data-automation-id="signInSubmitButton"],[data-automation-id="createAccountSubmitButton"]');
    if (signInBtn && isVisible(signInBtn)) {
      LOG('Workday sign-in page detected — filling credentials');
      const emailInput = $('input[data-automation-id="email"]');
      if (emailInput && !emailInput.value) nativeSet(emailInput, p.email || '');
      await sleep(500);
    }

    // Wait for form page
    const fp = await waitFor("[data-automation-id='quickApplyPage'],[data-automation-id='applyFlowAutoFillPage'],[data-automation-id='contactInformationPage'],[data-automation-id='applyFlowMyInfoPage'],[data-automation-id='ApplyFlowPage'],[data-automation-id='applyFlowContainer'],[data-automation-id='applyFlowForm']", 10000);
    if (!fp) { LOG('Workday form page not found'); return; }
    await sleep(1000);

    // Phase 2: Workday-specific field filling (from SpeedyApply)
    await workdayFillName(p);
    await workdayFillContact(p);
    await workdayFillAddress(p);
    await workdayFillSource();
    await fixPhoneCountryCode();

    // Phase 3: Tailor-first flow for remaining fields
    await tailorFirstFlow();
  }

  // SpeedyApply-style Workday name fill
  async function workdayFillName(p) {
    const first = p.first_name || p.firstName || '';
    const last = p.last_name || p.lastName || '';
    if (!first && !last) return;
    // Legal name
    const fnInput = $('input[data-automation-id="legalNameSection_firstName"], #name--legalName--firstName');
    const lnInput = $('input[data-automation-id="legalNameSection_lastName"], #name--legalName--lastName');
    if (fnInput && !fnInput.value) { fnInput.focus(); nativeSet(fnInput, first); await sleep(100); }
    if (lnInput && !lnInput.value) { lnInput.focus(); nativeSet(lnInput, last); await sleep(100); }
    // Preferred name (if checkbox or section exists)
    const prefFn = $('input[data-automation-id="preferredNameSection_firstName"], #name--preferredName--firstName');
    const prefLn = $('input[data-automation-id="preferredNameSection_lastName"], #name--preferredName--lastName');
    if (prefFn && !prefFn.value) nativeSet(prefFn, p.preferred_name || first);
    if (prefLn && !prefLn.value) nativeSet(prefLn, last);
    LOG('Workday: name fields filled');
  }

  // SpeedyApply-style Workday contact fill
  async function workdayFillContact(p) {
    // Email
    const emailInput = $('input[data-automation-id="email"], input[name="emailAddress"]');
    if (emailInput && !emailInput.value) { nativeSet(emailInput, p.email || ''); await sleep(100); }
    // Phone device type → Mobile
    const phoneTypeBtn = $('button[data-automation-id="phone-device-type"]:not([disabled]), button[id="phoneNumber--phoneType"]:not([disabled])');
    if (phoneTypeBtn) {
      const typeTxt = (phoneTypeBtn.textContent || '').toLowerCase();
      if (!typeTxt.includes('mobile') && !typeTxt.includes('cell')) {
        await selectFromWorkdayDropdown(phoneTypeBtn, 'Mobile');
      }
    }
    // Phone number
    const phoneInput = $('input[data-automation-id="phone-number"], #phoneNumber--phoneNumber');
    if (phoneInput && !phoneInput.value) { nativeSet(phoneInput, p.phone || ''); await sleep(100); }
    // Country dropdown (set to Ireland/user country)
    const countryBtn = $('button[data-automation-id="countryDropdown"]:not([disabled]), button[id="country--country"]:not([disabled])');
    if (countryBtn) {
      const country = p.country || DEFAULTS.country;
      const txt = (countryBtn.textContent || '').toLowerCase();
      if (!txt.includes(country.toLowerCase())) {
        await selectFromWorkdayDropdown(countryBtn, country);
      }
    }
    LOG('Workday: contact fields filled');
  }

  // SpeedyApply-style Workday address fill
  async function workdayFillAddress(p) {
    const line1 = $('input[data-automation-id="addressSection_addressLine1"], #address--addressLine1');
    const line2 = $('input[data-automation-id="addressSection_addressLine2"], #address--addressLine2');
    const city = $('input[data-automation-id="addressSection_city"], #address--city');
    const postal = $('input[data-automation-id="addressSection_postalCode"], #address--postalCode');
    if (line1 && !line1.value) nativeSet(line1, p.address || '');
    if (line2 && !line2.value && p.address2) nativeSet(line2, p.address2);
    if (city && !city.value) nativeSet(city, p.city || '');
    if (postal && !postal.value) nativeSet(postal, p.postal_code || p.zip || '');
    // Country/region dropdown
    const regionBtn = $('button[data-automation-id="addressSection_countryRegion"]:not([disabled]), #address--countryRegion');
    if (regionBtn) {
      const state = p.state || p.county || '';
      if (state) await selectFromWorkdayDropdown(regionBtn, state);
    }
    LOG('Workday: address fields filled');
  }

  // Workday "How Did You Hear" source fill
  async function workdayFillSource() {
    const sourceBtn = $('button[data-automation-id="sourceDropdown"]:not([disabled]), button[id="source--source"]:not([disabled])');
    if (!sourceBtn) return;
    const txt = (sourceBtn.textContent || '').toLowerCase();
    if (txt && !txt.includes('select') && !txt.includes('choose')) return; // Already filled
    await selectFromWorkdayDropdown(sourceBtn, DEFAULTS.howHeard);
    // Also check formField-source prompt
    const sourcePrompt = $('[data-automation-id="formField-sourcePrompt"] input,[data-automation-id="formField-source"] input');
    if (sourcePrompt && !sourcePrompt.value) nativeSet(sourcePrompt, DEFAULTS.howHeard);
    LOG('Workday: source filled');
  }

  // ===================== GREENHOUSE AUTOMATION (SpeedyApply-enhanced) =====================
  async function greenhouseAutomation() {
    LOG('Greenhouse automation starting...');
    const p = await getProfile();
    const form = await waitFor('#application_form,#application,.application-form,.main-content form', 10000);
    if (!form) { LOG('No Greenhouse form found'); await directAutofillFlow(); return; }
    await sleep(1500);

    // Greenhouse-specific field selectors (from SpeedyApply)
    const ghFields = {
      '#first_name': p.first_name || p.firstName || '',
      '#last_name': p.last_name || p.lastName || '',
      '#email': p.email || '',
      '#phone': p.phone || '',
      '#auto_complete_input': p.city ? `${p.city}, ${p.state || p.county || ''}, ${p.country || DEFAULTS.country}`.replace(/,\s*,/g, ',').replace(/,\s*$/, '') : '',
    };
    for (const [sel, val] of Object.entries(ghFields)) {
      const el = $(sel);
      if (el && !el.value && val) { el.focus(); nativeSet(el, val); await sleep(80); }
    }

    await fixPhoneCountryCode();
    await tailorFirstFlow();
  }

  // ===================== LEVER AUTOMATION =====================
  async function leverAutomation() {
    LOG('Lever automation starting...');
    // Lever uses a simple form at /apply
    const applyLink = $('a.posting-btn-submit,a[data-qa="show-page-apply"],.apply-button a,.postings-btn-submit');
    if (applyLink && isVisible(applyLink) && !location.href.includes('/apply')) {
      LOG('Clicking Lever Apply button');
      realClick(applyLink);
      await sleep(3000);
    }
    // Wait for form
    const form = await waitFor('.application-form,#application-form,.postings-form,form[action*="apply"]', 10000);
    if (!form) { LOG('No Lever form found'); await directAutofillFlow(); return; }
    await sleep(1500);
    await fixPhoneCountryCode();
    await tailorFirstFlow();
  }

  // ===================== iCIMS AUTOMATION =====================
  async function icimsAutomation() {
    LOG('iCIMS automation starting...');
    // iCIMS often has an "Apply" link that opens a new page or iframe
    const applyBtn = $('a.iCIMS_MainLink[href*="apply"],a[title*="Apply"],a.header-apply-button,.iCIMS_ApplyLink,button.applyButton');
    if (applyBtn && isVisible(applyBtn)) {
      LOG('Clicking iCIMS Apply button');
      realClick(applyBtn);
      await sleep(4000);
    }
    // iCIMS can load in an iframe
    const iframe = $('iframe[src*="icims"],iframe[name*="icims"]');
    if (iframe) {
      LOG('iCIMS iframe detected — content script cannot access cross-origin iframe, proceeding with main page');
    }
    // Wait for form fields
    await waitFor('.iCIMS_InfoMsg_Job,.iCIMS_Forms_Region,form,.applicant-form', 8000);
    await sleep(1500);
    // iCIMS-specific fields (from SpeedyApply)
    const p = await getProfile();
    const icimsFields = {
      '#PersonProfileFields\\.Login': p.email || '',
      '#PersonProfileFields\\.LastName': p.last_name || p.lastName || '',
      '#PersonProfileFields\\.Email': p.email || '',
    };
    for (const [sel, val] of Object.entries(icimsFields)) {
      try { const el = $(sel); if (el && !el.value && val) nativeSet(el, val); } catch(_) {}
    }
    await fixPhoneCountryCode();
    await tailorFirstFlow();
  }

  // ===================== LINKEDIN EASY APPLY =====================
  async function linkedinEasyApply() {
    LOG('LinkedIn Easy Apply automation starting...');
    // Click the Easy Apply button if on a job listing
    const easyApplyBtn = await findByText('button', /easy apply/i, 5000);
    if (easyApplyBtn && isVisible(easyApplyBtn)) {
      LOG('Clicking Easy Apply button');
      realClick(easyApplyBtn);
      await sleep(2000);
    }
    // Wait for the modal form
    const modal = await waitFor('.jobs-easy-apply-modal,.jobs-easy-apply-content,[class*="easy-apply"],.artdeco-modal', 8000);
    if (!modal) { LOG('LinkedIn Easy Apply modal not found'); return; }
    await sleep(1500);

    // LinkedIn Easy Apply has multiple pages — loop through them
    const MAX_STEPS = 8;
    for (let step = 1; step <= MAX_STEPS; step++) {
      LOG(`LinkedIn Easy Apply: step ${step}`);
      await sleep(1000);

      // Fill visible fields
      const p = await getProfile();
      await loadAnswerBank();
      const fields = $$('input:not([type=hidden]):not([type=file]):not([type=submit]),textarea,select', modal)
        .filter(el => isVisible(el) && !hasFieldValue(el));
      for (const field of fields) {
        const lbl = getLabel(field);
        if (!lbl) continue;
        const val = guessFieldValue(lbl, p, field);
        if (!val) continue;
        if (field.tagName === 'SELECT') {
          const opt = $$('option', field).find(o => o.text.toLowerCase().includes(val.toLowerCase()));
          if (opt) { field.value = opt.value; field.dispatchEvent(new Event('change', {bubbles:true})); }
        } else {
          field.focus(); nativeSet(field, val);
        }
        await sleep(80);
      }

      // Check for required radio groups
      const radioGroups = {};
      $$('input[type=radio]', modal).filter(isVisible).forEach(r => { (radioGroups[r.name||r.id]||=[]).push(r); });
      for (const [, radios] of Object.entries(radioGroups)) {
        if (radios.some(r => r.checked)) continue;
        const lbl = getLabel(radios[0]);
        const guess = guessFieldValue(lbl, p, radios[0]);
        const match = radios.find(r => {
          const t = ($(`label[for="${CSS.escape(r.id)}"]`)?.textContent || r.value || '').toLowerCase();
          return guess && t.includes(guess.toLowerCase());
        });
        if (match) realClick(match);
        else {
          const yes = radios.find(r => /yes|true/i.test(r.value || $(`label[for="${CSS.escape(r.id)}"]`)?.textContent || ''));
          if (yes) realClick(yes);
        }
      }

      // Look for Next / Review / Submit
      const nextBtn = modal.querySelector('button[aria-label*="next" i],button[aria-label*="Continue" i],button[data-easy-apply-next-button]');
      const reviewBtn = modal.querySelector('button[aria-label*="Review" i]');
      const submitBtn = modal.querySelector('button[aria-label*="Submit" i],button[data-control-name="submit_unify"]');

      if (submitBtn && isVisible(submitBtn)) {
        LOG('LinkedIn: clicking Submit');
        await sleep(500);
        realClick(submitBtn);
        await sleep(2000);
        // Check for success
        const dismiss = modal.querySelector('button[aria-label*="Dismiss" i],button[data-control-name="close_artdeco_modal"]');
        if (dismiss) { LOG('LinkedIn: Application submitted successfully!'); realClick(dismiss); }
        return;
      }
      if (reviewBtn && isVisible(reviewBtn)) {
        LOG('LinkedIn: clicking Review');
        realClick(reviewBtn);
        await sleep(2000);
        continue;
      }
      if (nextBtn && isVisible(nextBtn)) {
        LOG('LinkedIn: clicking Next');
        realClick(nextBtn);
        await sleep(2000);
        continue;
      }

      // Fallback: text-based button search
      const allBtns = $$('button', modal).filter(isVisible);
      const txtBtn = allBtns.find(b => /^(submit|next|continue|review)\b/i.test((b.textContent||'').trim()));
      if (txtBtn) { realClick(txtBtn); await sleep(2000); continue; }

      LOG('LinkedIn: No next/submit button found — stopping');
      break;
    }
  }

  // ===================== RESUME/FILE UPLOAD AUTOMATION =====================
  async function tryResumeUpload() {
    // Look for file input fields (resume, cover letter)
    const fileInputs = $$('input[type="file"]').filter(el => {
      const lbl = getLabel(el);
      return /resume|cv|cover.?letter|document|upload/i.test(lbl || el.name || el.id || el.accept || '');
    });
    if (!fileInputs.length) return false;

    // Check if Jobright sidebar has a resume ready
    const sidebar = $('#jobright-helper-id');
    if (!sidebar) return false;

    // Look for "Download Resume" or similar button in sidebar
    const dlBtn = sidebar.querySelector('a[download],a[href*="resume"],button[class*="download"],.download-resume-button');
    if (dlBtn) {
      LOG('Found resume download button in Jobright sidebar — resume upload handled by sidebar');
      return true;
    }

    // Check for drag-and-drop upload zones
    const dropZones = $$('[class*="dropzone"],[class*="upload-area"],[class*="file-drop"],[class*="dz-clickable"],.upload-container,.file-upload-area')
      .filter(isVisible);
    if (dropZones.length) {
      LOG('Drop zones found — Jobright sidebar handles resume upload');
    }
    return false;
  }

  // ===================== FORM VALIDATION ERROR HANDLER =====================
  async function handleValidationErrors() {
    // Wait a moment for validation to trigger
    await sleep(500);
    const errors = $$('.error,.field-error,.error-message,.validation-error,[class*="error"],[class*="Error"],.invalid-feedback,.help-block.with-errors,.field-validation-error,[aria-invalid="true"],[data-error]')
      .filter(el => isVisible(el) && el.textContent?.trim());

    if (!errors.length) return 0;
    LOG(`Found ${errors.length} validation errors — attempting to fix`);

    let fixed = 0;
    const p = await getProfile();
    for (const errEl of errors) {
      // Find the associated input
      const container = errEl.closest('.form-group,.field,.question,[class*="Field"],[class*="Question"],li,.form-item,.ant-form-item,.MuiFormControl-root,fieldset,div');
      if (!container) continue;
      const inp = container.querySelector('input:not([type=hidden]):not([type=file]),textarea,select');
      if (!inp || hasFieldValue(inp)) continue;

      const lbl = getLabel(inp);
      const val = guessFieldValue(lbl, p, inp);
      if (!val) continue;

      if (inp.tagName === 'SELECT') {
        const opt = $$('option', inp).find(o => o.text.toLowerCase().includes(val.toLowerCase()));
        if (opt) { inp.value = opt.value; inp.dispatchEvent(new Event('change', {bubbles:true})); fixed++; }
      } else {
        inp.focus(); nativeSet(inp, val); fixed++;
      }
      await sleep(60);
    }

    // Also handle aria-invalid fields directly
    const invalidFields = $$('[aria-invalid="true"]').filter(el => isVisible(el) && !hasFieldValue(el));
    for (const inp of invalidFields) {
      const lbl = getLabel(inp);
      const val = guessFieldValue(lbl, p, inp);
      if (!val) continue;
      inp.focus(); nativeSet(inp, val); fixed++;
      await sleep(60);
    }

    LOG(`Fixed ${fixed} validation errors`);
    return fixed;
  }

  // ===================== ERROR RECOVERY & RETRY =====================
  async function withRetry(fn, label, maxRetries) {
    maxRetries = maxRetries || 2;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (err) {
        LOG(`${label} failed (attempt ${attempt}/${maxRetries + 1}):`, err?.message || err);
        if (attempt <= maxRetries) {
          await sleep(1000 * attempt); // Progressive backoff
          // Check for validation errors and try to fix them
          await handleValidationErrors();
        } else {
          throw err;
        }
      }
    }
  }

  // ===================== KEYBOARD SHORTCUTS =====================
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only when no input is focused
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (!e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'a': // Alt+A: Toggle auto-apply
          e.preventDefault();
          const tog = document.getElementById('ua-aa');
          if (tog) { tog.checked = !tog.checked; tog.dispatchEvent(new Event('change')); }
          break;
        case 'q': // Alt+Q: Toggle drawer
          e.preventDefault();
          const d = document.getElementById('ua-drawer');
          if (d) { d.classList.toggle('open'); positionDrawer(); }
          break;
        case 'f': // Alt+F: Run fallback fill
          e.preventDefault();
          LOG('Manual fallback fill triggered via Alt+F');
          fallbackFill();
          break;
        case 's': // Alt+S: Start/stop queue
          e.preventDefault();
          if (qActive) stopQ(); else startQ();
          break;
        case 'j': // Alt+J: Add current page to queue
          e.preventDefault();
          addJob(location.href, document.title);
          break;
        case 'p': // Alt+P: Pause/resume queue
          e.preventDefault();
          if (qPaused) resumeQ(); else if (qActive) pauseQ();
          break;
        case 'n': // Alt+N: Skip current job
          e.preventDefault();
          if (qActive) skipJob();
          break;
        case 'e': // Alt+E: Export queue to CSV
          e.preventDefault();
          exportQueueCSV();
          break;
      }
    });
  }

  // ===================== EXPORT QUEUE TO CSV =====================
  function exportQueueCSV() {
    if (!queue.length) { LOG('No jobs to export'); return; }
    const header = 'URL,Title,Status,Added\n';
    const rows = queue.map(j => {
      const url = j.url.replace(/"/g, '""');
      const title = (j.title || '').replace(/"/g, '""');
      const date = j.addedAt ? new Date(j.addedAt).toISOString() : '';
      return `"${url}","${title}","${j.status}","${date}"`;
    }).join('\n');
    const csv = header + rows;
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `job-queue-${new Date().toISOString().slice(0,10)}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    LOG(`Exported ${queue.length} jobs to CSV`);
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

  // ===================== AUTOFILL TRIGGER =====================
  async function triggerAutofill() {
    await waitFor('#jobright-helper-id', 8000);
    await sleep(1500);
    let b = $('.auto-fill-button');
    if (b && !b.disabled) { realClick(b); LOG('Autofill button clicked'); return true; }
    await sleep(3000);
    b = $('.auto-fill-button');
    if (b && !b.disabled) { realClick(b); LOG('Autofill button clicked (retry)'); return true; }
    LOG('Autofill button not found or disabled');
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
          // We're on the right page — run ATS-specific flow
          await withRetry(async () => {
            if (isWorkday()) await workdayAutomation();
            else if (/greenhouse\.io|boards\.greenhouse/i.test(location.href)) await greenhouseAutomation();
            else if (/lever\.co|jobs\.lever/i.test(location.href)) await leverAutomation();
            else if (/icims\.com/i.test(location.href)) await icimsAutomation();
            else if (/linkedin\.com.*\/jobs/i.test(location.href)) await linkedinEasyApply();
            else if (/ashbyhq\.com/i.test(location.href)) await ashbyAutomation();
            else if (/bamboohr\.com/i.test(location.href)) await bamboohrAutomation();
            else await tailorFirstFlow();
          }, 'Queue job automation');

          // Wait and check success — try multiple times
          let success = false;
          for (let check = 0; check < 3; check++) {
            await sleep(3000);
            if (checkSuccess()) { success = true; break; }
          }
          if (success) {
            c.status = 'done';
            LOG('Queue job completed successfully');
          } else {
            c.status = 'done'; // Assume done after full flow
            LOG('Queue job completed (success not confirmed)');
          }
          // Learn from the final page state
          await learnFromPage();
          await saveQ(); renderQ(); updateCtrl();
          await sleep(3000);
          goNext();
          return;
        }
      } catch {}
    }
    goNext();
  }
  // LazyApply-inspired: configurable delays between applications
  const QUEUE_DELAYS = {1:2000, 1.5:1500, 2:1000, 3:500};
  let qSpeed = 1; // 1x speed
  let qTimeout = 120000; // 2-min timeout per job (LazyApply uses similar)

  function goNext() {
    if (qPaused) return;
    const n = queue.find(j => j.status === 'pending');
    if (n) {
      n.status = 'applying';
      n.startedAt = Date.now();
      saveQ().then(() => {
        // LazyApply-style: delay between jobs to avoid rate limiting
        const delay = QUEUE_DELAYS[qSpeed] || 2000;
        setTimeout(() => { location.href = n.url; }, delay);
      });
    } else {
      qActive = false;
      st.set(SK.QA, false);
      // LazyApply-style: send automation complete notification
      LOG('Queue complete — all jobs processed');
      const done = queue.filter(j => j.status === 'done').length;
      const failed = queue.filter(j => j.status === 'failed').length;
      LOG(`Results: ${done} done, ${failed} failed out of ${queue.length} total`);
      renderQ(); updateCtrl();
    }
  }
  async function startQ() { if (!queue.filter(j => j.status === 'pending').length) return; qActive = true; qPaused = false; await st.set(SK.QA, true); await st.set(SK.QP, false); updateCtrl(); goNext(); }
  async function stopQ() { qActive = false; qPaused = false; await st.set(SK.QA, false); await st.set(SK.QP, false); queue.forEach(j => { if (j.status === 'applying') j.status = 'pending'; }); await saveQ(); renderQ(); updateCtrl(); }
  async function pauseQ() { qPaused = true; await st.set(SK.QP, true); renderQ(); updateCtrl(); }
  async function resumeQ() { qPaused = false; await st.set(SK.QP, false); processQ(); renderQ(); updateCtrl(); }
  async function skipJob() { const c = queue.find(j => j.status === 'applying'); if (c) { c.status = 'failed'; c.error = 'Skipped by user'; await saveQ(); } goNext(); }

  // LazyApply-inspired: bulk URL import from text (supports various formats)
  function parseBulkUrls(text) {
    const urls = [];
    // Split by lines, commas, tabs, spaces
    const tokens = text.split(/[\r\n,\t]+/).map(s => s.trim()).filter(Boolean);
    for (const token of tokens) {
      // Skip header rows
      if (/^(url|link|job|title|company|status|date|source)/i.test(token)) continue;
      // Extract URLs from mixed content
      const urlMatch = token.match(/https?:\/\/[^\s,"'<>]+/i);
      if (urlMatch) {
        const clean = urlMatch[0].replace(/[)"'>\]]+$/, ''); // Clean trailing chars
        if (!urls.includes(clean)) urls.push(clean);
      }
    }
    return urls;
  }

  // LazyApply-inspired: form analysis (check how many fields are on current page)
  function analyzeCurrentForm() {
    const fields = $$('input:not([type=hidden]):not([type=file]):not([type=submit]),textarea,select').filter(isVisible);
    const filled = fields.filter(hasFieldValue).length;
    const required = fields.filter(isFieldRequired).length;
    const requiredFilled = fields.filter(f => isFieldRequired(f) && hasFieldValue(f)).length;
    return { total: fields.length, filled, unfilled: fields.length - filled, required, requiredFilled, requiredUnfilled: required - requiredFilled };
  }

  // ===================== CREDIT HIDE =====================
  function hideCredits() {
    $$('.autofill-credit-row,.payment-entry,.plugin-setting-credits-tip').forEach(e => e.style.display = 'none');
    $$('.ant-modal-root').forEach(m => {
      const txt = m.textContent || '';
      // Hide credit/upgrade modals
      if (/remaining.*credit|upgrade.*turbo|out of credit|credits.*refill|get unlimited/i.test(txt)) m.style.display = 'none';
      // TASK 4: Hide review submission prompts (GoodReviewsModel, CriticizeReviewsModal, leave-review)
      if (/leave.*review|rate.*experience|how.*was.*your|review.*your.*experience|good.*review|criticize|feedback.*application|share.*experience/i.test(txt)) {
        LOG('Suppressing review prompt');
        m.style.display = 'none';
        // Also try clicking dismiss/close button
        const closeBtn = m.querySelector('.ant-modal-close,button[aria-label="Close" i],.close-button,[class*="close"],[class*="dismiss"]');
        if (closeBtn) realClick(closeBtn);
      }
    });
    // Hide review-related elements by class
    $$('.good-reviews-popup-text,.good-reviews-popup-title,.leave-review-button,.leave-review-text,[class*="GoodReviewsModel"],[class*="CriticizeReviewsModal"],[class*="review-popup"],[class*="review-modal"],[class*="feedback-modal"]')
      .forEach(e => e.style.display = 'none');
    // Replace credit text
    $$('*').forEach(el => { if (el.children.length === 0 && /\d+\s*credits?\s*available/i.test(el.textContent || '')) el.textContent = el.textContent.replace(/\d+\s*(credits?\s*available)/i, 'Unlimited $1'); });
    // Simplify+ coin/token bypass display
    $$('*').forEach(el => { if (el.children.length === 0 && /\d+\s*(coins?|tokens?)\s*(left|remaining|available)/i.test(el.textContent || '')) el.textContent = el.textContent.replace(/\d+(\s*(coins?|tokens?))/i, '∞$1'); });
  }

  // ===================== CSS =====================
  function injectCSS() {
    if (document.getElementById('ua-css')) return;
    const s = document.createElement('style'); s.id = 'ua-css';
    s.textContent = `
.autofill-credit-row,.autofill-credit-text,.autofill-credit-text-right,.payment-entry,.plugin-setting-credits-tip{display:none!important}
.ant-modal-root:has(.popup-modal-actions){display:none!important}
/* Hide review/feedback prompts after submission */
.ant-modal-root:has(.good-reviews-popup-text),.ant-modal-root:has(.good-reviews-popup-title),.ant-modal-root:has(.leave-review-button),.ant-modal-root:has(.leave-review-text),.ant-modal-root:has(.CriticizeReviewsModal),.ant-modal-root:has(.GoodReviewsModel){display:none!important}
[class*="review-popup"],[class*="review-modal"],[class*="feedback-modal"],[class*="good-reviews"],[class*="leave-review"]{display:none!important}
/* Hide Simplify paywall/upgrade prompts */
[class*="paywall"],[class*="upgrade-modal"],[class*="coin-required"],[class*="token-required"],[class*="premium-gate"]{display:none!important}

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
          <div id="ua-drop" class="ua-drop"><div class="ua-drop-t">Drop CSV or click to browse</div><div class="ua-drop-sub">.csv .txt .tsv — or paste multiple URLs</div><input type="file" id="ua-csv" class="ua-csv-in" accept=".csv,.txt,.tsv,.json"></div>
          <div class="ua-url-row"><input type="text" id="ua-url" class="ua-url-inp" placeholder="Paste job URL..."><button id="ua-add" class="ua-url-btn">Add</button></div>
        </div>
        <div class="ua-sec">
          <div class="ua-sec-t">Answer Bank <span id="ua-ans-cnt" style="color:#00c985"></span></div>
          <div style="display:flex;gap:6px;align-items:center">
            <span style="font-size:10px;color:#6b7280" id="ua-ans-info">Learned answers help fill forms faster</span>
            <button id="ua-ans-clear" style="font-size:9px;padding:3px 8px;border:1px solid #fca5a5;border-radius:6px;background:none;color:#ef4444;cursor:pointer;white-space:nowrap">Clear All</button>
          </div>
        </div>
        <div class="ua-sec">
          <div class="ua-sec-t">Profile <span id="ua-prof-status" style="color:#9ca3af">(click to edit)</span></div>
          <div id="ua-prof" style="display:none;padding:8px;background:#f9fafb;border-radius:8px;border:1px solid #f3f4f6">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px" id="ua-prof-fields"></div>
            <div style="display:flex;gap:6px"><button class="ua-url-btn" id="ua-prof-save" style="flex:1">Save Profile</button><button class="ua-url-btn" id="ua-prof-cancel" style="flex:1;background:#6b7280">Cancel</button></div>
          </div>
          <button id="ua-prof-toggle" style="width:100%;padding:8px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;color:#6b7280;text-align:left">Edit Profile (name, email, phone...)</button>
        </div>
        <div class="ua-sec">
          <div class="ua-sec-t">Queue <span id="ua-q-cnt" style="color:#00c985">(0)</span></div>
          <div class="ua-q-bar"><label><input type="checkbox" id="ua-selall">Select all</label><button class="del" id="ua-del" disabled>Delete selected</button><span class="info" id="ua-q-info"></span></div>
          <div class="ua-qlist" id="ua-qlist"></div>
          <div class="ua-qsum" id="ua-qsum"></div>
          <div class="ua-qbtns" id="ua-qbtns"></div>
          <button id="ua-export" style="width:100%;margin-top:6px;padding:6px;background:none;border:1px solid #e5e7eb;border-radius:6px;cursor:pointer;font-size:10px;font-weight:600;color:#6b7280">Export Queue to CSV</button>
        </div>
        <div class="ua-sec">
          <div class="ua-sec-t">Keyboard Shortcuts</div>
          <div style="font-size:10px;color:#6b7280;line-height:1.8">
            <div><kbd style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:9px;border:1px solid #e5e7eb">Alt+Q</kbd> Toggle panel</div>
            <div><kbd style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:9px;border:1px solid #e5e7eb">Alt+A</kbd> Auto-apply on/off</div>
            <div><kbd style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:9px;border:1px solid #e5e7eb">Alt+F</kbd> Fill form now</div>
            <div><kbd style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:9px;border:1px solid #e5e7eb">Alt+J</kbd> Add page to queue</div>
            <div><kbd style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:9px;border:1px solid #e5e7eb">Alt+S</kbd> Start/stop queue</div>
            <div><kbd style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:9px;border:1px solid #e5e7eb">Alt+E</kbd> Export CSV</div>
          </div>
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
      document.addEventListener('touchmove', onMove, {passive: false}); document.addEventListener('touchend', onUp);
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
        st.set(SK.POS, {left: el.style.left, top: el.style.top});
        const suppress = ev => { ev.stopPropagation(); ev.preventDefault(); };
        el.addEventListener('click', suppress, {capture: true, once: true});
      }
    };
    el.addEventListener('mousedown', onDown); el.addEventListener('touchstart', onDown, {passive: false});
    st.get(SK.POS).then(p => { if (p?.left) { el.style.left = p.left; el.style.top = p.top; el.style.right = 'auto'; el.style.bottom = 'auto'; } });
  }

  // ===================== DRAWER EVENTS =====================
  function bindDrawer() {
    const tog = document.getElementById('ua-aa'); tog.checked = autoApply;
    tog.addEventListener('change', async e => {
      autoApply = e.target.checked; await st.set(SK.AA, autoApply); updateStat();
      if (autoApply && detectATS()) {
        if (isWorkday()) workdayAutomation();
        else if (/greenhouse\.io|boards\.greenhouse/i.test(location.href)) greenhouseAutomation();
        else if (/lever\.co|jobs\.lever/i.test(location.href)) leverAutomation();
        else if (/icims\.com/i.test(location.href)) icimsAutomation();
        else if (/linkedin\.com.*\/jobs/i.test(location.href)) linkedinEasyApply();
        else if (/ashbyhq\.com/i.test(location.href)) ashbyAutomation();
        else if (/bamboohr\.com/i.test(location.href)) bamboohrAutomation();
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
    // LazyApply-style: support pasting multiple URLs at once
    document.getElementById('ua-url').addEventListener('paste', async e => {
      await sleep(50);
      const text = document.getElementById('ua-url').value;
      const urls = parseBulkUrls(text);
      if (urls.length > 1) {
        e.preventDefault();
        for (const u of urls) await addJob(u);
        document.getElementById('ua-url').value = '';
        LOG(`Bulk pasted ${urls.length} URLs`);
      }
    });
    document.getElementById('ua-selall').addEventListener('change', e => { if (e.target.checked) queue.forEach(j => selected.add(j.id)); else selected.clear(); renderQ(); });
    document.getElementById('ua-export')?.addEventListener('click', exportQueueCSV);
    document.getElementById('ua-del').addEventListener('click', removeSelected);

    // Answer bank
    const ansCnt = document.getElementById('ua-ans-cnt');
    const ansInfo = document.getElementById('ua-ans-info');
    if (ansCnt) ansCnt.textContent = `(${Object.keys(_answerBank).length} answers)`;
    document.getElementById('ua-ans-clear')?.addEventListener('click', async () => {
      if (confirm('Clear all learned answers?')) {
        _answerBank = {}; _answerBankLoaded = false;
        await st.set(SK.ANS, {});
        ansCnt.textContent = '(0 answers)';
        ansInfo.textContent = 'Cleared!';
        setTimeout(() => { ansInfo.textContent = 'Learned answers help fill forms faster'; }, 2000);
      }
    });

    // Profile editor
    const profFields = [
      {k:'first_name',l:'First Name'},{k:'last_name',l:'Last Name'},{k:'email',l:'Email'},{k:'phone',l:'Phone'},
      {k:'phoneCountryCode',l:'Phone Code (+353)'},{k:'city',l:'City'},{k:'state',l:'State/County'},{k:'postal_code',l:'Eircode/Zip'},
      {k:'country',l:'Country'},{k:'address',l:'Address'},{k:'linkedin',l:'LinkedIn URL'},{k:'github',l:'GitHub URL'},
      {k:'website',l:'Website'},{k:'school',l:'School/University'},{k:'degree',l:'Degree'},{k:'major',l:'Major'},
      {k:'graduation_year',l:'Grad Year'},{k:'current_title',l:'Job Title'},{k:'current_company',l:'Company'},
      {k:'expected_salary',l:'Expected Salary'},{k:'years',l:'Years Experience'},{k:'nationality',l:'Nationality'},
    ];
    const profContainer = document.getElementById('ua-prof-fields');
    const profPanel = document.getElementById('ua-prof');
    const profToggle = document.getElementById('ua-prof-toggle');
    const profStatus = document.getElementById('ua-prof-status');

    profToggle.addEventListener('click', async () => {
      if (profPanel.style.display === 'none') {
        profPanel.style.display = 'block'; profToggle.style.display = 'none';
        const p = await getProfile();
        profContainer.innerHTML = profFields.map(f => `<div><label style="font-size:9px;color:#6b7280;display:block;margin-bottom:2px">${f.l}</label><input type="text" data-pk="${f.k}" value="${(p[f.k]||'').replace(/"/g,'&quot;')}" style="width:100%;padding:5px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;box-sizing:border-box"></div>`).join('');
      }
    });
    document.getElementById('ua-prof-save')?.addEventListener('click', async () => {
      const p = await getProfile();
      profContainer.querySelectorAll('input[data-pk]').forEach(inp => { p[inp.dataset.pk] = inp.value.trim(); });
      await st.set(SK.PROF, p);
      profPanel.style.display = 'none'; profToggle.style.display = 'block';
      profStatus.textContent = '(saved)'; profStatus.style.color = '#059669';
      setTimeout(() => { profStatus.textContent = '(click to edit)'; profStatus.style.color = '#9ca3af'; }, 2000);
      LOG('Profile saved', p);
    });
    document.getElementById('ua-prof-cancel')?.addEventListener('click', () => {
      profPanel.style.display = 'none'; profToggle.style.display = 'block';
    });
  }

  async function handleFile(f) {
    const text = await f.text();
    // Use both parsers for maximum compatibility (LazyApply-enhanced)
    const u1 = parseCSV(text);
    const u2 = parseBulkUrls(text);
    const u = [...new Set([...u1, ...u2])];
    if (!u.length) { alert('No valid URLs found.'); return; }
    LOG(`Imported ${u.length} URLs from file`);
    for (const x of u) await addJob(x);
    document.getElementById('ua-drawer').classList.add('open'); positionDrawer();
  }

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
  function observe() { const o = new MutationObserver(() => hideCredits()); o.observe(document.body || document.documentElement, {childList: true, subtree: true}); }

  // ===================== INIT =====================
  async function init() {
    if (window.self !== window.top) return;
    await load(); await loadAnswerBank(); injectCSS(); buildUI(); setupKeyboardShortcuts();
    [500, 1500, 3000, 5000, 8000, 12000].forEach(ms => setTimeout(hideCredits, ms));
    observe(); showATSBadge(); renderQ(); updateStat(); updateCtrl();
    // Update answer bank count in UI
    const ansCntEl = document.getElementById('ua-ans-cnt');
    if (ansCntEl) ansCntEl.textContent = `(${Object.keys(_answerBank).length} answers)`;

    const ats = detectATS();
    if (ats) {
      LOG(`ATS detected: ${ats}`);
      // Auto-start ATS-specific flow when detected and auto-apply is on
      if (autoApply) {
        await sleep(2000);
        if (isWorkday()) await workdayAutomation();
        else if (/greenhouse\.io|boards\.greenhouse/i.test(location.href)) await greenhouseAutomation();
        else if (/lever\.co|jobs\.lever/i.test(location.href)) await leverAutomation();
        else if (/icims\.com/i.test(location.href)) await icimsAutomation();
        else if (/linkedin\.com.*\/jobs/i.test(location.href)) await linkedinEasyApply();
        else await tailorFirstFlow();
      }
    }
    if (qActive) { await sleep(2000); processQ(); }
    if (isJobright()) { await sleep(2000); resumeTailoringAutomation(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
