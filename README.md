# ChatGPT Response Complete Notifier

Sends a browser notification with text preview when ChatGPT finishes a response. Robustly handles 'New Chat' detection and prevents notification spam.

## Features

- 📢 **Desktop Notifications**: Get notified when ChatGPT finishes generating a response
- 📝 **Text Preview**: Shows the first 150 characters of the response in the notification
- 🔄 **Smart Detection**: Automatically detects streaming start/end and "New Chat" events
- 🛡️ **No Spam**: Built-in cooldown prevents duplicate notifications
- 🔧 **Tampermonkey Compatible**: Works with Tampermonkey and other userscript managers

## Installation

### Prerequisites

1. Install [Tampermonkey](https://www.tampermonkey.net/) or a compatible userscript manager for your browser

### Quick Install (Recommended)

**Click the link below to install directly:**

[🚀 Install Script](https://github.com/ramhaidar/ChatGPT-Response-Complete-Notifier/raw/refs/heads/main/chatgpt-response-complete-notifier.user.js)

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

To test the notification manually, open the browser console and run:
```javascript
testCRNNotification()
```

**Note**: This function is exposed via `unsafeWindow` in Tampermonkey, which allows it to be called from the browser console. If testing doesn't work, ensure the script is running by checking Tampermonkey's icon status.

## Configuration

You can modify the configuration in the source code:

```javascript
const CONFIG = {
    DEBUG_MODE: false,           // Enable debug logging
    NOTIFICATION_COOLDOWN: 3000, // Minimum time between notifications (ms)
    PERMISSION_KEY: 'crn_notification_permission_granted',
    POLL_INTERVAL: 500          // Check interval (ms)
};
```

## How It Works

1. **Button State Monitoring**: The script monitors ChatGPT's send/stop button state changes
2. **Detection Logic**: 
   - When the "Stop streaming" button appears → Streaming started
   - When the "Send prompt" button becomes disabled → Response completed
   - When URL changes → New Chat detected (resets state)
3. **Notification**: Shows a native notification with response preview
4. **Cooldown**: Prevents duplicate notifications within the cooldown period

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

**Multiple notifications:**
- The script includes a 3-second cooldown by default
- If you still see duplicates, increase `NOTIFICATION_COOLDOWN` in the configuration

**Script not working after ChatGPT UI updates:**
- The script uses multiple selectors for button detection
- If issues persist, open an issue with details

## License

See [LICENSE](LICENSE) file for details.
