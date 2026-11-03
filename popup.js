/**
 * hyoumoji - Popup Menu Script
 */
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('guard-toggle');

  if (toggle && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['hyoumoji_link_protection'], (data) => {
      if (typeof data.hyoumoji_link_protection === 'boolean') {
        toggle.checked = data.hyoumoji_link_protection;
      } else {
        toggle.checked = true; // Enabled by default
      }
    });

    toggle.addEventListener('change', () => {
      chrome.storage.local.set({ hyoumoji_link_protection: toggle.checked });
    });
  }
});
