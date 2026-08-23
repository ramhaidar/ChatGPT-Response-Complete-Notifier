// ==UserScript==
// @name         ChatGPT Prompt-Bound Completion Alert
// @namespace    local.chatgpt.prompt-bound-ready
// @version      1.0.5
// @description  Sound + native notification when ChatGPT finishes. Preview is structurally bound to the latest user prompt so the previous answer cannot be selected.
// @author       Local
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAADR0lEQVR4nO2dXXIiMQwGzdYeYS7B/Q/DcbJPVLEkBHuQ9fd1PxPiSG3J9jg1l+M4vgbI8id6ABALAoiDAOIggDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOL8jR7AGGPcbrfoIYRwvV6jhzAuURdCVJP+iigZ3AUg8b/jLYKbACR+DS8RXBaBJH8dr5htrQAk3oad1WBbBSD5duyM5RYBSL49u2Ka4hxgjBx7Yk+yTBLzNcDKH6aW9FdExsy0BZD8c6zEwrpyuLcAEv8z97h4twazCjAzcJL/npkYWUrC00BxTARg9tviWQVcKgDJX6fVswDIy8cCZDnQUMQi9tsrAOX/PB6xS3MU7MW7WaMmrIQAK6Xy8bMKMrQW4NMeef/5ziK0FMB6YdpZhHbbwJ27ko47nlYCeCSomwRtBPBMTCcJWggQkZAuEpQXIDIRHSQovQs4m4BXq/kz33e73UrvDkoLsMq7REXdyomkbAtYvX+4MktXP19ZmJICeF0+VZCgpACzWPTmyv19hnICzM40y8TNflfFKlBOALClpQA7ynbXVlBKgAoltsIYHyklwAw7Z2rHKtBOAFgDAcQpI0Cl3lpprGUEmMGjR3dbB7QSANZBAHHSPg6u1Ed/4nn8WVsHFUCctBVghqhZ9fx7K1crKoA4CCAOAoiDAOIggDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOKUvhBS+SJGFqgA4iCAOAggDgKIk3YRWP3mbdb/A3iGCiAOAoiDAOKkXQM8Y9FTebv5d6gA4iCAOAggDgKIIyXA7MJOZQE4hoMA2U7wZl8akQGP2H0sQKaAzfJqzNX+FovxljkHsKZasnfhsgbI1gYq4BUzEwFmZhMSzDMTK6sKJrULgO+YCUAVsMFz9o8RsAjs/Cr2T4iaHKYtQOE1azuIfEp5OY7jy/Qbx7nkqlWELDFKcw5ARYhhyy5AbTZ7sCum27aBSGDHzlhuWQM8Q3k/h8ckcjkIohqs4xUzlwrwCNXgd7wni7sAdxDhf6KqZJgAj6jKkKE1phAA4uBpoDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOIggDgIIA4CiPMPMxH82wgo8LsAAAAASUVORK5CYII=
// @match        https://chatgpt.com/*
// @run-at       document-start
// @sandbox      JavaScript
// @grant        unsafeWindow
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @grant        window.focus
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const VERSION = '1.0.5';
  const NOTIFICATION_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAADR0lEQVR4nO2dXXIiMQwGzdYeYS7B/Q/DcbJPVLEkBHuQ9fd1PxPiSG3J9jg1l+M4vgbI8id6ABALAoiDAOIggDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOL8jR7AGGPcbrfoIYRwvV6jhzAuURdCVJP+iigZ3AUg8b/jLYKbACR+DS8RXBaBJH8dr5htrQAk3oad1WBbBSD5duyM5RYBSL49u2Ka4hxgjBx7Yk+yTBLzNcDKH6aW9FdExsy0BZD8c6zEwrpyuLcAEv8z97h4twazCjAzcJL/npkYWUrC00BxTARg9tviWQVcKgDJX6fVswDIy8cCZDnQUMQi9tsrAOX/PB6xS3MU7MW7WaMmrIQAK6Xy8bMKMrQW4NMeef/5ziK0FMB6YdpZhHbbwJ27ko47nlYCeCSomwRtBPBMTCcJWggQkZAuEpQXIDIRHSQovQs4m4BXq/kz33e73UrvDkoLsMq7REXdyomkbAtYvX+4MktXP19ZmJICeF0+VZCgpACzWPTmyv19hnICzM40y8TNflfFKlBOALClpQA7ynbXVlBKgAoltsIYHyklwAw7Z2rHKtBOAFgDAcQpI0Cl3lpprGUEmMGjR3dbB7QSANZBAHHSPg6u1Ed/4nn8WVsHFUCctBVghqhZ9fx7K1crKoA4CCAOAoiDAOIggDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOKUvhBS+SJGFqgA4iCAOAggDgKIk3YRWP3mbdb/A3iGCiAOAoiDAOKkXQM8Y9FTebv5d6gA4iCAOAggDgKIIyXA7MJOZQE4hoMA2U7wZl8akQGP2H0sQKaAzfJqzNX+FovxljkHsKZasnfhsgbI1gYq4BUzEwFmZhMSzDMTK6sKJrULgO+YCUAVsMFz9o8RsAjs/Cr2T4iaHKYtQOE1azuIfEp5OY7jy/Qbx7nkqlWELDFKcw5ARYhhyy5AbTZ7sCum27aBSGDHzlhuWQM8Q3k/h8ckcjkIohqs4xUzlwrwCNXgd7wni7sAdxDhf6KqZJgAj6jKkKE1phAA4uBpoDgIIA4CiIMA4iCAOAggDgKIgwDiIIA4CCAOAoiDAOIggDgIIA4CiPMPMxH82wgo8LsAAAAASUVORK5CYII=';
  const RESPONSE_PREVIEW_MAX_CHARS = 260;
  const FINAL_TURN_WAIT_MS = 30000;
  const CONVERSATION_PATHS = new Set([
    '/backend-api/f/conversation',
    '/backend-api/conversation'
  ]);
  const PAGE = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  let audioContext = null;
  let lastManualStopEpoch = 0;
  let lastCompletionEpoch = 0;
  const processedEntries = new Set();

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
      return Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
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
      const rendered = roleNode.querySelector('.markdown, [class*="prose"]');
      return normalize(
        rendered
          ? (rendered.innerText || rendered.textContent || '')
          : (roleNode.innerText || roleNode.textContent || '')
      );
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

  function waitForAnswerBoundToLatestPrompt() {
    const immediate = answerBoundToLatestPrompt();
    if (immediate) return Promise.resolve(immediate);

    return new Promise((resolve) => {
      let settled = false;
      let observer = null;
      let timeoutId = null;

      const finish = (text) => {
        if (settled) return;
        settled = true;
        if (observer) observer.disconnect();
        if (timeoutId !== null) clearTimeout(timeoutId);
        resolve(text);
      };

      const check = () => {
        const text = answerBoundToLatestPrompt();
        if (text) finish(text);
      };

      const root = document.body || document.documentElement;
      if (root && typeof MutationObserver === 'function') {
        observer = new MutationObserver(check);
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

  async function playCompletionChime() {
    const ctx = getAudioContext();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      if (ctx.state !== 'running') return false;
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

  document.addEventListener('pointerdown', () => { unlockAudio().catch(() => {}); }, { capture: true, passive: true });
  document.addEventListener('keydown', () => { unlockAudio().catch(() => {}); }, { capture: true, passive: true });

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
    if (!CONVERSATION_PATHS.has(conversationPath(entry.name))) return false;
    if (entry.initiatorType && !['fetch', 'xmlhttprequest'].includes(entry.initiatorType)) return false;
    if (typeof entry.responseStatus === 'number' && entry.responseStatus !== 0) {
      if (entry.responseStatus < 200 || entry.responseStatus >= 300) return false;
    }
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

  async function showReadyNotification(responseText) {
    const title = cleanSessionTitle(document.title);
    const text = truncateResponse(responseText);
    const conversationUrl = location.href;
    const customChimePlayed = await playCompletionChime();

    GM_notification({
      title,
      text,
      tag: `chatgpt-prompt-bound-${Date.now()}`,
      image: NOTIFICATION_ICON,
      silent: customChimePlayed,
      onclick(event) {
        try { event?.preventDefault?.(); } catch {}
        try { window.focus(); } catch {}
        if (location.href !== conversationUrl) location.href = conversationUrl;
      }
    });
  }

  async function handleConversationCompletion(entry) {
    const key = entryKey(entry);
    if (processedEntries.has(key)) return;
    processedEntries.add(key);
    if (processedEntries.size > 100) processedEntries.delete(processedEntries.values().next().value);

    if (wasManuallyStopped(entry)) {
      log('Request ended after manual Stop; notification suppressed.');
      return;
    }

    const now = Date.now();
    if (now - lastCompletionEpoch < 400) return;
    lastCompletionEpoch = now;

    log('Conversation request completed; resolving assistant turn after latest user turn.');
    const responseText = await waitForAnswerBoundToLatestPrompt();
    await showReadyNotification(responseText);
  }

  function processResourceEntries(entries) {
    for (const entry of entries) {
      if (!isConversationResource(entry)) continue;
      handleConversationCompletion(entry).catch((error) => {
        console.error('[ChatGPT Prompt-Bound Alert] completion failed:', error);
      });
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
    const customChimePlayed = await playCompletionChime();
    GM_notification({
      title: 'ChatGPT Prompt-Bound test',
      text: 'If you heard a sound and saw this notification, both channels work.',
      tag: `chatgpt-prompt-bound-test-${Date.now()}`,
      image: NOTIFICATION_ICON,
      silent: customChimePlayed,
      onclick(event) {
        try { event?.preventDefault?.(); } catch {}
        try { window.focus(); } catch {}
      }
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
      turns
    });
  });

  installNetworkCompletionObserver();
})();
