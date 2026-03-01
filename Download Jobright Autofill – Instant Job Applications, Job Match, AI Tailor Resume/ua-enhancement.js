// === ULTIMATE AUTOFILL ENHANCEMENT v5.0 ===
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
  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) { this._ua_url = url; return _xhrOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function() {
    const url = this._ua_url || '';
    if (/credit\/balance|credit\/free|payment\/subscription|cost-credit|resume.*credit|tailor.*credit/i.test(url)) {
      const s = this;
      Object.defineProperty(s,'responseText',{get:()=>JSON.stringify({code:200,result:{credit:_C,dailyFill:_C,remaining:99999},success:true})});
      Object.defineProperty(s,'status',{get:()=>200});
      Object.defineProperty(s,'readyState',{get:()=>4});
      setTimeout(()=>{s.onreadystatechange?.();s.onload?.();},50);
      return;
    }
    return _xhrSend.apply(this, arguments);
  };

  // ===================== CONFIG =====================
  const SK = {AA:'ua_aa',Q:'ua_q',QA:'ua_qa',QP:'ua_qp',POS:'ua_pos'};
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
    {n:'Avature',p:/avature\.net.*careers/i},
    {n:'Career',p:/\/careers?\/?$|\/jobs?\/?$|\/apply\b|\/positions?\//i}
  ];

  // ===================== STORAGE & STATE =====================
  const st={get:k=>new Promise(r=>chrome.storage.local.get(k,d=>r(d[k]))),set:(k,v)=>new Promise(r=>chrome.storage.local.set({[k]:v},r))};
  let queue=[],qActive=false,qPaused=false,autoApply=false,selected=new Set();
  async function load(){queue=(await st.get(SK.Q))||[];qActive=(await st.get(SK.QA))||false;qPaused=(await st.get(SK.QP))||false;autoApply=(await st.get(SK.AA))||false;}
  async function saveQ(){await st.set(SK.Q,queue);}

  // ===================== QUEUE OPS =====================
  async function addJob(url,title){if(!url||queue.some(j=>j.url===url))return;queue.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),url,title:title||shortUrl(url),status:'pending',addedAt:Date.now()});await saveQ();renderQ();updateCtrl();}
  async function removeJob(id){queue=queue.filter(j=>j.id!==id);selected.delete(id);await saveQ();renderQ();updateCtrl();}
  async function clearQ(){queue=[];selected.clear();await saveQ();renderQ();updateCtrl();}
  async function removeSelected(){queue=queue.filter(j=>!selected.has(j.id));selected.clear();await saveQ();renderQ();updateCtrl();}
  function shortUrl(u){try{const p=new URL(u);return p.hostname.replace('www.','')+p.pathname.slice(0,30);}catch{return u.slice(0,40);}}
  function parseCSV(t){const u=[];for(const l of t.split(/[\r\n]+/)){const s=l.trim();if(!s||/^(url|link|job|title|company)/i.test(s))continue;for(const c of s.split(/[,\t]/)){const v=c.trim().replace(/^["']|["']$/g,'');if(/^https?:\/\//i.test(v)){u.push(v);break;}}if(/^https?:\/\//i.test(s)&&!u.includes(s))u.push(s);}return[...new Set(u)];}

  // ===================== ATS =====================
  function detectATS(){for(const a of ATS)if(a.p.test(location.href))return a.n;return null;}
  function isWorkday(){return/myworkdayjobs\.com|myworkdaysite\.com/i.test(location.href);}
  function isJobright(){return/jobright\.ai/i.test(location.hostname);}
  function isAppForm(){if(detectATS())return true;for(const s of['input[name*="resume" i]','input[type="file"][accept*=".pdf"]','form[action*="apply" i]','[data-testid*="apply" i]','.application-form']){try{if(document.querySelector(s))return true;}catch{}}return false;}

  // ===================== HELPERS =====================
  function waitFor(sel,ms,xpath){return new Promise(res=>{const f=()=>xpath?document.evaluate(sel,document,null,9,null).singleNodeValue:document.querySelector(sel);const e=f();if(e){res(e);return;}const o=new MutationObserver(()=>{const e=f();if(e){o.disconnect();res(e);}});o.observe(document.body||document.documentElement,{childList:true,subtree:true});setTimeout(()=>{o.disconnect();res(null);},ms||10000);});}
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function clickEl(el){if(!el)return false;el.scrollIntoView?.({behavior:'smooth',block:'center'});el.click();return true;}

  // ===================== WORKDAY AUTOMATION =====================
  async function workdayAutomation(){
    console.log('[UA] Workday automation starting...');
    const allBtns=document.querySelectorAll('a, button');
    for(const b of allBtns){if(/^\s*Apply\s*$/i.test(b.textContent)&&b.offsetParent!==null){clickEl(b);await sleep(2000);break;}}
    const am=await waitFor("//*[@data-automation-id='applyManually']",8000,true);
    if(am){await sleep(500);clickEl(am);await sleep(2000);}
    const fp=await waitFor("[data-automation-id='quickApplyPage'],[data-automation-id='applyFlowAutoFillPage'],[data-automation-id='contactInformationPage'],[data-automation-id='applyFlowMyInfoPage'],[data-automation-id='ApplyFlowPage']",10000);
    if(fp){await sleep(1000);await triggerAutofill();workdayAutoNext();}
  }
  async function workdayAutoNext(){
    const ns="button[data-automation-id='bottom-navigation-next-button']:not([disabled]),button[data-automation-id='pageFooterNextButton']:not([disabled])";
    const go=async()=>{await sleep(3000);const b=document.querySelector(ns);if(b){clickEl(b);await sleep(2000);if(document.querySelector("[data-automation-id='reviewJobApplicationPage'],[data-automation-id='applyFlowReviewPage']"))return;await triggerAutofill();go();}};
    go();
  }

  // ===================== RESUME TAILORING =====================
  async function resumeTailoringAutomation(){
    if(!isJobright()||(!location.href.includes('plugin_tailor=1')&&!location.href.includes('/jobs/info/')))return;
    await sleep(3000);
    let el=await findByText('button,a,div[role="button"]',/improve my resume/i,8000);if(el){clickEl(el);await sleep(2000);}
    el=await findByText('button,a,div[role="button"],label,span',/full edit/i,5000);if(el){clickEl(el);await sleep(3000);}
    el=await findByText('button,a,span,div[role="button"],label',/select all/i,5000);if(el){clickEl(el);await sleep(1000);}
    el=await findByText('button,a,div[role="button"]',/generate (my new )?resume|generate$/i,5000);if(el)clickEl(el);
  }
  async function findByText(sel,re,to){const dl=Date.now()+(to||5000);while(Date.now()<dl){for(const e of document.querySelectorAll(sel))if(re.test(e.textContent?.trim())&&e.offsetParent!==null)return e;await sleep(500);}return null;}

  // ===================== AUTOFILL TRIGGER =====================
  async function triggerAutofill(){await waitFor('#jobright-helper-id',8000);await sleep(1500);let b=document.querySelector('.auto-fill-button');if(b&&!b.disabled){b.click();return true;}await sleep(3000);b=document.querySelector('.auto-fill-button');if(b&&!b.disabled){b.click();return true;}return false;}

  // ===================== QUEUE ENGINE =====================
  async function processQ(){if(!qActive||qPaused||!queue.length)return;const c=queue.find(j=>j.status==='applying');if(c){try{const p=new URL(c.url).pathname;if(location.href.includes(p.slice(0,Math.min(p.length,25)))){if(isWorkday())await workdayAutomation();else await triggerAutofill();c.status='done';await saveQ();renderQ();updateCtrl();await sleep(10000);goNext();return;}}catch{}}goNext();}
  function goNext(){if(qPaused)return;const n=queue.find(j=>j.status==='pending');if(n){n.status='applying';saveQ().then(()=>{location.href=n.url;});}else{qActive=false;st.set(SK.QA,false);renderQ();updateCtrl();}}
  async function startQ(){if(!queue.filter(j=>j.status==='pending').length)return;qActive=true;qPaused=false;await st.set(SK.QA,true);await st.set(SK.QP,false);updateCtrl();goNext();}
  async function stopQ(){qActive=false;qPaused=false;await st.set(SK.QA,false);await st.set(SK.QP,false);queue.forEach(j=>{if(j.status==='applying')j.status='pending';});await saveQ();renderQ();updateCtrl();}
  async function pauseQ(){qPaused=true;await st.set(SK.QP,true);renderQ();updateCtrl();}
  async function resumeQ(){qPaused=false;await st.set(SK.QP,false);processQ();renderQ();updateCtrl();}
  async function skipJob(){const c=queue.find(j=>j.status==='applying');if(c){c.status='failed';await saveQ();}goNext();}

  // ===================== CREDIT HIDE =====================
  function hideCredits(){
    document.querySelectorAll('.autofill-credit-row,.payment-entry,.plugin-setting-credits-tip').forEach(e=>e.style.display='none');
    document.querySelectorAll('.ant-modal-root').forEach(m=>{if(/remaining.*credit|upgrade.*turbo|out of credit|credits.*refill|get unlimited/i.test(m.textContent||''))m.style.display='none';});
    document.querySelectorAll('*').forEach(el=>{if(el.children.length===0&&/\d+\s*credits?\s*available/i.test(el.textContent||''))el.textContent=el.textContent.replace(/\d+\s*(credits?\s*available)/i,'Unlimited $1');});
  }

  // ===================== CSS =====================
  function injectCSS(){
    if(document.getElementById('ua-css'))return;
    const s=document.createElement('style');s.id='ua-css';
    s.textContent=`
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
  function ico(name,w,h,clr){
    w=w||16;h=h||16;const c=clr||'currentColor';
    const paths={
      bolt:`<path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z" fill="${c}"/>`,
      plus:`<line x1="12" y1="5" x2="12" y2="19" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
      pause:`<rect x="6" y="4" width="4" height="16" rx="1" fill="${c}"/><rect x="14" y="4" width="4" height="16" rx="1" fill="${c}"/>`,
      play:`<path d="M8 5v14l11-7z" fill="${c}"/>`,
      stop:`<rect x="6" y="6" width="12" height="12" rx="2" fill="${c}"/>`,
      skip:`<path d="M5 4l10 8-10 8V4z" fill="${c}"/><rect x="17" y="4" width="3" height="16" rx="1" fill="${c}"/>`,
      quit:`<circle cx="12" cy="12" r="9" fill="none" stroke="${c}" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="${c}" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="9" x2="15" y2="15" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`
    };
    return `<svg class="ico" width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${paths[name]||''}</svg>`;
  }

  // ===================== UI BUILD =====================
  function buildUI(){
    if(window.self!==window.top)return;

    // --- Main FAB (draggable) ---
    const fab=document.createElement('div');fab.id='ua-fab';
    fab.innerHTML=ico('bolt',22,22,'#fff')+'<span class="badge" id="ua-badge"></span>';
    document.body.appendChild(fab);
    makeDraggable(fab);
    fab.addEventListener('click',()=>{const d=document.getElementById('ua-drawer');d.classList.toggle('open');positionDrawer();});

    // --- Add-to-queue mini FAB ---
    const af=document.createElement('div');af.id='ua-fab-add';
    af.innerHTML=ico('plus',18,18,'#6ee7b7');
    af.title='Add this page to queue';
    document.body.appendChild(af);
    af.addEventListener('click',()=>addJob(location.href,document.title));

    // --- Automation control pill ---
    const ctrl=document.createElement('div');ctrl.id='ua-ctrl';
    ctrl.innerHTML=`<div id="ua-ctrl-pill">
      <div class="uc-seg info"><div><div class="uc-progress" id="uc-prog">0/0</div><div class="uc-lbl">Applied</div></div></div>
      <div class="uc-seg">
        <button class="uc-btn pause" id="uc-pause" title="Pause">${ico('pause',14,14,'#fbbf24')}</button>
        <button class="uc-btn skip" id="uc-skip" title="Skip">${ico('skip',14,14,'#60a5fa')}</button>
        <button class="uc-btn quit" id="uc-quit" title="Quit">${ico('quit',14,14,'#f87171')}</button>
      </div>
    </div>`;
    document.body.appendChild(ctrl);
    document.getElementById('uc-pause').addEventListener('click',()=>{if(qPaused)resumeQ();else pauseQ();});
    document.getElementById('uc-skip').addEventListener('click',skipJob);
    document.getElementById('uc-quit').addEventListener('click',stopQ);

    // --- Drawer ---
    const dw=document.createElement('div');dw.id='ua-drawer';
    dw.innerHTML=`
      <div class="ua-hdr"><div><div class="ua-hdr-t">Ultimate Autofill</div><div class="ua-hdr-sub">AI-Powered Job Applications</div></div><span class="ua-hdr-badge">UNLIMITED</span></div>
      <div class="ua-body">
        <div class="ua-sec">
          <div class="ua-sec-t">Auto-Apply</div>
          <div class="ua-tog"><div><div class="ua-tog-l">Auto-Apply on ATS Pages</div><div class="ua-tog-d">Auto-fill when job form detected</div></div><label class="ua-sw"><input type="checkbox" id="ua-aa"><span class="ua-sw-s"></span></label></div>
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
    const ab=document.createElement('div');ab.id='ua-ats';
    ab.innerHTML='<span class="dot"></span><span id="ua-ats-n"></span>';
    document.body.appendChild(ab);

    bindDrawer();
  }

  function positionDrawer(){
    const d=document.getElementById('ua-drawer');
    const f=document.getElementById('ua-fab');
    if(!d||!f)return;
    const r=f.getBoundingClientRect();
    d.style.bottom=(window.innerHeight-r.top+8)+'px';
    d.style.right=(window.innerWidth-r.right)+'px';
  }

  // ===================== DRAGGABLE =====================
  function makeDraggable(el){
    let sx,sy,ox,oy,dragging=false,moved=false;
    const onDown=e=>{
      e.preventDefault();
      const t=e.touches?e.touches[0]:e;
      sx=t.clientX;sy=t.clientY;
      const r=el.getBoundingClientRect();ox=r.left;oy=r.top;
      dragging=true;moved=false;
      el.style.transition='none';
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
      document.addEventListener('touchmove',onMove,{passive:false});document.addEventListener('touchend',onUp);
    };
    const onMove=e=>{
      if(!dragging)return;e.preventDefault();
      const t=e.touches?e.touches[0]:e;
      const dx=t.clientX-sx,dy=t.clientY-sy;
      if(Math.abs(dx)>3||Math.abs(dy)>3)moved=true;
      const nx=Math.max(0,Math.min(window.innerWidth-el.offsetWidth,ox+dx));
      const ny=Math.max(0,Math.min(window.innerHeight-el.offsetHeight,oy+dy));
      el.style.left=nx+'px';el.style.top=ny+'px';el.style.right='auto';el.style.bottom='auto';
    };
    const onUp=()=>{
      dragging=false;el.style.transition='';
      document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);
      document.removeEventListener('touchmove',onMove);document.removeEventListener('touchend',onUp);
      if(moved){
        // Save position
        st.set(SK.POS,{left:el.style.left,top:el.style.top});
        // Suppress click
        const suppress=ev=>{ev.stopPropagation();ev.preventDefault();};
        el.addEventListener('click',suppress,{capture:true,once:true});
      }
    };
    el.addEventListener('mousedown',onDown);el.addEventListener('touchstart',onDown,{passive:false});
    // Restore saved position
    st.get(SK.POS).then(p=>{if(p?.left){el.style.left=p.left;el.style.top=p.top;el.style.right='auto';el.style.bottom='auto';}});
  }

  // ===================== DRAWER EVENTS =====================
  function bindDrawer(){
    const tog=document.getElementById('ua-aa');tog.checked=autoApply;
    tog.addEventListener('change',async e=>{autoApply=e.target.checked;await st.set(SK.AA,autoApply);updateStat();if(autoApply&&isAppForm()){if(isWorkday())workdayAutomation();else triggerAutofill();}});

    const drop=document.getElementById('ua-drop'),csv=document.getElementById('ua-csv');
    drop.addEventListener('click',()=>csv.click());
    drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over');});
    drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
    drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');if(e.dataTransfer.files[0])handleFile(e.dataTransfer.files[0]);});
    csv.addEventListener('change',e=>{if(e.target.files[0])handleFile(e.target.files[0]);});

    document.getElementById('ua-add').addEventListener('click',()=>{const i=document.getElementById('ua-url');if(i.value.trim()){addJob(i.value.trim());i.value='';}});
    document.getElementById('ua-url').addEventListener('keypress',e=>{if(e.key==='Enter')document.getElementById('ua-add').click();});
    document.getElementById('ua-selall').addEventListener('change',e=>{if(e.target.checked)queue.forEach(j=>selected.add(j.id));else selected.clear();renderQ();});
    document.getElementById('ua-del').addEventListener('click',removeSelected);
  }

  async function handleFile(f){const u=parseCSV(await f.text());if(!u.length){alert('No valid URLs found.');return;}for(const x of u)await addJob(x);document.getElementById('ua-drawer').classList.add('open');positionDrawer();}

  // ===================== RENDER =====================
  function renderQ(){
    const list=document.getElementById('ua-qlist'),cnt=document.getElementById('ua-q-cnt'),sum=document.getElementById('ua-qsum'),btns=document.getElementById('ua-qbtns'),badge=document.getElementById('ua-badge'),del=document.getElementById('ua-del'),sa=document.getElementById('ua-selall'),info=document.getElementById('ua-q-info');
    if(!list)return;
    cnt.textContent=`(${queue.length})`;
    badge.textContent=queue.length||'';
    info.textContent=queue.length?queue.length+' URL'+(queue.length>1?'s':''):'';
    del.disabled=!selected.size;
    sa.checked=queue.length>0&&selected.size===queue.length;

    list.innerHTML=queue.map((j,i)=>`<div class="ua-qi"><input type="checkbox" data-id="${j.id}" class="qcb" ${selected.has(j.id)?'checked':''}><span class="num">${i+1}</span><span class="url" title="${j.url}">${j.title||j.url}</span><span class="st ${j.status}">${j.status}</span><button class="rm" data-id="${j.id}">&times;</button></div>`).join('');

    list.querySelectorAll('.qcb').forEach(c=>c.addEventListener('change',e=>{if(e.target.checked)selected.add(e.target.dataset.id);else selected.delete(e.target.dataset.id);renderQ();}));
    list.querySelectorAll('.rm').forEach(b=>b.addEventListener('click',e=>removeJob(e.currentTarget.dataset.id)));

    const pn=queue.filter(j=>j.status==='pending').length,dn=queue.filter(j=>j.status==='done').length,fl=queue.filter(j=>j.status==='failed').length,ap=queue.filter(j=>j.status==='applying').length;
    sum.innerHTML=queue.length?`<span><i style="background:#f59e0b"></i>${pn} pending</span><span><i style="background:#3b82f6"></i>${ap} active</span><span><i style="background:#10b981"></i>${dn} done</span>${fl?`<span><i style="background:#ef4444"></i>${fl} failed</span>`:''}` :'';

    if(!queue.length){btns.innerHTML='';return;}
    if(!qActive){btns.innerHTML=`<button class="pri" id="uq-start" ${pn?'':'disabled'}>Start Applying</button><button class="sec" id="uq-clear">Clear All</button>`;}
    else{btns.innerHTML=`<button class="dan" id="uq-stop">Stop</button>`;}
    document.getElementById('uq-start')?.addEventListener('click',startQ);
    document.getElementById('uq-stop')?.addEventListener('click',stopQ);
    document.getElementById('uq-clear')?.addEventListener('click',clearQ);
  }

  function updateCtrl(){
    const ctrl=document.getElementById('ua-ctrl');
    const prog=document.getElementById('uc-prog');
    const pauseBtn=document.getElementById('uc-pause');
    if(!ctrl)return;
    if(qActive){
      ctrl.classList.add('show');
      const dn=queue.filter(j=>j.status==='done').length;
      prog.textContent=dn+'/'+queue.length;
      if(qPaused){pauseBtn.innerHTML=ico('play',14,14,'#34d399');pauseBtn.className='uc-btn resume';pauseBtn.title='Resume';}
      else{pauseBtn.innerHTML=ico('pause',14,14,'#fbbf24');pauseBtn.className='uc-btn pause';pauseBtn.title='Pause';}
    }else{ctrl.classList.remove('show');}
  }

  function updateStat(){
    const el=document.getElementById('ua-stat'),t=document.getElementById('ua-stat-t');if(!el)return;
    const ats=detectATS();
    if(autoApply){el.className='ua-stat on';t.textContent=ats?'Active - '+ats+' detected':'Active - monitoring';}
    else{el.className='ua-stat off';t.textContent='Inactive';}
  }

  function showATSBadge(){const a=detectATS();if(a){document.getElementById('ua-ats-n').textContent=a+' Detected';document.getElementById('ua-ats').classList.add('show');}}

  // ===================== OBSERVER =====================
  function observe(){const o=new MutationObserver(()=>hideCredits());o.observe(document.body||document.documentElement,{childList:true,subtree:true});}

  // ===================== INIT =====================
  async function init(){
    if(window.self!==window.top)return;
    await load();injectCSS();buildUI();
    [500,1500,3000,5000,8000].forEach(ms=>setTimeout(hideCredits,ms));
    observe();showATSBadge();renderQ();updateStat();updateCtrl();
    if(autoApply&&isAppForm()){await sleep(2000);if(isWorkday())await workdayAutomation();else await triggerAutofill();}
    if(qActive){await sleep(2000);processQ();}
    if(isJobright()){await sleep(2000);resumeTailoringAutomation();}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
