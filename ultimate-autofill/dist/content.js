"use strict";
(() => {
  // src/atsDetector/platformRegistry.ts
  var PLATFORM_REGISTRY = [
    // ─── Existing Platforms ───
    {
      id: "workday",
      name: "Workday",
      domains: ["myworkdayjobs.com", "myworkday.com", "wd1.myworkdaysite.com", "wd3.myworkdaysite.com", "wd5.myworkdaysite.com"],
      urlPatterns: [/myworkdayjobs\.com/i, /myworkday\.com/i, /myworkdaysite\.com/i, /\.wd\d+\.myworkdayjobs\.com/i],
      domSignals: ["[data-automation-id]", "[data-uxi-element-id]"],
      metaSignals: [{ name: "generator", pattern: /workday/i }],
      enabled: true,
      supportsAutoSubmit: true,
      notes: "Multi-step forms with React components. Handles combobox/listbox interactions."
    },
    {
      id: "greenhouse",
      name: "Greenhouse",
      domains: ["greenhouse.io", "boards.greenhouse.io"],
      urlPatterns: [/greenhouse\.io/i, /boards\.greenhouse\.io/i],
      domSignals: ["#greenhouse_application", "#grnhse_app", "form#application_form"],
      metaSignals: [],
      enabled: true,
      supportsAutoSubmit: true,
      notes: "Uses bracket notation for field names: job_application[first_name]."
    },
    {
      id: "lever",
      name: "Lever",
      domains: ["lever.co", "jobs.lever.co"],
      urlPatterns: [/lever\.co/i, /jobs\.lever\.co/i],
      domSignals: [".lever-application-form", '[data-qa="application-form"]', ".posting-headline"],
      metaSignals: [],
      enabled: true,
      supportsAutoSubmit: true
    },
    {
      id: "smartrecruiters",
      name: "SmartRecruiters",
      domains: ["smartrecruiters.com", "jobs.smartrecruiters.com"],
      urlPatterns: [/smartrecruiters\.com/i],
      domSignals: ['[class*="smartrecruiters"]', ".st-apply-form", '[class*="ApplyButton"]'],
      metaSignals: [],
      enabled: true,
      supportsAutoSubmit: true
    },
    {
      id: "icims",
      name: "iCIMS",
      domains: ["icims.com", "careers-icims.com"],
      urlPatterns: [/icims\.com/i, /careers-icims\.com/i],
      domSignals: ["#icims_content", '[class*="icims"]', ".iCIMS_MainWrapper"],
      metaSignals: [],
      enabled: true,
      supportsAutoSubmit: true
    },
    {
      id: "taleo",
      name: "Taleo (Oracle)",
      domains: ["taleo.net", "taleoquickfind.com"],
      urlPatterns: [/taleo\.net/i, /taleoquickfind\.com/i],
      domSignals: ['[class*="taleo"]', "#requisitionDescriptionInterface", ".taleoContent"],
      metaSignals: [{ name: "generator", pattern: /taleo/i }],
      enabled: true,
      supportsAutoSubmit: true
    },
    {
      id: "ashby",
      name: "Ashby",
      domains: ["ashbyhq.com", "jobs.ashbyhq.com"],
      urlPatterns: [/ashbyhq\.com/i],
      domSignals: ["[data-ashby-job-posting-id]", ".ashby-job-posting-brief-location"],
      metaSignals: [],
      enabled: true,
      supportsAutoSubmit: true
    },
    {
      id: "bamboohr",
      name: "BambooHR",
      domains: ["bamboohr.com"],
      urlPatterns: [/bamboohr\.com/i],
      domSignals: [".BambooHR-ATS-board", '[class*="BambooHR"]'],
      metaSignals: [],
      enabled: true,
      supportsAutoSubmit: true
    },
    // ─── Newly Added Platforms ───
    {
      id: "oraclecloud",
      name: "Oracle Cloud HCM / Oracle Recruiting",
      domains: ["oraclecloud.com", "fa.oraclecloud.com"],
      urlPatterns: [/oraclecloud\.com/i, /fa\..*\.oraclecloud\.com/i, /hcm\d*.*\.oraclecloud\.com/i],
      domSignals: [
        '[class*="oracle"]',
        '[id*="oj-"]',
        ".oj-web-applcore-page",
        "[data-oj-binding-provider]",
        ".oj-flex",
        "#ojAppRoot"
      ],
      metaSignals: [{ name: "generator", pattern: /oracle/i }],
      enabled: true,
      supportsAutoSubmit: true,
      notes: "Oracle JET-based UI. Uses oj- prefixed component IDs. Dynamic SPA with knockout.js bindings."
    },
    {
      id: "linkedin",
      name: "LinkedIn (Non-Easy Apply Only)",
      domains: ["linkedin.com", "www.linkedin.com"],
      urlPatterns: [/linkedin\.com\/jobs/i, /linkedin\.com\/in/i],
      domSignals: [
        ".jobs-apply-button",
        ".jobs-unified-top-card",
        "[data-job-id]",
        ".jobs-details"
      ],
      metaSignals: [],
      enabled: true,
      supportsAutoSubmit: false,
      notes: "Only for non-Easy Apply flows. Easy Apply is filtered out by detection logic."
    },
    {
      id: "indeed",
      name: "Indeed",
      domains: ["indeed.com", "www.indeed.com", "apply.indeed.com"],
      urlPatterns: [/indeed\.com/i, /apply\.indeed\.com/i],
      domSignals: [
        "#jobsearch-ViewJobButtons-container",
        ".jobsearch-ViewJobLayout",
        '[data-testid="apply-button"]',
        "#ia-container"
      ],
      metaSignals: [],
      enabled: true,
      supportsAutoSubmit: true,
      notes: "Indeed Apply flow uses iframe-based application forms."
    }
  ];
  function isLinkedInEasyApply(doc) {
    const easyApplyBtn = doc.querySelector(".jobs-apply-button--top-card .jobs-apply-button");
    if (easyApplyBtn) {
      const text = easyApplyBtn.textContent?.toLowerCase() || "";
      return text.includes("easy apply");
    }
    const badge = doc.querySelector('[class*="easy-apply"]') || doc.querySelector('[data-is-easy-apply="true"]');
    return !!badge;
  }

  // src/atsDetector/index.ts
  var SIGS = PLATFORM_REGISTRY.filter((p) => p.enabled).map((p) => ({
    type: p.id,
    urls: p.urlPatterns,
    dom: p.domSignals,
    meta: p.metaSignals.map((m) => ({ name: m.name, pat: m.pattern }))
  }));
  function detectATS(doc) {
    const url = doc.location?.href || "";
    let best = "generic";
    let bestConf = 0;
    const bestSigs = [];
    for (const s of SIGS) {
      let conf = 0;
      const found = [];
      for (const p of s.urls) {
        if (p.test(url)) {
          conf += 0.5;
          found.push(`url:${p.source}`);
          break;
        }
      }
      for (const sel of s.dom) {
        try {
          if (doc.querySelector(sel)) {
            conf += 0.2;
            found.push(`dom:${sel}`);
            if (conf >= 0.9)
              break;
          }
        } catch {
        }
      }
      for (const m of s.meta) {
        const el = doc.querySelector(`meta[name="${m.name}"]`);
        if (el && m.pat.test(el.getAttribute("content") || "")) {
          conf += 0.3;
          found.push(`meta:${m.name}`);
        }
      }
      conf = Math.min(conf, 1);
      if (s.type === "linkedin" && conf > 0) {
        if (isLinkedInEasyApply(doc)) {
          continue;
        }
      }
      if (conf > bestConf) {
        bestConf = conf;
        best = s.type;
        bestSigs.length = 0;
        bestSigs.push(...found);
      }
    }
    if (best === "generic" || bestConf < 0.3) {
      const companySiteResult = detectCompanySite(doc, url);
      if (companySiteResult.confidence > bestConf) {
        return companySiteResult;
      }
    }
    return { type: best, confidence: bestConf, signals: bestSigs };
  }
  function detectCompanySite(doc, url) {
    let conf = 0;
    const signals = [];
    const careerPatterns = [
      /\/careers?\b/i,
      /\/jobs?\b/i,
      /\/apply\b/i,
      /\/openings?\b/i,
      /\/positions?\b/i,
      /\/hiring\b/i,
      /\/opportunities\b/i,
      /\/recruit/i,
      /\/talent\b/i,
      /\/work-with-us/i,
      /\/join-us/i,
      /\/join-our-team/i,
      /\/application\b/i
    ];
    for (const p of careerPatterns) {
      if (p.test(url)) {
        conf += 0.25;
        signals.push(`url:career-path`);
        break;
      }
    }
    const forms = doc.querySelectorAll("form");
    for (const form of forms) {
      const formText = (form.textContent || "").toLowerCase();
      const formHtml = (form.innerHTML || "").toLowerCase();
      const appFieldCount = countApplicationFields(form);
      if (appFieldCount >= 3) {
        conf += 0.3;
        signals.push(`form:${appFieldCount}-app-fields`);
        break;
      }
      const action = form.getAttribute("action") || "";
      const cls = form.className || "";
      if (/apply|application|candidate|submit/i.test(action + " " + cls)) {
        conf += 0.2;
        signals.push("form:apply-action");
      }
    }
    const title = doc.title.toLowerCase();
    const h1 = doc.querySelector("h1")?.textContent?.toLowerCase() || "";
    if (/apply|application|career|job|position|opening/i.test(title + " " + h1)) {
      conf += 0.15;
      signals.push("page:career-title");
    }
    const fileInputs = doc.querySelectorAll('input[type="file"]');
    for (const fi of fileInputs) {
      const accept = fi.getAttribute("accept") || "";
      const name = fi.getAttribute("name") || "";
      const label = getInputLabel(fi, doc);
      if (/resume|cv|curriculum|cover/i.test(accept + " " + name + " " + label)) {
        conf += 0.2;
        signals.push("form:resume-upload");
        break;
      }
    }
    conf = Math.min(conf, 1);
    if (conf >= 0.3) {
      return { type: "companysite", confidence: conf, signals };
    }
    return { type: "generic", confidence: 0, signals: [] };
  }
  function countApplicationFields(form) {
    const fields = form.querySelectorAll("input, textarea, select");
    let count = 0;
    const appFieldHints = [
      /name/i,
      /first/i,
      /last/i,
      /email/i,
      /phone/i,
      /resume/i,
      /cv/i,
      /cover/i,
      /address/i,
      /city/i,
      /state/i,
      /zip/i,
      /country/i,
      /experience/i,
      /education/i,
      /skill/i,
      /linkedin/i,
      /portfolio/i,
      /website/i,
      /salary/i,
      /start.?date/i,
      /authorized/i,
      /sponsor/i,
      /visa/i,
      /relocat/i,
      /referr/i
    ];
    for (const field of fields) {
      const name = field.getAttribute("name") || "";
      const id = field.getAttribute("id") || "";
      const placeholder = field.getAttribute("placeholder") || "";
      const label = getInputLabel(field, form.ownerDocument);
      const combined = `${name} ${id} ${placeholder} ${label}`.toLowerCase();
      if (appFieldHints.some((h) => h.test(combined)))
        count++;
    }
    return count;
  }
  function getInputLabel(el, doc) {
    if (el.id) {
      const lbl = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl?.textContent?.trim())
        return lbl.textContent.trim();
    }
    const wrap = el.closest("label");
    if (wrap?.textContent?.trim())
      return wrap.textContent.trim();
    return el.getAttribute("aria-label") || el.getAttribute("placeholder") || "";
  }
  function isApplicationPage(doc) {
    const result = detectATS(doc);
    return result.type !== "generic" && result.confidence >= 0.3;
  }
  function hasApplicationForm(doc) {
    const result = detectATS(doc);
    if (result.type !== "generic" && result.confidence >= 0.3)
      return true;
    const forms = doc.querySelectorAll("form");
    for (const form of forms) {
      const fields = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
      if (fields.length >= 2)
        return true;
    }
    return false;
  }

  // src/utils/fuzzy.ts
  function normalize(text) {
    return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function tokenize(text) {
    return normalize(text).split(" ").filter(Boolean);
  }
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0)
      return n;
    if (n === 0)
      return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    let curr = new Array(n + 1);
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        curr[j] = Math.min(
          prev[j] + 1,
          curr[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      [prev, curr] = [curr, prev];
    }
    return prev[n];
  }
  function stringSimilarity(a, b) {
    const na = normalize(a), nb = normalize(b);
    if (na === nb)
      return 1;
    const max = Math.max(na.length, nb.length);
    return max === 0 ? 1 : 1 - levenshtein(na, nb) / max;
  }
  function tokenOverlap(a, b) {
    if (!a.length && !b.length)
      return 1;
    if (!a.length || !b.length)
      return 0;
    const sa = new Set(a), sb = new Set(b);
    let inter = 0;
    for (const t of sa)
      if (sb.has(t))
        inter++;
    return inter / (/* @__PURE__ */ new Set([...sa, ...sb])).size;
  }
  function fuzzyTokenMatch(a, b) {
    if (!a.length)
      return b.length === 0 ? 1 : 0;
    let total = 0;
    for (const ta of a) {
      let best = 0;
      for (const tb of b)
        best = Math.max(best, stringSimilarity(ta, tb));
      total += best;
    }
    return total / a.length;
  }
  function hybridSimilarity(query, target, keywords) {
    const qt = tokenize(query), tt = tokenize(target);
    const direct = stringSimilarity(query, target) * 0.3;
    const overlap = tokenOverlap(qt, tt) * 0.25;
    const fuzzy = fuzzyTokenMatch(qt, tt) * 0.25;
    let kw = 0;
    if (keywords.length) {
      const nq = normalize(query);
      let hit = 0;
      for (const k of keywords)
        if (nq.includes(normalize(k)))
          hit++;
      kw = hit / keywords.length * 0.2;
    }
    return direct + overlap + fuzzy + kw;
  }

  // src/savedResponses/matcher.ts
  function scoreResponse(query, resp, opts = {}) {
    const parts = [];
    let score = 0;
    const qSim = hybridSimilarity(query, resp.question, resp.keywords);
    score += qSim * 0.45;
    parts.push(`q_sim=${qSim.toFixed(3)}`);
    const keyTokens = resp.key.split("|").filter(Boolean);
    const qTokens = tokenize(query);
    const keyOv = tokenOverlap(qTokens, keyTokens);
    score += keyOv * 0.2;
    parts.push(`key=${keyOv.toFixed(3)}`);
    const pop = Math.min(Math.log2(1 + resp.appearances) / 10, 1);
    score += pop * 0.1;
    parts.push(`pop=${pop.toFixed(3)}`);
    let rec = 0;
    if (resp.lastUsedAt) {
      const days = (Date.now() - new Date(resp.lastUsedAt).getTime()) / 864e5;
      rec = Math.max(0, 1 - days / 90);
    }
    score += rec * 0.1;
    parts.push(`rec=${rec.toFixed(3)}`);
    let ctx = 0;
    if (opts.domain && resp.domains?.includes(opts.domain)) {
      ctx += 0.5;
      parts.push("dom+");
    }
    if (opts.atsType && resp.atsTypes?.includes(opts.atsType)) {
      ctx += 0.5;
      parts.push("ats+");
    }
    score += Math.min(ctx, 1) * 0.1;
    let kwb = 0;
    if (resp.keywords.length) {
      const nq = normalize(query);
      let hit = 0;
      for (const k of resp.keywords)
        if (nq.includes(k.toLowerCase()))
          hit++;
      kwb = hit / resp.keywords.length;
    }
    score += kwb * 0.05;
    parts.push(`kw=${kwb.toFixed(3)}`);
    return { score: Math.min(score, 1), explanation: parts.join(", ") };
  }
  function findMatches(query, responses, opts = {}) {
    const max = opts.maxResults || 3;
    if (!query.trim() || !responses.length)
      return [];
    return responses.map((r) => {
      const { score, explanation } = scoreResponse(query, r, opts);
      return { response: r, score, explanation };
    }).filter((s) => s.score > 0.15).sort((a, b) => b.score - a.score).slice(0, max);
  }
  function findBestMatch(query, responses, opts = {}) {
    const m = findMatches(query, responses, { ...opts, maxResults: 1 });
    return m.length && m[0].score >= 0.3 ? m[0] : null;
  }

  // src/fieldMatcher/index.ts
  function extractFieldSignals(element) {
    const signals = [];
    if (element.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (lbl?.textContent?.trim())
        signals.push({ source: "label-for", value: lbl.textContent.trim(), weight: 1 });
    }
    const wrap = element.closest("label");
    if (wrap) {
      const t = directText(wrap).trim();
      if (t)
        signals.push({ source: "label-wrap", value: t, weight: 0.95 });
    }
    const al = element.getAttribute("aria-label");
    if (al?.trim())
      signals.push({ source: "aria-label", value: al.trim(), weight: 0.9 });
    const alb = element.getAttribute("aria-labelledby");
    if (alb) {
      const txt = alb.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(" ");
      if (txt)
        signals.push({ source: "aria-labelledby", value: txt, weight: 0.9 });
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const ph = element.placeholder;
      if (ph?.trim())
        signals.push({ source: "placeholder", value: ph.trim(), weight: 0.7 });
    }
    const name = element.getAttribute("name");
    if (name?.trim())
      signals.push({ source: "name", value: humanize(name), weight: 0.6 });
    if (element.id)
      signals.push({ source: "id", value: humanize(element.id), weight: 0.5 });
    const ac = element.getAttribute("autocomplete");
    if (ac?.trim() && ac !== "off")
      signals.push({ source: "autocomplete", value: ac.trim(), weight: 0.85 });
    const role = element.getAttribute("role");
    if (role?.trim())
      signals.push({ source: "role", value: role.trim(), weight: 0.3 });
    const gc = groupContext(element);
    if (gc)
      signals.push({ source: "group-context", value: gc, weight: 0.4 });
    const nt = nearbyText(element);
    if (nt)
      signals.push({ source: "nearby-text", value: nt, weight: 0.35 });
    return signals;
  }
  function directText(el) {
    let t = "";
    for (const n of el.childNodes)
      if (n.nodeType === Node.TEXT_NODE)
        t += n.textContent || "";
    return t;
  }
  function humanize(name) {
    return name.replace(/[\[\]]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_\-\.]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function groupContext(el) {
    const fs = el.closest("fieldset");
    if (fs) {
      const lg = fs.querySelector("legend");
      if (lg?.textContent?.trim())
        return lg.textContent.trim();
    }
    let n = el;
    while (n && n !== document.body) {
      const prev = n.previousElementSibling;
      if (prev && /^h[1-6]$/i.test(prev.tagName))
        return prev.textContent?.trim() || null;
      n = n.parentElement;
    }
    return null;
  }
  function nearbyText(el) {
    const prev = el.previousElementSibling;
    if (prev && prev.textContent?.trim() && !isFormEl(prev)) {
      const t = prev.textContent.trim();
      if (t.length < 100)
        return t;
    }
    const par = el.parentElement;
    if (par) {
      const t = directText(par).trim();
      if (t && t.length < 100)
        return t;
    }
    return null;
  }
  function isFormEl(el) {
    return ["input", "textarea", "select", "button"].includes(el.tagName.toLowerCase());
  }
  var FIELD_SELECTOR = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([disabled])',
    "textarea:not([disabled])",
    "select:not([disabled])",
    '[role="combobox"]:not([disabled])',
    '[role="listbox"]:not([disabled])',
    '[role="textbox"]:not([disabled])',
    '[contenteditable="true"]'
  ].join(", ");
  function discoverFields(doc) {
    const fields = [];
    for (const el of doc.querySelectorAll(FIELD_SELECTOR)) {
      if (el.offsetParent === null && el.style.display !== "contents")
        continue;
      const type = fieldType(el);
      const signals = extractFieldSignals(el);
      fields.push({ element: el, type, signals, groupContext: signals.find((s) => s.source === "group-context")?.value });
    }
    return fields;
  }
  function fieldType(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "input")
      return el.type || "text";
    if (tag === "textarea")
      return "textarea";
    if (tag === "select")
      return "select";
    const r = el.getAttribute("role");
    if (r)
      return r;
    if (el.contentEditable === "true")
      return "contenteditable";
    return "unknown";
  }
  function buildFieldQuery(fi) {
    const sorted = [...fi.signals].sort((a, b) => b.weight - a.weight);
    if (!sorted.length)
      return "";
    const primary = sorted[0].value;
    const parts = [primary];
    for (let i = 1; i < Math.min(sorted.length, 3); i++) {
      if (sorted[i].value !== primary)
        parts.push(sorted[i].value);
    }
    return parts.join(" ");
  }
  function matchFields(fields, responses, opts = {}) {
    const results = [];
    for (const f of fields) {
      const q = buildFieldQuery(f);
      if (!q)
        continue;
      const m = findBestMatch(q, responses, opts);
      if (m)
        results.push({ field: f.element, response: m.response, score: m.score, signals: f.signals, explanation: `Query: "${q}" | ${m.explanation}` });
    }
    return results.sort((a, b) => b.score - a.score);
  }

  // src/adapters/workday/index.ts
  var FIELD_MAP = {
    legalNameSection_firstName: "First Name",
    legalNameSection_lastName: "Last Name",
    addressSection_addressLine1: "Address Line 1",
    addressSection_city: "City",
    addressSection_countryRegion: "Country",
    addressSection_postalCode: "Postal Code",
    "phone-number": "Phone Number",
    email: "Email Address",
    source: "How did you hear about us"
  };
  function humanizeId(id) {
    return id.replace(/Section_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_\-]+/g, " ").trim();
  }
  function elType(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "input")
      return el.type || "text";
    if (tag === "textarea")
      return "textarea";
    if (tag === "select")
      return "select";
    return el.getAttribute("role") || "unknown";
  }
  var delay = (ms) => new Promise((r) => setTimeout(r, ms));
  var workdayAdapter = {
    type: "workday",
    detect(doc) {
      const signals = [];
      let conf = 0;
      const docHref = doc.location?.href;
      const url = (docHref && docHref !== "about:blank" ? docHref : null) || (typeof window !== "undefined" ? window.location?.href : "") || "";
      if (/myworkdayjobs\.com|myworkday\.com/i.test(url)) {
        conf += 0.5;
        signals.push("url");
      }
      if (doc.querySelector("[data-automation-id]")) {
        conf += 0.3;
        signals.push("data-automation-id");
      }
      if (doc.querySelector("[data-uxi-element-id]")) {
        conf += 0.2;
        signals.push("data-uxi-element-id");
      }
      return { type: "workday", confidence: Math.min(conf, 1), signals };
    },
    getFields(doc) {
      const fields = [];
      const els = doc.querySelectorAll(
        '[data-automation-id] input, [data-automation-id] textarea, [data-automation-id] select, [data-automation-id] [role="combobox"], [data-automation-id] [role="listbox"]'
      );
      for (const el of els) {
        if (el.offsetParent === null)
          continue;
        const signals = extractFieldSignals(el);
        const container = el.closest("[data-automation-id]");
        if (container) {
          const aid = container.getAttribute("data-automation-id") || "";
          const mapped = FIELD_MAP[aid];
          signals.push({
            source: "workday-automation-id",
            value: mapped || humanizeId(aid),
            weight: mapped ? 1 : 0.8
          });
        }
        fields.push({ element: el, type: elType(el), signals });
      }
      const seen = new Set(fields.map((f) => f.element));
      for (const el of doc.querySelectorAll('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])')) {
        if (seen.has(el) || el.offsetParent === null)
          continue;
        const signals = extractFieldSignals(el);
        if (signals.length)
          fields.push({ element: el, type: elType(el), signals });
      }
      return fields;
    },
    async fillField(field, value) {
      try {
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          const setter = Object.getOwnPropertyDescriptor(
            field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            "value"
          )?.set;
          if (setter)
            setter.call(field, value);
          else
            field.value = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.dispatchEvent(new Event("change", { bubbles: true }));
          field.dispatchEvent(new Event("blur", { bubbles: true }));
          return true;
        }
        if (field instanceof HTMLSelectElement) {
          const opt = Array.from(field.options).find((o) => o.text.toLowerCase().includes(value.toLowerCase()) || o.value.toLowerCase() === value.toLowerCase());
          if (opt) {
            field.value = opt.value;
            field.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          return false;
        }
        if (field.getAttribute("role") === "combobox" || field.getAttribute("role") === "listbox") {
          field.click();
          await delay(200);
          const inp = field.querySelector("input");
          if (inp) {
            inp.value = value;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
          }
          await delay(300);
          for (const opt of document.querySelectorAll('[role="option"]')) {
            if (opt.textContent?.toLowerCase().includes(value.toLowerCase())) {
              opt.click();
              return true;
            }
          }
          return false;
        }
        if (field.contentEditable === "true") {
          field.textContent = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
  };

  // src/adapters/greenhouse/index.ts
  var ID_MAP = {
    first_name: "First Name",
    last_name: "Last Name",
    email: "Email Address",
    phone: "Phone Number",
    resume: "Resume",
    cover_letter: "Cover Letter",
    linkedin_profile: "LinkedIn Profile",
    website: "Website",
    location: "Location",
    how_did_you_hear: "How did you hear about us"
  };
  function humanize2(s) {
    return s.replace(/[\[\]]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function elType2(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "input")
      return el.type || "text";
    if (tag === "textarea")
      return "textarea";
    if (tag === "select")
      return "select";
    return el.getAttribute("role") || "unknown";
  }
  var greenhouseAdapter = {
    type: "greenhouse",
    detect(doc) {
      const signals = [];
      let conf = 0;
      const docHref = doc.location?.href;
      const url = (docHref && docHref !== "about:blank" ? docHref : null) || (typeof window !== "undefined" ? window.location?.href : "") || "";
      if (/greenhouse\.io/i.test(url)) {
        conf += 0.5;
        signals.push("url");
      }
      if (doc.querySelector("#greenhouse_application") || doc.querySelector("#grnhse_app")) {
        conf += 0.3;
        signals.push("greenhouse container");
      }
      if (doc.querySelector("form#application_form")) {
        conf += 0.2;
        signals.push("application_form");
      }
      return { type: "greenhouse", confidence: Math.min(conf, 1), signals };
    },
    getFields(doc) {
      const fields = [];
      const container = doc.querySelector("#greenhouse_application") || doc.querySelector("#grnhse_app") || doc;
      const els = container.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      for (const el of els) {
        if (el.offsetParent === null)
          continue;
        const signals = extractFieldSignals(el);
        const name = el.getAttribute("name") || "";
        const bracketMatch = name.match(/\[(\w+)\]$/);
        if (bracketMatch) {
          const key = bracketMatch[1];
          const mapped = ID_MAP[key];
          signals.push({
            source: "greenhouse-field-key",
            value: mapped || humanize2(key),
            weight: mapped ? 1 : 0.75
          });
        }
        const dataQ = el.closest("[data-question]");
        if (dataQ) {
          const qText = dataQ.getAttribute("data-question") || "";
          if (qText)
            signals.push({ source: "greenhouse-data-question", value: qText, weight: 0.95 });
        }
        fields.push({ element: el, type: elType2(el), signals });
      }
      return fields;
    },
    async fillField(field, value) {
      try {
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          field.focus();
          field.value = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.dispatchEvent(new Event("change", { bubbles: true }));
          field.dispatchEvent(new Event("blur", { bubbles: true }));
          return true;
        }
        if (field instanceof HTMLSelectElement) {
          const opt = Array.from(field.options).find(
            (o) => o.text.toLowerCase().includes(value.toLowerCase()) || o.value.toLowerCase() === value.toLowerCase()
          );
          if (opt) {
            field.value = opt.value;
            field.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          return false;
        }
        if (field.contentEditable === "true") {
          field.textContent = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
  };

  // src/adapters/lever/index.ts
  var ID_MAP2 = {
    name: "Full Name",
    email: "Email Address",
    phone: "Phone Number",
    org: "Current Company",
    urls: "LinkedIn / Website",
    resume: "Resume",
    comments: "Additional Information"
  };
  function elType3(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "input")
      return el.type || "text";
    if (tag === "textarea")
      return "textarea";
    if (tag === "select")
      return "select";
    return el.getAttribute("role") || "unknown";
  }
  var leverAdapter = {
    type: "lever",
    detect(doc) {
      const signals = [];
      let conf = 0;
      const docHref = doc.location?.href;
      const url = (docHref && docHref !== "about:blank" ? docHref : null) || (typeof window !== "undefined" ? window.location?.href : "") || "";
      if (/lever\.co/i.test(url)) {
        conf += 0.5;
        signals.push("url:lever");
      }
      if (doc.querySelector(".lever-application-form")) {
        conf += 0.3;
        signals.push("lever-form");
      }
      if (doc.querySelector('[data-qa="application-form"]')) {
        conf += 0.2;
        signals.push("data-qa");
      }
      return { type: "lever", confidence: Math.min(conf, 1), signals };
    },
    getFields(doc) {
      const fields = [];
      const container = doc.querySelector(".lever-application-form") || doc.querySelector('[data-qa="application-form"]') || doc;
      const els = container.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      for (const el of els) {
        if (el.offsetParent === null)
          continue;
        const signals = extractFieldSignals(el);
        const name = el.getAttribute("name") || "";
        if (name && ID_MAP2[name]) {
          signals.push({ source: "lever-field-name", value: ID_MAP2[name], weight: 1 });
        }
        const card = el.closest(".application-question");
        if (card) {
          const label = card.querySelector(".application-label");
          if (label?.textContent?.trim()) {
            signals.push({ source: "lever-question-label", value: label.textContent.trim(), weight: 0.95 });
          }
        }
        fields.push({ element: el, type: elType3(el), signals });
      }
      return fields;
    },
    async fillField(field, value) {
      try {
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          field.focus();
          field.value = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.dispatchEvent(new Event("change", { bubbles: true }));
          field.dispatchEvent(new Event("blur", { bubbles: true }));
          return true;
        }
        if (field instanceof HTMLSelectElement) {
          const opt = Array.from(field.options).find(
            (o) => o.text.toLowerCase().includes(value.toLowerCase()) || o.value.toLowerCase() === value.toLowerCase()
          );
          if (opt) {
            field.value = opt.value;
            field.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          return false;
        }
        if (field.contentEditable === "true") {
          field.textContent = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
  };

  // src/adapters/smartrecruiters/index.ts
  var delay2 = (ms) => new Promise((r) => setTimeout(r, ms));
  function elType4(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "input")
      return el.type || "text";
    if (tag === "textarea")
      return "textarea";
    if (tag === "select")
      return "select";
    return el.getAttribute("role") || "unknown";
  }
  var smartrecruitersAdapter = {
    type: "smartrecruiters",
    detect(doc) {
      const signals = [];
      let conf = 0;
      const docHref = doc.location?.href;
      const url = (docHref && docHref !== "about:blank" ? docHref : null) || (typeof window !== "undefined" ? window.location?.href : "") || "";
      if (/smartrecruiters\.com/i.test(url)) {
        conf += 0.5;
        signals.push("url:smartrecruiters");
      }
      if (doc.querySelector('[class*="smartrecruiters"]') || doc.querySelector(".st-apply-form")) {
        conf += 0.3;
        signals.push("sr-form");
      }
      if (doc.querySelector('[class*="ApplyButton"]')) {
        conf += 0.2;
        signals.push("apply-btn");
      }
      return { type: "smartrecruiters", confidence: Math.min(conf, 1), signals };
    },
    getFields(doc) {
      const fields = [];
      const container = doc.querySelector(".st-apply-form") || doc.querySelector('[class*="smartrecruiters"]') || doc;
      const els = container.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"], [role="listbox"]'
      );
      for (const el of els) {
        if (el.offsetParent === null)
          continue;
        const signals = extractFieldSignals(el);
        const dataTest = el.getAttribute("data-test") || el.closest("[data-test]")?.getAttribute("data-test");
        if (dataTest) {
          signals.push({ source: "sr-data-test", value: dataTest.replace(/[-_]/g, " "), weight: 0.85 });
        }
        fields.push({ element: el, type: elType4(el), signals });
      }
      return fields;
    },
    async fillField(field, value) {
      try {
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          field.focus();
          const setter = Object.getOwnPropertyDescriptor(
            field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            "value"
          )?.set;
          if (setter)
            setter.call(field, value);
          else
            field.value = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.dispatchEvent(new Event("change", { bubbles: true }));
          field.dispatchEvent(new Event("blur", { bubbles: true }));
          return true;
        }
        if (field instanceof HTMLSelectElement) {
          const opt = Array.from(field.options).find(
            (o) => o.text.toLowerCase().includes(value.toLowerCase()) || o.value.toLowerCase() === value.toLowerCase()
          );
          if (opt) {
            field.value = opt.value;
            field.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          return false;
        }
        if (field.getAttribute("role") === "combobox" || field.getAttribute("role") === "listbox") {
          field.click();
          await delay2(200);
          const inp = field.querySelector("input");
          if (inp) {
            inp.value = value;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
          }
          await delay2(300);
          for (const opt of document.querySelectorAll('[role="option"]')) {
            if (opt.textContent?.toLowerCase().includes(value.toLowerCase())) {
              opt.click();
              return true;
            }
          }
          return false;
        }
        if (field.contentEditable === "true") {
          field.textContent = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
  };

  // src/adapters/oraclecloud/index.ts
  var FIELD_MAP2 = {
    firstName: "First Name",
    lastName: "Last Name",
    email: "Email Address",
    phoneNumber: "Phone Number",
    addressLine1: "Address Line 1",
    city: "City",
    state: "State",
    postalCode: "Postal Code",
    country: "Country",
    resume: "Resume",
    coverLetter: "Cover Letter",
    linkedInUrl: "LinkedIn Profile"
  };
  function elType5(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "input")
      return el.type || "text";
    if (tag === "textarea")
      return "textarea";
    if (tag === "select")
      return "select";
    return el.getAttribute("role") || "unknown";
  }
  var delay3 = (ms) => new Promise((r) => setTimeout(r, ms));
  var oraclecloudAdapter = {
    type: "oraclecloud",
    detect(doc) {
      const signals = [];
      let conf = 0;
      const docHref = doc.location?.href;
      const url = (docHref && docHref !== "about:blank" ? docHref : null) || (typeof window !== "undefined" ? window.location?.href : "") || "";
      if (/oraclecloud\.com/i.test(url)) {
        conf += 0.5;
        signals.push("url:oraclecloud");
      }
      if (doc.querySelector('[id*="oj-"]') || doc.querySelector("[data-oj-binding-provider]")) {
        conf += 0.3;
        signals.push("oracle-jet-ui");
      }
      if (doc.querySelector(".oj-flex") || doc.querySelector("#ojAppRoot")) {
        conf += 0.2;
        signals.push("oj-components");
      }
      return { type: "oraclecloud", confidence: Math.min(conf, 1), signals };
    },
    getFields(doc) {
      const fields = [];
      const selectors = [
        'input:not([type="hidden"]):not([type="submit"]):not([disabled])',
        "textarea:not([disabled])",
        "select:not([disabled])",
        "oj-input-text",
        "oj-input-password",
        "oj-select-single",
        "oj-select-many",
        "oj-combobox-one",
        "oj-combobox-many",
        "oj-text-area",
        '[role="combobox"]',
        '[role="listbox"]'
      ].join(", ");
      for (const el of doc.querySelectorAll(selectors)) {
        if (el.offsetParent === null)
          continue;
        const signals = extractFieldSignals(el);
        const ojId = el.getAttribute("id") || "";
        if (ojId) {
          const key = ojId.replace(/^oj-/, "").replace(/[\d-]+$/, "");
          const mapped = FIELD_MAP2[key];
          if (mapped) {
            signals.push({ source: "oracle-field-id", value: mapped, weight: 1 });
          }
        }
        const labelHint = el.getAttribute("label-hint");
        if (labelHint) {
          signals.push({ source: "oracle-label-hint", value: labelHint, weight: 0.95 });
        }
        fields.push({ element: el, type: elType5(el), signals });
      }
      return fields;
    },
    async fillField(field, value) {
      try {
        const tagName = field.tagName.toLowerCase();
        if (tagName.startsWith("oj-")) {
          const inp = field.querySelector("input") || field.querySelector("textarea");
          if (inp) {
            inp.focus();
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
            if (setter)
              setter.call(inp, value);
            else
              inp.value = value;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
            inp.dispatchEvent(new Event("blur", { bubbles: true }));
            return true;
          }
          if (tagName.includes("select") || tagName.includes("combobox")) {
            field.click();
            await delay3(300);
            for (const opt of document.querySelectorAll('[role="option"], oj-option')) {
              if (opt.textContent?.toLowerCase().includes(value.toLowerCase())) {
                opt.click();
                return true;
              }
            }
          }
          return false;
        }
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          const setter = Object.getOwnPropertyDescriptor(
            field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            "value"
          )?.set;
          if (setter)
            setter.call(field, value);
          else
            field.value = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.dispatchEvent(new Event("change", { bubbles: true }));
          field.dispatchEvent(new Event("blur", { bubbles: true }));
          return true;
        }
        if (field instanceof HTMLSelectElement) {
          const opt = Array.from(field.options).find((o) => o.text.toLowerCase().includes(value.toLowerCase()) || o.value.toLowerCase() === value.toLowerCase());
          if (opt) {
            field.value = opt.value;
            field.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          return false;
        }
        if (field.getAttribute("role") === "combobox" || field.getAttribute("role") === "listbox") {
          field.click();
          await delay3(200);
          const inp = field.querySelector("input");
          if (inp) {
            inp.value = value;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
          }
          await delay3(300);
          for (const opt of document.querySelectorAll('[role="option"]')) {
            if (opt.textContent?.toLowerCase().includes(value.toLowerCase())) {
              opt.click();
              return true;
            }
          }
          return false;
        }
        if (field.contentEditable === "true") {
          field.textContent = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
  };

  // src/adapters/indeed/index.ts
  var delay4 = (ms) => new Promise((r) => setTimeout(r, ms));
  function elType6(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "input")
      return el.type || "text";
    if (tag === "textarea")
      return "textarea";
    if (tag === "select")
      return "select";
    return el.getAttribute("role") || "unknown";
  }
  var indeedAdapter = {
    type: "indeed",
    detect(doc) {
      const signals = [];
      let conf = 0;
      const docHref = doc.location?.href;
      const url = (docHref && docHref !== "about:blank" ? docHref : null) || (typeof window !== "undefined" ? window.location?.href : "") || "";
      if (/indeed\.com/i.test(url)) {
        conf += 0.5;
        signals.push("url:indeed");
      }
      if (/apply\.indeed\.com/i.test(url)) {
        conf += 0.3;
        signals.push("url:indeed-apply");
      }
      if (doc.querySelector("#ia-container") || doc.querySelector('[data-testid="apply-button"]')) {
        conf += 0.2;
        signals.push("indeed-apply-ui");
      }
      return { type: "indeed", confidence: Math.min(conf, 1), signals };
    },
    getFields(doc) {
      const fields = [];
      const container = doc.querySelector("#ia-container") || doc.querySelector(".ia-BasePage") || doc;
      const els = container.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"], [role="listbox"]'
      );
      for (const el of els) {
        if (el.offsetParent === null)
          continue;
        const signals = extractFieldSignals(el);
        const testId = el.getAttribute("data-testid") || el.closest("[data-testid]")?.getAttribute("data-testid");
        if (testId) {
          signals.push({ source: "indeed-testid", value: testId.replace(/[-_]/g, " "), weight: 0.85 });
        }
        const questionContainer = el.closest(".ia-Questions-item") || el.closest("[data-testid]");
        if (questionContainer) {
          const label = questionContainer.querySelector("label, .ia-Questions-label");
          if (label?.textContent?.trim()) {
            signals.push({ source: "indeed-question", value: label.textContent.trim(), weight: 0.95 });
          }
        }
        fields.push({ element: el, type: elType6(el), signals });
      }
      return fields;
    },
    async fillField(field, value) {
      try {
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          field.focus();
          const setter = Object.getOwnPropertyDescriptor(
            field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            "value"
          )?.set;
          if (setter)
            setter.call(field, value);
          else
            field.value = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.dispatchEvent(new Event("change", { bubbles: true }));
          field.dispatchEvent(new Event("blur", { bubbles: true }));
          return true;
        }
        if (field instanceof HTMLSelectElement) {
          const opt = Array.from(field.options).find(
            (o) => o.text.toLowerCase().includes(value.toLowerCase()) || o.value.toLowerCase() === value.toLowerCase()
          );
          if (opt) {
            field.value = opt.value;
            field.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          return false;
        }
        if (field.getAttribute("role") === "combobox" || field.getAttribute("role") === "listbox") {
          field.click();
          await delay4(200);
          const inp = field.querySelector("input");
          if (inp) {
            inp.value = value;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
          }
          await delay4(300);
          for (const opt of document.querySelectorAll('[role="option"]')) {
            if (opt.textContent?.toLowerCase().includes(value.toLowerCase())) {
              opt.click();
              return true;
            }
          }
          return false;
        }
        if (field.contentEditable === "true") {
          field.textContent = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
  };

  // src/adapters/linkedin/index.ts
  var delay5 = (ms) => new Promise((r) => setTimeout(r, ms));
  function elType7(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "input")
      return el.type || "text";
    if (tag === "textarea")
      return "textarea";
    if (tag === "select")
      return "select";
    return el.getAttribute("role") || "unknown";
  }
  var linkedinAdapter = {
    type: "linkedin",
    detect(doc) {
      const signals = [];
      let conf = 0;
      const docHref = doc.location?.href;
      const url = (docHref && docHref !== "about:blank" ? docHref : null) || (typeof window !== "undefined" ? window.location?.href : "") || "";
      if (/linkedin\.com\/jobs/i.test(url)) {
        conf += 0.5;
        signals.push("url:linkedin-jobs");
      }
      if (doc.querySelector(".jobs-apply-button") || doc.querySelector("[data-job-id]")) {
        conf += 0.3;
        signals.push("linkedin-job-ui");
      }
      const easyApplyBtn = doc.querySelector(".jobs-apply-button--top-card");
      if (easyApplyBtn?.textContent?.toLowerCase().includes("easy apply")) {
        return { type: "linkedin", confidence: 0, signals: ["easy-apply-skipped"] };
      }
      return { type: "linkedin", confidence: Math.min(conf, 1), signals };
    },
    getFields(doc) {
      const fields = [];
      const container = doc.querySelector(".jobs-easy-apply-content") || doc.querySelector(".jobs-apply-form") || doc;
      const els = container.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]'
      );
      for (const el of els) {
        if (el.offsetParent === null)
          continue;
        const signals = extractFieldSignals(el);
        const formComponent = el.closest("[data-test-form-element]");
        if (formComponent) {
          const testLabel = formComponent.getAttribute("data-test-form-element");
          if (testLabel)
            signals.push({ source: "linkedin-form-element", value: testLabel, weight: 0.9 });
        }
        fields.push({ element: el, type: elType7(el), signals });
      }
      return fields;
    },
    async fillField(field, value) {
      try {
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          field.focus();
          await delay5(50);
          const setter = Object.getOwnPropertyDescriptor(
            field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            "value"
          )?.set;
          if (setter)
            setter.call(field, value);
          else
            field.value = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.dispatchEvent(new Event("change", { bubbles: true }));
          field.dispatchEvent(new Event("blur", { bubbles: true }));
          return true;
        }
        if (field instanceof HTMLSelectElement) {
          const opt = Array.from(field.options).find(
            (o) => o.text.toLowerCase().includes(value.toLowerCase()) || o.value.toLowerCase() === value.toLowerCase()
          );
          if (opt) {
            field.value = opt.value;
            field.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          return false;
        }
        if (field.getAttribute("role") === "combobox") {
          field.click();
          await delay5(200);
          const inp = field.querySelector("input");
          if (inp) {
            inp.value = value;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
          }
          await delay5(300);
          for (const opt of document.querySelectorAll('[role="option"]')) {
            if (opt.textContent?.toLowerCase().includes(value.toLowerCase())) {
              opt.click();
              return true;
            }
          }
          return false;
        }
        if (field.contentEditable === "true") {
          field.textContent = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
  };

  // src/adapters/generic/index.ts
  var genericAdapter = {
    type: "generic",
    detect(_doc) {
      return { type: "generic", confidence: 0.1, signals: ["fallback"] };
    },
    getFields(doc) {
      return discoverFields(doc);
    },
    async fillField(field, value) {
      try {
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          const setter = Object.getOwnPropertyDescriptor(
            field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            "value"
          )?.set;
          if (setter)
            setter.call(field, value);
          else
            field.value = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.dispatchEvent(new Event("change", { bubbles: true }));
          field.dispatchEvent(new Event("blur", { bubbles: true }));
          field.dispatchEvent(new Event("focus", { bubbles: true }));
          return true;
        }
        if (field instanceof HTMLSelectElement) {
          const opt = Array.from(field.options).find(
            (o) => o.text.toLowerCase().includes(value.toLowerCase()) || o.value.toLowerCase() === value.toLowerCase()
          );
          if (opt) {
            field.value = opt.value;
            field.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          return false;
        }
        if (field.getAttribute("role") === "combobox" || field.getAttribute("role") === "listbox") {
          field.click();
          await new Promise((r) => setTimeout(r, 200));
          const inp = field.querySelector("input");
          if (inp) {
            inp.value = value;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
          }
          await new Promise((r) => setTimeout(r, 300));
          for (const opt of document.querySelectorAll('[role="option"]')) {
            if (opt.textContent?.toLowerCase().includes(value.toLowerCase())) {
              opt.click();
              return true;
            }
          }
          return false;
        }
        if (field instanceof HTMLInputElement && (field.type === "radio" || field.type === "checkbox")) {
          const lbl = field.closest("label")?.textContent?.trim() || "";
          if (lbl.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase() === "yes" || value.toLowerCase() === "true") {
            field.checked = true;
            field.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          return false;
        }
        if (field.contentEditable === "true") {
          field.textContent = value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
  };

  // src/adapters/index.ts
  var adapters = {
    workday: workdayAdapter,
    greenhouse: greenhouseAdapter,
    lever: leverAdapter,
    smartrecruiters: smartrecruitersAdapter,
    oraclecloud: oraclecloudAdapter,
    indeed: indeedAdapter,
    linkedin: linkedinAdapter,
    companysite: genericAdapter,
    // company sites use the universal generic adapter
    generic: genericAdapter
  };
  function getAdapter(type) {
    return adapters[type] || genericAdapter;
  }

  // src/autoApply/tailoring.ts
  var SKILL_PATTERNS = [
    // Programming languages
    /\b(javascript|typescript|python|java|c\+\+|ruby|go|rust|swift|kotlin|scala|php|perl|r|matlab|sql|html|css)\b/gi,
    // Frameworks
    /\b(react|angular|vue|next\.?js|node\.?js|express|django|flask|spring|rails|laravel|\.net|asp\.net|tensorflow|pytorch)\b/gi,
    // Cloud & DevOps
    /\b(aws|azure|gcp|docker|kubernetes|terraform|jenkins|ci\/cd|git|github|gitlab|bitbucket)\b/gi,
    // Databases
    /\b(postgresql|mysql|mongodb|redis|elasticsearch|dynamodb|cassandra|sqlite|oracle|sql server)\b/gi,
    // Soft skills & domain
    /\b(leadership|communication|problem[- ]solving|teamwork|agile|scrum|project management|analytical|critical thinking)\b/gi
  ];
  var SENIORITY_PATTERNS = [
    { pattern: /\b(senior|sr\.?|lead|principal|staff|architect)\b/i, level: "senior" },
    { pattern: /\b(mid[- ]?level|intermediate|ii|iii)\b/i, level: "mid" },
    { pattern: /\b(junior|jr\.?|entry[- ]?level|associate|intern|i\b)\b/i, level: "junior" },
    { pattern: /\b(manager|director|vp|vice president|head of|chief)\b/i, level: "manager" }
  ];
  function extractJobContext(doc) {
    const ctx = {};
    const titleSelectors = [
      "h1.job-title",
      "h1.posting-headline",
      'h1[class*="title"]',
      '[data-automation-id="jobPostingHeader"]',
      ".job-title",
      ".posting-headline h2",
      "h1",
      ".topcard__title",
      ".jobsearch-JobInfoHeader-title",
      '[data-testid="job-title"]',
      ".jobs-unified-top-card__job-title"
    ];
    for (const sel of titleSelectors) {
      const el = doc.querySelector(sel);
      if (el?.textContent?.trim()) {
        ctx.jobTitle = el.textContent.trim();
        break;
      }
    }
    const companySelectors = [
      ".company-name",
      '[data-automation-id="company"]',
      ".posting-categories .sort-by-team",
      ".employer-name",
      ".topcard__org-name-link",
      ".jobsearch-InlineCompanyRating-companyHeader",
      '[data-testid="company-name"]',
      ".jobs-unified-top-card__company-name",
      'a[data-tracking-control-name="public_jobs_topcard-org-name"]'
    ];
    for (const sel of companySelectors) {
      const el = doc.querySelector(sel);
      if (el?.textContent?.trim()) {
        ctx.companyName = el.textContent.trim();
        break;
      }
    }
    const descSelectors = [
      ".job-description",
      '[data-automation-id="jobPostingDescription"]',
      ".posting-page .section-wrapper",
      "#job-details",
      ".jobsearch-jobDescriptionText",
      ".jobs-description__content",
      '[data-testid="job-description"]',
      ".description__text",
      "#job_description"
    ];
    let descText = "";
    for (const sel of descSelectors) {
      const el = doc.querySelector(sel);
      if (el?.textContent?.trim() && el.textContent.trim().length > 50) {
        descText = el.textContent.trim();
        ctx.jobDescription = descText;
        break;
      }
    }
    if (descText) {
      const skills = /* @__PURE__ */ new Set();
      for (const pat of SKILL_PATTERNS) {
        const matches = descText.matchAll(pat);
        for (const m of matches)
          skills.add(m[0].toLowerCase());
      }
      if (skills.size > 0)
        ctx.requiredSkills = [...skills];
      for (const s of SENIORITY_PATTERNS) {
        if (s.pattern.test(descText) || ctx.jobTitle && s.pattern.test(ctx.jobTitle)) {
          ctx.seniority = s.level;
          break;
        }
      }
    }
    const locSelectors = [
      ".job-location",
      '[data-automation-id="locations"]',
      ".posting-categories .sort-by-location",
      ".location",
      ".topcard__flavor--bullet",
      ".jobsearch-JobInfoHeader-subtitle > div",
      '[data-testid="job-location"]'
    ];
    for (const sel of locSelectors) {
      const el = doc.querySelector(sel);
      if (el?.textContent?.trim()) {
        ctx.jobLocation = el.textContent.trim();
        break;
      }
    }
    return ctx;
  }
  function tailorResponse(originalResponse, fieldLabel, context, settings) {
    if (!settings.enabled || settings.intensity === 0) {
      return {
        originalResponse,
        tailoredResponse: originalResponse,
        fieldLabel,
        confidence: 1,
        reasoning: "Tailoring disabled"
      };
    }
    let tailored = originalResponse;
    const reasons = [];
    let confidence = 1;
    const lowerLabel = fieldLabel.toLowerCase();
    const lowerResponse = tailored.toLowerCase();
    const skipFields = ["name", "first name", "last name", "email", "phone", "address", "city", "state", "zip", "country", "salary", "date", "gender", "race", "ethnicity", "veteran", "disability"];
    if (skipFields.some((f) => lowerLabel.includes(f)) || originalResponse.length < 20) {
      return {
        originalResponse,
        tailoredResponse: originalResponse,
        fieldLabel,
        confidence: 1,
        reasoning: "Field is factual/short \u2014 no tailoring needed"
      };
    }
    if (context.companyName && !lowerResponse.includes(context.companyName.toLowerCase())) {
      const companyPhrases = [
        `I am excited about the opportunity at ${context.companyName}`,
        `at ${context.companyName}`,
        `with ${context.companyName}`
      ];
      if (lowerLabel.includes("why") || lowerLabel.includes("cover") || lowerLabel.includes("interest") || lowerLabel.includes("motivation")) {
        tailored = tailored.replace(
          /^(.)/,
          `I am drawn to ${context.companyName} for its impact in the industry. $1`
        );
        reasons.push(`Injected company name: ${context.companyName}`);
      } else if (lowerLabel.includes("summary") || lowerLabel.includes("about") || lowerLabel.includes("introduction") || lowerLabel.includes("tell us")) {
        tailored = tailored.replace(/\.?\s*$/, `, and I am eager to bring this expertise to ${context.companyName}.`);
        reasons.push(`Appended company reference: ${context.companyName}`);
      }
    }
    if (context.jobTitle) {
      const roleMention = context.jobTitle.replace(/\s*\(.*\)/, "").trim();
      if (roleMention.length > 3 && !lowerResponse.includes(roleMention.toLowerCase())) {
        if (lowerLabel.includes("experience") || lowerLabel.includes("background") || lowerLabel.includes("summary") || lowerLabel.includes("qualification")) {
          tailored = tailored.replace(/\.?\s*$/, `, directly relevant to the ${roleMention} position.`);
          reasons.push(`Added role reference: ${roleMention}`);
        }
      }
    }
    if (context.requiredSkills && context.requiredSkills.length > 0) {
      const profileKeywords = settings.profileKeywords.map((k) => k.toLowerCase());
      const matchingSkills = context.requiredSkills.filter(
        (s) => profileKeywords.includes(s) || lowerResponse.includes(s)
      );
      const missingSkills = context.requiredSkills.filter(
        (s) => profileKeywords.includes(s) && !lowerResponse.includes(s)
      );
      if (missingSkills.length > 0 && (lowerLabel.includes("skill") || lowerLabel.includes("experience") || lowerLabel.includes("qualification") || lowerLabel.includes("summary") || lowerLabel.includes("why"))) {
        const skillList = missingSkills.slice(0, 4).join(", ");
        tailored = tailored.replace(/\.?\s*$/, `. My experience also includes ${skillList}.`);
        reasons.push(`Added matching skills: ${skillList}`);
      }
      if (matchingSkills.length > 0) {
        reasons.push(`${matchingSkills.length} matching skills detected`);
      }
    }
    if (context.seniority) {
      const seniorityPhrases = {
        senior: "extensive experience",
        mid: "solid hands-on experience",
        junior: "strong foundation and eagerness to grow",
        manager: "proven leadership experience"
      };
      const phrase = seniorityPhrases[context.seniority];
      if (phrase && (lowerLabel.includes("experience") || lowerLabel.includes("summary") || lowerLabel.includes("about"))) {
        if (!lowerResponse.includes(phrase)) {
          if (tailored.length > 50) {
            tailored = tailored.replace(/^(.{0,100}?\.)/, `$1 I bring ${phrase} in this domain.`);
            reasons.push(`Aligned seniority: ${context.seniority}`);
          }
        }
      }
    }
    if (settings.targetKeywords.length > 0) {
      const targetMissing = settings.targetKeywords.filter((k) => !lowerResponse.includes(k.toLowerCase()));
      if (targetMissing.length > 0 && tailored.length > 40) {
        const toAdd = targetMissing.slice(0, 3);
        if (lowerLabel.includes("additional") || lowerLabel.includes("note") || lowerLabel.includes("comment") || lowerLabel.includes("summary")) {
          tailored = tailored.replace(/\.?\s*$/, `. Key strengths: ${toAdd.join(", ")}.`);
          reasons.push(`Target keywords added: ${toAdd.join(", ")}`);
        }
      }
    }
    if (tailored === originalResponse) {
      return {
        originalResponse,
        tailoredResponse: originalResponse,
        fieldLabel,
        confidence: 1,
        reasoning: "No tailoring opportunities for this field"
      };
    }
    confidence = Math.max(0.7, 1 - reasons.length * 0.05);
    return {
      originalResponse,
      tailoredResponse: tailored,
      fieldLabel,
      confidence,
      reasoning: reasons.join("; ") || "Tailored"
    };
  }

  // src/answerBank/index.ts
  var ANSWER_BANK_KEY = "ua_answer_bank";
  var PROFILE_KEY = "ua_user_profile";
  var _answerBank = {};
  var _loaded = false;
  function normalizeKey(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  }
  async function loadAnswerBank() {
    if (_loaded)
      return _answerBank;
    const r = await chrome.storage.local.get(ANSWER_BANK_KEY);
    _answerBank = r[ANSWER_BANK_KEY] || {};
    _loaded = true;
    return _answerBank;
  }
  async function learnAnswer(label, value) {
    if (!label || !value)
      return;
    const key = normalizeKey(label);
    if (!key)
      return;
    _answerBank[key] = value;
    await chrome.storage.local.set({ [ANSWER_BANK_KEY]: _answerBank });
  }
  function getLearnedAnswer(label, el) {
    const candidates = [
      label,
      el?.getAttribute("name") || "",
      el?.id || "",
      el?.placeholder || "",
      el?.getAttribute("aria-label") || ""
    ].filter(Boolean);
    for (const c of candidates) {
      const k = normalizeKey(c);
      if (_answerBank[k])
        return _answerBank[k];
    }
    for (const c of candidates) {
      const k = normalizeKey(c);
      if (!k)
        continue;
      for (const [bk, bv] of Object.entries(_answerBank)) {
        if (k.includes(bk) || bk.includes(k))
          return bv;
      }
    }
    return "";
  }
  async function learnFromPage(doc) {
    await loadAnswerBank();
    const selector = 'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]),textarea,select';
    const elements = doc.querySelectorAll(selector);
    let learned = 0;
    for (const el of elements) {
      if (!isVisible(el))
        continue;
      if (!hasFieldValue(el))
        continue;
      const lbl = getFieldLabel(el);
      if (!lbl)
        continue;
      let val;
      if (el instanceof HTMLSelectElement) {
        val = (el.options[el.selectedIndex]?.textContent || el.value || "").trim();
      } else {
        val = (el.value || "").trim();
      }
      if (val) {
        await learnAnswer(lbl, val);
        learned++;
      }
    }
    return learned;
  }
  async function loadProfile() {
    const r = await chrome.storage.local.get(PROFILE_KEY);
    return r[PROFILE_KEY] || {};
  }
  function isVisible(el) {
    if (!el)
      return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.offsetParent !== null;
  }
  function hasFieldValue(el) {
    if (el instanceof HTMLSelectElement) {
      const val = (el.value || "").trim();
      if (!val)
        return false;
      const idx = el.selectedIndex;
      if (idx >= 0) {
        const txt = (el.options[idx]?.textContent || "").trim().toLowerCase();
        if (!txt || /^(select|choose|please|--|—)/.test(txt))
          return false;
      }
      return true;
    }
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox" || el.type === "radio")
        return !!el.checked;
      return !!el.value?.trim();
    }
    if (el instanceof HTMLTextAreaElement)
      return !!el.value?.trim();
    return false;
  }
  function getFieldLabel(el) {
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel?.trim())
      return ariaLabel.trim();
    if (el.id) {
      const lbl = el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl?.textContent?.trim())
        return lbl.textContent.trim();
    }
    if (el.placeholder?.trim())
      return el.placeholder.trim();
    const container = el.closest('.form-group,.field,.question,[class*="Field"],[class*="Question"],[class*="form-row"],li,.form-item,.ant-form-item,.ant-row');
    if (container) {
      const lbl = container.querySelector('label,[class*="label"],[class*="Label"]');
      if (lbl && lbl !== el && lbl.textContent?.trim())
        return lbl.textContent.trim();
    }
    const name = el.getAttribute("name");
    if (name)
      return name.replace(/[_\-]/g, " ");
    return "";
  }

  // src/smartFill/valueGuesser.ts
  var DEFAULTS = {
    authorized: "Yes",
    sponsorship: "No",
    relocation: "Yes",
    remote: "Yes",
    veteran: "I am not a protected veteran",
    disability: "I do not have a disability",
    gender: "Prefer not to say",
    ethnicity: "Prefer not to say",
    race: "Prefer not to say",
    years: "5",
    salary: "80000",
    notice: "2 weeks",
    availability: "Immediately",
    cover: "I am excited to apply for this role. My background and skills make me an excellent candidate and I look forward to contributing to your team.",
    why: "I admire the company culture and the opportunity to make a meaningful impact.",
    howHeard: "LinkedIn"
  };
  function guessValue(label, profile) {
    const l = (label || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ");
    if (/first.?name|given.?name|prenom/.test(l))
      return profile.first_name || "";
    if (/last.?name|family.?name|surname/.test(l))
      return profile.last_name || "";
    if (/middle.?name/.test(l))
      return profile.middle_name || "";
    if (/preferred.?name|nick.?name/.test(l))
      return profile.preferred_name || profile.first_name || "";
    if (/full.?name|your name|^name$/.test(l) && !/company|last|first|user/.test(l))
      return `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    if (/\bemail\b/.test(l))
      return profile.email || "";
    if (/phone|mobile|cell|telephone/.test(l))
      return profile.phone || "";
    if (/^city$|\bcity\b|current.?city/.test(l))
      return profile.city || "";
    if (/state|province|region/.test(l))
      return profile.state || "";
    if (/zip|postal/.test(l))
      return profile.postal_code || "";
    if (/country/.test(l))
      return profile.country || "United States";
    if (/address|street/.test(l))
      return profile.address || "";
    if (/location|where.*(you|do you).*live/.test(l))
      return profile.city ? `${profile.city}, ${profile.state || ""}`.trim().replace(/,$/, "") : "";
    if (/linkedin/.test(l))
      return profile.linkedin || "";
    if (/github/.test(l))
      return profile.github || "";
    if (/website|portfolio|personal.?url/.test(l))
      return profile.website || "";
    if (/twitter|x\.com/.test(l))
      return profile.twitter || "";
    if (/university|school|college|alma.?mater/.test(l))
      return profile.school || "";
    if (/\bdegree\b|qualification/.test(l))
      return profile.degree || "Bachelor's";
    if (/major|field.?of.?study|concentration/.test(l))
      return profile.major || "";
    if (/gpa|grade.?point/.test(l))
      return profile.gpa || "";
    if (/graduation|grad.?date|grad.?year/.test(l))
      return profile.graduation_year || "";
    if (/title|position|role|current.?title|job.?title/.test(l) && !/company/.test(l))
      return profile.current_title || "";
    if (/company|employer|org|current.?company/.test(l))
      return profile.current_company || "";
    if (/salary|compensation|pay|desired.?pay/.test(l))
      return profile.expected_salary || DEFAULTS.salary;
    if (/cover.?letter|motivation|additional.?info|message.?to/.test(l))
      return profile.cover_letter || DEFAULTS.cover;
    if (/summary|about.?(yourself|you|me)|bio|objective/.test(l))
      return profile.summary || profile.cover_letter || DEFAULTS.cover;
    if (/why.*(compan|role|want|interest|position)/.test(l))
      return DEFAULTS.why;
    if (/how.*hear|where.*(find|learn|discover)|source|referred/.test(l))
      return DEFAULTS.howHeard;
    if (/years.*(exp|work)|exp.*years|total.*experience/.test(l))
      return DEFAULTS.years;
    if (/availab|start.?date|notice|when.*start/.test(l))
      return DEFAULTS.availability;
    if (/authoriz|eligible|work.*right|legal.*right/.test(l))
      return DEFAULTS.authorized;
    if (/sponsor|visa|immigration|work.?permit/.test(l))
      return DEFAULTS.sponsorship;
    if (/relocat|willing.*move/.test(l))
      return DEFAULTS.relocation;
    if (/remote|work.*home|hybrid|on.?site/.test(l))
      return DEFAULTS.remote;
    if (/veteran|military|armed.?forces/.test(l))
      return DEFAULTS.veteran;
    if (/disabilit/.test(l))
      return DEFAULTS.disability;
    if (/gender|sex\b|pronouns/.test(l))
      return DEFAULTS.gender;
    if (/ethnic|race|racial|heritage/.test(l))
      return DEFAULTS.ethnicity;
    if (/nationality|citizenship/.test(l))
      return profile.nationality || profile.country || "United States";
    if (/language|fluency|fluent/.test(l))
      return profile.languages || "English";
    if (/certif|license|credential/.test(l))
      return profile.certifications || "";
    if (/commute|travel|willing.*travel/.test(l))
      return "Yes";
    if (/convicted|criminal|felony|background/.test(l))
      return "No";
    if (/drug.?test|screening/.test(l))
      return "Yes";
    if (/\bage\b|18.*years|over.*18|at.*least.*18/.test(l))
      return "Yes";
    if (/agree|acknowledge|certif|attest|confirm|consent/.test(l))
      return "Yes";
    if (/please.?specify|other.?please/.test(l))
      return profile.city || profile.state || "";
    return "";
  }

  // src/smartFill/fallbackFiller.ts
  function isVisible2(el) {
    if (!el)
      return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.offsetParent !== null;
  }
  function nativeSet(el, val) {
    try {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter)
        setter.call(el, val);
      else
        el.value = val;
    } catch {
      el.value = val;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }
  function realClick(el) {
    if (!el)
      return;
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.click();
  }
  function getLabel(el) {
    if (!el)
      return "";
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel?.trim())
      return ariaLabel.trim();
    if (el.id) {
      const lbl = el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl?.textContent?.trim())
        return lbl.textContent.trim();
    }
    if (el.placeholder?.trim())
      return el.placeholder.trim();
    const container = el.closest('.form-group,.field,.question,[class*="Field"],[class*="Question"],[class*="form-row"],li,.form-item,.ant-form-item,.ant-row');
    if (container) {
      const lbl = container.querySelector('label,[class*="label"],[class*="Label"]');
      if (lbl && lbl !== el && lbl.textContent?.trim())
        return lbl.textContent.trim();
    }
    return el.getAttribute("name")?.replace(/[_\-]/g, " ") || "";
  }
  function hasFieldValue2(el) {
    if (el instanceof HTMLSelectElement) {
      const val = (el.value || "").trim();
      if (!val)
        return false;
      const idx = el.selectedIndex;
      if (idx >= 0) {
        const txt = (el.options[idx]?.textContent || "").trim().toLowerCase();
        if (!txt || /^(select|choose|please|--|—)/.test(txt))
          return false;
      }
      return true;
    }
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox" || el.type === "radio")
        return !!el.checked;
      return !!el.value?.trim();
    }
    if (el instanceof HTMLTextAreaElement)
      return !!el.value?.trim();
    return false;
  }
  function isFieldRequired(el) {
    if (el.required || el.getAttribute("aria-required") === "true")
      return true;
    const container = el.closest('.field,.question,[class*="field"],[class*="Field"],[class*="question"],li,div');
    const label = getLabel(el);
    if (/\*\s*$|required/i.test(label || ""))
      return true;
    if (container) {
      if (container.classList.contains("required"))
        return true;
      if (container.getAttribute("data-required") === "true")
        return true;
      if (container.querySelector('.required,.asterisk,[aria-label*="required" i]'))
        return true;
    }
    return false;
  }
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function guessFieldValue(label, profile, el) {
    return guessValue(label, profile) || getLearnedAnswer(label, el) || "";
  }
  async function fallbackFill(doc, profile) {
    await loadAnswerBank();
    let filled = 0;
    const inputs = Array.from(
      doc.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]),textarea')
    ).filter((el) => isVisible2(el) && !el.value?.trim());
    for (const inp of inputs) {
      const lbl = getLabel(inp);
      if (!lbl)
        continue;
      const val = guessFieldValue(lbl, profile, inp);
      if (!val)
        continue;
      inp.focus();
      nativeSet(inp, val);
      inp.classList.add("ua-filled");
      filled++;
      await sleep(60);
    }
    const selects = Array.from(doc.querySelectorAll("select")).filter(
      (el) => isVisible2(el) && !hasFieldValue2(el)
    );
    for (const sel of selects) {
      const lbl = getLabel(sel);
      const val = guessFieldValue(lbl, profile, sel);
      if (!val) {
        const lblLower = (lbl || "").toLowerCase();
        if (/gender|disability|veteran|race|ethnicity|sex\b|heritage/i.test(lblLower)) {
          const opts = Array.from(sel.options).filter((o) => o.value && o.index > 0);
          const fb = opts.find((o) => /prefer not|decline|not to|do not|don.t wish/i.test(o.text));
          if (fb) {
            sel.value = fb.value;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
            sel.classList.add("ua-filled");
            filled++;
          }
        }
        continue;
      }
      const opt = Array.from(sel.options).find(
        (o) => o.text.toLowerCase().includes(val.toLowerCase())
      );
      if (opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        sel.classList.add("ua-filled");
        filled++;
      } else {
        const opts = Array.from(sel.options).filter((o) => o.value && o.index > 0);
        if (opts.length) {
          sel.value = opts[0].value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          sel.classList.add("ua-filled");
          filled++;
        }
      }
    }
    const groups = {};
    const radios = Array.from(doc.querySelectorAll('input[type="radio"]')).filter(isVisible2);
    for (const r of radios) {
      const key = r.name || r.id;
      if (!key)
        continue;
      (groups[key] ||= []).push(r);
    }
    for (const [, radioGroup] of Object.entries(groups)) {
      if (radioGroup.some((r) => r.checked))
        continue;
      const lbl = getLabel(radioGroup[0]);
      const guess = guessFieldValue(lbl, profile, radioGroup[0]);
      const match = radioGroup.find((r) => {
        const labelEl = r.id ? doc.querySelector(`label[for="${CSS.escape(r.id)}"]`) : null;
        const t = (labelEl?.textContent || r.value || "").toLowerCase();
        return guess && t.includes(guess.toLowerCase());
      });
      if (match) {
        realClick(match);
        filled++;
        continue;
      }
      const yesRadio = radioGroup.find((r) => {
        const labelEl = r.id ? doc.querySelector(`label[for="${CSS.escape(r.id)}"]`) : null;
        const t = (labelEl?.textContent || r.value || "").toLowerCase().trim();
        return ["yes", "true", "1"].includes(t);
      });
      if (yesRadio) {
        realClick(yesRadio);
        filled++;
      }
    }
    const requiredCheckboxes = Array.from(
      doc.querySelectorAll(
        'input[type="checkbox"][required],input[type="checkbox"][aria-required="true"]'
      )
    ).filter((el) => isVisible2(el) && !el.checked);
    for (const cb of requiredCheckboxes) {
      realClick(cb);
      filled++;
    }
    return filled;
  }
  function getMissingRequired(doc) {
    const required = Array.from(
      doc.querySelectorAll('input:not([type="hidden"]),textarea,select')
    ).filter((el) => isVisible2(el) && isFieldRequired(el));
    const missing = [];
    for (const el of required) {
      if (el instanceof HTMLInputElement && el.type === "radio" && el.name) {
        const group = Array.from(
          doc.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`)
        ).filter(isVisible2);
        if (group.some((r) => r.checked))
          continue;
      } else if (el instanceof HTMLInputElement && el.type === "checkbox" && !el.checked) {
      } else if (hasFieldValue2(el)) {
        continue;
      }
      const lbl = getLabel(el) || el.getAttribute("name") || el.id || "Required field";
      if (!missing.includes(lbl))
        missing.push(lbl);
    }
    return missing;
  }

  // src/smartFill/successDetector.ts
  function checkSuccess(doc) {
    const href = (doc.location?.href || "").toLowerCase();
    if (/\/thanks|\/thank.you|\/success|\/confirmation|\/submitted|\/done|\/complete/i.test(href)) {
      return true;
    }
    const body = doc.body?.innerText || "";
    if (/application submitted|thank you for applying|application received|we.ve received your|successfully submitted|application complete|thanks for applying|your application has been|application was submitted/i.test(body)) {
      return true;
    }
    const confirmationSelectors = [
      "#application_confirmation",
      ".application-confirmation",
      ".confirmation-text",
      ".posting-confirmation",
      '[data-automation-id="congratulationsMessage"]',
      '[data-automation-id="confirmationMessage"]',
      ".success-message",
      ".submission-confirmation",
      '[data-testid="application-success"]',
      '[data-testid="confirmation-page"]'
    ];
    for (const sel of confirmationSelectors) {
      if (doc.querySelector(sel))
        return true;
    }
    return false;
  }
  function findNextButton(doc) {
    const nextSelectors = [
      'button[data-automation-id="bottom-navigation-next-button"]',
      'button[data-automation-id="pageFooterNextButton"]',
      'button[data-automation-id="next-button"]',
      'button[aria-label*="Next" i]',
      'button[aria-label*="Continue" i]',
      '[data-testid="next-step"]',
      '[data-testid="continue"]',
      ".btn-next",
      ".next-button"
    ];
    for (const sel of nextSelectors) {
      const btn = doc.querySelector(sel);
      if (btn && btn.offsetParent !== null)
        return btn;
    }
    const allBtns = doc.querySelectorAll('button,a[role="button"]');
    for (const btn of allBtns) {
      const t = (btn.textContent || "").trim().toLowerCase();
      if (/^(next|continue|proceed|save.*continue|review)\b/i.test(t) && !/cancel|back|prev|close/i.test(t) && btn.offsetParent !== null) {
        return btn;
      }
    }
    return null;
  }
  function findSubmitButton(doc) {
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[data-automation-id="submit"]',
      'button[data-automation-id="submitButton"]',
      "#submit_app",
      ".postings-btn-submit",
      "button.application-submit",
      'button[data-qa="btn-submit"]',
      'button[aria-label*="Submit" i]',
      '[data-testid="submit-application"]',
      '[data-testid="submit-button"]',
      '[data-testid="apply-button"]',
      "button.btn-submit",
      'button[aria-label="Submit application"]',
      'button[aria-label="Apply"]'
    ];
    for (const sel of submitSelectors) {
      const btn = doc.querySelector(sel);
      if (btn && btn.offsetParent !== null)
        return btn;
    }
    const allBtns = doc.querySelectorAll('button,a[role="button"],input[type="submit"]');
    for (const btn of allBtns) {
      const t = (btn.textContent || btn.value || "").trim().toLowerCase();
      if (/^(submit|apply|send|complete|finish)\b/i.test(t) && !/cancel|back|prev|close/i.test(t) && btn.offsetParent !== null) {
        return btn;
      }
    }
    return null;
  }

  // src/smartFill/multiPageHandler.ts
  var MAX_PAGES = 10;
  function sleep2(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function realClick2(el) {
    if (!el)
      return;
    el.scrollIntoView?.({ behavior: "smooth", block: "center" });
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.click();
  }
  async function autoSubmitOrNext(doc) {
    await learnFromPage(doc);
    const missing = getMissingRequired(doc);
    if (missing.length === 0) {
      const submitBtn = findSubmitButton(doc);
      if (submitBtn) {
        await sleep2(500);
        realClick2(submitBtn);
        return "submitted";
      }
    }
    const nextBtn = findNextButton(doc);
    if (nextBtn) {
      await sleep2(500);
      realClick2(nextBtn);
      return "next_page";
    }
    if (missing.length > 0) {
      const submitBtn = findSubmitButton(doc);
      if (submitBtn) {
        await sleep2(500);
        realClick2(submitBtn);
        return "submitted";
      }
    }
    return "no_action";
  }
  async function multiPageLoop(doc, fillPageFn, profile) {
    const userProfile = profile || await loadProfile();
    let totalFilled = 0;
    let finalAction = "no_action";
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (checkSuccess(doc)) {
        return { pagesProcessed: page - 1, success: true, finalAction, totalFieldsFilled: totalFilled };
      }
      await sleep2(2e3);
      const primaryFilled = await fillPageFn();
      totalFilled += primaryFilled;
      await sleep2(1e3);
      const fallback1 = await fallbackFill(doc, userProfile);
      totalFilled += fallback1;
      await sleep2(500);
      const fallback2 = await fallbackFill(doc, userProfile);
      totalFilled += fallback2;
      const action = await autoSubmitOrNext(doc);
      finalAction = action;
      if (action === "submitted") {
        await sleep2(3e3);
        const success = checkSuccess(doc);
        return { pagesProcessed: page, success, finalAction: action, totalFieldsFilled: totalFilled };
      } else if (action === "next_page") {
        await sleep2(3e3);
        continue;
      } else {
        await sleep2(2e3);
        const extra = await fallbackFill(doc, userProfile);
        totalFilled += extra;
        const retry = await autoSubmitOrNext(doc);
        finalAction = retry;
        if (retry !== "no_action") {
          await sleep2(3e3);
          const success = retry === "submitted" ? checkSuccess(doc) : false;
          return { pagesProcessed: page, success, finalAction: retry, totalFieldsFilled: totalFilled };
        }
        break;
      }
    }
    return { pagesProcessed: MAX_PAGES, success: false, finalAction, totalFieldsFilled: totalFilled };
  }

  // src/smartFill/workdayAutomation.ts
  function sleep3(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function isVisible3(el) {
    if (!el)
      return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.offsetParent !== null;
  }
  function realClick3(el) {
    if (!el)
      return;
    el.scrollIntoView?.({ behavior: "smooth", block: "center" });
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.click();
  }
  function waitFor(doc, selector, timeout, xpath = false) {
    return new Promise((resolve) => {
      const find = () => {
        if (xpath) {
          return doc.evaluate(selector, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        }
        return doc.querySelector(selector);
      };
      const el = find();
      if (el) {
        resolve(el);
        return;
      }
      const observer2 = new MutationObserver(() => {
        const el2 = find();
        if (el2) {
          observer2.disconnect();
          resolve(el2);
        }
      });
      observer2.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        observer2.disconnect();
        resolve(null);
      }, timeout);
    });
  }
  async function workdayNavigateToForm(doc) {
    const allBtns = doc.querySelectorAll("a, button");
    for (const b of allBtns) {
      if (/^\s*Apply\s*$/i.test(b.textContent || "") && isVisible3(b)) {
        realClick3(b);
        await sleep3(2e3);
        break;
      }
    }
    const applyManually = await waitFor(doc, "//*[@data-automation-id='applyManually']", 8e3, true);
    if (applyManually) {
      await sleep3(500);
      realClick3(applyManually);
      await sleep3(2e3);
    }
    const formPageSelectors = [
      "[data-automation-id='quickApplyPage']",
      "[data-automation-id='applyFlowAutoFillPage']",
      "[data-automation-id='contactInformationPage']",
      "[data-automation-id='applyFlowMyInfoPage']",
      "[data-automation-id='ApplyFlowPage']"
    ].join(",");
    const formPage = await waitFor(doc, formPageSelectors, 1e4);
    if (formPage) {
      await sleep3(1e3);
      return true;
    }
    return false;
  }
  function isWorkdayPage(url) {
    return /myworkdayjobs\.com|myworkdaysite\.com|workday\.com\/.*\/job/i.test(url);
  }

  // src/content/main.ts
  var isRunning = false;
  var observer = null;
  var autoApplyJobId = null;
  var autoSubmitEnabled = false;
  var autoDetectedPages = /* @__PURE__ */ new Set();
  var queueButtonInjected = false;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "START_AUTOFILL") {
      const payload = msg.payload;
      autoSubmitEnabled = payload?.autoSubmit || false;
      autoApplyJobId = payload?.jobId || null;
      startAutofill().then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    }
    if (msg.type === "STOP_AUTOFILL") {
      stopAutofill();
      sendResponse({ ok: true });
    }
    if (msg.type === "DETECT_ATS") {
      const result = detectATS(document);
      sendResponse(result);
    }
    if (msg.type === "AUTO_DETECT_FILL") {
      handleAutoDetectFill().then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    }
  });
  async function send(msg) {
    return chrome.runtime.sendMessage(msg);
  }
  async function getResponses() {
    const domain = location.hostname;
    const r = await send({ type: "GET_RESPONSES", payload: { domain } });
    return r?.data || [];
  }
  async function handleAutoDetectFill() {
    const pageKey = location.href;
    if (autoDetectedPages.has(pageKey))
      return;
    autoDetectedPages.add(pageKey);
    const ats = detectATS(document);
    const isKnownATS = ats.type !== "generic" && ats.confidence >= 0.3;
    const isCompanySite = ats.type === "companysite" && ats.confidence >= 0.3;
    const hasForm = hasApplicationForm(document);
    if (!isKnownATS && !isCompanySite && !hasForm) {
      maybeInjectQueueButton();
      return;
    }
    const credits = await send({ type: "CHECK_CREDITS" });
    if (!credits?.ok || !credits.data?.unlimited && credits.data?.remaining <= 0)
      return;
    await loadAnswerBank();
    if (!isRunning) {
      await startAutofill();
    }
    maybeInjectQueueButton();
  }
  async function startAutofill() {
    if (isRunning)
      return;
    isRunning = true;
    showControlBar();
    await loadAnswerBank();
    const ats = detectATS(document);
    const adapter = getAdapter(ats.type);
    const responses = await getResponses();
    const jobContext = extractJobContext(document);
    if (isWorkdayPage(location.href)) {
      updateControlBar(0, 0, "Navigating Workday form...");
      const reached = await workdayNavigateToForm(document);
      if (!reached) {
        updateControlBar(0, 0, "Workday form not found - trying direct fill");
      }
    }
    const fillResult = await fillPage(adapter, responses, ats.type, jobContext);
    const profile = await loadProfile();
    await randomDelay(500, 1e3);
    const fallbackCount = await fallbackFill(document, profile);
    if (fallbackCount > 0) {
      updateControlBar(fillResult.filled + fallbackCount, fillResult.total + fallbackCount, `${fillResult.filled + fallbackCount} fields filled (${fallbackCount} by smart fill)`);
    }
    observer = new MutationObserver(async (mutations) => {
      if (!isRunning)
        return;
      const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
      if (hasNewNodes) {
        await fillPage(adapter, responses, ats.type, jobContext);
        await fallbackFill(document, profile);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    if (autoSubmitEnabled && (fillResult.filled > 0 || fallbackCount > 0)) {
      await handleAutoSubmitFlow(ats.type, fillResult.filled + fallbackCount, fillResult.total + fallbackCount, adapter, responses, jobContext, profile);
    }
  }
  async function handleAutoSubmitFlow(atsType, filledCount, totalCount, adapter, responses, jobContext, profile) {
    if (!autoSubmitEnabled)
      return;
    await randomDelay(1e3, 2e3);
    const resumeInput = document.querySelector('input[type="file"][accept*=".pdf"], input[type="file"][accept*=".doc"], input[name*="resume"], input[name*="cv"]');
    if (resumeInput && !resumeInput.files?.length) {
      const settingsR = await send({ type: "GET_SETTINGS" });
      if (settingsR?.ok && settingsR.data?.autoApply?.requireResumeForSubmit) {
        updateControlBar(filledCount, totalCount, "Resume required - manual upload needed");
        reportCompletion("needs_input");
        return;
      }
    }
    const fillPageFn = async () => {
      const result2 = await fillPage(adapter, responses, atsType, jobContext);
      const fb = await fallbackFill(document, profile);
      return result2.filled + fb;
    };
    const result = await multiPageLoop(document, fillPageFn, profile);
    if (result.success) {
      updateControlBar(result.totalFieldsFilled, result.totalFieldsFilled, "Application submitted successfully!");
      reportCompletion("applied");
    } else if (result.finalAction === "submitted") {
      updateControlBar(result.totalFieldsFilled, result.totalFieldsFilled, "Application submitted!");
      reportCompletion("applied");
    } else if (result.finalAction === "next_page") {
      updateControlBar(result.totalFieldsFilled, result.totalFieldsFilled, `Processed ${result.pagesProcessed} pages`);
      reportCompletion("prefilled");
    } else {
      if (checkSuccess(document)) {
        updateControlBar(result.totalFieldsFilled, result.totalFieldsFilled, "Application submitted!");
        reportCompletion("applied");
      } else {
        updateControlBar(result.totalFieldsFilled, result.totalFieldsFilled, "Form filled - manual review needed");
        reportCompletion("needs_input");
      }
    }
    await learnFromPage(document);
  }
  function stopAutofill() {
    isRunning = false;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    removeControlBar();
  }
  async function fillPage(adapter, responses, atsType, jobContext) {
    const fields = adapter.getFields(document);
    const domain = location.hostname;
    const matches = matchFields(fields, responses, { domain, atsType });
    let tailoringSettings = null;
    try {
      const settingsR = await send({ type: "GET_SETTINGS" });
      if (settingsR?.ok)
        tailoringSettings = settingsR.data?.tailoring;
    } catch {
    }
    let filled = 0;
    for (const match of matches) {
      if (!isRunning)
        break;
      if (isAlreadyFilled(match.field))
        continue;
      await randomDelay(50, 200);
      let responseText = match.response.response;
      if (tailoringSettings?.enabled && jobContext.jobTitle) {
        const fieldLabel = match.signals.find((s) => s.source === "label-for" || s.source === "label-wrap" || s.source === "aria-label")?.value || "";
        const tailored = tailorResponse(responseText, fieldLabel, jobContext, tailoringSettings);
        responseText = tailored.tailoredResponse;
      }
      const ok = await adapter.fillField(match.field, responseText);
      if (ok) {
        filled++;
        match.field.classList.add("ua-filled");
        match.field.classList.add("ua-filled-flash");
        send({ type: "RECORD_USAGE", payload: { id: match.response.id } });
        setTimeout(() => match.field.classList.remove("ua-filled-flash"), 600);
      }
    }
    updateControlBar(filled, matches.length);
    return { filled, total: matches.length };
  }
  function reportCompletion(status) {
    send({
      type: "PAGE_AUTOFILL_COMPLETE",
      payload: { status, jobId: autoApplyJobId, url: location.href }
    });
  }
  function randomDelay(min, max) {
    const ms = min + Math.random() * (max - min);
    return new Promise((r) => setTimeout(r, ms));
  }
  function isAlreadyFilled(el) {
    if (el.classList.contains("ua-filled"))
      return true;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el.value.trim().length > 0;
    }
    if (el instanceof HTMLSelectElement) {
      return el.selectedIndex > 0;
    }
    return false;
  }
  function showControlBar() {
    removeControlBar();
    const bar = document.createElement("div");
    bar.id = "ua-control-bar";
    bar.className = "ua-control-bar";
    bar.innerHTML = `
    <span class="ua-status">Ultimate Autofill</span>
    <span id="ua-fill-status" style="font-size:12px;color:#868e96;">Scanning...</span>
    <button class="ua-btn-stop" id="ua-btn-stop">Stop</button>
  `;
    document.body.appendChild(bar);
    bar.querySelector("#ua-btn-stop")?.addEventListener("click", () => {
      stopAutofill();
    });
  }
  function updateControlBar(filled, total, message) {
    const el = document.getElementById("ua-fill-status");
    if (el)
      el.textContent = message || `${filled}/${total} fields filled`;
  }
  function removeControlBar() {
    document.getElementById("ua-control-bar")?.remove();
  }
  function maybeInjectQueueButton() {
    if (queueButtonInjected)
      return;
    const url = location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const h1 = document.querySelector("h1")?.textContent?.toLowerCase() || "";
    const combined = url + " " + title + " " + h1;
    const isJobPage = /job|career|position|opening|apply|hiring|vacancy|recruit|opportunity/i.test(combined);
    const isAppPage = isApplicationPage(document);
    if (!isJobPage && !isAppPage)
      return;
    queueButtonInjected = true;
    injectQueueButton();
  }
  function injectQueueButton() {
    document.getElementById("ua-queue-btn-wrapper")?.remove();
    const wrapper = document.createElement("div");
    wrapper.id = "ua-queue-btn-wrapper";
    wrapper.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
    const btn = document.createElement("button");
    btn.id = "ua-add-queue-btn";
    btn.innerHTML = `<span style="font-size:16px;margin-right:6px;">+</span> Add to Queue`;
    btn.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: #fff;
    border: none;
    border-radius: 50px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    transition: all 0.2s ease;
    font-family: inherit;
  `;
    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "scale(1.05)";
      btn.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.6)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "scale(1)";
      btn.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
    });
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.innerHTML = '<span style="font-size:14px;">&#8987;</span> Adding...';
      try {
        const jobContext = extractJobContext(document);
        const r = await send({
          type: "ADD_CURRENT_PAGE_TO_QUEUE",
          payload: {
            url: location.href,
            company: jobContext.companyName || void 0,
            role: jobContext.jobTitle || void 0,
            source: "one_click"
          }
        });
        if (r?.ok) {
          btn.innerHTML = '<span style="font-size:16px;">&#10003;</span> Added!';
          btn.style.background = "linear-gradient(135deg, #28a745, #20c997)";
          showQueueToast(`Added to queue: ${jobContext.jobTitle || location.href.substring(0, 50)}...`);
          setTimeout(() => {
            btn.innerHTML = `<span style="font-size:16px;margin-right:6px;">+</span> Add to Queue`;
            btn.style.background = "linear-gradient(135deg, #667eea, #764ba2)";
            btn.disabled = false;
          }, 3e3);
        } else {
          btn.innerHTML = `<span style="font-size:16px;">&#10007;</span> ${r?.error || "Already in queue"}`;
          btn.style.background = "#dc3545";
          setTimeout(() => {
            btn.innerHTML = `<span style="font-size:16px;margin-right:6px;">+</span> Add to Queue`;
            btn.style.background = "linear-gradient(135deg, #667eea, #764ba2)";
            btn.disabled = false;
          }, 2e3);
        }
      } catch (e) {
        btn.innerHTML = `<span style="font-size:16px;">&#10007;</span> Error`;
        setTimeout(() => {
          btn.innerHTML = `<span style="font-size:16px;margin-right:6px;">+</span> Add to Queue`;
          btn.style.background = "linear-gradient(135deg, #667eea, #764ba2)";
          btn.disabled = false;
        }, 2e3);
      }
    });
    wrapper.appendChild(btn);
    document.body.appendChild(wrapper);
  }
  function showQueueToast(message) {
    const existing = document.getElementById("ua-queue-toast");
    if (existing)
      existing.remove();
    const toast = document.createElement("div");
    toast.id = "ua-queue-toast";
    toast.textContent = message;
    toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 24px;
    z-index: 2147483647;
    padding: 12px 20px;
    background: #343a40;
    color: #fff;
    border-radius: 8px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.3s ease;
  `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, 3e3);
  }
  document.addEventListener("focusin", async (e) => {
    const el = e.target;
    if (!isTextareaLike(el))
      return;
    const label = getFieldLabel2(el);
    if (!label)
      return;
    const r = await send({ type: "GET_SUGGESTIONS", payload: { query: label, domain: location.hostname } });
    if (r?.ok && r.data?.length) {
      showSuggestionOverlay(el, r.data, label);
    }
  }, true);
  document.addEventListener("focusout", (e) => {
    setTimeout(() => {
      const overlay = document.getElementById("ua-suggestion-overlay");
      if (overlay && !overlay.matches(":hover"))
        overlay.remove();
    }, 200);
  }, true);
  function isTextareaLike(el) {
    if (el instanceof HTMLTextAreaElement)
      return true;
    if (el.contentEditable === "true")
      return true;
    if (el instanceof HTMLInputElement && el.type === "text") {
      const label = getFieldLabel2(el);
      if (label && label.length > 30)
        return true;
    }
    return false;
  }
  function getFieldLabel2(el) {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl?.textContent?.trim())
        return lbl.textContent.trim();
    }
    const wrap = el.closest("label");
    if (wrap?.textContent?.trim())
      return wrap.textContent.trim();
    const al = el.getAttribute("aria-label");
    if (al?.trim())
      return al.trim();
    const ph = el.placeholder;
    if (ph?.trim())
      return ph.trim();
    return null;
  }
  function showSuggestionOverlay(target, suggestions, label) {
    document.getElementById("ua-suggestion-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "ua-suggestion-overlay";
    overlay.className = "ua-overlay";
    const rect = target.getBoundingClientRect();
    overlay.style.top = `${rect.bottom + window.scrollY + 4}px`;
    overlay.style.left = `${rect.left + window.scrollX}px`;
    let html = `<div class="ua-overlay-header">
    <span>Suggestions for: ${escapeHtml(label.slice(0, 40))}</span>
    <button class="ua-overlay-close" id="ua-close-overlay">&times;</button>
  </div><div class="ua-suggestion-list">`;
    for (const s of suggestions) {
      const resp = s.response;
      const preview = resp.response.length > 120 ? resp.response.slice(0, 120) + "..." : resp.response;
      html += `<div class="ua-suggestion-item" data-response-id="${escapeHtml(resp.id)}">
      <div class="ua-suggestion-question">${escapeHtml(resp.question)}</div>
      <div class="ua-suggestion-response">${escapeHtml(preview)}</div>
      <div class="ua-suggestion-meta">Score: ${(s.score * 100).toFixed(0)}% | Used ${resp.appearances}x</div>
      <button class="ua-suggestion-insert" data-value="${escapeAttr(resp.response)}" data-id="${escapeHtml(resp.id)}">Insert</button>
    </div>`;
    }
    html += "</div>";
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    overlay.querySelector("#ua-close-overlay")?.addEventListener("click", () => overlay.remove());
    overlay.querySelectorAll(".ua-suggestion-insert").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const value = btn.dataset.value || "";
        const id = btn.dataset.id || "";
        insertValue(target, value);
        send({ type: "RECORD_USAGE", payload: { id } });
        overlay.remove();
      });
    });
  }
  function insertValue(el, value) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(
        el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        "value"
      )?.set;
      if (setter)
        setter.call(el, value);
      else
        el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (el.contentEditable === "true") {
      el.textContent = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    el.classList.add("ua-filled");
  }
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escapeAttr(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  setTimeout(() => {
    maybeInjectQueueButton();
  }, 1500);
})();
//# sourceMappingURL=content.js.map
