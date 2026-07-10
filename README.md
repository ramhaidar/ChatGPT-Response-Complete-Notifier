# ChatGPT Response Complete Notifier

Sends a browser notification with text preview when ChatGPT finishes a response. Includes an audible completion chime. Robustly handles 'New Chat' detection and prevents notification spam.

## Features

- 📢 **Desktop Notifications**: Get notified when ChatGPT finishes generating a response
- 📝 **Text Preview**: Shows the first 150 characters of the response in the notification
- 🔔 **Audible Chime**: Two-tone completion sound plays alongside the notification (requires a click/key press to unlock audio)
- 🔄 **Smart Detection**: Automatically detects streaming start/end and "New Chat" events
- 🛡️ **No Spam**: Built-in cooldown prevents duplicate notifications
- 🔧 **Tampermonkey Compatible**: Works with Tampermonkey and other userscript managers
- 🔁 **Auto-Update**: Script updates are delivered via jsDelivr CDN

## Installation

### Prerequisites

1. Install [Tampermonkey](https://www.tampermonkey.net/) or a compatible userscript manager for your browser

### Quick Install (Recommended)

**Click the link below to install directly:**

[🚀 Install Script](https://cdn.jsdelivr.net/gh/ramhaidar/ChatGPT-Response-Complete-Notifier@main/chatgpt-response-complete-notifier.user.js)

*Note: When you click the link, Tampermonkey (or your userscript manager) should automatically detect the script and prompt you to install it. If not, follow the manual steps below.*

### Manual Installation

1. Download the `chatgpt-response-complete-notifier.user.js` file from this repository
2. In Tampermonkey, click the "+" icon to create a new script
3. Delete the default template code
4. Paste the contents of `chatgpt-response-complete-notifier.user.js`
5. Save the script (Ctrl+S or File > Save)
6. Visit [https://chatgpt.com](https://chatgpt.com) and grant notification permissions when prompted

## Usage

1. Navigate to [chatgpt.com](https://chatgpt.com)
2. Start a chat and send a message
3. When the response completes, you'll receive a desktop notification with a preview of the response
4. Click the notification to focus the ChatGPT tab

### Testing

To test the notification and sound manually, open the browser console and run:

```javascript
testCRNNotification()
```

To test only the completion chime:

```javascript
testCRNSound()
```

**Note**: These functions are exposed via `unsafeWindow` in Tampermonkey, which allows them to be called from the browser console. If testing doesn't work, ensure the script is running by checking Tampermonkey's icon status.

## Configuration

You can modify the configuration in the source code:

```javascript
const CONFIG = {
    DEBUG_MODE: false,             // Enable debug logging
    NOTIFICATION_COOLDOWN: 3000,   // Minimum time between notifications (ms)
    COMPLETION_DEBOUNCE: 350,      // Debounce window before confirming completion (ms)
    POLL_INTERVAL: 500,            // Check interval (ms)
    SOUND_ENABLED: true,           // Play audible completion chime
    SOUND_VOLUME: 1,               // Chime volume (0.0 to 1.0)
    NATIVE_NOTIFICATION_SOUND: false  // Let the OS notification play its own sound
};
```

## How It Works

1. **Button State Monitoring**: The script monitors ChatGPT's send/stop button state changes
2. **Detection Logic**:
   - When the "Stop streaming" button appears → Streaming started
   - When the "Stop streaming" button disappears → Response completed (with debounce)
   - When URL changes → New Chat detected (resets state)
3. **Audio Unlock**: On first click/key press, the script unlocks the Web Audio API and requests notification permission
4. **Notification**: Shows a native notification with response preview. Falls back to `GM_notification` if the native API is unavailable
5. **Completion Chime**: A two-tone sine wave chime plays alongside the notification
6. **Cooldown**: Prevents duplicate notifications within the cooldown period

## Auto-Update

The script checks for updates automatically via Tampermonkey using the jsDelivr CDN URL:

```
https://cdn.jsdelivr.net/gh/ramhaidar/ChatGPT-Response-Complete-Notifier@main/chatgpt-response-complete-notifier.user.js
```

Tampermonkey checks for updates periodically. You can also manually trigger an update check from the Tampermonkey dashboard.

## Browser Compatibility

- ✅ Chrome/Chromium (with Tampermonkey)
- ✅ Firefox (with Tampermonkey)
- ✅ Edge (with Tampermonkey)
- ✅ Safari (with Tampermonkey or compatible userscript manager)

## Troubleshooting

**Notifications not appearing:**
- Check your browser's notification permissions for chatgpt.com
- Ensure Tampermonkey is enabled and the script is running
- Try manually testing with `testCRNNotification()` in the console
- **Check system Do Not Disturb (DND) mode**: If your OS has DND or Focus Assist enabled, notifications may be suppressed. Disable it temporarily to test:
  - **Windows**: Check Focus Assist in Settings > System > Focus assist
  - **macOS**: Check Do Not Disturb in Control Center or System Settings
  - **Linux**: Check your notification settings (varies by distro)
  - Check browser notification settings for "Allow notifications"

**No completion chime:**
- Browsers require a user gesture (click or key press) to unlock the Web Audio API. Click anywhere on the page once to enable sound
- Check `SOUND_ENABLED` and `SOUND_VOLUME` in the config
- Test with `testCRNSound()` in the console

**Multiple notifications:**
- The script includes a 3-second cooldown by default
- If you still see duplicates, increase `NOTIFICATION_COOLDOWN` in the configuration

**Script not working after ChatGPT UI updates:**
- The script uses multiple selectors for button detection
- If issues persist, open an issue with details

## License

See [LICENSE](LICENSE) file for details.
