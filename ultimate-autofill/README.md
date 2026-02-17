# Ultimate Autofill

A production-grade Chrome extension (MV3) that autofills job application forms across major ATS platforms. Fully offline, never auto-submits, and always user-controlled.

## Supported ATS Platforms

| Platform | Status | Detection |
|---|---|---|
| Workday | Adapter + detection | URL + `data-automation-id` |
| Greenhouse | Adapter + detection | URL + `#greenhouse_application` |
| Lever | Detection | URL + DOM signatures |
| SmartRecruiters | Detection | URL + DOM |
| iCIMS | Detection | URL + DOM |
| Taleo | Detection | URL + DOM + meta |
| Ashby | Detection | URL + DOM |
| BambooHR | Detection | URL + DOM |
| Generic / Custom | Fallback adapter | Heuristic field matching |

## Features

### Autofill Engine
- Detects and fills: `input`, `textarea`, `select`, radio/checkbox, custom widgets (React Select, MUI, Workday comboboxes)
- Multi-signal field matching: label text, aria-label, placeholder, name/id, autocomplete, role, nearby DOM text
- MutationObserver for dynamic pages (SPA step forms)
- Scoring-based deterministic matcher with debug output explaining why each field was matched

### Saved Responses
- Import/export JSON compatible with SpeedyApply `responses.json` format
- Each entry: `{ id, key, keywords, question, response, appearances, fromAutofill }`
- Optional fields: `tags`, `lastUsedAt`, `createdAt`, `updatedAt`, `domains`, `atsTypes`
- Multiple libraries/profiles (e.g., Ireland / UK / US), domain-based switching
- Encrypted export/import (AES-256-GCM with PBKDF2 passphrase)
- De-duplicate suggestions via fuzzy matching
- Content-script overlay: top 3 suggested responses for any textarea/question field
- Offline hybrid matching: normalization + token overlap + Levenshtein distance

### Job Queue
- Import CSV with `url` / `job_url` / `link` column (case-insensitive)
- Optional columns: `company`, `role`, `priority`, `notes`
- URL validation (HTTPS only) and de-duplication
- Queue dashboard with statuses: Not Started / Opened / Prefilled / Needs Input / Blocked / Completed
- Export queue as CSV

## Safety / Compliance

- **Never auto-submits** — the extension fills fields but never clicks "Submit Application"
- **Never bypasses** rate limits, CAPTCHAs, login walls, bot protections, or any platform ToS
- **Stops immediately** if it encounters login walls or bot protections, marks the job as "Blocked"
- **No external API calls** — fully offline. Any future API integrations must be BYO-key and opt-in
- **User controls everything** — autofill only starts when user clicks "Start", with a prominent "Stop" button always visible
- **Sensitive values redacted** in logs by default

## Project Structure

```
ultimate-autofill/
├── src/
│   ├── manifest.json          # MV3 manifest
│   ├── types/index.ts         # TypeScript type definitions
│   ├── utils/
│   │   ├── helpers.ts         # CSV parser, URL validation, UUID, etc.
│   │   ├── fuzzy.ts           # Fuzzy matching (Levenshtein, token overlap)
│   │   └── crypto.ts          # AES-GCM encrypt/decrypt
│   ├── savedResponses/
│   │   ├── storage.ts         # chrome.storage CRUD, import/export
│   │   └── matcher.ts         # Scoring engine for response matching
│   ├── fieldMatcher/index.ts  # Multi-signal field detection and matching
│   ├── atsDetector/index.ts   # ATS type detection from URL/DOM/meta
│   ├── adapters/
│   │   ├── index.ts           # Adapter registry
│   │   ├── workday/index.ts   # Workday-specific filling
│   │   ├── greenhouse/index.ts# Greenhouse-specific filling
│   │   └── generic/index.ts   # Generic fallback adapter
│   ├── jobQueue/storage.ts    # Job queue CRUD, CSV parsing
│   ├── background/
│   │   └── serviceWorker.ts   # MV3 service worker (message hub)
│   ├── content/
│   │   ├── main.ts            # Content script (autofill orchestrator)
│   │   └── overlay.ts         # Shadow DOM overlay (reserved)
│   └── ui/
│       ├── popup/popup.ts     # Popup UI logic
│       └── options/options.ts # Options page (responses, queue, settings)
├── public/
│   ├── html/
│   │   ├── popup.html
│   │   └── options.html
│   ├── content.css            # Overlay and control bar styles
│   └── icons/                 # Extension icons
├── tests/
│   ├── setup.ts               # Chrome API mocks
│   ├── fixtures/responses.json# Canonical response data
│   ├── unit/
│   │   ├── savedResponses.test.ts
│   │   ├── csv.test.ts
│   │   ├── fuzzy.test.ts
│   │   └── fieldMatcher.test.ts
│   └── adapters/
│       ├── workday.test.ts
│       └── greenhouse.test.ts
├── package.json
├── tsconfig.json
├── jest.config.js
└── build.mjs                  # esbuild bundler
```

## Install (Developer)

```bash
cd ultimate-autofill
npm install
npm run build
```

Then load `ultimate-autofill/dist/` as an unpacked extension in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

### Watch mode

```bash
npm run watch
```

### Run tests

```bash
npm test
```

### Type checking

```bash
npm run typecheck
```

## Permissions Explained

| Permission | Why |
|---|---|
| `storage` | Store saved responses and job queue locally |
| `tabs` | Open job URLs, detect current page for ATS |
| `activeTab` | Read current tab URL and inject content script |
| `scripting` | Inject autofill scripts into job application pages |

Host permissions are **optional** — the extension requests access only when needed for specific ATS domains.

## Browser Compatibility

- **Chrome 116+** (MV3 required)
- **Edge** (Chromium-based, works as-is)
- **Brave** (Chromium-based, works as-is)
- **Firefox**: MV3 support is evolving. Key differences:
  - Use `browser.*` namespace (or polyfill)
  - `service_worker` → `scripts` in `background`
  - Some APIs differ (e.g., `chrome.scripting`)

## Known Limitations

- Never submits applications automatically
- Cannot bypass CAPTCHAs, login walls, or bot protections
- Custom React/MUI select widgets may not work on all sites (best-effort)
- Shadow DOM filling is best-effort
- iframes from different origins cannot be accessed (browser security)
- Icons are placeholders — replace with your own design

## Migration Notes (from reference extensions)

The following reference extensions were analyzed but **no code was directly copied**:

- **LazyApply Job Application Bot** (v0.8.90): jQuery-based, 45+ site-specific bundle files. Architecture was used as reference for understanding ATS field patterns (data-automation-id for Workday, field naming conventions). The bundled approach was rejected in favor of clean TypeScript modules.

- **SpeedyApply Job Application Autofill Tool** (v2.21.1): Modern chunked architecture. The `responses.json` format (`{ id, key, keywords, question, response, appearances, fromAutofill }`) was adopted as the canonical data format for import/export compatibility.

- **OptimHire Job Auto-Applier** (v2.2.5): Plasmo-built. The job queue / tracker concept was referenced for the Job Queue feature. The side panel approach was noted but not used (popup + options page preferred for broader compatibility).

All code in `ultimate-autofill/` is freshly written TypeScript.
