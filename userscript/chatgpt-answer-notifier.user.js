// ==UserScript==
// @name         ChatGPT Prompt-Bound Completion Alert
// @namespace    local.chatgpt.prompt-bound-ready
// @version      1.1.0
// @description  Sound + native notification when ChatGPT finishes. Preview is structurally bound to the latest user prompt so the previous answer cannot be selected.
// @author       Local
// @homepageURL  https://github.com/ramhaidar/ChatGPT-Response-Complete-Notifier
// @supportURL   https://github.com/ramhaidar/ChatGPT-Response-Complete-Notifier/issues
// @updateURL    https://raw.githubusercontent.com/ramhaidar/ChatGPT-Response-Complete-Notifier/main/userscript/chatgpt-answer-notifier.meta.js
// @downloadURL  https://raw.githubusercontent.com/ramhaidar/ChatGPT-Response-Complete-Notifier/main/userscript/chatgpt-answer-notifier.user.js
// @license      AGPL-3.0-or-later
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAADR0lEQVR4nO2dXXIiMQwGzdYeYS7B/Q/DcbJPVLEkBHuQ9fd1PxPiSG3J9jg1l+M4vgbI8id6ABALAoiDAOIggDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOL8jR7AGGPcbrfoIYRwvV6jhzAuURdCVJP+iigZ3AUg8b/jLYKbACR+DS8RXBaBJH8dr5htrQAk3oad1WBbBSD5duyM5RYBSL49u2Ka4hxgjBx7Yk+yTBLzNcDKH6aW9FdExsy0BZD8c6zEwrpyuLcAEv8z97h4twazCjAzcJL/npkYWUrC00BxTARg9tviWQVcKgDJX6fVswDIy8cCZDnQUMQi9tsrAOX/PB6xS3MU7MW7WaMmrIQAK6Xy8bMKMrQW4NMeef/5ziK0FMB6YdpZhHbbwJ27ko47nlYCeCSomwRtBPBMTCcJWggQkZAuEpQXIDIRHSQovQs4m4BXq/kz33e73UrvDkoLsMq7REXdyomkbAtYvX+4MktXP19ZmJICeF0+VZCgpACzWPTmyv19hnICzM40y8TNflfFKlBOALClpQA7ynbXVlBKgAoltsIYHyklwAw7Z2rHKtBOAFgDAcQpI0Cl3lpprGUEmMGjR3dbB7QSANZBAHHSPg6u1Ed/4nn8WVsHFUCctBVghqhZ9fx7K1crKoA4CCAOAoiDAOIggDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOKUvhBS+SJGFqgA4iCAOAggDgKIk3YRWP3mbdb/A3iGCiAOAoiDAOKkXQM8Y9FTebv5d6gA4iCAOAggDgKIIyXA7MJOZQE4hoMA2U7wZl8akQGP2H0sQKaAzfJqzNX+FovxljkHsKZasnfhsgbI1gYq4BUzEwFmZhMSzDMTK6sKJrULgO+YCUAVsMFz9o8RsAjs/Cr2T4iaHKYtQOE1azuIfEp5OY7jy/Qbx7nkqlWELDFKcw5ARYhhyy5AbTZ7sCum27aBSGDHzlhuWQM8Q3k/h8ckcjkIohqs4xUzlwrwCNXgd7wni7sAdxDhf6KqZJgAj6jKkKE1phAA4uBpoDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOIggDgIIA4CiPMPMxH82wgo8LsAAAAASUVORK5CYII=
// @match        https://chatgpt.com/*
// @run-at       document-start
// @sandbox      JavaScript
// @grant        unsafeWindow
// @grant        GM_registerMenuCommand
// @grant        window.focus
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const VERSION = '1.1.0';
  const NOTIFICATION_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAADR0lEQVR4nO2dXXIiMQwGzdYeYS7B/Q/DcbJPVLEkBHuQ9fd1PxPiSG3J9jg1l+M4vgbI8id6ABALAoiDAOIggDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOL8jR7AGGPcbrfoIYRwvV6jhzAuURdCVJP+iigZ3AUg8b/jLYKbACR+DS8RXBaBJH8dr5htrQAk3oad1WBbBSD5duyM5RYBSL49u2Ka4hxgjBx7Yk+yTBLzNcDKH6aW9FdExsy0BZD8c6zEwrpyuLcAEv8z97h4twazCjAzcJL/npkYWUrC00BxTARg9tviWQVcKgDJX6fVswDIy8cCZDnQUMQi9tsrAOX/PB6xS3MU7MW7WaMmrIQAK6Xy8bMKMrQW4NMeef/5ziK0FMB6YdpZhHbbwJ27ko47nlYCeCSomwRtBPBMTCcJWggQkZAuEpQXIDIRHSQovQs4m4BXq/kz33e73UrvDkoLsMq7REXdyomkbAtYvX+4MktXP19ZmJICeF0+VZCgpACzWPTmyv19hnICzM40y8TNflfFKlBOALClpQA7ynbXVlBKgAoltsIYHyklwAw7Z2rHKtBOAFgDAcQpI0Cl3lpprGUEmMGjR3dbB7QSANZBAHHSPg6u1Ed/4nn8WVsHFUCctBVghqhZ9fx7K1crKoA4CCAOAoiDAOIggDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOKUvhBS+SJGFqgA4iCAOAggDgKIk3YRWP3mbdb/A3iGCiAOAoiDAOKkXQM8Y9FTebv5d6gA4iCAOAggDgKIIyXA7MJOZQE4hoMA2U7wZl8akQGP2H0sQKaAzfJqzNX+FovxljkHsKZasnfhsgbI1gYq4BUzEwFmZhMSzDMTK6sKJrULgO+YCUAVsMFz9o8RsAjs/Cr2T4iaHKYtQOE1azuIfEp5OY7jy/Qbx7nkqlWELDFKcw5ARYhhyy5AbTZ7sCum27aBSGDHzlhuWQM8Q3k/h8ckcjkIohqs4xUzlwrwCNXgd7wni7sAdxDhf6KqZJgAj6jKkKE1phAA4uBpoDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOIggDgIIA4CiPMPMxH82wgo8LsAAAAASUVORK5CYII=';
  const RESPONSE_PREVIEW_MAX_CHARS = 260;
  const FINAL_TURN_WAIT_MS = 30000;
  const ANSWER_CHECK_THROTTLE_MS = 150;
  const MAX_PROCESSED_ENTRIES = 100;
  const RETURN_DISMISS_GRACE_MS = 500;
  const ACTIVE_NOTIFICATION_STORAGE_KEY = 'chatgpt-prompt-bound-active-notification';
  const CONVERSATION_PATHS = new Set([
    '/backend-api/f/conversation',
    '/backend-api/conversation'
  ]);
  const PAGE = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  let audioContext = null;
  let lastManualStopEpoch = 0;
  let lastCompletionEpoch = 0;
  let activeNotification = null;
  const processedEntries = new Set();
  const notifiedCompletionKeys = new Set();
  let nativeNotificationPermission = null;
  const resourceTimingDiagnostics = {
    seen: 0,
    conversationCandidates: 0,
    accepted: 0,
    rejectedStatus: 0,
    lastResponseStatus: null,
    clears: 0
  };

  const log = (...args) => console.debug('[ChatGPT Prompt-Bound Alert]', ...args);
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  function cleanSessionTitle(rawTitle) {
    const raw = normalize(rawTitle);
    if (!raw) return 'ChatGPT';
    const cleaned = raw
      .replace(/\s*[-|\u2013\u2014]\s*ChatGPT\s*$/i, '')
      .replace(/^ChatGPT\s*[-|\u2013\u2014]\s*/i, '')
      .trim();
    return cleaned && cleaned.toLowerCase() !== 'chatgpt' ? cleaned : 'ChatGPT';
  }

  function truncateResponse(text, maxChars = RESPONSE_PREVIEW_MAX_CHARS) {
    const normalized = normalize(text);
    if (!normalized) return 'Response finished.';
    if (normalized.length <= maxChars) return normalized;
    const slice = normalized.slice(0, Math.max(1, maxChars - 3));
    const lastSpace = slice.lastIndexOf(' ');
    const safeCut = lastSpace >= Math.floor(maxChars * 0.7) ? slice.slice(0, lastSpace) : slice;
    return `${safeCut.trimEnd()}...`;
  }

  function turnNodes() {
    try {
      const turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
      if (turns.length > 0) return turns;

      // ChatGPT has also rendered turns without the conversation-turn test id.
      // Role nodes preserve the same document order and are enough to bind the
      // response to the latest user message.
      return Array.from(document.querySelectorAll(
        '[data-message-author-role="user"], [data-message-author-role="assistant"]'
      ));
    } catch {
      return [];
    }
  }

  function roleOf(turn) {
    if (!turn) return '';
    try {
      const direct = normalize(
        turn.getAttribute('data-turn') || turn.getAttribute('data-message-author-role') || ''
      ).toLowerCase();
      if (direct === 'user' || direct === 'assistant') return direct;
      if (turn.querySelector('[data-message-author-role="user"]')) return 'user';
      if (turn.querySelector('[data-message-author-role="assistant"]')) return 'assistant';
    } catch {}
    return '';
  }

  function assistantText(turn) {
    if (!turn) return '';
    try {
      const roleNode = turn.matches?.('[data-message-author-role="assistant"]')
        ? turn
        : turn.querySelector('[data-message-author-role="assistant"]');
      if (!roleNode) return '';
      const rendered = roleNode.querySelector(
        '.markdown, [class*="prose"], [data-message-content], [class*="whitespace-pre-wrap"]'
      );
      const renderedText = rendered?.textContent || rendered?.innerText || '';
      return normalize(renderedText || roleNode.textContent || roleNode.innerText || '');
    } catch {
      return '';
    }
  }

  function answerBoundToLatestPrompt() {
    const turns = turnNodes();
    let latestUserIndex = -1;
    for (let i = 0; i < turns.length; i += 1) {
      if (roleOf(turns[i]) === 'user') latestUserIndex = i;
    }
    if (latestUserIndex < 0) return '';

    let candidate = '';
    for (let i = latestUserIndex + 1; i < turns.length; i += 1) {
      if (roleOf(turns[i]) !== 'assistant') continue;
      const text = assistantText(turns[i]);
      if (text) candidate = text;
    }
    return candidate;
  }

  function conversationObserverRoot() {
    const turns = turnNodes();
    const latestTurn = turns[turns.length - 1];
    if (latestTurn) {
      const main = latestTurn.closest?.('main');
      if (main) return main;
      if (latestTurn.parentElement) return latestTurn.parentElement;
    }
    return document.querySelector('main') || document.body || document.documentElement;
  }

  function waitForAnswerBoundToLatestPrompt() {
    const immediate = answerBoundToLatestPrompt();
    if (immediate) return Promise.resolve(immediate);

    return new Promise((resolve) => {
      let settled = false;
      let observer = null;
      let timeoutId = null;
      let throttleId = null;
      let frameId = null;
      let lastCheckAt = 0;

      const cleanupScheduledCheck = () => {
        if (throttleId !== null) {
          clearTimeout(throttleId);
          throttleId = null;
        }
        if (frameId !== null && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(frameId);
          frameId = null;
        }
      };

      const finish = (text) => {
        if (settled) return;
        settled = true;
        if (observer) observer.disconnect();
        if (timeoutId !== null) clearTimeout(timeoutId);
        cleanupScheduledCheck();
        resolve(text);
      };

      const check = () => {
        if (settled) return;
        lastCheckAt = performance.now();
        const text = answerBoundToLatestPrompt();
        if (text) finish(text);
      };

      const scheduleCheck = () => {
        if (settled || throttleId !== null || frameId !== null) return;
        const elapsed = performance.now() - lastCheckAt;
        const delay = Math.max(0, ANSWER_CHECK_THROTTLE_MS - elapsed);
        throttleId = setTimeout(() => {
          throttleId = null;
          const run = () => {
            frameId = null;
            check();
          };
          if (document.visibilityState !== 'hidden' && typeof requestAnimationFrame === 'function') {
            frameId = requestAnimationFrame(run);
          } else {
            run();
          }
        }, delay);
      };

      const root = conversationObserverRoot();
      if (root && typeof MutationObserver === 'function') {
        observer = new MutationObserver(scheduleCheck);
        observer.observe(root, { childList: true, subtree: true, characterData: true });
      }

      timeoutId = setTimeout(() => {
        finish(answerBoundToLatestPrompt() || 'Response finished.');
      }, FINAL_TURN_WAIT_MS);

      check();
    });
  }

  function getAudioContext() {
    if (audioContext) return audioContext;
    const Ctor = PAGE.AudioContext || PAGE.webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioContext = new Ctor();
      return audioContext;
    } catch {
      return null;
    }
  }

  async function unlockAudio() {
    const ctx = getAudioContext();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      return ctx.state === 'running';
    } catch {
      return false;
    }
  }

  async function playCompletionChime(deadline = Number.POSITIVE_INFINITY) {
    const ctx = getAudioContext();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      if (ctx.state !== 'running' || performance.now() > deadline) return false;
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.20, now + 0.015);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      master.connect(ctx.destination);

      const first = ctx.createOscillator();
      first.type = 'sine';
      first.frequency.setValueAtTime(880, now);
      first.connect(master);
      first.start(now);
      first.stop(now + 0.16);

      const second = ctx.createOscillator();
      second.type = 'sine';
      second.frequency.setValueAtTime(1174.66, now + 0.17);
      second.connect(master);
      second.start(now + 0.17);
      second.stop(now + 0.42);
      return true;
    } catch (error) {
      log('Custom sound failed:', error);
      return false;
    }
  }

  document.addEventListener('pointerdown', () => {
    unlockAudio().catch(() => {});
    if (pageIsActive()) ensureNativeNotificationPermission().catch(() => {});
  }, { capture: true, passive: true });
  document.addEventListener('keydown', () => {
    unlockAudio().catch(() => {});
    if (pageIsActive()) ensureNativeNotificationPermission().catch(() => {});
  }, { capture: true, passive: true });

  function isStopButton(node) {
    if (!(node instanceof Element)) return false;
    return Boolean(node.closest('button[data-testid="stop-button"], button[data-testid="fruitjuice-stop-button"]'));
  }

  document.addEventListener('click', (event) => {
    if (isStopButton(event.target)) {
      lastManualStopEpoch = Date.now();
      log('Manual Stop recorded.');
    }
  }, true);

  function conversationPath(url) {
    try {
      return new URL(url, location.href).pathname.replace(/\/+$/, '');
    } catch {
      return '';
    }
  }

  function isConversationResource(entry) {
    if (!entry || entry.entryType !== 'resource') return false;
    resourceTimingDiagnostics.seen += 1;
    if (!CONVERSATION_PATHS.has(conversationPath(entry.name))) return false;
    resourceTimingDiagnostics.conversationCandidates += 1;
    if (entry.initiatorType && !['fetch', 'xmlhttprequest'].includes(entry.initiatorType)) return false;

    const responseStatus = typeof entry.responseStatus === 'number' ? entry.responseStatus : null;
    resourceTimingDiagnostics.lastResponseStatus = responseStatus;
    if (responseStatus !== null && responseStatus !== 0 && (responseStatus < 200 || responseStatus >= 300)) {
      resourceTimingDiagnostics.rejectedStatus += 1;
      return false;
    }

    resourceTimingDiagnostics.accepted += 1;
    return true;
  }

  function entryKey(entry) {
    return [
      entry.name,
      Number(entry.startTime || 0).toFixed(3),
      Number(entry.responseEnd || entry.duration || 0).toFixed(3)
    ].join('|');
  }

  function wasManuallyStopped(entry) {
    if (!lastManualStopEpoch) return false;
    const origin = Number(performance.timeOrigin || (Date.now() - performance.now()));
    const startEpoch = origin + Number(entry.startTime || 0);
    const endEpoch = origin + Number(entry.responseEnd || (entry.startTime || 0) + (entry.duration || 0));
    return lastManualStopEpoch >= startEpoch - 100 && lastManualStopEpoch <= endEpoch + 1500;
  }

  function pageIsActive() {
    try {
      return document.visibilityState === 'visible' && document.hasFocus();
    } catch {
      return document.visibilityState === 'visible';
    }
  }

  function playCompletionChimeWithFallback() {
    const deadline = performance.now() + 250;
    return Promise.race([
      playCompletionChime(deadline),
      new Promise((resolve) => setTimeout(() => resolve(false), 250))
    ]);
  }

  async function ensureNativeNotificationPermission() {
    const NotificationConstructor = PAGE.Notification;
    if (typeof NotificationConstructor !== 'function') return false;
    if (nativeNotificationPermission === 'granted') return true;
    nativeNotificationPermission = NotificationConstructor.permission;
    if (nativeNotificationPermission === 'default') {
      try {
        nativeNotificationPermission = await NotificationConstructor.requestPermission();
      } catch {
        nativeNotificationPermission = 'denied';
        return false;
      }
    }
    return nativeNotificationPermission === 'granted';
  }

  async function createNativeNotification({ title, text, silent }) {
    if (!await ensureNativeNotificationPermission()) {
      log('Native notification permission is not granted.');
      return null;
    }

    const NotificationConstructor = PAGE.Notification;
    const notification = new NotificationConstructor(title, {
      body: text,
      icon: NOTIFICATION_ICON,
      silent
    });
    notification.onclick = () => {
      try { PAGE.focus?.(); } catch {}
      notification.close();
    };
    return notification;
  }

  async function showReadyNotification(responseText) {
    const title = cleanSessionTitle(document.title);
    const text = truncateResponse(responseText);

    const customChimePlayed = await playCompletionChimeWithFallback();
    await createNativeNotification({
      kind: 'ready',
      title,
      text,
      silent: customChimePlayed
    });
  }

  function rememberProcessedEntry(key) {
    if (processedEntries.has(key)) return false;
    while (processedEntries.size >= MAX_PROCESSED_ENTRIES) {
      const oldest = processedEntries.values().next().value;
      if (oldest === undefined) break;
      processedEntries.delete(oldest);
    }
    processedEntries.add(key);
    return true;
  }

  async function handleConversationCompletion(entry) {
    const key = entryKey(entry);
    if (!rememberProcessedEntry(key)) return;

    if (wasManuallyStopped(entry)) {
      log('Request ended after manual Stop; notification suppressed.');
      return;
    }

    const now = Date.now();
    if (now - lastCompletionEpoch < 400) return;
    lastCompletionEpoch = now;

    log('Conversation request completed; resolving assistant turn after latest user turn.');
    const responseText = await waitForAnswerBoundToLatestPrompt();
    const completionKey = `${location.pathname}|${normalize(responseText).slice(0, 1000)}`;
    if (notifiedCompletionKeys.has(completionKey)) return;
    await showReadyNotification(responseText);
    while (notifiedCompletionKeys.size >= MAX_PROCESSED_ENTRIES) {
      const oldest = notifiedCompletionKeys.values().next().value;
      if (oldest === undefined) break;
      notifiedCompletionKeys.delete(oldest);
    }
    notifiedCompletionKeys.add(completionKey);
  }

  function processResourceEntries(entries) {
    try {
      for (const entry of entries) {
        if (!isConversationResource(entry)) continue;
        handleConversationCompletion(entry).catch((error) => {
          console.error('[ChatGPT Prompt-Bound Alert] completion failed:', error);
        });
      }
    } finally {
      try {
        performance.clearResourceTimings?.();
        resourceTimingDiagnostics.clears += 1;
      } catch {}
    }
  }

  function installNetworkCompletionObserver() {
    try { performance.setResourceTimingBufferSize?.(1000); } catch {}

    if (typeof PerformanceObserver === 'function') {
      try {
        const observer = new PerformanceObserver((list) => processResourceEntries(list.getEntries()));
        observer.observe({ type: 'resource', buffered: true });
        log('Network completion detector installed.');
        return;
      } catch (error) {
        log('PerformanceObserver install failed:', error);
      }
    }

    processResourceEntries(performance.getEntriesByType?.('resource') || []);
  }

  GM_registerMenuCommand('Test sound + notification', async () => {
    const customChimePlayed = await playCompletionChimeWithFallback();

    // Important: invoking this command opens the userscript manager popup,
    // which temporarily makes document.hasFocus() false. Never arm
    // dismiss-on-return for the test itself, otherwise closing that popup races
    // with GM_notification and makes the toast appear random.
    await createNativeNotification({
      title: 'ChatGPT Prompt-Bound test',
      text: 'If you heard a sound and saw this notification, both channels work.',
      silent: customChimePlayed
    });
  });

  GM_registerMenuCommand('Log prompt-bound status', () => {
    const turns = turnNodes().map((turn, index) => ({
      index,
      testid: turn.getAttribute('data-testid'),
      role: roleOf(turn),
      preview: roleOf(turn) === 'assistant' ? assistantText(turn).slice(0, 100) : ''
    }));
    console.info('[ChatGPT Prompt-Bound Alert] status', {
      version: VERSION,
      title: document.title,
      resolvedLatestAnswer: answerBoundToLatestPrompt().slice(0, 260),
      processedEntryCount: processedEntries.size,
      resourceTiming: { ...resourceTimingDiagnostics },
      turns
    });
  });

  installNetworkCompletionObserver();
})();
