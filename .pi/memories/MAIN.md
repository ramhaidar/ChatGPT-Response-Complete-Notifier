---
schema_version: 1
scope: "project"
project_root: "D:\\GitHub\\ChatGPT-Response-Complete-Notifier"
updated_at: "2026-09-14T08:44:50.836Z"
---

# Main Memory

## Notification / Userscript

- **native-notification-background-sound**: The userscript uses the page-native Notification API. Background-tab completion detection avoids requestAnimationFrame when document.visibilityState is hidden. Custom chime is attempted with a 250 ms deadline; if it cannot start in time, native notification sound is used as fallback so the two sounds do not overlap.

## Release / Versioning

- **version-sync-points**: Version is duplicated in FOUR places and all must be bumped together on every release: (1) extension/manifest.json "version", (2) userscript/chatgpt-answer-notifier.user.js `// @version`, (3) the same file's `const VERSION = '...'` runtime constant, (4) userscript/chatgpt-answer-notifier.meta.js `// @version` (the metadata-only companion that backs the cheap @updateURL check). Current baseline: 1.1.1 (bumped from 1.1.0 on 2026-09-14 for the thinking-phase false-alert fix; 1.1.0 was bumped from 1.0.9 the same day). extension/*.js contain no hardcoded version. The meta.js header must stay byte-identical to the user.js header except for @description and the @icon line (which is intentionally omitted from meta.js).

## Notification / Completion detection

- **completion-detection-contract**: Completion detection is TWO-STAGE; do not collapse it back into one stage. Stage 1 (transport) = the answer stream POST ended: extension uses `chrome.webRequest.onCompleted` on `POST /backend-api/f/conversation` or `/backend-api/conversation` with 2xx (service-worker.js); userscript uses a `PerformanceObserver` on resource entries for the same paths with a 2xx/absent `responseStatus` (installNetworkCompletionObserver). Stage 2 (DOM settle) = `waitForAnswerBoundToLatestPrompt()` in both content-script.js and chatgpt-answer-notifier.user.js must confirm **both**: (a) `isGenerating()` is false — a VISIBLE `button[data-testid="stop-button"], button[data-testid="fruitjuice-stop-button"]` means the model is thinking/streaming, checked via `isElementVisible` (`getClientRects().length > 0`) because ChatGPT can keep the button mounted but hidden; and (b) the prompt-bound answer text has been unchanged for `STREAM_SETTLE_MS` (900 ms). Rationale: stage 1 alone is NOT "the model is done" — the stream can end while the model is still thinking and the PREVIOUS answer is still in the DOM. Treating stage 1 as completion caused a real reported bug: an alert fired during thinking with the previous stale answer as the preview. Keep the guard: removing the stop-button/stability gate as "redundant" re-introduces that bug. Related invariants: never send from `armForCurrentPrompt()` on an already-present answer (that fast path was removed for this reason); `FINAL_TURN_WAIT_MS` (30 s) only starts counting AFTER generation ends, so a long reasoning phase does not consume it; `GENERATION_HARD_CAP_MS` (10 min) aborts WITHOUT notifying, and a null/empty resolve must suppress the alert; watchers skip `requestAnimationFrame` when `document.visibilityState === 'hidden'` and rely on a `setInterval` (500 ms) poll so the gate progresses in background tabs.
