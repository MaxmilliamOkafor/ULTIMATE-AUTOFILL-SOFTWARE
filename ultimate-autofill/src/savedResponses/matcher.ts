import type { SavedResponse, SuggestionItem, ATSType } from '../types/index';
import { hybridSimilarity, normalize, tokenize, tokenOverlap } from '../utils/fuzzy';

export interface MatchOptions {
  domain?: string;
  atsType?: ATSType;
  maxResults?: number;
}

/** Score one response against a query string. Returns 0–1 and explanation. */
export function scoreResponse(
  query: string,
  resp: SavedResponse,
  opts: MatchOptions = {}
): { score: number; explanation: string } {
  const parts: string[] = [];
  let score = 0;

  // 1. Hybrid text similarity vs question (0.45)
  const qSim = hybridSimilarity(query, resp.question, resp.keywords);
  score += qSim * 0.45;
  parts.push(`q_sim=${qSim.toFixed(3)}`);

  // 2. Key overlap (0.20)
  const keyTokens = resp.key.split('|').filter(Boolean);
  const qTokens = tokenize(query);
  const keyOv = tokenOverlap(qTokens, keyTokens);
  score += keyOv * 0.20;
  parts.push(`key=${keyOv.toFixed(3)}`);

  // 3. Popularity (0.10)
  const pop = Math.min(Math.log2(1 + resp.appearances) / 10, 1);
  score += pop * 0.10;
  parts.push(`pop=${pop.toFixed(3)}`);

  // 4. Recency (0.10)
  let rec = 0;
  if (resp.lastUsedAt) {
    const days = (Date.now() - new Date(resp.lastUsedAt).getTime()) / 86_400_000;
    rec = Math.max(0, 1 - days / 90);
  }
  score += rec * 0.10;
  parts.push(`rec=${rec.toFixed(3)}`);

  // 5. Domain / ATS hint (0.10)
  let ctx = 0;
  if (opts.domain && resp.domains?.includes(opts.domain)) { ctx += 0.5; parts.push('dom+'); }
  if (opts.atsType && resp.atsTypes?.includes(opts.atsType)) { ctx += 0.5; parts.push('ats+'); }
  score += Math.min(ctx, 1) * 0.10;

  // 6. Keyword bonus (0.05)
  let kwb = 0;
  if (resp.keywords.length) {
    const nq = normalize(query);
    let hit = 0;
    for (const k of resp.keywords) if (nq.includes(k.toLowerCase())) hit++;
    kwb = hit / resp.keywords.length;
  }
  score += kwb * 0.05;
  parts.push(`kw=${kwb.toFixed(3)}`);

  return { score: Math.min(score, 1), explanation: parts.join(', ') };
}

/** Top N matches above threshold */
export function findMatches(query: string, responses: SavedResponse[], opts: MatchOptions = {}): SuggestionItem[] {
  const max = opts.maxResults || 3;
  if (!query.trim() || !responses.length) return [];
  return responses
    .map((r) => { const { score, explanation } = scoreResponse(query, r, opts); return { response: r, score, explanation }; })
    .filter((s) => s.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

/** Best single match for autofill (null if below confidence) */
export function findBestMatch(query: string, responses: SavedResponse[], opts: MatchOptions = {}): SuggestionItem | null {
  const m = findMatches(query, responses, { ...opts, maxResults: 1 });
  return m.length && m[0].score >= 0.3 ? m[0] : null;
}
