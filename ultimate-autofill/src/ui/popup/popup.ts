import type { ExtMessage, ExtResponse } from '../../types/index';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function send(msg: ExtMessage): Promise<ExtResponse> {
  return chrome.runtime.sendMessage(msg);
}

function toast(text: string) {
  const el = $('toast') as HTMLElement | null;
  // popup doesn't have a toast element, just log
  console.log('[UA]', text);
}

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
  }

  // Detect ATS on current page
  try {
    const ats = await send({ type: 'DETECT_ATS' });
    if (ats?.ok && ats.data) {
      const d = ats.data as { type: string; confidence: number };
      if (d.type !== 'generic' && d.confidence > 0.3) {
        const info = $('atsInfo');
        info.style.display = 'block';
        info.textContent = `Detected ATS: ${d.type} (${(d.confidence * 100).toFixed(0)}% confidence)`;
      }
    }
  } catch {}

  // Buttons
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

init();
