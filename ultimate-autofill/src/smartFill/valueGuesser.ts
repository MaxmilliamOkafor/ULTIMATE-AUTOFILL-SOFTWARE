/**
 * Smart Value Guesser
 * Regex-based field interpretation with 50+ patterns covering:
 * - Personal info (name, email, phone, address)
 * - Education (school, degree, GPA)
 * - Work (title, company, salary)
 * - Legal/EEO (authorization, veteran, disability, gender, race)
 * - Application meta (cover letter, availability, how heard)
 */

import type { UserProfile } from '../answerBank/index';

const DEFAULTS: Record<string, string> = {
  authorized: 'Yes',
  sponsorship: 'No',
  relocation: 'Yes',
  remote: 'Yes',
  veteran: 'I am not a protected veteran',
  disability: 'I do not have a disability',
  gender: 'Prefer not to say',
  ethnicity: 'Prefer not to say',
  race: 'Prefer not to say',
  years: '5',
  salary: '80000',
  notice: '2 weeks',
  availability: 'Immediately',
  cover: 'I am excited to apply for this role. My background and skills make me an excellent candidate and I look forward to contributing to your team.',
  why: 'I admire the company culture and the opportunity to make a meaningful impact.',
  howHeard: 'LinkedIn',
};

/**
 * Guess a field value based on the field label and user profile.
 * Returns empty string if no guess is possible.
 */
export function guessValue(label: string, profile: UserProfile): string {
  const l = (label || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');

  // ─── Personal Info ───
  if (/first.?name|given.?name|prenom/.test(l)) return profile.first_name || '';
  if (/last.?name|family.?name|surname/.test(l)) return profile.last_name || '';
  if (/middle.?name/.test(l)) return profile.middle_name || '';
  if (/preferred.?name|nick.?name/.test(l)) return profile.preferred_name || profile.first_name || '';
  if (/full.?name|your name|^name$/.test(l) && !/company|last|first|user/.test(l))
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
  if (/\bemail\b/.test(l)) return profile.email || '';
  if (/phone|mobile|cell|telephone/.test(l)) return profile.phone || '';

  // ─── Address ───
  if (/^city$|\bcity\b|current.?city/.test(l)) return profile.city || '';
  if (/state|province|region/.test(l)) return profile.state || '';
  if (/zip|postal/.test(l)) return profile.postal_code || '';
  if (/country/.test(l)) return profile.country || 'United States';
  if (/address|street/.test(l)) return profile.address || '';
  if (/location|where.*(you|do you).*live/.test(l))
    return profile.city ? `${profile.city}, ${profile.state || ''}`.trim().replace(/,$/, '') : '';

  // ─── Online Profiles ───
  if (/linkedin/.test(l)) return profile.linkedin || '';
  if (/github/.test(l)) return profile.github || '';
  if (/website|portfolio|personal.?url/.test(l)) return profile.website || '';
  if (/twitter|x\.com/.test(l)) return profile.twitter || '';

  // ─── Education ───
  if (/university|school|college|alma.?mater/.test(l)) return profile.school || '';
  if (/\bdegree\b|qualification/.test(l)) return profile.degree || "Bachelor's";
  if (/major|field.?of.?study|concentration/.test(l)) return profile.major || '';
  if (/gpa|grade.?point/.test(l)) return profile.gpa || '';
  if (/graduation|grad.?date|grad.?year/.test(l)) return profile.graduation_year || '';

  // ─── Work ───
  if (/title|position|role|current.?title|job.?title/.test(l) && !/company/.test(l))
    return profile.current_title || '';
  if (/company|employer|org|current.?company/.test(l)) return profile.current_company || '';
  if (/salary|compensation|pay|desired.?pay/.test(l)) return profile.expected_salary || DEFAULTS.salary;

  // ─── Application Meta ───
  if (/cover.?letter|motivation|additional.?info|message.?to/.test(l))
    return profile.cover_letter || DEFAULTS.cover;
  if (/summary|about.?(yourself|you|me)|bio|objective/.test(l))
    return profile.summary || profile.cover_letter || DEFAULTS.cover;
  if (/why.*(compan|role|want|interest|position)/.test(l)) return DEFAULTS.why;
  if (/how.*hear|where.*(find|learn|discover)|source|referred/.test(l)) return DEFAULTS.howHeard;
  if (/years.*(exp|work)|exp.*years|total.*experience/.test(l)) return DEFAULTS.years;
  if (/availab|start.?date|notice|when.*start/.test(l)) return DEFAULTS.availability;

  // ─── Legal / Authorization ───
  if (/authoriz|eligible|work.*right|legal.*right/.test(l)) return DEFAULTS.authorized;
  if (/sponsor|visa|immigration|work.?permit/.test(l)) return DEFAULTS.sponsorship;
  if (/relocat|willing.*move/.test(l)) return DEFAULTS.relocation;
  if (/remote|work.*home|hybrid|on.?site/.test(l)) return DEFAULTS.remote;

  // ─── EEO / Demographics ───
  if (/veteran|military|armed.?forces/.test(l)) return DEFAULTS.veteran;
  if (/disabilit/.test(l)) return DEFAULTS.disability;
  if (/gender|sex\b|pronouns/.test(l)) return DEFAULTS.gender;
  if (/ethnic|race|racial|heritage/.test(l)) return DEFAULTS.ethnicity;
  if (/nationality|citizenship/.test(l)) return profile.nationality || profile.country || 'United States';
  if (/language|fluency|fluent/.test(l)) return profile.languages || 'English';
  if (/certif|license|credential/.test(l)) return profile.certifications || '';

  // ─── Yes/No Questions ───
  if (/commute|travel|willing.*travel/.test(l)) return 'Yes';
  if (/convicted|criminal|felony|background/.test(l)) return 'No';
  if (/drug.?test|screening/.test(l)) return 'Yes';
  if (/\bage\b|18.*years|over.*18|at.*least.*18/.test(l)) return 'Yes';
  if (/agree|acknowledge|certif|attest|confirm|consent/.test(l)) return 'Yes';
  if (/please.?specify|other.?please/.test(l)) return profile.city || profile.state || '';

  return '';
}

export { DEFAULTS };
