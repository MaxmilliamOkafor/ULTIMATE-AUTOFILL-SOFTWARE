/* ═══════════════════════════════════════════════════════════════
 * OptimHire Sidepanel Patch v2.2.8 — Simplified
 * 
 * With the duplicate purple panel removed, this patch now only:
 * 1. Hides referral/affiliate UI elements
 * 2. Manages the auto-trigger toggle
 * 3. Responds to IS_PANEL_OPEN pings
 * 
 * All auto-apply progress is shown by OptimHire's native React UI
 * via the autoApplyState storage key.
 * ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const ST = chrome.storage.local;

  /* ── 1. Hide referral / affiliate elements via MutationObserver ── */
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

  /* ── 2. Auto-trigger toggle ── */
  const toggle = document.getElementById('oh-auto-trigger-toggle');
  if (toggle) {
    // Load persisted state
    ST.get('ohAutoTrigger').then(data => {
      const enabled = data.ohAutoTrigger !== false; // default on
      toggle.classList.toggle('active', enabled);
    });

    toggle.addEventListener('click', async () => {
      const nowActive = !toggle.classList.contains('active');
      toggle.classList.toggle('active', nowActive);
      await ST.set({ ohAutoTrigger: nowActive });
    });
  }

  /* ── 3. Respond to IS_PANEL_OPEN pings from background ── */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'IS_PANEL_OPEN') {
      sendResponse({ is_panel_open: true });
      return true;
    }
    if (msg?.type === 'SIDE_PANEL_RELOAD' || msg?.type === 'SIDE_PANEL_MANUAL_RELOAD') {
      // Reload to pick up fresh React state
      location.reload();
      return true;
    }
  });

  console.log('[OH-SidepanelPatch v2.2.8] Loaded (simplified — native UI handles progress)');
})();
