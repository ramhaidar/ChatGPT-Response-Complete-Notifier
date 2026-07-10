// ==UserScript==
// @name         ChatGPT Response Complete Notifier
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @author       ramhaidar
// @description  Sends a desktop notification with text preview when ChatGPT finishes a response. Robustly handles 'New Chat' detection and prevents notification spam.
// @homepage     https://github.com/ramhaidar/ChatGPT-Response-Complete-Notifier
// @source       https://github.com/ramhaidar/ChatGPT-Response-Complete-Notifier/raw/refs/heads/main/chatgpt-response-complete-notifier.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/ramhaidar/ChatGPT-Response-Complete-Notifier@main/chatgpt-response-complete-notifier.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/ramhaidar/ChatGPT-Response-Complete-Notifier@main/chatgpt-response-complete-notifier.user.js
// @license      GPL-3.0
// @match        https://chatgpt.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @grant        GM_notification
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    DEBUG_MODE: false,
    NOTIFICATION_COOLDOWN: 3000,
    COMPLETION_DEBOUNCE: 350,
    POLL_INTERVAL: 500,
    PERMISSION_KEY: 'crn_notification_permission_granted',
    PERMISSION_DENIED_KEY: 'crn_notification_permission_denied',

    // Audible completion chime. Browser audio unlocks on the first click/key press.
    SOUND_ENABLED: true,
    SOUND_VOLUME: 1, // 0.0 to 1.0
    NATIVE_NOTIFICATION_SOUND: false // false prevents a duplicate OS + in-page sound
  };

  const state = {
    initialized: false,
    isStreaming: false,
    lastNotificationTime: 0,
    lastUrl: window.location.href,
    buttonObserver: null,
    pollInterval: null,
    observedContainer: null,
    completionTimer: null,
    notificationPermissionGranted: false,
    permissionHookInstalled: false,
    audioContext: null,
    audioUnlocked: false
  };

  function crnLog(message, data = null) {
    if (!CONFIG.DEBUG_MODE) return;

    const timestamp = new Date().toISOString();
    const line = `[CRN] [${timestamp}] ${message}`;
    console.log(line);

    try {
      if (typeof GM_log === 'function') GM_log(line);
    } catch (_) { }

    if (data !== null) console.log('[CRN] DATA:', data);
  }

  function clearCompletionTimer() {
    if (state.completionTimer) {
      clearTimeout(state.completionTimer);
      state.completionTimer = null;
    }
  }

  function getCurrentButtonState() {
    const selectors = [
      '#composer-submit-button',
      'button[data-testid="stop-button"]',
      'button[data-testid="send-button"]',
      'button[aria-label="Stop answering"]',
      'button[aria-label="Stop streaming"]',
      'button[aria-label="Send prompt"]'
    ];

    let button = null;
    for (const selector of selectors) {
      button = document.querySelector(selector);
      if (button) break;
    }

    if (!button) {
      return {
        exists: false,
        buttonElement: null,
        dataTestId: null,
        ariaLabel: null,
        isDisabled: false,
        isSendButton: false,
        isStopButton: false,
        timestamp: Date.now()
      };
    }

    const dataTestId = button.getAttribute('data-testid') || '';
    const ariaLabel = button.getAttribute('aria-label') || '';

    const isStopButton =
      dataTestId === 'stop-button' ||
      /\bstop\s+(answering|streaming|generating)\b/i.test(ariaLabel);

    const isSendButton =
      dataTestId === 'send-button' ||
      /\bsend\s+(prompt|message)\b/i.test(ariaLabel);

    return {
      exists: true,
      buttonElement: button,
      dataTestId,
      ariaLabel,
      isDisabled: Boolean(button.disabled),
      isSendButton,
      isStopButton,
      timestamp: Date.now()
    };
  }

  function scheduleCompletionCheck(reason) {
    clearCompletionTimer();

    state.completionTimer = setTimeout(() => {
      state.completionTimer = null;

      const current = getCurrentButtonState();
      if (current.isStopButton) {
        crnLog('Completion cancelled: stop button returned.', current);
        state.isStreaming = true;
        return;
      }

      if (!state.isStreaming) return;

      state.isStreaming = false;
      crnLog(`Response completed (${reason}).`, current);
      showResponseCompleteNotification();
    }, CONFIG.COMPLETION_DEBOUNCE);
  }

  function handleButtonStateChange(buttonState) {
    if (buttonState.isStopButton) {
      clearCompletionTimer();

      if (!state.isStreaming) {
        state.isStreaming = true;
        crnLog('Streaming started.', buttonState);
      }
      return;
    }

    if (!state.isStreaming) return;

    // Current ChatGPT may show an enabled or disabled Send button after completion.
    // The reliable signal is the transition away from data-testid="stop-button".
    if (buttonState.isSendButton) {
      scheduleCompletionCheck('stop-to-send transition');
      return;
    }

    // During React DOM replacement the composer button may briefly disappear.
    // Confirm after a short debounce instead of notifying immediately.
    if (!buttonState.exists) {
      scheduleCompletionCheck('stop button disappeared');
    }
  }

  function getAudioContext() {
    if (!CONFIG.SOUND_ENABLED) return null;
    if (state.audioContext && state.audioContext.state !== 'closed') {
      return state.audioContext;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      crnLog('Web Audio API unavailable.');
      return null;
    }

    try {
      state.audioContext = new AudioContextClass();
      return state.audioContext;
    } catch (error) {
      crnLog('Audio context creation failed.', error);
      return null;
    }
  }

  function unlockCompletionSound() {
    const context = getAudioContext();
    if (!context) return;

    try {
      if (context.state === 'suspended') void context.resume();

      // A near-silent pulse makes the user gesture count as an audio unlock
      // on browsers that require actual playback.
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;

      gain.gain.setValueAtTime(0.00001, now);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.01);

      state.audioUnlocked = true;
      crnLog('Completion sound unlocked.');
    } catch (error) {
      crnLog('Completion sound unlock failed.', error);
    }
  }

  async function playCompletionSound() {
    if (!CONFIG.SOUND_ENABLED) return;

    const context = getAudioContext();
    if (!context) return;

    try {
      if (context.state === 'suspended') await context.resume();
      if (context.state !== 'running') {
        crnLog('Completion sound blocked until the page receives a click or key press.');
        return;
      }

      const masterGain = context.createGain();
      const startTime = context.currentTime + 0.02;
      const volume = Math.min(1, Math.max(0, Number(CONFIG.SOUND_VOLUME) || 0));

      masterGain.gain.setValueAtTime(volume, startTime);
      masterGain.connect(context.destination);

      const notes = [
        { frequency: 783.99, offset: 0.00, duration: 0.18 },
        { frequency: 1174.66, offset: 0.16, duration: 0.28 }
      ];

      for (const note of notes) {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        const noteStart = startTime + note.offset;
        const noteEnd = noteStart + note.duration;

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(note.frequency, noteStart);

        envelope.gain.setValueAtTime(0.0001, noteStart);
        envelope.gain.exponentialRampToValueAtTime(0.75, noteStart + 0.025);
        envelope.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

        oscillator.connect(envelope);
        envelope.connect(masterGain);
        oscillator.start(noteStart);
        oscillator.stop(noteEnd + 0.02);
      }

      crnLog('Completion sound played.');
    } catch (error) {
      crnLog('Completion sound failed.', error);
    }
  }

  function getLastAssistantPreview() {
    const messages = Array.from(
      document.querySelectorAll('[data-message-author-role="assistant"]')
    );

    const lastMessage = messages.at(-1);
    if (!lastMessage) return 'ChatGPT response completed';

    const contentNode =
      lastMessage.querySelector('.markdown, .prose, [class*="markdown"]') ||
      lastMessage;

    const content = contentNode.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (!content) return 'ChatGPT response completed';

    return content.length > 150 ? `${content.slice(0, 150)}...` : content;
  }

  function showResponseCompleteNotification() {
    const now = Date.now();
    if (now - state.lastNotificationTime < CONFIG.NOTIFICATION_COOLDOWN) {
      crnLog('Notification skipped by cooldown.');
      return;
    }

    state.lastNotificationTime = now;
    void playCompletionSound();
    const previewText = getLastAssistantPreview();

    if ('Notification' in window && Notification.permission === 'granted') {
      state.notificationPermissionGranted = true;
      showNativeNotification(previewText);
      return;
    }

    fallbackToGMNotification(previewText);
  }

  function showNativeNotification(previewText) {
    try {
      const notification = new Notification('ChatGPT Response Complete', {
        body: previewText,
        icon: 'https://chatgpt.com/favicon.ico',
        badge: 'https://chatgpt.com/favicon.ico',
        silent: !CONFIG.NATIVE_NOTIFICATION_SOUND
      });

      notification.onclick = function () {
        window.focus();
        notification.close();
      };
    } catch (error) {
      crnLog('Native notification failed.', error);
      fallbackToGMNotification(previewText);
    }
  }

  function fallbackToGMNotification(previewText) {
    try {
      if (typeof GM_notification === 'function') {
        GM_notification({
          title: 'ChatGPT Response Complete',
          text: previewText || 'Response completed',
          image: 'https://chatgpt.com/favicon.ico',
          timeout: 8000,
          onclick: function () { window.focus(); }
        });
        return;
      }
    } catch (error) {
      crnLog('GM_notification failed.', error);
    }

    crnLog('No notification API available.');
  }

  async function requestNativePermissionFromUserGesture() {
    if (!('Notification' in window)) return false;

    if (Notification.permission === 'granted') {
      state.notificationPermissionGranted = true;
      GM_setValue(CONFIG.PERMISSION_KEY, true);
      return true;
    }

    if (Notification.permission === 'denied') {
      GM_setValue(CONFIG.PERMISSION_DENIED_KEY, true);
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      state.notificationPermissionGranted = permission === 'granted';
      GM_setValue(CONFIG.PERMISSION_KEY, state.notificationPermissionGranted);
      GM_setValue(CONFIG.PERMISSION_DENIED_KEY, permission === 'denied');
      crnLog(`Notification permission result: ${permission}`);
      return state.notificationPermissionGranted;
    } catch (error) {
      crnLog('Notification permission request failed.', error);
      return false;
    }
  }

  function installPermissionGestureHook() {
    if (state.permissionHookInstalled) return;
    state.permissionHookInstalled = true;

    const requestOnce = () => {
      unlockCompletionSound();

      if ('Notification' in window && Notification.permission === 'default') {
        requestNativePermissionFromUserGesture();
      }
    };

    document.addEventListener('pointerdown', requestOnce, { once: true, capture: true });
    document.addEventListener('keydown', requestOnce, { once: true, capture: true });
  }

  function findObserverContainer() {
    return (
      document.querySelector('form[aria-label="Chat input form"]') ||
      document.querySelector('div[data-testid="conversation-container"] footer') ||
      document.querySelector('main') ||
      document.body
    );
  }

  function setupButtonObserver() {
    if (state.buttonObserver) {
      state.buttonObserver.disconnect();
      state.buttonObserver = null;
    }

    const container = findObserverContainer();
    if (!container) {
      crnLog('Input container not found.');
      return;
    }

    state.observedContainer = container;

    state.buttonObserver = new MutationObserver(() => {
      handleButtonStateChange(getCurrentButtonState());
    });

    state.buttonObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-testid', 'aria-label', 'disabled', 'class']
    });

    handleButtonStateChange(getCurrentButtonState());
    crnLog('Button observer attached.', container);
  }

  function resetForNavigation(newUrl) {
    clearCompletionTimer();
    state.isStreaming = false;
    state.lastUrl = newUrl;
    setupButtonObserver();
    crnLog(`Navigation detected: ${newUrl}`);
  }

  function startPolling() {
    if (state.pollInterval) clearInterval(state.pollInterval);

    state.pollInterval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== state.lastUrl) {
        resetForNavigation(currentUrl);
        return;
      }

      if (
        !state.observedContainer ||
        !document.documentElement.contains(state.observedContainer)
      ) {
        crnLog('Observed container replaced; reattaching.');
        setupButtonObserver();
      }

      handleButtonStateChange(getCurrentButtonState());
    }, CONFIG.POLL_INTERVAL);

    crnLog('Polling started.');
  }

  function exposeTestFunction() {
    const pageWindow =
      typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    pageWindow.testCRNNotification = function () {
      crnLog('Manual notification + sound test.');
      showResponseCompleteNotification();
    };

    pageWindow.testCRNSound = function () {
      crnLog('Manual sound test.');
      unlockCompletionSound();
      void playCompletionSound();
    };
  }

  function initialize() {
    if (state.initialized) return;
    state.initialized = true;

    state.notificationPermissionGranted =
      'Notification' in window && Notification.permission === 'granted';

    installPermissionGestureHook();
    setupButtonObserver();
    startPolling();
    exposeTestFunction();

    window.addEventListener('beforeunload', () => {
      clearCompletionTimer();
      if (state.buttonObserver) state.buttonObserver.disconnect();
      if (state.pollInterval) clearInterval(state.pollInterval);
    }, { once: true });

    crnLog('Initialization complete.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
