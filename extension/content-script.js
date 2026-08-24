'use strict';

(() => {
  if (globalThis.__chatgptPromptBoundNotifierInstalled) return;
  globalThis.__chatgptPromptBoundNotifierInstalled = true;

  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  let armed = false;
  let armedPromptKey = '';
  let lastSentFingerprint = '';
  let verifyId = null;
  let pendingSignature = '';

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

  function isTransientStatus(text) {
    const value = normalize(text).toLowerCase();
    if (!value) return true;
    if (value.length > 120) return false;

    const compact = value
      .replace(/[.。!！…⋯]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Work initially renders a short status turn such as "Working" even
    // though the actual background task is still running. Never treat these
    // short status-only turns as a completed answer.
    return /^(?:working|thinking|generating|processing|preparing|starting|analyzing|searching|browsing|running|executing|creating|building|coding|writing|reading|reviewing|waiting)(?:\s+(?:on it|for results|for a response|for response|for tool results|for tools))?$/.test(compact);
  }

  function isGenerationActive() {
    try {
      const selectors = [
        'button[data-testid="stop-button"]',
        'button[data-testid="fruitjuice-stop-button"]',
        'button[aria-label="Stop generating"]',
        'button[aria-label^="Stop"]',
        'button[title^="Stop"]'
      ];
      return Array.from(document.querySelectorAll(selectors.join(','))).some((node) => {
        if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
        const style = getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    } catch {
      return false;
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

  function readySnapshot() {
    const snapshot = latestPromptSnapshot();
    if (!snapshot?.response) return null;
    if (armedPromptKey && snapshot.promptKey !== armedPromptKey) return null;
    if (isTransientStatus(snapshot.response)) return null;
    if (isGenerationActive()) return null;
    return snapshot;
  }

  function clearVerification() {
    pendingSignature = '';
    if (verifyId !== null) {
      clearTimeout(verifyId);
      verifyId = null;
    }
  }

  function sendCompletion(snapshot) {
    const fingerprint = `${snapshot.promptKey}|${snapshot.assistantKey}|${snapshot.response.slice(0, 1000)}`;
    if (fingerprint === lastSentFingerprint) {
      armed = false;
      clearVerification();
      return;
    }

    lastSentFingerprint = fingerprint;
    armed = false;
    clearVerification();

    chrome.runtime.sendMessage({
      type: 'CHATGPT_RESPONSE_COMPLETE',
      sessionTitle: document.title,
      response: snapshot.response,
      fingerprint
    }).catch(() => {});
  }

  function verify(signature) {
    verifyId = null;
    if (!armed) return;
    const snapshot = readySnapshot();
    if (!snapshot) {
      pendingSignature = '';
      return;
    }
    const currentSignature = `${snapshot.promptKey}|${snapshot.assistantKey}|${snapshot.response}`;
    if (currentSignature !== signature) {
      pendingSignature = '';
      check();
      return;
    }
    sendCompletion(snapshot);
  }

  function check() {
    if (!armed) return;
    const snapshot = readySnapshot();
    if (!snapshot) {
      clearVerification();
      return;
    }

    const signature = `${snapshot.promptKey}|${snapshot.assistantKey}|${snapshot.response}`;

    // Background tabs are the main use case and browser timer throttling can
    // delay short settle timers. Once Work's transient status and the stop
    // control are both gone, emit immediately in a hidden tab.
    if (document.visibilityState !== 'visible') {
      sendCompletion(snapshot);
      return;
    }

    if (signature === pendingSignature && verifyId !== null) return;
    pendingSignature = signature;
    if (verifyId !== null) clearTimeout(verifyId);
    verifyId = setTimeout(() => verify(signature), 700);
  }

  function armForCurrentPrompt() {
    const snapshot = latestPromptSnapshot();
    armedPromptKey = snapshot?.promptKey || '';
    armed = true;
    clearVerification();
    check();
  }

  function isStopButton(node) {
    if (!(node instanceof Element)) return false;
    return Boolean(node.closest(
      'button[data-testid="stop-button"], button[data-testid="fruitjuice-stop-button"], button[aria-label^="Stop"], button[title^="Stop"]'
    ));
  }

  document.addEventListener('click', (event) => {
    if (!armed || !isStopButton(event.target)) return;
    // A manual stop is not a successful completion. The next conversation
    // request will arm the watcher again.
    armed = false;
    armedPromptKey = '';
    clearVerification();
  }, true);

  const observer = new MutationObserver(check);
  observer.observe(document, { childList: true, subtree: true, characterData: true, attributes: true });
  document.addEventListener('visibilitychange', check, true);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'CHATGPT_CONVERSATION_REQUEST_COMPLETED') {
      armForCurrentPrompt();
    }
  });
})();
