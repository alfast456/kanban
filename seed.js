const pool = require('./db');

async function seed() {
    console.log('Menjalankan seeder database...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Cek apakah data board sudah ada
        const { rows: existingBoards } = await client.query('SELECT id FROM boards LIMIT 1');
        if (existingBoards.length > 0) {
            console.log('Tabel boards sudah memiliki data. Seeding dibatalkan.');
            await client.query('ROLLBACK');
            return;
        }

        // Insert default boards
        const boardRes = await client.query(`
            INSERT INTO boards (title, position) VALUES 
            ('Backlog', 0),
            ('In Progress', 1),
            ('Done', 2)
            RETURNING id, title;
        `);

        const backlogId = boardRes.rows.find(b => b.title === 'Backlog').id;
        const inProgressId = boardRes.rows.find(b => b.title === 'In Progress').id;
        const doneId = boardRes.rows.find(b => b.title === 'Done').id;

        // Insert sample tasks
        await client.query(`
            INSERT INTO tasks (board_id, content, description, position, priority, due_date) VALUES 
            ($1, 'Setup environment & DB', 'Pastikan database PostgreSQL running dan file .env terisi dengan benar.', 0, 'High', CURRENT_DATE + INTERVAL '2 day'),
            ($1, 'Riset UI components', 'Mencari referensi tema kanban minimalis.', 1, 'Low', NULL),
            ($2, 'Modularisasi Backend', 'Pecah server.js ke routes, services, dan middleware terpisah.', 0, 'Medium', CURRENT_DATE + INTERVAL '5 day'),
            ($3, 'Inisialisasi Project', 'Setup monorepo React + Express awal.', 0, 'Low', CURRENT_DATE - INTERVAL '1 day');
        `, [backlogId, inProgressId, doneId]);

        await client.query('COMMIT');
        console.log('Seeding berhasil: 3 board default dan 4 sample task ditambahkan.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Seeding gagal:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
