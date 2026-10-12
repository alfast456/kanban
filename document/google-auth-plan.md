# Rencana Implementasi Autentikasi Google OAuth (Kanban Board)

Dokumen ini berisi panduan lengkap dan arsitektur untuk menambahkan fitur login Google ke aplikasi Kanban.

---

## 1. Arsitektur & Alur Autentikasi

Menggunakan **Google Identity Services (Sign In with Google)** berbasis ID Token (JWT):
1. **Frontend**: Memuat Google SDK dan menampilkan tombol resmi "Sign In with Google".
2. **User Login**: Pengguna memilih akun Google mereka dan memberikan izin.
3. **ID Token**: Google SDK mengembalikan credential JWT ID Token ke frontend.
4. **Verifikasi Backend**: Frontend mengirim token tersebut ke endpoint `POST /api/auth/google`.
5. **Upsert User**: Backend memverifikasi tanda tangan token dengan `google-auth-library`, lalu mencari atau membuat record baru di tabel `users`.
6. **Sesi Aplikasi**: Backend menerbitkan JWT aplikasi (atau session cookie) sebagai bukti login.
7. **Isolasi Data**: Setiap request data board dan task diproteksi oleh middleware auth dan difilter berdasarkan `user_id`.

---

## 2. Persiapan Database (PostgreSQL Migration)

Jalankan script SQL berikut menggunakan user dengan hak akses penuh (`postgres`):

```sql
-- 1. Tabel users untuk menyimpan profil Google
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Menambahkan relasi user_id ke tabel boards
ALTER TABLE boards ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- 3. Berikan akses ke user database aplikasi
GRANT ALL PRIVILEGES ON TABLE users TO kanban_db;
GRANT USAGE, SELECT ON SEQUENCE users_id_seq TO kanban_db;
GRANT ALL PRIVILEGES ON TABLE boards TO kanban_db;
```

---

## 3. Konfigurasi Google Cloud Console

1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat project baru (misal: `kanban-app`).
3. Konfigurasi **APIs & Services > OAuth consent screen**:
   - Pilih tipe: **External**.
   - Masukkan App name, User support email, dan Developer contact email.
   - Klik **Save and Continue** sampai selesai.
4. Buat kredensial di **APIs & Services > Credentials**:
   - Klik **Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Kanban Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:3001`
     - `http://localhost:5173`
   - Klik **Create** dan salin **Client ID**.
5. Tambahkan ke file `.env` di root project:
   ```env
   GOOGLE_CLIENT_ID=isi_client_id_anda.apps.googleusercontent.com
   JWT_SECRET=rahasia_jwt_aplikasi_anda
   ```

---

## 4. Rencana Perubahan Backend (`server.js`)

### Dependencies yang dibutuhkan:
```bash
npm install google-auth-library jsonwebtoken
```

### Endpoints baru:
- `POST /api/auth/google`:
  - Menerima `{ credential }`.
  - Verifikasi token via `client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID })`.
  - Ambil info user (`sub`, `email`, `name`, `picture`).
  - Query database:
    ```sql
    INSERT INTO users (google_id, email, name, avatar_url)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (google_id) DO UPDATE SET name = $3, avatar_url = $4
    RETURNING *;
    ```
  - Jika user baru pertama kali daftar, otomatis buatkan 3 kolom bawaan:
    - `To Do`
    - `In Progress`
    - `Done`
  - Terbitkan auth token aplikasi (JWT) dan kembalikan ke client.

- `GET /api/auth/me`:
  - Mengembalikan data pengguna saat ini jika token masih valid.

- `POST /api/auth/logout`:
  - Menghapus session / menginstruksikan client menghapus token.

### Middleware Auth (`requireAuth`):
- Memeriksa header `Authorization: Bearer <token>`.
- Menyetel `req.userId = decoded.id`.
- Update endpoint:
  - `GET /api/boards` → `SELECT * FROM boards WHERE user_id = $1 ORDER BY position ASC`
  - `POST /api/boards` → Sertakan `user_id` saat create board.
- Filter SSE (`/api/events`) agar broadcast hanya diterima oleh user pemilik board.

---

## 5. Rencana Perubahan Frontend (`src/App.jsx` & UI)

1. **Load Google Identity Services**:
   - Muat script `<script src="https://accounts.google.com/gsi/client" async defer></script>` di `index.html`.
2. **State Pengguna**:
   - Tambah state `user` (default `null`).
   - Cek local storage untuk token yang tersimpan saat pertama kali membuka web.
3. **Layar Login (Unauthenticated)**:
   - Jika `!user`, render kartu selamat datang dengan tombol Sign In Google:
     ```html
     <div id="google-login-btn"></div>
     ```
4. **Header Kanban (Authenticated)**:
   - Tampilkan info avatar user, nama, dan tombol Logout.
   - Ambil hanya data board & task milik user tersebut.
5. **Logout**:
   - Hapus token dari local storage dan reset state kembali ke halaman login.
