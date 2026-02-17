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
  | 'icims' | 'taleo' | 'ashby' | 'bamboohr' | 'generic';

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
  | 'GET_DOMAIN_MAPPINGS' | 'SET_DOMAIN_MAPPING' | 'REMOVE_DOMAIN_MAPPING';

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
