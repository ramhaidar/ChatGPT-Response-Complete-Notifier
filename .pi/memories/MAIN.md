---
schema_version: 1
scope: "project"
project_root: "D:\\GitHub\\ChatGPT-Response-Complete-Notifier"
updated_at: "2026-09-12T15:19:37.491Z"
---

# Main Memory

## Notification / Userscript

- **native-notification-background-sound**: The userscript uses the page-native Notification API. Background-tab completion detection avoids requestAnimationFrame when document.visibilityState is hidden. Custom chime is attempted with a 250 ms deadline; if it cannot start in time, native notification sound is used as fallback so the two sounds do not overlap.
