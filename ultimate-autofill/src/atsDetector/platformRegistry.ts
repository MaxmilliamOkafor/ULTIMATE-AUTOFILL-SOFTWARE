/**
 * Canonical ATS Platform Registry
 * Single source of truth for all supported job application platforms.
 */

import type { ATSPlatformEntry, ATSType } from '../types/index';

export const PLATFORM_REGISTRY: ATSPlatformEntry[] = [
  // ─── Existing Platforms ───
  {
    id: 'workday',
    name: 'Workday',
    domains: ['myworkdayjobs.com', 'myworkday.com', 'wd1.myworkdaysite.com', 'wd3.myworkdaysite.com', 'wd5.myworkdaysite.com'],
    urlPatterns: [/myworkdayjobs\.com/i, /myworkday\.com/i, /myworkdaysite\.com/i, /\.wd\d+\.myworkdayjobs\.com/i],
    domSignals: ['[data-automation-id]', '[data-uxi-element-id]'],
    metaSignals: [{ name: 'generator', pattern: /workday/i }],
    enabled: true,
    supportsAutoSubmit: true,
    notes: 'Multi-step forms with React components. Handles combobox/listbox interactions.',
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    domains: ['greenhouse.io', 'boards.greenhouse.io'],
    urlPatterns: [/greenhouse\.io/i, /boards\.greenhouse\.io/i],
    domSignals: ['#greenhouse_application', '#grnhse_app', 'form#application_form'],
    metaSignals: [],
    enabled: true,
    supportsAutoSubmit: true,
    notes: 'Uses bracket notation for field names: job_application[first_name].',
  },
  {
    id: 'lever',
    name: 'Lever',
    domains: ['lever.co', 'jobs.lever.co'],
    urlPatterns: [/lever\.co/i, /jobs\.lever\.co/i],
    domSignals: ['.lever-application-form', '[data-qa="application-form"]', '.posting-headline'],
    metaSignals: [],
    enabled: true,
    supportsAutoSubmit: true,
  },
  {
    id: 'smartrecruiters',
    name: 'SmartRecruiters',
    domains: ['smartrecruiters.com', 'jobs.smartrecruiters.com'],
    urlPatterns: [/smartrecruiters\.com/i],
    domSignals: ['[class*="smartrecruiters"]', '.st-apply-form', '[class*="ApplyButton"]'],
    metaSignals: [],
    enabled: true,
    supportsAutoSubmit: true,
  },
  {
    id: 'icims',
    name: 'iCIMS',
    domains: ['icims.com', 'careers-icims.com'],
    urlPatterns: [/icims\.com/i, /careers-icims\.com/i],
    domSignals: ['#icims_content', '[class*="icims"]', '.iCIMS_MainWrapper'],
    metaSignals: [],
    enabled: true,
    supportsAutoSubmit: true,
  },
  {
    id: 'taleo',
    name: 'Taleo (Oracle)',
    domains: ['taleo.net', 'taleoquickfind.com'],
    urlPatterns: [/taleo\.net/i, /taleoquickfind\.com/i],
    domSignals: ['[class*="taleo"]', '#requisitionDescriptionInterface', '.taleoContent'],
    metaSignals: [{ name: 'generator', pattern: /taleo/i }],
    enabled: true,
    supportsAutoSubmit: true,
  },
  {
    id: 'ashby',
    name: 'Ashby',
    domains: ['ashbyhq.com', 'jobs.ashbyhq.com'],
    urlPatterns: [/ashbyhq\.com/i],
    domSignals: ['[data-ashby-job-posting-id]', '.ashby-job-posting-brief-location'],
    metaSignals: [],
    enabled: true,
    supportsAutoSubmit: true,
  },
  {
    id: 'bamboohr',
    name: 'BambooHR',
    domains: ['bamboohr.com'],
    urlPatterns: [/bamboohr\.com/i],
    domSignals: ['.BambooHR-ATS-board', '[class*="BambooHR"]'],
    metaSignals: [],
    enabled: true,
    supportsAutoSubmit: true,
  },

  // ─── Newly Added Platforms ───
  {
    id: 'oraclecloud',
    name: 'Oracle Cloud HCM / Oracle Recruiting',
    domains: ['oraclecloud.com', 'fa.oraclecloud.com'],
    urlPatterns: [/oraclecloud\.com/i, /fa\..*\.oraclecloud\.com/i, /hcm\d*.*\.oraclecloud\.com/i],
    domSignals: [
      '[class*="oracle"]', '[id*="oj-"]', '.oj-web-applcore-page',
      '[data-oj-binding-provider]', '.oj-flex', '#ojAppRoot',
    ],
    metaSignals: [{ name: 'generator', pattern: /oracle/i }],
    enabled: true,
    supportsAutoSubmit: true,
    notes: 'Oracle JET-based UI. Uses oj- prefixed component IDs. Dynamic SPA with knockout.js bindings.',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn (Non-Easy Apply Only)',
    domains: ['linkedin.com', 'www.linkedin.com'],
    urlPatterns: [/linkedin\.com\/jobs/i, /linkedin\.com\/in/i],
    domSignals: [
      '.jobs-apply-button', '.jobs-unified-top-card',
      '[data-job-id]', '.jobs-details',
    ],
    metaSignals: [],
    enabled: true,
    supportsAutoSubmit: false,
    notes: 'Only for non-Easy Apply flows. Easy Apply is filtered out by detection logic.',
  },
  {
    id: 'indeed',
    name: 'Indeed',
    domains: ['indeed.com', 'www.indeed.com', 'apply.indeed.com'],
    urlPatterns: [/indeed\.com/i, /apply\.indeed\.com/i],
    domSignals: [
      '#jobsearch-ViewJobButtons-container', '.jobsearch-ViewJobLayout',
      '[data-testid="apply-button"]', '#ia-container',
    ],
    metaSignals: [],
    enabled: true,
    supportsAutoSubmit: true,
    notes: 'Indeed Apply flow uses iframe-based application forms.',
  },
];

/** Get all enabled platforms */
export function getEnabledPlatforms(): ATSPlatformEntry[] {
  return PLATFORM_REGISTRY.filter((p) => p.enabled);
}

/** Get platform by ID */
export function getPlatform(id: ATSType): ATSPlatformEntry | undefined {
  return PLATFORM_REGISTRY.find((p) => p.id === id);
}

/** Get all platform domains for manifest host permissions */
export function getAllDomains(): string[] {
  return PLATFORM_REGISTRY.flatMap((p) => p.domains);
}

/** Check if a URL matches any supported platform */
export function matchUrlToPlatform(url: string): ATSPlatformEntry | null {
  for (const p of PLATFORM_REGISTRY) {
    if (!p.enabled) continue;
    for (const pat of p.urlPatterns) {
      if (pat.test(url)) return p;
    }
  }
  return null;
}

/** Check if a LinkedIn job is Easy Apply (to filter it out) */
export function isLinkedInEasyApply(doc: Document): boolean {
  const easyApplyBtn = doc.querySelector('.jobs-apply-button--top-card .jobs-apply-button');
  if (easyApplyBtn) {
    const text = easyApplyBtn.textContent?.toLowerCase() || '';
    return text.includes('easy apply');
  }
  const badge = doc.querySelector('[class*="easy-apply"]') || doc.querySelector('[data-is-easy-apply="true"]');
  return !!badge;
}

/** Export registry as JSON for settings display */
export function registryToJSON(): Array<{ id: string; name: string; domains: string[]; enabled: boolean; supportsAutoSubmit: boolean }> {
  return PLATFORM_REGISTRY.map((p) => ({
    id: p.id,
    name: p.name,
    domains: p.domains,
    enabled: p.enabled,
    supportsAutoSubmit: p.supportsAutoSubmit,
  }));
}
