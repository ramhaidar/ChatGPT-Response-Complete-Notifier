'use strict';

(() => {
  if (globalThis.__chatgptPromptBoundNotifierInstalled) return;
  globalThis.__chatgptPromptBoundNotifierInstalled = true;

  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const FINAL_TURN_WAIT_MS = 30000;
  const ANSWER_CHECK_THROTTLE_MS = 150;
  const STREAM_SETTLE_MS = 900;
  const STREAM_POLL_MS = 500;
  const GENERATION_HARD_CAP_MS = 600000;
  const STOP_BUTTON_SELECTOR =
    'button[data-testid="stop-button"], button[data-testid="fruitjuice-stop-button"]';
  let watchToken = 0;
  let lastSentFingerprint = '';
  let suppressUntilEpoch = 0;

  function pageIsActive() {
    try {
      return document.visibilityState === 'visible' && document.hasFocus();
    } catch {
      return document.visibilityState === 'visible';
    }
  }

  function notifyPageReturned() {
    chrome.runtime.sendMessage({ type: 'CHATGPT_PAGE_RETURNED' }).catch(() => {});
  }

  window.addEventListener('focus', notifyPageReturned, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') notifyPageReturned();
  }, true);
  document.addEventListener('pointerdown', notifyPageReturned, { capture: true, passive: true });
  document.addEventListener('keydown', notifyPageReturned, { capture: true, passive: true });

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
          ? (rendered.textContent || rendered.innerText || '')
          : (roleNode.textContent || roleNode.innerText || '')
      );
    } catch {
      return '';
    }
  }

  function latestPromptSnapshot() {
    const turns = turnNodes();
    let latestUserIndex = -1;
    for (let i = 0; i < turns.length; i += 1) {
      if (roleOf(turns[i]) === 'user') latestUserIndex = i;
    }
    if (latestUserIndex < 0) return null;

    let assistantIndex = -1;
    let response = '';
    for (let i = latestUserIndex + 1; i < turns.length; i += 1) {
      if (roleOf(turns[i]) !== 'assistant') continue;
      const text = assistantText(turns[i]);
      if (!text) continue;
      assistantIndex = i;
      response = text;
    }

    const userTurn = turns[latestUserIndex];
    const promptKey = [
      location.pathname,
      userTurn?.getAttribute('data-testid') || `user-${latestUserIndex}`
    ].join('|');

    if (!response || assistantIndex < 0) {
      return { promptKey, assistantKey: '', response: '' };
    }

    const assistantTurn = turns[assistantIndex];
    return {
      promptKey,
      assistantKey: assistantTurn?.getAttribute('data-testid') || `assistant-${assistantIndex}`,
      response
    };
  }

  function answerBoundToLatestPrompt() {
    return latestPromptSnapshot()?.response || '';
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

  function isElementVisible(node) {
    if (!node) return false;
    try {
      // A stop button kept mounted but display:none must not count as
      // "generating", otherwise completion would never be detected.
      return typeof node.getClientRects !== 'function' || node.getClientRects().length > 0;
    } catch {
      return true;
    }
  }

  function isGenerating() {
    try {
      const stopButtons = document.querySelectorAll(STOP_BUTTON_SELECTOR);
      for (const button of stopButtons) {
        if (isElementVisible(button)) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function waitForAnswerBoundToLatestPrompt() {
    return new Promise((resolve) => {
      let settled = false;
      let observer = null;
      let watchdogId = null;
      let pollId = null;
      let throttleId = null;
      let frameId = null;
      let lastCheckAt = 0;
      let stableText = '';
      let stableSince = 0;
      let generationEndedAt = 0;
      const startedAt = Date.now();

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
        if (watchdogId !== null) clearInterval(watchdogId);
        if (pollId !== null) clearInterval(pollId);
        cleanupScheduledCheck();
        resolve(text);
      };

      const check = () => {
        if (settled) return;
        lastCheckAt = performance.now();

        // Safety valve: a stop button that never clears must not wedge the
        // watcher. Abort without notifying, because the answer never finished.
        if (Date.now() - startedAt >= GENERATION_HARD_CAP_MS) {
          finish(null);
          return;
        }

        // The stop button is the authoritative "still working" signal. While it
        // is present ChatGPT is thinking or streaming, which is not completion.
        if (isGenerating()) {
          stableText = '';
          stableSince = 0;
          generationEndedAt = 0;
          return;
        }

        const text = answerBoundToLatestPrompt();
        if (!text) {
          stableText = '';
          stableSince = 0;
          return;
        }

        const now = Date.now();
        if (text !== stableText) {
          stableText = text;
          stableSince = now;
          return;
        }

        // Generation ended and the text stopped changing. Only now is the
        // answer actually finished, so a late repaint cannot cut it short.
        if (now - stableSince >= STREAM_SETTLE_MS) finish(text);
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

      // Interval fallback: background tabs freeze requestAnimationFrame, so the
      // observer chain alone can stall until the tab regains focus.
      pollId = setInterval(check, STREAM_POLL_MS);

      // Only counted once generation has ended, so a long reasoning phase is
      // not mistaken for the 30s "no answer text appeared" fallback.
      watchdogId = setInterval(() => {
        if (settled) return;
        if (isGenerating()) {
          generationEndedAt = 0;
          return;
        }
        const now = Date.now();
        if (generationEndedAt === 0) generationEndedAt = now;
        if (now - generationEndedAt >= FINAL_TURN_WAIT_MS) {
          finish(answerBoundToLatestPrompt() || 'Response finished.');
        }
      }, STREAM_POLL_MS);

      check();
    });
  }

  function sendCompletion(snapshot) {
    const fingerprint = `${snapshot.promptKey}|${snapshot.assistantKey}|${snapshot.response.slice(0, 1000)}`;
    if (fingerprint === lastSentFingerprint) return;

    lastSentFingerprint = fingerprint;
    chrome.runtime.sendMessage({
      type: 'CHATGPT_RESPONSE_COMPLETE',
      sessionTitle: document.title,
      response: snapshot.response,
      fingerprint,
      completionKey: snapshot.assistantKey
        ? `${snapshot.promptKey}|${snapshot.assistantKey}`
        : '',
      dismissOnReturn: false
    }).catch(() => {});
  }

  function armForCurrentPrompt() {
    if (Date.now() < suppressUntilEpoch) return;
    const token = watchToken;
    waitForAnswerBoundToLatestPrompt()
      .then((text) => {
        if (token !== watchToken || !text) return;
        const resolved = latestPromptSnapshot();
        if (resolved?.response) {
          sendCompletion(resolved);
        } else {
          sendCompletion({
            promptKey: '',
            assistantKey: '',
            response: text
          });
        }
      });
  }

  function isStopButton(node) {
    if (!(node instanceof Element)) return false;
    return Boolean(node.closest('button[data-testid="stop-button"], button[data-testid="fruitjuice-stop-button"]'));
  }

  document.addEventListener('click', (event) => {
    if (!isStopButton(event.target)) return;
    // A manual stop is not a successful completion. The next conversation
    // request will arm the watcher again.
    watchToken += 1;
    suppressUntilEpoch = Date.now() + 1500;
  }, true);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'CHATGPT_CONVERSATION_REQUEST_COMPLETED') {
      armForCurrentPrompt();
    }
  });
})();
