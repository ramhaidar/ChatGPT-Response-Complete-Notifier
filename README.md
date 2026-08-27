# ChatGPT Answer Notifier

> **Stop babysitting the tab.** Get a sound and a native desktop notification when ChatGPT finishes answering - even when the ChatGPT tab is unfocused.

![Chromium 116+](https://img.shields.io/badge/Chromium-116%2B-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-5f6368)
![Userscript](https://img.shields.io/badge/Userscript-Tampermonkey%20%7C%20Violentmonkey-111)

ChatGPT Answer Notifier is deliberately small: no account, no backend, no analytics, no polling loop that needs the tab to stay active.

When a response completes, it gives you **both**:

- a short completion sound
- a native browser/OS notification

The notification is useful, not generic:

```text
Greeting exchange
Hello! How can I help you today? What would you like to...
```

The **title is the current ChatGPT conversation name**. The **body is a truncated preview of the answer to the latest prompt**.

## Pick your version

This repository ships the same behavior in two forms.

### Chromium extension

Use [`extension/`](./extension/) if you want the strongest background-tab behavior on Chrome, Edge, Brave, Vivaldi, and other Chromium browsers.

The extension uses a Manifest V3 service worker to detect ChatGPT conversation-request completion, then arms a small content-script watcher for the prompt-bound final turn. The watcher is structurally bound to the latest user prompt, so an older answer cannot be selected. The service worker then plays the sound through an offscreen document and emits the native notification.

**Requirements:** Chromium 116 or newer.

### Userscript

Use [`userscript/chatgpt-answer-notifier.user.js`](./userscript/chatgpt-answer-notifier.user.js) if you prefer a userscript manager.

Recommended managers:

- [Tampermonkey](https://www.tampermonkey.net/)
- [Violentmonkey](https://violentmonkey.github.io/)

The userscript observes completion of the same ChatGPT conversation resource, then keeps a prompt-bound DOM watcher armed until the answer after the latest user prompt is rendered. It uses the userscript notification API plus background-capable audio and does not use a polling loop.

## Install

### Chrome / Edge / Brave / other Chromium browsers

1. Download or clone this repository.
2. Open your browser's extensions page:
   - Chrome / Brave / Vivaldi: `chrome://extensions`
   - Edge: `edge://extensions`
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the [`extension`](./extension/) directory.
6. Reload any open `chatgpt.com` tabs.

The extension popup includes a **Test sound + notification** button so both notification channels can be verified without waiting for a real answer.

### Tampermonkey / Violentmonkey

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open [`userscript/chatgpt-answer-notifier.user.js`](./userscript/chatgpt-answer-notifier.user.js).
3. On GitHub, open the file as **Raw** and let your userscript manager install it.
4. Reload `chatgpt.com`.

The userscript also exposes a **Test sound + notification** command from the userscript-manager menu.

## Why it still works when the tab is unfocused

A notification feature is not very useful if it only works while you are already staring at the tab.

The two builds avoid using DOM polling as the primary completion signal:

```text
You send a prompt
      |
      v
ChatGPT streams the answer
      |
      v
Conversation network request completes
      |
      v
Arm prompt-bound completion watcher
      |
      v
Read the final assistant turn after that prompt
      |
      +-------------------+
      |                   |
      v                   v
    sound          native notification
```

The final answer preview is **prompt-bound**. The extractor finds the latest user turn and only considers assistant turns that occur after it. An older response therefore cannot be selected just because React has not finished repainting some unrelated part of the UI. If no answer text appears, the watcher falls back to a generic "Response finished." alert after a short timeout.

## Why two implementations?

Browser extensions and userscripts do not expose identical APIs.

The Chromium extension can use `chrome.webRequest.onCompleted`, `chrome.notifications`, and an offscreen document directly. That is the most robust implementation for Chromium.

The userscript uses the closest userscript-friendly equivalent: browser resource-completion observation plus `GM_notification`. The user-facing result is intentionally the same.

## Privacy

There is no telemetry, remote service, analytics endpoint, or account system in this project.

The extension is scoped to `https://chatgpt.com/*`. The userscript is also matched only to `https://chatgpt.com/*`. Notification text is read locally from the open conversation and sent to the browser/OS notification system on your own machine.

You can inspect every line that runs in the browser in this repository.

## Distribution policy

**The Chromium extension is intentionally not published to the Chrome Web Store, Microsoft Edge Add-ons, Firefox Add-ons, or any other browser-extension store.**

That is not an unfinished release step. Source/manual installation is the intended distribution model for this project.

There is also no separate Firefox extension package. Firefox users who want to try the feature should use the userscript through a compatible manager such as [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/). Browser-specific notification and audio behavior can vary.

## Repository layout

```text
.
├── extension/
│   ├── manifest.json
│   ├── service-worker.js
│   ├── content-script.js
│   ├── offscreen.html
│   ├── offscreen.js
│   ├── popup.html
│   ├── popup.js
│   └── icons/
├── userscript/
│   └── chatgpt-answer-notifier.user.js
└── README.md
```

## Notes

This project depends on implementation details of `chatgpt.com`, including its conversation request path and rendered conversation-turn structure. OpenAI can change those details at any time. If ChatGPT changes internally, the notifier may need a small compatibility update.

Operating-system settings still win: Do Not Disturb / Focus Assist, disabled browser notifications, or a muted browser can suppress the corresponding alert.

---

Not affiliated with or endorsed by OpenAI. ChatGPT is a trademark of OpenAI.
