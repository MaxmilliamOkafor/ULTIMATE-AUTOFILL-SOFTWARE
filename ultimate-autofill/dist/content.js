"use strict";
(() => {
  // src/atsDetector/index.ts
  var SIGS = [
    {
      type: "workday",
      urls: [/myworkdayjobs\.com/i, /myworkday\.com/i],
      dom: ["[data-automation-id]", "[data-uxi-element-id]"],
      meta: [{ name: "generator", pat: /workday/i }]
    },
    {
      type: "greenhouse",
      urls: [/greenhouse\.io/i, /boards\.greenhouse\.io/i],
      dom: ["#greenhouse_application", "#grnhse_app", "form#application_form"],
      meta: []
    },
    {
      type: "lever",
      urls: [/lever\.co/i, /jobs\.lever\.co/i],
      dom: [".lever-application-form", '[data-qa="application-form"]', ".posting-headline"],
      meta: []
    },
    {
      type: "smartrecruiters",
      urls: [/smartrecruiters\.com/i],
      dom: ['[class*="smartrecruiters"]', ".st-apply-form"],
      meta: []
    },
    {
      type: "icims",
      urls: [/icims\.com/i],
      dom: ["#icims_content", '[class*="icims"]'],
      meta: []
    },
    {
      type: "taleo",
      urls: [/taleo\.net/i, /oraclecloud\.com/i, /fa\.oraclecloud\.com/i],
      dom: ['[class*="taleo"]', "#requisitionDescriptionInterface", "#OracleFusionApp", "oracle-apply-flow"],
      meta: [{ name: "generator", pat: /taleo/i }]
    },
    {
      type: "ashby",
      urls: [/ashbyhq\.com/i],
      dom: ["[data-ashby-job-posting-id]", ".ashby-job-posting-brief-location"],
      meta: []
    },
    {
      type: "bamboohr",
      urls: [/bamboohr\.com/i],
      dom: [".BambooHR-ATS-board", '[class*="BambooHR"]'],
      meta: []
    },
    {
      type: "indeed",
      urls: [/indeed\.com/i],
      dom: ["#jobsearch-ViewJobButtons-container", ".jobsearch-IndeedApplyButton"],
      meta: []
    },
    {
      type: "linkedin",
      urls: [/linkedin\.com\/jobs/i],
      dom: [".jobs-apply-button", '[data-control-name*="apply"]'],
      meta: []
    },
    {
      type: "hiringcafe",
      urls: [/hiring\.cafe/i],
      dom: [],
      meta: []
    },
    {
      type: "jobvite",
      urls: [/jobvite\.com/i],
      dom: ['[class*="jobvite"]', ".jv-page-body"],
      meta: []
    },
    {
      type: "workable",
      urls: [/apply\.workable\.com/i],
      dom: ['[data-ui="application"]'],
      meta: []
    },
    {
      type: "paylocity",
      urls: [/paylocity\.com/i],
      dom: [],
      meta: []
    },
    {
      type: "jazzhr",
      urls: [/jazzhr\.com/i],
      dom: ["#jazz-apply-form"],
      meta: []
    },
    {
      type: "ziprecruiter",
      urls: [/ziprecruiter\.com/i],
      dom: [],
      meta: []
    },
    {
      type: "dice",
      urls: [/dice\.com/i],
      dom: [],
      meta: []
    },
    {
      type: "ukg",
      urls: [/recruiting\.ultipro\.com/i],
      dom: [],
      meta: []
    }
  ];
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
      if (conf > bestConf) {
        bestConf = conf;
        best = s.type;
        bestSigs.length = 0;
        bestSigs.push(...found);
      }
    }
    return { type: best, confidence: bestConf, signals: bestSigs };
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

  // src/adapters/lever/index.ts
  var ID_MAP2 = {
    name: "Full Name",
    email: "Email Address",
    phone: "Phone Number",
    org: "Current Company",
    "urls[LinkedIn]": "LinkedIn Profile",
    "urls[Twitter]": "Twitter",
    "urls[GitHub]": "GitHub",
    "urls[Portfolio]": "Portfolio",
    "urls[Other]": "Website",
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
        signals.push("url");
      }
      if (doc.querySelector(".posting-apply,.postings-form,.application-form")) {
        conf += 0.3;
        signals.push("lever-form");
      }
      if (doc.querySelector(".posting-headline,.posting-categories")) {
        conf += 0.2;
        signals.push("lever-layout");
      }
      return { type: "lever", confidence: Math.min(conf, 1), signals };
    },
    getFields(doc) {
      const fields = [];
      const container = doc.querySelector(".posting-apply,.postings-form,.application-form") || doc;
      const els = container.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      for (const el of els) {
        if (el.offsetParent === null)
          continue;
        const signals = extractFieldSignals(el);
        const name = el.getAttribute("name") || "";
        if (ID_MAP2[name]) {
          signals.push({ source: "lever-field-name", value: ID_MAP2[name], weight: 1 });
        }
        fields.push({ element: el, type: elType3(el), signals });
      }
      return fields;
    },
    async fillField(field, value) {
      try {
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
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
        return false;
      } catch {
        return false;
      }
    }
  };

  // src/adapters/icims/index.ts
  var icimsAdapter = {
    type: "icims",
    detect(doc) {
      const signals = [];
      let conf = 0;
      const docHref = doc.location?.href;
      const url = (docHref && docHref !== "about:blank" ? docHref : null) || (typeof window !== "undefined" ? window.location?.href : "") || "";
      if (/icims\.com/i.test(url)) {
        conf += 0.6;
        signals.push("url");
      }
      if (doc.querySelector(".iCIMS_MainWrapper,.iCIMS_Header,#iCIMS_Header")) {
        conf += 0.3;
        signals.push("icims-elements");
      }
      if (doc.querySelector('form[action*="icims"]')) {
        conf += 0.2;
        signals.push("icims-form");
      }
      return { type: "icims", confidence: Math.min(conf, 1), signals };
    },
    getFields(doc) {
      return discoverFields(doc);
    },
    async fillField(field, value) {
      try {
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
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
        if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
          const lbl = field.closest("label")?.textContent?.trim() || "";
          if (lbl.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase() === "yes") {
            field.checked = true;
            field.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          return false;
        }
        return false;
      } catch {
        return false;
      }
    }
  };

  // src/adapters/smartrecruiters/index.ts
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
  var SR_KEY_MAP = {
    first_name: "First Name",
    last_name: "Last Name",
    email: "Email Address",
    phone_number: "Phone Number",
    location: "Location",
    linkedin: "LinkedIn Profile",
    resume_text: "Summary"
  };
  var smartRecruitersAdapter = {
    type: "smartrecruiters",
    detect(doc) {
      const signals = [];
      let conf = 0;
      const docHref = doc.location?.href;
      const url = (docHref && docHref !== "about:blank" ? docHref : null) || (typeof window !== "undefined" ? window.location?.href : "") || "";
      if (/smartrecruiters\.com/i.test(url)) {
        conf += 0.6;
        signals.push("url");
      }
      if (doc.querySelector('[data-test*="apply"],[class*="SmartRecruiters"]')) {
        conf += 0.3;
        signals.push("sr-elements");
      }
      return { type: "smartrecruiters", confidence: Math.min(conf, 1), signals };
    },
    getFields(doc) {
      const fields = [];
      const els = doc.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      for (const el of els) {
        if (el.offsetParent === null)
          continue;
        const signals = extractFieldSignals(el);
        const name = el.getAttribute("name") || "";
        if (SR_KEY_MAP[name]) {
          signals.push({ source: "sr-field-name", value: SR_KEY_MAP[name], weight: 1 });
        }
        fields.push({ element: el, type: elType4(el), signals });
      }
      return fields;
    },
    async fillField(field, value) {
      try {
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
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
        if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
          const lbl = field.closest("label")?.textContent?.trim() || "";
          if (lbl.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase() === "yes") {
            field.checked = true;
            field.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          return false;
        }
        return false;
      } catch {
        return false;
      }
    }
  };

  // src/adapters/taleo/index.ts
  var taleoAdapter = {
    type: "taleo",
    detect(doc) {
      const signals = [];
      let conf = 0;
      const docHref = doc.location?.href;
      const url = (docHref && docHref !== "about:blank" ? docHref : null) || (typeof window !== "undefined" ? window.location?.href : "") || "";
      if (/oraclecloud\.com|taleo\.net/i.test(url)) {
        conf += 0.6;
        signals.push("url");
      }
      if (doc.querySelector("#OracleFusionApp,oracle-apply-flow")) {
        conf += 0.3;
        signals.push("oracle-app");
      }
      return { type: "taleo", confidence: Math.min(conf, 1), signals };
    },
    getFields(doc) {
      return discoverFields(doc);
    },
    async fillField(field, value) {
      try {
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
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
        if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
          const lbl = field.closest("label")?.textContent?.trim() || "";
          if (lbl.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase() === "yes") {
            field.checked = true;
            field.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          return false;
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
    icims: icimsAdapter,
    smartrecruiters: smartRecruitersAdapter,
    taleo: taleoAdapter,
    generic: genericAdapter
  };
  function getAdapter(type) {
    return adapters[type] || genericAdapter;
  }

  // src/fieldMatcher/smartGuesser.ts
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
    cover: `I am excited to apply for this role. My background and skills make me an excellent candidate and I look forward to contributing to your team.`,
    why: "I admire the company culture and the opportunity to make a meaningful impact.",
    howHeard: "LinkedIn"
  };
  function pickFirst(...vals) {
    for (const v of vals) {
      if (typeof v === "string" && v.trim())
        return v.trim();
      if (typeof v === "number")
        return String(v);
    }
    return "";
  }
  function normalizeProfile(raw = {}) {
    const p = { ...raw || {} };
    p.first_name = pickFirst(p.first_name, p.firstName, p.firstname, p.given_name, p.givenName);
    p.last_name = pickFirst(p.last_name, p.lastName, p.lastname, p.family_name, p.familyName);
    p.email = pickFirst(p.email, p.emailAddress, p.email_address, p.primaryEmail, p.workEmail);
    p.phone = pickFirst(p.phone, p.phoneNumber, p.phone_number, p.mobile, p.mobileNumber, p.contactNumber, p.telephone);
    p.linkedin_profile_url = pickFirst(p.linkedin_profile_url, p.linkedin, p.linkedIn, p.linkedinUrl, p.linkedin_url);
    p.website_url = pickFirst(p.website_url, p.website, p.portfolio, p.portfolio_url, p.personalWebsite);
    p.github_url = pickFirst(p.github_url, p.github, p.githubUrl);
    p.city = pickFirst(p.city, p.currentCity, p.locationCity);
    p.state = pickFirst(p.state, p.region, p.province);
    p.country = pickFirst(p.country, p.countryName);
    p.postal_code = pickFirst(p.postal_code, p.zip, p.zipCode, p.postcode);
    p.address = pickFirst(p.address, p.streetAddress, p.addressLine1);
    p.current_title = pickFirst(p.current_title, p.currentTitle, p.title);
    p.current_company = pickFirst(p.current_company, p.currentCompany, p.company);
    p.school = pickFirst(p.school, p.university);
    p.degree = pickFirst(p.degree);
    p.major = pickFirst(p.major);
    p.graduation_year = pickFirst(p.graduation_year, p.grad_year);
    p.expected_salary = pickFirst(p.expected_salary, p.desired_pay, p.desiredPay);
    p.cover_letter = pickFirst(p.cover_letter, p.coverLetter);
    p.summary = pickFirst(p.summary, p.bio, p.objective);
    p.resume_url = pickFirst(p.resume_url, p.resumeUrl, p.resume);
    const nested = p.profile || p.candidate || p.user || p.basics || {};
    p.first_name = pickFirst(p.first_name, nested.first_name, nested.firstName, nested.firstname);
    p.last_name = pickFirst(p.last_name, nested.last_name, nested.lastName, nested.lastname);
    p.email = pickFirst(p.email, nested.email, nested.emailAddress, nested.email_address);
    p.phone = pickFirst(p.phone, nested.phone, nested.phoneNumber, nested.mobile, nested.mobileNumber);
    p.linkedin_profile_url = pickFirst(p.linkedin_profile_url, nested.linkedin_profile_url, nested.linkedin, nested.linkedIn, nested.linkedinUrl);
    p.website_url = pickFirst(p.website_url, nested.website_url, nested.website, nested.portfolio, nested.portfolio_url);
    return p;
  }
  function guessValue(label, p = {}) {
    const l = label.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
    if (/first.?name|given.?name|prenom/.test(l))
      return p.first_name || "";
    if (/last.?name|family.?name|surname/.test(l))
      return p.last_name || "";
    if (/middle.?name/.test(l))
      return p.middle_name || "";
    if (/preferred.?name|nick.?name/.test(l))
      return p.preferred_name || p.first_name || "";
    if (/full.?name|your name|name/.test(l) && !/company|last|first|user/.test(l))
      return `${p.first_name || ""} ${p.last_name || ""}`.trim();
    if (/\bemail\b/.test(l))
      return p.email || "";
    if (/phone|mobile|cell|telephone/.test(l))
      return p.phone || "";
    if (/^city$|\bcity\b|current.?city/.test(l))
      return p.city || "";
    if (/state|province|region/.test(l))
      return p.state || "";
    if (/zip|postal/.test(l))
      return p.postal_code || "";
    if (/country/.test(l))
      return p.country || "United States";
    if (/address|street/.test(l))
      return p.address || "";
    if (/location|where.*(you|do you).*live/.test(l))
      return p.city ? `${p.city}, ${p.state || ""}`.trim().replace(/,$/, "") : "";
    if (/linkedin/.test(l))
      return p.linkedin_profile_url || "";
    if (/github/.test(l))
      return p.github_url || "";
    if (/website|portfolio|personal.?url/.test(l))
      return p.website_url || "";
    if (/twitter|x\.com/.test(l))
      return p.twitter_url || "";
    if (/university|school|college|alma.?mater/.test(l))
      return p.school || "";
    if (/\bdegree\b|qualification/.test(l))
      return p.degree || "Bachelor's";
    if (/major|field.?of.?study|concentration|specialization/.test(l))
      return p.major || "";
    if (/gpa|grade.?point/.test(l))
      return p.gpa || "";
    if (/graduation|grad.?date|grad.?year/.test(l))
      return p.graduation_year || "";
    if (/title|position|role|current.?title|job.?title/.test(l) && !/company/.test(l))
      return p.current_title || "";
    if (/company|employer|org|current.?company/.test(l))
      return p.current_company || "";
    if (/salary|compensation|pay|desired.?pay|expected.?comp/.test(l))
      return p.expected_salary || DEFAULTS.salary;
    if (/cover.?letter|motivation|additional.?info|message.?to/.test(l))
      return p.cover_letter || DEFAULTS.cover;
    if (/summary|about.?(yourself|you|me)|bio|objective|profile.?summary/.test(l))
      return p.summary || p.cover_letter || DEFAULTS.cover;
    if (/why.*(compan|role|want|interest|position)/.test(l))
      return DEFAULTS.why;
    if (/how.*hear|where.*(find|learn|discover)|source|referred.?by|referral/.test(l))
      return DEFAULTS.howHeard;
    if (/years.*(exp|work)|exp.*years|total.*experience/.test(l))
      return p.years_of_experience || DEFAULTS.years;
    if (/availab|start.?date|notice|when.*start|earliest.*start/.test(l))
      return DEFAULTS.availability;
    if (/authoriz|eligible|work.*right|legal.*right|permitted.*work/.test(l))
      return DEFAULTS.authorized;
    if (/sponsor|visa|immigration|work.?permit/.test(l))
      return DEFAULTS.sponsorship;
    if (/relocat|willing.*move|open.*reloc/.test(l))
      return DEFAULTS.relocation;
    if (/remote|work.*home|hybrid|on.?site|work.?model|work.?arrangement/.test(l))
      return DEFAULTS.remote;
    if (/veteran|military|armed.?forces|served/.test(l))
      return DEFAULTS.veteran;
    if (/disabilit/.test(l))
      return DEFAULTS.disability;
    if (/gender|sex\b|pronouns/.test(l))
      return DEFAULTS.gender;
    if (/ethnic|race|racial|heritage/.test(l))
      return DEFAULTS.ethnicity;
    if (/nationality|citizenship/.test(l))
      return p.nationality || p.country || "United States";
    if (/language|fluency|fluent/.test(l))
      return p.languages || "English";
    if (/certif|license|credential/.test(l))
      return p.certifications || "";
    if (/commute|travel|willing.*travel/.test(l))
      return "Yes";
    if (/convicted|criminal|felony|background.?check/.test(l))
      return "No";
    if (/drug.?test|screening/.test(l))
      return "Yes";
    if (/\bage\b|18.*years|over.*18|at.*least.*18/.test(l))
      return "Yes";
    if (/agree|acknowledge|certif|attest|confirm|consent/.test(l))
      return "Yes";
    return "";
  }
  function getFieldLabel(el) {
    if (el.getAttribute("aria-label"))
      return el.getAttribute("aria-label");
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl?.textContent?.trim())
        return lbl.textContent.trim();
    }
    if (el.placeholder)
      return el.placeholder;
    const container = el.closest(
      '.form-group,.field,.question,[class*="Field"],[class*="Question"],[class*="form-row"]'
    );
    if (container) {
      const lbl = container.querySelector('label,[class*="label"],[class*="Label"]');
      if (lbl && lbl !== el)
        return lbl.textContent?.trim() || "";
    }
    const wrap = el.closest("label");
    if (wrap?.textContent?.trim())
      return wrap.textContent.trim();
    return el.name?.replace(/[_\-]/g, " ") || "";
  }
  function isFieldRequired(el) {
    if (!el)
      return false;
    if (el.required || el.getAttribute("aria-required") === "true")
      return true;
    if (el.getAttribute("required") !== null)
      return true;
    const container = el.closest(
      '.field,.application-field,.question,[class*="field"],[class*="Field"],[class*="question"],[class*="Question"],li,div'
    );
    const label = getFieldLabel(el);
    if (/\*\s*$|required/.test((label || "").toLowerCase()))
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
  function hasFieldValue(el) {
    if (!el)
      return false;
    if (el.tagName === "SELECT") {
      const sel = el;
      const val = (sel.value || "").trim();
      if (!val)
        return false;
      const idx = sel.selectedIndex;
      if (idx >= 0) {
        const txt = (sel.options[idx]?.textContent || "").trim().toLowerCase();
        if (!txt || /select|choose|please|--/.test(txt))
          return false;
      }
      return true;
    }
    if (el.type === "checkbox" || el.type === "radio")
      return !!el.checked;
    return !!el.value?.trim();
  }
  function isVisible(el) {
    if (!el)
      return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0")
      return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  }
  function nativeSet(el, val) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter)
        setter.call(el, val);
      else
        el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      el.dispatchEvent(new Event("focus", { bubbles: true }));
    } else if (el.contentEditable === "true") {
      el.textContent = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  function realClick(el) {
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.click();
  }
  async function loadProfile() {
    try {
      const data = await chrome.storage.local.get(["candidateDetails", "userDetails", "profileData", "ua_profile"]);
      let raw = {};
      for (const key of ["ua_profile", "profileData", "candidateDetails", "userDetails"]) {
        if (data[key]) {
          try {
            const parsed = typeof data[key] === "string" ? JSON.parse(data[key]) : data[key];
            raw = { ...raw, ...parsed };
          } catch {
          }
        }
      }
      return normalizeProfile(raw);
    } catch {
      return {};
    }
  }
  var _responseBankCache = { loaded: false, entries: [], ts: 0 };
  var RESPONSE_BANK_TTL_MS = 1e4;
  function normalizeText(v) {
    return String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function addResponseEntry(entries, keyText, response) {
    const key = normalizeText(keyText);
    const val = String(response || "").trim();
    if (!key || !val)
      return;
    if (entries.some((e) => e.key === key && e.value === val))
      return;
    entries.push({ key, value: val });
  }
  function collectResponseEntries(node, entries) {
    if (!node)
      return;
    if (Array.isArray(node)) {
      node.forEach((item) => collectResponseEntries(item, entries));
      return;
    }
    if (typeof node !== "object")
      return;
    const response = node.response || node.answer || node.value || node.selected || node.a || node.text;
    if (response && (node.question || node.key || node.id || node.label)) {
      addResponseEntry(entries, node.question, response);
      addResponseEntry(entries, node.key, response);
      addResponseEntry(entries, node.label, response);
      addResponseEntry(entries, node.id, response);
      if (Array.isArray(node.keywords))
        node.keywords.forEach((k) => addResponseEntry(entries, k, response));
    }
    Object.values(node).forEach((v) => collectResponseEntries(v, entries));
  }
  async function getResponseBank() {
    if (_responseBankCache.loaded && Date.now() - _responseBankCache.ts < RESPONSE_BANK_TTL_MS) {
      return _responseBankCache.entries;
    }
    const keys = [
      "applicationDetails",
      "complexFormData",
      "manualComplexInstructions",
      "manualApplicationDetail",
      "responses",
      "questionAnswers",
      "candidateDetails",
      "missing_details",
      "missingDetails",
      "missingQuestionDetails",
      "userDetails",
      "ua_responses"
    ];
    const raw = await chrome.storage.local.get(keys);
    const entries = [];
    for (const val of Object.values(raw || {})) {
      if (!val)
        continue;
      try {
        const parsed = typeof val === "string" ? JSON.parse(val) : val;
        collectResponseEntries(parsed, entries);
      } catch {
      }
    }
    _responseBankCache = { loaded: true, entries, ts: Date.now() };
    return entries;
  }
  function getResponseValue(label, el, entries) {
    if (!entries?.length)
      return "";
    const candidates = [
      label,
      el ? getFieldLabel(el) : "",
      el?.name || "",
      el?.id || "",
      el?.placeholder || "",
      el?.getAttribute?.("aria-label") || ""
    ].map(normalizeText).filter(Boolean);
    for (const c of candidates) {
      const exact = entries.find((e) => e.key === c);
      if (exact)
        return exact.value;
    }
    for (const c of candidates) {
      const matched = entries.find((e) => c.includes(e.key) || e.key.includes(c));
      if (matched)
        return matched.value;
    }
    return "";
  }
  function guessFieldValue(label, profile, el, responseEntries = []) {
    return guessValue(label, profile) || getResponseValue(label, el, responseEntries) || "";
  }
  function getMissingRequiredFields() {
    const required = Array.from(document.querySelectorAll(
      "input:not([type=hidden]):not([type=submit]):not([type=button]),textarea,select"
    )).filter((el) => isVisible(el) && isFieldRequired(el));
    const missing = [];
    for (const el of required) {
      if (el.type === "radio" && el.name) {
        const group = Array.from(document.querySelectorAll(
          `input[type="radio"][name="${CSS.escape(el.name)}"]`
        )).filter(isVisible);
        if (group.some((r) => r.checked))
          continue;
      } else if (el.type === "checkbox" && !el.checked) {
      } else if (hasFieldValue(el)) {
        continue;
      }
      const lbl = getFieldLabel(el) || el.name || el.id || "Required field";
      if (!missing.includes(lbl))
        missing.push(lbl);
    }
    return missing;
  }
  function reportFieldFilled(fieldName, status) {
    try {
      chrome.runtime.sendMessage({
        type: "SIDEBAR_FIELD_UPDATE",
        fieldName,
        status
      }).catch(() => {
      });
    } catch {
    }
  }
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local")
        return;
      const refreshKeys = [
        "applicationDetails",
        "complexFormData",
        "manualComplexInstructions",
        "manualApplicationDetail",
        "responses",
        "questionAnswers",
        "candidateDetails",
        "missing_details",
        "missingDetails",
        "missingQuestionDetails",
        "userDetails",
        "ua_responses"
      ];
      for (const k of refreshKeys) {
        if (changes[k]) {
          _responseBankCache = { loaded: false, entries: [], ts: 0 };
          break;
        }
      }
    });
  }

  // src/content/formNavigator.ts
  var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  var SUBMIT_SELECTORS = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[data-automation-id="submit"]',
    "#submit_app",
    ".postings-btn-submit",
    "button.application-submit",
    'button[data-qa="btn-submit"]',
    'button[aria-label*="Submit" i]',
    '[data-testid="submit-application"]',
    "button.btn-submit",
    "#resumeSubmitForm",
    // Workday
    ...["btnSubmit", "submitButton", "bottom-navigation-submit-button", "pageFooterSubmitButton"].map((id) => `[data-automation-id="${id}"]`)
  ];
  var NEXT_SELECTORS = [
    'button[data-automation-id="bottom-navigation-next-button"]',
    'button[data-automation-id="next-button"]',
    'button[data-automation-id="pageFooterNextButton"]',
    'button[aria-label*="Next" i]',
    'button[aria-label*="Continue" i]',
    '[data-testid="next-step"]',
    '[data-testid="continue"]'
  ];
  async function tryClickSubmitOrNext(missingRequiredCount) {
    if (missingRequiredCount === 0) {
      for (const sel of SUBMIT_SELECTORS) {
        const btn = document.querySelector(sel);
        if (btn && isVisible(btn)) {
          await sleep(500);
          realClick(btn);
          return "submitted";
        }
      }
      const btns = Array.from(document.querySelectorAll('button,a[role="button"],input[type="submit"]')).filter(isVisible);
      const submitBtn = btns.find((b) => {
        const t = (b.textContent || b.value || "").trim().toLowerCase();
        return /^(submit|apply|send|complete|finish)\b/i.test(t) && !/cancel|back|prev|close/i.test(t);
      });
      if (submitBtn) {
        await sleep(500);
        realClick(submitBtn);
        return "submitted";
      }
    }
    for (const sel of NEXT_SELECTORS) {
      const btn = document.querySelector(sel);
      if (btn && isVisible(btn)) {
        await sleep(500);
        realClick(btn);
        return "next_page";
      }
    }
    const allBtns = Array.from(document.querySelectorAll('button,a[role="button"]')).filter(isVisible);
    const nextBtn = allBtns.find((b) => {
      const t = (b.textContent || b.value || "").trim().toLowerCase();
      return /^(next|continue|proceed|save.*continue|review)\b/i.test(t) && !/cancel|back|prev|close/i.test(t);
    });
    if (nextBtn) {
      await sleep(500);
      realClick(nextBtn);
      return "next_page";
    }
    if (missingRequiredCount === 0) {
      const lastResort = allBtns.find((b) => {
        const t = (b.textContent || b.value || "").trim().toLowerCase();
        return /submit|apply|send|go|done/i.test(t) && !/cancel|back|close/i.test(t);
      });
      if (lastResort) {
        await sleep(500);
        realClick(lastResort);
        return "submitted";
      }
    }
    return false;
  }
  var SUCCESS_URL_PATTERNS = [
    "/thanks",
    "/thank-you",
    "/success",
    "/confirmation",
    "/complete",
    "/submitted",
    "/application-submitted",
    "/applied",
    "/done",
    "/thank_you"
  ];
  var SUCCESS_TEXT_PATTERNS = /application submitted|thank you for applying|application received|we.ve received your|your application has been|successfully submitted|application complete|thanks for applying|we have received|application was submitted/i;
  var ALREADY_APPLIED_PATTERNS = /already applied|already submitted|you.ve applied|you have already|previously applied|duplicate application/i;
  function getPageTextClean() {
    const exclusions = "#ua-control-bar,#ua-suggestion-overlay,#ua-overlay-host,[data-oh-patch]";
    const mainContent = document.querySelectorAll(
      'main, article, form, [role="main"], .content, .application, #content, #main, #app'
    );
    let text = "";
    if (mainContent.length > 0) {
      mainContent.forEach((el) => {
        const clone = el.cloneNode(true);
        clone.querySelectorAll(exclusions).forEach((x) => x.remove());
        text += " " + clone.textContent;
      });
    } else {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll(exclusions).forEach((x) => x.remove());
      text = clone.textContent || "";
    }
    return text.toLowerCase();
  }
  function detectSuccess(initialUrl, submitClickedTs) {
    const href = location.href.toLowerCase();
    if (SUCCESS_URL_PATTERNS.some((p) => href.includes(p)))
      return "success";
    if (document.querySelector("#application_confirmation,.application-confirmation,.confirmation-text"))
      return "success";
    if (document.querySelector(".posting-confirmation,.application-confirmation"))
      return "success";
    if (document.querySelector('[data-automation-id="congratulationsMessage"],[data-automation-id="confirmationMessage"]'))
      return "success";
    const body = getPageTextClean();
    if (SUCCESS_TEXT_PATTERNS.test(body))
      return "success";
    if (submitClickedTs > 0 && location.href !== initialUrl && Date.now() - submitClickedTs > 2e3) {
      const newPath = location.pathname.toLowerCase();
      if (!/\/apply|\/step|\/page\d|\/form/i.test(newPath))
        return "success";
    }
    if (ALREADY_APPLIED_PATTERNS.test(body))
      return "duplicate";
    return "none";
  }
  function normalizeUrl(url) {
    try {
      const u = new URL(url);
      ["utm_source", "utm_medium", "utm_campaign", "ref", "referer", "source", "fbclid"].forEach((p) => u.searchParams.delete(p));
      return u.origin + u.pathname;
    } catch {
      return url;
    }
  }
  async function markApplied() {
    const norm = normalizeUrl(location.href);
    const { appliedJobs = [] } = await chrome.storage.local.get("appliedJobs");
    if (!appliedJobs.includes(norm)) {
      appliedJobs.push(norm);
      if (appliedJobs.length > 15e3)
        appliedJobs.shift();
      await chrome.storage.local.set({ appliedJobs });
    }
  }

  // src/content/resumeUpload.ts
  var LOG = (...a) => console.log("[UA-Resume]", ...a);
  async function tryResumeUpload() {
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
    if (fileInputs.length === 0)
      return false;
    const { ua_resumeFile, ua_resumeFileName, resumeFile, resumeFileName } = await chrome.storage.local.get(["ua_resumeFile", "ua_resumeFileName", "resumeFile", "resumeFileName"]);
    const file = ua_resumeFile || resumeFile;
    const fileName = ua_resumeFileName || resumeFileName || "resume.pdf";
    if (!file) {
      LOG("No stored resume for upload");
      return false;
    }
    let uploaded = false;
    for (const fi of fileInputs) {
      if (fi.files && fi.files.length > 0)
        continue;
      const lbl = getFieldLabel(fi) || fi.name || fi.accept || "";
      const l = lbl.toLowerCase();
      if (/resume|cv|curriculum|document|upload|attach|file/i.test(l) || fi.accept?.includes(".pdf") || fi.accept?.includes(".doc")) {
        try {
          const resp = await fetch(file);
          const blob = await resp.blob();
          const fileObj = new File([blob], fileName, { type: blob.type || "application/pdf" });
          const dt = new DataTransfer();
          dt.items.add(fileObj);
          fi.files = dt.files;
          fi.dispatchEvent(new Event("change", { bubbles: true }));
          fi.dispatchEvent(new Event("input", { bubbles: true }));
          LOG("Resume uploaded to:", lbl);
          uploaded = true;
        } catch (e) {
          LOG("Resume upload failed:", e);
        }
      }
    }
    return uploaded;
  }

  // src/content/captchaSolver.ts
  var LOG2 = (...a) => console.log("[UA-Captcha]", ...a);
  async function solveCaptcha() {
    document.querySelectorAll('iframe[src*="recaptcha"],iframe[src*="hcaptcha"]').forEach((f) => {
      try {
        const cb = f.contentDocument?.querySelector(".recaptcha-checkbox,#recaptcha-anchor");
        if (cb && !cb.classList.contains("recaptcha-checkbox-checked"))
          realClick(cb);
      } catch {
      }
    });
    document.querySelectorAll('[class*="captcha"] input,[id*="captcha"] input,input[name*="captcha"]').forEach((inp) => {
      const lbl = getFieldLabel(inp);
      const m = lbl.match(/(\d+)\s*([\+\-\*x×÷\/])\s*(\d+)/);
      if (!m)
        return;
      const [, a, op, b] = m;
      const n1 = +a, n2 = +b;
      const ops = {
        "+": n1 + n2,
        "-": n1 - n2,
        "*": n1 * n2,
        "x": n1 * n2,
        "\xD7": n1 * n2,
        "/": n2 ? Math.round(n1 / n2) : null,
        "\xF7": n2 ? Math.round(n1 / n2) : null
      };
      const result = ops[op];
      if (result !== null && result !== void 0) {
        nativeSet(inp, String(result));
        LOG2("Math captcha solved:", lbl, "=", result);
      }
    });
    document.querySelectorAll('input[type=checkbox][id*="captcha"],input[type=checkbox][name*="captcha"]').forEach((cb) => {
      if (!cb.checked)
        realClick(cb);
    });
  }

  // src/content/atsNavigator.ts
  var LOG3 = (...a) => console.log("[UA-Nav]", ...a);
  var sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  var $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  function isVisible3(el) {
    if (!el)
      return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.offsetParent !== null;
  }
  function realClick2(el) {
    if (!el)
      return;
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.click();
  }
  function handleIndeed() {
    if (!location.hostname.includes("indeed.com"))
      return;
    const click = () => {
      const btn = $$("button,a").find(
        (el) => /apply on company site|apply externally|apply now/i.test(el.textContent || "") || el.getAttribute("data-testid") === "company-site-apply-button"
      );
      if (btn && isVisible3(btn)) {
        LOG3("Indeed: clicking Apply on company site");
        realClick2(btn);
      }
      const confirm = $$("button").find(
        (el) => /continue|proceed|yes|ok/i.test(el.textContent || "") && !!el.closest('[class*="modal"],[class*="dialog"],[role="dialog"]')
      );
      if (confirm)
        realClick2(confirm);
    };
    setTimeout(click, 1500);
    new MutationObserver(click).observe(document.body, { childList: true, subtree: true });
  }
  function handleLinkedIn() {
    if (!location.hostname.includes("linkedin.com"))
      return;
    if (!location.pathname.startsWith("/jobs"))
      return;
    let acting = false;
    const act = async () => {
      if (acting)
        return;
      acting = true;
      try {
        const direct = $$('.jobs-apply-button,.apply-button,[data-control-name*="apply"]').find((el) => {
          const t = (el.textContent || "").trim().toLowerCase();
          return t.includes("apply") && !t.includes("easy");
        });
        if (direct && isVisible3(direct)) {
          LOG3("LinkedIn: direct apply");
          realClick2(direct);
          return;
        }
        const easy = $$('.jobs-apply-button,[aria-label*="Easy Apply"]').find((el) => /easy apply/i.test(el.textContent || ""));
        if (easy && isVisible3(easy)) {
          LOG3("LinkedIn: Easy Apply");
          realClick2(easy);
          await sleep2(1500);
        }
      } finally {
        setTimeout(() => {
          acting = false;
        }, 3e3);
      }
    };
    setTimeout(act, 2e3);
    new MutationObserver(act).observe(document.body, { childList: true, subtree: false });
  }
  var GOOD_SIZES = [
    "51-200",
    "201-500",
    "501-1000",
    "501-1,000",
    "1001-2000",
    "1,001-2,000",
    "2001-5000",
    "2,001-5,000",
    "5001-10000",
    "5,001-10,000",
    "10001+",
    "10,001+",
    "51 to 200",
    "201 to 500",
    "501 to 1000"
  ];
  function handleHiringCafe() {
    if (!location.hostname.includes("hiring.cafe"))
      return;
    const sizeEl = $$('[class*="size"],[class*="employees"],[data-field*="size"]').find((el) => /\d/.test(el.textContent || ""));
    if (sizeEl) {
      const txt = (sizeEl.textContent || "").replace(/\s/g, "");
      const ok = GOOD_SIZES.some((s) => txt.includes(s.replace(/\s/g, "")));
      if (!ok) {
        LOG3("HiringCafe: company size not preferred \u2014 skipping");
        try {
          chrome.runtime.sendMessage({ type: "JOB_SKIPPED", reason: "company_size" }).catch(() => {
          });
        } catch {
        }
        return;
      }
    }
    const tryClick = () => {
      const btn = $$("a,button").find(
        (el) => /apply directly|apply now|apply for this/i.test(el.textContent || "")
      );
      if (btn && isVisible3(btn)) {
        LOG3("HiringCafe: Apply Directly");
        realClick2(btn);
      }
    };
    setTimeout(tryClick, 2e3);
    new MutationObserver(tryClick).observe(document.body, { childList: true, subtree: true });
  }
  var _wdApplyFlowDone = false;
  async function workdayApplyButtonFlow() {
    if (_wdApplyFlowDone)
      return;
    const host = location.hostname.toLowerCase();
    if (!host.includes("myworkdayjobs.com") && !host.includes("workday.com"))
      return;
    const applySelectors = [
      '[data-automation-id="applyButton"]',
      '[data-automation-id="jobAction-apply"]',
      'button[data-automation-id="applyBtn"]',
      'a[data-automation-id*="apply"]'
    ];
    let applyBtn = null;
    for (const sel of applySelectors) {
      const el = document.querySelector(sel);
      if (el && isVisible3(el)) {
        applyBtn = el;
        break;
      }
    }
    if (!applyBtn) {
      applyBtn = $$('button, a[role="button"], a').find((el) => {
        if (!isVisible3(el))
          return false;
        const t = (el.textContent || "").trim().toLowerCase();
        return t === "apply" || t === "apply now";
      }) || null;
    }
    if (applyBtn) {
      LOG3("Workday: Clicking Apply button");
      realClick2(applyBtn);
      await sleep2(2e3);
    }
    const manualSelectors = [
      '[data-automation-id="applyManually"]',
      '[data-automation-id="applyManuallyButton"]',
      '[data-automation-id="manuallyApply"]'
    ];
    let manualBtn = null;
    for (const sel of manualSelectors) {
      const el = document.querySelector(sel);
      if (el && isVisible3(el)) {
        manualBtn = el;
        break;
      }
    }
    if (!manualBtn) {
      manualBtn = $$('button, a[role="button"], a').find((el) => {
        if (!isVisible3(el))
          return false;
        const t = (el.textContent || "").trim().toLowerCase();
        return t.includes("apply manually") || t.includes("manual apply");
      }) || null;
    }
    if (manualBtn) {
      LOG3("Workday: Clicking Apply Manually");
      realClick2(manualBtn);
      await sleep2(3e3);
    }
    _wdApplyFlowDone = true;
  }
  async function clickApplyButton() {
    const applyPatterns = [
      "apply",
      "apply now",
      "apply directly",
      "easy apply",
      "apply for this job",
      "submit application",
      "start application"
    ];
    const candidates = $$('a, button, [role="button"], input[type="submit"]');
    for (const el of candidates) {
      if (!isVisible3(el))
        continue;
      const text = (el.textContent || el.value || "").trim().toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      const combined = text + " " + aria;
      if (applyPatterns.some((p) => combined === p || combined.startsWith(p + " ") || combined.includes(p))) {
        const r = el.getBoundingClientRect();
        if (r.width >= 40 && r.height >= 20) {
          LOG3("Generic page: Clicking Apply button");
          realClick2(el);
          await sleep2(3e3);
          return true;
        }
      }
    }
    return false;
  }
  async function runAtsNavigation(atsType) {
    switch (atsType) {
      case "indeed":
        handleIndeed();
        break;
      case "linkedin":
        handleLinkedIn();
        break;
      case "hiringcafe":
        handleHiringCafe();
        break;
      case "workday":
        await workdayApplyButtonFlow();
        break;
      default:
        if (atsType === "generic")
          await clickApplyButton();
        break;
    }
  }

  // src/content/tailoringOrchestrator.ts
  var LOG4 = (...a) => console.log("[UA-Tailor]", ...a);
  var sleep3 = (ms) => new Promise((r) => setTimeout(r, ms));
  function isVisible4(el) {
    if (!el)
      return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function realClick3(el) {
    if (!el)
      return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.click();
  }
  function findButtonByText(pattern, scope = document) {
    const candidates = Array.from(scope.querySelectorAll(
      'button, a, [role="button"], div[class*="btn"], span[class*="btn"]'
    ));
    return candidates.find((el) => isVisible4(el) && pattern.test((el.textContent || "").trim())) || null;
  }
  async function waitForButton(pattern, timeoutMs = 6e4) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const btn = findButtonByText(pattern);
      if (btn)
        return btn;
      await sleep3(1e3);
    }
    return null;
  }
  function detectJobrightSidebar() {
    const selectors = [
      "#jobright-sidebar",
      '[class*="jobright"]',
      "[data-jobright]",
      '[id*="jobright"]',
      // The sidebar may also use a container with specific classes
      ".jr-sidebar",
      "#jr-extension-root"
    ];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el)
        return el;
    }
    const iframes = document.querySelectorAll("iframe");
    for (const iframe of iframes) {
      const src = iframe.src || "";
      if (/jobright/i.test(src))
        return iframe;
    }
    return null;
  }
  async function runTailoringSteps() {
    LOG4("Starting tailoring workflow...");
    let genBtn = findButtonByText(/generate.*custom.*resume/i);
    if (genBtn) {
      LOG4("Step 1: Clicking Generate Custom Resume");
      realClick3(genBtn);
      await sleep3(3e3);
    } else {
      LOG4("No tailoring trigger found \u2014 checking if already in tailoring flow");
    }
    const improveBtn = await waitForButton(/improve.*resume.*this.*job|improve.*my.*resume/i, 3e4);
    if (improveBtn) {
      LOG4("Step 2: Clicking Improve My Resume");
      realClick3(improveBtn);
      await sleep3(2e3);
    } else {
      LOG4('Step 2: No "Improve My Resume" button found \u2014 continuing');
    }
    const fullEditBtn = await waitForButton(/full.*edit|all.*experiences/i, 15e3);
    if (fullEditBtn) {
      LOG4("Step 3: Selecting Full Edit");
      realClick3(fullEditBtn);
      await sleep3(2e3);
    } else {
      LOG4("Step 3: No Full Edit option \u2014 continuing");
    }
    const selectAllBtn = await waitForButton(/select\s*(all|everything)/i, 15e3);
    if (selectAllBtn) {
      LOG4("Step 4: Clicking Select All for skills");
      realClick3(selectAllBtn);
      await sleep3(1e3);
    } else {
      const skillChecks = Array.from(document.querySelectorAll(
        'input[type="checkbox"]:not(:checked)'
      )).filter((cb) => {
        const container = cb.closest('[class*="skill"],[class*="keyword"]');
        return container && isVisible4(cb);
      });
      if (skillChecks.length > 0) {
        LOG4(`Step 4: Clicking ${skillChecks.length} individual skill checkboxes`);
        for (const cb of skillChecks) {
          realClick3(cb);
          await sleep3(100);
        }
      } else {
        LOG4("Step 4: No skill checkboxes found \u2014 continuing");
      }
    }
    const generateBtn = await waitForButton(/generate.*new.*resume|generate.*resume|create.*resume/i, 15e3);
    if (generateBtn) {
      LOG4("Step 5: Clicking Generate My New Resume");
      realClick3(generateBtn);
      LOG4("Step 5: Waiting for resume generation...");
      await waitForGenerationComplete(12e4);
    } else {
      LOG4("Step 5: No Generate button found \u2014 continuing");
    }
    const continueBtn = await waitForButton(/continue.*auto\s*fill|continue.*to.*auto/i, 6e4);
    if (continueBtn) {
      LOG4("Step 6: Clicking Continue to Autofill");
      realClick3(continueBtn);
      await sleep3(2e3);
      LOG4("Tailoring workflow complete!");
      return true;
    }
    const downloadBtn = findButtonByText(/download.*resume/i);
    if (downloadBtn) {
      LOG4("Step 6: Resume generated (Download available) \u2014 looking for Continue");
      await sleep3(3e3);
      const retry = findButtonByText(/continue.*auto\s*fill|continue.*to.*auto/i);
      if (retry) {
        realClick3(retry);
        await sleep3(2e3);
        return true;
      }
    }
    LOG4("Tailoring workflow: could not complete all steps \u2014 proceeding to autofill anyway");
    return false;
  }
  async function waitForGenerationComplete(timeoutMs) {
    const start = Date.now();
    let spinnerSeen = false;
    while (Date.now() - start < timeoutMs) {
      const spinner = document.querySelector(
        '[class*="loading"],[class*="spinner"],[class*="progress"],[class*="generating"],[role="progressbar"],.animate-spin,[class*="pulse"]'
      );
      const isLoading = spinner && isVisible4(spinner);
      if (isLoading) {
        spinnerSeen = true;
      } else if (spinnerSeen) {
        LOG4("Resume generation complete (spinner disappeared)");
        await sleep3(1e3);
        return;
      }
      if (findButtonByText(/continue.*auto\s*fill|download.*resume/i)) {
        LOG4("Resume generation complete (action buttons appeared)");
        return;
      }
      await sleep3(1e3);
    }
    LOG4("Resume generation: timeout reached");
  }

  // src/content/main.ts
  var LOG5 = (...a) => console.log("[UA]", ...a);
  var sleep4 = (ms) => new Promise((r) => setTimeout(r, ms));
  var $$2 = (s) => Array.from(document.querySelectorAll(s));
  var isRunning = false;
  var observer = null;
  var _autoTriggered = false;
  var _autoTriggerRunning = false;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "START_AUTOFILL") {
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
    if (msg.type === "TRIGGER_AUTOFILL") {
      runFullAutofill().then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    }
    if (msg.type === "FILL_COMPLEX_FORM") {
      runFullAutofill().then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    }
    if (msg.type === "TRIGGER_TAILORING") {
      runTailoringSteps().then((ok) => sendResponse({ ok })).catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    }
    if (msg.type === "PING") {
      sendResponse({ ready: true });
    }
    if (msg.type === "SOLVE_CAPTCHA") {
      solveCaptcha().then(() => sendResponse({ ok: true }));
      return true;
    }
  });
  async function send(msg) {
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch {
      return null;
    }
  }
  async function getResponses() {
    const domain = location.hostname;
    const r = await send({ type: "GET_RESPONSES", payload: { domain } });
    return r?.data || [];
  }
  async function startAutofill() {
    if (isRunning)
      return;
    isRunning = true;
    _autoTriggered = true;
    _autoTriggerRunning = false;
    showControlBar();
    const ats = detectATS(document);
    const adapter = getAdapter(ats.type);
    const responses = await getResponses();
    await runAtsNavigation(ats.type);
    await atsSpecificFill(ats.type);
    await fillPage(adapter, responses, ats.type);
    await enhancedFillPass();
    observer = new MutationObserver(async (mutations) => {
      if (!isRunning)
        return;
      const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
      if (hasNewNodes) {
        await fillPage(adapter, responses, ats.type);
        await enhancedFillPass();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function stopAutofill() {
    isRunning = false;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    removeControlBar();
  }
  async function fillPage(adapter, responses, atsType) {
    const fields = adapter.getFields(document);
    const domain = location.hostname;
    const matches = matchFields(fields, responses, { domain, atsType });
    let filled = 0;
    for (const match of matches) {
      if (!isRunning)
        break;
      if (isAlreadyFilled(match.field))
        continue;
      const ok = await adapter.fillField(match.field, match.response.response);
      if (ok) {
        filled++;
        match.field.classList.add("ua-filled");
        match.field.classList.add("ua-filled-flash");
        send({ type: "RECORD_USAGE", payload: { id: match.response.id } });
        setTimeout(() => match.field.classList.remove("ua-filled-flash"), 600);
      }
    }
    updateControlBar(filled, matches.length);
  }
  var WD_FIELDS = {
    legalNameSection_firstName: "first_name",
    legalNameSection_lastName: "last_name",
    legalNameSection_middleName: "middle_name",
    infoFirstName: "first_name",
    infoLastName: "last_name",
    infoEmail: "email",
    infoCellPhone: "phone",
    infoLinkedIn: "linkedin_profile_url",
    email: "email",
    phone: "phone",
    addressSection_addressLine1: "address",
    addressSection_addressLine2: "address2",
    addressSection_city: "city",
    addressSection_postalCode: "postal_code",
    workHistoryCompanyName: "current_company",
    workHistoryPosition: "current_title",
    educationHistoryName: "school",
    degree: "degree",
    linkedIn: "linkedin_profile_url",
    website: "website_url",
    github: "github_url",
    jobTitle: "current_title",
    company: "current_company",
    school: "school",
    major: "major",
    postalCode: "postal_code",
    city: "city",
    state: "state",
    country: "country",
    yearsOfExperience: "years_of_experience",
    salary: "expected_salary",
    coverLetter: "cover_letter",
    howDidYouHear: "how_did_you_hear"
  };
  var WD_TEXTAREA_AIDS = /* @__PURE__ */ new Set([
    "formField-roleDescription",
    "formField-summary",
    "formField-coverLetter",
    "formField-additionalInfo"
  ]);
  async function atsSpecificFill(atsType) {
    const host = location.hostname.toLowerCase();
    const profile = await loadProfile();
    if (atsType === "workday" || host.includes("myworkdayjobs.com") || host.includes("workday.com")) {
      await workdayFill(profile);
    } else if (atsType === "greenhouse" || host.includes("greenhouse.io")) {
      await greenhouseFill(profile);
    } else if (atsType === "taleo" || host.includes("oraclecloud.com") || host.includes("taleo.net")) {
      await oracleFill(profile);
    } else if (atsType === "smartrecruiters" || host.includes("smartrecruiters.com")) {
      await smartRecruitersFill(profile);
    }
  }
  async function workdayFill(p) {
    LOG5("Running Workday-specific fill");
    const responseEntries = await getResponseBank();
    await workdayAccountFlow(p);
    const containers = $$2('[data-automation-id]:not([data-automation-id=""])');
    for (const el of containers) {
      const aid = el.getAttribute("data-automation-id") || "";
      if (WD_TEXTAREA_AIDS.has(aid)) {
        const ta = el.querySelector("textarea") || (el.tagName === "TEXTAREA" ? el : null);
        if (ta && !ta.value?.trim()) {
          const val2 = p.cover_letter || guessValue("cover letter", p);
          if (val2) {
            ta.focus();
            nativeSet(ta, val2);
          }
        }
        continue;
      }
      const profileKey = WD_FIELDS[aid];
      if (!profileKey)
        continue;
      const val = p[profileKey];
      if (!val)
        continue;
      const input = el.querySelector("input:not([type=hidden]):not([type=file]),textarea");
      if (input && !input.value?.trim()) {
        input.focus();
        nativeSet(input, val);
        await sleep4(80);
        continue;
      }
      const combo = el.querySelector('[role=combobox],[data-automation-id*="combobox"]');
      if (combo) {
        realClick(combo);
        await sleep4(400);
        const si = combo.querySelector("input");
        if (si) {
          nativeSet(si, val);
          await sleep4(700);
        }
        const opt = document.querySelector("[role=option]");
        if (opt)
          realClick(opt);
        continue;
      }
      $$2("input[type=radio]").forEach((r) => {
        const t = (document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.textContent || "").toLowerCase();
        if (t.includes(val.toLowerCase()))
          realClick(r);
      });
    }
    await workdayEeoFields();
    $$2('[data-automation-id="agreementCheckbox"] input[type=checkbox]').filter((cb) => !cb.checked).forEach((cb) => realClick(cb));
    LOG5("Workday fill done");
  }
  async function workdayAccountFlow(p) {
    const { appAccountEmail, appAccountPassword } = await chrome.storage.local.get(["appAccountEmail", "appAccountPassword"]);
    const acctEmail = appAccountEmail || p.email || "";
    const acctPassword = appAccountPassword || "";
    const createCb = document.querySelector(
      '[data-automation-id="createAccountCheckbox"] input[type=checkbox],input[data-automation-id="createAccountCheckbox"]'
    );
    if (createCb && !createCb.checked) {
      realClick(createCb);
      await sleep4(600);
    }
    const emailField = document.querySelector(
      '[data-automation-id="createAccountEmail"] input,[data-automation-id="accountCreationEmail"] input,input[data-automation-id="email"],input[name="email"][type="email"]'
    );
    if (emailField && !emailField.value?.trim() && acctEmail) {
      emailField.focus();
      nativeSet(emailField, acctEmail);
      await sleep4(200);
    }
    if (acctPassword) {
      const pwFields = Array.from(document.querySelectorAll("input[type=password]")).filter((el) => isVisible(el));
      for (const pw of pwFields) {
        if (!pw.value?.trim()) {
          pw.focus();
          nativeSet(pw, acctPassword);
          await sleep4(200);
        }
      }
    }
    const createBtn = document.querySelector('[data-automation-id="createAccountSubmitButton"]');
    if (createBtn && isVisible(createBtn)) {
      await sleep4(400);
      realClick(createBtn);
      await sleep4(1500);
      return;
    }
    const signInBtn = document.querySelector('[data-automation-id="signInSubmitButton"]');
    if (signInBtn && isVisible(signInBtn)) {
      await sleep4(400);
      realClick(signInBtn);
      await sleep4(1500);
    }
  }
  async function workdayEeoFields() {
    const eeoSelectors = [
      ['[data-automation-id="gender"] select,select[data-automation-id="gender"]', /decline|prefer not|not to say/i],
      ['[data-automation-id="veteranStatus"] select,select[data-automation-id="veteranStatus"]', /not a protected|i am not|decline|prefer not/i],
      ['[data-automation-id="disability"] select,select[data-automation-id="disability"]', /do not have|decline|prefer not/i],
      ['[data-automation-id="ethnicityDropdown"] select,select[data-automation-id="ethnicityDropdown"]', /decline|prefer not|not to say/i]
    ];
    for (const [sel, pat] of eeoSelectors) {
      const el = document.querySelector(sel);
      if (el && !el.value) {
        const opt = Array.from(el.options).find((o) => pat.test(o.textContent || ""));
        if (opt) {
          el.value = opt.value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }
  }
  async function greenhouseFill(p) {
    LOG5("Running Greenhouse-specific fill");
    const responseEntries = await getResponseBank();
    const GH_MAP = [
      ['#first_name,input[id*="first_name"],input[name*="first_name"]', p.first_name || ""],
      ['#last_name,input[id*="last_name"],input[name*="last_name"]', p.last_name || ""],
      ['#email,input[type="email"],input[id*="email"]', p.email || ""],
      ['#phone,input[type="tel"],input[id*="phone"]', p.phone || ""],
      ['input[id*="location"],input[name*="location"]', p.city || ""],
      ['input[id*="linkedin"],input[name*="linkedin"]', p.linkedin_profile_url || ""],
      ['input[id*="website"],input[name*="website"],input[id*="portfolio"]', p.website_url || ""],
      ['input[id*="github"],input[name*="github"]', p.github_url || ""],
      ['textarea[id*="cover"],textarea[name*="cover"]', p.cover_letter || guessValue("cover letter", p)]
    ];
    for (const [sel, val] of GH_MAP) {
      if (!val)
        continue;
      const el = document.querySelector(sel);
      if (el && isVisible(el) && !el.value?.trim()) {
        el.focus();
        nativeSet(el, val);
        await sleep4(50);
      }
    }
    $$2('select[id*="gender"],select[id*="disability"],select[id*="veteran"],select[id*="race"],select[id*="ethnicity"]').filter((sel) => isVisible(sel) && !sel.value).forEach((sel) => {
      const opt = Array.from(sel.options).find(
        (o) => /decline|prefer not|not to say|not a protected|do not have/i.test(o.textContent || "")
      );
      if (opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    LOG5("Greenhouse fill done");
  }
  async function oracleFill(p) {
    LOG5("Running Oracle/Taleo-specific fill");
    const fields = [
      ['#firstName,input[id*="firstName"],input[name*="firstName"]', p.first_name || ""],
      ['#lastName,input[id*="lastName"],input[name*="lastName"]', p.last_name || ""],
      ['input[type="email"],input[id*="email"]', p.email || ""],
      ['input[type="tel"],input[id*="phone"],input[name*="phone"]', p.phone || ""],
      ['input[id*="city"],input[name*="city"]', p.city || ""],
      ['input[id*="zip"],input[name*="postal"]', p.postal_code || ""]
    ];
    for (const [sel, val] of fields) {
      if (!val)
        continue;
      const el = document.querySelector(sel);
      if (el && isVisible(el) && !el.value?.trim()) {
        el.focus();
        nativeSet(el, val);
        await sleep4(60);
      }
    }
    LOG5("Oracle fill done");
  }
  async function smartRecruitersFill(p) {
    LOG5("Running SmartRecruiters-specific fill");
    const fields = [
      ['input[name="first_name"],#firstName', p.first_name || ""],
      ['input[name="last_name"],#lastName', p.last_name || ""],
      ['input[name="email"],input[type="email"]', p.email || ""],
      ['input[name="phone"],input[type="tel"]', p.phone || ""],
      ['input[name="city"]', p.city || ""],
      ['input[name="web"],input[name="website"]', p.website_url || ""],
      ['textarea[name="message"],textarea[name="cover_letter"]', p.cover_letter || guessValue("cover letter", p)]
    ];
    for (const [sel, val] of fields) {
      if (!val)
        continue;
      const el = document.querySelector(sel);
      if (el && isVisible(el) && !el.value?.trim()) {
        el.focus();
        nativeSet(el, val);
        await sleep4(60);
      }
    }
    LOG5("SmartRecruiters fill done");
  }
  async function enhancedFillPass() {
    const profile = await loadProfile();
    const responseEntries = await getResponseBank();
    let filled = 0;
    $$2(
      "input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=checkbox]):not([type=radio]),textarea"
    ).forEach((el) => {
      if (!isVisible(el) || hasFieldValue(el) || el.classList.contains("ua-filled"))
        return;
      const label = getFieldLabel(el);
      if (!label)
        return;
      const val = guessFieldValue(label, profile, el, responseEntries);
      if (val) {
        el.focus();
        nativeSet(el, val);
        el.classList.add("ua-filled");
        reportFieldFilled(label, "filled");
        filled++;
      }
    });
    $$2("select").forEach((sel) => {
      if (!isVisible(sel) || hasFieldValue(sel) || sel.classList.contains("ua-filled"))
        return;
      const label = getFieldLabel(sel);
      if (!label)
        return;
      const val = guessValue(label, profile);
      const opts = Array.from(sel.options);
      let match;
      if (val) {
        match = opts.find((o) => (o.textContent || "").trim().toLowerCase() === val.toLowerCase());
        if (!match)
          match = opts.find((o) => (o.textContent || "").trim().toLowerCase().includes(val.toLowerCase()));
      }
      if (!match) {
        const l = label.toLowerCase();
        if (/gender|ethnic|race|veteran|disabil|sex\b|heritage/i.test(l)) {
          match = opts.find((o) => /prefer not|decline|not (wish|want)|choose not|do not have|i am not/i.test(o.textContent || ""));
        }
      }
      if (!match) {
        const validOpts = opts.filter((o) => o.value && o.value !== "" && o.index > 0 && !/select|choose|please|--/i.test((o.textContent || "").trim()));
        if (validOpts.length > 0 && isFieldRequired(sel)) {
          match = validOpts[0];
        }
      }
      if (match) {
        sel.value = match.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        sel.classList.add("ua-filled");
        reportFieldFilled(label, "filled");
        filled++;
      }
    });
    const radioGroups = /* @__PURE__ */ new Map();
    $$2("input[type=radio]").forEach((r) => {
      if (!isVisible(r))
        return;
      const name = r.name;
      if (!name)
        return;
      if (!radioGroups.has(name))
        radioGroups.set(name, []);
      radioGroups.get(name).push(r);
    });
    for (const [name, radios] of radioGroups) {
      if (radios.some((r) => r.checked))
        continue;
      const label = getFieldLabel(radios[0]) || name;
      const val = guessValue(label, profile);
      let matched = false;
      if (val) {
        for (const radio of radios) {
          const radioLabel = (radio.closest("label")?.textContent || document.querySelector(`label[for="${CSS.escape(radio.id)}"]`)?.textContent || radio.value || "").trim().toLowerCase();
          if (radioLabel.includes(val.toLowerCase()) || val.toLowerCase() === "yes" && /yes|true|accept/i.test(radioLabel)) {
            realClick(radio);
            reportFieldFilled(label, "filled");
            filled++;
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        const yesRadio = radios.find((r) => {
          const t = (r.closest("label")?.textContent || document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.textContent || r.value || "").trim().toLowerCase();
          return ["yes", "true", "1"].includes(t);
        });
        if (yesRadio) {
          realClick(yesRadio);
          reportFieldFilled(label, "filled");
          filled++;
        }
      }
    }
    $$2("input[type=checkbox]").forEach((cb) => {
      if (cb.checked || !isVisible(cb))
        return;
      const label = getFieldLabel(cb);
      if (/agree|acknowledge|certif|attest|confirm|consent|accept|terms|privacy/i.test(label)) {
        realClick(cb);
        reportFieldFilled(label, "filled");
        filled++;
      }
    });
    $$2('input[type=checkbox][required],input[type=checkbox][aria-required="true"]').filter((cb) => isVisible(cb) && !cb.checked).forEach((cb) => {
      realClick(cb);
      filled++;
    });
    return filled;
  }
  async function runFullAutofill() {
    LOG5("Starting full autofill pipeline");
    const ats = detectATS(document);
    const adapter = getAdapter(ats.type);
    const responses = await getResponses();
    const initialUrl = location.href;
    let submitClickedTs = 0;
    let reported = false;
    const MAX_PAGES = 10;
    const checkAndReport = () => {
      if (reported)
        return;
      const result = detectSuccess(initialUrl, submitClickedTs);
      if (result === "success") {
        reported = true;
        markApplied();
        send({ type: "COMPLEX_FORM_SUCCESS", message: "Application submitted successfully" });
        LOG5("Application submitted successfully!");
      } else if (result === "duplicate") {
        reported = true;
        send({ type: "COMPLEX_FORM_ERROR", errorType: "alreadyApplied", message: "Already applied to this job" });
        LOG5("Already applied to this job");
      }
    };
    const successObserver = new MutationObserver(checkAndReport);
    successObserver.observe(document.body, { childList: true, subtree: true });
    const successInterval = setInterval(checkAndReport, 3e3);
    checkAndReport();
    await sleep4(3e3);
    send({ type: "SIDEBAR_STATUS", event: "filling_form", atsName: ats.type, url: location.href });
    await runAtsNavigation(ats.type);
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (reported)
        break;
      LOG5(`\u2500\u2500 Page ${page}/${MAX_PAGES}: Filling fields \u2500\u2500`);
      await atsSpecificFill(ats.type);
      await fillPage(adapter, responses, ats.type);
      await enhancedFillPass();
      await tryResumeUpload();
      await solveCaptcha();
      await sleep4(2e3);
      if (reported)
        break;
      await enhancedFillPass();
      const missingLabels = getMissingRequiredFields();
      const missingCount = missingLabels.length;
      if (missingCount > 0) {
        LOG5(`${missingCount} required fields still missing:`, missingLabels);
        missingLabels.forEach((n) => reportFieldFilled(n, "failed"));
      }
      await sleep4(1e3);
      if (reported)
        break;
      const action = await tryClickSubmitOrNext(missingCount);
      if (action === "submitted") {
        LOG5("Submit clicked \u2014 waiting for success confirmation");
        submitClickedTs = Date.now();
        for (let i = 0; i < 15; i++) {
          await sleep4(1e3);
          if (reported)
            break;
          checkAndReport();
        }
        if (!reported) {
          LOG5("No success confirmation after 15s \u2014 reporting done (submit was clicked)");
          reported = true;
          markApplied();
          send({ type: "COMPLEX_FORM_SUCCESS", message: "Application submitted (submit clicked)" });
        }
        break;
      } else if (action === "next_page") {
        LOG5("Next/Continue clicked \u2014 waiting for page transition");
        send({ type: "SIDEBAR_STATUS", event: "filling_form", atsName: ats.type, url: location.href, page: page + 1 });
        await sleep4(3e3);
        continue;
      } else {
        LOG5("No submit/next button found \u2014 final fill attempt");
        await sleep4(2e3);
        await enhancedFillPass();
        const retry = await tryClickSubmitOrNext(0);
        if (retry === "submitted") {
          submitClickedTs = Date.now();
          for (let i = 0; i < 10; i++) {
            await sleep4(1e3);
            if (reported)
              break;
            checkAndReport();
          }
          if (!reported) {
            reported = true;
            markApplied();
            send({ type: "COMPLEX_FORM_SUCCESS", message: "Application submitted (final attempt)" });
          }
        }
        break;
      }
    }
    successObserver.disconnect();
    clearInterval(successInterval);
    LOG5("Full autofill pipeline complete");
  }
  function countMissingRequired() {
    return getMissingRequiredFields().length;
  }
  async function autoTriggerAutofill() {
    if (_autoTriggerRunning || _autoTriggered || isRunning)
      return;
    const { ua_autoTrigger } = await chrome.storage.local.get("ua_autoTrigger");
    if (ua_autoTrigger === false)
      return;
    const { csvActiveJobId } = await chrome.storage.local.get("csvActiveJobId");
    if (csvActiveJobId)
      return;
    const ats = detectATS(document);
    if (ats.confidence < 0.3)
      return;
    if (!isApplicationPage(ats.type)) {
      LOG5(`Auto-trigger: ${ats.type} detected but no application form yet`);
      return;
    }
    _autoTriggerRunning = true;
    _autoTriggered = true;
    LOG5(`Auto-trigger: ${ats.type} application form detected \u2014 starting pipeline`);
    showControlBar();
    updateControlBar(0, 0);
    const statusEl = document.getElementById("ua-fill-status");
    if (statusEl)
      statusEl.textContent = `${ats.type} detected \u2014 preparing...`;
    try {
      isRunning = true;
      const sidebar = detectJobrightSidebar();
      if (sidebar) {
        LOG5("Auto-trigger: Jobright sidebar detected \u2014 skipping tailoring (let user use Jobright Autofill)");
        if (statusEl)
          statusEl.textContent = `${ats.type} detected \u2014 filling form fields...`;
      }
      await runAtsNavigation(ats.type);
      await atsSpecificFill(ats.type);
      const adapter = getAdapter(ats.type);
      const responses = await getResponses();
      await fillPage(adapter, responses, ats.type);
      await enhancedFillPass();
      await tryResumeUpload();
      await solveCaptcha();
      await sleep4(3e3);
      await enhancedFillPass();
      const missingCount = countMissingRequired();
      if (missingCount === 0) {
        if (statusEl)
          statusEl.textContent = "All fields filled \u2014 submitting...";
        await sleep4(1e3);
        const action = await tryClickSubmitOrNext(0);
        if (action === "submitted") {
          if (statusEl)
            statusEl.textContent = "Application submitted!";
          markApplied();
          send({ type: "COMPLEX_FORM_SUCCESS", message: "Application submitted" });
        } else if (action === "next_page") {
          if (statusEl)
            statusEl.textContent = "Proceeding to next page...";
          _autoTriggered = false;
          _autoTriggerRunning = false;
          await sleep4(3e3);
          autoTriggerAutofill();
          return;
        } else {
          if (statusEl)
            statusEl.textContent = "Autofill complete \u2014 review and submit";
        }
      } else {
        if (statusEl)
          statusEl.textContent = `Autofill complete (${missingCount} fields need review)`;
      }
      LOG5("Auto-trigger: complete");
    } catch (err) {
      LOG5("Auto-trigger: error", err);
    } finally {
      _autoTriggerRunning = false;
    }
  }
  function isApplicationPage(atsType) {
    const url = location.href.toLowerCase();
    const path = location.pathname.toLowerCase();
    if (/\/apply|\/application|\/jobs\/\d|\/requisition/i.test(path))
      return true;
    if (atsType === "workday") {
      return url.includes("/apply") || document.querySelectorAll("[data-automation-id]").length > 2;
    }
    if (atsType === "greenhouse") {
      return !!document.querySelector('#application_form,form[action*="greenhouse"],[data-provided-by="greenhouse"]') || location.hostname.includes("boards.greenhouse.io");
    }
    if (atsType === "lever") {
      return !!document.querySelector(".posting-apply,.postings-form,.application-form") || location.hostname.includes("jobs.lever.co");
    }
    if (atsType === "icims") {
      return document.querySelectorAll("input:not([type=hidden])").length > 2;
    }
    if (atsType === "smartrecruiters") {
      return url.includes("/apply") || document.querySelectorAll("input[name]").length > 2;
    }
    if (atsType === "taleo") {
      return url.includes("/apply") || !!document.querySelector("#OracleFusionApp,oracle-apply-flow");
    }
    if (atsType === "indeed") {
      return path.includes("/viewjob") || path.includes("/applystart") || !!document.querySelector('#indeedApplyModal,.ia-container,[id*="indeedApply"]');
    }
    if (atsType === "linkedin") {
      return path.includes("/jobs/view/") || path.includes("/jobs/collections/") || !!document.querySelector(".jobs-easy-apply-modal,[data-test-modal],.jobs-apply-button");
    }
    if (atsType === "hiringcafe") {
      return !!Array.from(document.querySelectorAll("a, button")).find(
        (el) => /apply directly|apply now/i.test(el.textContent || "") && isVisible(el)
      );
    }
    if (atsType === "ashby") {
      return path.includes("/application") || !!document.querySelector("[data-ashby-form]");
    }
    const hasApply = $$2('a, button, [role="button"]').some((el) => {
      const t = (el.textContent || "").trim().toLowerCase();
      return /^(apply|apply now|apply directly|easy apply)\b/.test(t) && isVisible(el);
    });
    if (hasApply)
      return true;
    const hasName = !!document.querySelector('input[name*="name" i],input[autocomplete="given-name"]');
    const hasEmail = !!document.querySelector('input[type="email"],input[name*="email" i],input[autocomplete="email"]');
    return hasName && hasEmail;
  }
  var _dialogFillDebounce = null;
  function watchMissingDetailsDialog() {
    new MutationObserver(async () => {
      if (_dialogFillDebounce)
        return;
      const dialog = Array.from(document.querySelectorAll(
        '[class*="missing"],[id*="missing"],[role="dialog"],[class*="modal"]'
      )).find(
        (el) => isVisible(el) && /missing details|fill.*details|add.*details|fill.*form/i.test(el.textContent || "")
      );
      if (dialog) {
        _dialogFillDebounce = setTimeout(() => {
          _dialogFillDebounce = null;
        }, 3e3);
        LOG5("Missing details dialog detected \u2014 auto-filling");
        await sleep4(300);
        await enhancedFillPass();
        await sleep4(700);
        const btn = Array.from(dialog.querySelectorAll("button")).find(
          (el) => isVisible(el) && /save|submit|continue|done|next|confirm/i.test(el.textContent || "")
        );
        if (btn)
          realClick(btn);
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: false });
  }
  var _lastHref = location.href;
  setInterval(() => {
    if (location.href !== _lastHref) {
      _lastHref = location.href;
      _autoTriggered = false;
      _autoTriggerRunning = false;
      sleep4(2e3).then(() => autoTriggerAutofill());
    }
  }, 1e3);
  var _mutationDebounce = null;
  var _autoTriggerObserver = new MutationObserver((mutations) => {
    if (_autoTriggered || _autoTriggerRunning)
      return;
    const added = mutations.reduce((n, m) => n + m.addedNodes.length, 0);
    if (added < 2)
      return;
    if (_mutationDebounce)
      clearTimeout(_mutationDebounce);
    _mutationDebounce = setTimeout(() => autoTriggerAutofill(), 1500);
  });
  if (document.body) {
    _autoTriggerObserver.observe(document.body, { childList: true, subtree: true });
  }
  sleep4(2500).then(() => autoTriggerAutofill());
  if (document.body)
    watchMissingDetailsDialog();
  var _csvBridgeStarted = false;
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(async (changes, area) => {
      if (area !== "local" || _csvBridgeStarted)
        return;
      const newJobId = changes.csvActiveJobId?.newValue;
      const newTabId = changes.csvActiveTabId?.newValue;
      if (newJobId && newTabId) {
        _csvBridgeStarted = true;
        LOG5("CSV bridge: storage change detected \u2014 triggering autofill");
        await sleep4(3e3);
        runFullAutofill().catch(() => {
        });
      }
    });
  }
  var _csvFillDebounce = null;
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    new MutationObserver(async () => {
      try {
        const { csvActiveJobId } = await chrome.storage.local.get("csvActiveJobId");
        if (!csvActiveJobId)
          return;
        if (_csvFillDebounce)
          clearTimeout(_csvFillDebounce);
        _csvFillDebounce = setTimeout(async () => {
          await enhancedFillPass();
          await solveCaptcha();
        }, 800);
      } catch {
      }
    }).observe(document.body, { childList: true, subtree: false });
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
  function updateControlBar(filled, total) {
    const el = document.getElementById("ua-fill-status");
    if (el)
      el.textContent = `${filled}/${total} fields filled`;
  }
  function removeControlBar() {
    document.getElementById("ua-control-bar")?.remove();
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
  LOG5("v3.0 loaded \u2014 enhanced autofill with tailoring ready");
})();
//# sourceMappingURL=content.js.map
