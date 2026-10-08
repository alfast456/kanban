const pool = require('./db');

async function migrate() {
    try {
        await pool.query("ALTER TABLE tasks ADD COLUMN priority VARCHAR(20) DEFAULT 'Low';");
        console.log("Kolom 'priority' berhasil ditambahkan ke tabel 'tasks'.");
    } catch (err) {
        console.log("Info Migrasi:", err.message);
    } finally {
        pool.end();
    }
}

migrate();
