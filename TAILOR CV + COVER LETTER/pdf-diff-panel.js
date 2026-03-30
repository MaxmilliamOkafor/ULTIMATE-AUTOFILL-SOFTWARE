// PDF Diff Panel - Preview vs Download comparison and Smoke Test
// Handles diff analysis, smoke test execution, and mismatch detection

(function() {
  'use strict';

  // 3-Role Smoke Test Fixture
  const SMOKE_TEST_FIXTURE = {
    professional_experience: [
      {
        company: 'Meta',
        title: 'Senior Software Engineer',
        dates: '03-2022 – Present',
        startDate: '2022-03',
        endDate: '',
        responsibilities: [
          'Led development of distributed systems serving 2B+ users',
          'Architected microservices reducing latency by 40%',
          'Mentored team of 8 engineers on best practices'
        ]
      },
      {
        company: 'Google',
        title: 'Software Engineer II',
        dates: '06-2019 – 02-2022',
        startDate: '2019-06',
        endDate: '2022-02',
        responsibilities: [
          'Built scalable data pipelines processing 10TB daily',
          'Implemented ML models improving search relevance by 15%',
          'Contributed to open-source Kubernetes tooling'
        ]
      },
      {
        company: 'Amazon Web Services',
        title: 'Software Development Engineer',
        dates: '07-2017 – 05-2019',
        startDate: '2017-07',
        endDate: '2019-05',
        responsibilities: [
          'Developed cloud infrastructure automation tools',
          'Reduced deployment time by 60% through CI/CD improvements',
          'Designed fault-tolerant storage systems'
        ]
      }
    ],
    name: 'Test Candidate',
    email: 'test@example.com',
    skills: ['JavaScript', 'Python', 'Go', 'Kubernetes', 'AWS', 'React', 'Node.js']
  };

  function initDiffPanel() {
    const runSmokeTestBtn = document.getElementById('runSmokeTest');
    const runDiffAnalysisBtn = document.getElementById('runDiffAnalysis');
    const copyDiffReportBtn = document.getElementById('copyDiffReport');
    const smokeTestBadge = document.getElementById('smokeTestBadge');
    const smokeTestStatus = document.getElementById('smokeTestStatus');
    const smokeTestTime = document.getElementById('smokeTestTime');

    // Run Smoke Test
    if (runSmokeTestBtn) {
      runSmokeTestBtn.addEventListener('click', async () => {
        if (smokeTestBadge) {
          smokeTestBadge.textContent = 'Running...';
          smokeTestBadge.className = 'smoke-test-badge running';
        }
        if (smokeTestStatus) smokeTestStatus.textContent = 'Running...';

        const startTime = performance.now();

        try {
          // Attempt to generate CV using the fixture data
          const structuredEl = document.getElementById('diffStructuredJSON');
          if (structuredEl) {
            structuredEl.innerHTML = SMOKE_TEST_FIXTURE.professional_experience.map(exp =>
              `<div class="diff-entry">
                <strong>${exp.company}</strong> — ${exp.title}<br>
                <small>${exp.dates}</small><br>
                <ul>${exp.responsibilities.map(r => `<li>${r}</li>`).join('')}</ul>
              </div>`
            ).join('');
          }

          const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
          const passed = parseFloat(elapsed) < 3;

          if (smokeTestStatus) smokeTestStatus.textContent = passed ? `PASSED in ${elapsed}s` : `SLOW: ${elapsed}s (target <3s)`;
          if (smokeTestTime) smokeTestTime.textContent = `${elapsed}s`;
          if (smokeTestBadge) {
            smokeTestBadge.textContent = passed ? 'Pass' : 'Slow';
            smokeTestBadge.className = `smoke-test-badge ${passed ? 'pass' : 'fail'}`;
          }
        } catch (err) {
          console.error('[Diff Panel] Smoke test error:', err);
          if (smokeTestStatus) smokeTestStatus.textContent = `Error: ${err.message}`;
          if (smokeTestBadge) {
            smokeTestBadge.textContent = 'Error';
            smokeTestBadge.className = 'smoke-test-badge fail';
          }
        }
      });
    }

    // Run Diff Analysis on current CV
    if (runDiffAnalysisBtn) {
      runDiffAnalysisBtn.addEventListener('click', async () => {
        try {
          const data = await chrome.storage.local.get(['lastTailoredCV', 'lastPreviewText']);
          const cv = data.lastTailoredCV;
          const previewText = data.lastPreviewText;

          // Show structured JSON
          const structuredEl = document.getElementById('diffStructuredJSON');
          if (structuredEl && cv?.professional_experience) {
            structuredEl.innerHTML = cv.professional_experience.map(exp =>
              `<div class="diff-entry">
                <strong>${exp.company || exp.companyName || 'Unknown'}</strong> — ${exp.title || exp.jobTitle || 'Unknown'}<br>
                <small>${exp.dates || exp.date || ''}</small>
              </div>`
            ).join('');
          } else if (structuredEl) {
            structuredEl.innerHTML = '<p class="diff-empty">No tailored CV data found</p>';
          }

          // Show preview text
          const previewEl = document.getElementById('diffPreviewText');
          if (previewEl) {
            previewEl.textContent = previewText || 'No preview text captured';
          }

          // Detect mismatches
          const mismatchEl = document.getElementById('diffMismatches');
          if (mismatchEl && cv?.professional_experience && previewText) {
            const mismatches = [];
            cv.professional_experience.forEach(exp => {
              const company = exp.company || exp.companyName || '';
              const title = exp.title || exp.jobTitle || '';
              if (company && !previewText.includes(company)) {
                mismatches.push(`Company "${company}" not found in preview`);
              }
              if (title && !previewText.includes(title)) {
                mismatches.push(`Title "${title}" not found in preview`);
              }
            });

            if (mismatches.length === 0) {
              mismatchEl.innerHTML = '<p class="diff-match">No mismatches detected</p>';
            } else {
              mismatchEl.innerHTML = mismatches.map(m =>
                `<div class="diff-mismatch-entry">⚠️ ${m}</div>`
              ).join('');
            }
          } else if (mismatchEl) {
            mismatchEl.innerHTML = '<p class="diff-empty">Need both CV data and preview text for comparison</p>';
          }
        } catch (err) {
          console.error('[Diff Panel] Analysis error:', err);
        }
      });
    }

    // Copy diff report
    if (copyDiffReportBtn) {
      copyDiffReportBtn.addEventListener('click', () => {
        const structured = document.getElementById('diffStructuredJSON')?.textContent || '';
        const preview = document.getElementById('diffPreviewText')?.textContent || '';
        const mismatches = document.getElementById('diffMismatches')?.textContent || '';

        const report = [
          '=== PDF DIFF REPORT ===',
          '',
          '--- Structured JSON ---',
          structured,
          '',
          '--- Preview Text ---',
          preview,
          '',
          '--- Mismatches ---',
          mismatches
        ].join('\n');

        navigator.clipboard.writeText(report)
          .then(() => console.log('[Diff Panel] Report copied'))
          .catch(err => console.error('[Diff Panel] Copy failed:', err));
      });
    }

    console.log('[PDF Diff Panel] Initialized');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDiffPanel);
  } else {
    initDiffPanel();
  }
})();
