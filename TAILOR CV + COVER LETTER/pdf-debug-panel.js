// PDF Generation Debug Panel - UI wiring for the PDF debug panel in popup.html
// Handles debug data display, source data modal, and debug log actions

(function() {
  'use strict';

  // Wait for DOM to be ready
  function initPdfDebugPanel() {
    // Debug panel elements
    const pdfDebugPanel = document.getElementById('pdfDebugPanel');
    const pdfDebugBadge = document.getElementById('pdfDebugBadge');
    const viewSourceDataBtn = document.getElementById('viewSourceData');
    const copyDebugDataBtn = document.getElementById('copyDebugData');
    const clearDebugLogBtn = document.getElementById('clearDebugLog');
    const testPdfDownloadBtn = document.getElementById('testPdfDownload');
    const sourceDataModal = document.getElementById('sourceDataModal');
    const closeSourceModalBtn = document.getElementById('closeSourceModal');
    const copySourceDataBtn = document.getElementById('copySourceData');
    const sourceDataJSON = document.getElementById('sourceDataJSON');
    const debugErrorLog = document.getElementById('debugErrorLog');

    // View Source Data button - shows the source data modal
    if (viewSourceDataBtn) {
      viewSourceDataBtn.addEventListener('click', async () => {
        try {
          const data = await chrome.storage.local.get(['lastTailoredCV', 'parsedProfile']);
          const sourceData = data.lastTailoredCV || data.parsedProfile || {};
          if (sourceDataJSON) {
            sourceDataJSON.textContent = JSON.stringify(sourceData.professional_experience || sourceData, null, 2);
          }
          if (sourceDataModal) {
            sourceDataModal.classList.remove('hidden');
            sourceDataModal.style.display = '';
          }
        } catch (err) {
          console.error('[PDF Debug] Error loading source data:', err);
        }
      });
    }

    // Close source data modal
    if (closeSourceModalBtn) {
      closeSourceModalBtn.addEventListener('click', () => {
        if (sourceDataModal) {
          sourceDataModal.classList.add('hidden');
          sourceDataModal.style.display = 'none';
        }
      });
    }

    // Copy debug data to clipboard
    if (copyDebugDataBtn) {
      copyDebugDataBtn.addEventListener('click', () => {
        const debugData = {
          status: document.getElementById('pdfGenStatus')?.textContent || '—',
          generator: document.getElementById('pdfGenGenerator')?.textContent || '—',
          time: document.getElementById('pdfGenTime')?.textContent || '—',
          size: document.getElementById('pdfGenSize')?.textContent || '—',
          candidateName: document.getElementById('debugCandidateName')?.textContent || '—',
          expCount: document.getElementById('debugExpCount')?.textContent || '—',
          eduCount: document.getElementById('debugEduCount')?.textContent || '—',
          skillsCount: document.getElementById('debugSkillsCount')?.textContent || '—',
          cvLength: document.getElementById('debugCVLength')?.textContent || '—',
          errors: debugErrorLog?.textContent || 'No errors'
        };
        navigator.clipboard.writeText(JSON.stringify(debugData, null, 2))
          .then(() => console.log('[PDF Debug] Debug data copied'))
          .catch(err => console.error('[PDF Debug] Copy failed:', err));
      });
    }

    // Copy source data JSON
    if (copySourceDataBtn) {
      copySourceDataBtn.addEventListener('click', () => {
        const text = sourceDataJSON?.textContent || '';
        navigator.clipboard.writeText(text)
          .then(() => console.log('[PDF Debug] Source data copied'))
          .catch(err => console.error('[PDF Debug] Copy failed:', err));
      });
    }

    // Clear debug log
    if (clearDebugLogBtn) {
      clearDebugLogBtn.addEventListener('click', () => {
        if (debugErrorLog) {
          debugErrorLog.innerHTML = '<p class="debug-empty">No errors</p>';
        }
        // Reset status fields
        const fields = ['pdfGenStatus', 'pdfGenGenerator', 'pdfGenTime', 'pdfGenSize',
          'debugCandidateName', 'debugExpCount', 'debugEduCount', 'debugSkillsCount',
          'debugCVLength', 'debugSummaryLen', 'debugExpLen', 'debugEduLen',
          'debugSkillsLen', 'debugCertsLen', 'debugCVPdfLen', 'debugCoverPdfLen',
          'debugCVFilename', 'debugCoverFilename'];
        fields.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.textContent = '—';
        });
        if (pdfDebugBadge) pdfDebugBadge.textContent = 'Idle';
        const debugExpList = document.getElementById('debugExpList');
        if (debugExpList) {
          debugExpList.innerHTML = '<p class="debug-empty">Generate a CV to see experience data</p>';
        }
      });
    }

    // Test PDF download
    if (testPdfDownloadBtn) {
      testPdfDownloadBtn.addEventListener('click', async () => {
        try {
          const data = await chrome.storage.local.get(['lastGeneratedCVPdf']);
          if (data.lastGeneratedCVPdf) {
            const link = document.createElement('a');
            link.href = data.lastGeneratedCVPdf;
            link.download = 'test-cv-download.pdf';
            link.click();
          } else {
            console.warn('[PDF Debug] No PDF data available for test download');
          }
        } catch (err) {
          console.error('[PDF Debug] Test download error:', err);
        }
      });
    }

    console.log('[PDF Debug Panel] Initialized');
  }

  // Expose update function globally for popup.js to call
  window.updatePdfDebugPanel = function(data) {
    if (!data) return;
    const setField = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || '—';
    };

    setField('pdfGenStatus', data.status);
    setField('pdfGenGenerator', data.generator);
    setField('pdfGenTime', data.time);
    setField('pdfGenSize', data.size);
    setField('debugCandidateName', data.candidateName);
    setField('debugExpCount', data.expCount);
    setField('debugEduCount', data.eduCount);
    setField('debugSkillsCount', data.skillsCount);
    setField('debugCVLength', data.cvLength);
    setField('debugSummaryLen', data.summaryLen);
    setField('debugExpLen', data.expLen);
    setField('debugEduLen', data.eduLen);
    setField('debugSkillsLen', data.skillsLen);
    setField('debugCertsLen', data.certsLen);
    setField('debugCVPdfLen', data.cvPdfLen);
    setField('debugCoverPdfLen', data.coverPdfLen);
    setField('debugCVFilename', data.cvFilename);
    setField('debugCoverFilename', data.coverFilename);

    const badge = document.getElementById('pdfDebugBadge');
    if (badge) badge.textContent = data.status || 'Idle';

    // Update experience list
    if (data.experiences && Array.isArray(data.experiences)) {
      const listEl = document.getElementById('debugExpList');
      if (listEl) {
        listEl.innerHTML = data.experiences.map(exp =>
          `<div class="debug-exp-item">
            <strong>${exp.company || 'Unknown'}</strong> — ${exp.title || 'Unknown'}
            <br><small>${exp.dates || ''}</small>
          </div>`
        ).join('');
      }
    }

    // Update error log
    if (data.errors && data.errors.length > 0) {
      const logEl = document.getElementById('debugErrorLog');
      if (logEl) {
        logEl.innerHTML = data.errors.map(e =>
          `<div class="debug-error-entry">⚠️ ${e}</div>`
        ).join('');
      }
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPdfDebugPanel);
  } else {
    initPdfDebugPanel();
  }
})();
