/* ═══════════════════════════════════════════════════════════════
 * OptimHire Sidepanel Patch v2.2.8 — CSV Import + Unified Queue
 * 
 * 1. Hides referral/affiliate UI elements
 * 2. Manages the auto-trigger toggle
 * 3. CSV import: paste URLs / upload CSV → add to queue → start unified
 * 4. Responds to IS_PANEL_OPEN pings
 * ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const ST = chrome.storage.local;
  const CSV_QUEUE_KEY = 'csvJobQueue';

  /* ── 1. Hide referral / affiliate elements ── */
  const REFERRAL_SELS = [
    '[class*="referral"]', '[class*="Referral"]', '[id*="referral"]',
    '[data-testid*="referral"]', '[class*="affiliate"]',
    '.referral-section', '.referral-card', '.referral-banner',
    '[class*="earnCredit"]', '[class*="inviteFriend"]', '[class*="invite-friend"]',
    '[class*="ReferralScreen"]',
  ];

  function hideReferrals() {
    const combined = REFERRAL_SELS.join(',');
    document.querySelectorAll(combined).forEach(el => {
      el.style.setProperty('display', 'none', 'important');
    });
  }

  hideReferrals();
  new MutationObserver(hideReferrals).observe(document.body, {
    childList: true, subtree: true,
  });

  /* ── 1b. Intercept "Start Applying" button to check CSV jobs first ── */
  let _startBtnIntercepted = false;
  function interceptStartApplying() {
    if (_startBtnIntercepted) return;
    // Find OptimHire's "Start Applying" button (React-rendered inside #__plasmo)
    const buttons = document.querySelectorAll('#__plasmo button, #__plasmo [role="button"]');
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (text.includes('start applying') || text.includes('start auto')) {
        _startBtnIntercepted = true;
        // Add a capture-phase listener that fires BEFORE React's listener
        btn.addEventListener('click', async (e) => {
          // Check if there are pending CSV jobs in our queue
          try {
            const { csvJobQueue: q = [] } = await ST.get(CSV_QUEUE_KEY);
            const pendingCsv = q.filter(j => j.status === 'pending');
            if (pendingCsv.length > 0) {
              // CSV jobs exist — hijack: prevent OptimHire's native flow
              e.stopImmediatePropagation();
              e.preventDefault();
              console.log(`[OH-SidepanelPatch] Intercepted Start Applying — ${pendingCsv.length} CSV jobs pending, starting unified queue`);
              // Start our unified queue (CSV first → API fallback)
              chrome.runtime.sendMessage({
                type: 'START_UNIFIED_QUEUE',
                settings: { reuseTab: true, concurrency: 1 },
              }).catch(() => { });
              return false;
            }
          } catch (_) { }
          // No CSV jobs — let OptimHire's native flow proceed normally
        }, true); // <-- capture phase = fires first
        console.log('[OH-SidepanelPatch] Intercepted "Start Applying" button');
        break;
      }
    }
  }
  // React renders asynchronously — keep checking until button appears
  const _startBtnObserver = new MutationObserver(() => {
    if (!_startBtnIntercepted) interceptStartApplying();
  });
  _startBtnObserver.observe(document.body, { childList: true, subtree: true });
  // Also try immediately and after delays
  interceptStartApplying();
  setTimeout(interceptStartApplying, 1000);
  setTimeout(interceptStartApplying, 3000);

  /* ── 1c. Intercept Skip / Stop buttons to route through CSV queue ── */
  function interceptSkipStop() {
    const buttons = document.querySelectorAll('#__plasmo button, #__plasmo [role="button"]');
    for (const btn of buttons) {
      if (btn._ohSkipIntercepted) continue;
      const text = (btn.textContent || '').trim().toLowerCase();
      if (text === 'skip' || text === 'stop') {
        btn._ohSkipIntercepted = true;
        btn.addEventListener('click', async (e) => {
          // Check if our CSV queue is running
          try {
            const { csvQueueRunning } = await ST.get('csvQueueRunning');
            if (csvQueueRunning) {
              e.stopImmediatePropagation();
              e.preventDefault();
              if (text === 'skip') {
                console.log('[OH-SidepanelPatch] Skip clicked — skipping current CSV job');
                chrome.runtime.sendMessage({ type: 'SKIP_CSV_JOB' }).catch(() => { });
              } else {
                console.log('[OH-SidepanelPatch] Stop clicked — stopping CSV queue');
                chrome.runtime.sendMessage({ type: 'STOP_CSV_QUEUE' }).catch(() => { });
              }
              return false;
            }
          } catch (_) { }
          // Not our queue — let native handle it
        }, true);
      }
    }
  }
  // Keep scanning because Skip/Stop buttons appear dynamically
  new MutationObserver(interceptSkipStop).observe(document.body, { childList: true, subtree: true });
  interceptSkipStop();

  /* ── 2. Auto-trigger toggle ── */
  const toggle = document.getElementById('oh-auto-trigger-toggle');
  if (toggle) {
    ST.get('ohAutoTrigger').then(data => {
      const enabled = data.ohAutoTrigger !== false;
      toggle.classList.toggle('active', enabled);
    });
    toggle.addEventListener('click', async () => {
      const nowActive = !toggle.classList.contains('active');
      toggle.classList.toggle('active', nowActive);
      await ST.set({ ohAutoTrigger: nowActive });
    });
  }

  /* ── 3. CSV Import Section ── */
  const csvHeader = document.getElementById('csvToggleHeader');
  const csvSection = document.getElementById('csvSection');
  const csvArrow = document.getElementById('csvArrow');
  const csvBadge = document.getElementById('csvBadge');
  const csvUrls = document.getElementById('csvUrls');
  const csvFile = document.getElementById('csvFileInput');
  const csvStart = document.getElementById('csvStartBtn');
  const csvStatus = document.getElementById('csvStatus');

  // Toggle expand/collapse
  if (csvHeader && csvSection) {
    csvHeader.addEventListener('click', () => {
      const isOpen = csvSection.classList.toggle('open');
      csvHeader.classList.toggle('expanded', isOpen);
    });
  }

  // Update badge with queued count
  async function refreshBadge() {
    try {
      const { csvJobQueue: q = [] } = await ST.get(CSV_QUEUE_KEY);
      // Only count CSV-imported jobs, not API-fetched ones
      const csvJobs = q.filter(j => j.source === 'csv_import');
      const pending = csvJobs.filter(j => j.status === 'pending').length;
      const total = csvJobs.length;
      const done = csvJobs.filter(j => ['done', 'failed', 'skipped', 'duplicate'].includes(j.status)).length;
      if (csvBadge) {
        if (total > 0) {
          csvBadge.textContent = pending > 0 ? `#${done + 1} of ${total} CSV jobs` : `${total} done`;
          csvBadge.style.display = '';
        } else {
          csvBadge.style.display = 'none';
        }
      }
    } catch (_) { }
  }
  refreshBadge();

  // Parse URLs from text (one per line, or comma-separated)
  function parseUrls(text) {
    if (!text) return [];
    return text
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(s => {
        try { const u = new URL(s); return u.protocol.startsWith('http'); }
        catch (_) { return false; }
      });
  }

  // Parse CSV file content (look for URL columns)
  function parseCsvContent(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return [];
    const urls = [];
    // Try to detect header
    const header = lines[0].toLowerCase();
    let urlCol = -1;
    const cols = lines[0].split(',').map(c => c.trim().toLowerCase());
    for (let i = 0; i < cols.length; i++) {
      if (cols[i].includes('url') || cols[i].includes('link') || cols[i].includes('apply')) {
        urlCol = i; break;
      }
    }
    const startLine = (urlCol >= 0) ? 1 : 0; // skip header if found
    if (urlCol < 0) urlCol = 0; // default to first column

    for (let i = startLine; i < lines.length; i++) {
      // Handle quoted CSV fields
      const fields = lines[i].match(/(?:\"[^\"]*\"|[^,])+/g) || [];
      const raw = (fields[urlCol] || '').replace(/^"|"$/g, '').trim();
      try {
        const u = new URL(raw);
        if (u.protocol.startsWith('http')) urls.push(raw);
      } catch (_) {
        // Also try to find any URL in the entire line
        const urlMatch = lines[i].match(/https?:\/\/[^\s,\"]+/);
        if (urlMatch) urls.push(urlMatch[0]);
      }
    }
    return urls;
  }

  // File upload handler
  if (csvFile) {
    csvFile.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const urls = parseCsvContent(reader.result);
        if (urls.length > 0) {
          const existing = csvUrls.value.trim();
          csvUrls.value = (existing ? existing + '\n' : '') + urls.join('\n');
          if (csvStatus) csvStatus.innerHTML = `📄 Loaded <b>${urls.length}</b> URLs from ${file.name}`;
        } else {
          if (csvStatus) csvStatus.textContent = '⚠️ No valid URLs found in file';
        }
      };
      reader.readAsText(file);
    });
  }

  // Start button handler
  if (csvStart) {
    csvStart.addEventListener('click', async () => {
      csvStart.disabled = true;
      csvStart.textContent = '⏳ Adding...';

      try {
        const urls = parseUrls(csvUrls.value);
        if (urls.length === 0) {
          if (csvStatus) csvStatus.textContent = '⚠️ No valid URLs to add. Paste URLs above.';
          csvStart.disabled = false;
          csvStart.textContent = '⚡ Add to Queue & Start';
          return;
        }

        // Read existing queue and dedupe
        const { csvJobQueue: existing = [] } = await ST.get(CSV_QUEUE_KEY);
        const existingUrls = new Set(existing.map(j => j.url.toLowerCase().replace(/\/$/, '')));
        let added = 0;
        // Number URLs sequentially starting from next available number
        const maxExistingNum = existing.reduce((m, j) => Math.max(m, j.queueNumber || 0), 0);
        let nextNum = maxExistingNum + 1;

        // Build new jobs array (in order) then prepend all at once for correct priority
        const newJobs = [];
        for (const url of urls) {
          const normUrl = url.toLowerCase().replace(/\/$/, '');
          if (existingUrls.has(normUrl)) continue;
          existingUrls.add(normUrl);
          newJobs.push({
            id: 'csv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            url: url,
            title: '',
            company: '',
            status: 'pending',
            addedAt: Date.now(),
            source: 'csv_import',
            queueNumber: nextNum++,
          });
          added++;
        }
        // Prepend in correct order: #1 first, #2 second, etc.
        existing.unshift(...newJobs);

        await ST.set({ [CSV_QUEUE_KEY]: existing });

        if (csvStatus) {
          csvStatus.innerHTML = `✅ Added <b>${added}</b> job${added !== 1 ? 's' : ''} to queue` +
            (urls.length - added > 0 ? ` (${urls.length - added} duplicates skipped)` : '');
        }

        // Clear textarea
        csvUrls.value = '';
        refreshBadge();

        // Start unified queue (CSV first → OptimHire API fallback)
        if (added > 0) {
          chrome.runtime.sendMessage({
            type: 'START_UNIFIED_QUEUE',
            settings: { reuseTab: true, concurrency: 1 },
          }).catch(() => { });
          if (csvStatus) csvStatus.innerHTML += '<br>🚀 <b>Automation started!</b> CSV jobs will run first.';
        }
      } catch (err) {
        if (csvStatus) csvStatus.textContent = '❌ Error: ' + err.message;
      }

      csvStart.disabled = false;
      csvStart.textContent = '⚡ Add to Queue & Start';
    });
  }

  /* ── 4. Listen for queue updates to refresh badge ── */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'IS_PANEL_OPEN') {
      sendResponse({ is_panel_open: true });
      return true;
    }
    if (msg?.type === 'SIDE_PANEL_RELOAD' || msg?.type === 'SIDE_PANEL_MANUAL_RELOAD') {
      location.reload();
      return true;
    }
    if (msg?.type === 'CSV_QUEUE_UPDATED' || msg?.type === 'CSV_JOB_COMPLETE'
      || msg?.type === 'CSV_QUEUE_DONE') {
      refreshBadge();
    }
  });

  // Periodic badge refresh
  setInterval(refreshBadge, 5000);

  console.log('[OH-SidepanelPatch v2.2.8] Loaded (CSV import + unified queue)');
})();
