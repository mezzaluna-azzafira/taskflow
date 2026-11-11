# TaskFlow — Papan Tugas Kanban

Aplikasi web To-Do List bergaya Kanban (To Do → In Progress → Done) dengan drag & drop, filter, validasi, dan penyimpanan otomatis. Dibuat dengan HTML + CSS + JavaScript murni (tanpa framework), sehingga seluruh kodenya mudah dibaca dan dijelaskan.

## Fitur

| Fitur | Keterangan |
|---|---|
| Create | Tambah tugas lewat tombol **+ Task Baru**, tombol **+** di tiap kolom, atau kolom **Tambah cepat** |
| Read | Tampilan **Board** (kartu per kolom) dan **List** (daftar dengan badge status) |
| Update | Edit isi tugas, ubah status lewat drag & drop, tombol ◀ ▶, atau dropdown di List |
| Delete | Hapus tugas, lalu bisa **Urungkan** lewat notifikasi |
| Filter | Tab status (Semua / To Do / In Progress / Done), filter prioritas, dan pencarian |
| Validasi | Judul kosong atau kurang dari 3 karakter ditolak, pesan error tampil di layar |
| Checklist | Sub-task per tugas dengan progress bar |
| Deadline | Tugas yang lewat deadline ditandai merah dan dihitung di statistik |
| Statistik | Ring progres, total, dan jumlah per status, diperbarui otomatis |
| Database | Disimpan otomatis di `localStorage` browser |
| Backup | **Export** dan **Import** file JSON |
| Ekstra | Tema gelap/terang, konfetti saat tugas selesai, pintasan keyboard (`N`, `/`, `Esc`) |

## Cara menjalankan

1. Buka folder ini di VS Code.
2. Klik kanan `index.html` → **Open with Live Server** (ekstensi Live Server), atau cukup klik dua kali `index.html`.

## Menjalankan ESLint

```bash
npm install
npx eslint script.js
npx eslint script.js --fix
```

Target: 0 error.

## Struktur folder

```
taskflow/
├── index.html          # kerangka halaman
├── style.css           # tampilan (tema terang/gelap)
├── script.js           # seluruh logika
├── package.json
├── eslint.config.js    # konfigurasi linter
└── .vscode/settings.json
```

## Push ke GitHub

Buat repository kosong di GitHub, lalu jalankan di folder proyek:

```bash
git init
git add .
git commit -m "feat: TaskFlow kanban to-do list"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

Opsional: aktifkan **Settings → Pages → Deploy from branch (main)** agar aplikasi punya link online.

## Peta kode ke unit kompetensi

| Unit | Di mana di kode |
|---|---|
| J.620100.004.02 Struktur Data | `tasks` = array of objects `{ id, title, desc, status, priority, due, subtasks }` |
| J.620100.009.01 Spesifikasi Program | `addTask`, `renderBoard`/`renderList`, `updateStatus`, `deleteTask`, `filterTasks`, `validateTitle` |
| J.620100.010.01 Perintah Eksekusi | `createCard`, `createListRow`, fungsi `el()` (DOM: `createElement`, `textContent`, `className`, `addEventListener`) |
| J.620100.011.01 Instalasi Tools | Node.js, npm, VS Code, ESLint, Live Server |
| J.620100.012.01 Pengaturan Tools | `eslint.config.js`, `.vscode/settings.json` |
| J.620100.016.01 Best Practices | Penamaan jelas, `const`/`let`, `===`, satu fungsi satu tugas, komentar seperlunya |
| J.620100.017.02 Pemrograman Terstruktur | Sequence (`addTask`), Selection (`validateTitle`), Iteration (`forEach` di `renderBoard`) |
| J.620100.025.02 Debugging | Console browser, `npx eslint`, uji tiap fitur |

## Latihan menjelaskan ke asesor

Baca kodenya, lalu coba jawab dengan kata sendiri:

- **Kenapa array of objects?** Satu tugas = satu object, banyak tugas = satu array, jadi mudah ditampilkan, difilter, dan diubah.
- **Di mana filter status?** Fungsi `filterTasks(status)` di `script.js`. `getVisibleTasks()` menggabungkannya dengan prioritas dan pencarian.
- **Bagaimana tugas tampil di halaman?** `renderAll()` memanggil `renderBoard()`, yang membuat kartu lewat `createCard()` dan memasukkannya ke kolom dengan `appendChild`.
- **Bagaimana validasi bekerja?** `validateTitle()` mengembalikan teks error atau string kosong. Jika ada error, tugas tidak dibuat dan pesan tampil di bawah input.
- **Bagaimana drag & drop bekerja?** Kartu `draggable`. Saat `dragover` dihitung posisi kartu di bawah kursor, saat `drop` dipanggil `moveTask(id, status, beforeId)` lalu layar dirender ulang.
- **Mana sequence, selection, iteration?** Lihat tabel peta kode di atas.
- **Bagaimana kamu melacak bug?** Reproduksi, baca pesan di Console, `console.log` atau breakpoint di tab Sources, perbaiki, uji ulang.

## Catatan

- Data tersimpan di browser yang dipakai (`localStorage`), bukan di server. Pakai **Export** untuk backup.
- Drag & drop bawaan browser tidak berjalan di layar sentuh, jadi disediakan tombol ◀ ▶ pada kartu.
- Selalu ikuti soal MUK dan ketentuan teknis dari panitia LSP saat ujian.
