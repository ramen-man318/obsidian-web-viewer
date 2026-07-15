/* ─── global state ─── */
var currentPath = '';
var treeData = null;

/* ─── home screen ─── */
var HOME_CONTENT = '<h1>📖 Obsidian Web Viewer</h1>'
  + '<p>Vault内のファイルをブラウザで閲覧・編集するためのツールです。</p>'
  + '<hr>'
  + '<h2>使い方</h2>'
  + '<ul>'
  + '<li><strong>ファイルを開く</strong> — 左のサイドバーからファイルをクリック</li>'
  + '<li><strong>フォルダを開く</strong> — ▶ をクリックして展開、フォルダ名をクリックして内容表示</li>'
  + '<li><strong>ピン止め</strong> — 📌 アイコンをクリックするとファイル/フォルダを上部に固定表示</li>'
  + '<li><strong>編集</strong> — 右上の ✏️ Edit ボタンで編集モードに切り替え</li>'
  + '<li><strong>新規作成</strong> — 右上の ＋ New ボタン、または <code>?new</code> で新しいファイルを作成</li>'
  + '<li><strong>検索</strong> — サイドバー上部の検索ボックスでファイル検索</li>'
  + '<li><strong>Wikiリンク</strong> — <code>[[ファイル名]]</code> 形式のリンクをクリックしてジャンプ</li>'
  + '</ul>'
  + '<hr>'
  + '<p style="color:#8b949e;font-size:12px">サイドバーの「obsidian web viewer」をクリックするとこの画面に戻ります。</p>';

function setUrlState() {
  var params = new URLSearchParams();
  if (currentPath) {
    // ponytail: _new sentinel → ?new instead of ?path=_new
    params.set(currentPath === '_new' ? 'new' : 'path', currentPath === '_new' ? '' : currentPath);
  }
  var editArea = document.getElementById('edit-content');
  if (editArea && !editArea.classList.contains('hidden')) params.set('mode', 'edit');
  var q = params.toString();
  var url = q ? '?' + q : window.location.pathname;
  history.replaceState(null, '', url);
}

function navigateHome() {
  currentPath = '';
  document.getElementById('file-path').textContent = 'Home';
  document.getElementById('newfile-content').classList.add('hidden');
  document.getElementById('view-content').innerHTML = HOME_CONTENT;
  document.getElementById('edit-content').classList.add('hidden');
  document.getElementById('view-content').classList.remove('hidden');
  document.getElementById('edit-btn').textContent = '✏️ Edit';
  document.getElementById('edit-btn').className = 'btn btn-primary';
  document.getElementById('edit-btn').disabled = true;
  document.getElementById('delete-btn').style.display = 'none';
  document.getElementById('edit-tabs').style.display = 'none';
  // Remove tree active highlight
  document.querySelectorAll('.tree-item.active').forEach(function(e){e.classList.remove('active')});
  // Clear editor
  document.getElementById('editor').value = '';
  document.getElementById('edit-filename').textContent = '';
  document.getElementById('edit-path').textContent = '';
  setUrlState();
}

/* ─── sidebar toggle ─── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
  document.getElementById('main').classList.toggle('full');
}
// ponytail: mobile detection for auto-close sidebar
function isMobile() { return window.matchMedia('(max-width: 640px)').matches; }
function autoCloseSidebar() {
  // ponytail: only close on mobile when sidebar is currently open
  if (isMobile() && !document.getElementById('sidebar').classList.contains('collapsed')) {
    toggleSidebar();
  }
}

/* ─── pin helpers (API) ─── */
var _pinsCache = [];
function getPins() {
  return _pinsCache;
}
function fetchPins() {
  return fetch('/api/pins').then(function(r){ return r.json(); }).then(function(d){
    _pinsCache = d.pins || [];
  }).catch(function(){ _pinsCache = []; });
}
function setPins(pins) {
  _pinsCache = pins;
  return fetch('/api/pins', {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({pins: pins})
  }).then(function(r){ return r.json(); }).catch(function(){});
}
function isPinned(path) {
  return getPins().indexOf(path) >= 0;
}
function togglePin(path) {
  var pins = getPins();
  var idx = pins.indexOf(path);
  if (idx >= 0) { pins.splice(idx, 1); } else { pins.push(path); }
  setPins(pins);
  loadPins();
  updatePinIcons();
  return idx < 0;
}

/* ─── folder open/close state ─── */
function getOpenFolders() {
  try { return JSON.parse(sessionStorage.getItem('owv-open') || '{}'); } catch(e) { return {}; }
}
function setOpenFolders(obj) {
  sessionStorage.setItem('owv-open', JSON.stringify(obj));
}
function toggleFolder(el) {
  var icon = el;
  var children = icon.parentElement.nextElementSibling;
  if (!children || !children.classList.contains('tree-children')) return;
  var name = icon.parentElement.querySelector('.tree-item-name');
  if (!name) return;
  var key = name.textContent;
  var state = getOpenFolders();
  if (children.style.display === 'none') {
    children.style.display = '';
    icon.textContent = '▼';
    state[key] = true;
  } else {
    children.style.display = 'none';
    icon.textContent = '▶';
    delete state[key];
  }
  setOpenFolders(state);
}

/* ─── tree rendering ─── */
function loadTree() {
  fetch('/api/list').then(function(r){return r.json()}).then(function(data){
    treeData = data.tree;
    var tree = document.getElementById('file-tree');
    // ponytail: root-level split into folders/files with section labels
    var html = '';
    var folders = [];
    var files = [];
    var FOLDER_ORDER = { 'output':1, 'projects':2, 'wiki':3, 'journal':4, 'raw':5, 'inbox':6, 'templates':7, 'agents':8, 'assets':9, 'archives':99 };
    for (var i = 0; i < data.tree.length; i++) {
      var item = data.tree[i];
      if (item.type === 'folder') folders.push(item); else files.push(item);
    }
    folders.sort(function(a,b){return (FOLDER_ORDER[a.name]||50)-(FOLDER_ORDER[b.name]||50)});
    files.sort(function(a,b){return a.name.localeCompare(b.name)});
    if (folders.length) {
      html += '<div class="tree-section-label">📁 FOLDERS</div>' + renderTree(folders, '');
    }
    if (files.length) {
      html += '<div class="tree-section-label">📄 FILES</div>' + renderTree(files, '');
    }
    tree.innerHTML = html;
    loadPins();
  });
}

function renderTree(items, parentPath) {
  parentPath = parentPath || '';
  var html = '';
  var state = getOpenFolders();
  // ponytail: custom folder sort, archives at bottom
  var FOLDER_ORDER = { 'output':1, 'projects':2, 'wiki':3, 'journal':4, 'raw':5, 'inbox':6, 'templates':7, 'agents':8, 'assets':9, 'archives':99 };
  items = items.slice().sort(function(a,b) {
    if (a.type==='folder' && b.type==='folder') { return (FOLDER_ORDER[a.name]||50)-(FOLDER_ORDER[b.name]||50); }
    if (a.type==='folder') return -1;
    if (b.type==='folder') return 1;
    return a.name.localeCompare(b.name);
  });
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.type === 'folder') {
      var folderPath = parentPath ? parentPath + '/' + item.name : item.name;
      var isOpen = state[item.name] === true;
      var toggleIcon = isOpen ? '▼' : '▶';
      var childrenHtml = '';
      if (item.children && item.children.length > 0) {
        childrenHtml = '<div class="tree-children"' + (isOpen ? '' : ' style="display:none"') + '>'
          + renderTree(item.children, folderPath) + '</div>';
      }
      html += '<div class="tree-item" data-path="' + folderPath + '">'
        + '<span class="tree-toggle" onclick="toggleFolder(this)">' + toggleIcon + '</span>'
        + '<span class="tree-icon">📁</span>'
        + '<span class="tree-item-name">' + escHtml(item.name) + '</span>'
        + '<span class="pin' + (isPinned(folderPath) ? ' active' : '') + '" onclick="event.stopPropagation();togglePin(\'' + folderPath + '\')">📌</span>'
        + '</div>'
        + childrenHtml;
    } else {
      var filePath = item.path;
      html += '<div class="tree-item" data-path="' + filePath + '" onclick="openFile(\'' + filePath + '\')">'
        + '<span class="tree-toggle" style="visibility:hidden">▼</span>'
        + '<span class="tree-icon">' + fileIcon(item.name) + '</span>'
        + '<span class="tree-item-name">' + escHtml(item.name) + '</span>'
        + '<span class="pin' + (isPinned(filePath) ? ' active' : '') + '" onclick="event.stopPropagation();togglePin(\'' + filePath + '\')">📌</span>'
        + '</div>';
    }
  }
  return html;
}

/* ponytail: file icon by extension */
function fileIcon(name) {
  var ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  if (ext === 'md') return '📄';
  if (['txt','csv','json','yaml','yml','toml','xml','ini','cfg','env'].indexOf(ext) >= 0) return '📋';
  if (['py','js','ts','jsx','tsx','rb','go','rs','zig','sh','bash','lua','sql'].indexOf(ext) >= 0) return '⚙️';
  if (['png','jpg','jpeg','gif','webp','svg'].indexOf(ext) >= 0) return '🖼️';
  return '📄';
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');
}

function updatePinIcons() {
  document.querySelectorAll('.tree-item .pin').forEach(function(el) {
    var path = el.parentElement.getAttribute('data-path');
    if (isPinned(path)) { el.classList.add('active'); }
    else { el.classList.remove('active'); }
  });
}

/* ponytail: find folder children in treeData for pinned expansion */
function findFolderChildren(path, items) {
  var parts = path.split('/');
  var cur = items;
  for (var i = 0; i < parts.length; i++) {
    var found = null;
    for (var j = 0; j < cur.length; j++) {
      if (cur[j].name === parts[i] && cur[j].type === 'folder') {
        found = cur[j];
        break;
      }
    }
    if (!found) return null;
    cur = found.children;
  }
  return cur;
}

/* ─── pinned section ─── */
function isFolder(path) {
  // ponytail: no extension = folder
  return path.indexOf('.') === -1;
}

function navigateToFolder(path) {
  // Expand tree to reach the folder
  var parts = path.split('/');
  var current = '';
  for (var i = 0; i < parts.length; i++) {
    current = current ? current + '/' + parts[i] : parts[i];
    var item = document.querySelector('.tree-item[data-path="' + current + '"]');
    if (item) {
      var toggle = item.querySelector('.tree-toggle');
      if (toggle && toggle.textContent === '▶') {
        toggle.click();
      }
    }
  }
  // Highlight
  document.querySelectorAll('.tree-item.active').forEach(function(e){e.classList.remove('active')});
  var target = document.querySelector('.tree-item[data-path="' + path + '"]');
  if (target) {
    target.classList.add('active');
    target.scrollIntoView({block: 'nearest'});
  }
  // Show folder path in main area
  currentPath = '';
  document.getElementById('file-path').textContent = 'vault/' + path + '/';
  document.getElementById('view-content').innerHTML = '<p style="color:#8b949e">📁 ' + escHtml(path) + '/</p>';
  document.getElementById('edit-content').classList.add('hidden');
  document.getElementById('view-content').classList.remove('hidden');
  document.getElementById('edit-btn').textContent = '✏️ Edit';
  document.getElementById('edit-btn').className = 'btn btn-primary';
  document.getElementById('edit-btn').disabled = true;
  document.getElementById('delete-btn').style.display = 'none';
}

function togglePinFolder(el, path) {
  var state = getOpenFolders();
  var key = '_pin_' + path;
  if (state[key]) {
    delete state[key];
  } else {
    // accordion: close all other pinned folders first
    for (var k in state) {
      if (k.indexOf('_pin_') === 0 && k !== key) {
        delete state[k];
      }
    }
    state[key] = true;
  }
  setOpenFolders(state);
  loadPins();
}

function loadPins() {
  var container = document.getElementById('pinned-items');
  var pins = getPins();
  if (pins.length === 0) {
    container.innerHTML = '';
    document.getElementById('pinned-section').style.display = 'none';
    return;
  }
  document.getElementById('pinned-section').style.display = '';
  var html = '';
  var state = getOpenFolders();
  for (var i = 0; i < pins.length; i++) {
    var isDir = isFolder(pins[i]);
    var icon = isDir ? '📁' : fileIcon(pins[i]);
    var key = '_pin_' + pins[i];
    var isOpen = state[key] === true;

    html += '<div class="tree-item" data-path="' + pins[i] + '">'
      + '<span class="tree-toggle" ' + (isDir ? 'onclick="togglePinFolder(this,\'' + pins[i] + '\')"' : 'style="visibility:hidden"') + '>'
      + (isDir ? (isOpen ? '▼' : '▶') : '▼') + '</span>'
      + '<span class="tree-icon">' + icon + '</span>'
      + '<span class="tree-item-name" onclick="' + (isDir ? 'return false' : 'openFile(\'' + pins[i] + '\')') + '">' + escHtml(pins[i]) + '</span>'
      + '<span class="pin active" onclick="event.stopPropagation();togglePin(\'' + pins[i] + '\')">📌</span>'
      + '</div>';

    // Show children if folder is open and treeData is loaded
    if (isDir && isOpen && treeData) {
      var children = findFolderChildren(pins[i], treeData);
      if (children && children.length > 0) {
        html += '<div class="tree-children">' + renderTree(children, pins[i]) + '</div>';
      }
    }
  }
  container.innerHTML = html;
}

/* ─── file operations ─── */
var IMG_EXTS = ['png','jpg','jpeg','gif','webp','svg'];

function openFile(path) {
  currentPath = path;
  document.getElementById('newfile-content').classList.add('hidden');
  document.getElementById('file-path').textContent = 'vault/' + path;
  var ext = path.split('.').pop().toLowerCase();
  // ponytail: image files use /api/raw directly
  if (IMG_EXTS.indexOf(ext) >= 0) {
    document.getElementById('view-content').innerHTML = '<div style="text-align:center;padding:16px"><img src="/api/raw?path=' + encodeURIComponent(path) + '" style="max-width:100%;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>';
    document.getElementById('edit-filename').textContent = path.split('/').pop();
    document.getElementById('edit-path').textContent = 'vault/' + path;
    document.getElementById('delete-btn').style.display = 'none';
    document.getElementById('edit-tabs').style.display = 'none';
    var view = document.getElementById('view-content');
    var edit = document.getElementById('edit-content');
    edit.classList.add('hidden');
    view.classList.remove('hidden');
    document.getElementById('edit-btn').textContent = '✏️ Edit';
    document.getElementById('edit-btn').className = 'btn btn-primary';
    document.getElementById('edit-btn').disabled = true;
    document.querySelectorAll('.tree-item.active').forEach(function(e){e.classList.remove('active')});
    var activeEl = document.querySelector('.tree-item[data-path="' + path + '"]');
    if (activeEl) activeEl.classList.add('active');
    setUrlState();
    autoCloseSidebar();
    return;
  }
  fetch('/api/read?path=' + encodeURIComponent(path)).then(function(r){
    if (!r.ok) { throw new Error('Failed to load'); }
    return r.json();
  }).then(function(data){
    // ponytail: non-md files shown as raw text
    var isMd = path.toLowerCase().endsWith('.md');
    if (isMd) {
      document.getElementById('view-content').innerHTML = renderMarkdown(data.content);
    } else {
      document.getElementById('view-content').innerHTML = '<pre style="background:#1f2428;border:1px solid #30363d;border-radius:6px;padding:16px;overflow-x:auto;font-size:13px;line-height:1.5">' + escHtml(data.content) + '</pre>';
    }
    document.getElementById('edit-filename').textContent = path.split('/').pop();
    document.getElementById('edit-path').textContent = 'vault/' + path;
    document.getElementById('editor').value = data.content;
    document.getElementById('delete-btn').style.display = 'inline-block';
    document.getElementById('edit-tabs').style.display = '';
    switchEditTab('edit');
    var view = document.getElementById('view-content');
    var edit = document.getElementById('edit-content');
    edit.classList.add('hidden');
    view.classList.remove('hidden');
    document.getElementById('edit-btn').textContent = '✏️ Edit';
    document.getElementById('edit-btn').className = 'btn btn-primary';
    document.getElementById('edit-btn').disabled = false;
    // Update preview
    updatePreview();
    // highlight active item
    document.querySelectorAll('.tree-item.active').forEach(function(e){e.classList.remove('active')});
    var activeEl = document.querySelector('.tree-item[data-path="' + path + '"]');
    if (activeEl) activeEl.classList.add('active');
    setUrlState();
    autoCloseSidebar();
  }).catch(function(err) {
    document.getElementById('view-content').innerHTML = '<p style="color:#f85149">Error: ' + escHtml(err.message) + '</p>';
  });
}

function toggleEdit() {
  if (!currentPath) return;
  var view = document.getElementById('view-content');
  var edit = document.getElementById('edit-content');
  var btn = document.getElementById('edit-btn');
  var tabs = document.getElementById('edit-tabs');
  view.classList.toggle('hidden');
  edit.classList.toggle('hidden');
  if (edit.classList.contains('hidden')) {
    btn.textContent = '✏️ Edit';
    btn.className = 'btn btn-primary';
    tabs.style.display = 'none';
  } else {
    btn.textContent = '👁 View';
    btn.className = 'btn';
    tabs.style.display = '';
    switchEditTab('edit');
    updatePreview();
  }
  setUrlState();
}

/* ─── edit/preview tab switching ─── */
function switchEditTab(tab) {
  var editorArea = document.getElementById('editor-area');
  var previewArea = document.getElementById('edit-preview-area');
  var editTab = document.getElementById('edit-tab-btn');
  var previewTab = document.getElementById('preview-tab-btn');
  if (tab === 'preview') {
    editorArea.style.display = 'none';
    previewArea.style.display = '';
    editTab.classList.remove('tab-active');
    previewTab.classList.add('tab-active');
  } else {
    editorArea.style.display = '';
    previewArea.style.display = 'none';
    editTab.classList.add('tab-active');
    previewTab.classList.remove('tab-active');
    updatePreview();
  }
}

function saveFile() {
  var content = document.getElementById('editor').value;
  fetch('/api/save',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({path:currentPath, content:content})
  }).then(function(r){
    if (!r.ok) { return r.json().then(function(d){ throw new Error(d.error || 'Save failed'); }); }
    return r.json();
  }).then(function(data){
    if (data.ok) {
      toggleEdit();
      openFile(currentPath);
    }
  }).catch(function(err) {
    alert('Error: '+err.message);
  });
}

function deleteFile() {
  if (!currentPath) return;
  if (!confirm('Delete ' + currentPath + '?')) return;
  fetch('/api/save',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({path:currentPath, content:''})
  }).then(function(r){
    if (!r.ok) { return r.json().then(function(d){ throw new Error(d.error || 'Delete failed'); }); }
    return r.json();
  }).then(function(data){
    if (data.ok) {
      navigateHome();
      loadTree();
    }
  }).catch(function(err) {
    alert('Error: ' + err.message);
  });
}

function searchFiles(q) {
  if (!q) { loadTree(); return; }
  fetch('/api/search?q='+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(data){
    var tree = document.getElementById('file-tree');
    if (!data.results || data.results.length===0) {
      tree.innerHTML = '<div class="tree-item" style="color:#8b949e;padding:16px">No results</div>';
      return;
    }
    var seen = {};
    var html = '';
    for (var i=0; i<data.results.length; i++) {
      var r = data.results[i];
      if (!seen[r.file]) {
        seen[r.file] = true;
        html += '<div class="tree-item" onclick="openFile(\''+r.file+'\')">🔍 '+r.file+'</div>';
      }
    }
    tree.innerHTML = html;
  });
}

/* ─── markdown ─── */
function renderMarkdown(text) {
  // ponytail: strip YAML frontmatter (---\n...\n---)
  text = text.replace(/^---\n[\s\S]*?\n---\n*/, '');
  var html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    // ponytail: [[wikilink]] → clickable anchor
    .replace(/\[\[([^\]]+)\]\]/g, function(m, name) {
      var found = findNote(name);
      if (found) return '<a href="#" class="wikilink" onclick="navigateToNote(\''+name+'\');return false">'+escHtml(name)+'</a>';
      return '<span class="wikilink missing">'+escHtml(name)+'</span>';
    })
    .replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/^## (.+)$/gm,'<h2>$1</h2>')
    .replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^#### (.+)$/gm,'<h4>$1</h4>')
    .replace(/^##### (.+)$/gm,'<h5>$1</h5>')
    .replace(/^###### (.+)$/gm,'<h6>$1</h6>')
    // ponytail: horizontal rule (---, ***, ___)
    .replace(/^(-{3,}|\*{3,}|_{3,})\s*$/gm, '<hr>')
    // ponytail: blockquote (> text — escaped to &gt; by now)
    .replace(/^&gt;\s?(.+)$/gm, '<blockquote>$1</blockquote>')
    // merge consecutive blockquotes
    .replace(/<\/blockquote>\n<blockquote>/g, '<br>\n')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    // ponytail: markdown tables (GFM style) → HTML tables
    .replace(/^(\|.+\|(?:\n\|.+\|)*)$/gm, function(m) {
      var rows = m.split('\n');
      if (rows.length < 2) return m;
      var html = '<table><thead><tr>';
      var headers = rows[0].split('|').slice(1, -1);
      for (var i = 0; i < headers.length; i++) {
        html += '<th>' + headers[i].trim() + '</th>';
      }
      html += '</tr></thead><tbody>';
      for (var r = 2; r < rows.length; r++) {
        if (!rows[r].trim()) continue;
        var cells = rows[r].split('|').slice(1, -1);
        html += '<tr>';
        for (var c = 0; c < cells.length; c++) {
          html += '<td>' + cells[c].trim() + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
      return html;
    })
    // ponytail: indented lists (2, 4, 6, 8 spaces → proportional margin)
    .replace(/^( {2,8})- (.+)$/gm, function(m, spaces, text) {
      var indent = (spaces.length / 2) * 1.5;
      return '<li style="margin-left:' + indent + 'em">' + text + '</li>';
    })
    // ponytail: numbered sub-list (e.g. "  1. text")
    .replace(/^( {2,8})(\d+[.)] .+)$/gm, function(m, spaces, rest) {
      var indent = (spaces.length / 2) * 1.5;
      return '<li style="margin-left:' + indent + 'em;list-style:none">' + rest + '</li>';
    })
    // ponytail: flat lists at column 0
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+[.)] .+)$/gm, '<li style="list-style:none">$1</li>')
    // wrap consecutive <li> in <ul>
    .replace(/(<li[^>]*>.*?<\/li>\n?)+/g, '<ul>$&</ul>')
    // ponytail: 2-space indented text → li with no bullet (keeps indent within list context)
    .replace(/^ {2}([^ \n].*)$/gm, '<li style="margin-left:1.5em;list-style:none">$1</li>')
        // ponytail: inline links [text](url)
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hlu\d])(.+)$/gm, '$1');
  return '<p>'+html+'</p>';
}

/* ponytail: flat tree search for [[wikilink]] resolution */
/* パス付き（[[path/to/file.md]]）とファイル名のみ（[[file]]）両対応 */
function findNote(name) {
  var q = name.toLowerCase().replace(/\.md$/,'');
  function walk(items) {
    for (var i=0;i<items.length;i++) {
      if (items[i].type==='file') {
        var filePath = items[i].path.toLowerCase().replace(/\.md$/,'');
        // 完全パス一致（[[projects/foo/bar.md]]）またはファイル名一致（[[bar]]）
        if (filePath === q || filePath.split('/').pop() === q) return items[i].path;
      }
      if (items[i].children) { var r=walk(items[i].children); if (r) return r; }
    }
    return null;
  }
  return walk(treeData||[]);
}

function navigateToNote(name) {
  var path = findNote(name);
  if (path) openFile(path);
}

/* ─── live preview in edit mode ─── */
function updatePreview() {
  var content = document.getElementById('editor').value;
  document.getElementById('edit-preview').innerHTML = content
    ? renderMarkdown(content)
    : '<p style="color:#8b949e">Preview will appear here...</p>';
}

/* ─── init ─── */
document.addEventListener('DOMContentLoaded', function() {
  // Check URL params BEFORE navigateHome so it doesn't wipe them
  var params = new URLSearchParams(window.location.search);
  var pathParam = params.get('path');
  var isNew = params.get('new') === '';
  if (!pathParam && !isNew) navigateHome();
  loadTree();
  fetchPins().then(function(){ loadPins(); });
  // Wire up live preview on editor input
  document.getElementById('editor').addEventListener('input', updatePreview);
  // Wire up live preview on new-file editor input
  document.getElementById('newfile-editor').addEventListener('input', function() {
    if (document.getElementById('nfe-tab-preview').classList.contains('tab-active')) {
      var content = document.getElementById('newfile-editor').value;
      document.getElementById('nfe-preview').innerHTML = content
        ? renderMarkdown(content)
        : '<p style="color:#8b949e">Preview will appear here...</p>';
    }
  });
  // ?new → open new-file page
  if (isNew) { promptNewFile(); }
  // Restore URL state — wait for treeData from loadTree()
  if (pathParam) {
    var checkTree = setInterval(function() {
      if (treeData) {
        clearInterval(checkTree);
        openFile(pathParam);
        if (params.get('mode') === 'edit') {
          setTimeout(function() { toggleEdit(); }, 100);
        }
      }
    }, 50);
  }
});

/* ─── new file creation ─── */
function promptNewFile() {
  currentPath = '_new';
  document.getElementById('file-path').textContent = 'New File';
  document.getElementById('view-content').classList.add('hidden');
  document.getElementById('edit-content').classList.add('hidden');
  document.getElementById('newfile-content').classList.remove('hidden');
  document.getElementById('edit-btn').disabled = true;
  document.getElementById('delete-btn').style.display = 'none';
  document.getElementById('newfile-path').value = '';
  document.getElementById('newfile-editor').value = '';
  document.getElementById('newfile-path').focus();
  nfeSwitchTab('edit');
  document.querySelectorAll('.tree-item.active').forEach(function(e){e.classList.remove('active')});
  setUrlState();
}

function nfeSwitchTab(tab) {
  var editor = document.getElementById('nfe-editor-area');
  var preview = document.getElementById('nfe-preview-area');
  var tabEdit = document.getElementById('nfe-tab-edit');
  var tabPrev = document.getElementById('nfe-tab-preview');
  if (tab === 'preview') {
    editor.classList.add('hidden');
    preview.classList.remove('hidden');
    tabEdit.classList.remove('tab-active');
    tabPrev.classList.add('tab-active');
    // render preview from editor content
    var content = document.getElementById('newfile-editor').value;
    document.getElementById('nfe-preview').innerHTML = content
      ? renderMarkdown(content)
      : '<p style="color:#8b949e">Preview will appear here...</p>';
  } else {
    editor.classList.remove('hidden');
    preview.classList.add('hidden');
    tabEdit.classList.add('tab-active');
    tabPrev.classList.remove('tab-active');
  }
}

function saveNewFile() {
  var path = document.getElementById('newfile-path').value.trim();
  if (!path) { alert('Enter a file path.'); return; }
  // ponytail: reject paths ending with / (empty filename)
  if (path.endsWith('/')) { alert('Filename is empty. Enter a filename at the end of the path.'); return; }
  // ponytail: reject paths with no filename (endsWith won't catch all — e.g. "dir/" or "dir///")
  var parts = path.split('/');
  var filename = parts[parts.length - 1];
  if (!filename || filename === '.' || filename === '..') { alert('Invalid filename. Enter a proper filename.'); return; }
  // ponytail: auto-add .md if no visible extension
  var ext = path.includes('.') ? path.split('.').pop().toLowerCase() : '';
  var VISIBLE_EXTS = ['md','txt','json','yaml','yml','toml','csv','xml','ini','cfg','conf','env','properties','css','js','html','sh','bash','py','rb','lua','sql','rs','go','zig','ts','jsx','tsx','svg','drawio','excalidraw','png','jpg','jpeg','gif','webp'];
  if (VISIBLE_EXTS.indexOf(ext) < 0) { path += '.md'; }
  var content = document.getElementById('newfile-editor').value;
  fetch('/api/save', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({path: path, content: content})
  }).then(function(r) {
    if (!r.ok) { return r.json().then(function(d){ throw new Error(d.error || 'Save failed'); }); }
    return r.json();
  }).then(function(data) {
    if (data.ok) {
      cancelNewFile();
      openFile(path);
      loadTree();
    }
  }).catch(function(err) {
    alert('Error: ' + err.message);
  });
}

function cancelNewFile() {
  document.getElementById('newfile-content').classList.add('hidden');
  document.getElementById('view-content').classList.remove('hidden');
  document.getElementById('edit-btn').disabled = false;
  // ponytail: restore url from _new sentinel or blank
  if (currentPath && currentPath !== '_new') {
    openFile(currentPath);
  } else {
    currentPath = '';
    navigateHome();
  }
  setUrlState();
}