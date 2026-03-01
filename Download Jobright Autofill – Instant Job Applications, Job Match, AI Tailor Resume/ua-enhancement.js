// === ULTIMATE AUTOFILL ENHANCEMENT v4.0 ===
// Workday automation, resume tailoring, unlimited credits, professional UI, queue controls
(function () {
  'use strict';

  // ===================== CREDIT BYPASS =====================
  const _C = {autofill:99999,tailorResume:99999,coverLetter:99999,resumeReview:99999,jobMatch:99999,agentApply:99999,resumeTailor:99999,customResume:99999};
  const _fetch = window.fetch;
  window.fetch = async function () {
    const u = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0]?.url || '');
    if (/\/swan\/credit\/balance|\/credit\/balance/i.test(u))
      return new Response(JSON.stringify({code:200,result:{credit:_C,dailyFill:_C},success:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if (/\/swan\/payment\/subscription|\/payment\/subscription/i.test(u))
      return new Response(JSON.stringify({code:200,result:{status:'ACTIVE',plan:'turbo',subscriptionId:'unlimited'},success:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if (/\/cost-credit/i.test(u))
      return new Response(JSON.stringify({code:200,result:false,success:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if (/\/swan\/credit\/free|\/credit\/free/i.test(u))
      return new Response(JSON.stringify({code:200,result:{dailyFill:_C,credit:_C},success:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if (/\/payment\/price/i.test(u))
      return new Response(JSON.stringify({code:200,result:{},success:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if (/resume.?tailor.*credit|tailor.*credit|resume.*credit|credit.*resume|credit.*tailor/i.test(u))
      return new Response(JSON.stringify({code:200,result:{credit:99999,remaining:99999,limit:99999,used:0},success:true}),{status:200,headers:{'Content-Type':'application/json'}});
    try {
      const r = await _fetch.apply(window, arguments);
      if (r.status === 402) return new Response(JSON.stringify({code:200,result:{}}),{status:200,headers:{'Content-Type':'application/json'}});
      return r;
    } catch(e) { throw e; }
  };

  // Also intercept XMLHttpRequest for website credit checks
  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._ua_url = url;
    return _xhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    const url = this._ua_url || '';
    if (/credit\/balance|credit\/free|payment\/subscription|cost-credit|resume.*credit|tailor.*credit/i.test(url)) {
      const self = this;
      Object.defineProperty(self, 'responseText', { get: () => JSON.stringify({code:200,result:{credit:_C,dailyFill:_C,remaining:99999,limit:99999},success:true}) });
      Object.defineProperty(self, 'status', { get: () => 200 });
      Object.defineProperty(self, 'readyState', { get: () => 4 });
      setTimeout(() => { self.onreadystatechange?.(); self.onload?.(); }, 50);
      return;
    }
    return _xhrSend.apply(this, arguments);
  };

  // ===================== CONFIG =====================
  const SK = { AUTO_APPLY:'ua_aa', QUEUE:'ua_q', Q_ACTIVE:'ua_qa', Q_PAUSED:'ua_qp' };
  const ATS = [
    {n:'Workday',p:/myworkdayjobs\.com|myworkdaysite\.com|workday\.com\/.*\/job/i},
    {n:'Greenhouse',p:/boards\.greenhouse\.io|greenhouse\.io.*\/jobs/i},
    {n:'Lever',p:/jobs\.lever\.co/i},
    {n:'SmartRecruiters',p:/jobs\.smartrecruiters\.com/i},
    {n:'iCIMS',p:/icims\.com/i},
    {n:'Taleo',p:/taleo\.net|oraclecloud\.com.*CandidateExperience/i},
    {n:'Ashby',p:/jobs\.ashbyhq\.com/i},
    {n:'BambooHR',p:/bamboohr\.com.*\/jobs/i},
    {n:'Oracle',p:/oraclecloud\.com.*recruit/i},
    {n:'LinkedIn',p:/linkedin\.com\/jobs\/(view|application)/i},
    {n:'Indeed',p:/indeed\.com.*(viewjob|apply)/i},
    {n:'UltiPro',p:/ultipro\.com/i},
    {n:'Jobvite',p:/jobs\.jobvite\.com/i},
    {n:'Breezy',p:/breezy\.hr|breezyhr\.com/i},
    {n:'Recruitee',p:/recruitee\.com\/o\//i},
    {n:'ADP',p:/adp\.com.*\/job|workforcenow\.adp/i},
    {n:'Rippling',p:/ats\.rippling\.com/i},
    {n:'Dover',p:/app\.dover\.com/i},
    {n:'Dayforce',p:/dayforce\.com.*candidateportal/i},
    {n:'SuccessFactors',p:/successfactors\.com/i},
    {n:'JazzHR',p:/app\.jazz\.co|applytojob\.com/i},
    {n:'Fountain',p:/fountain\.com.*\/apply/i},
    {n:'Pinpoint',p:/pinpointhq\.com/i},
    {n:'Comeet',p:/comeet\.com.*\/jobs/i},
    {n:'Personio',p:/personio\.de.*\/job/i},
    {n:'ZipRecruiter',p:/ziprecruiter\.com/i},
    {n:'Monster',p:/monster\.com.*job/i},
    {n:'Glassdoor',p:/glassdoor\.com.*job/i},
    {n:'Dice',p:/dice\.com.*job/i},
    {n:'Wellfound',p:/wellfound\.com.*\/jobs/i},
    {n:'Paylocity',p:/paylocity\.com.*Recruiting/i},
    {n:'Phenom',p:/phenom\.com.*\/jobs/i},
    {n:'Avature',p:/avature\.net.*careers/i},
    {n:'Career',p:/\/careers?\/?$|\/jobs?\/?$|\/apply\b|\/positions?\//i}
  ];

  // ===================== STORAGE =====================
  const st = {
    get: k => new Promise(r => chrome.storage.local.get(k, d => r(d[k]))),
    set: (k, v) => new Promise(r => chrome.storage.local.set({[k]:v}, r))
  };

  // ===================== STATE =====================
  let queue = [], qActive = false, qPaused = false, autoApply = false, selected = new Set();

  async function load() {
    queue = (await st.get(SK.QUEUE)) || [];
    qActive = (await st.get(SK.Q_ACTIVE)) || false;
    qPaused = (await st.get(SK.Q_PAUSED)) || false;
    autoApply = (await st.get(SK.AUTO_APPLY)) || false;
  }
  async function saveQ() { await st.set(SK.QUEUE, queue); }

  // ===================== QUEUE OPS =====================
  async function addJob(url, title) {
    if (!url || queue.some(j => j.url === url)) return;
    queue.push({ id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), url, title: title||shortUrl(url), status:'pending', addedAt:Date.now() });
    await saveQ(); renderQ();
  }
  async function removeJob(id) { queue = queue.filter(j => j.id !== id); selected.delete(id); await saveQ(); renderQ(); }
  async function clearQ() { queue = []; selected.clear(); await saveQ(); renderQ(); }
  async function removeSelected() {
    queue = queue.filter(j => !selected.has(j.id)); selected.clear(); await saveQ(); renderQ();
  }
  function shortUrl(u) { try { const p = new URL(u); return p.hostname.replace('www.','')+p.pathname.slice(0,35); } catch { return u.slice(0,45); } }

  function parseCSV(text) {
    const urls = [];
    for (const line of text.split(/[\r\n]+/)) {
      const t = line.trim();
      if (!t || /^(url|link|job|title|company)/i.test(t)) continue;
      for (const col of t.split(/[,\t]/)) {
        const c = col.trim().replace(/^["']|["']$/g, '');
        if (/^https?:\/\//i.test(c)) { urls.push(c); break; }
      }
      if (/^https?:\/\//i.test(t) && !urls.includes(t)) urls.push(t);
    }
    return [...new Set(urls)];
  }

  // ===================== ATS DETECT =====================
  function detectATS() { const u = location.href; for (const a of ATS) if (a.p.test(u)) return a.n; return null; }
  function isWorkday() { return /myworkdayjobs\.com|myworkdaysite\.com/i.test(location.href); }
  function isJobright() { return /jobright\.ai/i.test(location.hostname); }
  function isAppForm() {
    if (detectATS()) return true;
    const s = ['input[name*="resume" i]','input[type="file"][accept*=".pdf"]','form[action*="apply" i]','[data-testid*="apply" i]','.application-form','#application-form'];
    for (const x of s) { try { if (document.querySelector(x)) return true; } catch {} }
    return false;
  }

  // ===================== HELPERS =====================
  function waitFor(sel, ms, useXPath) {
    return new Promise(resolve => {
      const find = () => useXPath
        ? document.evaluate(sel,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue
        : document.querySelector(sel);
      const el = find();
      if (el) { resolve(el); return; }
      const obs = new MutationObserver(() => { const e = find(); if (e) { obs.disconnect(); resolve(e); } });
      obs.observe(document.body || document.documentElement, { childList:true, subtree:true });
      setTimeout(() => { obs.disconnect(); resolve(null); }, ms || 10000);
    });
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function clickEl(el) { if (!el) return false; el.scrollIntoView?.({behavior:'smooth',block:'center'}); el.click(); return true; }

  // ===================== WORKDAY AUTOMATION =====================
  async function workdayAutomation() {
    console.log('[UA] Workday automation starting...');

    // Step 1: Click "Apply" button on job listing page
    const applyBtn = await waitFor(
      'a[data-automation-id="jobPostingApplyButton"], button[data-automation-id="jobPostingApplyButton"], a[href*="/apply"], button:has(> span)', 5000
    );
    if (applyBtn) {
      // Check for text-based Apply button
      const allBtns = document.querySelectorAll('a, button');
      for (const b of allBtns) {
        if (/^\s*Apply\s*$/i.test(b.textContent) && b.offsetParent !== null) {
          console.log('[UA] Clicking Apply button...');
          clickEl(b);
          await sleep(2000);
          break;
        }
      }
    }

    // Step 2: Click "Apply Manually" button
    const applyManually = await waitFor("//*[@data-automation-id='applyManually']", 8000, true);
    if (applyManually) {
      console.log('[UA] Clicking Apply Manually...');
      await sleep(500);
      clickEl(applyManually);
      await sleep(2000);
    }

    // Step 3: Wait for application form and trigger Jobright autofill
    const formPage = await waitFor(
      "[data-automation-id='quickApplyPage'], [data-automation-id='applyFlowAutoFillPage'], [data-automation-id='contactInformationPage'], [data-automation-id='applyFlowMyInfoPage'], [data-automation-id='ApplyFlowPage']",
      10000
    );
    if (formPage) {
      console.log('[UA] Workday form detected, triggering autofill...');
      await sleep(1000);
      await triggerAutofill();

      // Step 4: Auto-click Next buttons through pages
      workdayAutoNext();
    }
  }

  async function workdayAutoNext() {
    const nextSel = "button[data-automation-id='bottom-navigation-next-button']:not([disabled]), button[data-automation-id='pageFooterNextButton']:not([disabled])";
    const check = async () => {
      await sleep(3000);
      const nextBtn = document.querySelector(nextSel);
      if (nextBtn) {
        console.log('[UA] Clicking Next...');
        clickEl(nextBtn);
        // Wait and check for review page or more pages
        await sleep(2000);
        const review = document.querySelector("[data-automation-id='reviewJobApplicationPage'], [data-automation-id='applyFlowReviewPage']");
        if (review) {
          console.log('[UA] Review page reached');
          return;
        }
        // Trigger autofill on new page
        await triggerAutofill();
        check();
      }
    };
    check();
  }

  // ===================== RESUME TAILORING AUTOMATION =====================
  async function resumeTailoringAutomation() {
    if (!isJobright()) return;
    if (!location.href.includes('plugin_tailor=1') && !location.href.includes('/jobs/info/')) return;

    console.log('[UA] Resume tailoring page detected...');
    await sleep(3000);

    // Click "Improve My Resume for This Job"
    const improveBtn = await findByText('button, a, div[role="button"]', /improve my resume/i, 8000);
    if (improveBtn) {
      console.log('[UA] Clicking Improve My Resume...');
      clickEl(improveBtn);
      await sleep(2000);
    }

    // Click "Full Edit"
    const fullEdit = await findByText('button, a, div[role="button"], label, span', /full edit/i, 5000);
    if (fullEdit) {
      console.log('[UA] Clicking Full Edit...');
      clickEl(fullEdit);
      await sleep(3000);
    }

    // Click "Select all" for missing keywords
    const selectAll = await findByText('button, a, span, div[role="button"], label', /select all/i, 5000);
    if (selectAll) {
      console.log('[UA] Clicking Select All keywords...');
      clickEl(selectAll);
      await sleep(1000);
    }

    // Click "Generate My New Resume" or "Generate"
    const generateBtn = await findByText('button, a, div[role="button"]', /generate (my new )?resume|generate$/i, 5000);
    if (generateBtn) {
      console.log('[UA] Clicking Generate...');
      clickEl(generateBtn);
    }
  }

  async function findByText(selector, regex, timeout) {
    const deadline = Date.now() + (timeout || 5000);
    while (Date.now() < deadline) {
      const els = document.querySelectorAll(selector);
      for (const el of els) {
        if (regex.test(el.textContent?.trim()) && el.offsetParent !== null) return el;
      }
      await sleep(500);
    }
    return null;
  }

  // ===================== AUTOFILL TRIGGER =====================
  async function triggerAutofill() {
    await waitFor('#jobright-helper-id', 8000);
    await sleep(1500);
    let btn = document.querySelector('.auto-fill-button');
    if (btn && !btn.disabled) { console.log('[UA] Triggering autofill...'); btn.click(); return true; }
    await sleep(3000);
    btn = document.querySelector('.auto-fill-button');
    if (btn && !btn.disabled) { console.log('[UA] Triggering autofill (retry)...'); btn.click(); return true; }
    return false;
  }

  // ===================== QUEUE ENGINE =====================
  async function processQ() {
    if (!qActive || qPaused || queue.length === 0) return;
    const cur = queue.find(j => j.status === 'applying');
    if (cur) {
      try {
        const p = new URL(cur.url).pathname;
        if (location.href.includes(p.slice(0, Math.min(p.length, 25)))) {
          if (isWorkday()) { await workdayAutomation(); }
          else { await triggerAutofill(); }
          cur.status = 'done';
          await saveQ(); renderQ();
          await sleep(10000);
          goNext();
          return;
        }
      } catch {}
    }
    goNext();
  }

  function goNext() {
    if (qPaused) return;
    const next = queue.find(j => j.status === 'pending');
    if (next) { next.status = 'applying'; saveQ().then(() => { location.href = next.url; }); }
    else { qActive = false; st.set(SK.Q_ACTIVE, false); renderQ(); }
  }

  async function startQ() {
    if (queue.filter(j => j.status === 'pending').length === 0) return;
    qActive = true; qPaused = false;
    await st.set(SK.Q_ACTIVE, true); await st.set(SK.Q_PAUSED, false);
    goNext();
  }
  async function stopQ() {
    qActive = false; qPaused = false;
    await st.set(SK.Q_ACTIVE, false); await st.set(SK.Q_PAUSED, false);
    queue.forEach(j => { if (j.status === 'applying') j.status = 'pending'; });
    await saveQ(); renderQ();
  }
  async function pauseQ() {
    qPaused = true;
    await st.set(SK.Q_PAUSED, true);
    renderQ();
  }
  async function resumeQ() {
    qPaused = false;
    await st.set(SK.Q_PAUSED, false);
    processQ();
    renderQ();
  }
  async function skipJob() {
    const cur = queue.find(j => j.status === 'applying');
    if (cur) { cur.status = 'failed'; await saveQ(); }
    goNext();
  }

  // ===================== CREDIT UI HIDE =====================
  function hideCredits() {
    document.querySelectorAll('.autofill-credit-row,.payment-entry,.plugin-setting-credits-tip').forEach(e => e.style.display = 'none');
    document.querySelectorAll('.ant-modal-root').forEach(m => {
      if (/remaining.*credit|upgrade.*turbo|out of credit|credits.*refill|get unlimited/i.test(m.textContent||'')) m.style.display = 'none';
    });
    // Replace "X credits available today" text
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0 && /\d+\s*credits?\s*available/i.test(el.textContent||'')) {
        el.textContent = el.textContent.replace(/\d+\s*(credits?\s*available)/i, 'Unlimited $1');
      }
    });
  }

  // ===================== CSS =====================
  function injectCSS() {
    if (document.getElementById('ua-css')) return;
    const s = document.createElement('style'); s.id = 'ua-css';
    s.textContent = `
    .autofill-credit-row,.autofill-credit-text,.autofill-credit-text-right,.payment-entry,.plugin-setting-credits-tip{display:none!important}
    .ant-modal-root:has(.popup-modal-actions){display:none!important}

    #ua-root{position:fixed;bottom:24px;right:24px;z-index:2147483647;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#1a1a2e}
    #ua-root *{box-sizing:border-box;margin:0;padding:0}

    /* FAB */
    .ua-fab{width:52px;height:52px;border-radius:16px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;position:relative;transition:all .25s cubic-bezier(.4,0,.2,1);background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a78bfa 100%);box-shadow:0 4px 16px rgba(99,102,241,.35)}
    .ua-fab:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(99,102,241,.45)}
    .ua-fab svg{width:24px;height:24px;fill:#fff}
    .ua-fab-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff}
    .ua-fab-badge:empty,.ua-fab-badge[data-count="0"]{display:none}

    /* Add-to-queue FAB */
    .ua-fab-add{width:40px;height:40px;border-radius:12px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#1a1a2e;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.2);transition:all .25s;position:fixed;bottom:84px;right:24px;z-index:2147483646}
    .ua-fab-add:hover{transform:translateY(-2px);background:#2d2d44}
    .ua-fab-add svg{width:20px;height:20px;fill:#a78bfa}

    /* Drawer */
    .ua-drawer{display:none;position:absolute;bottom:62px;right:0;width:400px;max-height:560px;background:#fff;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.15);flex-direction:column;overflow:hidden;border:1px solid #e5e7eb}
    .ua-drawer.open{display:flex}

    /* Header */
    .ua-hdr{background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:16px 20px;display:flex;justify-content:space-between;align-items:center}
    .ua-hdr-t{font-size:16px;font-weight:700;color:#fff;letter-spacing:-.3px}
    .ua-hdr-sub{font-size:11px;color:rgba(255,255,255,.7);margin-top:1px}
    .ua-hdr-badge{background:rgba(255,255,255,.2);color:#fff;padding:4px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.5px;backdrop-filter:blur(4px)}

    /* Body */
    .ua-body{padding:16px 20px;overflow-y:auto;max-height:440px;flex:1}
    .ua-sec{margin-bottom:16px}
    .ua-sec:last-child{margin-bottom:0}
    .ua-sec-t{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#9ca3af;margin-bottom:8px;display:flex;align-items:center;gap:6px}

    /* Toggle */
    .ua-tog{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#f9fafb;border-radius:12px;border:1px solid #f3f4f6}
    .ua-tog-l{font-size:13px;font-weight:600;color:#1a1a2e}
    .ua-tog-d{font-size:10px;color:#9ca3af;margin-top:2px}
    .ua-sw{position:relative;width:44px;height:24px;flex-shrink:0}
    .ua-sw input{opacity:0;width:0;height:0;position:absolute}
    .ua-sw-s{position:absolute;cursor:pointer;inset:0;background:#d1d5db;border-radius:24px;transition:.3s}
    .ua-sw-s:before{content:"";position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.3s;box-shadow:0 1px 3px rgba(0,0,0,.15)}
    .ua-sw input:checked+.ua-sw-s{background:#6366f1}
    .ua-sw input:checked+.ua-sw-s:before{transform:translateX(20px)}

    /* Status */
    .ua-stat{padding:8px 12px;border-radius:8px;font-size:11px;font-weight:600;display:flex;align-items:center;gap:6px;margin-top:8px}
    .ua-stat.on{background:#ecfdf5;color:#059669}
    .ua-stat.off{background:#f9fafb;color:#9ca3af}
    .ua-stat.pause{background:#fffbeb;color:#d97706}
    .ua-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
    .ua-stat.on .ua-dot{background:#059669;animation:ua-pulse 1.5s infinite}
    .ua-stat.off .ua-dot{background:#d1d5db}
    .ua-stat.pause .ua-dot{background:#d97706}
    @keyframes ua-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.4)}}

    /* Import */
    .ua-drop{border:2px dashed #e5e7eb;border-radius:12px;padding:16px;text-align:center;cursor:pointer;transition:all .2s;background:#fafafa}
    .ua-drop:hover,.ua-drop.over{border-color:#6366f1;background:#f5f3ff}
    .ua-drop-ico{font-size:28px;margin-bottom:4px;opacity:.6}
    .ua-drop-t{font-size:12px;font-weight:600;color:#4b5563}
    .ua-drop-sub{font-size:10px;color:#9ca3af;margin-top:2px}
    .ua-csv-in{display:none}

    .ua-url-row{display:flex;gap:6px;margin-top:10px}
    .ua-url-inp{flex:1;padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:12px;outline:none;transition:border .2s;font-family:inherit}
    .ua-url-inp:focus{border-color:#6366f1}
    .ua-url-btn{background:#6366f1;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .2s}
    .ua-url-btn:hover{background:#4f46e5}

    /* Queue Toolbar */
    .ua-q-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
    .ua-q-selall{display:flex;align-items:center;gap:4px;font-size:11px;color:#6b7280;cursor:pointer;user-select:none}
    .ua-q-selall input{width:14px;height:14px;accent-color:#6366f1;cursor:pointer}
    .ua-q-info{font-size:11px;color:#9ca3af;margin-left:auto}
    .ua-q-del{background:none;border:1px solid #ef4444;color:#ef4444;border-radius:8px;padding:4px 10px;font-size:10px;font-weight:600;cursor:pointer;transition:all .2s}
    .ua-q-del:hover{background:#ef4444;color:#fff}
    .ua-q-del:disabled{opacity:.3;cursor:not-allowed}

    /* Queue List */
    .ua-q-list{max-height:200px;overflow-y:auto;margin-bottom:8px;border-radius:10px;border:1px solid #f3f4f6}
    .ua-q-list:empty::after{content:'No jobs in queue yet';display:block;text-align:center;color:#9ca3af;padding:20px;font-size:12px}
    .ua-q-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #f9fafb;transition:background .15s}
    .ua-q-item:last-child{border-bottom:none}
    .ua-q-item:hover{background:#f9fafb}
    .ua-q-item input[type="checkbox"]{width:14px;height:14px;accent-color:#6366f1;cursor:pointer;flex-shrink:0}
    .ua-q-num{width:20px;height:20px;border-radius:6px;background:#f3f4f6;color:#6b7280;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .ua-q-url{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#4b5563}
    .ua-q-st{font-size:9px;padding:3px 8px;border-radius:6px;font-weight:600;flex-shrink:0;text-transform:uppercase;letter-spacing:.3px}
    .ua-q-st.pending{background:#fef3c7;color:#92400e}
    .ua-q-st.applying{background:#dbeafe;color:#1e40af}
    .ua-q-st.done{background:#d1fae5;color:#065f46}
    .ua-q-st.failed{background:#fee2e2;color:#991b1b}
    .ua-q-st.skipped{background:#f3f4f6;color:#6b7280}
    .ua-q-rm{width:20px;height:20px;border-radius:6px;border:none;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#d1d5db;transition:all .2s;flex-shrink:0}
    .ua-q-rm:hover{background:#fee2e2;color:#ef4444}

    /* Queue Controls */
    .ua-q-ctrls{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
    .ua-btn{padding:10px 0;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;text-transform:uppercase;letter-spacing:.5px;flex:1;min-width:0;text-align:center}
    .ua-btn-p{background:#6366f1;color:#fff}
    .ua-btn-p:hover{background:#4f46e5}
    .ua-btn-p:disabled{background:#e5e7eb;color:#9ca3af;cursor:not-allowed}
    .ua-btn-w{background:#f59e0b;color:#fff}
    .ua-btn-w:hover{background:#d97706}
    .ua-btn-d{background:#fff;color:#ef4444;border:1.5px solid #fecaca}
    .ua-btn-d:hover{background:#fef2f2}
    .ua-btn-g{background:#fff;color:#6b7280;border:1.5px solid #e5e7eb}
    .ua-btn-g:hover{background:#f9fafb}
    .ua-btn-s{background:#10b981;color:#fff}
    .ua-btn-s:hover{background:#059669}

    .ua-q-summary{display:flex;gap:12px;padding:8px 0;font-size:11px;color:#6b7280;justify-content:center}
    .ua-q-summary span{display:flex;align-items:center;gap:3px}
    .ua-q-summary .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}

    /* ATS Badge */
    #ua-ats{position:fixed;top:12px;right:12px;z-index:2147483646;background:#1a1a2e;color:#a78bfa;padding:6px 14px;border-radius:12px;font-family:Inter,sans-serif;font-size:11px;font-weight:700;box-shadow:0 4px 16px rgba(0,0,0,.15);display:none;align-items:center;gap:6px;border:1px solid rgba(167,139,250,.2)}
    #ua-ats.show{display:flex}
    `;
    document.head.appendChild(s);
  }

  // ===================== SVG ICONS =====================
  const ICO = {
    bolt: '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>',
    skip: '<svg viewBox="0 0 24 24"><path d="M5 4l10 8-10 8V4zM19 5v14" stroke="currentColor" stroke-width="2" fill="currentColor"/></svg>',
    file: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
  };

  // ===================== UI =====================
  function buildUI() {
    if (window.self !== window.top) return;
    const root = document.createElement('div'); root.id = 'ua-root';
    root.innerHTML = `
    <div class="ua-drawer" id="ua-drawer">
      <div class="ua-hdr">
        <div><div class="ua-hdr-t">Ultimate Autofill</div><div class="ua-hdr-sub">AI-Powered Job Applications</div></div>
        <span class="ua-hdr-badge">UNLIMITED</span>
      </div>
      <div class="ua-body">
        <div class="ua-sec">
          <div class="ua-sec-t">${ICO.bolt} Auto-Apply</div>
          <div class="ua-tog">
            <div><div class="ua-tog-l">Auto-Apply on ATS Pages</div><div class="ua-tog-d">Auto-fill &amp; apply when job form detected</div></div>
            <label class="ua-sw"><input type="checkbox" id="ua-aa"${autoApply?' checked':''}><span class="ua-sw-s"></span></label>
          </div>
          <div id="ua-stat" class="ua-stat off"><span class="ua-dot"></span><span id="ua-stat-t">Inactive</span></div>
        </div>
        <div class="ua-sec">
          <div class="ua-sec-t">${ICO.file} Import Jobs</div>
          <div id="ua-drop" class="ua-drop">
            <div class="ua-drop-ico">&#128206;</div>
            <div class="ua-drop-t">Drop CSV or click to browse</div>
            <div class="ua-drop-sub">Accepts .csv, .txt, .tsv with job URLs</div>
            <input type="file" id="ua-csv" class="ua-csv-in" accept=".csv,.txt,.tsv">
          </div>
          <div class="ua-url-row">
            <input type="text" id="ua-url" class="ua-url-inp" placeholder="Paste job URL here...">
            <button id="ua-add" class="ua-url-btn">Add</button>
          </div>
        </div>
        <div class="ua-sec">
          <div class="ua-sec-t">Queue <span id="ua-q-cnt" style="color:#6366f1">(0)</span></div>
          <div class="ua-q-toolbar">
            <label class="ua-q-selall"><input type="checkbox" id="ua-selall">Select All</label>
            <button class="ua-q-del" id="ua-del-sel" disabled>Delete Selected</button>
            <span class="ua-q-info" id="ua-q-imported"></span>
          </div>
          <div class="ua-q-list" id="ua-q-list"></div>
          <div class="ua-q-summary" id="ua-q-sum"></div>
          <div class="ua-q-ctrls" id="ua-q-ctrls"></div>
        </div>
      </div>
    </div>
    <button class="ua-fab" id="ua-fab" title="Ultimate Autofill">${ICO.bolt}<span class="ua-fab-badge" id="ua-badge" data-count="0"></span></button>`;
    document.body.appendChild(root);

    // Add-to-queue floating button
    const addFab = document.createElement('button');
    addFab.className = 'ua-fab-add';
    addFab.id = 'ua-fab-add';
    addFab.innerHTML = ICO.plus;
    addFab.title = 'Add this page to queue';
    document.body.appendChild(addFab);

    // ATS badge
    const ats = document.createElement('div');
    ats.id = 'ua-ats';
    ats.innerHTML = '<span class="ua-dot" style="background:#a78bfa;animation:ua-pulse 1.5s infinite"></span><span id="ua-ats-n"></span>';
    document.body.appendChild(ats);

    bind();
  }

  function bind() {
    document.getElementById('ua-fab').addEventListener('click', () => document.getElementById('ua-drawer').classList.toggle('open'));
    document.getElementById('ua-fab-add').addEventListener('click', () => { addJob(location.href, document.title); });

    const tog = document.getElementById('ua-aa');
    tog.addEventListener('change', async e => {
      autoApply = e.target.checked;
      await st.set(SK.AUTO_APPLY, autoApply);
      updateStat();
      if (autoApply && isAppForm()) {
        if (isWorkday()) workdayAutomation();
        else triggerAutofill();
      }
    });

    // CSV
    const drop = document.getElementById('ua-drop');
    const csv = document.getElementById('ua-csv');
    drop.addEventListener('click', () => csv.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    csv.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

    // URL add
    document.getElementById('ua-add').addEventListener('click', () => {
      const inp = document.getElementById('ua-url'); const u = inp.value.trim(); if (u) { addJob(u); inp.value = ''; }
    });
    document.getElementById('ua-url').addEventListener('keypress', e => { if (e.key === 'Enter') document.getElementById('ua-add').click(); });

    // Select all
    document.getElementById('ua-selall').addEventListener('change', e => {
      if (e.target.checked) queue.forEach(j => selected.add(j.id));
      else selected.clear();
      renderQ();
    });

    // Delete selected
    document.getElementById('ua-del-sel').addEventListener('click', removeSelected);
  }

  async function handleFile(file) {
    const urls = parseCSV(await file.text());
    if (!urls.length) { alert('No valid URLs found in file.'); return; }
    for (const u of urls) await addJob(u);
    document.getElementById('ua-drawer').classList.add('open');
  }

  function renderQ() {
    const list = document.getElementById('ua-q-list');
    const cnt = document.getElementById('ua-q-cnt');
    const sum = document.getElementById('ua-q-sum');
    const ctrls = document.getElementById('ua-q-ctrls');
    const badge = document.getElementById('ua-badge');
    const delBtn = document.getElementById('ua-del-sel');
    const selall = document.getElementById('ua-selall');
    const imported = document.getElementById('ua-q-imported');
    if (!list) return;

    cnt.textContent = `(${queue.length})`;
    badge.textContent = queue.length || '';
    badge.dataset.count = queue.length;
    imported.textContent = queue.length ? `${queue.length} URL${queue.length>1?'s':''} imported` : '';
    delBtn.disabled = selected.size === 0;
    selall.checked = queue.length > 0 && selected.size === queue.length;

    list.innerHTML = queue.map((j, i) => `
      <div class="ua-q-item">
        <input type="checkbox" data-id="${j.id}" class="ua-q-cb" ${selected.has(j.id)?'checked':''}>
        <span class="ua-q-num">${i+1}</span>
        <span class="ua-q-url" title="${j.url}">${j.title||j.url}</span>
        <span class="ua-q-st ${j.status}">${j.status}</span>
        <button class="ua-q-rm" data-id="${j.id}">${ICO.x}</button>
      </div>`).join('');

    // Checkboxes
    list.querySelectorAll('.ua-q-cb').forEach(cb => cb.addEventListener('change', e => {
      if (e.target.checked) selected.add(e.target.dataset.id);
      else selected.delete(e.target.dataset.id);
      renderQ();
    }));
    // Remove buttons
    list.querySelectorAll('.ua-q-rm').forEach(b => b.addEventListener('click', e => {
      const id = e.currentTarget.dataset.id; removeJob(id);
    }));

    // Summary
    const pend = queue.filter(j=>j.status==='pending').length;
    const done = queue.filter(j=>j.status==='done').length;
    const fail = queue.filter(j=>j.status==='failed'||j.status==='skipped').length;
    const applying = queue.filter(j=>j.status==='applying').length;
    sum.innerHTML = queue.length ? `
      <span><span class="dot" style="background:#f59e0b"></span>${pend} pending</span>
      <span><span class="dot" style="background:#3b82f6"></span>${applying} active</span>
      <span><span class="dot" style="background:#10b981"></span>${done} done</span>
      ${fail?`<span><span class="dot" style="background:#ef4444"></span>${fail} failed</span>`:''}
    ` : '';

    // Controls
    if (queue.length === 0) { ctrls.innerHTML = ''; return; }
    if (!qActive) {
      ctrls.innerHTML = `<button class="ua-btn ua-btn-p" id="ua-startq" ${pend===0?'disabled':''}>${ICO.play} Start Applying</button>
        <button class="ua-btn ua-btn-d" id="ua-clearq">Clear All</button>`;
    } else if (qPaused) {
      ctrls.innerHTML = `<button class="ua-btn ua-btn-s" id="ua-resumeq">${ICO.play} Resume</button>
        <button class="ua-btn ua-btn-d" id="ua-stopq">${ICO.stop} Stop</button>`;
    } else {
      ctrls.innerHTML = `<button class="ua-btn ua-btn-w" id="ua-pauseq">${ICO.pause} Pause</button>
        <button class="ua-btn ua-btn-g" id="ua-skipq">${ICO.skip} Skip</button>
        <button class="ua-btn ua-btn-d" id="ua-stopq">${ICO.stop} Stop</button>`;
    }

    document.getElementById('ua-startq')?.addEventListener('click', startQ);
    document.getElementById('ua-stopq')?.addEventListener('click', stopQ);
    document.getElementById('ua-pauseq')?.addEventListener('click', pauseQ);
    document.getElementById('ua-resumeq')?.addEventListener('click', resumeQ);
    document.getElementById('ua-skipq')?.addEventListener('click', skipJob);
    document.getElementById('ua-clearq')?.addEventListener('click', clearQ);
  }

  function updateStat() {
    const el = document.getElementById('ua-stat');
    const t = document.getElementById('ua-stat-t');
    if (!el) return;
    const ats = detectATS();
    if (qActive && !qPaused) { el.className = 'ua-stat on'; t.textContent = `Applying... ${ats||'processing queue'}`; }
    else if (qActive && qPaused) { el.className = 'ua-stat pause'; t.textContent = 'Queue paused'; }
    else if (autoApply) { el.className = 'ua-stat on'; t.textContent = ats ? `Active - ${ats} detected` : 'Active - monitoring for ATS pages'; }
    else { el.className = 'ua-stat off'; t.textContent = 'Inactive'; }
  }

  function showATSBadge() {
    const ats = detectATS();
    if (ats) { document.getElementById('ua-ats-n').textContent = `${ats} Detected`; document.getElementById('ua-ats').classList.add('show'); }
  }

  // ===================== OBSERVER =====================
  function observe() {
    const obs = new MutationObserver(() => hideCredits());
    obs.observe(document.body || document.documentElement, { childList:true, subtree:true });
  }

  // ===================== INIT =====================
  async function init() {
    if (window.self !== window.top) return;
    await load();
    injectCSS();
    buildUI();
    [500,1500,3000,5000,8000].forEach(ms => setTimeout(hideCredits, ms));
    observe();
    showATSBadge();
    renderQ();
    updateStat();

    // Auto-apply
    if (autoApply && isAppForm()) {
      console.log('[UA] ATS detected, auto-applying in 2s...');
      await sleep(2000);
      if (isWorkday()) await workdayAutomation();
      else await triggerAutofill();
    }

    // Queue processing
    if (qActive) { await sleep(2000); processQ(); }

    // Resume tailoring on Jobright
    if (isJobright()) { await sleep(2000); resumeTailoringAutomation(); }

    console.log('[UA] v4.0 initialized');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
