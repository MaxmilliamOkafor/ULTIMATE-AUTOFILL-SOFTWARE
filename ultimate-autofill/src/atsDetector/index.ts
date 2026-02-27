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

    // Special case: filter out LinkedIn Easy Apply
    if (s.type === 'linkedin' && conf > 0) {
      if (isLinkedInEasyApply(doc)) {
        continue; // Skip - we only support non-Easy Apply
      }
    }

    if (conf > bestConf) { bestConf = conf; best = s.type; bestSigs.length = 0; bestSigs.push(...found); }
  }

  return { type: best, confidence: bestConf, signals: bestSigs };
}

export function atsName(type: ATSType): string {
  const m: Record<ATSType, string> = {
    workday: 'Workday', greenhouse: 'Greenhouse', lever: 'Lever',
    smartrecruiters: 'SmartRecruiters', icims: 'iCIMS', taleo: 'Taleo',
    ashby: 'Ashby', bamboohr: 'BambooHR',
    oraclecloud: 'Oracle Cloud', linkedin: 'LinkedIn', indeed: 'Indeed',
    generic: 'Generic',
  };
  return m[type] || type;
}

/** Check if current page is a supported ATS application page */
export function isApplicationPage(doc: Document): boolean {
  const result = detectATS(doc);
  return result.type !== 'generic' && result.confidence >= 0.3;
}
