// options.js
const ROOTS_KEY  = 'bml_roots';
const GROUPS_KEY = 'bml_url_groups';
const DATA_KEY   = 'bml_data';

let roots = [];
let urlGroups = [];
let bmlData = null;
let activeHostname = '';
let activePort = '';
let selectedGroupEmoji = '📂';
let selectedBmlGroupEmoji = '📂';
let dragGroupId = null;

const GROUP_EMOJIS = [
  '📂','🏠','🌐','🖥','🔗','🚀','🛠','📋','📌','🏷',
  '🔧','🧩','🎯','🗂','💡','⚙️','📡','🔑','🧪','📊',
  '🗃','🎛','📝','💾','🧭','🔁','🌀','🏢','☁️','🔒',
];

const TYPE_META = {
  path:       { label: 'Path navigation',   icon: '🔗', placeholder: '/system/console/bundles' },
  query:      { label: 'Query injector',     icon: '🔍', placeholder: 'nocache=true' },
  script:     { label: 'JS snippet',         icon: '⚡', placeholder: 'javascript:(function(){...})()' },
  replace:    { label: 'URL find & replace', icon: '🔄', placeholder: '' },
  switchroot: { label: 'Switch root',        icon: '🌍', placeholder: 'dev.myco.com or https://dev.myco.com' },
};

const TYPE_LABELS = {
  path: 'Path', query: 'Query', script: 'JS', replace: 'Replace', switchroot: 'Switch',
};

const BG_COLORS = [
  '#1a2a1a','#1a1a2a','#2a1a2a','#2a2a1a','#2a1a1a','#1a2a2a',
  '#251a30','#301a1a','#1a2530','#1a301a',
];

/* ══════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════ */

function uid() { return Math.random().toString(36).slice(2, 9); }

function normalise(raw) {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  return s;
}

function matchesRoot(pattern, hostname, port) {
  const hp = port && port !== '80' && port !== '443' ? `${hostname}:${port}` : hostname;
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1);
    return hostname.endsWith(suffix) || hostname === pattern.slice(2);
  }
  if (pattern.endsWith('.*')) return hostname.startsWith(pattern.slice(0, -1));
  return pattern === hostname || pattern === hp;
}

function isMatch(pattern) {
  return activeHostname && matchesRoot(pattern, activeHostname, activePort);
}

function iconFor(p) {
  if (/^\d+\.\d+\.\d+/.test(p)) return '🖥';
  if (p.startsWith('localhost') || p.startsWith('127.')) return '🏠';
  if (p.startsWith('*.')) return '🌐';
  return '🔗';
}

/* ══════════════════════════════════════════════════
   TAB SWITCHING
   ══════════════════════════════════════════════════ */

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

/* ══════════════════════════════════════════════════
   GLOBAL ROOTS
   ══════════════════════════════════════════════════ */

function renderRoots() {
  const body  = document.getElementById('roots-body');
  const empty = document.getElementById('roots-empty');
  body.querySelectorAll('.root-row').forEach(el => el.remove());
  if (roots.length === 0) { empty.style.display = ''; return; }
  empty.style.display = 'none';
  for (const pattern of roots) {
    const match = isMatch(pattern);
    const row = document.createElement('div');
    row.className = 'root-row' + (match ? ' is-match' : '');
    row.innerHTML = `
      <span class="root-icon">${iconFor(pattern)}</span>
      <span class="root-pattern">${pattern}</span>
      <span class="root-match-pill">✓ active now</span>
      <button class="root-del" title="Remove">×</button>
      <button class="root-add-group" title="Add to group">📂</button>
    `;
    row.querySelector('.root-del').addEventListener('click', () => removeRoot(pattern));
    const addGroupBtn = row.querySelector('.root-add-group');
    addGroupBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close any other open dropdowns
      document.querySelectorAll('.root-group-dropdown.open').forEach(d => d.classList.remove('open'));
      // Remove old dropdown and rebuild fresh each time
      const old = addGroupBtn.querySelector('.root-group-dropdown');
      if (old) { old.remove(); }
      const dropdown = document.createElement('div');
      dropdown.className = 'root-group-dropdown open';
      if (urlGroups.length === 0) {
        const msg = document.createElement('div');
        msg.className = 'root-group-dropdown-empty';
        msg.textContent = 'No URL groups yet';
        dropdown.appendChild(msg);
      } else {
        for (const g of urlGroups) {
          const inGroup = g.roots.includes(pattern);
          const item = document.createElement('button');
          item.className = 'root-group-dropdown-item' + (inGroup ? ' in-group' : '');
          item.textContent = `${g.emoji || '📂'} ${g.name}${inGroup ? ' ✓' : ''}`;
          item.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (!inGroup) {
              g.roots.push(pattern);
              saveUrlGroups(); renderRoots(); renderUrlGroups();
              toast('✓ Added to ' + g.name, 'ok');
            } else {
              g.roots = g.roots.filter(r => r !== pattern);
              saveUrlGroups(); renderRoots(); renderUrlGroups();
              toast('Removed from ' + g.name, 'ok');
            }
          });
          dropdown.appendChild(item);
        }
      }
      addGroupBtn.appendChild(dropdown);
    });
    body.appendChild(row);
  }
}

function addRoot(raw) {
  const p = normalise(raw);
  if (!p) return;
  if (roots.includes(p)) { toast('Already in the list', 'err'); return; }
  roots.push(p);
  saveRoots(); renderRoots();
  toast('✓ Added ' + p, 'ok');
}

function removeRoot(p) {
  roots = roots.filter(r => r !== p);
  saveRoots(); renderRoots();
}

function saveRoots() {
  chrome.storage.sync.set({ [ROOTS_KEY]: roots });
  broadcastRootsUpdate();
}

/* ══════════════════════════════════════════════════
   URL GROUPS
   ══════════════════════════════════════════════════ */

function renderUrlGroups() {
  const container = document.getElementById('url-groups-container');
  const empty = document.getElementById('url-groups-empty');
  container.querySelectorAll('.url-group-card').forEach(el => el.remove());
  if (urlGroups.length === 0) { empty.style.display = ''; return; }
  empty.style.display = 'none';
  for (const group of urlGroups) container.appendChild(buildUrlGroupCard(group));
}

function buildUrlGroupCard(group) {
  const card = document.createElement('div');
  card.className = 'url-group-card' + (group.collapsed ? ' collapsed' : '');
  if (group.roots.some(p => isMatch(p))) card.classList.add('has-match');

  const header = document.createElement('div');
  header.className = 'url-group-header';
  header.innerHTML = `
    <span class="url-group-chevron">▾</span>
    <span class="url-group-emoji">${group.emoji || '📂'}</span>
    <span class="url-group-name">${group.name}</span>
    <span class="url-group-count">${group.roots.length}</span>
    <span class="url-group-match-dot" title="Active on current tab"></span>
    <div class="url-group-actions">
      <button class="icon-btn edit-group-btn" title="Rename">✏️</button>
      <button class="icon-btn danger delete-group-btn" title="Delete group">🗑</button>
    </div>
  `;
  header.addEventListener('click', (e) => {
    if (e.target.closest('.url-group-actions')) return;
    group.collapsed = !group.collapsed; saveUrlGroups(); renderUrlGroups();
  });
  header.querySelector('.edit-group-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const n = prompt('Rename group:', group.name);
    if (n && n.trim()) { group.name = n.trim(); saveUrlGroups(); renderUrlGroups(); renderBmlGroups(); toast('✓ Renamed', 'ok'); }
  });
  header.querySelector('.delete-group-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!confirm(`Delete URL group "${group.name}" and all its roots?`)) return;
    if (bmlData) { for (const bg of bmlData.groups) { if (bg.urlGroupIds) bg.urlGroupIds = bg.urlGroupIds.filter(id => id !== group.id); } saveBmlData(); }
    urlGroups = urlGroups.filter(g => g.id !== group.id);
    saveUrlGroups(); renderUrlGroups(); renderBmlGroups(); toast('Group deleted', 'ok');
  });

  const body = document.createElement('div');
  body.className = 'url-group-body';
  const addRow = document.createElement('div');
  addRow.className = 'url-group-add-row';
  const input = document.createElement('input');
  input.className = 'input-field sm'; input.type = 'text'; input.placeholder = 'Add URL root to this group…';
  const addBtn = document.createElement('button');
  addBtn.className = 'add-btn sm'; addBtn.textContent = 'Add';
  const doAdd = () => {
    const p = normalise(input.value);
    if (!p) return;
    if (group.roots.includes(p)) { toast('Already in this group', 'err'); return; }
    group.roots.push(p); input.value = ''; saveUrlGroups(); renderUrlGroups(); toast('✓ Added ' + p, 'ok');
  };
  addBtn.addEventListener('click', doAdd);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
  addRow.append(input, addBtn);

  const rootsList = document.createElement('div');
  rootsList.className = 'url-group-roots';
  if (group.roots.length === 0) {
    const msg = document.createElement('div'); msg.className = 'url-group-empty'; msg.textContent = 'No roots in this group yet.';
    rootsList.appendChild(msg);
  } else {
    for (const pattern of group.roots) {
      const match = isMatch(pattern);
      const row = document.createElement('div');
      row.className = 'url-group-root-row' + (match ? ' is-match' : '');
      row.innerHTML = `<span class="root-icon">${iconFor(pattern)}</span><span class="root-pattern">${pattern}</span><span class="root-match-pill">✓ active</span><button class="root-del" title="Remove">×</button>`;
      row.querySelector('.root-del').addEventListener('click', () => { group.roots = group.roots.filter(r => r !== pattern); saveUrlGroups(); renderUrlGroups(); });
      rootsList.appendChild(row);
    }
  }
  body.append(addRow, rootsList);
  card.append(header, body);
  return card;
}

function addUrlGroup() {
  const nameInput = document.getElementById('new-group-name');
  const name = nameInput.value.trim();
  if (!name) { toast('Group name required', 'err'); return; }
  urlGroups.push({ id: uid(), name, emoji: selectedGroupEmoji, collapsed: false, roots: [] });
  nameInput.value = ''; selectedGroupEmoji = '📂';
  document.getElementById('new-group-emoji-btn').childNodes[0].textContent = '📂';
  saveUrlGroups(); renderUrlGroups(); renderBmlGroups(); toast('✓ Group created', 'ok');
}

function saveUrlGroups() {
  chrome.storage.sync.set({ [GROUPS_KEY]: urlGroups });
  broadcastRootsUpdate();
}

/* ══════════════════════════════════════════════════
   BOOKMARKLET GROUPS (tab 2)
   ══════════════════════════════════════════════════ */

function renderBmlGroups() {
  const container = document.getElementById('bml-groups-container');
  const empty = document.getElementById('bml-groups-empty');
  container.querySelectorAll('.bml-group-card').forEach(el => el.remove());
  if (!bmlData || bmlData.groups.length === 0) { empty.style.display = ''; return; }
  empty.style.display = 'none';
  for (const group of bmlData.groups) container.appendChild(buildBmlGroupCard(group));
}

function buildBmlGroupCard(group) {
  const card = document.createElement('div');
  card.className = 'bml-group-card' + (group.collapsed ? ' collapsed' : '');
  card.dataset.gid = group.id;

  // ── Drag-and-drop for reordering ──
  let dragFromHandle = false;
  card.draggable = false; // start disabled, enable on handle mousedown
  card.addEventListener('dragstart', (e) => {
    if (!dragFromHandle) { e.preventDefault(); return; }
    dragGroupId = group.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    card.draggable = false;
    dragFromHandle = false;
    dragGroupId = null;
    document.querySelectorAll('.bml-group-card.drag-over').forEach(c => c.classList.remove('drag-over'));
  });
  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragGroupId && dragGroupId !== group.id) card.classList.add('drag-over');
  });
  card.addEventListener('dragleave', () => { card.classList.remove('drag-over'); });
  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('drag-over');
    if (!dragGroupId || dragGroupId === group.id) return;
    const srcIdx = bmlData.groups.findIndex(g => g.id === dragGroupId);
    const tgtIdx = bmlData.groups.findIndex(g => g.id === group.id);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const [moved] = bmlData.groups.splice(srcIdx, 1);
    bmlData.groups.splice(tgtIdx, 0, moved);
    saveBmlData(); renderBmlGroups(); broadcastRootsUpdate();
  });

  // Header
  const header = document.createElement('div');
  header.className = 'bml-group-card-header';
  header.innerHTML = `
    <span class="drag-handle" title="Drag to reorder">⠿</span>
    <span class="bml-group-card-chevron">▾</span>
    <span class="bml-group-card-emoji">${group.emoji || '📂'}</span>
    <span class="bml-group-card-name">${group.name}</span>
    <span class="bml-group-card-count">${group.items.length} bookmarklet${group.items.length !== 1 ? 's' : ''}</span>
    <div class="bml-group-card-actions">
      <button class="icon-btn edit-bml-group-btn" title="Rename">✏️</button>
      <button class="icon-btn danger delete-bml-group-btn" title="Delete group">🗑</button>
    </div>
  `;
  header.addEventListener('click', (e) => {
    if (e.target.closest('.bml-group-card-actions') || e.target.closest('.drag-handle')) return;
    group.collapsed = !group.collapsed; saveBmlData(); renderBmlGroups();
  });
  header.querySelector('.drag-handle').addEventListener('mousedown', () => {
    dragFromHandle = true;
    card.draggable = true;
  });
  header.querySelector('.edit-bml-group-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const n = prompt('Rename bookmarklet group:', group.name);
    if (n && n.trim()) { group.name = n.trim(); saveBmlData(); renderBmlGroups(); broadcastRootsUpdate(); toast('✓ Renamed', 'ok'); }
  });
  header.querySelector('.delete-bml-group-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!confirm(`Delete bookmarklet group "${group.name}" and all its bookmarklets?`)) return;
    bmlData.groups = bmlData.groups.filter(g => g.id !== group.id);
    saveBmlData(); renderBmlGroups(); broadcastRootsUpdate(); toast('Group deleted', 'ok');
  });

  // Body
  const body = document.createElement('div');
  body.className = 'bml-group-card-body';

  // Items list
  const itemsList = document.createElement('div');
  itemsList.className = 'bml-items-list';
  if (group.items.length === 0) {
    const msg = document.createElement('div'); msg.className = 'bml-items-empty'; msg.textContent = 'No bookmarklets yet.';
    itemsList.appendChild(msg);
  } else {
    for (const item of group.items) {
      const row = document.createElement('div');
      row.className = 'bml-item-row';
      row.innerHTML = `
        <div class="bml-item-icon" style="background:${item.bg || '#1a1a2a'}">${item.emoji || '🔗'}</div>
        <span class="bml-item-name">${item.name}</span>
        <span class="bml-item-type-badge">${TYPE_LABELS[item.type] || item.type}</span>
        <button class="icon-btn bml-item-edit" title="Edit">✏️</button>
        <button class="icon-btn danger bml-item-del" title="Delete">🗑</button>
      `;
      row.querySelector('.bml-item-del').addEventListener('click', () => {
        group.items = group.items.filter(i => i.id !== item.id);
        saveBmlData(); renderBmlGroups(); broadcastRootsUpdate();
      });
      row.querySelector('.bml-item-edit').addEventListener('click', () => {
        openBmlForm(item);
      });
      itemsList.appendChild(row);
    }
  }

  // Add bookmarklet button + inline form (supports add & edit)
  let editingItemId = null;

  const addBmlBtn = document.createElement('button');
  addBmlBtn.className = 'ghost-btn';
  addBmlBtn.textContent = '+ Add bookmarklet';

  const form = document.createElement('div');
  form.className = 'add-bml-form';

  function openBmlForm(item) {
    editingItemId = item ? item.id : null;
    form.classList.add('open');
    addBmlBtn.style.display = 'none';
    nameInput.value = item ? item.name : '';
    typeSelect.value = item ? item.type : 'path';
    buildConfigFields(item ? item.type : 'path', item ? item.config : null);
    saveBtn.textContent = item ? 'Save' : 'Add';
    nameInput.focus();
  }

  addBmlBtn.addEventListener('click', () => openBmlForm(null));

  // Form fields
  const row1 = document.createElement('div');
  row1.className = 'add-bml-form-row';
  const nameInput = document.createElement('input');
  nameInput.className = 'input-field text-input sm'; nameInput.type = 'text'; nameInput.placeholder = 'Bookmarklet name';
  const typeSelect = document.createElement('select');
  typeSelect.className = 'select-field';
  for (const [k, v] of Object.entries(TYPE_META)) {
    const opt = document.createElement('option'); opt.value = k; opt.textContent = v.label;
    typeSelect.appendChild(opt);
  }
  row1.append(nameInput, typeSelect);

  // Dynamic config field
  const configRow = document.createElement('div');
  configRow.className = 'add-bml-form-row';

  function buildConfigFields(type, cfg) {
    configRow.innerHTML = '';
    cfg = cfg || {};
    if (type === 'replace') {
      const f = document.createElement('input');
      f.className = 'input-field sm'; f.type = 'text'; f.placeholder = 'Find text'; f.id = 'abf-find-' + group.id;
      f.value = cfg.find || '';
      const r = document.createElement('input');
      r.className = 'input-field sm'; r.type = 'text'; r.placeholder = 'Replace with'; r.id = 'abf-replace-' + group.id;
      r.value = cfg.replaceWith || '';
      configRow.append(f, r);
    } else if (type === 'script') {
      const t = document.createElement('textarea');
      t.className = 'input-field sm'; t.placeholder = TYPE_META[type].placeholder; t.id = 'abf-config-' + group.id;
      t.style.minHeight = '60px'; t.style.resize = 'vertical'; t.style.fontFamily = "'Consolas', monospace";
      t.value = cfg.code || '';
      configRow.appendChild(t);
    } else {
      const c = document.createElement('input');
      c.className = 'input-field sm'; c.type = 'text'; c.placeholder = TYPE_META[type].placeholder; c.id = 'abf-config-' + group.id;
      if (type === 'path') c.value = cfg.path || '';
      else if (type === 'query') c.value = cfg.query || '';
      else if (type === 'switchroot') c.value = cfg.targetRoot || '';
      configRow.appendChild(c);
    }
  }
  buildConfigFields('path', null);
  typeSelect.addEventListener('change', () => buildConfigFields(typeSelect.value, null));

  // Actions row
  const actionsRow = document.createElement('div');
  actionsRow.className = 'add-bml-form-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-btn'; cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => { form.classList.remove('open'); addBmlBtn.style.display = ''; editingItemId = null; });
  const saveBtn = document.createElement('button');
  saveBtn.className = 'add-btn sm'; saveBtn.textContent = 'Add';
  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) { toast('Name required', 'err'); return; }
    const type = typeSelect.value;
    const config = {};
    if (type === 'replace') {
      config.find = document.getElementById('abf-find-' + group.id)?.value?.trim() || '';
      config.replaceWith = document.getElementById('abf-replace-' + group.id)?.value?.trim() || '';
    } else if (type === 'path') {
      config.path = document.getElementById('abf-config-' + group.id)?.value?.trim() || '';
    } else if (type === 'query') {
      config.query = document.getElementById('abf-config-' + group.id)?.value?.trim() || '';
    } else if (type === 'script') {
      config.code = document.getElementById('abf-config-' + group.id)?.value?.trim() || '';
    } else if (type === 'switchroot') {
      config.targetRoot = document.getElementById('abf-config-' + group.id)?.value?.trim() || '';
    }

    if (editingItemId) {
      // Edit existing
      const idx = group.items.findIndex(i => i.id === editingItemId);
      if (idx >= 0) {
        group.items[idx].name = name;
        group.items[idx].type = type;
        group.items[idx].config = config;
        group.items[idx].emoji = TYPE_META[type]?.icon || group.items[idx].emoji || '🔗';
      }
      editingItemId = null;
      toast('✓ Bookmarklet updated', 'ok');
    } else {
      // Add new
      const emoji = TYPE_META[type]?.icon || '🔗';
      const bg = BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];
      group.items.push({ id: uid(), name, type, emoji, bg, config });
      toast('✓ Bookmarklet added', 'ok');
    }
    saveBmlData(); renderBmlGroups(); broadcastRootsUpdate();
  });
  actionsRow.append(cancelBtn, saveBtn);

  form.append(row1, configRow, actionsRow);

  // URL group linking
  const linkSection = document.createElement('div');
  linkSection.className = 'link-section';
  const linkLabel = document.createElement('div');
  linkLabel.className = 'link-label'; linkLabel.textContent = 'Show on URL groups';
  const linkChips = document.createElement('div');
  linkChips.className = 'link-chips';
  const linkedIds = group.urlGroupIds || [];

  if (urlGroups.length === 0) {
    const note = document.createElement('div'); note.className = 'link-all-note';
    note.textContent = 'No URL groups defined yet — this group shows on all roots.';
    linkChips.appendChild(note);
  } else {
    const allChip = document.createElement('div');
    allChip.className = 'link-chip' + (linkedIds.length === 0 ? ' active' : '');
    allChip.textContent = '🌐 All roots';
    allChip.addEventListener('click', () => {
      group.urlGroupIds = []; saveBmlData(); renderBmlGroups(); broadcastRootsUpdate(); toast('✓ Shows on all roots', 'ok');
    });
    linkChips.appendChild(allChip);
    for (const ug of urlGroups) {
      const chip = document.createElement('div');
      chip.className = 'link-chip' + (linkedIds.includes(ug.id) ? ' active' : '');
      chip.textContent = `${ug.emoji || '📂'} ${ug.name}`;
      chip.addEventListener('click', () => {
        if (!group.urlGroupIds) group.urlGroupIds = [];
        if (group.urlGroupIds.includes(ug.id)) group.urlGroupIds = group.urlGroupIds.filter(id => id !== ug.id);
        else group.urlGroupIds.push(ug.id);
        saveBmlData(); renderBmlGroups(); broadcastRootsUpdate(); toast('✓ Updated', 'ok');
      });
      linkChips.appendChild(chip);
    }
  }
  linkSection.append(linkLabel, linkChips);

  body.append(itemsList, addBmlBtn, form, linkSection);
  card.append(header, body);
  return card;
}

function addBmlGroup() {
  const nameInput = document.getElementById('new-bml-group-name');
  const name = nameInput.value.trim();
  if (!name) { toast('Group name required', 'err'); return; }
  if (!bmlData) bmlData = { groups: [] };
  bmlData.groups.push({ id: uid(), name, emoji: selectedBmlGroupEmoji, collapsed: false, items: [], urlGroupIds: [] });
  nameInput.value = ''; selectedBmlGroupEmoji = '📂';
  document.getElementById('new-bml-group-emoji-btn').childNodes[0].textContent = '📂';
  saveBmlData(); renderBmlGroups(); broadcastRootsUpdate(); toast('✓ Group created', 'ok');
}

function saveBmlData() {
  if (!bmlData) return;
  chrome.storage.sync.set({ [DATA_KEY]: bmlData });
}

/* ══════════════════════════════════════════════════
   BROADCAST
   ══════════════════════════════════════════════════ */

function broadcastRootsUpdate() {
  const allRoots = [...roots];
  for (const g of urlGroups) { for (const r of g.roots) { if (!allRoots.includes(r)) allRoots.push(r); } }
  chrome.tabs.query({}, tabs => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: 'BML_ROOTS_UPDATED', roots: allRoots, urlGroups, bmlData }).catch(() => {});
    }
  });
}

/* ══════════════════════════════════════════════════
   EMOJI PICKERS
   ══════════════════════════════════════════════════ */

function initEmojiPicker(btnId, dropdownId, getSelected, setSelected) {
  const btn = document.getElementById(btnId);
  const dropdown = document.getElementById(dropdownId);
  for (const e of GROUP_EMOJIS) {
    const opt = document.createElement('div');
    opt.className = 'emoji-opt' + (e === getSelected() ? ' active' : '');
    opt.textContent = e;
    opt.addEventListener('click', (ev) => {
      ev.stopPropagation();
      setSelected(e); btn.childNodes[0].textContent = e;
      dropdown.querySelectorAll('.emoji-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active'); dropdown.classList.remove('open');
    });
    dropdown.appendChild(opt);
  }
  btn.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('open'); });
}

document.addEventListener('click', () => {
  document.querySelectorAll('.emoji-dropdown').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.root-group-dropdown.open').forEach(d => d.classList.remove('open'));
});

// Reset drag state if mouseup happens without a successful drag
document.addEventListener('mouseup', () => {
  document.querySelectorAll('.bml-group-card').forEach(c => { c.draggable = false; });
});

/* ══════════════════════════════════════════════════
   THEME
   ══════════════════════════════════════════════════ */

function initTheme() {
  const sel = document.getElementById('theme-select');
  for (const [id, theme] of Object.entries(BML_THEMES)) {
    const opt = document.createElement('option');
    opt.value = id; opt.textContent = theme.name;
    sel.appendChild(opt);
  }

  chrome.storage.sync.get(BML_THEME_KEY, r => {
    const themeId = r[BML_THEME_KEY] || BML_DEFAULT_THEME;
    bmlApplyTheme(themeId, document.documentElement);
    sel.value = themeId;
  });

  sel.addEventListener('change', () => {
    const themeId = sel.value;
    bmlApplyTheme(themeId, document.documentElement);
    chrome.storage.sync.set({ [BML_THEME_KEY]: themeId });
    // Broadcast to all content scripts
    chrome.tabs.query({}, tabs => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: 'BML_THEME_UPDATED', theme: themeId }).catch(() => {});
      }
    });
    toast('Theme: ' + (BML_THEMES[themeId]?.name || themeId), 'ok');
  });
}

/* ══════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════ */

let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 2200);
}

/* ══════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════ */

chrome.storage.sync.get([ROOTS_KEY, GROUPS_KEY, DATA_KEY], r => {
  roots = r[ROOTS_KEY] || [];
  urlGroups = r[GROUPS_KEY] || [];
  bmlData = r[DATA_KEY] || { groups: [] };

  chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
    try {
      const u = new URL(tab?.url || '');
      activeHostname = u.hostname; activePort = u.port;
      const badge = document.getElementById('active-tab-host');
      if (activeHostname) badge.textContent = 'Current tab: ' + activeHostname + (activePort ? ':' + activePort : '');
    } catch (_) {}
    renderRoots(); renderUrlGroups(); renderBmlGroups();
  });
});

initEmojiPicker('new-group-emoji-btn', 'new-group-emoji-dropdown', () => selectedGroupEmoji, (e) => { selectedGroupEmoji = e; });
initEmojiPicker('new-bml-group-emoji-btn', 'new-bml-group-emoji-dropdown', () => selectedBmlGroupEmoji, (e) => { selectedBmlGroupEmoji = e; });
initTheme();

/* ── Events ── */
document.getElementById('add-btn').addEventListener('click', () => { const i = document.getElementById('new-root-input'); addRoot(i.value); i.value = ''; });
document.getElementById('new-root-input').addEventListener('keydown', e => { if (e.key === 'Enter') { addRoot(e.target.value); e.target.value = ''; } });
document.getElementById('clear-roots-btn').addEventListener('click', () => { if (!confirm('Remove all global URL roots?')) return; roots = []; saveRoots(); renderRoots(); toast('All global roots cleared', 'ok'); });
document.getElementById('add-group-btn').addEventListener('click', addUrlGroup);
document.getElementById('new-group-name').addEventListener('keydown', e => { if (e.key === 'Enter') addUrlGroup(); });
document.getElementById('clear-groups-btn').addEventListener('click', () => {
  if (!confirm('Delete all URL groups and their roots?')) return;
  if (bmlData) { for (const bg of bmlData.groups) bg.urlGroupIds = []; saveBmlData(); }
  urlGroups = []; saveUrlGroups(); renderUrlGroups(); renderBmlGroups(); toast('All URL groups deleted', 'ok');
});

/* ── Export / Import roots & URL groups ── */
document.getElementById('export-roots-btn').addEventListener('click', () => {
  const data = { roots, urlGroups };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'bookmarklets-roots.json'; a.click();
  URL.revokeObjectURL(url);
  toast('✓ Exported', 'ok');
});

document.getElementById('import-roots-btn').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!Array.isArray(parsed.roots) && !Array.isArray(parsed.urlGroups)) throw new Error('Invalid format — expected { roots: [...], urlGroups: [...] }');
        const action = (roots.length > 0 || urlGroups.length > 0)
          ? confirm('You have existing roots.\n\nOK = Merge (add imported roots)\nCancel = Replace (overwrite everything)')
          : false;
        if (action) {
          // Merge roots
          for (const r of (parsed.roots || [])) {
            if (!roots.includes(r)) roots.push(r);
          }
          // Merge URL groups
          for (const g of (parsed.urlGroups || [])) {
            g.id = uid();
            urlGroups.push(g);
          }
        } else {
          roots = parsed.roots || [];
          urlGroups = parsed.urlGroups || [];
        }
        saveRoots(); saveUrlGroups(); renderRoots(); renderUrlGroups(); renderBmlGroups();
        toast('✓ Imported', 'ok');
      } catch (err) {
        toast('Import failed: ' + err.message, 'err');
      }
    };
    reader.readAsText(file);
  });
  input.click();
});

document.getElementById('add-bml-group-btn').addEventListener('click', addBmlGroup);
document.getElementById('new-bml-group-name').addEventListener('keydown', e => { if (e.key === 'Enter') addBmlGroup(); });
document.getElementById('clear-bml-btn').addEventListener('click', () => {
  if (!confirm('Delete ALL bookmarklet groups, bookmarklets, and URL group links? This cannot be undone.')) return;
  bmlData = { groups: [] }; saveBmlData(); renderBmlGroups(); broadcastRootsUpdate(); toast('All bookmarklet data cleared', 'ok');
});

/* ── Export / Import bookmarklets ── */
document.getElementById('export-bml-btn').addEventListener('click', () => {
  if (!bmlData || bmlData.groups.length === 0) { toast('Nothing to export', 'err'); return; }
  // Export without urlGroupIds — they're not portable between setups
  const exportData = {
    groups: bmlData.groups.map(g => {
      const { urlGroupIds, ...rest } = g;
      return rest;
    })
  };
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'bookmarklets.json'; a.click();
  URL.revokeObjectURL(url);
  toast('✓ Exported', 'ok');
});

document.getElementById('import-bml-btn').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!Array.isArray(parsed.groups)) throw new Error('Invalid format — expected { groups: [...] }');
        // Strip urlGroupIds from imported groups — they reference a different setup
        for (const g of parsed.groups) {
          delete g.urlGroupIds;
          if (!g.id) g.id = uid();
          if (!Array.isArray(g.items)) g.items = [];
          for (const item of g.items) { if (!item.id) item.id = uid(); }
        }
        const doMerge = bmlData && bmlData.groups.length > 0
          ? confirm('You have existing bookmarklets.\n\nOK = Merge (add imported groups)\nCancel = Replace (overwrite everything)')
          : false;
        if (doMerge) {
          for (const g of parsed.groups) {
            g.id = uid();
            for (const item of g.items) item.id = uid();
            bmlData.groups.push(g);
          }
        } else {
          bmlData = { groups: parsed.groups };
        }
        saveBmlData(); renderBmlGroups(); broadcastRootsUpdate();
        toast('✓ Imported ' + parsed.groups.length + ' group(s)', 'ok');
      } catch (err) {
        toast('Import failed: ' + err.message, 'err');
      }
    };
    reader.readAsText(file);
  });
  input.click();
});
