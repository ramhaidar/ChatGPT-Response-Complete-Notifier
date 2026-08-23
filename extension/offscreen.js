'use strict';

let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function tone(ctx, frequency, start, duration, gainValue) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

async function playCompletionSound() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') await ctx.resume();

  const now = ctx.currentTime + 0.02;
  tone(ctx, 740, now, 0.16, 0.18);
  tone(ctx, 988, now + 0.18, 0.22, 0.20);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'PLAY_COMPLETION_SOUND') {
    playCompletionSound().catch((error) => {
      console.error('ChatGPT Ready Signal offscreen audio failed', error);
    });
  }
});
