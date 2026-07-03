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
  + '<li><strong>検索</strong> — サイドバー上部の検索ボックスでファイル検索</li>'
  + '<li><strong>Wikiリンク</strong> — <code>[[ファイル名]]</code> 形式のリンクをクリックしてジャンプ</li>'
  + '</ul>'
  + '<hr>'
  + '<p style="color:#8b949e;font-size:12px">サイドバーの「obsidian web viewer」をクリックするとこの画面に戻ります。</p>';

function navigateHome() {
  currentPath = '';
  document.getElementById('file-path').textContent = 'Home';
  document.getElementById('view-content').innerHTML = HOME_CONTENT;
  document.getElementById('edit-content').classList.add('hidden');
  document.getElementById('view-content').classList.remove('hidden');
  document.getElementById('edit-btn').textContent = '✏️ Edit';
  document.getElementById('edit-btn').className = 'btn btn-primary';
  document.getElementById('edit-btn').disabled = true;
  document.getElementById('delete-btn').style.display = 'none';
  // Remove tree active highlight
  document.querySelectorAll('.tree-item.active').forEach(function(e){e.classList.remove('active')});
  // Clear editor
  document.getElementById('editor').value = '';
  document.getElementById('edit-filename').textContent = '';
  document.getElementById('edit-path').textContent = '';
}

/* ─── sidebar toggle ─── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
  document.getElementById('main').classList.toggle('full');
}

/* ─── pin helpers (localStorage) ─── */
function getPins() {
  try { return JSON.parse(localStorage.getItem('owv-pins') || '[]'); } catch(e) { return []; }
}
function setPins(pins) {
  localStorage.setItem('owv-pins', JSON.stringify(pins));
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
        + '<span class="tree-icon">📄</span>'
        + '<span class="tree-item-name">' + escHtml(item.name) + '</span>'
        + '<span class="pin' + (isPinned(filePath) ? ' active' : '') + '" onclick="event.stopPropagation();togglePin(\'' + filePath + '\')">📌</span>'
        + '</div>';
    }
  }
  return html;
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
    el.textContent = '▶';
  } else {
    state[key] = true;
    el.textContent = '▼';
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
    var icon = isDir ? '📁' : '📄';
    var key = '_pin_' + pins[i];
    var isOpen = state[key] === true;

    html += '<div class="tree-item" data-path="' + pins[i] + '">'
      + '<span class="tree-toggle" ' + (isDir ? 'onclick="togglePinFolder(this,\'' + pins[i] + '\')"' : 'style="visibility:hidden"') + '>'
      + (isDir ? (isOpen ? '▼' : '▶') : '▼') + '</span>'
      + '<span class="tree-icon">' + icon + '</span>'
      + '<span class="tree-item-name" onclick="' + (isDir ? 'navigateToFolder(\'' + pins[i] + '\')' : 'openFile(\'' + pins[i] + '\')') + '">' + escHtml(pins[i]) + '</span>'
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
function openFile(path) {
  currentPath = path;
  document.getElementById('file-path').textContent = 'vault/' + path;
  fetch('/api/read?path=' + encodeURIComponent(path)).then(function(r){
    if (!r.ok) { throw new Error('Failed to load'); }
    return r.json();
  }).then(function(data){
    document.getElementById('view-content').innerHTML = renderMarkdown(data.content);
    document.getElementById('edit-filename').textContent = path.split('/').pop();
    document.getElementById('edit-path').textContent = 'vault/' + path;
    document.getElementById('editor').value = data.content;
    document.getElementById('delete-btn').style.display = 'inline-block';
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
  }).catch(function(err) {
    document.getElementById('view-content').innerHTML = '<p style="color:#f85149">Error: ' + escHtml(err.message) + '</p>';
  });
}

function toggleEdit() {
  if (!currentPath) return;
  var view = document.getElementById('view-content');
  var edit = document.getElementById('edit-content');
  var btn = document.getElementById('edit-btn');
  view.classList.toggle('hidden');
  edit.classList.toggle('hidden');
  if (edit.classList.contains('hidden')) {
    btn.textContent = '✏️ Edit';
    btn.className = 'btn btn-primary';
  } else {
    btn.textContent = '👁 View';
    btn.className = 'btn';
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
  if (!confirm('Delete '+currentPath+'?')) return;
  fetch('/api/save',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({path:currentPath, content:''})
  }).then(function(){ window.location.reload(); });
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
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    // ponytail: indented lists (2, 4, 6, 8 spaces → proportional margin)
    .replace(/^( {2,8})- (.+)$/gm, function(m, spaces, text) {
      var indent = (spaces.length / 2) * 1.5;
      return '<li style="margin-left:' + indent + 'em">' + text + '</li>';
    })
    // ponytail: flat lists at column 0
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // wrap consecutive <li> in <ul>
    .replace(/(<li[^>]*>.*?<\/li>\n?)+/g, '<ul>$&</ul>')
    // ponytail: 2-space indented text (non-list) → styled div
    .replace(/^ {2}([^ \n].*)$/gm, '<div style="margin-left:1.5em">$1</div>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hlu\d])(.+)$/gm, '$1');
  return '<p>'+html+'</p>';
}

/* ponytail: flat tree search for [[wikilink]] resolution */
function findNote(name) {
  var q = name.toLowerCase().replace(/\.md$/,'');
  function walk(items) {
    for (var i=0;i<items.length;i++) {
      if (items[i].type==='file' && items[i].name.toLowerCase().replace(/\.md$/,'')===q) return items[i].path;
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
  navigateHome();
  loadTree();
  loadPins();
  // Wire up live preview on editor input
  document.getElementById('editor').addEventListener('input', updatePreview);
});