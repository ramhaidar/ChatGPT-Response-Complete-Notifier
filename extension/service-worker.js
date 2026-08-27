'use strict';

const OFFSCREEN_DOCUMENT = 'offscreen.html';
const RESPONSE_PREVIEW_MAX_CHARS = 260;
const NOTIFICATION_TIMEOUT_MS = 8000;
const CHATGPT_REQUEST_FILTER = {
  urls: [
    'https://chatgpt.com/backend-api/f/conversation*',
    'https://chatgpt.com/backend-api/conversation*'
  ]
};

let creatingOffscreen = null;
const lastNotificationFingerprintByTab = new Map();
const pageReturnDismissByTab = new Map();

function normalizePathname(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function isAnswerStreamRequest(details) {
  if (details.tabId < 0 || details.method !== 'POST') return false;
  const path = normalizePathname(details.url);
  return path === '/backend-api/f/conversation' || path === '/backend-api/conversation';
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });
  if (contexts.length > 0) return;

  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT,
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play an audible alert after a ChatGPT response completes.'
    }).finally(() => {
      creatingOffscreen = null;
    });
  }
  await creatingOffscreen;
}

async function playCompletionSound() {
  await ensureOffscreenDocument();
  await chrome.runtime.sendMessage({ type: 'PLAY_COMPLETION_SOUND' });
}

function cleanSessionTitle(rawTitle) {
  const raw = String(rawTitle || '').replace(/\s+/g, ' ').trim();
  if (!raw) return 'ChatGPT';
  const cleaned = raw
    .replace(/\s*[-|–—]\s*ChatGPT\s*$/i, '')
    .replace(/^ChatGPT\s*[-|–—]\s*/i, '')
    .trim();
  return cleaned && cleaned.toLowerCase() !== 'chatgpt' ? cleaned : 'ChatGPT';
}

function truncateResponse(text, maxChars = RESPONSE_PREVIEW_MAX_CHARS) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Response finished.';
  if (normalized.length <= maxChars) return normalized;
  const slice = normalized.slice(0, Math.max(1, maxChars - 3));
  const lastSpace = slice.lastIndexOf(' ');
  const safeCut = lastSpace >= Math.floor(maxChars * 0.7) ? slice.slice(0, lastSpace) : slice;
  return `${safeCut.trimEnd()}...`;
}

async function emitBoth({ tabId = null, title = 'ChatGPT', message = 'Response finished.', isTest = false } = {}) {
  const id = isTest
    ? `chatgpt-prompt-bound-test:${Date.now()}`
    : `chatgpt-prompt-bound:${tabId}:${Date.now()}`;

  const [soundResult, notificationResult] = await Promise.allSettled([
    playCompletionSound(),
    chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: isTest ? 'Background alert test' : title,
      message,
      contextMessage: isTest
        ? 'Sound + desktop notification dispatched by the extension'
        : 'Click to return to the completed ChatGPT tab',
      priority: 2,
      requireInteraction: false,
      silent: true
    })
  ]);

  // Chrome MV3 notifications do not reliably support timeout on all platforms,
  // so also clear it after the same userscript timeout for consistent behavior.
  if (notificationResult.status === 'fulfilled') {
    setTimeout(() => {
      chrome.notifications.clear(id).catch(() => {});
    }, NOTIFICATION_TIMEOUT_MS);
  }

  if (soundResult.status === 'rejected') console.error('Prompt-Bound Alert: sound failed', soundResult.reason);
  if (notificationResult.status === 'rejected') console.error('Prompt-Bound Alert: notification failed', notificationResult.reason);
  if (soundResult.status === 'rejected' && notificationResult.status === 'rejected') {
    throw new Error('Both sound and desktop notification failed.');
  }
  return id;
}

function cancelPageReturnDismiss(tabId) {
  if (typeof tabId !== 'number') return;
  const record = pageReturnDismissByTab.get(tabId);
  if (!record) return;
  if (record.autoCloseId !== null) clearTimeout(record.autoCloseId);
  pageReturnDismissByTab.delete(tabId);
}

function schedulePageReturnDismiss(tabId) {
  if (typeof tabId !== 'number') return;
  cancelPageReturnDismiss(tabId);
  const record = {
    notificationId: '',
    returnDismissArmedAt: Date.now() + 500,
    autoCloseId: setTimeout(() => {
      pageReturnDismissByTab.delete(tabId);
    }, 8500)
  };
  pageReturnDismissByTab.set(tabId, record);
  return record;
}

async function signalConversationRequestCompleted(tabId) {
  const message = { type: 'CHATGPT_CONVERSATION_REQUEST_COMPLETED' };
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return;
  } catch {}

  // Handles tabs that were already open when the unpacked extension was
  // reloaded. The content script has an install guard, so reinjection is safe.
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-script.js']
    });
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.warn('Prompt-Bound Alert: could not arm tab completion watcher', error);
  }
}

chrome.webRequest.onCompleted.addListener((details) => {
  if (!isAnswerStreamRequest(details)) return;
  if (details.statusCode < 200 || details.statusCode >= 300) return;
  signalConversationRequestCompleted(details.tabId).catch(() => {});
}, CHATGPT_REQUEST_FILTER);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'CHATGPT_RESPONSE_COMPLETE') {
    const tabId = sender.tab?.id;
    if (typeof tabId !== 'number') return;

    const fingerprint = String(message.fingerprint || '');
    if (fingerprint && lastNotificationFingerprintByTab.get(tabId) === fingerprint) return;
    if (fingerprint) lastNotificationFingerprintByTab.set(tabId, fingerprint);

    const pageReturnRecord = message.dismissOnReturn ? schedulePageReturnDismiss(tabId) : null;
    emitBoth({
      tabId,
      title: cleanSessionTitle(message.sessionTitle),
      message: truncateResponse(message.response)
    }).then((notificationId) => {
      if (pageReturnRecord) pageReturnRecord.notificationId = String(notificationId || '');
    }).catch((error) => {
      if (pageReturnRecord) cancelPageReturnDismiss(tabId);
      console.error('Prompt-Bound Alert: completion alert failed', error);
    });
    return;
  }

  if (message?.type === 'CHATGPT_PAGE_RETURNED') {
    const tabId = sender.tab?.id;
    if (typeof tabId !== 'number') return;
    const record = pageReturnDismissByTab.get(tabId);
    if (!record) return;
    if (Date.now() < record.returnDismissArmedAt) return;
    cancelPageReturnDismiss(tabId);
    if (record.notificationId) {
      chrome.notifications.clear(record.notificationId).catch(() => {});
    }
    return;
  }

  if (message?.type === 'TEST_BOTH') {
    emitBoth({
      isTest: true,
      message: 'If you heard the chime and saw this notification, both output channels work.'
    }).then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  lastNotificationFingerprintByTab.delete(tabId);
  cancelPageReturnDismiss(tabId);
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  const match = /^chatgpt-prompt-bound:(\d+):/.exec(notificationId);
  if (!match) return;
  const tabId = Number(match[1]);
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    if (typeof tab.windowId === 'number') await chrome.windows.update(tab.windowId, { focused: true });
  } catch (error) {
    console.warn('Prompt-Bound Alert: source tab no longer exists', error);
  } finally {
    chrome.notifications.clear(notificationId).catch(() => {});
  }
});
