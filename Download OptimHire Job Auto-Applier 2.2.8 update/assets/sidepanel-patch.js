/**
 * sidepanel-patch.js — CSP-safe JS for sidepanel.html
 * Opens Auto-Apply Mode tab, shows queue stats, kills referral section.
 */
(function () {
  'use strict';

  /* ── Open Auto-Apply Mode on button click ── */
  var btn = document.getElementById('oh-csv-btn');
  if (btn) {
    btn.addEventListener('click', function () {
      chrome.tabs.create({ url: chrome.runtime.getURL('tabs/csvImport.html') });
    });
  }

  /* ── Live queue stats in bottom bar ── */
  var statsEl = document.getElementById('oh-bar-stats');
  function updateStats() {
    chrome.storage.local.get('csvJobQueue', function (data) {
      var q = data.csvJobQueue || [];
      if (!q.length) { if (statsEl) statsEl.textContent = ''; return; }
      var pending = 0, done = 0;
      q.forEach(function (j) {
        if (j.status === 'pending') pending++;
        if (j.status === 'done') done++;
      });
      if (statsEl) statsEl.textContent = pending + ' pending \u00B7 ' + done + ' applied';
    });
  }
  updateStats();
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && changes.csvJobQueue) updateStats();
  });

  /* ── Auto-trigger toggle ── */
  var toggle = document.getElementById('oh-auto-trigger-toggle');
  if (toggle) {
    /* Load saved state (default: enabled) */
    chrome.storage.local.get('ohAutoTrigger', function (data) {
      var enabled = data.ohAutoTrigger !== false;
      toggle.classList.toggle('active', enabled);
    });
    toggle.addEventListener('click', function () {
      var isActive = toggle.classList.toggle('active');
      chrome.storage.local.set({ ohAutoTrigger: isActive });
    });
  }

  /* ── MutationObserver fallback to kill referral cards React renders ── */
  if (document.body) {
    new MutationObserver(function () {
      document.querySelectorAll('h2,h3,p,span').forEach(function (el) {
        var t = el.textContent || '';
        if (t.indexOf('One Referral 3 Benefits') !== -1 ||
            t.indexOf('Get 20 Auto-fill Credits for every signup') !== -1) {
          var node = el;
          for (var i = 0; i < 8; i++) {
            if (!node.parentElement) break;
            node = node.parentElement;
            var c = node.className || '';
            if (typeof c === 'string' && (c.indexOf('bg-') !== -1 || c.indexOf('border') !== -1)) {
              node.style.cssText = 'display:none!important';
              break;
            }
          }
        }
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
