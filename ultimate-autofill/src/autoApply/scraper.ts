/**
 * Fresh Jobs Scraper / Scheduler
 *
 * Discovers new job postings and ranks by freshness.
 * Tier A: posted in last 30 minutes
 * Tier B: posted in last 24 hours
 * Tier C: posted in last 3 days
 * Older jobs only included if results < target_count.
 *
 * IMPORTANT COMPLIANCE NOTE:
 * - Indeed and LinkedIn scraping may violate their Terms of Service.
 * - This implementation uses on-device parsing of user-provided search result URLs.
 * - For production use, prefer official APIs/feeds/partner integrations.
 * - The scraper only processes pages the user has already loaded in their browser.
 */

import type { ScrapedJob, ScraperSettings } from '../types/index';
import { generateId } from '../utils/helpers';
import { loadSettings, saveSettings } from '../settings/storage';

const SCRAPED_KEY = 'ua_scraped_jobs';
let _scraperInterval: ReturnType<typeof setInterval> | null = null;
let _running = false;

/** Get freshness tier based on age in minutes */
function getFreshnessTier(ageMinutes: number, tiers: ScraperSettings['freshnessTiers']): 'A' | 'B' | 'C' | 'old' {
  if (ageMinutes <= tiers.tierA) return 'A';
  if (ageMinutes <= tiers.tierB) return 'B';
  if (ageMinutes <= tiers.tierC) return 'C';
  return 'old';
}

/** Load scraped jobs from storage */
export async function loadScrapedJobs(): Promise<ScrapedJob[]> {
  const r = await chrome.storage.local.get(SCRAPED_KEY);
  return (r[SCRAPED_KEY] as ScrapedJob[]) || [];
}

/** Save scraped jobs to storage */
async function saveScrapedJobs(jobs: ScrapedJob[]): Promise<void> {
  await chrome.storage.local.set({ [SCRAPED_KEY]: jobs });
}

/** Add new scraped jobs with deduplication */
export async function addScrapedJobs(newJobs: Omit<ScrapedJob, 'id' | 'freshnessTier' | 'status'>[]): Promise<number> {
  const settings = await loadSettings();
  const existing = await loadScrapedJobs();
  const existingUrls = new Set(existing.map((j) => j.url));
  let added = 0;

  for (const job of newJobs) {
    if (existingUrls.has(job.url)) continue;
    existingUrls.add(job.url);

    const firstSeen = new Date(job.firstSeenAt);
    const ageMinutes = (Date.now() - firstSeen.getTime()) / 60000;
    const tier = getFreshnessTier(ageMinutes, settings.scraper.freshnessTiers);

    existing.push({
      id: generateId(),
      ...job,
      freshnessTier: tier,
      status: 'new',
    });
    added++;
  }

  await saveScrapedJobs(existing);
  return added;
}

/** Get ranked jobs (freshest first, respecting target count) */
export async function getRankedJobs(targetCount?: number): Promise<ScrapedJob[]> {
  const settings = await loadSettings();
  const target = targetCount || settings.scraper.targetCountPerSession;
  const jobs = await loadScrapedJobs();

  // Update freshness tiers based on current time
  const now = Date.now();
  for (const job of jobs) {
    const firstSeen = new Date(job.firstSeenAt);
    const ageMinutes = (now - firstSeen.getTime()) / 60000;
    job.freshnessTier = getFreshnessTier(ageMinutes, settings.scraper.freshnessTiers);
  }

  // Sort: Tier A first, then B, then C, then old
  // Within each tier, newest first
  const tierOrder: Record<string, number> = { A: 0, B: 1, C: 2, old: 3 };
  const sorted = jobs
    .filter((j) => j.status === 'new')
    .sort((a, b) => {
      const tierDiff = tierOrder[a.freshnessTier] - tierOrder[b.freshnessTier];
      if (tierDiff !== 0) return tierDiff;
      return new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime();
    });

  // Return up to target count, preferring fresh jobs
  const result: ScrapedJob[] = [];
  for (const job of sorted) {
    if (result.length >= target) {
      // Only include older jobs if we haven't hit target
      if (job.freshnessTier === 'old') break;
    }
    result.push(job);
  }

  return result.slice(0, target);
}

/**
 * Parse job listings from a page the user has loaded.
 * This runs as a content script on Indeed/LinkedIn search result pages.
 */
export function parseIndeedListings(doc: Document): Array<Omit<ScrapedJob, 'id' | 'freshnessTier' | 'status'>> {
  const jobs: Array<Omit<ScrapedJob, 'id' | 'freshnessTier' | 'status'>> = [];
  const cards = doc.querySelectorAll('.job_seen_beacon, .jobsearch-ResultsList .result, [data-jk]');

  for (const card of cards) {
    const linkEl = card.querySelector('a[href*="/viewjob"], a[data-jk], h2 a') as HTMLAnchorElement;
    if (!linkEl?.href) continue;

    const title = card.querySelector('.jobTitle, [data-testid="jobTitle"], h2')?.textContent?.trim();
    const company = card.querySelector('.companyName, [data-testid="company-name"]')?.textContent?.trim();
    const location = card.querySelector('.companyLocation, [data-testid="text-location"]')?.textContent?.trim();

    // Try to get posted date
    const dateEl = card.querySelector('.date, [data-testid="myJobsStateDate"], .new');
    let postedAt: string | undefined;
    if (dateEl?.textContent) {
      const text = dateEl.textContent.trim().toLowerCase();
      if (text.includes('just posted') || text.includes('today')) {
        postedAt = new Date().toISOString();
      } else {
        const daysMatch = text.match(/(\d+)\s*day/);
        if (daysMatch) {
          const d = new Date();
          d.setDate(d.getDate() - parseInt(daysMatch[1]));
          postedAt = d.toISOString();
        }
      }
    }

    jobs.push({
      url: linkEl.href,
      title,
      company,
      location,
      postedAt,
      firstSeenAt: new Date().toISOString(),
      source: 'indeed',
    });
  }

  return jobs;
}

export function parseLinkedInListings(doc: Document): Array<Omit<ScrapedJob, 'id' | 'freshnessTier' | 'status'>> {
  const jobs: Array<Omit<ScrapedJob, 'id' | 'freshnessTier' | 'status'>> = [];
  const cards = doc.querySelectorAll('.jobs-search-results__list-item, [data-job-id], .job-card-container');

  for (const card of cards) {
    const linkEl = card.querySelector('a[href*="/jobs/view/"]') as HTMLAnchorElement;
    if (!linkEl?.href) continue;

    // Check if it's Easy Apply - skip if so
    const easyApply = card.querySelector('[class*="easy-apply"]') ||
      card.querySelector('.job-card-container__apply-method--easy-apply');
    if (easyApply) {
      continue; // Skip Easy Apply jobs
    }

    const title = card.querySelector('.job-card-list__title, .base-search-card__title')?.textContent?.trim();
    const company = card.querySelector('.job-card-container__primary-description, .base-search-card__subtitle')?.textContent?.trim();
    const location = card.querySelector('.job-card-container__metadata-item, .job-search-card__location')?.textContent?.trim();

    const timeEl = card.querySelector('time');
    const postedAt = timeEl?.getAttribute('datetime') || undefined;

    jobs.push({
      url: linkEl.href,
      title,
      company,
      location,
      postedAt,
      firstSeenAt: new Date().toISOString(),
      source: 'linkedin',
      isEasyApply: false,
    });
  }

  return jobs;
}

/** Start the scraper scheduler */
export async function startScraper(): Promise<void> {
  if (_running) return;
  _running = true;

  const settings = await loadSettings();
  if (!settings.scraper.enabled) {
    _running = false;
    return;
  }

  const intervalMs = settings.scraper.intervalMinutes * 60 * 1000;
  _scraperInterval = setInterval(async () => {
    if (!_running) return;
    // The actual scraping happens via content scripts on pages the user loads
    // This interval just updates freshness tiers
    const jobs = await loadScrapedJobs();
    const now = Date.now();
    for (const job of jobs) {
      const firstSeen = new Date(job.firstSeenAt);
      const ageMinutes = (now - firstSeen.getTime()) / 60000;
      job.freshnessTier = getFreshnessTier(ageMinutes, settings.scraper.freshnessTiers);
    }
    await saveScrapedJobs(jobs);
  }, intervalMs);
}

/** Stop the scraper scheduler */
export function stopScraper(): void {
  _running = false;
  if (_scraperInterval) {
    clearInterval(_scraperInterval);
    _scraperInterval = null;
  }
}

export function isScraperRunning(): boolean {
  return _running;
}
