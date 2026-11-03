/**
 * hyoumoji - Background Service Worker
 * Secure Cross-Origin Fetch Proxy for Manifest V3
 */

'use strict';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetch_media' && request.endpoint) {
    const targetUrl = request.endpoint;

    // Validate that the endpoint is strictly within allowed GIPHY or Tenor APIs
    if (!targetUrl.startsWith('https://api.giphy.com/') && !targetUrl.startsWith('https://tenor.googleapis.com/')) {
      sendResponse({ success: false, error: 'Unauthorized API endpoint' });
      return false;
    }

    fetch(targetUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        sendResponse({ success: true, data });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });

    // Keep message channel open for async response
    return true;
  }
});
