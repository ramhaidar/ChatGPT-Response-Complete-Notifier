// ==UserScript==
// @name         ChatGPT Response Complete Notifier
// @namespace    http://tampermonkey.net/
// @version      1.0.3
// @author       ramhaidar
// @description  Sends a desktop notification with text preview when ChatGPT finishes a response. Robustly handles 'New Chat' detection and prevents notification spam.
// @homepage     https://github.com/ramhaidar/ChatGPT-Response-Complete-Notifier
// @icon         https://chatgpt.com/favicon.ico
// @source       https://github.com/ramhaidar/ChatGPT-Response-Complete-Notifier/raw/refs/heads/main/chatgpt-response-complete-notifier.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/ramhaidar/ChatGPT-Response-Complete-Notifier@main/chatgpt-response-complete-notifier.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/ramhaidar/ChatGPT-Response-Complete-Notifier@main/chatgpt-response-complete-notifier.user.js
// @license      GPL-3.0
// @match        https://chatgpt.com/*
// @grant        GM_setValue
// @grant        GM_log
// @grant        GM_notification
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    DEBUG_MODE: false,
    NOTIFICATION_COOLDOWN: 3000,
    POLL_INTERVAL: 1500, // Backup only; completion detection does not depend on it.
    PERMISSION_KEY: 'crn_notification_permission_granted',
    PERMISSION_DENIED_KEY: 'crn_notification_permission_denied',

    SOUND_ENABLED: true,
    SOUND_VOLUME: 0.35, // 0.0 to 1.0
    SOUND_FREQUENCIES: [783.99, 1174.66],

    // Extension-level notifications are more dependable while the tab is hidden.
    USE_GM_NOTIFICATION_WHEN_HIDDEN: true,
    NATIVE_NOTIFICATION_SOUND: false
  };

  const state = {
    initialized: false,
    isStreaming: false,
    lastNotificationTime: 0,
    lastUrl: window.location.href,
    domObserver: null,
    pollInterval: null,
    checkQueued: false,
    notificationPermissionGranted: false,
    gestureHooksInstalled: false,
    audioElement: null,
    audioUnlocked: false,
    audioContext: null
  };

  function crnLog(message, data = null) {
    if (!CONFIG.DEBUG_MODE) return;

    const line = `[CRN] [${new Date().toISOString()}] ${message}`;
    console.log(line);

    try {
      if (typeof GM_log === 'function') GM_log(line);
    } catch (_) { }

    if (data !== null) console.log('[CRN] DATA:', data);
  }

  function getCurrentButtonState() {
    const selectors = [
      '#composer-submit-button',
      'button[data-testid="stop-button"]',
      'button[data-testid="send-button"]',
      'button[aria-label="Stop answering"]',
      'button[aria-label="Stop streaming"]',
      'button[aria-label="Stop generating"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Send message"]'
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
        dataTestId: '',
        ariaLabel: '',
        isDisabled: false,
        isSendButton: false,
        isStopButton: false
      };
    }

    const dataTestId = button.getAttribute('data-testid') || '';
    const ariaLabel = button.getAttribute('aria-label') || '';

    return {
      exists: true,
      buttonElement: button,
      dataTestId,
      ariaLabel,
      isDisabled: Boolean(button.disabled),
      isStopButton:
        dataTestId === 'stop-button' ||
        /\bstop\s+(answering|streaming|generating)\b/i.test(ariaLabel),
      isSendButton:
        dataTestId === 'send-button' ||
        /\bsend\s+(prompt|message)\b/i.test(ariaLabel)
    };
  }

  function completeResponse(reason) {
    if (!state.isStreaming) return;

    const current = getCurrentButtonState();
    if (current.isStopButton) {
      crnLog('Completion rejected because the Stop button is still present.', current);
      return;
    }

    // A Send button is the definitive stop-to-send transition. This runs in a
    // microtask, not setTimeout, so hidden-tab timer throttling cannot delay it.
    if (!current.isSendButton) {
      crnLog('Completion deferred until the Send button appears.', current);
      return;
    }

    state.isStreaming = false;
    crnLog(`Response completed (${reason}).`, current);
    showResponseCompleteNotification();
  }

  function handleButtonStateChange(buttonState) {
    if (buttonState.isStopButton) {
      if (!state.isStreaming) {
        state.isStreaming = true;
        crnLog('Streaming started.', buttonState);
      }
      return;
    }

    if (state.isStreaming && buttonState.isSendButton) {
      queueMicrotask(() => completeResponse('stop-to-send transition'));
    }
  }

  function queueButtonCheck() {
    if (state.checkQueued) return;
    state.checkQueued = true;

    queueMicrotask(() => {
      state.checkQueued = false;
      handleButtonStateChange(getCurrentButtonState());
      checkForNavigation();
    });
  }

  function createChimeDataUri() {
    const sampleRate = 44100;
    const durationSeconds = 0.62;
    const sampleCount = Math.floor(sampleRate * durationSeconds);
    const channels = 1;
    const bytesPerSample = 2;
    const dataSize = sampleCount * channels * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeAscii(offset, text) {
      for (let i = 0; i < text.length; i += 1) {
        view.setUint8(offset + i, text.charCodeAt(i));
      }
    }

    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * bytesPerSample, true);
    view.setUint16(32, channels * bytesPerSample, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeAscii(36, 'data');
    view.setUint32(40, dataSize, true);

    const notes = [
      { frequency: CONFIG.SOUND_FREQUENCIES[0], start: 0.02, end: 0.25 },
      { frequency: CONFIG.SOUND_FREQUENCIES[1], start: 0.20, end: 0.58 }
    ];

    for (let i = 0; i < sampleCount; i += 1) {
      const time = i / sampleRate;
      let sample = 0;

      for (const note of notes) {
        if (time < note.start || time > note.end) continue;

        const localTime = time - note.start;
        const noteDuration = note.end - note.start;
        const attack = Math.min(1, localTime / 0.025);
        const release = Math.min(1, (noteDuration - localTime) / 0.08);
        const envelope = Math.max(0, Math.min(attack, release));
        sample += Math.sin(2 * Math.PI * note.frequency * localTime) * envelope * 0.42;
      }

      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
    }

    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    return `data:audio/wav;base64,${btoa(binary)}`;
  }

  function prepareAudioElement() {
    if (!CONFIG.SOUND_ENABLED) return null;
    if (state.audioElement) return state.audioElement;

    try {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = createChimeDataUri();
      audio.volume = Math.min(1, Math.max(0, Number(CONFIG.SOUND_VOLUME) || 0));
      audio.setAttribute('aria-hidden', 'true');
      state.audioElement = audio;
      audio.load();
      crnLog('Persistent completion audio prepared.');
      return audio;
    } catch (error) {
      crnLog('Audio element preparation failed.', error);
      return null;
    }
  }
  async function unlockCompletionSound() {
    const audio = prepareAudioElement();
    if (!audio || state.audioUnlocked) return;

    const originalVolume = audio.volume;

    try {
      // Called directly from a click/key event. A nearly silent, brief playback
      // authorizes this persistent media element for later background playback.
      audio.volume = 0.0001;
      audio.currentTime = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.volume = originalVolume;
      state.audioUnlocked = true;
      crnLog('Background completion audio unlocked.');
    } catch (error) {
      audio.volume = originalVolume;
      crnLog('Audio unlock was blocked; normal ChatGPT interaction may still unlock it.', error);
    }
  }

  function getAudioContext() {
    if (state.audioContext && state.audioContext.state !== 'closed') {
      return state.audioContext;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    try {
      state.audioContext = new AudioContextClass();
      return state.audioContext;
    } catch (_) {
      return null;
    }
  }

  async function playWebAudioFallback() {
    const context = getAudioContext();
    if (!context) return;

    try {
      if (context.state === 'suspended') await context.resume();
      if (context.state !== 'running') return;

      const master = context.createGain();
      const start = context.currentTime + 0.01;
      const volume = Math.min(1, Math.max(0, Number(CONFIG.SOUND_VOLUME) || 0));
      master.gain.setValueAtTime(volume, start);
      master.connect(context.destination);

      const notes = [
        { frequency: CONFIG.SOUND_FREQUENCIES[0], offset: 0.00, duration: 0.22 },
        { frequency: CONFIG.SOUND_FREQUENCIES[1], offset: 0.18, duration: 0.34 }
      ];

      for (const note of notes) {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        const noteStart = start + note.offset;
        const noteEnd = noteStart + note.duration;

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(note.frequency, noteStart);
        envelope.gain.setValueAtTime(0.0001, noteStart);
        envelope.gain.exponentialRampToValueAtTime(0.65, noteStart + 0.025);
        envelope.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
        oscillator.connect(envelope);
        envelope.connect(master);
        oscillator.start(noteStart);
        oscillator.stop(noteEnd + 0.02);
      }
    } catch (error) {
      crnLog('Web Audio fallback failed.', error);
    }
  }

  async function playCompletionSound() {
    if (!CONFIG.SOUND_ENABLED) return;

    const audio = prepareAudioElement();
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = Math.min(1, Math.max(0, Number(CONFIG.SOUND_VOLUME) || 0));
        await audio.play();
        crnLog(`Completion sound played; hidden=${document.hidden}.`);
        return;
      } catch (error) {
        crnLog('HTML audio playback failed; trying Web Audio.', error);
      }
    }

    await playWebAudioFallback();
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
    const previewText = getLastAssistantPreview();

    // Do not await audio. Notification dispatch must remain immediate.
    void playCompletionSound();

    if (document.hidden && CONFIG.USE_GM_NOTIFICATION_WHEN_HIDDEN) {
      if (showGMNotification(previewText)) return;
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      state.notificationPermissionGranted = true;
      if (showNativeNotification(previewText)) return;
    }

    showGMNotification(previewText);
  }
  function showNativeNotification(previewText) {
    try {
      const notification = new Notification('ChatGPT Response Complete', {
        body: previewText,
        icon: 'https://chatgpt.com/favicon.ico',
        badge: 'https://chatgpt.com/favicon.ico',
        silent: !CONFIG.NATIVE_NOTIFICATION_SOUND,
        tag: 'chatgpt-response-complete',
        renotify: true
      });

      notification.onclick = function () {
        window.focus();
        notification.close();
      };

      crnLog(`Native notification shown; hidden=${document.hidden}.`);
      return true;
    } catch (error) {
      crnLog('Native notification failed.', error);
      return false;
    }
  }

  function showGMNotification(previewText) {
    try {
      if (typeof GM_notification !== 'function') return false;

      GM_notification({
        title: 'ChatGPT Response Complete',
        text: previewText || 'Response completed',
        image: 'https://chatgpt.com/favicon.ico',
        timeout: 10000,
        tag: 'chatgpt-response-complete',
        onclick: function () {
          window.focus();
        }
      });

      crnLog(`GM notification shown; hidden=${document.hidden}.`);
      return true;
    } catch (error) {
      crnLog('GM_notification failed.', error);
      return false;
    }
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

  function installGestureHooks() {
    if (state.gestureHooksInstalled) return;
    state.gestureHooksInstalled = true;

    const activate = () => {
      void unlockCompletionSound();

      if ('Notification' in window && Notification.permission === 'default') {
        void requestNativePermissionFromUserGesture();
      }
    };

    // Keep the listeners until audio is successfully unlocked. Users sometimes
    // install/reload the script after their first interaction with the page.
    const pointerHandler = () => {
      activate();
      if (state.audioUnlocked) {
        document.removeEventListener('pointerdown', pointerHandler, true);
        document.removeEventListener('keydown', keyHandler, true);
      }
    };

    const keyHandler = () => {
      activate();
      if (state.audioUnlocked) {
        document.removeEventListener('pointerdown', pointerHandler, true);
        document.removeEventListener('keydown', keyHandler, true);
      }
    };

    document.addEventListener('pointerdown', pointerHandler, true);
    document.addEventListener('keydown', keyHandler, true);
  }

  function setupDomObserver() {
    if (state.domObserver) state.domObserver.disconnect();

    // Observe a stable root. The old build observed the composer form, which can
    // be replaced during SPA updates and then relies on throttled polling to recover.
    const root = document.documentElement;
    if (!root) return;

    state.domObserver = new MutationObserver(queueButtonCheck);
    state.domObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-testid', 'aria-label', 'disabled']
    });

    queueButtonCheck();
    crnLog('Stable-root DOM observer attached.');
  }

  function resetForNavigation(newUrl) {
    state.isStreaming = false;
    state.lastUrl = newUrl;
    queueButtonCheck();
    crnLog(`Navigation detected: ${newUrl}`);
  }

  function checkForNavigation() {
    const currentUrl = window.location.href;
    if (currentUrl !== state.lastUrl) resetForNavigation(currentUrl);
  }

  function patchHistoryNavigation() {
    for (const methodName of ['pushState', 'replaceState']) {
      const original = history[methodName];
      if (typeof original !== 'function' || original.__crnPatched) continue;

      const patched = function (...args) {
        const result = original.apply(this, args);
        queueMicrotask(checkForNavigation);
        return result;
      };

      Object.defineProperty(patched, '__crnPatched', { value: true });
      history[methodName] = patched;
    }

    window.addEventListener('popstate', checkForNavigation);
  }
  function startBackupPolling() {
    if (state.pollInterval) clearInterval(state.pollInterval);

    state.pollInterval = setInterval(() => {
      checkForNavigation();
      handleButtonStateChange(getCurrentButtonState());
    }, CONFIG.POLL_INTERVAL);

    crnLog('Backup polling started.');
  }

  function exposeTestFunctions() {
    const pageWindow =
      typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    pageWindow.testCRNNotification = function () {
      crnLog('Manual notification + sound test.');
      showResponseCompleteNotification();
    };

    pageWindow.testCRNSound = function () {
      crnLog('Manual sound test.');
      void playCompletionSound();
    };

    pageWindow.testCRNBackgroundNotification = function () {
      crnLog('Manual extension notification test.');
      showGMNotification('Background notification test');
      void playCompletionSound();
    };
  }

  function initialize() {
    if (state.initialized) return;
    state.initialized = true;

    state.notificationPermissionGranted =
      'Notification' in window && Notification.permission === 'granted';

    prepareAudioElement();
    installGestureHooks();
    patchHistoryNavigation();
    setupDomObserver();
    startBackupPolling();
    exposeTestFunctions();

    window.addEventListener('beforeunload', () => {
      if (state.domObserver) state.domObserver.disconnect();
      if (state.pollInterval) clearInterval(state.pollInterval);
      if (state.audioElement) {
        state.audioElement.pause();
        state.audioElement.src = '';
      }
    }, { once: true });

    crnLog('Initialization complete.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
