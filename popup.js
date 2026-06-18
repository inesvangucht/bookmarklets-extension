// popup.js
const STORAGE_KEY = 'bml_data';
const ROOTS_KEY   = 'bml_roots';
const GROUPS_KEY  = 'bml_url_groups';

// Apply theme immediately on popup open
chrome.storage.sync.get(BML_THEME_KEY, r => {
  bmlApplyTheme(r[BML_THEME_KEY] || BML_DEFAULT_THEME, document.documentElement);
});

function matchesRoot(pattern, hostname, port) {
  const hp = port && port !== '80' && port !== '443' ? `${hostname}:${port}` : hostname;
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1);
    return hostname.endsWith(suffix) || hostname === pattern.slice(2);
  }
  if (pattern.endsWith('.*')) return hostname.startsWith(pattern.slice(0, -1));
  return pattern === hostname || pattern === hp;
}

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  let hostname = '', port = '';
  try { const u = new URL(tab?.url || ''); hostname = u.hostname; port = u.port; } catch (_) {}

  chrome.storage.sync.get([STORAGE_KEY, ROOTS_KEY, GROUPS_KEY], r => {
    const roots  = r[ROOTS_KEY] || [];
    const urlGrps = r[GROUPS_KEY] || [];
    const bml    = r[STORAGE_KEY] || { groups: [] };
    const groups = bml.groups || [];
    const items  = groups.reduce((n, g) => n + (g.items?.length || 0), 0);

    // Collect all roots for status check
    const allRoots = [...roots];
    for (const g of urlGrps) {
      for (const root of (g.roots || [])) {
        if (!allRoots.includes(root)) allRoots.push(root);
      }
    }

    document.getElementById('s-groups').textContent = groups.length;
    document.getElementById('s-items').textContent  = items;
    document.getElementById('s-roots').textContent  = allRoots.length;

    const dot   = document.getElementById('dot');
    const line1 = document.getElementById('status-line1');
    const line2 = document.getElementById('status-line2');

    const addRootBtn = document.getElementById('add-root-btn');
    const hp = port && port !== '80' && port !== '443' ? `${hostname}:${port}` : hostname;

    if (!hostname) {
      line1.textContent = 'No active tab';
      line2.textContent = '';
    } else if (allRoots.some(p => matchesRoot(p, hostname, port))) {
      dot.className = 'dot on';
      line1.textContent = 'Sidebar active';
      line2.textContent = hp;
    } else {
      dot.className = 'dot off';
      line1.textContent = 'Sidebar off on this tab';
      line2.textContent = hp;

      // Show "Add this root" button
      addRootBtn.textContent = `+ Enable sidebar on ${hp}`;
      addRootBtn.classList.add('visible');
      addRootBtn.addEventListener('click', () => {
        if (roots.includes(hp)) return;
        roots.push(hp);
        chrome.storage.sync.set({ [ROOTS_KEY]: roots }, () => {
          // Update UI
          dot.className = 'dot on';
          line1.textContent = 'Sidebar active';
          addRootBtn.classList.remove('visible');
          document.getElementById('s-roots').textContent = allRoots.length + 1;

          // Broadcast to all tabs
          const updatedRoots = [...allRoots, hp];
          chrome.tabs.query({}, tabs => {
            for (const t of tabs) {
              chrome.tabs.sendMessage(t.id, {
                type: 'BML_ROOTS_UPDATED',
                roots: updatedRoots,
                urlGroups: urlGrps,
                bmlData: bml
              }).catch(() => {});
            }
          });
        });
      });
    }
  });
});

document.getElementById('open-settings').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
});
