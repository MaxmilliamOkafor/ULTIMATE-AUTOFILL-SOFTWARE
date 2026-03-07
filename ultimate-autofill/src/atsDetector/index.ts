import type { ATSDetectionResult, ATSType } from '../types/index';
import { PLATFORM_REGISTRY, isLinkedInEasyApply } from './platformRegistry';

interface Sig {
  type: ATSType;
  urls: RegExp[];
  dom: string[];
  meta: { name: string; pat: RegExp }[];
}

// Build signatures from the canonical platform registry
const SIGS: Sig[] = PLATFORM_REGISTRY.filter((p) => p.enabled).map((p) => ({
  type: p.id,
  urls: p.urlPatterns,
  dom: p.domSignals,
  meta: p.metaSignals.map((m) => ({ name: m.name, pat: m.pattern })),
}));
const SIGS: Sig[] = [
  {
    type: 'workday',
    urls: [/myworkdayjobs\.com/i, /myworkday\.com/i],
    dom: ['[data-automation-id]', '[data-uxi-element-id]'],
    meta: [{ name: 'generator', pat: /workday/i }],
  },
  {
    type: 'greenhouse',
    urls: [/greenhouse\.io/i, /boards\.greenhouse\.io/i],
    dom: ['#greenhouse_application', '#grnhse_app', 'form#application_form'],
    meta: [],
  },
  {
    type: 'lever',
    urls: [/lever\.co/i, /jobs\.lever\.co/i],
    dom: ['.lever-application-form', '[data-qa="application-form"]', '.posting-headline'],
    meta: [],
  },
  {
    type: 'smartrecruiters',
    urls: [/smartrecruiters\.com/i],
    dom: ['[class*="smartrecruiters"]', '.st-apply-form'],
    meta: [],
  },
  {
    type: 'icims',
    urls: [/icims\.com/i],
    dom: ['#icims_content', '[class*="icims"]'],
    meta: [],
  },
  {
    type: 'taleo',
    urls: [/taleo\.net/i, /oraclecloud\.com/i, /fa\.oraclecloud\.com/i],
    dom: ['[class*="taleo"]', '#requisitionDescriptionInterface', '#OracleFusionApp', 'oracle-apply-flow'],
    meta: [{ name: 'generator', pat: /taleo/i }],
  },
  {
    type: 'ashby',
    urls: [/ashbyhq\.com/i],
    dom: ['[data-ashby-job-posting-id]', '.ashby-job-posting-brief-location'],
    meta: [],
  },
  {
    type: 'bamboohr',
    urls: [/bamboohr\.com/i],
    dom: ['.BambooHR-ATS-board', '[class*="BambooHR"]'],
    meta: [],
  },
  {
    type: 'indeed',
    urls: [/indeed\.com/i],
    dom: ['#jobsearch-ViewJobButtons-container', '.jobsearch-IndeedApplyButton'],
    meta: [],
  },
  {
    type: 'linkedin',
    urls: [/linkedin\.com\/jobs/i],
    dom: ['.jobs-apply-button', '[data-control-name*="apply"]'],
    meta: [],
  },
  {
    type: 'hiringcafe',
    urls: [/hiring\.cafe/i],
    dom: [],
    meta: [],
  },
  {
    type: 'jobvite',
    urls: [/jobvite\.com/i],
    dom: ['[class*="jobvite"]', '.jv-page-body'],
    meta: [],
  },
  {
    type: 'workable',
    urls: [/apply\.workable\.com/i],
    dom: ['[data-ui="application"]'],
    meta: [],
  },
  {
    type: 'paylocity',
    urls: [/paylocity\.com/i],
    dom: [],
    meta: [],
  },
  {
    type: 'jazzhr',
    urls: [/jazzhr\.com/i],
    dom: ['#jazz-apply-form'],
    meta: [],
  },
  {
    type: 'ziprecruiter',
    urls: [/ziprecruiter\.com/i],
    dom: [],
    meta: [],
  },
  {
    type: 'dice',
    urls: [/dice\.com/i],
    dom: [],
    meta: [],
  },
  {
    type: 'ukg',
    urls: [/recruiting\.ultipro\.com/i],
    dom: [],
    meta: [],
  },
];

export function detectATS(doc: Document): ATSDetectionResult {
  const url = doc.location?.href || '';
  let best: ATSType = 'generic';
  let bestConf = 0;
  const bestSigs: string[] = [];

  for (const s of SIGS) {
    let conf = 0;
    const found: string[] = [];

    for (const p of s.urls) {
      if (p.test(url)) { conf += 0.5; found.push(`url:${p.source}`); break; }
    }
    for (const sel of s.dom) {
      try { if (doc.querySelector(sel)) { conf += 0.2; found.push(`dom:${sel}`); if (conf >= 0.9) break; } } catch { }
    }
    for (const m of s.meta) {
      const el = doc.querySelector(`meta[name="${m.name}"]`);
      if (el && m.pat.test(el.getAttribute('content') || '')) { conf += 0.3; found.push(`meta:${m.name}`); }
    }

    conf = Math.min(conf, 1);

    // Special case: filter out LinkedIn Easy Apply
    if (s.type === 'linkedin' && conf > 0) {
      if (isLinkedInEasyApply(doc)) {
        continue; // Skip - we only support non-Easy Apply
      }
    }

    if (conf > bestConf) { bestConf = conf; best = s.type; bestSigs.length = 0; bestSigs.push(...found); }
  }

  // ─── Universal form detection: if no known ATS, detect company career sites ───
  if (best === 'generic' || bestConf < 0.3) {
    const companySiteResult = detectCompanySite(doc, url);
    if (companySiteResult.confidence > bestConf) {
      return companySiteResult;
    }
  }

  return { type: best, confidence: bestConf, signals: bestSigs };
}

/**
 * Detect any company career/job application page,
 * even if it doesn't match a known ATS.
 * This enables autofill on ANY job application form.
 */
function detectCompanySite(doc: Document, url: string): ATSDetectionResult {
  let conf = 0;
  const signals: string[] = [];

  // URL signals: career/job-related paths
  const careerPatterns = [
    /\/careers?\b/i, /\/jobs?\b/i, /\/apply\b/i, /\/openings?\b/i,
    /\/positions?\b/i, /\/hiring\b/i, /\/opportunities\b/i,
    /\/recruit/i, /\/talent\b/i, /\/work-with-us/i,
    /\/join-us/i, /\/join-our-team/i, /\/application\b/i,
  ];
  for (const p of careerPatterns) {
    if (p.test(url)) { conf += 0.25; signals.push(`url:career-path`); break; }
  }

  // Form presence: look for application-like forms
  const forms = doc.querySelectorAll('form');
  for (const form of forms) {
    const formText = (form.textContent || '').toLowerCase();
    const formHtml = (form.innerHTML || '').toLowerCase();

    // Check for job-application-related fields
    const appFieldCount = countApplicationFields(form);
    if (appFieldCount >= 3) {
      conf += 0.3;
      signals.push(`form:${appFieldCount}-app-fields`);
      break;
    }

    // Check form action or class for application hints
    const action = form.getAttribute('action') || '';
    const cls = form.className || '';
    if (/apply|application|candidate|submit/i.test(action + ' ' + cls)) {
      conf += 0.2;
      signals.push('form:apply-action');
    }
  }

  // Page title / h1 signals
  const title = doc.title.toLowerCase();
  const h1 = doc.querySelector('h1')?.textContent?.toLowerCase() || '';
  if (/apply|application|career|job|position|opening/i.test(title + ' ' + h1)) {
    conf += 0.15;
    signals.push('page:career-title');
  }

  // File upload (resume/cv) presence
  const fileInputs = doc.querySelectorAll('input[type="file"]');
  for (const fi of fileInputs) {
    const accept = fi.getAttribute('accept') || '';
    const name = fi.getAttribute('name') || '';
    const label = getInputLabel(fi as HTMLElement, doc);
    if (/resume|cv|curriculum|cover/i.test(accept + ' ' + name + ' ' + label)) {
      conf += 0.2;
      signals.push('form:resume-upload');
      break;
    }
  }

  conf = Math.min(conf, 1);

  if (conf >= 0.3) {
    return { type: 'companysite', confidence: conf, signals };
  }

  return { type: 'generic', confidence: 0, signals: [] };
}

/** Count how many application-related fields a form contains */
function countApplicationFields(form: HTMLFormElement): number {
  const fields = form.querySelectorAll('input, textarea, select');
  let count = 0;
  const appFieldHints = [
    /name/i, /first/i, /last/i, /email/i, /phone/i, /resume/i, /cv/i,
    /cover/i, /address/i, /city/i, /state/i, /zip/i, /country/i,
    /experience/i, /education/i, /skill/i, /linkedin/i, /portfolio/i,
    /website/i, /salary/i, /start.?date/i, /authorized/i, /sponsor/i,
    /visa/i, /relocat/i, /referr/i,
  ];

  for (const field of fields) {
    const name = field.getAttribute('name') || '';
    const id = field.getAttribute('id') || '';
    const placeholder = field.getAttribute('placeholder') || '';
    const label = getInputLabel(field as HTMLElement, form.ownerDocument);
    const combined = `${name} ${id} ${placeholder} ${label}`.toLowerCase();

    if (appFieldHints.some((h) => h.test(combined))) count++;
  }
  return count;
}

/** Get the label text for a form field */
function getInputLabel(el: HTMLElement, doc: Document): string {
  if (el.id) {
    const lbl = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl?.textContent?.trim()) return lbl.textContent.trim();
  }
  const wrap = el.closest('label');
  if (wrap?.textContent?.trim()) return wrap.textContent.trim();
  return el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
}

export function atsName(type: ATSType): string {
  const m: Record<ATSType, string> = {
    workday: 'Workday', greenhouse: 'Greenhouse', lever: 'Lever',
    smartrecruiters: 'SmartRecruiters', icims: 'iCIMS', taleo: 'Taleo',
    ashby: 'Ashby', bamboohr: 'BambooHR',
    oraclecloud: 'Oracle Cloud', linkedin: 'LinkedIn', indeed: 'Indeed',
    companysite: 'Company Site', generic: 'Generic',
    smartrecruiters: 'SmartRecruiters', icims: 'iCIMS', taleo: 'Taleo/OracleCloud',
    ashby: 'Ashby', bamboohr: 'BambooHR', generic: 'Generic',
    indeed: 'Indeed', linkedin: 'LinkedIn', hiringcafe: 'HiringCafe',
    jobvite: 'Jobvite', workable: 'Workable', paylocity: 'Paylocity',
    jazzhr: 'JazzHR', ziprecruiter: 'ZipRecruiter', dice: 'Dice', ukg: 'UKG',
  };
  return m[type] || type;
}

/** Check if current page is a supported application page (any ATS or company site) */
export function isApplicationPage(doc: Document): boolean {
  const result = detectATS(doc);
  return result.type !== 'generic' && result.confidence >= 0.3;
}

/** Check if page has ANY fillable form (even non-career pages if universal mode is on) */
export function hasApplicationForm(doc: Document): boolean {
  const result = detectATS(doc);
  if (result.type !== 'generic' && result.confidence >= 0.3) return true;

  // Check for any substantial form
  const forms = doc.querySelectorAll('form');
  for (const form of forms) {
    const fields = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
    if (fields.length >= 2) return true;
  }
  return false;
}
