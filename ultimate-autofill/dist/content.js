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
      urls: [/taleo\.net/i],
      dom: ['[class*="taleo"]', "#requisitionDescriptionInterface"],
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

  // src/adapters/index.ts
  var adapters = {
    workday: workdayAdapter,
    greenhouse: greenhouseAdapter,
    generic: genericAdapter
  };
  function getAdapter(type) {
    return adapters[type] || genericAdapter;
  }

  // src/content/main.ts
  var isRunning = false;
  var observer = null;
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
  });
  async function send(msg) {
    return chrome.runtime.sendMessage(msg);
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
    showControlBar();
    const ats = detectATS(document);
    const adapter = getAdapter(ats.type);
    const responses = await getResponses();
    await fillPage(adapter, responses, ats.type);
    observer = new MutationObserver(async (mutations) => {
      if (!isRunning)
        return;
      const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
      if (hasNewNodes) {
        await fillPage(adapter, responses, ats.type);
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
    const label = getFieldLabel(el);
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
      const label = getFieldLabel(el);
      if (label && label.length > 30)
        return true;
    }
    return false;
  }
  function getFieldLabel(el) {
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
})();
//# sourceMappingURL=content.js.map
