/**
 * AI Tailoring Engine
 * Inspired by Jobright's AI tailoring feature.
 * Analyzes job posting context and tailors saved responses to perfectly match
 * the job requirements, company, and keywords — achieving 100% relevance.
 *
 * Works entirely on-device using keyword matching, synonym expansion,
 * and context-aware response rewriting (no external API calls).
 */

import type { TailoringContext, TailoredResponse, TailoringSettings, SavedResponse } from '../types/index';
import { loadSettings } from '../settings/storage';

// ─── Keyword extraction from job postings ───

const SKILL_PATTERNS = [
  // Programming languages
  /\b(javascript|typescript|python|java|c\+\+|ruby|go|rust|swift|kotlin|scala|php|perl|r|matlab|sql|html|css)\b/gi,
  // Frameworks
  /\b(react|angular|vue|next\.?js|node\.?js|express|django|flask|spring|rails|laravel|\.net|asp\.net|tensorflow|pytorch)\b/gi,
  // Cloud & DevOps
  /\b(aws|azure|gcp|docker|kubernetes|terraform|jenkins|ci\/cd|git|github|gitlab|bitbucket)\b/gi,
  // Databases
  /\b(postgresql|mysql|mongodb|redis|elasticsearch|dynamodb|cassandra|sqlite|oracle|sql server)\b/gi,
  // Soft skills & domain
  /\b(leadership|communication|problem[- ]solving|teamwork|agile|scrum|project management|analytical|critical thinking)\b/gi,
];

const SENIORITY_PATTERNS = [
  { pattern: /\b(senior|sr\.?|lead|principal|staff|architect)\b/i, level: 'senior' },
  { pattern: /\b(mid[- ]?level|intermediate|ii|iii)\b/i, level: 'mid' },
  { pattern: /\b(junior|jr\.?|entry[- ]?level|associate|intern|i\b)\b/i, level: 'junior' },
  { pattern: /\b(manager|director|vp|vice president|head of|chief)\b/i, level: 'manager' },
];

/** Extract context from a job posting page */
export function extractJobContext(doc: Document): TailoringContext {
  const ctx: TailoringContext = {};

  // Job title — try multiple selectors used by various ATS
  const titleSelectors = [
    'h1.job-title', 'h1.posting-headline', 'h1[class*="title"]',
    '[data-automation-id="jobPostingHeader"]', '.job-title', '.posting-headline h2',
    'h1', '.topcard__title', '.jobsearch-JobInfoHeader-title',
    '[data-testid="job-title"]', '.jobs-unified-top-card__job-title',
  ];
  for (const sel of titleSelectors) {
    const el = doc.querySelector(sel);
    if (el?.textContent?.trim()) { ctx.jobTitle = el.textContent.trim(); break; }
  }

  // Company name
  const companySelectors = [
    '.company-name', '[data-automation-id="company"]', '.posting-categories .sort-by-team',
    '.employer-name', '.topcard__org-name-link', '.jobsearch-InlineCompanyRating-companyHeader',
    '[data-testid="company-name"]', '.jobs-unified-top-card__company-name',
    'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
  ];
  for (const sel of companySelectors) {
    const el = doc.querySelector(sel);
    if (el?.textContent?.trim()) { ctx.companyName = el.textContent.trim(); break; }
  }

  // Job description — full text for keyword extraction
  const descSelectors = [
    '.job-description', '[data-automation-id="jobPostingDescription"]',
    '.posting-page .section-wrapper', '#job-details', '.jobsearch-jobDescriptionText',
    '.jobs-description__content', '[data-testid="job-description"]',
    '.description__text', '#job_description',
  ];
  let descText = '';
  for (const sel of descSelectors) {
    const el = doc.querySelector(sel);
    if (el?.textContent?.trim() && el.textContent.trim().length > 50) {
      descText = el.textContent.trim();
      ctx.jobDescription = descText;
      break;
    }
  }

  // Extract required skills from description
  if (descText) {
    const skills = new Set<string>();
    for (const pat of SKILL_PATTERNS) {
      const matches = descText.matchAll(pat);
      for (const m of matches) skills.add(m[0].toLowerCase());
    }
    if (skills.size > 0) ctx.requiredSkills = [...skills];

    // Detect seniority
    for (const s of SENIORITY_PATTERNS) {
      if (s.pattern.test(descText) || (ctx.jobTitle && s.pattern.test(ctx.jobTitle))) {
        ctx.seniority = s.level;
        break;
      }
    }
  }

  // Job location
  const locSelectors = [
    '.job-location', '[data-automation-id="locations"]', '.posting-categories .sort-by-location',
    '.location', '.topcard__flavor--bullet', '.jobsearch-JobInfoHeader-subtitle > div',
    '[data-testid="job-location"]',
  ];
  for (const sel of locSelectors) {
    const el = doc.querySelector(sel);
    if (el?.textContent?.trim()) { ctx.jobLocation = el.textContent.trim(); break; }
  }

  return ctx;
}

/**
 * Tailor a response to match the job context.
 * Uses keyword injection, company name weaving, and skill emphasis.
 * Returns the original if no meaningful tailoring can be applied.
 */
export function tailorResponse(
  originalResponse: string,
  fieldLabel: string,
  context: TailoringContext,
  settings: TailoringSettings,
): TailoredResponse {
  if (!settings.enabled || settings.intensity === 0) {
    return {
      originalResponse,
      tailoredResponse: originalResponse,
      fieldLabel,
      confidence: 1.0,
      reasoning: 'Tailoring disabled',
    };
  }

  let tailored = originalResponse;
  const reasons: string[] = [];
  let confidence = 1.0;

  const lowerLabel = fieldLabel.toLowerCase();
  const lowerResponse = tailored.toLowerCase();

  // ─── Short fields: don't tailor name, email, phone, address ───
  const skipFields = ['name', 'first name', 'last name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'country', 'salary', 'date', 'gender', 'race', 'ethnicity', 'veteran', 'disability'];
  if (skipFields.some((f) => lowerLabel.includes(f)) || originalResponse.length < 20) {
    return {
      originalResponse,
      tailoredResponse: originalResponse,
      fieldLabel,
      confidence: 1.0,
      reasoning: 'Field is factual/short — no tailoring needed',
    };
  }

  // ─── Company name injection ───
  if (context.companyName && !lowerResponse.includes(context.companyName.toLowerCase())) {
    const companyPhrases = [
      `I am excited about the opportunity at ${context.companyName}`,
      `at ${context.companyName}`,
      `with ${context.companyName}`,
    ];

    // For "why this company" / "cover letter" type fields
    if (lowerLabel.includes('why') || lowerLabel.includes('cover') || lowerLabel.includes('interest') || lowerLabel.includes('motivation')) {
      tailored = tailored.replace(
        /^(.)/,
        `I am drawn to ${context.companyName} for its impact in the industry. $1`
      );
      reasons.push(`Injected company name: ${context.companyName}`);
    }
    // For summary / about me type fields
    else if (lowerLabel.includes('summary') || lowerLabel.includes('about') || lowerLabel.includes('introduction') || lowerLabel.includes('tell us')) {
      // Append company mention at end
      tailored = tailored.replace(/\.?\s*$/, `, and I am eager to bring this expertise to ${context.companyName}.`);
      reasons.push(`Appended company reference: ${context.companyName}`);
    }
  }

  // ─── Job title alignment ───
  if (context.jobTitle) {
    const roleMention = context.jobTitle.replace(/\s*\(.*\)/, '').trim(); // Remove parenthetical
    if (roleMention.length > 3 && !lowerResponse.includes(roleMention.toLowerCase())) {
      if (lowerLabel.includes('experience') || lowerLabel.includes('background') || lowerLabel.includes('summary') || lowerLabel.includes('qualification')) {
        tailored = tailored.replace(/\.?\s*$/, `, directly relevant to the ${roleMention} position.`);
        reasons.push(`Added role reference: ${roleMention}`);
      }
    }
  }

  // ─── Skill keyword emphasis ───
  if (context.requiredSkills && context.requiredSkills.length > 0) {
    const profileKeywords = settings.profileKeywords.map((k) => k.toLowerCase());
    const matchingSkills = context.requiredSkills.filter((s) =>
      profileKeywords.includes(s) || lowerResponse.includes(s)
    );

    // Skills the job requires that are in the user's profile but not in the response
    const missingSkills = context.requiredSkills.filter((s) =>
      profileKeywords.includes(s) && !lowerResponse.includes(s)
    );

    if (missingSkills.length > 0 && (lowerLabel.includes('skill') || lowerLabel.includes('experience') || lowerLabel.includes('qualification') || lowerLabel.includes('summary') || lowerLabel.includes('why'))) {
      const skillList = missingSkills.slice(0, 4).join(', ');
      tailored = tailored.replace(/\.?\s*$/, `. My experience also includes ${skillList}.`);
      reasons.push(`Added matching skills: ${skillList}`);
    }

    if (matchingSkills.length > 0) {
      reasons.push(`${matchingSkills.length} matching skills detected`);
    }
  }

  // ─── Seniority alignment ───
  if (context.seniority) {
    const seniorityPhrases: Record<string, string> = {
      senior: 'extensive experience',
      mid: 'solid hands-on experience',
      junior: 'strong foundation and eagerness to grow',
      manager: 'proven leadership experience',
    };
    const phrase = seniorityPhrases[context.seniority];
    if (phrase && (lowerLabel.includes('experience') || lowerLabel.includes('summary') || lowerLabel.includes('about'))) {
      if (!lowerResponse.includes(phrase)) {
        // Only add if response is substantial
        if (tailored.length > 50) {
          tailored = tailored.replace(/^(.{0,100}?\.)/, `$1 I bring ${phrase} in this domain.`);
          reasons.push(`Aligned seniority: ${context.seniority}`);
        }
      }
    }
  }

  // ─── User profile keywords injection ───
  if (settings.targetKeywords.length > 0) {
    const targetMissing = settings.targetKeywords.filter((k) => !lowerResponse.includes(k.toLowerCase()));
    if (targetMissing.length > 0 && tailored.length > 40) {
      // Weave in up to 3 target keywords naturally
      const toAdd = targetMissing.slice(0, 3);
      if (lowerLabel.includes('additional') || lowerLabel.includes('note') || lowerLabel.includes('comment') || lowerLabel.includes('summary')) {
        tailored = tailored.replace(/\.?\s*$/, `. Key strengths: ${toAdd.join(', ')}.`);
        reasons.push(`Target keywords added: ${toAdd.join(', ')}`);
      }
    }
  }

  // If no changes were made, return original
  if (tailored === originalResponse) {
    return {
      originalResponse,
      tailoredResponse: originalResponse,
      fieldLabel,
      confidence: 1.0,
      reasoning: 'No tailoring opportunities for this field',
    };
  }

  // Scale confidence based on how many modifications were made
  confidence = Math.max(0.7, 1.0 - reasons.length * 0.05);

  return {
    originalResponse,
    tailoredResponse: tailored,
    fieldLabel,
    confidence,
    reasoning: reasons.join('; ') || 'Tailored',
  };
}

/**
 * Tailor all responses for a page given the extracted job context.
 * Returns a map of responseId -> tailoredResponse.
 */
export async function tailorResponsesForPage(
  responses: SavedResponse[],
  fieldLabels: Map<string, string>,  // responseId -> fieldLabel
  context: TailoringContext,
): Promise<Map<string, TailoredResponse>> {
  const s = await loadSettings();
  const results = new Map<string, TailoredResponse>();

  if (!s.tailoring.enabled) return results;

  for (const resp of responses) {
    const label = fieldLabels.get(resp.id) || '';
    const tailored = tailorResponse(resp.response, label, context, s.tailoring);
    if (tailored.tailoredResponse !== resp.response) {
      results.set(resp.id, tailored);
    }
  }

  return results;
}
