import type { ExtMessage, ExtResponse, AutoApplyStatus } from '../../types/index';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function send(msg: ExtMessage): Promise<ExtResponse> {
  return chrome.runtime.sendMessage(msg);
}

let autoApplyPolling: ReturnType<typeof setInterval> | null = null;

async function init() {
  // Load response count
  const rr = await send({ type: 'GET_RESPONSES' });
  if (rr?.ok && Array.isArray(rr.data)) {
    $('respCount').textContent = `${rr.data.length} responses`;
  }

  // Load queue count
  const qr = await send({ type: 'GET_JOB_QUEUE' });
  if (qr?.ok && Array.isArray(qr.data)) {
    $('queueCount').textContent = String(qr.data.length);
    const applied = qr.data.filter((j: any) => j.status === 'applied' || j.status === 'completed').length;
    $('appliedCount').textContent = String(applied);
  }

  // Load credits (always unlimited)
  const cr = await send({ type: 'CHECK_CREDITS' });
  if (cr?.ok && cr.data) {
    const d = cr.data as { unlimited: boolean; remaining: number };
    $('creditsDisplay').textContent = d.unlimited ? 'Unlimited' : `${d.remaining} credits`;
  }

  // Detect ATS on current page
  try {
    const ats = await send({ type: 'DETECT_ATS' });
    if (ats?.ok && ats.data) {
      const d = ats.data as { type: string; confidence: number };
      if (d.type !== 'generic' && d.confidence > 0.3) {
        const info = $('atsInfo');
        info.style.display = 'block';
        const atsLabel = d.type === 'companysite' ? 'Company Career Site' : d.type;
        info.textContent = `Detected: ${atsLabel} (${(d.confidence * 100).toFixed(0)}% confidence) — All forms supported`;
      }
    }
  } catch {}

  // Show AI tailoring badge
  try {
    const tr = await send({ type: 'GET_TAILORING_STATUS' });
    if (tr?.ok && tr.data?.enabled) {
      $('tailoringBadge').style.display = 'block';
      $('tailoringStatus').textContent = `Active — ${Math.round(tr.data.intensity * 100)}% intensity`;
    }
  } catch {}

  // Check auto-apply status
  await refreshAutoApplyStatus();

  // ─── Autofill Buttons ───
  $('btnFill').addEventListener('click', async () => {
    $('btnFill').classList.add('hidden');
    $('btnStop').classList.remove('hidden');
    $('dot').classList.remove('off');
    $('dot').classList.add('on');
    $('statusText').textContent = 'Running...';
    await send({ type: 'START_AUTOFILL' });
  });

  $('btnStop').addEventListener('click', async () => {
    $('btnStop').classList.add('hidden');
    $('btnFill').classList.remove('hidden');
    $('dot').classList.remove('on');
    $('dot').classList.add('off');
    $('statusText').textContent = 'Stopped';
    await send({ type: 'STOP_AUTOFILL' });
  });

  // ─── Auto-Apply Buttons ───
  $('btnAutoApply').addEventListener('click', async () => {
    await send({ type: 'START_AUTO_APPLY', payload: { source: 'all' } });
    showAutoApplyRunning();
  });

  $('btnAutoApplyImported').addEventListener('click', async () => {
    await send({ type: 'START_AUTO_APPLY', payload: { source: 'imported' } });
    showAutoApplyRunning();
  });

  $('btnStopAutoApply').addEventListener('click', async () => {
    await send({ type: 'STOP_AUTO_APPLY' });
    hideAutoApplyRunning();
  });

  $('btnPauseAutoApply').addEventListener('click', async () => {
    await send({ type: 'PAUSE_AUTO_APPLY' });
    $('btnPauseAutoApply').classList.add('hidden');
    $('btnResumeAutoApply').classList.remove('hidden');
    $('statusText').textContent = 'Paused';
  });

  $('btnResumeAutoApply').addEventListener('click', async () => {
    await send({ type: 'RESUME_AUTO_APPLY' });
    $('btnResumeAutoApply').classList.add('hidden');
    $('btnPauseAutoApply').classList.remove('hidden');
    $('statusText').textContent = 'Auto-applying...';
  });

  // ─── Navigation Buttons ───
  $('btnResponses').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  $('btnQueue').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  $('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

function showAutoApplyRunning() {
  $('btnAutoApply').classList.add('hidden');
  $('btnAutoApplyImported').classList.add('hidden');
  $('btnStopAutoApply').classList.remove('hidden');
  $('btnPauseAutoApply').classList.remove('hidden');
  $('dot').classList.remove('off');
  $('dot').classList.add('on');
  $('statusText').textContent = 'Auto-applying...';

  if (!autoApplyPolling) {
    autoApplyPolling = setInterval(refreshAutoApplyStatus, 3000);
  }
}

function hideAutoApplyRunning() {
  $('btnStopAutoApply').classList.add('hidden');
  $('btnPauseAutoApply').classList.add('hidden');
  $('btnResumeAutoApply').classList.add('hidden');
  $('btnAutoApply').classList.remove('hidden');
  $('btnAutoApplyImported').classList.remove('hidden');
  $('dot').classList.remove('on');
  $('dot').classList.add('off');
  $('statusText').textContent = 'Stopped';
  $('autoApplyStatus').style.display = 'none';

  if (autoApplyPolling) {
    clearInterval(autoApplyPolling);
    autoApplyPolling = null;
  }
}

async function refreshAutoApplyStatus() {
  try {
    const r = await send({ type: 'GET_AUTO_APPLY_STATUS' });
    if (!r?.ok) return;
    const status = r.data as AutoApplyStatus;
    if (status.running) {
      showAutoApplyRunning();
      const el = $('autoApplyStatus');
      el.style.display = 'block';
      el.textContent = `Auto-Apply: ${status.completedJobs}/${status.totalJobs} completed | ${status.failedJobs} failed | ${status.estimatedRemaining} remaining`;
      if (status.paused) {
        $('btnPauseAutoApply').classList.add('hidden');
        $('btnResumeAutoApply').classList.remove('hidden');
        $('statusText').textContent = 'Paused';
      }
    }
  } catch {}
}

init();
