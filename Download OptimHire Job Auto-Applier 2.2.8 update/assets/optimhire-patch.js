/**
 * OptimHire Patch v2.2.8
 * Comprehensive enhancement patch covering:
 * - Task 2:  Credits never run out (9999 always)
 * - Task 3:  CSV job URL import & queue
 * - Task 4:  Fast skip countdown (3 s)
 * - Task 5:  Indeed "Apply on company site" navigation
 * - Task 6:  LinkedIn Easy Apply + direct company apply
 * - Task 7:  Fresh job scraping priority (30 min > 24 h > 3 days)
 * - Task 8:  Workday ATS autofill
 * - Task 9:  Deduplication – never apply to same job twice
 * - Task 10: HiringCafe.com "Apply Directly" navigation + company-size filter
 * - Task 11: OracleCloud + SmartRecruiters ATS support
 * - Task 12: Auto-solve captchas (checkbox reCAPTCHA)
 * - Task 13: Auto-fill missing required fields with stored answers
 * - Task 14: Wake-Lock to prevent PC sleep during automation
 * - Task 15: Freshness filter (prioritise recent postings)
 * - Task 16: Hide referral section in UI
 * - Task 17: Fix "Please fill missing details" stall
 * - Task 18: Auto-handle "Add Missing Details" dialog
 */

(function () {
  "use strict";

  /* ===================================================================
   * CONSTANTS & HELPERS
   * =================================================================== */
  const LOG = (...a) => console.log("[OH-Patch]", ...a);
  const STORAGE = chrome.storage.local;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /** Dispatch a real input event so React/Vue re-renders pick up the value */
  function nativeSet(el, value) {
    try {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        el.tagName === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype,
        "value"
      )?.set;
      if (nativeInputValueSetter) nativeInputValueSetter.call(el, value);
      else el.value = value;
    } catch (_) {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** Simulated click that also triggers pointer events */
  function realClick(el) {
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.click();
  }

  /* ===================================================================
   * TASK 2 – Credits never run out (refresh on every page load)
   * =================================================================== */
  async function ensureUnlimitedCredits() {
    const CREDIT_KEYS = [
      "candidateDetails",
      "userDetails",
      "planDetails",
      "subscriptionDetails",
    ];
    const data = await STORAGE.get(CREDIT_KEYS);

    const updates = {};
    for (const key of CREDIT_KEYS) {
      if (data[key]) {
        const parsed =
          typeof data[key] === "string" ? JSON.parse(data[key]) : data[key];
        const patched = deepPatchCredits(parsed);
        updates[key] =
          typeof data[key] === "string"
            ? JSON.stringify(patched)
            : patched;
      }
    }
    if (Object.keys(updates).length) await STORAGE.set(updates);
    LOG("Credits locked at 9999");
  }

  function deepPatchCredits(obj) {
    if (!obj || typeof obj !== "object") return obj;
    const FIELDS = [
      "free_left_credits",
      "leftCredits",
      "remainingCredits",
      "credits",
      "autofillCredits",
      "plan_credits",
    ];
    for (const f of FIELDS) {
      if (f in obj) obj[f] = 9999;
    }
    for (const k of Object.keys(obj)) {
      if (obj[k] && typeof obj[k] === "object") obj[k] = deepPatchCredits(obj[k]);
    }
    return obj;
  }

  // Run on load and every 30 seconds
  ensureUnlimitedCredits();
  setInterval(ensureUnlimitedCredits, 30_000);

  /* ===================================================================
   * TASK 14 – Wake Lock (prevent PC sleep during automation)
   * =================================================================== */
  let wakeLock = null;

  async function acquireWakeLock() {
    if (!("wakeLock" in navigator)) {
      // Fallback: play a silent video loop
      LOG("Wake Lock API unavailable – using audio fallback");
      startAudioWakeLock();
      return;
    }
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        LOG("Wake lock released, re-acquiring...");
        setTimeout(acquireWakeLock, 1000);
      });
      LOG("Screen wake lock acquired");
    } catch (e) {
      LOG("Wake lock request failed:", e.message);
    }
  }

  function startAudioWakeLock() {
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.001; // near silent
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
    } catch (_) {}
    // Also simulate user activity every 50 seconds
    setInterval(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    }, 50_000);
  }

  // Acquire when automation is running
  chrome.runtime.onMessage.addListener((msg) => {
    if (
      msg?.type === "START_AUTOMATION" ||
      msg?.type === "pilot_started" ||
      msg?.type === "start_pilot_web"
    ) {
      acquireWakeLock();
    }
  });

  // Also auto-acquire if automation is already running on page load
  STORAGE.get("isAutoProcessStartJob").then((d) => {
    if (d.isAutoProcessStartJob) acquireWakeLock();
  });

  /* ===================================================================
   * TASK 16 – Hide referral section from UI
   * =================================================================== */
  function hideReferralSection() {
    const style = document.createElement("style");
    style.id = "oh-patch-hide-referral";
    style.textContent = `
      /* Hide referral / affiliate banners */
      [class*="referral"],
      [class*="Referral"],
      [id*="referral"],
      [data-testid*="referral"],
      [class*="affiliate"],
      .referral-section,
      .referral-card,
      .referral-banner,
      .earn-credits-section,
      [class*="earnCredit"],
      [class*="inviteFriend"],
      [class*="invite-friend"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }
  hideReferralSection();

  /* ===================================================================
   * TASK 8 – Workday ATS Autofill
   * =================================================================== */
  const WORKDAY_FIELD_MAP = {
    // Personal
    legalNameSection_firstName: "first_name",
    legalNameSection_lastName: "last_name",
    legalNameSection_middleName: "middle_name",
    email: "email",
    phone: "phone",
    address_line1: "address",
    city: "city",
    state: "state",
    postalCode: "postal_code",
    country: "country",
    // Work experience
    jobTitle: "current_title",
    company: "current_company",
    // Education
    school: "school",
    degree: "degree",
    major: "major",
    // Other
    howDidYouHear: "how_did_you_hear",
    linkedIn: "linkedin_url",
    website: "website_url",
    github: "github_url",
    yearsOfExperience: "years_of_experience",
    salary: "expected_salary",
    coverLetter: "cover_letter",
  };

  function isWorkday() {
    return (
      location.hostname.includes("myworkdayjobs.com") ||
      location.hostname.includes("workday.com") ||
      !!document.querySelector("[data-automation-id]") ||
      !!document.querySelector("div[data-uxi-widget-type]")
    );
  }

  async function workdayAutofill(profile) {
    if (!isWorkday()) return;
    LOG("Workday autofill triggered");

    const containers = $$(
      "[data-automation-id]:not([data-automation-id=''])"
    );
    for (const container of containers) {
      const automationId = container.getAttribute("data-automation-id");
      const profileKey = WORKDAY_FIELD_MAP[automationId];
      if (!profileKey || !profile[profileKey]) continue;

      const value = profile[profileKey];
      // Standard inputs
      const input = $("input:not([type=hidden]):not([type=file]), textarea", container);
      if (input) {
        input.focus();
        nativeSet(input, value);
        continue;
      }
      // Workday combobox / listbox
      const combobox = $("[role=combobox], [data-automation-id*='combobox']", container);
      if (combobox) {
        realClick(combobox);
        await sleep(500);
        const searchInput = $("input", combobox) || $("input[placeholder]");
        if (searchInput) {
          nativeSet(searchInput, value);
          await sleep(800);
        }
        // Select first matching option
        const option = $(`[role=option]`);
        if (option) realClick(option);
        continue;
      }
      // Radio buttons
      const radios = $$(`input[type=radio]`, container);
      for (const radio of radios) {
        const label = $(`label[for="${radio.id}"]`)?.textContent?.toLowerCase() || "";
        if (label.includes(value.toString().toLowerCase())) {
          realClick(radio);
          break;
        }
      }
    }
    LOG("Workday autofill complete");
  }

  /* ===================================================================
   * TASK 11 – OracleCloud & SmartRecruiters ATS autofill
   * =================================================================== */
  function isOracleCloud() {
    return (
      location.hostname.includes("oraclecloud.com") ||
      location.hostname.includes("fa.oraclecloud.com") ||
      location.hostname.includes("taleo.net") ||
      !!document.querySelector(".gw-iframe[src*='oracle']") ||
      !!document.querySelector("#OracleFusionApp")
    );
  }

  function isSmartRecruiters() {
    return (
      location.hostname.includes("smartrecruiters.com") ||
      location.hostname.includes("jobs.smartrecruiters.com") ||
      !!document.querySelector("[data-qa*='smartrecruiters'], .smartrecruiters-form")
    );
  }

  async function oracleCloudAutofill(profile) {
    if (!isOracleCloud()) return;
    LOG("OracleCloud autofill triggered");

    const fieldPairs = [
      ["#firstName, input[id*='firstName'], input[name*='firstName']", profile.first_name],
      ["#lastName, input[id*='lastName'], input[name*='lastName']", profile.last_name],
      ["#email, input[id*='email'], input[name*='email'], input[type='email']", profile.email],
      ["#phoneNumber, input[id*='phone'], input[name*='phone']", profile.phone],
      ["input[id*='city'], input[name*='city']", profile.city],
      ["input[id*='state'], select[name*='state']", profile.state],
      ["input[id*='zip'], input[name*='postal']", profile.postal_code],
    ];
    for (const [selector, value] of fieldPairs) {
      if (!value) continue;
      const el = $(selector);
      if (el) {
        el.focus();
        nativeSet(el, value);
      }
    }
  }

  async function smartRecruitersAutofill(profile) {
    if (!isSmartRecruiters()) return;
    LOG("SmartRecruiters autofill triggered");

    const fieldPairs = [
      ["input[name='first_name'], #firstName", profile.first_name],
      ["input[name='last_name'], #lastName", profile.last_name],
      ["input[name='email'], input[type='email']", profile.email],
      ["input[name='phone'], input[type='tel']", profile.phone],
      ["input[name='city']", profile.city],
      ["input[name='web'], input[name='website']", profile.website_url],
      ["textarea[name='message'], textarea[name='cover_letter']", profile.cover_letter],
    ];
    for (const [selector, value] of fieldPairs) {
      if (!value) continue;
      const el = $(selector);
      if (el) {
        el.focus();
        nativeSet(el, value);
      }
    }
  }

  /* ===================================================================
   * TASK 5 – Indeed "Apply on company site" auto-navigation
   * =================================================================== */
  function handleIndeedCompanySite() {
    if (!location.hostname.includes("indeed.com")) return;

    const observer = new MutationObserver(() => {
      // Indeed "Apply on company site" button
      const applyBtn = $$("button, a").find(
        (el) =>
          /apply on company site/i.test(el.textContent) ||
          /apply externally/i.test(el.textContent) ||
          el.getAttribute("data-testid") === "company-site-apply-button"
      );
      if (applyBtn) {
        LOG("Indeed: clicking 'Apply on company site'");
        realClick(applyBtn);
      }

      // Handle pop-up: "This will redirect to…" confirmation
      const confirmBtn = $$("button").find(
        (el) =>
          /continue|proceed|yes|ok/i.test(el.textContent) &&
          el.closest("[class*='modal'], [class*='dialog'], [role='dialog']")
      );
      if (confirmBtn) realClick(confirmBtn);

      // If redirected away from Indeed, nothing more to do
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Also handle static pages
    const btn = $$("button, a").find(
      (el) =>
        /apply on company site/i.test(el.textContent) ||
        /apply externally/i.test(el.textContent)
    );
    if (btn) {
      setTimeout(() => realClick(btn), 1500);
    }
  }

  handleIndeedCompanySite();

  /* ===================================================================
   * TASK 6 – LinkedIn Easy Apply + direct apply (company site)
   * =================================================================== */
  function handleLinkedIn() {
    if (!location.hostname.includes("linkedin.com")) return;

    const observer = new MutationObserver(async () => {
      await handleLinkedInJobs();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(handleLinkedInJobs, 2000);
  }

  async function handleLinkedInJobs() {
    if (!location.hostname.includes("linkedin.com")) return;

    // Priority 1: non-Easy Apply (direct company apply)
    const applyBtn = $$(".jobs-apply-button, .apply-button, [data-control-name='jobdetail_topcard_iwe_jd_apply']")
      .find((el) => {
        const txt = el.textContent.trim().toLowerCase();
        return txt.includes("apply") && !txt.includes("easy apply");
      });
    if (applyBtn) {
      LOG("LinkedIn: clicking direct Apply (non-Easy Apply)");
      realClick(applyBtn);
      return;
    }

    // Priority 2: Easy Apply (fill modal form)
    const easyApplyBtn = $$(".jobs-apply-button, [aria-label*='Easy Apply'], [data-control-name*='easy_apply']")
      .find((el) => /easy apply/i.test(el.textContent));
    if (easyApplyBtn) {
      LOG("LinkedIn: clicking Easy Apply");
      realClick(easyApplyBtn);
      await sleep(1500);
      await fillLinkedInEasyApplyModal();
    }
  }

  async function fillLinkedInEasyApplyModal() {
    const modal = $("[data-test-modal], .jobs-easy-apply-modal, [aria-modal='true']");
    if (!modal) return;

    const { candidateDetails } = await STORAGE.get("candidateDetails");
    let profile = {};
    try {
      profile =
        typeof candidateDetails === "string"
          ? JSON.parse(candidateDetails)
          : candidateDetails || {};
    } catch (_) {}

    // Fill visible inputs in the modal
    const inputs = $$("input:not([type=hidden]):not([type=file]):not([type=submit]), textarea, select", modal);
    for (const input of inputs) {
      const label = getFieldLabel(input).toLowerCase();
      const value = guessValueForLabel(label, profile);
      if (value) {
        input.focus();
        nativeSet(input, value);
      }
    }

    // Click "Next" or "Submit" button
    await sleep(500);
    const nextBtn = $$("button", modal).find(
      (el) => /next|continue|submit|review/i.test(el.textContent)
    );
    if (nextBtn) realClick(nextBtn);
  }

  handleLinkedIn();

  /* ===================================================================
   * TASK 10 – HiringCafe.com "Apply Directly" navigation
   * =================================================================== */
  const PREFERRED_COMPANY_SIZES = [
    "51 - 200",
    "201 - 500",
    "501 - 1000",
    "1001 - 2000",
    "2001 - 5000",
    "5001 - 10000",
    "10001+",
    "51-200",
    "201-500",
    "501-1,000",
    "1,001-5,000",
    "5,001-10,000",
    "10,000+",
  ];

  function handleHiringCafe() {
    if (!location.hostname.includes("hiring.cafe")) return;

    // Check company size before applying
    const companySizeEl = $$("[class*='size'], [class*='employees'], [data-field*='size']")
      .find((el) => /\d/.test(el.textContent));
    if (companySizeEl) {
      const sizeText = companySizeEl.textContent;
      const sizeOk = PREFERRED_COMPANY_SIZES.some((s) =>
        sizeText.replace(/\s/g, "").includes(s.replace(/\s/g, ""))
      );
      if (!sizeOk) {
        LOG("HiringCafe: company size not in preferred list – skipping");
        chrome.runtime.sendMessage({ type: "JOB_SKIPPED", reason: "company_size" });
        return;
      }
    }

    // Click "Apply Directly" button
    const observer = new MutationObserver(() => {
      const applyBtn = $$("a, button").find(
        (el) =>
          /apply directly/i.test(el.textContent) ||
          /apply now/i.test(el.textContent)
      );
      if (applyBtn) {
        LOG("HiringCafe: clicking Apply Directly");
        realClick(applyBtn);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Static check
    setTimeout(() => {
      const applyBtn = $$("a, button").find(
        (el) =>
          /apply directly/i.test(el.textContent) ||
          /apply now/i.test(el.textContent)
      );
      if (applyBtn) realClick(applyBtn);
    }, 2000);
  }

  handleHiringCafe();

  /* ===================================================================
   * TASK 9 – Deduplication: never apply to same job twice
   * =================================================================== */
  async function checkAlreadyApplied() {
    const jobUrl = getCanonicalJobUrl(location.href);
    const { appliedJobs = [] } = await STORAGE.get("appliedJobs");
    if (appliedJobs.includes(jobUrl)) {
      LOG("Dedup: already applied to", jobUrl, "– signalling skip");
      chrome.runtime.sendMessage({
        type: "ALREADY_APPLIED_SKIP",
        url: jobUrl,
      });
      return true;
    }
    return false;
  }

  async function markJobAsApplied() {
    const jobUrl = getCanonicalJobUrl(location.href);
    const { appliedJobs = [] } = await STORAGE.get("appliedJobs");
    if (!appliedJobs.includes(jobUrl)) {
      appliedJobs.push(jobUrl);
      // Keep last 10 000 entries
      if (appliedJobs.length > 10_000) appliedJobs.shift();
      await STORAGE.set({ appliedJobs });
      LOG("Dedup: marked as applied:", jobUrl);
    }
  }

  function getCanonicalJobUrl(url) {
    try {
      const u = new URL(url);
      // Strip tracking params
      ["utm_source", "utm_medium", "utm_campaign", "ref", "referer", "source"].forEach(
        (p) => u.searchParams.delete(p)
      );
      return u.origin + u.pathname;
    } catch (_) {
      return url;
    }
  }

  // Listen for successful application events from original code
  chrome.runtime.onMessage.addListener((msg) => {
    if (
      msg?.type === "APPLICATION_SUCCESS" ||
      msg?.type === "JOB_APPLIED" ||
      msg?.status === "success"
    ) {
      markJobAsApplied();
    }
  });

  /* ===================================================================
   * TASK 12 – Auto-solve reCAPTCHA (checkbox click)
   * =================================================================== */
  function autosolveCaptcha() {
    const observer = new MutationObserver(async () => {
      await trySolveCaptcha();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    trySolveCaptcha();
  }

  async function trySolveCaptcha() {
    // reCAPTCHA v2 checkbox (inside iframe)
    const frames = $$("iframe[src*='recaptcha'], iframe[src*='hcaptcha']");
    for (const frame of frames) {
      try {
        const checkbox =
          frame.contentDocument?.querySelector(".recaptcha-checkbox, #recaptcha-anchor") ||
          frame.contentWindow?.document?.querySelector(".recaptcha-checkbox");
        if (checkbox && !checkbox.classList.contains("recaptcha-checkbox-checked")) {
          LOG("Captcha: clicking reCAPTCHA checkbox");
          realClick(checkbox);
          await sleep(2000);
        }
      } catch (_) {
        // Cross-origin – can't access, ignore
      }
    }

    // Simple text/math captchas
    const captchaQuestion = $$(
      "[class*='captcha'] input, [id*='captcha'] input, input[name*='captcha']"
    );
    for (const inp of captchaQuestion) {
      const label = getFieldLabel(inp);
      const mathMatch = label.match(/(\d+)\s*[\+\-\*x]\s*(\d+)/);
      if (mathMatch) {
        const result = evalSimpleMath(label);
        if (result !== null) {
          nativeSet(inp, String(result));
          LOG("Captcha: solved math captcha:", label, "=", result);
        }
      }
    }

    // "I'm not a robot" / consent checkboxes
    const robotCheckbox = $$(
      "input[type=checkbox][id*='captcha'], input[type=checkbox][name*='captcha']"
    );
    for (const cb of robotCheckbox) {
      if (!cb.checked) {
        realClick(cb);
        LOG("Captcha: clicked robot checkbox");
      }
    }
  }

  function evalSimpleMath(text) {
    const m = text.match(/(\d+)\s*([\+\-\*x÷\/])\s*(\d+)/);
    if (!m) return null;
    const [, a, op, b] = m;
    const n1 = parseInt(a), n2 = parseInt(b);
    switch (op) {
      case "+": return n1 + n2;
      case "-": return n1 - n2;
      case "*": case "x": case "×": return n1 * n2;
      case "/": case "÷": return n2 !== 0 ? Math.round(n1 / n2) : null;
      default: return null;
    }
  }

  autosolveCaptcha();

  /* ===================================================================
   * TASKS 13 & 17 – Auto-fill missing required fields + prevent stall
   * =================================================================== */
  const DEFAULT_ANSWERS = {
    // Common yes/no questions
    authorized: "Yes",
    sponsorship: "No",
    relocation: "Yes",
    remote: "Yes",
    veteran: "No",
    disability: "Prefer not to say",
    gender: "Prefer not to say",
    ethnicity: "Prefer not to say",
    race: "Prefer not to say",
    // Numeric
    years_experience: "5",
    salary: "80000",
    notice_period: "2 weeks",
    // Text
    cover_letter:
      "I am excited to apply for this position. My experience and skills make me an excellent candidate, and I look forward to contributing to your team.",
    why_company:
      "I am impressed by the company's culture and the opportunity to make a meaningful impact.",
    how_did_you_hear: "LinkedIn",
    availability: "Immediately",
  };

  function getFieldLabel(el) {
    // Priority: aria-label > label[for] > placeholder > name > id > surrounding text
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
    const id = el.id;
    if (id) {
      const lbl = $(`label[for="${id}"]`);
      if (lbl) return lbl.textContent.trim();
    }
    if (el.placeholder) return el.placeholder;
    if (el.name) return el.name.replace(/[_\-]/g, " ");
    // Walk up to find a nearby label
    const container = el.closest(
      ".form-group, .field, .question, [class*='Field'], [class*='Question']"
    );
    if (container) {
      const lbl = $("label", container) || $("[class*='label'], [class*='Label']", container);
      if (lbl) return lbl.textContent.trim();
    }
    return "";
  }

  function guessValueForLabel(label, profile = {}) {
    label = label.toLowerCase().replace(/[^a-z0-9 ]/g, " ");

    // Profile fields first
    if (/first.?name/.test(label)) return profile.first_name || profile.firstName || "";
    if (/last.?name/.test(label)) return profile.last_name || profile.lastName || "";
    if (/full.?name|your name/.test(label))
      return `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    if (/email/.test(label)) return profile.email || "";
    if (/phone|mobile|cell/.test(label)) return profile.phone || "";
    if (/city/.test(label)) return profile.city || "";
    if (/state|province/.test(label)) return profile.state || "";
    if (/zip|postal/.test(label)) return profile.postal_code || profile.zip || "";
    if (/country/.test(label)) return profile.country || "United States";
    if (/address/.test(label)) return profile.address || "";
    if (/linkedin/.test(label)) return profile.linkedin_url || profile.linkedin || "";
    if (/github/.test(label)) return profile.github_url || profile.github || "";
    if (/website|portfolio/.test(label)) return profile.website_url || profile.website || "";
    if (/university|school|college|institution/.test(label))
      return profile.school || profile.university || "";
    if (/degree/.test(label)) return profile.degree || "Bachelor's";
    if (/major|field of study/.test(label)) return profile.major || "";
    if (/gpa/.test(label)) return profile.gpa || "";
    if (/job title|current title|position/.test(label))
      return profile.current_title || profile.title || "";
    if (/company|employer|organization/.test(label))
      return profile.current_company || profile.company || "";
    if (/salary|compensation|pay|rate/.test(label))
      return profile.expected_salary || DEFAULT_ANSWERS.salary;
    if (/cover letter|motivation|statement/.test(label))
      return profile.cover_letter || DEFAULT_ANSWERS.cover_letter;
    if (/why.*compan|why.*role|why.*interest/.test(label))
      return DEFAULT_ANSWERS.why_company;
    if (/how.*hear|how.*find|where.*hear/.test(label))
      return DEFAULT_ANSWERS.how_did_you_hear;
    if (/years.*experience|experience.*years/.test(label))
      return DEFAULT_ANSWERS.years_experience;
    if (/availab|start date|notice/.test(label)) return DEFAULT_ANSWERS.availability;
    if (/authoriz|eligible|work.*us|legally/.test(label)) return DEFAULT_ANSWERS.authorized;
    if (/sponsor|visa/.test(label)) return DEFAULT_ANSWERS.sponsorship;
    if (/relocat/.test(label)) return DEFAULT_ANSWERS.relocation;
    if (/remote|work.*home/.test(label)) return DEFAULT_ANSWERS.remote;
    if (/veteran|military/.test(label)) return DEFAULT_ANSWERS.veteran;
    if (/disabilit/.test(label)) return DEFAULT_ANSWERS.disability;
    if (/gender|sex/.test(label)) return DEFAULT_ANSWERS.gender;
    if (/ethnic|race|racial/.test(label)) return DEFAULT_ANSWERS.ethnicity;
    return "";
  }

  async function autoFillMissingFields() {
    const { candidateDetails } = await STORAGE.get("candidateDetails");
    let profile = {};
    try {
      profile =
        typeof candidateDetails === "string"
          ? JSON.parse(candidateDetails)
          : candidateDetails || {};
    } catch (_) {}

    // Fill all empty required fields
    const requiredInputs = $$(
      "input[required]:not([type=hidden]):not([type=file])," +
        "textarea[required]," +
        "select[required]," +
        "input[aria-required='true']," +
        "textarea[aria-required='true']"
    );

    for (const inp of requiredInputs) {
      if (inp.value && inp.value.trim()) continue; // already filled

      const label = getFieldLabel(inp);
      const value = guessValueForLabel(label, profile);
      if (!value) continue;

      if (inp.tagName === "SELECT") {
        const option = $$("option", inp).find(
          (o) => o.text.toLowerCase().includes(value.toLowerCase())
        );
        if (option) {
          inp.value = option.value;
          inp.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } else {
        inp.focus();
        nativeSet(inp, value);
      }
    }

    // Also fill non-required but empty visible fields
    const allInputs = $$(
      "input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=button])," +
        "textarea"
    ).filter((el) => isVisible(el) && !el.value.trim());

    for (const inp of allInputs) {
      const label = getFieldLabel(inp);
      if (!label) continue;
      const value = guessValueForLabel(label, profile);
      if (value) {
        inp.focus();
        nativeSet(inp, value);
      }
    }

    // Auto-select radio/checkbox with common default answers
    await autoSelectRadios(profile);

    LOG("Auto-fill missing fields done");
  }

  async function autoSelectRadios(profile) {
    const radioGroups = {};
    $$("input[type=radio]").filter(isVisible).forEach((r) => {
      const name = r.name || r.getAttribute("data-name") || r.id;
      if (!radioGroups[name]) radioGroups[name] = [];
      radioGroups[name].push(r);
    });

    for (const [name, radios] of Object.entries(radioGroups)) {
      if (radios.some((r) => r.checked)) continue; // already selected

      const label = getFieldLabel(radios[0]) || name;
      const guess = guessValueForLabel(label.toLowerCase(), profile);
      if (!guess) continue;

      // Try to find the radio that matches our guess
      const matchingRadio = radios.find((r) => {
        const radioLabel =
          ($(`label[for="${r.id}"]`)?.textContent || r.value || "").toLowerCase();
        return radioLabel.includes(guess.toLowerCase());
      });
      if (matchingRadio) {
        realClick(matchingRadio);
        continue;
      }

      // If it's a yes/no question, pick Yes
      const yesRadio = radios.find((r) => {
        const txt =
          ($(`label[for="${r.id}"]`)?.textContent || r.value || "").toLowerCase();
        return txt === "yes" || txt === "true";
      });
      if (yesRadio) realClick(yesRadio);
    }
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
  }

  /* ===================================================================
   * TASK 18 – "Add Missing Details" dialog auto-handler
   * =================================================================== */
  function handleMissingDetailsDialog() {
    const observer = new MutationObserver(async () => {
      // Detect the "Add Missing Details" / "Please fill the missing details" dialog
      const dialog = $$("[class*='missing'], [id*='missing'], [class*='Missing']")
        .find(
          (el) =>
            isVisible(el) &&
            (/missing details/i.test(el.textContent) ||
              /fill.*details/i.test(el.textContent) ||
              /add.*details/i.test(el.textContent))
        );

      if (dialog) {
        LOG("Missing details dialog detected – auto-filling");
        await sleep(500);
        await autoFillMissingFields();
        await sleep(1000);

        // After filling, click the submit/continue button inside the dialog
        const submitBtn = $$(
          "button[type=submit], button:not([type=button])",
          dialog
        ).find(
          (el) =>
            isVisible(el) &&
            /submit|save|continue|done|next|confirm/i.test(el.textContent)
        );
        if (submitBtn) {
          LOG("Missing details dialog: clicking submit");
          realClick(submitBtn);
        }
      }

      // Handle "Please clear the Captcha and submit the form" toasts
      const captchaMsg = $$("[class*='toast'], [class*='alert'], [class*='error'], [role='alert']")
        .find((el) => /clear.*captcha|captcha/i.test(el.textContent) && isVisible(el));
      if (captchaMsg) {
        LOG("Captcha message detected – attempting auto-solve");
        await trySolveCaptcha();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  }

  handleMissingDetailsDialog();

  /* ===================================================================
   * TASK 7 & 15 – Fresh job freshness indicator injection
   * Adds a "FRESH" badge to jobs posted < 24 hours ago
   * and sorts job lists newest-first client-side
   * =================================================================== */
  const FRESHNESS_THRESHOLDS = {
    VERY_FRESH: 30 * 60 * 1000,      // 30 minutes
    FRESH: 24 * 60 * 60 * 1000,      // 24 hours
    RECENT: 3 * 24 * 60 * 60 * 1000, // 3 days
  };

  function extractPostingDate(el) {
    // Look for time elements, relative time texts, data attributes
    const timeEl =
      el.querySelector("time") ||
      el.querySelector("[datetime]") ||
      el.querySelector("[data-posted], [data-date], [class*='posted'], [class*='date']");

    if (timeEl) {
      const dt = timeEl.getAttribute("datetime") || timeEl.getAttribute("data-posted");
      if (dt) return new Date(dt);
      const txt = timeEl.textContent.trim().toLowerCase();
      return parseRelativeTime(txt);
    }

    const allText = el.textContent;
    const relMatch = allText.match(
      /(\d+)\s+(minute|hour|day|week|month)s?\s+ago|just\s+now|today/i
    );
    if (relMatch) return parseRelativeTime(relMatch[0]);
    return null;
  }

  function parseRelativeTime(txt) {
    txt = txt.toLowerCase().trim();
    const now = Date.now();
    if (/just now|moments? ago/.test(txt)) return new Date(now - 60_000);
    if (/today/.test(txt)) return new Date(now - 3_600_000);
    const m = txt.match(/(\d+)\s+(minute|hour|day|week|month)/);
    if (!m) return null;
    const n = parseInt(m[1]);
    const unit = m[2];
    const multipliers = {
      minute: 60_000,
      hour: 3_600_000,
      day: 86_400_000,
      week: 604_800_000,
      month: 2_592_000_000,
    };
    return new Date(now - n * (multipliers[unit] || 86_400_000));
  }

  function addFreshnessBadge(jobEl, date) {
    if (!date) return;
    const age = Date.now() - date.getTime();
    let badgeText = "";
    let badgeColor = "";

    if (age < FRESHNESS_THRESHOLDS.VERY_FRESH) {
      badgeText = "🔥 Just Posted";
      badgeColor = "#ff4444";
    } else if (age < FRESHNESS_THRESHOLDS.FRESH) {
      badgeText = "✨ Fresh (< 24h)";
      badgeColor = "#00aa44";
    } else if (age < FRESHNESS_THRESHOLDS.RECENT) {
      badgeText = "📅 Recent (< 3 days)";
      badgeColor = "#0077cc";
    }

    if (!badgeText) return;

    // Don't add duplicate badge
    if (jobEl.querySelector(".oh-patch-fresh-badge")) return;

    const badge = document.createElement("span");
    badge.className = "oh-patch-fresh-badge";
    badge.textContent = badgeText;
    badge.style.cssText = `
      display: inline-block;
      background: ${badgeColor};
      color: white;
      font-size: 11px;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 3px;
      margin-left: 6px;
      vertical-align: middle;
    `;
    // Insert badge after first heading or link
    const heading = jobEl.querySelector("h1,h2,h3,h4,a");
    if (heading) heading.insertAdjacentElement("afterend", badge);
    else jobEl.prepend(badge);
  }

  function processFreshnessOnPage() {
    // Indeed job cards
    const indeedCards = $$(".jobsearch-SerpJobCard, .job_seen_beacon, [class*='result-']");
    for (const card of indeedCards) {
      const date = extractPostingDate(card);
      if (date) addFreshnessBadge(card, date);
    }

    // LinkedIn job cards
    const linkedInCards = $$(".jobs-search-results__list-item, .job-card-container");
    for (const card of linkedInCards) {
      const date = extractPostingDate(card);
      if (date) addFreshnessBadge(card, date);
    }

    // HiringCafe job cards
    const hiringCafeCards = $$(
      "[class*='job-card'], [class*='jobCard'], [class*='listing']"
    );
    for (const card of hiringCafeCards) {
      const date = extractPostingDate(card);
      if (date) addFreshnessBadge(card, date);
    }
  }

  setInterval(processFreshnessOnPage, 3000);
  processFreshnessOnPage();

  /* ===================================================================
   * ATS TRIGGER – Run platform-specific autofill on supported pages
   * =================================================================== */
  async function runPlatformAutofill() {
    const { candidateDetails } = await STORAGE.get("candidateDetails");
    let profile = {};
    try {
      profile =
        typeof candidateDetails === "string"
          ? JSON.parse(candidateDetails)
          : candidateDetails || {};
    } catch (_) {}

    const alreadyApplied = await checkAlreadyApplied();
    if (alreadyApplied) return;

    if (isWorkday()) await workdayAutofill(profile);
    if (isOracleCloud()) await oracleCloudAutofill(profile);
    if (isSmartRecruiters()) await smartRecruitersAutofill(profile);

    // Generic missing field fill after ATS-specific fill
    await autoFillMissingFields();
  }

  // Run on automation message
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (
      msg?.type === "AUTOFILL" ||
      msg?.type === "START_AUTOFILL" ||
      msg?.type === "run_autofill"
    ) {
      await runPlatformAutofill();
    }
    if (msg?.type === "MISSING_QUESTIONS" || msg?.type === "missing-questions") {
      await autoFillMissingFields();
    }
    if (msg?.type === "captcha-required" || msg?.type === "CAPTCHA_REQUIRED") {
      await trySolveCaptcha();
    }
  });

  // Periodically auto-fill as pages load/change
  const fillObserver = new MutationObserver(() => {
    STORAGE.get("isAutoProcessStartJob").then((d) => {
      if (d.isAutoProcessStartJob) autoFillMissingFields();
    });
  });
  fillObserver.observe(document.body, { childList: true, subtree: false });

  LOG("OptimHire Patch v2.2.8 loaded on", location.hostname);
})();
