"use strict";

/* ==========================================================
   TaskFlow — Papan Tugas Kanban
   Peta kode ke unit kompetensi (untuk dijelaskan ke asesor):
   1. DATA            -> J.620100.004.02 Menggunakan Struktur Data
   2. LOGIKA          -> J.620100.009.01 Menggunakan Spesifikasi Program
                         J.620100.017.02 Pemrograman Terstruktur
   3. TAMPILAN        -> J.620100.010.01 Perintah Eksekusi Program (DOM)
   4. EVENT & ALUR    -> J.620100.017.02 Pemrograman Terstruktur
   Gaya penulisan     -> J.620100.016.01 Guidelines & Best Practices
   ========================================================== */


/* ==========================================================
   1. DATA — array of objects
   Satu task = satu object { id, title, desc, status, priority, due, subtasks }
   ========================================================== */
const STORAGE_KEY = "taskflow_db_v1";
const THEME_KEY = "taskflow_theme";
const MIN_TITLE_LENGTH = 3;
const STATUSES = ["todo", "progress", "done"];
const STATUS_LABEL = { todo: "To Do", progress: "In Progress", done: "Done" };
const PRIORITIES = ["Tinggi", "Sedang", "Rendah"];

let tasks = [];
let nextId = 1;
let editingId = null;
let draftSubtasks = [];
let draggedId = null;
let lastDeleted = null;

// Kondisi tampilan: filter status, kata kunci, prioritas, mode view
const state = { filter: "all", search: "", priority: "all", view: "board" };

// Referensi elemen HTML (diambil sekali, dipakai berulang)
const els = {
  search: document.getElementById("searchInput"),
  priorityFilter: document.getElementById("priorityFilter"),
  clearFilters: document.getElementById("clearFilters"),
  newBtn: document.getElementById("newTaskBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importFile: document.getElementById("importFile"),
  resetBtn: document.getElementById("resetBtn"),
  themeBtn: document.getElementById("themeBtn"),
  boardView: document.getElementById("boardView"),
  listView: document.getElementById("listView"),
  listBody: document.getElementById("listBody"),
  columns: document.querySelectorAll(".column"),
  tabs: document.querySelectorAll(".tab"),
  viewBtns: document.querySelectorAll(".view-btn"),
  statTotal: document.getElementById("statTotal"),
  statTodo: document.getElementById("statTodo"),
  statProgress: document.getElementById("statProgress"),
  statDone: document.getElementById("statDone"),
  statOverdue: document.getElementById("statOverdue"),
  ring: document.getElementById("ring"),
  ringPercent: document.getElementById("ringPercent"),
  progressText: document.getElementById("progressText"),
  toasts: document.getElementById("toasts"),
  confetti: document.getElementById("confettiLayer"),
  dialog: document.getElementById("taskDialog"),
  form: document.getElementById("taskForm"),
  dialogTitle: document.getElementById("dialogTitle"),
  fieldTitle: document.getElementById("fieldTitle"),
  titleError: document.getElementById("titleError"),
  fieldDesc: document.getElementById("fieldDesc"),
  fieldStatus: document.getElementById("fieldStatus"),
  fieldPriority: document.getElementById("fieldPriority"),
  fieldDue: document.getElementById("fieldDue"),
  subtaskInput: document.getElementById("subtaskInput"),
  addSubtaskBtn: document.getElementById("addSubtaskBtn"),
  subtaskList: document.getElementById("subtaskList"),
  deleteBtn: document.getElementById("deleteTaskBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  closeDialogBtn: document.getElementById("closeDialogBtn")
};

// Elemen penanda posisi saat kartu diseret
const dropIndicator = document.createElement("div");
dropIndicator.className = "drop-indicator";


/* ---------- Helper tanggal ---------- */
function toISODate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + month + "-" + day;
}

function dateFromToday(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return toISODate(date);
}

function formatDate(iso) {
  const date = new Date(iso + "T00:00:00");
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

function isOverdue(task) {
  return task.due !== "" && task.status !== "done" && task.due < toISODate(new Date());
}


/* ---------- Normalisasi data (aman untuk data impor) ---------- */
function sanitizeTask(item) {
  if (item === null || typeof item !== "object") {
    return null;
  }
  const title = typeof item.title === "string" ? item.title.trim() : "";
  if (title === "") {
    return null;
  }
  const subtasks = Array.isArray(item.subtasks)
    ? item.subtasks
      .filter((s) => s && typeof s.text === "string" && s.text.trim() !== "")
      .map((s) => ({ text: s.text.trim(), done: s.done === true }))
    : [];

  return {
    id: 0,
    title,
    desc: typeof item.desc === "string" ? item.desc.trim() : "",
    status: STATUSES.includes(item.status) ? item.status : "todo",
    priority: PRIORITIES.includes(item.priority) ? item.priority : "Sedang",
    due: typeof item.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.due) ? item.due : "",
    subtasks
  };
}

function sanitizeTasks(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const usedIds = new Set();
  let maxId = 0;
  list.forEach((item) => {
    if (item && Number.isInteger(item.id) && item.id > maxId) {
      maxId = item.id;
    }
  });

  const result = [];
  list.forEach((item) => {
    const clean = sanitizeTask(item);
    if (clean === null) {
      return;
    }
    if (Number.isInteger(item.id) && !usedIds.has(item.id)) {
      clean.id = item.id;
    } else {
      maxId += 1;
      clean.id = maxId;
    }
    usedIds.add(clean.id);
    result.push(clean);
  });
  return result;
}

function createSampleTasks() {
  return [
    {
      id: 1, title: "Setup VS Code & ESLint", status: "done", priority: "Tinggi", due: dateFromToday(-3),
      desc: "Pasang tools dan pastikan ESLint berjalan tanpa error.",
      subtasks: [
        { text: "Install Node.js LTS", done: true },
        { text: "npm install -D eslint", done: true },
        { text: "Buat eslint.config.js", done: true }
      ]
    },
    {
      id: 2, title: "Rancang struktur data tasks", status: "done", priority: "Sedang", due: dateFromToday(-2),
      desc: "Array of objects: id, title, status, priority, due.",
      subtasks: [{ text: "Tentukan field", done: true }, { text: "Tentukan nilai status", done: true }]
    },
    {
      id: 3, title: "Implementasi CRUD task", status: "progress", priority: "Tinggi", due: dateFromToday(1),
      desc: "addTask, renderTasks, updateStatus, deleteTask.",
      subtasks: [
        { text: "addTask()", done: true },
        { text: "updateStatus()", done: true },
        { text: "deleteTask() + undo", done: false }
      ]
    },
    {
      id: 4, title: "Filter status & validasi input", status: "progress", priority: "Sedang", due: dateFromToday(2),
      desc: "filterTasks(status) dan validateTitle(title).",
      subtasks: [{ text: "Tab filter", done: true }, { text: "Pesan error di layar", done: false }]
    },
    {
      id: 5, title: "Debugging & lint 0 error", status: "todo", priority: "Tinggi", due: dateFromToday(-1),
      desc: "Cek Console browser dan jalankan npx eslint script.js.",
      subtasks: []
    },
    {
      id: 6, title: "Backup project & push ke GitHub", status: "todo", priority: "Sedang", due: dateFromToday(4),
      desc: "git init, commit, lalu push ke repository.",
      subtasks: [{ text: "Buat repo di GitHub", done: false }, { text: "git push", done: false }]
    },
    {
      id: 7, title: "Latihan menjelaskan kode ke asesor", status: "todo", priority: "Rendah", due: dateFromToday(6),
      desc: "Jelaskan sequence, selection, iteration di kode sendiri.",
      subtasks: []
    }
  ];
}


/* ---------- Penyimpanan (database di browser: localStorage) ---------- */
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    showToast("Gagal menyimpan ke penyimpanan browser.");
  }
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    return sanitizeTasks(JSON.parse(raw));
  } catch {
    return null;
  }
}

function recalcNextId() {
  nextId = tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;
}

function loadInitialData() {
  const stored = loadTasks();
  tasks = stored === null ? sanitizeTasks(createSampleTasks()) : stored;
  recalcNextId();
  if (stored === null) {
    saveTasks();
  }
}


/* ==========================================================
   2. LOGIKA — fungsi kecil, satu fungsi satu tugas
   ========================================================== */

// Validasi: input kosong / terlalu pendek ditolak. Mengembalikan pesan error ("" = valid)
function validateTitle(title) {
  const clean = title.trim();
  if (clean === "") {
    return "Judul wajib diisi";
  }
  if (clean.length < MIN_TITLE_LENGTH) {
    return "Minimal " + MIN_TITLE_LENGTH + " karakter";
  }
  return "";
}

// CREATE
function addTask(title, details = {}) {
  if (validateTitle(title) !== "") {
    return null;
  }
  const task = {
    id: nextId++,
    title: title.trim(),
    desc: details.desc || "",
    status: details.status || "todo",
    priority: details.priority || "Sedang",
    due: details.due || "",
    subtasks: details.subtasks || []
  };
  tasks.push(task);
  saveTasks();
  return task;
}

// UPDATE (isi tugas)
function updateTask(id, changes) {
  const task = tasks.find((t) => t.id === id);
  if (!task) {
    return null;
  }
  Object.assign(task, changes);
  saveTasks();
  return task;
}

// UPDATE (status saja). Mengembalikan true jika status benar-benar berubah
function updateStatus(id, status) {
  const task = tasks.find((t) => t.id === id);
  if (!task || !STATUSES.includes(status) || task.status === status) {
    return false;
  }
  task.status = status;
  saveTasks();
  return true;
}

// DELETE (task disimpan sementara agar bisa di-undo)
function deleteTask(id) {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) {
    return null;
  }
  const removed = tasks[index];
  lastDeleted = { task: removed, index };
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  return removed;
}

function restoreDeleted() {
  if (lastDeleted === null) {
    return;
  }
  tasks.splice(Math.min(lastDeleted.index, tasks.length), 0, lastDeleted.task);
  lastDeleted = null;
  saveTasks();
  renderAll();
}

// Pindah kartu ke kolom lain pada posisi tertentu (dipakai drag & drop)
function moveTask(id, status, beforeId) {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1 || !STATUSES.includes(status)) {
    return false;
  }
  const task = tasks.splice(index, 1)[0];
  const statusChanged = task.status !== status;
  task.status = status;

  const targetIndex = beforeId === null ? -1 : tasks.findIndex((t) => t.id === beforeId);
  if (targetIndex === -1) {
    tasks.push(task);
  } else {
    tasks.splice(targetIndex, 0, task);
  }
  saveTasks();
  return statusChanged;
}

// FILTER berdasarkan status
function filterTasks(status) {
  if (status === "all") {
    return tasks;
  }
  return tasks.filter((t) => t.status === status);
}

function matchesSearch(task, keyword) {
  if (keyword === "") {
    return true;
  }
  const text = [task.title, task.desc].concat(task.subtasks.map((s) => s.text)).join(" ");
  return text.toLowerCase().includes(keyword);
}

// Gabungan filter status + prioritas + pencarian
function getVisibleTasks() {
  const keyword = state.search.trim().toLowerCase();
  return filterTasks(state.filter).filter((task) => {
    const priorityOk = state.priority === "all" || task.priority === state.priority;
    return priorityOk && matchesSearch(task, keyword);
  });
}

function hasActiveFilters() {
  return state.filter !== "all" || state.priority !== "all" || state.search.trim() !== "";
}

function countByStatus(status) {
  return tasks.filter((t) => t.status === status).length;
}


/* ==========================================================
   3. TAMPILAN — membuat elemen lewat DOM (aman dari XSS)
   ========================================================== */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function iconButton(symbol, label, handler) {
  const button = el("button", "icon-btn", symbol);
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    handler();
  });
  return button;
}

function createSubprogress(task) {
  const doneCount = task.subtasks.filter((s) => s.done).length;
  const percent = Math.round((doneCount / task.subtasks.length) * 100);

  const wrap = el("div", "subprogress");
  const label = el("div", "subprogress-label");
  label.appendChild(el("span", "", "Checklist"));
  label.appendChild(el("span", "", doneCount + "/" + task.subtasks.length));
  const bar = el("div", "bar");
  const fill = el("div", "bar-fill");
  fill.style.width = percent + "%";
  bar.appendChild(fill);
  wrap.appendChild(label);
  wrap.appendChild(bar);
  return wrap;
}

function createCard(task) {
  const card = el("article", "card" + (isOverdue(task) ? " is-overdue" : ""));
  card.draggable = true;
  card.tabIndex = 0;
  card.dataset.id = String(task.id);
  card.setAttribute("aria-label", "Tugas: " + task.title);

  const top = el("div", "card-top");
  top.appendChild(el("span", "badge prio-" + task.priority.toLowerCase(), task.priority));
  const actions = el("div", "card-actions");
  actions.appendChild(iconButton("✎", "Edit tugas", () => openDialog(task.id)));
  actions.appendChild(iconButton("🗑", "Hapus tugas", () => handleDelete(task.id)));
  top.appendChild(actions);
  card.appendChild(top);

  card.appendChild(el("h3", "", task.title));
  if (task.desc !== "") {
    card.appendChild(el("p", "card-desc", task.desc));
  }
  if (task.subtasks.length > 0) {
    card.appendChild(createSubprogress(task));
  }

  const foot = el("div", "card-foot");
  if (task.due !== "") {
    const late = isOverdue(task);
    foot.appendChild(el("span", "due" + (late ? " late" : ""), (late ? "⚠ Terlambat · " : "🗓 ") + formatDate(task.due)));
  } else {
    foot.appendChild(el("span", "due", "Tanpa deadline"));
  }

  // Tombol geser status (cadangan untuk layar sentuh yang tidak mendukung drag & drop)
  const moves = el("div", "card-moves");
  const index = STATUSES.indexOf(task.status);
  if (index > 0) {
    const prev = STATUSES[index - 1];
    moves.appendChild(iconButton("◀", "Pindah ke " + STATUS_LABEL[prev], () => changeStatus(task.id, prev)));
  }
  if (index < STATUSES.length - 1) {
    const next = STATUSES[index + 1];
    moves.appendChild(iconButton("▶", "Pindah ke " + STATUS_LABEL[next], () => changeStatus(task.id, next)));
  }
  foot.appendChild(moves);
  card.appendChild(foot);

  card.addEventListener("click", () => openDialog(task.id));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target === card) {
      openDialog(task.id);
    }
  });
  card.addEventListener("dragstart", (event) => {
    draggedId = task.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(task.id));
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => {
    draggedId = null;
    card.classList.remove("dragging");
    dropIndicator.remove();
    els.columns.forEach((column) => column.classList.remove("drag-over"));
  });
  return card;
}

function emptyMessage() {
  return hasActiveFilters()
    ? "Tidak ada tugas yang cocok dengan filter."
    : "Belum ada tugas. Seret kartu ke sini atau tambah baru.";
}

function renderBoard() {
  const visible = getVisibleTasks();
  els.columns.forEach((column) => {
    const status = column.dataset.status;
    const list = column.querySelector(".column-list");
    const items = visible.filter((t) => t.status === status);

    column.hidden = state.filter !== "all" && state.filter !== status;
    list.textContent = "";
    items.forEach((task) => list.appendChild(createCard(task)));
    if (items.length === 0) {
      list.appendChild(el("p", "empty", emptyMessage()));
    }
    column.querySelector(".column-count").textContent = String(items.length);
  });
}

function createListRow(task) {
  const row = el("div", "row");

  const titleCell = el("div");
  const titleBtn = el("button", "row-title", task.title);
  titleBtn.type = "button";
  titleBtn.addEventListener("click", () => openDialog(task.id));
  titleCell.appendChild(titleBtn);
  if (task.desc !== "") {
    titleCell.appendChild(el("span", "row-sub", task.desc));
  }
  row.appendChild(titleCell);

  const select = el("select", "status-select badge-" + task.status);
  select.setAttribute("aria-label", "Ubah status " + task.title);
  STATUSES.forEach((status) => {
    const option = el("option", "", STATUS_LABEL[status]);
    option.value = status;
    select.appendChild(option);
  });
  select.value = task.status;
  select.addEventListener("change", () => changeStatus(task.id, select.value));
  row.appendChild(select);

  row.appendChild(el("span", "badge prio-" + task.priority.toLowerCase(), task.priority));

  const late = isOverdue(task);
  const dueText = task.due === "" ? "—" : formatDate(task.due);
  row.appendChild(el("span", "due" + (late ? " late" : ""), dueText));

  row.appendChild(iconButton("🗑", "Hapus tugas", () => handleDelete(task.id)));
  return row;
}

function renderList() {
  const visible = getVisibleTasks();
  els.listBody.textContent = "";
  if (visible.length === 0) {
    els.listBody.appendChild(el("p", "empty", emptyMessage()));
    return;
  }
  visible.forEach((task) => els.listBody.appendChild(createListRow(task)));
}

function renderStats() {
  const total = tasks.length;
  const done = countByStatus("done");
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  els.statTotal.textContent = String(total);
  els.statTodo.textContent = String(countByStatus("todo"));
  els.statProgress.textContent = String(countByStatus("progress"));
  els.statDone.textContent = String(done);
  els.statOverdue.textContent = String(tasks.filter((t) => isOverdue(t)).length);
  els.ring.style.setProperty("--pct", String(percent));
  els.ringPercent.textContent = percent + "%";
  els.progressText.textContent = done + " dari " + total + " tugas selesai";

  els.tabs.forEach((tab) => {
    const key = tab.dataset.filter;
    const active = state.filter === key;
    tab.querySelector(".tab-count").textContent = String(key === "all" ? total : countByStatus(key));
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-pressed", String(active));
  });
}

function renderAll() {
  renderStats();
  els.boardView.hidden = state.view !== "board";
  els.listView.hidden = state.view !== "list";
  els.viewBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.view === state.view));
  els.clearFilters.hidden = !hasActiveFilters();

  if (state.view === "board") {
    renderBoard();
  } else {
    renderList();
  }
}


/* ---------- Aksi dari UI ---------- */
function changeStatus(id, status) {
  if (updateStatus(id, status)) {
    if (status === "done") {
      celebrate();
    }
    renderAll();
  }
}

function handleDelete(id) {
  const removed = deleteTask(id);
  if (removed === null) {
    return;
  }
  if (els.dialog.open) {
    els.dialog.close();
  }
  renderAll();
  showToast("Tugas dihapus: " + removed.title, "Urungkan", restoreDeleted);
}

function showToast(message, actionLabel, onAction) {
  const toast = el("div", "toast");
  toast.appendChild(el("span", "", message));
  if (actionLabel) {
    const button = el("button", "toast-action", actionLabel);
    button.type = "button";
    button.addEventListener("click", () => {
      onAction();
      toast.remove();
    });
    toast.appendChild(button);
  }
  els.toasts.appendChild(toast);
  window.setTimeout(() => toast.remove(), 5000);
}

function celebrate() {
  const colors = ["#6d4aff", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];
  for (let i = 0; i < 44; i += 1) {
    const piece = el("span", "confetti");
    piece.style.left = Math.round(Math.random() * 100) + "vw";
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--dx", Math.round(Math.random() * 240 - 120) + "px");
    piece.style.animationDelay = (Math.random() * 0.3).toFixed(2) + "s";
    els.confetti.appendChild(piece);
    window.setTimeout(() => piece.remove(), 2400);
  }
}


/* ---------- Dialog tambah / edit ---------- */
function showTitleError(message) {
  els.titleError.textContent = message;
  els.fieldTitle.classList.toggle("invalid", message !== "");
  els.fieldTitle.setAttribute("aria-invalid", String(message !== ""));
}

function renderDraftSubtasks() {
  els.subtaskList.textContent = "";
  draftSubtasks.forEach((subtask, index) => {
    const item = el("li", "subtask-item" + (subtask.done ? " done" : ""));
    const checkbox = el("input");
    checkbox.type = "checkbox";
    checkbox.checked = subtask.done;
    checkbox.addEventListener("change", () => {
      draftSubtasks[index].done = checkbox.checked;
      renderDraftSubtasks();
    });
    item.appendChild(checkbox);
    item.appendChild(el("span", "", subtask.text));
    item.appendChild(iconButton("✕", "Hapus poin checklist", () => {
      draftSubtasks.splice(index, 1);
      renderDraftSubtasks();
    }));
    els.subtaskList.appendChild(item);
  });
}

function addDraftSubtask() {
  const text = els.subtaskInput.value.trim();
  if (text === "") {
    return;
  }
  draftSubtasks.push({ text, done: false });
  els.subtaskInput.value = "";
  renderDraftSubtasks();
  els.subtaskInput.focus();
}

function openDialog(id = null, presetStatus = "todo") {
  const task = id === null ? null : tasks.find((t) => t.id === id);
  if (id !== null && !task) {
    return;
  }
  editingId = id;
  els.dialogTitle.textContent = task ? "Edit Tugas" : "Buat Tugas Baru";
  els.fieldTitle.value = task ? task.title : "";
  els.fieldDesc.value = task ? task.desc : "";
  els.fieldStatus.value = task ? task.status : presetStatus;
  els.fieldPriority.value = task ? task.priority : "Sedang";
  els.fieldDue.value = task ? task.due : "";
  els.subtaskInput.value = "";
  draftSubtasks = task ? task.subtasks.map((s) => ({ text: s.text, done: s.done })) : [];
  els.deleteBtn.hidden = !task;
  showTitleError("");
  renderDraftSubtasks();
  if (!els.dialog.open) {
    els.dialog.showModal();
  }
  els.fieldTitle.focus();
}

function readForm() {
  return {
    desc: els.fieldDesc.value.trim(),
    status: els.fieldStatus.value,
    priority: els.fieldPriority.value,
    due: els.fieldDue.value,
    subtasks: draftSubtasks.map((s) => ({ text: s.text, done: s.done }))
  };
}

function handleFormSubmit(event) {
  event.preventDefault();
  const error = validateTitle(els.fieldTitle.value);
  if (error !== "") {
    showTitleError(error);
    els.fieldTitle.focus();
    return;
  }

  const details = readForm();
  if (editingId === null) {
    const created = addTask(els.fieldTitle.value, details);
    if (created !== null && created.status === "done") {
      celebrate();
    }
    showToast("Tugas ditambahkan");
  } else {
    const before = tasks.find((t) => t.id === editingId);
    const wasDone = before ? before.status === "done" : false;
    updateTask(editingId, { title: els.fieldTitle.value.trim(), ...details });
    if (!wasDone && details.status === "done") {
      celebrate();
    }
    showToast("Perubahan disimpan");
  }
  els.dialog.close();
  renderAll();
}


/* ---------- Drag & drop ---------- */
// Mencari kartu yang berada tepat di bawah posisi kursor
function getDragAfterElement(list, y) {
  const cards = Array.from(list.querySelectorAll(".card:not(.dragging)"));
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  cards.forEach((card) => {
    const box = card.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: card };
    }
  });
  return closest.element;
}

function setupDragAndDrop() {
  els.columns.forEach((column) => {
    const list = column.querySelector(".column-list");

    column.addEventListener("dragover", (event) => {
      if (draggedId === null) {
        return;
      }
      event.preventDefault();
      column.classList.add("drag-over");
      const after = getDragAfterElement(list, event.clientY);
      if (after) {
        list.insertBefore(dropIndicator, after);
      } else {
        list.appendChild(dropIndicator);
      }
    });

    column.addEventListener("dragleave", (event) => {
      if (!column.contains(event.relatedTarget)) {
        column.classList.remove("drag-over");
        dropIndicator.remove();
      }
    });

    column.addEventListener("drop", (event) => {
      if (draggedId === null) {
        return;
      }
      event.preventDefault();
      const status = column.dataset.status;
      const next = dropIndicator.nextElementSibling;
      const beforeId = next && next.dataset.id ? Number(next.dataset.id) : null;

      const changed = moveTask(draggedId, status, beforeId);
      draggedId = null;
      column.classList.remove("drag-over");
      dropIndicator.remove();
      if (changed && status === "done") {
        celebrate();
      }
      renderAll();
    });
  });
}


/* ---------- Backup & restore (JSON) ---------- */
function exportData() {
  const payload = { app: "TaskFlow", version: 1, exportedAt: new Date().toISOString(), tasks };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "taskflow-backup-" + toISODate(new Date()) + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Backup berhasil diunduh");
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const imported = sanitizeTasks(Array.isArray(parsed) ? parsed : parsed.tasks);
      if (imported.length === 0) {
        showToast("File tidak berisi tugas yang valid");
        return;
      }
      if (!window.confirm("Ganti semua data dengan " + imported.length + " tugas dari file ini?")) {
        return;
      }
      tasks = imported;
      recalcNextId();
      saveTasks();
      renderAll();
      showToast("Import berhasil: " + imported.length + " tugas");
    } catch {
      showToast("Format file JSON tidak valid");
    }
  });
  reader.readAsText(file);
  event.target.value = "";
}

function resetData() {
  if (!window.confirm("Kembalikan ke data contoh? Semua tugas saat ini akan diganti.")) {
    return;
  }
  tasks = sanitizeTasks(createSampleTasks());
  recalcNextId();
  saveTasks();
  renderAll();
  showToast("Data contoh dimuat");
}


/* ---------- Tema terang / gelap ---------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
}

function loadTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    saved = null;
  }
  if (saved === "dark" || saved === "light") {
    return saved;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Penyimpanan tidak tersedia: tema tetap berubah untuk sesi ini
  }
}


/* ==========================================================
   4. EVENT & ALUR PROGRAM
   ========================================================== */
function setupQuickAdd() {
  document.querySelectorAll(".quick-add").forEach((form) => {
    const input = form.querySelector("input");
    const error = form.querySelector(".quick-error");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = validateTitle(input.value);
      if (message !== "") {
        error.textContent = message;
        input.classList.add("invalid");
        return;
      }
      addTask(input.value, { status: form.dataset.status });
      input.value = "";
      error.textContent = "";
      input.classList.remove("invalid");
      renderAll();
      showToast("Tugas ditambahkan");
      input.focus();
    });

    input.addEventListener("input", () => {
      error.textContent = "";
      input.classList.remove("invalid");
    });
  });
}

function setupFilters() {
  els.search.addEventListener("input", () => {
    state.search = els.search.value;
    renderAll();
  });
  els.priorityFilter.addEventListener("change", () => {
    state.priority = els.priorityFilter.value;
    renderAll();
  });
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.filter = tab.dataset.filter;
      renderAll();
    });
  });
  els.viewBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.view = btn.dataset.view;
      renderAll();
    });
  });
  els.clearFilters.addEventListener("click", () => {
    state.filter = "all";
    state.priority = "all";
    state.search = "";
    els.search.value = "";
    els.priorityFilter.value = "all";
    renderAll();
  });
}

function setupDialog() {
  els.newBtn.addEventListener("click", () => openDialog());
  document.querySelectorAll(".column-add").forEach((button) => {
    button.addEventListener("click", () => openDialog(null, button.dataset.status));
  });

  els.form.addEventListener("submit", handleFormSubmit);
  els.fieldTitle.addEventListener("input", () => showTitleError(""));
  els.cancelBtn.addEventListener("click", () => els.dialog.close());
  els.closeDialogBtn.addEventListener("click", () => els.dialog.close());
  els.deleteBtn.addEventListener("click", () => {
    if (editingId !== null) {
      handleDelete(editingId);
    }
  });
  els.addSubtaskBtn.addEventListener("click", addDraftSubtask);
  els.subtaskInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addDraftSubtask();
    }
  });
  els.dialog.addEventListener("click", (event) => {
    if (event.target === els.dialog) {
      els.dialog.close();
    }
  });
  els.dialog.addEventListener("close", () => {
    editingId = null;
  });
}

function setupShortcuts() {
  document.addEventListener("keydown", (event) => {
    const tag = event.target.tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    if (typing || els.dialog.open || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      openDialog();
    } else if (event.key === "/") {
      event.preventDefault();
      els.search.focus();
    }
  });
}

function init() {
  loadInitialData();
  applyTheme(loadTheme());
  setupFilters();
  setupQuickAdd();
  setupDialog();
  setupDragAndDrop();
  setupShortcuts();
  els.exportBtn.addEventListener("click", exportData);
  els.importFile.addEventListener("change", importData);
  els.resetBtn.addEventListener("click", resetData);
  els.themeBtn.addEventListener("click", toggleTheme);
  renderAll();
}

init();
