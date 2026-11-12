"use strict";

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const API_URL = "http://localhost:5000/api/tasks";
const usersKey = "taskflow_demo_users";
const THEME_KEY = "taskflow_theme";
const MIN_TITLE_LENGTH = 3;
const STATUSES = ["todo", "progress", "done"];
const STATUS_LABEL = { todo: "To Do", progress: "In Progress", done: "Done" };
const PRIORITIES = ["Tinggi", "Sedang", "Rendah"];

let authMode = "signin";
let currentUser = "";
let tasks = [];
let editingId = null;
let draftSubtasks = [];
let draggedId = null;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ================= 1. AUTHENTICATION LOGIC =================
function getUsers() { try { return JSON.parse(localStorage.getItem(usersKey) || '{}') } catch { return {} } }

function setMode(mode) {
  authMode = mode;
  $$('[data-auth]').forEach(b => b.classList.toggle('active', b.dataset.auth === mode));
  if ($('#nameField')) {
    $('#nameField').hidden = mode !== 'signup';
    $('#authName').required = mode === 'signup';
  }
  $('#authTitle').textContent = mode === 'signup' ? 'Create your space' : 'Welcome back!';
  $('#authSubtitle').textContent = mode === 'signup' ? 'Buat akun dan mulai susun progresmu hari ini.' : 'Masuk dan lanjutkan hal hebat yang sedang kamu kerjakan.';
  $('#authSubmit').textContent = mode === 'signup' ? 'Buat akun & mulai →' : 'Masuk ke TaskFlow →';
  $('#authPassword').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  $('#authError').textContent = '';
}

function setupAuth() {
  $$('[data-auth]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.auth)));

  const toggleBtn = $('.toggle-pass');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      let p = $('#authPassword');
      p.type = p.type === 'password' ? 'text' : 'password';
    });
  }

  const authForm = $('#authForm');
  if (authForm) {
    authForm.addEventListener('submit', e => {
      e.preventDefault();
      const error = $('#authError');
      error.textContent = '';
      const email = $('#authEmail').value.trim().toLowerCase();
      const pass = $('#authPassword').value;
      const name = $('#authName')?.value?.trim() || '';

      if (!email || !$('#authEmail').checkValidity()) {
        error.textContent = 'Masukkan alamat email yang valid.';
        return;
      }
      if (pass.length < 6) {
        error.textContent = 'Password minimal harus 6 karakter.';
        return;
      }
      if (authMode === 'signup' && !name) {
        error.textContent = 'Nama lengkap wajib diisi.';
        return;
      }

      try {
        const users = getUsers();
        if (authMode === 'signup') {
          if (users[email]) {
            error.textContent = 'Email ini sudah terdaftar. Pilih Sign in untuk masuk.';
            return;
          }
          users[email] = { password: pass, name };
          localStorage.setItem(usersKey, JSON.stringify(users));
        } else {
          if (!users[email] || users[email].password !== pass) {
            error.textContent = 'Email atau password belum cocok.';
            return;
          }
        }
        currentUser = email;
        localStorage.setItem('taskflow_session', email);
        enterApp();
      } catch (err) {
        error.textContent = 'Gagal memproses autentikasi lokal.';
      }
    });
  }
}

async function enterApp() {
  $('#authScreen').hidden = true;
  $('#app').hidden = false;
  let u = getUsers()[currentUser], firstName = u?.name?.trim().split(/\s+/)[0] || 'there';
  $('.brand p').textContent = `A little progress, ${firstName} ✦`;
  $('#welcomeHeading').innerHTML = `Welcome back, ${esc(firstName)}<span>✦</span>`;
  $('#welcomeDate').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()) + ' · Let’s make today meaningful.';

  await fetchTasksFromBackend();
}

// ================= 2. BACKEND API INTEGRATION =================
async function fetchTasksFromBackend() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('Gagal terhubung ke backend');
    const data = await res.json();
    tasks = data.map(t => ({ ...t, id: t._id }));
    renderAll();
  } catch (err) {
    console.error('Error fetching tasks:', err);
    showToast('Server Backend tidak aktif ❌');
  }
}

async function addTaskToBackend(taskData) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    });
    const newTask = await res.json();
    tasks.unshift({ ...newTask, id: newTask._id });
    renderAll();
    showToast('Tugas berhasil disimpan ke MongoDB ✨');
  } catch (err) {
    console.error('Error adding task:', err);
  }
}

async function updateTaskInBackend(id, updatedData) {
  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    const updated = await res.json();
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) tasks[index] = { ...updated, id: updated._id };
    renderAll();
    showToast('Perubahan disimpan ✨');
  } catch (err) {
    console.error('Error updating task:', err);
  }
}

async function deleteTaskFromBackend(id) {
  try {
    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    tasks = tasks.filter(t => t.id !== id);
    renderAll();
    showToast('Tugas dihapus dari MongoDB 🗑️');
  } catch (err) {
    console.error('Error deleting task:', err);
  }
}

// ================= 3. APP STATE & RENDERING =================
const state = { filter: "all", search: "", priority: "all", view: "board" };

function isOverdue(task) {
  return task.due !== "" && task.status !== "done" && task.due < new Date().toISOString().slice(0, 10);
}

function countByStatus(status) {
  return tasks.filter((t) => t.status === status).length;
}

function getVisibleTasks() {
  const keyword = state.search.trim().toLowerCase();
  return tasks.filter((task) => {
    const statusOk = state.filter === "all" || task.status === state.filter;
    const priorityOk = state.priority === "all" || task.priority === state.priority;
    const searchOk = !keyword || [task.title, task.desc].join(" ").toLowerCase().includes(keyword);
    return statusOk && priorityOk && searchOk;
  });
}

function renderAll() {
  const total = tasks.length;
  const done = countByStatus("done");
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  if ($('#statTotal')) $('#statTotal').textContent = String(total);
  if ($('#statTodo')) $('#statTodo').textContent = String(countByStatus("todo"));
  if ($('#statProgress')) $('#statProgress').textContent = String(countByStatus("progress"));
  if ($('#statDone')) $('#statDone').textContent = String(done);
  if ($('#statOverdue')) $('#statOverdue').textContent = String(tasks.filter(isOverdue).length);
  if ($('#ring')) $('#ring').style.setProperty("--pct", String(percent));
  if ($('#ringPercent')) $('#ringPercent').textContent = percent + "%";
  if ($('#progressText')) $('#progressText').textContent = done + " dari " + total + " tugas selesai";

  $$('.tab').forEach((tab) => {
    const key = tab.dataset.filter;
    tab.querySelector('.tab-count').textContent = String(key === "all" ? total : countByStatus(key));
    tab.classList.toggle("active", state.filter === key);
  });

  const visible = getVisibleTasks();
  $$('.column').forEach((column) => {
    const status = column.dataset.status;
    const list = column.querySelector(".column-list");
    const items = visible.filter((t) => t.status === status);
    column.querySelector(".column-count").textContent = String(items.length);
    list.innerHTML = items.length ? items.map(taskHTML).join('') : '<div class="empty">✧ Belum ada tugas</div>';
  });

  $('#boardView').hidden = state.view !== "board";
  $('#listView').hidden = state.view !== "list";
  $$('.view-btn').forEach((btn) => btn.classList.toggle("active", btn.dataset.view === state.view));
}

function taskHTML(t) {
  return `
    <article class="task-card" draggable="true" data-id="${t.id}">
      <div class="task-top">
        <span class="priority ${t.priority}">${t.priority}</span>
        <button class="task-menu" data-edit="${t.id}">···</button>
      </div>
      <h3>${esc(t.title)}</h3>
      <p>${esc(t.desc || 'Tidak ada deskripsi.')}</p>
      <div class="task-bottom">
        <span class="${isOverdue(t) ? 'late' : ''}">${t.due ? '◷ ' + t.due : '◷ Tanpa deadline'}</span>
        <div class="task-actions"><button data-move="${t.id}">Pindah ↗</button></div>
      </div>
    </article>
  `;
}

function showToast(message) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 2600);
}

// ================= 4. DIALOG & EVENTS =================
function openDialog(id = null, status = 'todo') {
  editingId = id;
  const t = tasks.find((x) => x.id === id);
  $('#dialogTitle').textContent = t ? "Edit Tugas" : "Buat Tugas Baru";
  $('#fieldTitle').value = t ? t.title : "";
  $('#fieldDesc').value = t ? t.desc : "";
  $('#fieldStatus').value = t ? t.status : status;
  $('#fieldPriority').value = t ? t.priority : "Sedang";
  $('#fieldDue').value = t ? t.due : "";
  $('#deleteTaskBtn').hidden = !t;
  $('#taskDialog').showModal();
}

function setupEvents() {
  $('#newTaskBtn').addEventListener('click', () => openDialog());
  $('#welcomeNewTask')?.addEventListener('click', () => openDialog());
  $$('.column-add').forEach(b => b.addEventListener('click', () => openDialog(null, b.dataset.status)));

  $('#taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#fieldTitle').value.trim();
    if (!title) return;
    const data = {
      title,
      desc: $('#fieldDesc').value.trim(),
      status: $('#fieldStatus').value,
      priority: $('#fieldPriority').value,
      due: $('#fieldDue').value,
      subtasks: []
    };
    if (editingId) {
      updateTaskInBackend(editingId, data);
    } else {
      addTaskToBackend(data);
    }
    $('#taskDialog').close();
  });

  $('#closeDialogBtn').onclick = $('#cancelBtn').onclick = () => $('#taskDialog').close();
  $('#deleteTaskBtn').onclick = () => {
    if (editingId && confirm('Hapus tugas ini?')) {
      deleteTaskFromBackend(editingId);
      $('#taskDialog').close();
    }
  };

  document.addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit]');
    if (edit) openDialog(edit.dataset.edit);

    const move = e.target.closest('[data-move]');
    if (move) {
      const t = tasks.find(x => x.id === move.dataset.move);
      const nextStatus = t.status === 'todo' ? 'progress' : t.status === 'progress' ? 'done' : 'todo';
      updateTaskInBackend(t.id, { status: nextStatus });
    }
  });

  $$('[data-filter]').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.filter; renderAll(); }));
  $$('.view-btn').forEach(b => b.addEventListener('click', () => { state.view = b.dataset.view; renderAll(); }));
  $('#priorityFilter')?.addEventListener('change', (e) => { state.priority = e.target.value; renderAll(); });
  $('#searchInput')?.addEventListener('input', (e) => { state.search = e.target.value; renderAll(); });

  $('#logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('taskflow_session');
    currentUser = '';
    $('#app').hidden = true;
    $('#authScreen').hidden = false;
  });
}

// ================= 5. INITIALIZATION =================
function init() {
  setupAuth();
  setupEvents();

  const session = localStorage.getItem('taskflow_session');
  if (session && getUsers()[session]) {
    currentUser = session;
    enterApp();
  }
}

init();
