/**
 * JobWizard AI — Background Service Worker
 * Handles job queue automation, CSV import processing, and tab management.
 */

// Queue processing state
let queueRunning = false;
let currentQueueIndex = 0;

const st = {
  get: k => new Promise(r => chrome.storage.local.get(k, d => r(d[k]))),
  set: (k, v) => new Promise(r => chrome.storage.local.set({ [k]: v }, r))
};

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'jw_start_queue') {
    startQueue();
    sendResponse({ started: true });
  }
  if (msg.action === 'jw_stop_queue') {
    queueRunning = false;
    sendResponse({ stopped: true });
  }
  if (msg.action === 'jw_queue_page_done') {
    processNextInQueue();
  }
  return true;
});

// Context menu: "Add this page to queue"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'jw-add-to-queue',
    title: 'Add this page to JobWizard queue',
    contexts: ['page', 'link']
  });
  chrome.contextMenus.create({
    id: 'jw-fill-now',
    title: 'JobWizard: Fill this page now',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'jw-add-to-queue') {
    const url = info.linkUrl || info.pageUrl || tab.url;
    const queue = (await st.get('jw_queue')) || [];
    if (!queue.find(q => q.url === url)) {
      queue.push({ url, title: tab.title || url, status: 'pending', addedAt: Date.now() });
      await st.set('jw_queue', queue);
    }
  }
  if (info.menuItemId === 'jw-fill-now' && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'jw_fill_now' });
  }
});

// Queue automation
async function startQueue() {
  if (queueRunning) return;
  queueRunning = true;
  currentQueueIndex = 0;

  const queue = (await st.get('jw_queue')) || [];
  const pending = queue.filter(q => q.status === 'pending');
  if (pending.length === 0) { queueRunning = false; return; }

  processNextInQueue();
}

async function processNextInQueue() {
  if (!queueRunning) return;

  const queue = (await st.get('jw_queue')) || [];
  const nextIdx = queue.findIndex(q => q.status === 'pending');

  if (nextIdx === -1) {
    queueRunning = false;
    console.log('[JobWizard] Queue complete!');
    return;
  }

  // Mark as active
  queue[nextIdx].status = 'active';
  await st.set('jw_queue', queue);

  // Open tab and navigate
  const tab = await chrome.tabs.create({ url: queue[nextIdx].url, active: true });

  // Wait for page load then trigger autofill
  chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
    if (tabId === tab.id && changeInfo.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);

      // Delay to let page render, then autofill
      setTimeout(async () => {
        try {
          chrome.tabs.sendMessage(tab.id, { action: 'jw_fill_now' });
        } catch (e) {
          console.log('[JobWizard] Could not send fill message:', e);
        }

        // Mark as done after processing time
        setTimeout(async () => {
          const q = (await st.get('jw_queue')) || [];
          const item = q.find(i => i.url === queue[nextIdx].url);
          if (item) item.status = 'done';
          await st.set('jw_queue', q);

          // Process next after delay
          setTimeout(() => processNextInQueue(), 3000);
        }, 15000);
      }, 5000);
    }
  });
}

// Alarm for periodic upgrade prompt hiding
chrome.alarms.create('jw-hide-upgrades', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'jw-hide-upgrades') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'jw_hide_upgrades' }).catch(() => {});
      }
    });
  }
});

console.log('[JobWizard] Background service worker loaded — UNLIMITED MODE');
