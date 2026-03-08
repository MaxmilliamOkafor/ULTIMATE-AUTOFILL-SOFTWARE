/* JobWizard AI — Popup Controller */
(function () {
  'use strict';

  const st = {
    get: k => new Promise(r => chrome.storage.local.get(k, d => r(d[k]))),
    set: (k, v) => new Promise(r => chrome.storage.local.set({ [k]: v }, r)),
    getAll: keys => new Promise(r => chrome.storage.local.get(keys, d => r(d)))
  };

  // Tab switching
  document.querySelectorAll('.jw-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.jw-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.jw-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  // Fill This Page Now
  document.getElementById('btn-fill-now').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'jw_fill_now' });
      window.close();
    }
  });

  // Quick Answer
  document.getElementById('btn-quick-answer').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'jw_quick_answer' });
      window.close();
    }
  });

  // Add This Page to Queue
  document.getElementById('btn-add-queue').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const queue = (await st.get('jw_queue')) || [];
      if (!queue.find(q => q.url === tab.url)) {
        queue.push({ url: tab.url, title: tab.title, status: 'pending', addedAt: Date.now() });
        await st.set('jw_queue', queue);
      }
      refreshQueue();
      refreshStats();
    }
  });

  // Start Auto-Apply Queue
  document.getElementById('btn-start-queue').addEventListener('click', async () => {
    chrome.runtime.sendMessage({ action: 'jw_start_queue' });
    window.close();
  });

  // Clear Queue
  document.getElementById('btn-clear-queue').addEventListener('click', async () => {
    await st.set('jw_queue', []);
    refreshQueue();
    refreshStats();
  });

  // CSV Import
  document.getElementById('btn-import-csv').addEventListener('click', () => {
    document.getElementById('csv-file').click();
  });

  document.getElementById('csv-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { alert('CSV must have a header row and at least one data row'); return; }

    const header = lines[0].split(/[,\t;|]/).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const urlCol = header.findIndex(h => /^(url|link|job_url|job_link|apply_url|application_url|href)$/.test(h));
    const titleCol = header.findIndex(h => /^(title|job_title|position|role)$/.test(h));

    if (urlCol === -1) { alert('No URL column found. CSV needs a header named: url, link, job_url, apply_url'); return; }

    const queue = (await st.get('jw_queue')) || [];
    const existingUrls = new Set(queue.map(q => q.url));
    let added = 0;

    const preview = document.getElementById('csv-preview');
    preview.innerHTML = '';

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/[,\t;|]/).map(c => c.trim().replace(/^['"]|['"]$/g, ''));
      const url = cols[urlCol];
      if (!url || !url.startsWith('http')) continue;
      if (existingUrls.has(url)) continue;

      const title = titleCol >= 0 ? cols[titleCol] : url;
      queue.push({ url, title: title || url, status: 'pending', addedAt: Date.now(), fromCSV: true });
      existingUrls.add(url);
      added++;
      preview.innerHTML += `<div>${added}. ${title || url}</div>`;
    }

    await st.set('jw_queue', queue);
    alert(`Imported ${added} job URLs to queue`);
    refreshQueue();
    refreshStats();

    if (document.getElementById('csv-auto-apply').checked && added > 0) {
      chrome.runtime.sendMessage({ action: 'jw_start_queue' });
    }
  });

  // Import responses.json
  document.getElementById('btn-import-responses').addEventListener('click', () => {
    document.getElementById('responses-file').click();
  });

  document.getElementById('responses-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      await st.set('jw_responses', data);
      // Also build a lookup
      const lookup = {};
      if (Array.isArray(data)) {
        data.forEach(entry => {
          if (entry.key && entry.response) lookup[entry.key] = entry.response;
          if (entry.keywords && entry.response) {
            const k = entry.keywords.sort().join('|');
            lookup[k] = entry.response;
          }
        });
      }
      await st.set('jw_responses_lookup', lookup);
      alert(`Imported ${Array.isArray(data) ? data.length : 0} responses`);
    } catch (err) {
      alert('Invalid JSON file: ' + err.message);
    }
  });

  // Save Settings
  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const profile = {
      firstName: document.getElementById('set-firstname').value,
      lastName: document.getElementById('set-lastname').value,
      email: document.getElementById('set-email').value,
      phone: document.getElementById('set-phone').value,
      school: document.getElementById('set-school').value,
      degree: document.getElementById('set-degree').value,
      major: document.getElementById('set-major').value,
      graduationYear: document.getElementById('set-gradyear').value,
      eduStartDate: document.getElementById('set-edu-start').value,
      eduEndDate: document.getElementById('set-edu-end').value,
      gpa: document.getElementById('set-gpa').value,
      linkedin: document.getElementById('set-linkedin').value,
      dateFormat: document.getElementById('set-date-format').value
    };
    await st.set('jw_profile', profile);
    alert('Settings saved!');
  });

  // Load Settings
  async function loadSettings() {
    const p = (await st.get('jw_profile')) || {};
    document.getElementById('set-firstname').value = p.firstName || '';
    document.getElementById('set-lastname').value = p.lastName || '';
    document.getElementById('set-email').value = p.email || '';
    document.getElementById('set-phone').value = p.phone || '';
    document.getElementById('set-school').value = p.school || '';
    document.getElementById('set-degree').value = p.degree || '';
    document.getElementById('set-major').value = p.major || '';
    document.getElementById('set-gradyear').value = p.graduationYear || '';
    document.getElementById('set-edu-start').value = p.eduStartDate || '';
    document.getElementById('set-edu-end').value = p.eduEndDate || '';
    document.getElementById('set-gpa').value = p.gpa || '';
    document.getElementById('set-linkedin').value = p.linkedin || '';
    document.getElementById('set-date-format').value = p.dateFormat || 'auto';
  }

  // Refresh Queue Display
  async function refreshQueue() {
    const queue = (await st.get('jw_queue')) || [];
    const list = document.getElementById('queue-list');
    if (queue.length === 0) {
      list.innerHTML = '<p class="jw-empty">No jobs in queue. Add pages or import CSV.</p>';
      return;
    }
    list.innerHTML = queue.map((q, i) => `
      <div class="jw-queue-item">
        <span class="jw-qi-status jw-qi-${q.status}">${q.status}</span>
        <span class="jw-qi-url" title="${q.url}">${q.title || q.url}</span>
        <button class="jw-qi-remove" data-idx="${i}">&times;</button>
      </div>
    `).join('');

    list.querySelectorAll('.jw-qi-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.idx);
        const q = (await st.get('jw_queue')) || [];
        q.splice(idx, 1);
        await st.set('jw_queue', q);
        refreshQueue();
        refreshStats();
      });
    });
  }

  // Refresh Stats
  async function refreshStats() {
    const stats = (await st.get('jw_stats')) || { filled: 0, pages: 0 };
    const queue = (await st.get('jw_queue')) || [];
    document.getElementById('stat-filled').textContent = stats.filled || 0;
    document.getElementById('stat-pages').textContent = stats.pages || 0;
    document.getElementById('stat-queue').textContent = queue.length;
  }

  // Init
  loadSettings();
  refreshQueue();
  refreshStats();
})();
