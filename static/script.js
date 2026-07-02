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