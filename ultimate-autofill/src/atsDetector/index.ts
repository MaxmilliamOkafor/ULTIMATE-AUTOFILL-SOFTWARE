import type { ATSDetectionResult, ATSType } from '../types/index';

interface Sig {
  type: ATSType;
  urls: RegExp[];
  dom: string[];
  meta: { name: string; pat: RegExp }[];
}

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
    urls: [/taleo\.net/i],
    dom: ['[class*="taleo"]', '#requisitionDescriptionInterface'],
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
      try { if (doc.querySelector(sel)) { conf += 0.2; found.push(`dom:${sel}`); if (conf >= 0.9) break; } } catch {}
    }
    for (const m of s.meta) {
      const el = doc.querySelector(`meta[name="${m.name}"]`);
      if (el && m.pat.test(el.getAttribute('content') || '')) { conf += 0.3; found.push(`meta:${m.name}`); }
    }

    conf = Math.min(conf, 1);
    if (conf > bestConf) { bestConf = conf; best = s.type; bestSigs.length = 0; bestSigs.push(...found); }
  }

  return { type: best, confidence: bestConf, signals: bestSigs };
}

export function atsName(type: ATSType): string {
  const m: Record<ATSType, string> = {
    workday: 'Workday', greenhouse: 'Greenhouse', lever: 'Lever',
    smartrecruiters: 'SmartRecruiters', icims: 'iCIMS', taleo: 'Taleo',
    ashby: 'Ashby', bamboohr: 'BambooHR', generic: 'Generic',
  };
  return m[type];
}
