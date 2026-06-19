// content.js — injected into every page

(function () {
  if (document.getElementById('bml-root')) return; // already injected

  /* ─── Constants ─────────────────────────────────────────────────── */
  const STORAGE_KEY = 'bml_data';

  const TYPE_META = {
    path:       { label: 'Path navigation',   icon: '🔗', color: '#2a5a2a' },
    query:      { label: 'Query injector',    icon: '🔍', color: '#1a2a5a' },
    script:     { label: 'JS snippet',        icon: '⚡', color: '#3a1a5a' },
    replace:    { label: 'URL find & replace', icon: '🔄', color: '#5a4a1a' },
    switchroot: { label: 'Switch root',       icon: '🌍', color: '#1a3a3a' },
  };

  const EMOJIS = [
    '🔗','🔍','⚡','🔄','🚀','🛠','📋','📌','🏷','🔧','🌐','📂',
    '🧩','🎯','🗂','💡','⚙️','🖥','📡','🔑','🔐','🧪','📊','🗃',
    '🎛','📝','🔔','💾','🧭','🏠','🔁','🌀',
  ];

  const BG_COLORS = [
    '#1a2a1a','#1a1a2a','#2a1a2a','#2a2a1a','#2a1a1a','#1a2a2a',
    '#251a30','#301a1a','#1a2530','#1a301a',
  ];

  const DEFAULT_DATA = {
    groups: [
      {
        id: 'g1', name: 'AEM Console', emoji: '🛠', collapsed: false,
        items: [
          { id: 'i1', name: 'OSGi Bundles', type: 'path', emoji: '🧩', bg: '#1a2a1a',
            config: { path: '/system/console/bundles' } },
          { id: 'i2', name: 'No Cache', type: 'query', emoji: '🔄', bg: '#1a1a2a',
            config: { query: 'nocache=true' } },
        ]
      },
      {
        id: 'g2', name: 'Dev Utilities', emoji: '⚙️', collapsed: false,
        items: []
      }
    ]
  };

  /* ─── State ──────────────────────────────────────────────────────── */
  let data = { groups: [] };
  let sidebarOpen = false;
  let currentTheme = BML_DEFAULT_THEME;
  let modalMode = null; // { type: 'group'|'item', groupId?, itemId? }
  let dragState = null;

  /* ─── Storage ────────────────────────────────────────────────────── */
  function loadData() {
    return new Promise(res => {
      chrome.storage.sync.get(STORAGE_KEY, r => {
        data = r[STORAGE_KEY] || DEFAULT_DATA;
        res();
      });
    });
  }

  function saveData() {
    chrome.storage.sync.set({ [STORAGE_KEY]: data });
  }

  /* ─── DOM helpers ────────────────────────────────────────────────── */
  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      e.append(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function uid() {
    return Math.random().toString(36).slice(2, 9);
  }

  /* ─── Build sidebar DOM ──────────────────────────────────────────── */
  /* ─── Inlined sidebar styles (avoids shadow-root link timing issues) ── */
  const SIDEBAR_CSS = `
*{box-sizing:border-box;font-family:'Segoe UI',system-ui,sans-serif}
:host{all:initial}
#bml-sidebar{position:fixed;top:0;right:0;width:0;height:100vh;z-index:2147483647;display:flex;flex-direction:row;pointer-events:none}
#bml-tab{position:fixed;top:50%;right:0;transform:translateY(-50%);width:22px;height:72px;background:var(--bml-tab-bg);border-radius:8px 0 0 8px;cursor:pointer;pointer-events:all;z-index:2147483647;display:flex;align-items:center;justify-content:center;box-shadow:-2px 0 12px rgba(0,0,0,.3);transition:width .2s,background .2s;border:1px solid var(--bml-border-strong);border-right:none}
#bml-tab:hover{width:26px;background:var(--bml-hover)}
#bml-tab-arrow{color:var(--bml-accent);font-size:11px;line-height:1;transition:transform .3s;user-select:none}
#bml-sidebar.open #bml-tab-arrow{transform:rotate(180deg)}
#bml-sidebar.open #bml-tab{right:320px}
#bml-panel{position:fixed;top:0;right:-320px;width:320px;height:100vh;background:var(--bml-panel);border-left:1px solid var(--bml-border);box-shadow:-8px 0 32px rgba(0,0,0,.5);display:flex;flex-direction:column;pointer-events:all;transition:right .3s cubic-bezier(.4,0,.2,1);z-index:2147483646;overflow:hidden}
#bml-sidebar.open #bml-panel{right:0}
#bml-header{padding:16px 16px 12px;border-bottom:1px solid var(--bml-border-subtle);display:flex;align-items:center;gap:10px;flex-shrink:0}
#bml-logo{width:28px;height:28px;background:linear-gradient(135deg,var(--bml-accent),var(--bml-accent-alt));border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
#bml-title{color:var(--bml-heading);font-size:14px;font-weight:600;letter-spacing:.3px;flex:1}
#bml-add-group-btn{width:26px;height:26px;background:var(--bml-hover);border:1px solid var(--bml-border-strong);border-radius:6px;color:var(--bml-accent);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1;transition:background .15s;flex-shrink:0}
#bml-add-group-btn:hover{background:var(--bml-active)}
#bml-search-wrap{padding:10px 12px 0;flex-shrink:0}
#bml-search{width:100%;background:var(--bml-input);border:1px solid var(--bml-border);border-radius:7px;color:var(--bml-text);font-size:12px;padding:7px 10px 7px 28px;outline:none;transition:border-color .2s;background-repeat:no-repeat;background-position:8px center}
#bml-search:focus{border-color:var(--bml-accent)}
#bml-search::placeholder{color:var(--bml-text-ghost)}
#bml-groups{flex:1;overflow-y:auto;padding:10px 0 80px;scrollbar-width:thin;scrollbar-color:var(--bml-border) transparent}
#bml-groups::-webkit-scrollbar{width:4px}
#bml-groups::-webkit-scrollbar-thumb{background:var(--bml-border);border-radius:2px}
.bml-group{margin-bottom:2px}
.bml-group-header{display:flex;align-items:center;padding:6px 12px;cursor:pointer;gap:6px;user-select:none;transition:background .15s}
.bml-group-header:hover{background:var(--bml-raised)}
.bml-group-chevron{color:var(--bml-text-ghost);font-size:10px;transition:transform .2s;flex-shrink:0}
.bml-group.collapsed .bml-group-chevron{transform:rotate(-90deg)}
.bml-group-emoji{font-size:14px;flex-shrink:0}
.bml-group-name{color:var(--bml-text-secondary);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;flex:1}
.bml-group-count{color:var(--bml-text-ghost);font-size:10px;background:var(--bml-input);padding:1px 5px;border-radius:10px}
.bml-group-actions{display:none;gap:3px}
.bml-group-header:hover .bml-group-actions{display:flex}
.bml-icon-btn{width:20px;height:20px;background:none;border:none;color:var(--bml-text-muted);cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;padding:0;transition:color .15s,background .15s}
.bml-icon-btn:hover{color:var(--bml-text-secondary);background:var(--bml-hover)}
.bml-icon-btn.danger:hover{color:var(--bml-error);background:var(--bml-danger-bg)}
.bml-items{padding:2px 8px 4px}
.bml-group.collapsed .bml-items{display:none}
.bml-item{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:7px;cursor:pointer;transition:background .15s;position:relative}
.bml-item:hover{background:var(--bml-raised)}
.bml-item-icon{width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;transition:transform .15s}
.bml-item:hover .bml-item-icon{transform:scale(1.1)}
.bml-item-icon.type-path{background:var(--bml-type-path)}
.bml-item-icon.type-query{background:var(--bml-type-query)}
.bml-item-icon.type-script{background:var(--bml-type-script)}
.bml-item-icon.type-replace{background:var(--bml-type-replace)}
.bml-item-icon.type-switchroot{background:var(--bml-type-switchroot)}
.bml-item-info{flex:1;min-width:0}
.bml-item-name{color:var(--bml-text);font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bml-item-desc{color:var(--bml-text-dim);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.bml-item-actions{display:none;gap:2px}
.bml-item:hover .bml-item-actions{display:flex}
.bml-add-item-btn{width:100%;background:none;border:1px dashed var(--bml-border);color:var(--bml-text-ghost);font-size:11px;padding:6px;border-radius:7px;cursor:pointer;margin-top:4px;transition:border-color .15s,color .15s;display:flex;align-items:center;justify-content:center;gap:4px}
.bml-add-item-btn:hover{border-color:var(--bml-accent);color:var(--bml-text-label)}
#bml-toast{position:fixed;bottom:60px;right:16px;background:var(--bml-hover);border:1px solid var(--bml-border);color:var(--bml-text);font-size:12px;padding:8px 12px;border-radius:8px;opacity:0;transform:translateY(8px);transition:opacity .2s,transform .2s;pointer-events:none;z-index:2147483647;max-width:280px}
#bml-toast.show{opacity:1;transform:translateY(0)}
#bml-toast.success{border-color:var(--bml-success-bg);color:var(--bml-success-text)}
#bml-toast.error{border-color:var(--bml-error-bg);color:var(--bml-error-text)}
#bml-footer{position:absolute;bottom:0;left:0;right:0;padding:10px 12px;border-top:1px solid var(--bml-border-dim);background:var(--bml-panel);display:flex;gap:6px}
#bml-footer button{flex:1;padding:7px;border-radius:7px;border:1px solid var(--bml-border);background:var(--bml-raised);color:var(--bml-text-muted);font-size:11px;cursor:pointer;transition:background .15s,color .15s}
#bml-footer button:hover{background:var(--bml-hover);color:var(--bml-text-secondary)}
#bml-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:2147483647;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s;backdrop-filter:blur(2px)}
#bml-modal-overlay.open{opacity:1;pointer-events:all}
#bml-modal{background:var(--bml-surface);border:1px solid var(--bml-border);border-radius:12px;width:380px;max-height:85vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.6);transform:translateY(10px) scale(.97);transition:transform .2s}
#bml-modal-overlay.open #bml-modal{transform:translateY(0) scale(1)}
.bml-modal-header{padding:18px 20px 14px;border-bottom:1px solid var(--bml-border-subtle);display:flex;align-items:center;justify-content:space-between}
.bml-modal-title{color:var(--bml-heading);font-size:15px;font-weight:600}
.bml-modal-close{width:28px;height:28px;background:var(--bml-hover);border:none;border-radius:6px;color:var(--bml-text-muted);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:color .15s}
.bml-modal-close:hover{color:var(--bml-text)}
.bml-modal-body{padding:18px 20px;display:flex;flex-direction:column;gap:14px}
.bml-field{display:flex;flex-direction:column;gap:5px}
.bml-label{color:var(--bml-text-label);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px}
.bml-input,.bml-select,.bml-textarea{background:var(--bml-raised);border:1px solid var(--bml-border);border-radius:7px;color:var(--bml-text);font-size:13px;padding:8px 10px;outline:none;transition:border-color .2s;width:100%;font-family:inherit}
.bml-input:focus,.bml-select:focus,.bml-textarea:focus{border-color:var(--bml-accent)}
.bml-textarea{resize:vertical;min-height:80px;font-family:'Consolas','Fira Code',monospace;font-size:12px}
.bml-select option{background:var(--bml-raised)}
.bml-type-fields{display:flex;flex-direction:column;gap:14px}
.bml-emoji-grid{display:flex;flex-wrap:wrap;gap:5px;padding:8px;background:var(--bml-raised);border:1px solid var(--bml-border);border-radius:7px;max-height:120px;overflow-y:auto}
.bml-emoji-opt{width:30px;height:30px;border-radius:5px;border:1px solid transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:background .1s}
.bml-emoji-opt:hover{background:var(--bml-active)}
.bml-emoji-opt.active{border-color:var(--bml-accent);background:var(--bml-hover)}
.bml-color-row{display:flex;gap:6px}
.bml-color-swatch{width:24px;height:24px;border-radius:5px;cursor:pointer;border:2px solid transparent;transition:transform .1s,border-color .1s}
.bml-color-swatch:hover{transform:scale(1.15)}
.bml-color-swatch.active{border-color:#fff}
.bml-modal-footer{padding:14px 20px 18px;border-top:1px solid var(--bml-border-subtle);display:flex;gap:8px;justify-content:flex-end}
.bml-btn{padding:8px 18px;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;transition:background .15s,transform .1s;border:none}
.bml-btn:active{transform:scale(.97)}
.bml-btn-ghost{background:var(--bml-input);border:1px solid var(--bml-border);color:var(--bml-text-label)}
.bml-btn-ghost:hover{background:var(--bml-hover);color:var(--bml-text-secondary)}
.bml-btn-primary{background:linear-gradient(135deg,var(--bml-gradient-from),var(--bml-gradient-to));color:#fff}
.bml-btn-primary:hover{filter:brightness(1.15)}
.bml-item.search-hide{display:none}
`;

  function buildSidebar() {
    const root = el('div', { id: 'bml-root' });
    root.attachShadow({ mode: 'open' });

    // Inline styles directly — avoids shadow-root link timing/CSP issues
    const style = document.createElement('style');
    style.textContent = SIDEBAR_CSS;
    root.shadowRoot.appendChild(style);

    const sidebar = el('div', { id: 'bml-sidebar' });

    // Tab handle
    const tab = el('div', { id: 'bml-tab', onclick: toggleSidebar });
    const arrow = el('div', { id: 'bml-tab-arrow' }, '◀');
    tab.appendChild(arrow);

    // Panel
    const panel = el('div', { id: 'bml-panel' });

    // Header
    const header = el('div', { id: 'bml-header' });
    const logo = el('div', { id: 'bml-logo' }, '⚡');
    const title = el('div', { id: 'bml-title' }, 'Bookmarklets');
    const addGroupBtn = el('button', {
      id: 'bml-add-group-btn',
      title: 'Add group',
      onclick: () => openGroupModal(null)
    }, '+');
    header.append(logo, title, addGroupBtn);

    // Search
    const searchWrap = el('div', { id: 'bml-search-wrap' });
    const search = el('input', {
      id: 'bml-search',
      type: 'text',
      placeholder: 'Search bookmarklets…',
      oninput: onSearch,
    });
    searchWrap.appendChild(search);

    // Groups list
    const groups = el('div', { id: 'bml-groups' });

    // Footer
    const footer = el('div', { id: 'bml-footer' });
    const exportBtn = el('button', { onclick: exportData }, '⬆ Export');
    const importBtn = el('button', { onclick: importData }, '⬇ Import');
    footer.append(exportBtn, importBtn);

    // Toast
    const toast = el('div', { id: 'bml-toast' });

    panel.append(header, searchWrap, groups, footer, toast);
    sidebar.append(tab, panel);
    root.shadowRoot.append(sidebar);

    // Modal (appended outside sidebar so it covers full page)
    const overlay = buildModal();
    root.shadowRoot.appendChild(overlay);

    document.documentElement.appendChild(root);

    renderGroups();
  }

  /* ─── Render ─────────────────────────────────────────────────────── */
  function getEl(id) {
    return document.getElementById('bml-root')?.shadowRoot?.getElementById(id);
  }

  /* Check if a bookmarklet group should be visible on the current page */
  function isGroupVisibleHere(group) {
    const linkedIds = group.urlGroupIds;
    // No linking or empty array → show everywhere
    if (!linkedIds || linkedIds.length === 0) return true;
    // Check if any linked URL group has a root matching the current page
    const hostname = window.location.hostname;
    const port = window.location.port;
    for (const ugId of linkedIds) {
      const ug = cachedUrlGroups.find(g => g.id === ugId);
      if (ug && ug.roots.some(p => matchesRoot(p, hostname, port))) return true;
    }
    return false;
  }

  let cachedUrlGroups = [];

  function renderGroups() {
    const container = getEl('bml-groups');
    if (!container) return;
    container.innerHTML = '';

    for (const group of data.groups) {
      if (isGroupVisibleHere(group)) {
        container.appendChild(buildGroupEl(group));
      }
    }
  }

  function buildGroupEl(group) {
    const div = el('div', { class: `bml-group${group.collapsed ? ' collapsed' : ''}` });
    div.dataset.gid = group.id;

    // Header row
    const hdr = el('div', { class: 'bml-group-header' });

    const chevron = el('span', { class: 'bml-group-chevron' }, '▾');
    const emoji   = el('span', { class: 'bml-group-emoji' }, group.emoji || '📂');
    const name    = el('span', { class: 'bml-group-name' }, group.name);
    const count   = el('span', { class: 'bml-group-count' }, String(group.items.length));

    const actions = el('div', { class: 'bml-group-actions' });
    const editBtn = el('button', {
      class: 'bml-icon-btn', title: 'Edit group',
      onclick: (e) => { e.stopPropagation(); openGroupModal(group.id); }
    }, '✏️');
    const delBtn = el('button', {
      class: 'bml-icon-btn danger', title: 'Delete group',
      onclick: (e) => { e.stopPropagation(); deleteGroup(group.id); }
    }, '🗑');
    actions.append(editBtn, delBtn);

    hdr.append(chevron, emoji, name, count, actions);
    hdr.addEventListener('click', () => toggleGroup(group.id));

    // Items
    const items = el('div', { class: 'bml-items' });
    for (const item of group.items) {
      items.appendChild(buildItemEl(item, group.id));
    }

    // Add item button
    const addBtn = el('button', {
      class: 'bml-add-item-btn',
      onclick: () => openItemModal(group.id, null)
    }, '+ Add bookmarklet');
    items.appendChild(addBtn);

    div.append(hdr, items);
    return div;
  }

  function buildItemEl(item, groupId) {
    const div = el('div', { class: 'bml-item' });
    div.dataset.iid = item.id;
    div.dataset.gid = groupId;

    const iconDiv = el('div', {
      class: `bml-item-icon type-${item.type}`,
      style: `background:${item.bg || BG_COLORS[0]}`
    }, item.emoji || TYPE_META[item.type]?.icon || '🔗');

    const info = el('div', { class: 'bml-item-info' });
    const name = el('div', { class: 'bml-item-name' }, item.name);
    const desc = el('div', { class: 'bml-item-desc' }, getItemDesc(item));
    info.append(name, desc);

    const actions = el('div', { class: 'bml-item-actions' });
    const newTabBtn = el('button', {
      class: 'bml-icon-btn', title: 'Open in new tab',
      onclick: (e) => { e.stopPropagation(); openItemInNewTab(item); }
    }, '↗');
    actions.appendChild(newTabBtn);
    const editBtn = el('button', {
      class: 'bml-icon-btn', title: 'Edit',
      onclick: (e) => { e.stopPropagation(); openItemModal(groupId, item.id); }
    }, '✏️');
    const delBtn = el('button', {
      class: 'bml-icon-btn danger', title: 'Delete',
      onclick: (e) => { e.stopPropagation(); deleteItem(groupId, item.id); }
    }, '🗑');
    actions.append(editBtn, delBtn);

    div.append(iconDiv, info, actions);

    // Execute on click (not on action buttons)
    div.addEventListener('click', () => executeItem(item));

    // Drag
    div.draggable = true;
    div.addEventListener('dragstart', onDragStart);
    div.addEventListener('dragover',  onDragOver);
    div.addEventListener('drop',      onDrop);
    div.addEventListener('dragend',   onDragEnd);

    return div;
  }

  function getItemDesc(item) {
    if (!item.config) return '';
    switch (item.type) {
      case 'path':    return item.config.path || '';
      case 'query':   return `?${item.config.query || ''}`;
      case 'replace': return `${item.config.find || ''} → ${item.config.replaceWith || ''}`;
      case 'switchroot': return item.config.targetRoot || '';
      case 'script':  return (item.config.code || '').slice(0, 50) + '…';
      default: return '';
    }
  }

  /* ─── Dynamic tokens ─────────────────────────────────────────────── */
  function resolveTokens(str) {
    if (!str) return str;
    return str
      .replace(/\{random:(\d+)\}/g, (_, n) => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let out = '';
        for (let i = 0; i < Number(n); i++) out += chars[Math.floor(Math.random() * chars.length)];
        return out;
      })
      .replace(/\{random\}/g, () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let out = '';
        for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
        return out;
      })
      .replace(/\{ts\}/g, () => String(Date.now()))
      .replace(/\{date\}/g, () => new Date().toISOString().slice(0, 10));
  }

  /* ─── Execute ────────────────────────────────────────────────────── */
  function getItemUrl(item) {
    switch (item.type) {
      case 'path': {
        const path = resolveTokens(item.config.path || '');
        return window.location.origin + path;
      }
      case 'query': {
        const q = resolveTokens(item.config.query || '');
        const url = window.location.href;
        return url.includes('?') ? url + '&' + q : url + '?' + q;
      }
      case 'replace': {
        const find = item.config.find;
        const replaceWith = resolveTokens(item.config.replaceWith || '');
        if (!find) return null;
        return window.location.href.split(find).join(replaceWith);
      }
      case 'switchroot': {
        let targetRoot = resolveTokens((item.config.targetRoot || '').replace(/\/+$/, ''));
        if (!targetRoot) return null;
        if (!/^https?:\/\//i.test(targetRoot)) targetRoot = 'https://' + targetRoot;
        const url = new URL(window.location.href);
        return targetRoot + url.pathname + url.search + url.hash;
      }
      default: return null;
    }
  }

  function openItemInNewTab(item) {
    if (item.type === 'script') {
      const code = resolveTokens(item.config.code || '');
      // Strip bookmarklet wrapper if present
      const stripped = code.replace(/^javascript:/i, '').trim();
      if (!stripped) return;
      chrome.runtime.sendMessage(
        { type: 'EXECUTE_SCRIPT_NEW_TAB', code: stripped, url: window.location.href },
        (res) => {
          if (res?.ok) showToast('✓ Opened in new tab', 'success');
          else showToast('Script error: ' + (res?.error || '?'), 'error');
        }
      );
      return;
    }
    const url = getItemUrl(item);
    if (url) { window.open(url, '_blank'); showToast('✓ Opened in new tab', 'success'); }
  }

  function executeItem(item) {
    try {
      switch (item.type) {
        case 'path': {
          const path = resolveTokens(item.config.path || '');
          window.location.href = window.location.origin + path;
          break;
        }
        case 'query': {
          const q = resolveTokens(item.config.query || '');
          const url = window.location.href;
          window.location.href = url.includes('?')
            ? url + '&' + q
            : url + '?' + q;
          break;
        }
        case 'replace': {
          const find = item.config.find;
          const replaceWith = resolveTokens(item.config.replaceWith || '');
          if (!find) break;
          const newUrl = window.location.href.split(find).join(replaceWith);
          window.location.href = newUrl;
          break;
        }
        case 'switchroot': {
          let targetRoot = resolveTokens((item.config.targetRoot || '').replace(/\/+$/, ''));
          if (!targetRoot) break;
          if (!/^https?:\/\//i.test(targetRoot)) targetRoot = 'https://' + targetRoot;
          const url = new URL(window.location.href);
          window.location.href = targetRoot + url.pathname + url.search + url.hash;
          break;
        }
        case 'script': {
          const code = resolveTokens(item.config.code || '');
          // Strip bookmarklet wrapper if present
          const stripped = code.replace(/^javascript:/i, '').trim();
          chrome.runtime.sendMessage({ type: 'EXECUTE_SCRIPT', code: stripped }, (res) => {
            if (res?.ok) showToast('✓ Script executed', 'success');
            else showToast('Script error: ' + (res?.error || '?'), 'error');
          });
          return; // async, skip toast below
        }
      }
      showToast('✓ Done', 'success');
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  }

  /* ─── Toggle sidebar ─────────────────────────────────────────────── */
  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    const sidebar = getEl('bml-sidebar');
    if (sidebarOpen) sidebar.classList.add('open');
    else sidebar.classList.remove('open');
  }

  function toggleGroup(id) {
    const group = data.groups.find(g => g.id === id);
    if (!group) return;
    group.collapsed = !group.collapsed;
    saveData();
    renderGroups();
  }

  /* ─── Search ─────────────────────────────────────────────────────── */
  function onSearch(e) {
    const q = e.target.value.toLowerCase().trim();
    const allItems = document.getElementById('bml-root')?.shadowRoot?.querySelectorAll('.bml-item');
    allItems?.forEach(el => {
      const name = el.querySelector('.bml-item-name')?.textContent?.toLowerCase() || '';
      const desc = el.querySelector('.bml-item-desc')?.textContent?.toLowerCase() || '';
      if (!q || name.includes(q) || desc.includes(q)) {
        el.classList.remove('search-hide');
      } else {
        el.classList.add('search-hide');
      }
    });
  }

  /* ─── Drag & Drop (reorder items) ───────────────────────────────── */
  function onDragStart(e) {
    dragState = { iid: e.currentTarget.dataset.iid, gid: e.currentTarget.dataset.gid };
    e.currentTarget.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onDrop(e) {
    e.preventDefault();
    const targetIid = e.currentTarget.dataset.iid;
    const targetGid = e.currentTarget.dataset.gid;
    if (!dragState || dragState.iid === targetIid) return;

    // Move within/across groups
    const srcGroup  = data.groups.find(g => g.id === dragState.gid);
    const tgtGroup  = data.groups.find(g => g.id === targetGid);
    if (!srcGroup || !tgtGroup) return;

    const srcIdx = srcGroup.items.findIndex(i => i.id === dragState.iid);
    const tgtIdx = tgtGroup.items.findIndex(i => i.id === targetIid);
    if (srcIdx === -1) return;

    const [moved] = srcGroup.items.splice(srcIdx, 1);
    tgtGroup.items.splice(tgtIdx >= 0 ? tgtIdx : tgtGroup.items.length, 0, moved);

    saveData();
    renderGroups();
  }

  function onDragEnd(e) {
    e.currentTarget.style.opacity = '';
    dragState = null;
  }

  /* ─── Modal ──────────────────────────────────────────────────────── */
  function buildModal() {
    const overlay = el('div', { id: 'bml-modal-overlay' });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    const modal = el('div', { id: 'bml-modal' });

    const mHdr = el('div', { class: 'bml-modal-header' });
    const mTitle = el('div', { class: 'bml-modal-title', id: 'bml-modal-title' }, 'Add Group');
    const mClose = el('button', { class: 'bml-modal-close', onclick: closeModal }, '✕');
    mHdr.append(mTitle, mClose);

    const mBody = el('div', { class: 'bml-modal-body', id: 'bml-modal-body' });

    const mFoot = el('div', { class: 'bml-modal-footer' });
    const mCancel = el('button', { class: 'bml-btn bml-btn-ghost', onclick: closeModal }, 'Cancel');
    const mSave   = el('button', { class: 'bml-btn bml-btn-primary', id: 'bml-modal-save', onclick: saveModal }, 'Save');
    mFoot.append(mCancel, mSave);

    modal.append(mHdr, mBody, mFoot);
    overlay.appendChild(modal);
    return overlay;
  }

  function openGroupModal(groupId) {
    modalMode = { type: 'group', groupId };
    const group = groupId ? data.groups.find(g => g.id === groupId) : null;

    getEl('bml-modal-title').textContent = group ? 'Edit Group' : 'New Group';

    const body = getEl('bml-modal-body');
    body.innerHTML = '';

    // Name
    const nameField = el('div', { class: 'bml-field' });
    nameField.append(
      el('label', { class: 'bml-label' }, 'Group Name'),
      el('input', { class: 'bml-input', id: 'mf-group-name', type: 'text',
        value: group?.name || '', placeholder: 'e.g. AEM Console' })
    );

    // Emoji picker
    const emojiField = el('div', { class: 'bml-field' });
    emojiField.append(el('label', { class: 'bml-label' }, 'Icon'));
    const grid = el('div', { class: 'bml-emoji-grid', id: 'mf-emoji-grid' });
    for (const e of EMOJIS) {
      const opt = el('div', { class: `bml-emoji-opt${(group?.emoji || '📂') === e ? ' active' : ''}` }, e);
      opt.dataset.emoji = e;
      opt.addEventListener('click', () => {
        grid.querySelectorAll('.bml-emoji-opt').forEach(x => x.classList.remove('active'));
        opt.classList.add('active');
      });
      grid.appendChild(opt);
    }
    emojiField.appendChild(grid);

    body.append(nameField, emojiField);
    getEl('bml-modal-overlay').classList.add('open');
    getEl('mf-group-name').focus();
  }

  function openItemModal(groupId, itemId) {
    modalMode = { type: 'item', groupId, itemId };
    const group = data.groups.find(g => g.id === groupId);
    const item  = itemId ? group?.items.find(i => i.id === itemId) : null;

    getEl('bml-modal-title').textContent = item ? 'Edit Bookmarklet' : 'New Bookmarklet';

    const body = getEl('bml-modal-body');
    body.innerHTML = '';

    // Name
    const nameField = el('div', { class: 'bml-field' });
    nameField.append(
      el('label', { class: 'bml-label' }, 'Name'),
      el('input', { class: 'bml-input', id: 'mf-item-name', type: 'text',
        value: item?.name || '', placeholder: 'e.g. OSGi Bundles' })
    );

    // Type selector
    const typeField = el('div', { class: 'bml-field' });
    const typeSelect = el('select', { class: 'bml-select', id: 'mf-item-type' });
    for (const [k, v] of Object.entries(TYPE_META)) {
      const opt = el('option', { value: k }, v.label);
      if (item?.type === k) opt.selected = true;
      typeSelect.appendChild(opt);
    }
    typeField.append(el('label', { class: 'bml-label' }, 'Type'), typeSelect);

    // Dynamic config area
    const configArea = el('div', { class: 'bml-type-fields', id: 'mf-config-area' });
    function renderConfigFields(type) {
      configArea.innerHTML = '';
      const cfg = item?.config || {};
      switch (type) {
        case 'path': {
          const f = el('div', { class: 'bml-field' });
          f.append(
            el('label', { class: 'bml-label' }, 'Path'),
            el('input', { class: 'bml-input', id: 'mf-path', type: 'text',
              value: cfg.path || '', placeholder: '/system/console/bundles' })
          );
          configArea.appendChild(f);
          break;
        }
        case 'query': {
          const f = el('div', { class: 'bml-field' });
          f.append(
            el('label', { class: 'bml-label' }, 'Query string (no leading ?)'),
            el('input', { class: 'bml-input', id: 'mf-query', type: 'text',
              value: cfg.query || '', placeholder: 'nocache=true' })
          );
          configArea.appendChild(f);
          break;
        }
        case 'replace': {
          const f1 = el('div', { class: 'bml-field' });
          f1.append(
            el('label', { class: 'bml-label' }, 'Find'),
            el('input', { class: 'bml-input', id: 'mf-find', type: 'text',
              value: cfg.find || '', placeholder: 'author.prod' })
          );
          const f2 = el('div', { class: 'bml-field' });
          f2.append(
            el('label', { class: 'bml-label' }, 'Replace with'),
            el('input', { class: 'bml-input', id: 'mf-replace', type: 'text',
              value: cfg.replaceWith || '', placeholder: 'author.staging' })
          );
          configArea.append(f1, f2);
          break;
        }
        case 'script': {
          const f = el('div', { class: 'bml-field' });
          f.append(
            el('label', { class: 'bml-label' }, 'JavaScript / Bookmarklet code'),
            el('textarea', { class: 'bml-textarea', id: 'mf-code',
              placeholder: "javascript:(function(){...})();\nor just plain JS" },
              cfg.code || '')
          );
          configArea.appendChild(f);
          break;
        }
        case 'switchroot': {
          const f = el('div', { class: 'bml-field' });
          f.append(
            el('label', { class: 'bml-label' }, 'Target root (origin)'),
            el('input', { class: 'bml-input', id: 'mf-targetroot', type: 'text',
              value: cfg.targetRoot || '', placeholder: 'dev.myco.com or https://dev.myco.com' })
          );
          configArea.appendChild(f);
          break;
        }
      }
    }

    renderConfigFields(item?.type || 'path');
    typeSelect.addEventListener('change', () => renderConfigFields(typeSelect.value));

    // Emoji picker
    const emojiField = el('div', { class: 'bml-field' });
    emojiField.append(el('label', { class: 'bml-label' }, 'Icon'));
    const grid = el('div', { class: 'bml-emoji-grid', id: 'mf-item-emoji-grid' });
    const currentEmoji = item?.emoji || TYPE_META[item?.type || 'path'].icon;
    for (const e of EMOJIS) {
      const opt = el('div', { class: `bml-emoji-opt${currentEmoji === e ? ' active' : ''}` }, e);
      opt.dataset.emoji = e;
      opt.addEventListener('click', () => {
        grid.querySelectorAll('.bml-emoji-opt').forEach(x => x.classList.remove('active'));
        opt.classList.add('active');
      });
      grid.appendChild(opt);
    }
    emojiField.appendChild(grid);

    // Color picker
    const colorField = el('div', { class: 'bml-field' });
    colorField.append(el('label', { class: 'bml-label' }, 'Icon background'));
    const colorRow = el('div', { class: 'bml-color-row' });
    const currentBg = item?.bg || BG_COLORS[0];
    for (const c of BG_COLORS) {
      const sw = el('div', { class: `bml-color-swatch${currentBg === c ? ' active' : ''}`,
        style: `background:${c}` });
      sw.dataset.color = c;
      sw.addEventListener('click', () => {
        colorRow.querySelectorAll('.bml-color-swatch').forEach(x => x.classList.remove('active'));
        sw.classList.add('active');
      });
      colorRow.appendChild(sw);
    }
    colorField.appendChild(colorRow);

    body.append(nameField, typeField, configArea, emojiField, colorField);
    getEl('bml-modal-overlay').classList.add('open');
    getEl('mf-item-name').focus();
  }

  function saveModal() {
    if (!modalMode) return;

    if (modalMode.type === 'group') {
      const name  = getEl('mf-group-name')?.value?.trim();
      if (!name) { showToast('Group name required', 'error'); return; }
      const emoji = getEl('mf-emoji-grid')?.querySelector('.active')?.dataset?.emoji || '📂';

      if (modalMode.groupId) {
        const g = data.groups.find(x => x.id === modalMode.groupId);
        if (g) { g.name = name; g.emoji = emoji; }
      } else {
        data.groups.push({ id: uid(), name, emoji, collapsed: false, items: [] });
      }
    }

    if (modalMode.type === 'item') {
      const name  = getEl('mf-item-name')?.value?.trim();
      const type  = getEl('mf-item-type')?.value;
      const emoji = getEl('mf-item-emoji-grid')?.querySelector('.active')?.dataset?.emoji
                    || TYPE_META[type]?.icon || '🔗';
      const bg    = getEl('bml-modal-body')?.querySelector('.bml-color-swatch.active')?.dataset?.color
                    || BG_COLORS[0];
      if (!name) { showToast('Name required', 'error'); return; }

      const config = {};
      if (type === 'path')    config.path       = getEl('mf-path')?.value?.trim() || '';
      if (type === 'query')   config.query      = getEl('mf-query')?.value?.trim() || '';
      if (type === 'replace') { config.find = getEl('mf-find')?.value?.trim() || ''; config.replaceWith = getEl('mf-replace')?.value?.trim() || ''; }
      if (type === 'script')  config.code       = getEl('mf-code')?.value?.trim() || '';
      if (type === 'switchroot') config.targetRoot = getEl('mf-targetroot')?.value?.trim() || '';

      const group = data.groups.find(g => g.id === modalMode.groupId);
      if (!group) return;

      if (modalMode.itemId) {
        const idx = group.items.findIndex(i => i.id === modalMode.itemId);
        if (idx >= 0) group.items[idx] = { ...group.items[idx], name, type, emoji, bg, config };
      } else {
        group.items.push({ id: uid(), name, type, emoji, bg, config });
      }
    }

    saveData();
    renderGroups();
    closeModal();
    showToast('✓ Saved', 'success');
  }

  function closeModal() {
    getEl('bml-modal-overlay')?.classList.remove('open');
    modalMode = null;
  }

  /* ─── Delete ─────────────────────────────────────────────────────── */
  function deleteGroup(id) {
    const g = data.groups.find(x => x.id === id);
    if (!g) return;
    if (!confirm(`Delete group "${g.name}" and all its bookmarklets?`)) return;
    data.groups = data.groups.filter(x => x.id !== id);
    saveData();
    renderGroups();
  }

  function deleteItem(groupId, itemId) {
    const g = data.groups.find(x => x.id === groupId);
    if (!g) return;
    g.items = g.items.filter(i => i.id !== itemId);
    saveData();
    renderGroups();
  }

  /* ─── Import / Export ────────────────────────────────────────────── */
  function exportData() {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bookmarklets.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (!Array.isArray(parsed.groups)) throw new Error('Invalid format');
          data = parsed;
          saveData();
          renderGroups();
          showToast('✓ Imported', 'success');
        } catch (err) {
          showToast('Import failed: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  /* ─── Toast ──────────────────────────────────────────────────────── */
  let toastTimer;
  function showToast(msg, type = '') {
    const toast = getEl('bml-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.className = ''; }, 2200);
  }

  /* ─── Theme ──────────────────────────────────────────────────────── */
  function loadTheme() {
    return new Promise(res => {
      chrome.storage.sync.get(BML_THEME_KEY, r => {
        currentTheme = r[BML_THEME_KEY] || BML_DEFAULT_THEME;
        res();
      });
    });
  }

  function applyThemeToSidebar() {
    const root = document.getElementById('bml-root');
    if (!root) return;
    bmlApplyTheme(currentTheme, root);
    // Update search icon SVG color (can't use var() in data URIs)
    const search = root.shadowRoot?.getElementById('bml-search');
    if (search) {
      const color = (BML_THEMES[currentTheme] || BML_THEMES[BML_DEFAULT_THEME]).vars['--bml-text-muted'];
      const encoded = color.replace('#', '%23');
      search.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='${encoded}' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E")`;
    }
  }

  /* ─── URL root matching ─────────────────────────────────────────── */
  function matchesRoot(pattern, hostname, port) {
    const hp = port && port !== '80' && port !== '443' ? `${hostname}:${port}` : hostname;
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1);
      return hostname.endsWith(suffix) || hostname === pattern.slice(2);
    }
    if (pattern.endsWith('.*')) {
      return hostname.startsWith(pattern.slice(0, -1));
    }
    return pattern === hostname || pattern === hp;
  }

  function isAllowedOnCurrentPage(roots) {
    if (!roots || roots.length === 0) return false;
    const hostname = window.location.hostname;
    const port     = window.location.port;
    return roots.some(p => matchesRoot(p, hostname, port));
  }

  function showSidebarIfAllowed(roots) {
    if (isAllowedOnCurrentPage(roots)) {
      if (!document.getElementById('bml-root')) {
        buildSidebar();
        applyThemeToSidebar();
      } else {
        renderGroups(); // re-render to apply URL group filtering
      }
    } else {
      // Remove sidebar if roots no longer include this page
      const existing = document.getElementById('bml-root');
      if (existing) existing.remove();
      sidebarOpen = false;
    }
  }

  /* ─── Listen for live root updates from popup ───────────────────── */
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'BML_THEME_UPDATED') {
      currentTheme = msg.theme || BML_DEFAULT_THEME;
      applyThemeToSidebar();
    }
    if (msg.type === 'BML_ROOTS_UPDATED') {
      if (msg.urlGroups) cachedUrlGroups = msg.urlGroups;
      if (msg.bmlData) { data = msg.bmlData; }
      showSidebarIfAllowed(msg.roots);
    }
  });

  /* ─── Collect all roots (global + url groups) ──────────────────── */
  function getAllRoots(callback) {
    chrome.storage.sync.get(['bml_roots', 'bml_url_groups'], r => {
      const globalRoots = r['bml_roots'] || [];
      const groups      = r['bml_url_groups'] || [];
      cachedUrlGroups = groups;
      const allRoots = [...globalRoots];
      for (const g of groups) {
        for (const root of (g.roots || [])) {
          if (!allRoots.includes(root)) allRoots.push(root);
        }
      }
      callback(allRoots);
    });
  }

  /* ─── Init ───────────────────────────────────────────────────────── */
  Promise.all([loadData(), loadTheme()]).then(() => {
    getAllRoots(allRoots => {
      showSidebarIfAllowed(allRoots);
    });
  });
})();
