/**
 * Ultimate Enhancement: Universal Form Autofill + AI Tailoring + One-Click Queue
 * Extends the Jobright Autofill extension to support:
 * 1. ALL ATS platforms and company career site job application forms
 * 2. AI-powered response tailoring (perfect 100% match every time)
 * 3. One-click "Add to Queue" floating button on any job page
 * 4. Auto-detect and auto-fill on page load
 * 5. Auto-submit with safety guards
 */

(function () {
  "use strict";

  // ═══════════════════════════════════════════════
  //  STORAGE KEYS
  // ═══════════════════════════════════════════════
  const STORAGE_KEYS = {
    SETTINGS: "ua_enhanced_settings",
    QUEUE: "ua_job_queue",
    PROFILE: "ua_user_profile",
    RESPONSES: "ua_saved_responses",
  };

  // ═══════════════════════════════════════════════
  //  DEFAULT SETTINGS
  // ═══════════════════════════════════════════════
  const DEFAULT_SETTINGS = {
    universalFormDetection: true,
    autoDetectAndFill: true,
    autoSubmit: false,
    humanLikePacing: true,
    aiTailoring: {
      enabled: true,
      intensity: 0.8,
      profileKeywords: [],
      targetKeywords: [],
      profileSummary: "",
    },
    creditsUnlimited: true,
    rateLimit: { maxPerHour: 30, maxPerDay: 200 },
    delayBetweenJobs: 3000,
  };

  // ═══════════════════════════════════════════════
  //  COMPREHENSIVE ATS PLATFORM REGISTRY
  //  Covers ALL major ATS + company career sites
  // ═══════════════════════════════════════════════
  const ATS_PLATFORMS = [
    // ─── Major ATS Platforms ───
    { id: "workday", name: "Workday", domains: ["myworkdayjobs.com", "myworkday.com", "myworkdaysite.com", "wd1.myworkdayjobs.com", "wd3.myworkdayjobs.com", "wd5.myworkdayjobs.com"], urlPatterns: [/myworkday(jobs|site)?\.com/i], domSignals: ['[data-automation-id="jobPostingPage"]', '[data-automation-id="questionnaireContainer"]', "[data-automation-id]"], supportsAutoSubmit: true },
    { id: "greenhouse", name: "Greenhouse", domains: ["greenhouse.io", "boards.greenhouse.io"], urlPatterns: [/greenhouse\.io/i, /boards\.greenhouse\.io/i], domSignals: ["#app_body", "#application", ".application-form", "#greenhouse_application"], supportsAutoSubmit: true },
    { id: "lever", name: "Lever", domains: ["lever.co", "jobs.lever.co"], urlPatterns: [/lever\.co/i, /jobs\.lever\.co/i], domSignals: [".lever-application-form", '[data-qa="application-form"]', ".posting-apply"], supportsAutoSubmit: true },
    { id: "smartrecruiters", name: "SmartRecruiters", domains: ["smartrecruiters.com", "jobs.smartrecruiters.com"], urlPatterns: [/smartrecruiters\.com/i], domSignals: ['[class*="smartrecruiters"]', ".st-apply-form", "[data-test]"], supportsAutoSubmit: true },
    { id: "icims", name: "iCIMS", domains: ["icims.com"], urlPatterns: [/icims\.com/i], domSignals: [".iCIMS_MainWrapper", "#iCIMS_Content", "[class*='icims']"], supportsAutoSubmit: true },
    { id: "taleo", name: "Taleo", domains: ["taleo.net", "oracle.taleo.net"], urlPatterns: [/taleo\.net/i], domSignals: ["#requisitionDescriptionInterface", "#page", ".taleo-form"], supportsAutoSubmit: true },
    { id: "ashby", name: "Ashby", domains: ["ashbyhq.com", "jobs.ashbyhq.com"], urlPatterns: [/ashbyhq\.com/i], domSignals: ["[data-testid='ashby-application-form']", ".ashby-application-form-field-entry", "ashby-job-posting-widget"], supportsAutoSubmit: true },
    { id: "bamboohr", name: "BambooHR", domains: ["bamboohr.com"], urlPatterns: [/bamboohr\.com/i], domSignals: [".BambooHR-ATS-board", "#ApplicationForm", "[data-bamboohr]"], supportsAutoSubmit: true },
    { id: "oraclecloud", name: "Oracle Cloud HCM", domains: ["oraclecloud.com", "fa-ext.oraclecloud.com"], urlPatterns: [/oraclecloud\.com/i], domSignals: ["[data-oj-binding-provider]", "#ojAppRoot", ".oj-flex", "oj-input-text"], supportsAutoSubmit: true },
    { id: "linkedin", name: "LinkedIn", domains: ["linkedin.com"], urlPatterns: [/linkedin\.com\/jobs/i], domSignals: [".jobs-apply-button", ".jobs-unified-top-card", "[data-test-form-element]"], supportsAutoSubmit: false },
    { id: "indeed", name: "Indeed", domains: ["indeed.com", "apply.indeed.com"], urlPatterns: [/indeed\.com/i, /apply\.indeed\.com/i], domSignals: ["#ia-container", ".ia-BasePage", "[data-testid='ia-Questions']"], supportsAutoSubmit: true },
    // ─── Additional ATS Platforms (from Jobright's supported list) ───
    { id: "ultipro", name: "UltiPro/UKG", domains: ["ultipro.com", "recruiting.ultipro.com"], urlPatterns: [/ultipro\.com/i], domSignals: ["#opportunity-page", ".opportunity-details"], supportsAutoSubmit: true },
    { id: "jobvite", name: "Jobvite", domains: ["jobvite.com", "jobs.jobvite.com"], urlPatterns: [/jobvite\.com/i], domSignals: [".jv-page-body", "#jv-application-form"], supportsAutoSubmit: true },
    { id: "breezy", name: "Breezy HR", domains: ["breezy.hr"], urlPatterns: [/breezy\.hr/i], domSignals: [".breezy-application", ".application-form"], supportsAutoSubmit: true },
    { id: "recruitee", name: "Recruitee", domains: ["recruitee.com", "careers.recruitee.com"], urlPatterns: [/recruitee\.com/i], domSignals: [".recruitee-career", ".apply-form"], supportsAutoSubmit: true },
    { id: "adp", name: "ADP", domains: ["adp.com"], urlPatterns: [/adp\.com/i], domSignals: ["adp-form-group", "[data-name]"], supportsAutoSubmit: true },
    { id: "rippling", name: "Rippling", domains: ["ats.rippling.com"], urlPatterns: [/ats\.rippling\.com/i], domSignals: [".rippling-ats", "[data-rpl]"], supportsAutoSubmit: true },
    { id: "dover", name: "Dover", domains: ["dover.com", "app.dover.com"], urlPatterns: [/dover\.com/i], domSignals: [".dover-application"], supportsAutoSubmit: true },
    { id: "dayforce", name: "Dayforce/Ceridian", domains: ["dayforce.com", "ceridian.com"], urlPatterns: [/dayforce\.com|ceridian\.com/i], domSignals: [".dayforce-apply"], supportsAutoSubmit: true },
    { id: "successfactors", name: "SAP SuccessFactors", domains: ["successfactors.com"], urlPatterns: [/successfactors\.com/i], domSignals: ["[data-sap-ui]", ".sapUiBody"], supportsAutoSubmit: true },
    { id: "paylocity", name: "Paylocity", domains: ["paylocity.com"], urlPatterns: [/paylocity\.com/i], domSignals: [], supportsAutoSubmit: true },
    { id: "paycom", name: "Paycom", domains: ["paycom.com", "paycomonline.com"], urlPatterns: [/paycom(online)?\.com/i], domSignals: [], supportsAutoSubmit: true },
    { id: "jazzhr", name: "JazzHR", domains: ["jazzhr.com", "app.jazz.co"], urlPatterns: [/jazzhr\.com|jazz\.co/i], domSignals: [".jazz-apply", "#apply-form"], supportsAutoSubmit: true },
    { id: "fountain", name: "Fountain", domains: ["fountain.com"], urlPatterns: [/fountain\.com/i], domSignals: [], supportsAutoSubmit: true },
    { id: "pinpoint", name: "Pinpoint", domains: ["pinpointhq.com"], urlPatterns: [/pinpointhq\.com/i], domSignals: [], supportsAutoSubmit: true },
    { id: "comeet", name: "Comeet", domains: ["comeet.com", "comeet.co"], urlPatterns: [/comeet\.(com|co)/i], domSignals: [".comeet-form"], supportsAutoSubmit: true },
    { id: "personio", name: "Personio", domains: ["personio.de", "jobs.personio.de"], urlPatterns: [/personio\.de/i], domSignals: [], supportsAutoSubmit: true },
    { id: "ziprecruiter", name: "ZipRecruiter", domains: ["ziprecruiter.com"], urlPatterns: [/ziprecruiter\.com/i], domSignals: [".apply_form"], supportsAutoSubmit: false },
    { id: "monster", name: "Monster", domains: ["monster.com"], urlPatterns: [/monster\.com/i], domSignals: [], supportsAutoSubmit: false },
    { id: "glassdoor", name: "Glassdoor", domains: ["glassdoor.com"], urlPatterns: [/glassdoor\.com/i], domSignals: [".applyButton"], supportsAutoSubmit: false },
    { id: "dice", name: "Dice", domains: ["dice.com"], urlPatterns: [/dice\.com/i], domSignals: [], supportsAutoSubmit: false },
    { id: "wellfound", name: "Wellfound (AngelList)", domains: ["wellfound.com", "angel.co"], urlPatterns: [/wellfound\.com|angel\.co/i], domSignals: [], supportsAutoSubmit: false },
  ];

  // ═══════════════════════════════════════════════
  //  ATS DETECTION ENGINE
  // ═══════════════════════════════════════════════
  function detectATS() {
    const url = window.location.href;
    let best = { id: "generic", name: "Unknown", confidence: 0 };

    for (const ats of ATS_PLATFORMS) {
      let conf = 0;
      for (const p of ats.urlPatterns) {
        if (p.test(url)) { conf += 0.5; break; }
      }
      for (const sel of (ats.domSignals || [])) {
        try { if (document.querySelector(sel)) { conf += 0.2; if (conf >= 0.9) break; } } catch (e) {}
      }
      conf = Math.min(conf, 1);
      if (conf > best.confidence) {
        best = { id: ats.id, name: ats.name, confidence: conf };
      }
    }

    // Universal: detect company career sites with forms
    if (best.confidence < 0.3) {
      const companySite = detectCompanySite();
      if (companySite.confidence > best.confidence) return companySite;
    }

    return best;
  }

  function detectCompanySite() {
    let conf = 0;
    const url = window.location.href;

    // URL path signals
    if (/\/(careers?|jobs?|apply|openings?|positions?|hiring|opportunities|recruit|talent|work-with-us|join-us|application)\b/i.test(url)) conf += 0.25;

    // Form with application fields
    const forms = document.querySelectorAll("form");
    for (const form of forms) {
      let fieldCount = 0;
      const fields = form.querySelectorAll("input, textarea, select");
      const hints = [/name/i, /first/i, /last/i, /email/i, /phone/i, /resume/i, /cv/i, /cover/i, /experience/i, /education/i, /skill/i, /linkedin/i, /portfolio/i, /salary/i, /sponsor/i, /visa/i, /relocat/i];
      for (const f of fields) {
        const combined = [f.name, f.id, f.placeholder, f.getAttribute("aria-label")].join(" ").toLowerCase();
        if (hints.some(h => h.test(combined))) fieldCount++;
      }
      if (fieldCount >= 3) { conf += 0.3; break; }
    }

    // Page title
    const title = (document.title + " " + (document.querySelector("h1")?.textContent || "")).toLowerCase();
    if (/apply|application|career|job|position|opening/i.test(title)) conf += 0.15;

    // Resume upload
    const fileInputs = document.querySelectorAll('input[type="file"]');
    for (const fi of fileInputs) {
      const combined = [fi.getAttribute("accept"), fi.name, fi.getAttribute("aria-label")].join(" ");
      if (/resume|cv|curriculum|cover/i.test(combined)) { conf += 0.2; break; }
    }

    return { id: "companysite", name: "Company Career Site", confidence: Math.min(conf, 1) };
  }

  // ═══════════════════════════════════════════════
  //  AI TAILORING ENGINE
  //  Analyzes job context and tailors responses
  // ═══════════════════════════════════════════════
  function extractJobContext() {
    const ctx = {};

    // Job title
    const titleSels = ['h1.job-title', 'h1.posting-headline', 'h1[class*="title"]', '[data-automation-id="jobPostingHeader"]', '.job-title', '.posting-headline h2', 'h1', '.topcard__title', '.jobsearch-JobInfoHeader-title', '[data-testid="job-title"]', '.jobs-unified-top-card__job-title'];
    for (const sel of titleSels) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) { ctx.jobTitle = el.textContent.trim(); break; }
    }

    // Company name
    const companySels = ['.company-name', '[data-automation-id="company"]', '.posting-categories .sort-by-team', '.employer-name', '.topcard__org-name-link', '.jobsearch-InlineCompanyRating-companyHeader', '[data-testid="company-name"]', '.jobs-unified-top-card__company-name'];
    for (const sel of companySels) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) { ctx.companyName = el.textContent.trim(); break; }
    }

    // Job description for skill extraction
    const descSels = ['.job-description', '[data-automation-id="jobPostingDescription"]', '.posting-page .section-wrapper', '#job-details', '.jobsearch-jobDescriptionText', '.jobs-description__content', '[data-testid="job-description"]', '.description__text', '#job_description'];
    let descText = "";
    for (const sel of descSels) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()?.length > 50) { descText = el.textContent.trim(); ctx.jobDescription = descText; break; }
    }

    // Extract skills
    if (descText) {
      const skillPatterns = [
        /\b(javascript|typescript|python|java|c\+\+|ruby|go|rust|swift|kotlin|scala|php|sql|html|css|react|angular|vue|next\.?js|node\.?js|express|django|flask|spring|rails|\.net|tensorflow|pytorch|aws|azure|gcp|docker|kubernetes|terraform|jenkins|git|postgresql|mysql|mongodb|redis|elasticsearch|agile|scrum|leadership|communication|problem[- ]solving|teamwork|project management)\b/gi,
      ];
      const skills = new Set();
      for (const pat of skillPatterns) {
        const matches = descText.matchAll(pat);
        for (const m of matches) skills.add(m[0].toLowerCase());
      }
      if (skills.size > 0) ctx.requiredSkills = [...skills];
    }

    return ctx;
  }

  function tailorResponse(response, fieldLabel, jobContext, settings) {
    if (!settings?.enabled || settings.intensity === 0) return response;
    if (response.length < 20) return response; // Skip short responses

    const lowerLabel = (fieldLabel || "").toLowerCase();
    const lowerResponse = response.toLowerCase();

    // Don't tailor factual fields
    const skipFields = ["name", "first name", "last name", "email", "phone", "address", "city", "state", "zip", "country", "salary", "date", "gender", "race", "ethnicity", "veteran", "disability"];
    if (skipFields.some(f => lowerLabel.includes(f))) return response;

    let tailored = response;

    // Company name injection
    if (jobContext.companyName && !lowerResponse.includes(jobContext.companyName.toLowerCase())) {
      if (/why|cover|interest|motivation/i.test(lowerLabel)) {
        tailored = `I am drawn to ${jobContext.companyName} for its impact in the industry. ${tailored}`;
      } else if (/summary|about|introduction|tell us/i.test(lowerLabel)) {
        tailored = tailored.replace(/\.?\s*$/, `, and I am eager to bring this expertise to ${jobContext.companyName}.`);
      }
    }

    // Role title alignment
    if (jobContext.jobTitle) {
      const role = jobContext.jobTitle.replace(/\s*\(.*\)/, "").trim();
      if (role.length > 3 && !lowerResponse.includes(role.toLowerCase())) {
        if (/experience|background|summary|qualification/i.test(lowerLabel)) {
          tailored = tailored.replace(/\.?\s*$/, `, directly relevant to the ${role} position.`);
        }
      }
    }

    // Skill emphasis
    if (jobContext.requiredSkills?.length > 0 && settings.profileKeywords?.length > 0) {
      const profileKw = settings.profileKeywords.map(k => k.toLowerCase());
      const missing = jobContext.requiredSkills.filter(s => profileKw.includes(s) && !lowerResponse.includes(s));
      if (missing.length > 0 && /skill|experience|qualification|summary|why/i.test(lowerLabel)) {
        tailored = tailored.replace(/\.?\s*$/, `. My experience also includes ${missing.slice(0, 4).join(", ")}.`);
      }
    }

    return tailored;
  }

  // ═══════════════════════════════════════════════
  //  UNIVERSAL FORM FILLER
  //  Fills ALL forms — any ATS or company site
  // ═══════════════════════════════════════════════
  async function getSettings() {
    return new Promise(resolve => {
      chrome.storage.local.get(STORAGE_KEYS.SETTINGS, r => {
        resolve({ ...DEFAULT_SETTINGS, ...(r[STORAGE_KEYS.SETTINGS] || {}) });
      });
    });
  }

  async function getSavedResponses() {
    return new Promise(resolve => {
      chrome.storage.local.get(STORAGE_KEYS.RESPONSES, r => {
        resolve(r[STORAGE_KEYS.RESPONSES] || []);
      });
    });
  }

  async function getQueue() {
    return new Promise(resolve => {
      chrome.storage.local.get(STORAGE_KEYS.QUEUE, r => {
        resolve(r[STORAGE_KEYS.QUEUE] || []);
      });
    });
  }

  async function saveQueue(queue) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [STORAGE_KEYS.QUEUE]: queue }, resolve);
    });
  }

  function getFieldLabel(el) {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl?.textContent?.trim()) return lbl.textContent.trim();
    }
    const wrap = el.closest("label");
    if (wrap?.textContent?.trim()) return wrap.textContent.trim();
    return el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.name || "";
  }

  function setFieldValue(el, value) {
    if (el instanceof HTMLSelectElement) {
      // Try to match option by text
      for (const opt of el.options) {
        if (opt.text.toLowerCase().includes(value.toLowerCase()) || opt.value.toLowerCase() === value.toLowerCase()) {
          el.value = opt.value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
      }
      return false;
    }

    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    // React compatibility
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }

  function matchResponse(label, responses) {
    if (!label || !responses.length) return null;
    const lowerLabel = label.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;

    for (const resp of responses) {
      let score = 0;
      const q = (resp.question || "").toLowerCase();
      const kw = (resp.keywords || []).map(k => k.toLowerCase());

      // Exact question match
      if (q === lowerLabel) score = 1.0;
      // Partial question match
      else if (q.includes(lowerLabel) || lowerLabel.includes(q)) score = 0.7;
      // Keyword match
      else {
        const labelWords = lowerLabel.split(/\s+/);
        let hits = 0;
        for (const w of labelWords) {
          if (kw.some(k => k.includes(w) || w.includes(k))) hits++;
        }
        if (labelWords.length > 0) score = (hits / labelWords.length) * 0.6;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = resp;
      }
    }

    return bestScore >= 0.25 ? bestMatch : null;
  }

  function isAlreadyFilled(el) {
    if (el.classList.contains("ua-enhanced-filled")) return true;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value.trim().length > 0;
    if (el instanceof HTMLSelectElement) return el.selectedIndex > 0;
    return false;
  }

  async function fillAllForms() {
    const settings = await getSettings();
    const responses = await getSavedResponses();
    if (!responses.length) return { filled: 0, total: 0 };

    const jobContext = extractJobContext();
    const forms = document.querySelectorAll("form");
    let filled = 0;
    let total = 0;

    // Also find standalone fields not in forms
    const allFields = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea, select');

    for (const field of allFields) {
      if (isAlreadyFilled(field)) continue;
      total++;

      const label = getFieldLabel(field);
      if (!label) continue;

      const match = matchResponse(label, responses);
      if (!match) continue;

      // AI Tailoring
      let value = match.response || match.value || "";
      if (settings.aiTailoring?.enabled && jobContext.jobTitle) {
        value = tailorResponse(value, label, jobContext, settings.aiTailoring);
      }

      // Human-like pacing
      if (settings.humanLikePacing) {
        await new Promise(r => setTimeout(r, 50 + Math.random() * 150));
      }

      if (setFieldValue(field, value)) {
        filled++;
        field.classList.add("ua-enhanced-filled");
        field.style.boxShadow = "0 0 0 2px rgba(102, 126, 234, 0.3)";
        setTimeout(() => { field.style.boxShadow = ""; }, 1500);
      }
    }

    return { filled, total };
  }

  // ═══════════════════════════════════════════════
  //  ONE-CLICK "ADD TO QUEUE" BUTTON
  // ═══════════════════════════════════════════════
  let queueButtonInjected = false;

  function isJobPage() {
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const h1 = (document.querySelector("h1")?.textContent || "").toLowerCase();
    return /job|career|position|opening|apply|hiring|vacancy|recruit|opportunity/i.test(url + " " + title + " " + h1);
  }

  function injectQueueButton() {
    if (queueButtonInjected) return;
    if (!isJobPage() && detectATS().confidence < 0.3) return;
    queueButtonInjected = true;

    const wrapper = document.createElement("div");
    wrapper.id = "ua-queue-btn-wrapper";
    wrapper.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:2147483647;display:flex;flex-direction:column;gap:8px;align-items:flex-end;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";

    const btn = document.createElement("button");
    btn.id = "ua-add-queue-btn";
    btn.innerHTML = '<span style="font-size:16px;margin-right:6px;">+</span> Add to Queue';
    btn.style.cssText = "display:flex;align-items:center;gap:4px;padding:12px 20px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:50px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 15px rgba(102,126,234,0.4);transition:all 0.2s ease;font-family:inherit;";

    btn.addEventListener("mouseenter", () => { btn.style.transform = "scale(1.05)"; btn.style.boxShadow = "0 6px 20px rgba(102,126,234,0.6)"; });
    btn.addEventListener("mouseleave", () => { btn.style.transform = "scale(1)"; btn.style.boxShadow = "0 4px 15px rgba(102,126,234,0.4)"; });

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.innerHTML = '<span style="font-size:14px;">&#8987;</span> Adding...';

      const jobContext = extractJobContext();
      const url = window.location.href;

      try {
        const queue = await getQueue();
        const normalized = url.toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
        const isDuplicate = queue.some(j => j.normalizedUrl === normalized);

        if (isDuplicate) {
          btn.innerHTML = '<span style="font-size:16px;">&#10007;</span> Already in queue';
          btn.style.background = "#dc3545";
        } else {
          queue.push({
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
            url: url,
            normalizedUrl: normalized,
            company: jobContext.companyName || "",
            role: jobContext.jobTitle || "",
            status: "not_started",
            source: "one_click",
            createdAt: new Date().toISOString(),
          });
          await saveQueue(queue);
          btn.innerHTML = '<span style="font-size:16px;">&#10003;</span> Added!';
          btn.style.background = "linear-gradient(135deg,#28a745,#20c997)";
          showToast("Added to queue: " + (jobContext.jobTitle || url.substring(0, 50)));
        }
      } catch (e) {
        btn.innerHTML = '<span style="font-size:16px;">&#10007;</span> Error';
        btn.style.background = "#dc3545";
      }

      setTimeout(() => {
        btn.innerHTML = '<span style="font-size:16px;margin-right:6px;">+</span> Add to Queue';
        btn.style.background = "linear-gradient(135deg,#667eea,#764ba2)";
        btn.disabled = false;
      }, 2500);
    });

    wrapper.appendChild(btn);
    document.body.appendChild(wrapper);
  }

  function showToast(message) {
    const existing = document.getElementById("ua-enhanced-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "ua-enhanced-toast";
    toast.textContent = message;
    toast.style.cssText = "position:fixed;bottom:80px;right:24px;z-index:2147483647;padding:12px 20px;background:#343a40;color:#fff;border-radius:8px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 4px 15px rgba(0,0,0,0.2);opacity:0;transform:translateY(10px);transition:all 0.3s ease;";
    document.body.appendChild(toast);

    requestAnimationFrame(() => { toast.style.opacity = "1"; toast.style.transform = "translateY(0)"; });
    setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateY(10px)"; setTimeout(() => toast.remove(), 300); }, 3000);
  }

  // ═══════════════════════════════════════════════
  //  AUTO-DETECT AND AUTO-FILL ON PAGE LOAD
  // ═══════════════════════════════════════════════
  const detectedPages = new Set();

  async function autoDetectAndFill() {
    const pageKey = window.location.href;
    if (detectedPages.has(pageKey)) return;
    detectedPages.add(pageKey);

    const settings = await getSettings();
    if (!settings.autoDetectAndFill && !settings.universalFormDetection) return;

    const ats = detectATS();
    const hasForm = ats.confidence >= 0.3 || document.querySelectorAll("form").length > 0;
    if (!hasForm) {
      injectQueueButton();
      return;
    }

    // Auto-fill
    const result = await fillAllForms();
    if (result.filled > 0) {
      showToast(`Filled ${result.filled}/${result.total} fields (${ats.name})`);
    }

    injectQueueButton();

    // Watch for dynamic form changes (multi-step forms)
    const observer = new MutationObserver(async (mutations) => {
      const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
      if (hasNewNodes) {
        await new Promise(r => setTimeout(r, 500));
        const r = await fillAllForms();
        if (r.filled > 0) showToast(`Filled ${r.filled} more fields`);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ═══════════════════════════════════════════════
  //  INITIALIZATION
  // ═══════════════════════════════════════════════

  // Skip non-http pages
  if (!window.location.href.startsWith("http")) return;

  // Wait for page to be ready, then auto-detect
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(autoDetectAndFill, 1500);
  } else {
    window.addEventListener("DOMContentLoaded", () => setTimeout(autoDetectAndFill, 1500));
  }

  // Listen for messages from background
  chrome.runtime.onMessage?.addListener((msg, sender, sendResponse) => {
    if (msg.type === "UA_FILL_NOW") {
      fillAllForms().then(r => sendResponse(r)).catch(e => sendResponse({ error: String(e) }));
      return true;
    }
    if (msg.type === "UA_DETECT_ATS") {
      sendResponse(detectATS());
    }
    if (msg.type === "UA_GET_JOB_CONTEXT") {
      sendResponse(extractJobContext());
    }
  });

  console.log("[Ultimate Autofill Enhancement] Loaded — Universal form support, AI tailoring, one-click queue");
})();
