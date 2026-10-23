# Kanban Fullstack Application

Aplikasi Kanban minimalis full-stack dengan Express.js, PostgreSQL, dan React (Vite).

## Tech Stack
- **Backend:** Node.js, Express, `pg` (PostgreSQL client)
- **Frontend:** React 19, Vite, `@hello-pangea/dnd`
- **Realtime:** Server-Sent Events (SSE) dengan auto-reconnect & heartbeat
- **Test Runner:** Native `node:test` (tanpa library testing eksternal)

---

## Prasyarat
- Node.js >= 20.x
- PostgreSQL instance running

---

## Setup & Instalasi

1. Salin file environment:
   ```bash
   cp .env.example .env
   ```
2. Sesuaikan konfigurasi database dan port di `.env`.
3. Pasang dependensi:
   ```bash
   npm ci
   ```
4. Jalankan migrasi skema database:
   ```bash
   npm run db:migrate
   ```
   Migration files tersimpan di `server/db/migrations/`. Runner mencatat checksum di `schema_migrations` dan menolak perubahan pada migration yang sudah diterapkan.
   *(Opsional)* Masukkan data awal pengembangan:
   ```bash
   npm run db:seed
   ```

---

## Menjalankan Aplikasi

- **Development Mode (Frontend + Backend bersamaan):**
  ```bash
  npm run dev
  ```
- **Backend saja:**
  ```bash
  npm run dev:backend
  ```
- **Frontend saja:**
  ```bash
  npm run dev:frontend
  ```
- **Production Build & Run:**
  ```bash
  npm run build
  npm start
  ```
- **Docker Compose:**
  ```bash
  docker-compose up -d --build
  ```

---

## Testing & Kualitas Kode

- Jalankan unit tests:
  ```bash
  npm test
  ```
- Cek kesehatan aplikasi & koneksi database:
  ```bash
  curl http://localhost:3333/health
  ```

## Collaboration dan fitur task

- Pemilik board dapat membagikan board berdasarkan username sebagai `viewer` atau `editor`.
- Viewer dapat membaca board; editor dapat membuat, mengubah, dan menghapus task.
- Checklist tersedia lewat `/api/tasks/:id/checklist`.
- Activity log tersedia lewat `/api/tasks/:id/activity`.
- Label dan attachment sudah memiliki tabel DB; endpoint UI menyusul.
- Jalankan `grant.sql` memakai role admin setelah migration untuk memberi hak role aplikasi ke tabel dan sequence baru.

## Observability

Setiap response membawa header `X-Request-ID`. Kirim header tersebut pada laporan error untuk mencocokkan error dengan log server. Request log dicetak sebagai JSON satu baris dan tidak memuat request body atau password.

## Google Login

Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, dan `APP_URL` di `.env`. Daftarkan callback URL yang sama di Google Cloud Console. Login Google memakai `state`, token aplikasi HttpOnly cookie, dan tetap mempertahankan login username/password.
