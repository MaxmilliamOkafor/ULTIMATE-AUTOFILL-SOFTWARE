// ─── Saved Responses ───

export interface SavedResponse {
  id: string;
  key: string;
  keywords: string[];
  question: string;
  response: string;
  appearances: number;
  fromAutofill: boolean;
  tags?: string[];
  lastUsedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  domains?: string[];
  atsTypes?: string[];
}

export interface ResponseLibrary {
  id: string;
  name: string;
  responses: SavedResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedResponsesState {
  libraries: ResponseLibrary[];
  activeLibraryId: string;
  domainMappings: Record<string, string>;
}

// ─── Field Matching ───

export interface FieldSignal {
  source: string;
  value: string;
  weight: number;
}

export interface FieldInfo {
  element: HTMLElement;
  type: string;
  signals: FieldSignal[];
  groupContext?: string;
}

export interface FieldMatchResult {
  field: HTMLElement;
  response: SavedResponse;
  score: number;
  signals: FieldSignal[];
  explanation: string;
}

// ─── ATS Detection ───

export type ATSType =
  | 'workday' | 'greenhouse' | 'lever' | 'smartrecruiters'
  | 'icims' | 'taleo' | 'ashby' | 'bamboohr'
  | 'oraclecloud' | 'linkedin' | 'indeed'
  | 'companysite'   // any company career site not matching a known ATS
  | 'generic';

export interface ATSDetectionResult {
  type: ATSType;
  confidence: number;
  signals: string[];
}

export interface ATSAdapter {
  type: ATSType;
  detect(doc: Document): ATSDetectionResult;
  getFields(doc: Document): FieldInfo[];
  fillField(field: HTMLElement, value: string): Promise<boolean>;
}

// ─── ATS Platform Registry ───

export interface ATSPlatformEntry {
  id: ATSType;
  name: string;
  domains: string[];
  urlPatterns: RegExp[];
  domSignals: string[];
  metaSignals: { name: string; pattern: RegExp }[];
  enabled: boolean;
  supportsAutoSubmit: boolean;
  notes?: string;
}

// ─── Job Queue ───

export type JobStatus =
  | 'not_started' | 'opened' | 'prefilled'
  | 'needs_input' | 'blocked' | 'completed'
  | 'applying' | 'applied' | 'failed' | 'skipped' | 'paused';

export interface JobQueueItem {
  id: string;
  url: string;
  normalizedUrl?: string;
  company?: string;
  role?: string;
  priority?: number;
  notes?: string;
  status: JobStatus;
  atsType?: ATSType;
  createdAt: string;
  updatedAt: string;
  blockedReason?: string;
  failReason?: string;
  retryCount?: number;
  source?: 'csv_import' | 'manual' | 'scraper' | 'one_click';
  appliedAt?: string;
}

export interface JobQueueState {
  items: JobQueueItem[];
  currentItemId: string | null;
}

// ─── Auto-Apply Settings ───

export interface AutoApplySettings {
  enabled: boolean;
  autoSubmit: boolean;
  autoSubmitPerSite: Record<string, boolean>;
  maxConcurrency: number;
  delayBetweenJobs: number;       // ms
  humanLikePacing: boolean;
  closeTabAfterApply: boolean;
  retryFailedMax: number;
  requireResumeForSubmit: boolean;
  domainAllowlist: string[];
  rateLimit: { maxPerHour: number; maxPerDay: number };
  paused: boolean;
}

// ─── Applications Account (encrypted credentials) ───

export interface ApplicationsAccount {
  email: string;
  encryptedPassword: string;   // AES-GCM encrypted, never plaintext
  salt: string;                // salt used for deriving encryption key
}

// ─── Scraper / Fresh Jobs Settings ───

export interface ScraperSettings {
  enabled: boolean;
  intervalMinutes: number;
  sources: {
    ats: boolean;
    indeed: boolean;
    linkedinNonEasyApply: boolean;
  };
  targetCountPerSession: number;
  freshnessTiers: {
    tierA: number;  // minutes - Tier A threshold (e.g., 30)
    tierB: number;  // minutes - Tier B threshold (e.g., 1440 = 24h)
    tierC: number;  // minutes - Tier C threshold (e.g., 4320 = 3d)
  };
  filters: {
    keywords: string[];
    geoRadius: number;
    location: string;
    seniority: string[];
    remoteOnly: boolean;
    hybridAllowed: boolean;
  };
}

export interface ScrapedJob {
  id: string;
  url: string;
  title?: string;
  company?: string;
  location?: string;
  postedAt?: string;
  firstSeenAt: string;
  source: 'ats' | 'indeed' | 'linkedin';
  freshnessTier: 'A' | 'B' | 'C' | 'old';
  isEasyApply?: boolean;
  status: 'new' | 'queued' | 'applied' | 'skipped';
}

// ─── Extension Settings (global) ───

export interface ExtensionSettings {
  autoApply: AutoApplySettings;
  scraper: ScraperSettings;
  tailoring: TailoringSettings;
  applicationsAccount: ApplicationsAccount | null;
  creditsUnlimited: boolean;
  autoDetectAndFill: boolean;
  universalFormDetection: boolean;   // detect ALL forms, not just known ATS
  supportedPlatforms: Record<string, boolean>;
}

// ─── Messaging ───

export type MessageType =
  | 'GET_RESPONSES' | 'SAVE_RESPONSE' | 'DELETE_RESPONSE'
  | 'IMPORT_RESPONSES' | 'EXPORT_RESPONSES'
  | 'SEARCH_RESPONSES' | 'MERGE_RESPONSES' | 'BULK_TAG'
  | 'GET_SUGGESTIONS' | 'INSERT_RESPONSE' | 'RECORD_USAGE'
  | 'GET_LIBRARIES' | 'CREATE_LIBRARY' | 'DELETE_LIBRARY'
  | 'GET_ACTIVE_LIBRARY' | 'SET_ACTIVE_LIBRARY'
  | 'START_AUTOFILL' | 'STOP_AUTOFILL' | 'DETECT_ATS'
  | 'GET_JOB_QUEUE' | 'ADD_JOB_URLS' | 'UPDATE_JOB_STATUS'
  | 'IMPORT_JOB_CSV' | 'CLEAR_JOB_QUEUE' | 'OPEN_JOB_TAB'
  | 'DELETE_RESPONSES' | 'EXPORT_ENCRYPTED' | 'IMPORT_ENCRYPTED'
  | 'GET_DOMAIN_MAPPINGS' | 'SET_DOMAIN_MAPPING' | 'REMOVE_DOMAIN_MAPPING'
  // Auto-apply pipeline
  | 'START_AUTO_APPLY' | 'STOP_AUTO_APPLY' | 'PAUSE_AUTO_APPLY' | 'RESUME_AUTO_APPLY'
  | 'GET_AUTO_APPLY_STATUS' | 'RETRY_FAILED_JOBS'
  // Settings
  | 'GET_SETTINGS' | 'SAVE_SETTINGS'
  // Applications Account
  | 'SAVE_APP_ACCOUNT' | 'GET_APP_ACCOUNT' | 'CLEAR_APP_ACCOUNT'
  // Scraper
  | 'START_SCRAPER' | 'STOP_SCRAPER' | 'GET_SCRAPED_JOBS'
  // CSV Import (enhanced)
  | 'IMPORT_CSV_DRAG_DROP' | 'GET_IMPORT_STATS'
  // Job removal
  | 'REMOVE_JOB' | 'EXPORT_JOB_RESULTS'
  // Auto-detect + fill on page
  | 'AUTO_DETECT_FILL' | 'PAGE_AUTOFILL_COMPLETE'
  // Credits
  | 'GET_CREDITS' | 'CHECK_CREDITS'
  // One-click add to queue from content script
  | 'ADD_CURRENT_PAGE_TO_QUEUE'
  // AI Tailoring
  | 'TAILOR_RESPONSE' | 'GET_TAILORING_STATUS';

export interface ExtMessage {
  type: MessageType;
  payload?: unknown;
}

export interface ExtResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface SuggestionItem {
  response: SavedResponse;
  score: number;
  explanation: string;
}

// ─── CSV Import Stats ───

export interface CSVImportStats {
  totalParsed: number;
  validUrls: number;
  invalidUrls: number;
  duplicates: number;
  added: number;
  invalidRows: Array<{ row: number; url: string; reason: string }>;
}

// ─── Auto-Apply Status ───

export interface AutoApplyStatus {
  running: boolean;
  paused: boolean;
  currentJobId: string | null;
  currentJobUrl: string | null;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  skippedJobs: number;
  startedAt: string | null;
  estimatedRemaining: number;
}

// ─── AI Tailoring ───

export interface TailoringContext {
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  requiredSkills?: string[];
  preferredSkills?: string[];
  jobLocation?: string;
  seniority?: string;
}

export interface TailoredResponse {
  originalResponse: string;
  tailoredResponse: string;
  fieldLabel: string;
  confidence: number;
  reasoning: string;
}

export interface TailoringSettings {
  enabled: boolean;
  /** How strongly to tailor (0.0 = no change, 1.0 = maximum tailoring) */
  intensity: number;
  /** Keywords to always emphasize from the user's profile */
  profileKeywords: string[];
  /** Job-specific keywords extracted from the posting to weave in */
  targetKeywords: string[];
  /** The user's summary/headline to use as tailoring context */
  profileSummary: string;
}
