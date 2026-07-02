/* ─── global state ─── */
var currentPath = '';
var treeData = null;

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
    tree.innerHTML = renderTree(data.tree, '');
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
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function updatePinIcons() {
  document.querySelectorAll('.tree-item .pin').forEach(function(el) {
    var path = el.parentElement.getAttribute('data-path');
    if (isPinned(path)) { el.classList.add('active'); }
    else { el.classList.remove('active'); }
  });
}

/* ─── pinned section ─── */
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
  for (var i = 0; i < pins.length; i++) {
    var icon = pins[i].indexOf('/') >= 0 ? '📄' : '📁';
    html += '<div class="tree-item" data-path="' + pins[i] + '" onclick="openFile(\'' + pins[i] + '\')">'
      + '<span class="tree-toggle" style="visibility:hidden">▼</span>'
      + '<span class="tree-icon">' + icon + '</span>'
      + '<span class="tree-item-name">' + escHtml(pins[i]) + '</span>'
      + '<span class="pin active" onclick="event.stopPropagation();togglePin(\'' + pins[i] + '\')">📌</span>'
      + '</div>';
  }
  container.innerHTML = html;
}

/* ─── file operations ─── */
function openFile(path) {
  currentPath = path;
  document.getElementById('file-path').textContent = 'vault/' + path;
  fetch('/api/read?path=' + encodeURIComponent(path)).then(function(r){return r.json()}).then(function(data){
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
    // highlight active item
    document.querySelectorAll('.tree-item.active').forEach(function(e){e.classList.remove('active')});
    var activeEl = document.querySelector('.tree-item[data-path="' + path + '"]');
    if (activeEl) activeEl.classList.add('active');
  });
}

function toggleEdit() {
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
  }
}

function saveFile() {
  var content = document.getElementById('editor').value;
  fetch('/api/save',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({path:currentPath, content:content})
  }).then(function(r){return r.json()}).then(function(data){
    if (data.ok) {
      alert('Saved!');
      toggleEdit();
      openFile(currentPath);
    } else {
      alert('Error: '+data.error);
    }
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

/* ─── markdown (simple) ─── */
/* ponytail: 2-space indent → visual margin, [[wikilink]] → clickable */
function renderMarkdown(text) {
  // ponytail: strip YAML frontmatter (---\n...\n---)
  text = text.replace(/^---\n[\s\S]*?\n---\n*/, '');
  var html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    // ponytail: 2-space indent → 4-space indent
    .replace(/^  (- .+)/gm, '    $1')
    // ponytail: [[wikilink]] → clickable anchor (after escaping, so tags survive)
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
    .replace(/^- (.+)$/gm,'<li>$1</li>')
    .replace(/^ {4}- (.+)$/gm,'<li style="margin-left:1.5em">$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g,'<ul>$&</ul>')
    .replace(/\n\n/g,'</p><p>')
    .replace(/^(?!<[hlu])(.+)$/gm,'$1');
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

/* ─── init ─── */
document.addEventListener('DOMContentLoaded', function() {
  loadTree();
  loadPins();
});