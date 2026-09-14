---
schema_version: 1
scope: "project"
project_root: "D:\\GitHub\\ChatGPT-Response-Complete-Notifier"
updated_at: "2026-09-14T06:49:15.424Z"
---

# Main Memory

## Notification / Userscript

- **native-notification-background-sound**: The userscript uses the page-native Notification API. Background-tab completion detection avoids requestAnimationFrame when document.visibilityState is hidden. Custom chime is attempted with a 250 ms deadline; if it cannot start in time, native notification sound is used as fallback so the two sounds do not overlap.

## Release / Versioning

- **version-sync-points**: Version is duplicated in FOUR places and all must be bumped together on every release: (1) extension/manifest.json "version", (2) userscript/chatgpt-answer-notifier.user.js `// @version`, (3) the same file's `const VERSION = '...'` runtime constant, (4) userscript/chatgpt-answer-notifier.meta.js `// @version` (the metadata-only companion that backs the cheap @updateURL check). Current baseline: 1.1.0 (bumped from 1.0.9 on 2026-09-14). extension/*.js contain no hardcoded version. The meta.js header must stay byte-identical to the user.js header except for @description and the @icon line (which is intentionally omitted from meta.js).
