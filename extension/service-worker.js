'use strict';

const OFFSCREEN_DOCUMENT = 'offscreen.html';
const RESPONSE_PREVIEW_MAX_CHARS = 260;
const FINAL_TURN_WAIT_MS = 30000;
const CHATGPT_REQUEST_FILTER = {
  urls: [
    'https://chatgpt.com/backend-api/f/conversation*',
    'https://chatgpt.com/backend-api/conversation*'
  ]
};

let creatingOffscreen = null;

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
  const slice = normalized.slice(0, Math.max(1, maxChars - 1));
  const lastSpace = slice.lastIndexOf(' ');
  const safeCut = lastSpace >= Math.floor(maxChars * 0.7) ? slice.slice(0, lastSpace) : slice;
  return `${safeCut.trimEnd()}…`;
}

// Runs inside the ChatGPT tab only after the browser-level network request
// has completed. The response is selected by conversation structure:
// latest USER turn -> assistant turn(s) that occur AFTER that user turn.
// Therefore an assistant response from the previous prompt cannot qualify.
async function extractAnswerBoundToLatestPrompt(timeoutMs) {
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const cleanTitle = (rawTitle) => {
    const raw = normalize(rawTitle);
    if (!raw) return '';
    return raw
      .replace(/\s*[-|–—]\s*ChatGPT\s*$/i, '')
      .replace(/^ChatGPT\s*[-|–—]\s*/i, '')
      .trim();
  };

  const turnNodes = () => Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));

  const roleOf = (turn) => {
    if (!turn) return '';
    const direct = normalize(
      turn.getAttribute('data-turn') || turn.getAttribute('data-message-author-role') || ''
    ).toLowerCase();
    if (direct === 'user' || direct === 'assistant') return direct;
    if (turn.querySelector('[data-message-author-role="user"]')) return 'user';
    if (turn.querySelector('[data-message-author-role="assistant"]')) return 'assistant';
    return '';
  };

  const assistantText = (turn) => {
    if (!turn) return '';
    const roleNode = turn.matches?.('[data-message-author-role="assistant"]')
      ? turn
      : turn.querySelector('[data-message-author-role="assistant"]');
    if (!roleNode) return '';

    // Prefer the rendered answer container. It excludes the turn action bar.
    const rendered = roleNode.querySelector('.markdown, [class*="prose"]');
    const text = rendered
      ? (rendered.innerText || rendered.textContent || '')
      : (roleNode.innerText || roleNode.textContent || '');
    return normalize(text);
  };

  const locate = () => {
    const turns = turnNodes();
    let latestUserIndex = -1;
    for (let i = 0; i < turns.length; i += 1) {
      if (roleOf(turns[i]) === 'user') latestUserIndex = i;
    }
    if (latestUserIndex < 0) return null;

    // Pick the LAST non-empty assistant turn after the latest user turn. This
    // also handles regenerate/agent flows that expose more than one assistant
    // wrapper after a single prompt.
    let candidate = '';
    for (let i = latestUserIndex + 1; i < turns.length; i += 1) {
      if (roleOf(turns[i]) !== 'assistant') continue;
      const text = assistantText(turns[i]);
      if (text) candidate = text;
    }

    if (!candidate) return null;
    return {
      sessionTitle: cleanTitle(document.title),
      response: candidate
    };
  };

  const immediate = locate();
  if (immediate) return immediate;

  return await new Promise((resolve) => {
    let settled = false;
    let observer = null;
    let timeoutId = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (observer) observer.disconnect();
      if (timeoutId !== null) clearTimeout(timeoutId);
      resolve(result);
    };

    const check = () => {
      const result = locate();
      if (result) finish(result);
    };

    const root = document.body || document.documentElement;
    if (root && typeof MutationObserver === 'function') {
      observer = new MutationObserver(check);
      observer.observe(root, { childList: true, subtree: true, characterData: true });
    }

    timeoutId = setTimeout(() => {
      finish(locate() || {
        sessionTitle: cleanTitle(document.title),
        response: 'Response finished.'
      });
    }, Math.max(1000, Number(timeoutMs) || 30000));

    check();
  });
}

async function getNotificationContent(tabId) {
  let fallbackTitle = 'ChatGPT';
  try {
    const tab = await chrome.tabs.get(tabId);
    fallbackTitle = cleanSessionTitle(tab.title);
  } catch {}

  try {
    const injection = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractAnswerBoundToLatestPrompt,
      args: [FINAL_TURN_WAIT_MS]
    });
    const result = injection?.[0]?.result || {};
    return {
      title: cleanSessionTitle(result.sessionTitle || fallbackTitle),
      message: truncateResponse(result.response)
    };
  } catch (error) {
    console.warn('ChatGPT Prompt-Bound Alert: answer extraction failed', error);
    return { title: fallbackTitle, message: 'Response finished.' };
  }
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

  if (soundResult.status === 'rejected') console.error('Prompt-Bound Alert: sound failed', soundResult.reason);
  if (notificationResult.status === 'rejected') console.error('Prompt-Bound Alert: notification failed', notificationResult.reason);
  if (soundResult.status === 'rejected' && notificationResult.status === 'rejected') {
    throw new Error('Both sound and desktop notification failed.');
  }
}

chrome.webRequest.onCompleted.addListener((details) => {
  if (!isAnswerStreamRequest(details)) return;
  if (details.statusCode < 200 || details.statusCode >= 300) return;

  getNotificationContent(details.tabId)
    .then(({ title, message }) => emitBoth({ tabId: details.tabId, title, message }))
    .catch((error) => console.error('Prompt-Bound Alert: completion alert failed', error));
}, CHATGPT_REQUEST_FILTER);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'TEST_BOTH') {
    emitBoth({
      isTest: true,
      message: 'If you heard the chime and saw this notification, both output channels work.'
    }).then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }
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
