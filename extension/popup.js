'use strict';

const button = document.getElementById('test');
const status = document.getElementById('status');

button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'Dispatching both channels...';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'TEST_BOTH' });
    if (!result?.ok) throw new Error(result?.error || 'Unknown error');
    status.textContent = 'Sound + desktop notification dispatched.';
  } catch (error) {
    status.textContent = `Test failed: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
