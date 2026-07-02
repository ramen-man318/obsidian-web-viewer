/* global state */
var currentPath = '';

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
  document.getElementById('main').classList.toggle('full');
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

function loadTree() {
  fetch('/api/list').then(function(r){return r.json()}).then(function(data){
    var tree = document.getElementById('file-tree');
    tree.innerHTML = renderTree(data.tree);
  });
}

function renderTree(items, depth) {
  depth = depth || 0;
  var html = '';
  for (var i=0; i<items.length; i++) {
    var item = items[i];
    var pad = 'padding-left:'+(24+depth*16)+'px';
    if (item.type==='folder') {
      html += '<div class="tree-item" style="'+pad+'font-weight:600">📁 '+item.name+'</div>';
      if (item.children) {
        html += renderTree(item.children, depth+1);
      }
    } else {
      html += '<div class="tree-item" style="'+pad+'" onclick="openFile(\''+item.path+'\')">📄 '+item.name+'</div>';
    }
  }
  return html;
}

function openFile(path) {
  currentPath = path;
  document.getElementById('file-path').textContent = 'content/'+path;
  fetch('/api/read?path='+encodeURIComponent(path)).then(function(r){return r.json()}).then(function(data){
    document.getElementById('view-content').innerHTML = renderMarkdown(data.content);
    document.getElementById('edit-filename').textContent = path.split('/').pop();
    document.getElementById('edit-path').textContent = 'content/'+path;
    document.getElementById('editor').value = data.content;
    document.getElementById('delete-btn').style.display = 'inline-block';
    var view = document.getElementById('view-content');
    var edit = document.getElementById('edit-content');
    edit.classList.add('hidden');
    view.classList.remove('hidden');
    document.getElementById('edit-btn').textContent = '✏️ Edit';
    document.getElementById('edit-btn').className = 'btn btn-primary';
  });
}

function renderMarkdown(text) {
  var html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/^## (.+)$/gm,'<h2>$1</h2>')
    .replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/^- (.+)$/gm,'<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g,'<ul>$&</ul>')
    .replace(/\n\n/g,'</p><p>')
    .replace(/^(?!<[hlu])(.+)$/gm,'$1');
  return '<p>'+html+'</p>';
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