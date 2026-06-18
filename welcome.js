// welcome.js — shown once on fresh install (see onInstalled in background.js)

// Apply the saved theme immediately so the page matches the rest of the extension.
chrome.storage.sync.get(BML_THEME_KEY, r => {
  bmlApplyTheme(r[BML_THEME_KEY] || BML_DEFAULT_THEME, document.documentElement);
});

document.getElementById('open-settings').addEventListener('click', () => {
  // Match popup.js: open the options page in a tab for Dia/Chromium-fork compatibility.
  chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
});
