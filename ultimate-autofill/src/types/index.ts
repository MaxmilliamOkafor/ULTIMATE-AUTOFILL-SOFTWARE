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
  | 'icims' | 'taleo' | 'ashby' | 'bamboohr' | 'generic'
  | 'indeed' | 'linkedin' | 'hiringcafe' | 'jobvite' | 'workable'
  | 'paylocity' | 'jazzhr' | 'ziprecruiter' | 'dice' | 'ukg';

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

// ─── Job Queue ───

export type JobStatus =
  | 'not_started' | 'opened' | 'prefilled'
  | 'needs_input' | 'blocked' | 'completed';

export interface JobQueueItem {
  id: string;
  url: string;
  company?: string;
  role?: string;
  priority?: number;
  notes?: string;
  status: JobStatus;
  atsType?: ATSType;
  createdAt: string;
  updatedAt: string;
  blockedReason?: string;
}

export interface JobQueueState {
  items: JobQueueItem[];
  currentItemId: string | null;
}

// ─── Enhanced Adapter Interface (for unified autofill engine) ───

export interface FieldResult {
  label: string;
  value: string;
  status: 'filled' | 'skipped' | 'failed';
}

export interface AdapterResult {
  fields: FieldResult[];
  success: boolean;
  atsName: string;
}

export interface AtsAdapter {
  name: string;
  detect: () => boolean;
  fill: (responses?: Array<{ question: string; answer: string }>) => Promise<AdapterResult>;
}

// ─── CSV Queue ───

export type CsvJobStatus =
  | 'pending' | 'running' | 'done' | 'failed' | 'skipped' | 'duplicate';

export interface CsvJobItem {
  id: string;
  url: string;
  title?: string;
  company?: string;
  status: CsvJobStatus;
  addedAt: number;
  startedAt?: number;
  finishedAt?: number;
  lastError?: string;
  attempts?: number;
  source?: string;
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
  | 'TRIGGER_AUTOFILL' | 'START_CSV_QUEUE' | 'STOP_CSV_QUEUE'
  | 'PAUSE_CSV_QUEUE' | 'RESUME_CSV_QUEUE' | 'SKIP_CSV_JOB'
  | 'CSV_JOB_COMPLETE' | 'CSV_JOB_STARTED' | 'CSV_QUEUE_DONE'
  | 'AUTOFILL_COMPLETE' | 'AUTOFILL_PROGRESS'
  | 'SIDEBAR_STATUS' | 'SIDEBAR_FIELD_UPDATE' | 'SIDEBAR_FIELD_LIST'
  | 'TRIGGER_TAILORING' | 'COMPLEX_FORM_SUCCESS' | 'COMPLEX_FORM_ERROR'
  | 'FILL_COMPLEX_FORM' | 'PING' | 'SOLVE_CAPTCHA';

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
