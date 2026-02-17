/** Normalize: lowercase, strip punctuation, collapse whitespace */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Tokenize normalized text */
export function tokenize(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean);
}

/** Levenshtein distance */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
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

/** Normalized similarity 0–1 */
export function stringSimilarity(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return 1;
  const max = Math.max(na.length, nb.length);
  return max === 0 ? 1 : 1 - levenshtein(na, nb) / max;
}

/** Token overlap (Jaccard) */
export function tokenOverlap(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const sa = new Set(a), sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / new Set([...sa, ...sb]).size;
}

/** Fuzzy per-token match */
export function fuzzyTokenMatch(a: string[], b: string[]): number {
  if (!a.length) return b.length === 0 ? 1 : 0;
  let total = 0;
  for (const ta of a) {
    let best = 0;
    for (const tb of b) best = Math.max(best, stringSimilarity(ta, tb));
    total += best;
  }
  return total / a.length;
}

/** Combined hybrid similarity */
export function hybridSimilarity(query: string, target: string, keywords: string[]): number {
  const qt = tokenize(query), tt = tokenize(target);
  const direct = stringSimilarity(query, target) * 0.3;
  const overlap = tokenOverlap(qt, tt) * 0.25;
  const fuzzy = fuzzyTokenMatch(qt, tt) * 0.25;
  let kw = 0;
  if (keywords.length) {
    const nq = normalize(query);
    let hit = 0;
    for (const k of keywords) if (nq.includes(normalize(k))) hit++;
    kw = (hit / keywords.length) * 0.2;
  }
  return direct + overlap + fuzzy + kw;
}

/** Find near-duplicate pairs above threshold */
export function findDuplicates(
  items: { id: string; question: string }[],
  threshold = 0.75
): { idA: string; idB: string; similarity: number }[] {
  const out: { idA: string; idB: string; similarity: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sim = stringSimilarity(items[i].question, items[j].question);
      if (sim >= threshold) out.push({ idA: items[i].id, idB: items[j].id, similarity: sim });
    }
  }
  return out.sort((a, b) => b.similarity - a.similarity);
}
