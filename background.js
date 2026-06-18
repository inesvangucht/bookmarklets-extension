// background.js — handles messages from content script that need scripting API

// Show the welcome / pin guide once, only on a fresh install (not on update).
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});

function runScript(tabId, code) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: (c) => {
      try {
        // eslint-disable-next-line no-eval
        eval(c);
      } catch (e) {
        console.error('[Bookmarklets] Script error:', e);
      }
    },
    args: [code],
    world: 'MAIN'
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'EXECUTE_SCRIPT') {
    runScript(sender.tab.id, msg.code)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true; // async
  }

  if (msg.type === 'EXECUTE_SCRIPT_NEW_TAB') {
    chrome.tabs.create({ url: msg.url }, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        sendResponse({ ok: false, error: chrome.runtime.lastError?.message || 'Could not open tab' });
        return;
      }
      // Wait for the new tab to finish loading, then inject the snippet.
      const listener = (tabId, info) => {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          runScript(tab.id, msg.code)
            .then(() => sendResponse({ ok: true }))
            .catch(e => sendResponse({ ok: false, error: e.message }));
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
    return true; // async
  }
});
