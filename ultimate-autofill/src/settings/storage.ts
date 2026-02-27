/**
 * Extension settings storage.
 * Handles all global settings including auto-apply, scraper, and credentials.
 */

import type { ExtensionSettings, AutoApplySettings, ScraperSettings, ApplicationsAccount } from '../types/index';
import { encrypt, decrypt } from '../utils/crypto';

const KEY = 'ua_settings';

function defaultAutoApply(): AutoApplySettings {
  return {
    enabled: true,
    autoSubmit: false,           // Default OFF for safety
    autoSubmitPerSite: {},
    maxConcurrency: 1,
    delayBetweenJobs: 3000,      // 3 seconds between jobs
    humanLikePacing: true,
    closeTabAfterApply: false,
    retryFailedMax: 2,
    requireResumeForSubmit: true,
    domainAllowlist: [
      'myworkdayjobs.com', 'myworkday.com', 'greenhouse.io', 'lever.co',
      'smartrecruiters.com', 'icims.com', 'taleo.net', 'ashbyhq.com',
      'bamboohr.com', 'oraclecloud.com', 'indeed.com', 'linkedin.com',
    ],
    rateLimit: { maxPerHour: 30, maxPerDay: 200 },
    paused: false,
  };
}

function defaultScraper(): ScraperSettings {
  return {
    enabled: false,
    intervalMinutes: 10,
    sources: { ats: true, indeed: true, linkedinNonEasyApply: true },
    targetCountPerSession: 50,
    freshnessTiers: { tierA: 30, tierB: 1440, tierC: 4320 },
    filters: {
      keywords: [],
      geoRadius: 50,
      location: '',
      seniority: [],
      remoteOnly: false,
      hybridAllowed: true,
    },
  };
}

function defaultSettings(): ExtensionSettings {
  return {
    autoApply: defaultAutoApply(),
    scraper: defaultScraper(),
    applicationsAccount: null,
    creditsUnlimited: true,      // Unlimited credits by default
    autoDetectAndFill: true,     // Auto-detect ATS and fill on page load
    supportedPlatforms: {
      workday: true, greenhouse: true, lever: true, smartrecruiters: true,
      icims: true, taleo: true, ashby: true, bamboohr: true,
      oraclecloud: true, linkedin: true, indeed: true,
    },
  };
}

export async function loadSettings(): Promise<ExtensionSettings> {
  const r = await chrome.storage.local.get(KEY);
  const saved = r[KEY] as ExtensionSettings | undefined;
  if (!saved) return defaultSettings();
  // Merge with defaults to handle newly added fields
  const defaults = defaultSettings();
  return {
    ...defaults,
    ...saved,
    autoApply: { ...defaults.autoApply, ...saved.autoApply },
    scraper: { ...defaults.scraper, ...saved.scraper, filters: { ...defaults.scraper.filters, ...(saved.scraper?.filters || {}) } },
    supportedPlatforms: { ...defaults.supportedPlatforms, ...saved.supportedPlatforms },
  };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}

export async function updateAutoApply(update: Partial<AutoApplySettings>): Promise<void> {
  const s = await loadSettings();
  s.autoApply = { ...s.autoApply, ...update };
  await saveSettings(s);
}

export async function updateScraper(update: Partial<ScraperSettings>): Promise<void> {
  const s = await loadSettings();
  s.scraper = { ...s.scraper, ...update };
  await saveSettings(s);
}

/**
 * Save applications account credentials.
 * Password is encrypted with a user-provided passphrase using AES-GCM.
 * The passphrase is NEVER stored - user must provide it each session.
 */
export async function saveAppAccount(email: string, password: string, passphrase: string): Promise<void> {
  const s = await loadSettings();
  const encryptedPassword = await encrypt(password, passphrase);
  s.applicationsAccount = {
    email,
    encryptedPassword,
    salt: crypto.getRandomValues(new Uint8Array(16)).toString(),
  };
  await saveSettings(s);
}

/**
 * Get decrypted application account credentials.
 * Requires the user's passphrase to decrypt.
 */
export async function getAppAccount(passphrase: string): Promise<{ email: string; password: string } | null> {
  const s = await loadSettings();
  if (!s.applicationsAccount) return null;
  try {
    const password = await decrypt(s.applicationsAccount.encryptedPassword, passphrase);
    return { email: s.applicationsAccount.email, password };
  } catch {
    return null; // Wrong passphrase
  }
}

export async function clearAppAccount(): Promise<void> {
  const s = await loadSettings();
  s.applicationsAccount = null;
  await saveSettings(s);
}

export async function getAppAccountEmail(): Promise<string | null> {
  const s = await loadSettings();
  return s.applicationsAccount?.email || null;
}

/** Check if credits are unlimited (always true in this implementation) */
export async function checkCredits(): Promise<{ unlimited: boolean; remaining: number }> {
  const s = await loadSettings();
  return { unlimited: s.creditsUnlimited, remaining: Infinity };
}
