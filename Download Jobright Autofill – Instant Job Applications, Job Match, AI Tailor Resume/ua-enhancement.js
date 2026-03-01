// === ULTIMATE AUTOFILL ENHANCEMENT v3.0 ===
// Features: Unlimited credits bypass, CSV import queue, auto-apply toggle,
// universal ATS detection, one-click queue button, auto-apply engine
(function () {
  'use strict';

  // ==================== CONFIGURATION ====================
  const STORAGE_KEYS = {
    AUTO_APPLY: 'ua_auto_apply_enabled',
    JOB_QUEUE: 'ua_job_queue',
    QUEUE_ACTIVE: 'ua_queue_active'
  };

  const ATS_PATTERNS = [
    { name: 'Workday', pattern: /myworkdayjobs\.com|workday\.com\/.*\/job/i },
    { name: 'Greenhouse', pattern: /boards\.greenhouse\.io|greenhouse\.io.*\/jobs/i },
    { name: 'Lever', pattern: /jobs\.lever\.co|lever\.co\/.*\/apply/i },
    { name: 'SmartRecruiters', pattern: /jobs\.smartrecruiters\.com/i },
    { name: 'iCIMS', pattern: /icims\.com/i },
    { name: 'Taleo', pattern: /taleo\.net|oraclecloud\.com.*CandidateExperience/i },
    { name: 'Ashby', pattern: /jobs\.ashbyhq\.com/i },
    { name: 'BambooHR', pattern: /bamboohr\.com.*\/jobs/i },
    { name: 'Oracle', pattern: /oraclecloud\.com.*recruit/i },
    { name: 'LinkedIn', pattern: /linkedin\.com\/jobs\/(view|application)/i },
    { name: 'Indeed', pattern: /indeed\.com.*(viewjob|apply)/i },
    { name: 'UltiPro', pattern: /ultipro\.com|recruiting\.ultipro/i },
    { name: 'Jobvite', pattern: /jobs\.jobvite\.com/i },
    { name: 'Breezy', pattern: /breezy\.hr|breezyhr\.com/i },
    { name: 'Recruitee', pattern: /recruitee\.com\/o\//i },
    { name: 'ADP', pattern: /adp\.com.*\/job|workforcenow\.adp/i },
    { name: 'Rippling', pattern: /ats\.rippling\.com/i },
    { name: 'Dover', pattern: /app\.dover\.com|dover\.com\/apply/i },
    { name: 'Dayforce', pattern: /dayforce\.com.*candidateportal/i },
    { name: 'SuccessFactors', pattern: /successfactors\.com/i },
    { name: 'JazzHR', pattern: /app\.jazz\.co|applytojob\.com/i },
    { name: 'Fountain', pattern: /fountain\.com.*\/apply/i },
    { name: 'Pinpoint', pattern: /pinpointhq\.com.*\/jobs/i },
    { name: 'Comeet', pattern: /comeet\.com.*\/jobs/i },
    { name: 'Personio', pattern: /personio\.de.*\/job/i },
    { name: 'ZipRecruiter', pattern: /ziprecruiter\.com.*(jobs|apply)/i },
    { name: 'Monster', pattern: /monster\.com.*job/i },
    { name: 'Glassdoor', pattern: /glassdoor\.com.*job/i },
    { name: 'Dice', pattern: /dice\.com.*job/i },
    { name: 'Wellfound', pattern: /wellfound\.com.*\/jobs/i },
    { name: 'Paylocity', pattern: /paylocity\.com.*Recruiting/i },
    { name: 'Paycom', pattern: /paycomonline\.com.*careers/i },
    { name: 'Phenom', pattern: /phenom\.com.*\/jobs/i },
    { name: 'Avature', pattern: /avature\.net.*careers/i },
    { name: 'CareerSite', pattern: /\/careers?\/?|\/jobs?\/?|\/apply|\/positions?\//i }
  ];

  // ==================== CREDIT BYPASS (Content Script) ====================
  const _fetch = window.fetch;
  window.fetch = async function () {
    const url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url) || '';
    if (url.includes('/swan/credit/balance-v2')) {
      return new Response(JSON.stringify({ code: 200, result: { credit: { autofill: 99999 }, dailyFill: { autofill: 99999 } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/swan/payment/subscription')) {
      return new Response(JSON.stringify({ code: 200, result: { status: 'ACTIVE', plan: 'turbo', subscriptionId: 'unlimited' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/swan/autofill/cost-credit')) {
      return new Response(JSON.stringify({ code: 200, result: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/swan/credit/free')) {
      return new Response(JSON.stringify({ code: 200, result: { dailyFill: { autofill: 99999 }, credit: { autofill: 99999 } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/swan/payment/price')) {
      return new Response(JSON.stringify({ code: 200, result: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return _fetch.apply(window, arguments);
  };

  // ==================== CSS ====================
  function injectStyles() {
    if (document.getElementById('ua-styles')) return;
    const s = document.createElement('style');
    s.id = 'ua-styles';
    s.textContent = `
      /* Hide credit UI from original extension */
      .autofill-credit-row,
      .autofill-credit-text,
      .autofill-credit-text-right,
      .payment-entry,
      .plugin-setting-credits-tip { display:none!important; }
      .ant-modal-root:has(.popup-modal-actions) { display:none!important; }

      /* Panel */
      #ua-panel{position:fixed;bottom:80px;right:20px;z-index:2147483647;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
      #ua-fab{width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#00f0a0,#00d090);border:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,240,160,.4);display:flex;align-items:center;justify-content:center;color:#000;font-size:18px;font-weight:800;transition:.3s}
      #ua-fab:hover{transform:scale(1.1);box-shadow:0 6px 22px rgba(0,240,160,.5)}
      #ua-drawer{display:none;position:absolute;bottom:62px;right:0;width:370px;max-height:530px;background:#fff;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.16);flex-direction:column;overflow:hidden}
      #ua-drawer.open{display:flex}
      .ua-hdr{background:linear-gradient(135deg,#00f0a0,#00d090);padding:14px 18px;display:flex;justify-content:space-between;align-items:center}
      .ua-hdr h3{margin:0;font-size:15px;font-weight:700;color:#000}
      .ua-hdr small{font-size:10px;color:#00000070}
      .ua-badge{background:#000;color:#00f0a0;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
      .ua-body{padding:14px 18px;overflow-y:auto;max-height:420px;flex:1}
      .ua-sec{margin-bottom:14px}
      .ua-sec-title{font-size:11px;font-weight:700;text-transform:uppercase;color:#00000050;margin-bottom:6px;letter-spacing:.5px}

      /* Toggle */
      .ua-tog{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f8f9fa;border-radius:10px;margin-bottom:6px}
      .ua-tog-label{font-size:13px;font-weight:600}
      .ua-tog-desc{font-size:10px;color:#00000060;margin-top:1px}
      .ua-sw{position:relative;width:42px;height:22px;flex-shrink:0}
      .ua-sw input{opacity:0;width:0;height:0}
      .ua-sw-sl{position:absolute;cursor:pointer;inset:0;background:#ccc;border-radius:22px;transition:.3s}
      .ua-sw-sl:before{content:"";position:absolute;height:16px;width:16px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.3s}
      .ua-sw input:checked+.ua-sw-sl{background:#00f0a0}
      .ua-sw input:checked+.ua-sw-sl:before{transform:translateX(20px)}

      /* CSV */
      .ua-drop{border:2px dashed #ddd;border-radius:10px;padding:14px;text-align:center;cursor:pointer;transition:.3s;background:#fafafa}
      .ua-drop:hover,.ua-drop.over{border-color:#00f0a0;background:#f0fff8}
      .ua-drop-ico{font-size:22px}
      .ua-drop-txt{font-size:11px;color:#00000060;margin-top:2px}
      .ua-csv-in{display:none}
      .ua-url-row{display:flex;gap:6px;margin-top:8px}
      .ua-url-inp{flex:1;padding:7px 10px;border:1px solid #ddd;border-radius:8px;font-size:12px;outline:none}
      .ua-url-inp:focus{border-color:#00f0a0}
      .ua-url-add{background:#00f0a0;border:none;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}

      /* Queue */
      .ua-q-list{max-height:180px;overflow-y:auto;margin-top:6px}
      .ua-q-item{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:#f8f9fa;border-radius:8px;margin-bottom:3px;font-size:11px}
      .ua-q-url{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;color:#333}
      .ua-q-st{font-size:9px;padding:2px 7px;border-radius:10px;font-weight:600;margin-left:6px;flex-shrink:0}
      .ua-q-st.pending{background:#fff3cd;color:#856404}
      .ua-q-st.applying{background:#cce5ff;color:#004085}
      .ua-q-st.done{background:#d4edda;color:#155724}
      .ua-q-st.failed{background:#f8d7da;color:#721c24}
      .ua-q-rm{cursor:pointer;color:#dc3545;font-size:14px;margin-left:6px;background:none;border:none;padding:0;line-height:1}
      .ua-q-sum{font-size:11px;color:#666;text-align:center;margin-top:6px}
      .ua-btn{width:100%;padding:9px 14px;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;transition:.2s;text-transform:uppercase;letter-spacing:.5px;margin-top:6px}
      .ua-btn-p{background:#00f0a0;color:#000}
      .ua-btn-p:hover{background:#00d090}
      .ua-btn-p:disabled{background:#e0e0e0;color:#999;cursor:not-allowed}
      .ua-btn-d{background:#fff;color:#dc3545;border:1px solid #dc3545}
      .ua-btn-d:hover{background:#dc3545;color:#fff}

      /* Status */
      .ua-status{text-align:center;padding:6px;border-radius:8px;font-size:11px;font-weight:600;margin-top:6px}
      .ua-status.on{background:#d4edda;color:#155724}
      .ua-status.off{background:#f8f9fa;color:#666}

      /* ATS badge */
      #ua-ats{position:fixed;top:10px;right:10px;z-index:2147483646;background:#000;color:#00f0a0;padding:5px 12px;border-radius:20px;font-family:Inter,sans-serif;font-size:11px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.2);display:none;align-items:center;gap:5px}
      #ua-ats.show{display:flex}
      #ua-ats .dot{width:7px;height:7px;background:#00f0a0;border-radius:50%;animation:ua-p 1.5s infinite}
      @keyframes ua-p{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}

      /* Float add btn */
      #ua-add-float{position:fixed;bottom:142px;right:20px;z-index:2147483646;background:#000;color:#fff;border:none;width:38px;height:38px;border-radius:50%;font-size:20px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;transition:.3s}
      #ua-add-float:hover{transform:scale(1.1);background:#333}
    `;
    document.head.appendChild(s);
  }

  // ==================== STORAGE ====================
  const store = {
    get: k => new Promise(r => chrome.storage.local.get(k, d => r(d[k]))),
    set: (k, v) => new Promise(r => chrome.storage.local.set({ [k]: v }, r))
  };

  // ==================== STATE ====================
  let queue = [];
  let queueActive = false;
  let autoApply = false;

  async function loadState() {
    queue = (await store.get(STORAGE_KEYS.JOB_QUEUE)) || [];
    queueActive = (await store.get(STORAGE_KEYS.QUEUE_ACTIVE)) || false;
    autoApply = (await store.get(STORAGE_KEYS.AUTO_APPLY)) || false;
  }

  async function saveQueue() {
    await store.set(STORAGE_KEYS.JOB_QUEUE, queue);
  }

  // ==================== QUEUE MANAGEMENT ====================
  async function addJob(url, title) {
    if (!url || queue.some(j => j.url === url)) return;
    queue.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      url, title: title || shortUrl(url),
      status: 'pending', addedAt: Date.now()
    });
    await saveQueue();
    renderQueue();
  }

  async function removeJob(id) {
    queue = queue.filter(j => j.id !== id);
    await saveQueue();
    renderQueue();
  }

  async function clearQueue() {
    queue = [];
    await saveQueue();
    renderQueue();
  }

  function shortUrl(u) {
    try { const p = new URL(u); return p.hostname.replace('www.', '') + p.pathname.slice(0, 30); }
    catch { return u.slice(0, 40); }
  }

  // ==================== CSV PARSER ====================
  function parseCSV(text) {
    const urls = [];
    for (const line of text.split(/[\r\n]+/)) {
      const t = line.trim();
      if (!t || /^(url|link|job)/i.test(t)) continue;
      for (const col of t.split(/[,\t]/)) {
        const c = col.trim().replace(/^["']|["']$/g, '');
        if (/^https?:\/\//i.test(c)) { urls.push(c); break; }
      }
      if (/^https?:\/\//i.test(t) && !urls.includes(t)) urls.push(t);
    }
    return [...new Set(urls)];
  }

  // ==================== ATS DETECTION ====================
  function detectATS() {
    const url = window.location.href;
    for (const a of ATS_PATTERNS) {
      if (a.pattern.test(url)) return a.name;
    }
    return null;
  }

  function isAppForm() {
    if (detectATS()) return true;
    const sels = [
      'input[name*="resume" i]', 'input[type="file"][accept*=".pdf"]',
      'form[action*="apply" i]', '[data-testid*="apply" i]',
      '.application-form', '#application-form'
    ];
    for (const s of sels) { try { if (document.querySelector(s)) return true; } catch {} }
    const txt = (document.body?.innerText || '').slice(0, 5000);
    return /apply\s+(now|for|to|here)/i.test(txt) && /resume|cover letter|experience/i.test(txt);
  }

  // ==================== AUTO-APPLY ENGINE ====================
  function waitFor(sel, ms) {
    return new Promise(resolve => {
      const el = document.querySelector(sel);
      if (el) { resolve(el); return; }
      const obs = new MutationObserver(() => {
        const e = document.querySelector(sel);
        if (e) { obs.disconnect(); resolve(e); }
      });
      obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(null); }, ms || 10000);
    });
  }

  async function triggerAutofill() {
    // Wait for Jobright extension to inject its UI
    await waitFor('#jobright-helper-id', 8000);
    // Small delay for rendering
    await new Promise(r => setTimeout(r, 1500));
    // Find and click the Autofill button
    const btn = document.querySelector('.auto-fill-button');
    if (btn && !btn.disabled) {
      console.log('[UA] Auto-triggering autofill...');
      btn.click();
      return true;
    }
    // Try again after a delay (sometimes button loads late)
    await new Promise(r => setTimeout(r, 3000));
    const btn2 = document.querySelector('.auto-fill-button');
    if (btn2 && !btn2.disabled) {
      console.log('[UA] Auto-triggering autofill (retry)...');
      btn2.click();
      return true;
    }
    console.log('[UA] Autofill button not found or disabled');
    return false;
  }

  async function processQueue() {
    if (!queueActive || queue.length === 0) return;
    const cur = queue.find(j => j.status === 'applying');
    if (cur) {
      try {
        const curPath = new URL(cur.url).pathname;
        if (window.location.href.includes(curPath.slice(0, 20))) {
          const ok = await triggerAutofill();
          cur.status = ok ? 'done' : 'failed';
          await saveQueue();
          renderQueue();
          setTimeout(goNext, 12000);
          return;
        }
      } catch {}
    }
    goNext();
  }

  function goNext() {
    const next = queue.find(j => j.status === 'pending');
    if (next) {
      next.status = 'applying';
      saveQueue().then(() => { window.location.href = next.url; });
    } else {
      queueActive = false;
      store.set(STORAGE_KEYS.QUEUE_ACTIVE, false);
      renderQueue();
    }
  }

  async function startQueue() {
    if (queue.filter(j => j.status === 'pending').length === 0) return;
    queueActive = true;
    await store.set(STORAGE_KEYS.QUEUE_ACTIVE, true);
    goNext();
  }

  async function stopQueue() {
    queueActive = false;
    await store.set(STORAGE_KEYS.QUEUE_ACTIVE, false);
    queue.forEach(j => { if (j.status === 'applying') j.status = 'pending'; });
    await saveQueue();
    renderQueue();
  }

  // ==================== CREDIT UI HIDING ====================
  function hideCredits() {
    document.querySelectorAll('.autofill-credit-row').forEach(e => e.style.display = 'none');
    document.querySelectorAll('.payment-entry').forEach(e => e.style.display = 'none');
    document.querySelectorAll('.ant-modal-root').forEach(m => {
      const t = m.textContent || '';
      if (/remaining.*credit|upgrade.*turbo|out of credit|credits.*refill|get unlimited/i.test(t)) {
        m.style.display = 'none';
      }
    });
    document.querySelectorAll('[class*="turbo"], [class*="upgrade"], [class*="payment"], [class*="credit"]').forEach(e => {
      const t = e.textContent || '';
      if (/upgrade|turbo|get unlimited|remaining credit/i.test(t) && e.offsetHeight < 200) {
        e.style.display = 'none';
      }
    });
  }

  // ==================== UI ====================
  function buildUI() {
    if (window.self !== window.top) return;

    const panel = document.createElement('div');
    panel.id = 'ua-panel';
    panel.innerHTML = `
      <div id="ua-drawer">
        <div class="ua-hdr">
          <div>
            <h3>Ultimate Autofill</h3>
            <small>AI-Powered Job Applications</small>
          </div>
          <span class="ua-badge">UNLIMITED</span>
        </div>
        <div class="ua-body">
          <div class="ua-sec">
            <div class="ua-sec-title">Auto-Apply</div>
            <div class="ua-tog">
              <div>
                <div class="ua-tog-label">Auto-Apply on ATS Pages</div>
                <div class="ua-tog-desc">Automatically fill &amp; apply when ATS detected</div>
              </div>
              <label class="ua-sw">
                <input type="checkbox" id="ua-aa-tog">
                <span class="ua-sw-sl"></span>
              </label>
            </div>
            <div id="ua-st" class="ua-status off">Auto-apply: Inactive</div>
          </div>
          <div class="ua-sec">
            <div class="ua-sec-title">Import Jobs (CSV / URLs)</div>
            <div id="ua-drop" class="ua-drop">
              <div class="ua-drop-ico">&#128194;</div>
              <div>Drop CSV here or click to browse</div>
              <div class="ua-drop-txt">Supports .csv and .txt with job URLs</div>
              <input type="file" id="ua-csv" class="ua-csv-in" accept=".csv,.txt,.tsv">
            </div>
            <div class="ua-url-row">
              <input type="text" id="ua-url-inp" class="ua-url-inp" placeholder="Paste job URL...">
              <button id="ua-url-add" class="ua-url-add">+ Add</button>
            </div>
          </div>
          <div class="ua-sec">
            <div class="ua-sec-title">Queue (<span id="ua-q-cnt">0</span> jobs)</div>
            <div id="ua-q-list" class="ua-q-list"></div>
            <div id="ua-q-sum" class="ua-q-sum"></div>
            <button id="ua-start" class="ua-btn ua-btn-p" disabled>Start Applying to All Jobs</button>
            <button id="ua-stop" class="ua-btn ua-btn-d" style="display:none">Stop Queue</button>
            <button id="ua-clear" class="ua-btn ua-btn-d" style="display:none">Clear Queue</button>
          </div>
        </div>
      </div>
      <button id="ua-fab" title="Ultimate Autofill">UA</button>
    `;
    document.body.appendChild(panel);

    // ATS badge
    const badge = document.createElement('div');
    badge.id = 'ua-ats';
    badge.innerHTML = '<span class="dot"></span><span id="ua-ats-n"></span>';
    document.body.appendChild(badge);

    // Float add button
    const fab2 = document.createElement('button');
    fab2.id = 'ua-add-float';
    fab2.innerHTML = '+';
    fab2.title = 'Add this page to queue';
    document.body.appendChild(fab2);

    bindEvents();
  }

  function bindEvents() {
    document.getElementById('ua-fab').addEventListener('click', () => {
      document.getElementById('ua-drawer').classList.toggle('open');
    });

    const tog = document.getElementById('ua-aa-tog');
    tog.checked = autoApply;
    tog.addEventListener('change', async e => {
      autoApply = e.target.checked;
      await store.set(STORAGE_KEYS.AUTO_APPLY, autoApply);
      updateStatus();
      if (autoApply && isAppForm()) triggerAutofill();
    });

    const drop = document.getElementById('ua-drop');
    const csv = document.getElementById('ua-csv');
    drop.addEventListener('click', () => csv.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('over');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    csv.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

    const urlBtn = document.getElementById('ua-url-add');
    const urlInp = document.getElementById('ua-url-inp');
    urlBtn.addEventListener('click', () => {
      const u = urlInp.value.trim();
      if (u) { addJob(u); urlInp.value = ''; }
    });
    urlInp.addEventListener('keypress', e => { if (e.key === 'Enter') urlBtn.click(); });

    document.getElementById('ua-start').addEventListener('click', startQueue);
    document.getElementById('ua-stop').addEventListener('click', stopQueue);
    document.getElementById('ua-clear').addEventListener('click', clearQueue);

    document.getElementById('ua-add-float').addEventListener('click', () => {
      addJob(window.location.href, document.title);
    });
  }

  async function handleFile(file) {
    const text = await file.text();
    const urls = parseCSV(text);
    if (urls.length === 0) {
      alert('No valid URLs found. File should contain job application URLs (https://...)');
      return;
    }
    for (const u of urls) await addJob(u);
    document.getElementById('ua-drawer').classList.add('open');
  }

  function renderQueue() {
    const list = document.getElementById('ua-q-list');
    const cnt = document.getElementById('ua-q-cnt');
    const sum = document.getElementById('ua-q-sum');
    const startBtn = document.getElementById('ua-start');
    const stopBtn = document.getElementById('ua-stop');
    const clearBtn = document.getElementById('ua-clear');
    if (!list) return;

    cnt.textContent = queue.length;

    if (queue.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:#999;padding:10px;font-size:11px">No jobs in queue. Import CSV or add URLs above.</div>';
      sum.textContent = '';
      startBtn.disabled = true;
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
      clearBtn.style.display = 'none';
    } else {
      list.innerHTML = queue.map(j => `
        <div class="ua-q-item">
          <span class="ua-q-url" title="${j.url}">${j.title || j.url}</span>
          <span class="ua-q-st ${j.status}">${j.status}</span>
          <button class="ua-q-rm" data-id="${j.id}">&times;</button>
        </div>`).join('');

      const pend = queue.filter(j => j.status === 'pending').length;
      const done = queue.filter(j => j.status === 'done').length;
      sum.textContent = `${done}/${queue.length} completed, ${pend} pending`;
      startBtn.disabled = pend === 0;

      if (queueActive) {
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
      } else {
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
      }
      clearBtn.style.display = 'block';

      list.querySelectorAll('.ua-q-rm').forEach(b => {
        b.addEventListener('click', e => removeJob(e.target.dataset.id));
      });
    }
  }

  function updateStatus() {
    const st = document.getElementById('ua-st');
    if (!st) return;
    const ats = detectATS();
    if (autoApply) {
      st.className = 'ua-status on';
      st.textContent = ats ? `Auto-apply ACTIVE - ${ats} detected` : 'Auto-apply ACTIVE - Monitoring';
    } else {
      st.className = 'ua-status off';
      st.textContent = 'Auto-apply: Inactive';
    }
  }

  function showATSBadge() {
    const ats = detectATS();
    const badge = document.getElementById('ua-ats');
    if (ats && badge) {
      document.getElementById('ua-ats-n').textContent = `${ats} Detected`;
      badge.classList.add('show');
    }
  }

  // ==================== MUTATION OBSERVER ====================
  function setupObserver() {
    const obs = new MutationObserver(() => hideCredits());
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  // ==================== INIT ====================
  async function init() {
    if (window.self !== window.top) return;
    await loadState();
    injectStyles();
    buildUI();
    [500, 1500, 3000, 5000, 8000].forEach(ms => setTimeout(hideCredits, ms));
    setupObserver();
    showATSBadge();
    renderQueue();
    updateStatus();

    if (autoApply && isAppForm()) {
      console.log('[UA] ATS page detected, auto-applying in 3s...');
      setTimeout(() => triggerAutofill(), 3000);
    }

    if (queueActive) {
      setTimeout(() => processQueue(), 2000);
    }

    console.log('[UA] Enhancement initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
