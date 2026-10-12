const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
const sseClients = new Set();

function broadcastKanbanChange() {
    const message = `data: ${JSON.stringify({ type: 'kanban:changed' })}\n\n`;
    for (const client of sseClients) client.write(message);
}

// Middleware
app.use(cors());
app.use(express.json());

// Jalur SSE: Memberi tahu browser ketika data Kanban berubah
app.get('/api/events', (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
    });
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    sseClients.add(res);

    req.on('close', () => sseClients.delete(res));
});

// Jalur API: Mengambil semua kolom board
app.get('/api/boards', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM boards ORDER BY position ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Jalur API: Mengambil semua kartu (tasks)
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks ORDER BY position ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Jalur API: Membuat board baru (POST)
app.post('/api/boards', async (req, res) => {
    try {
        const { title, position } = req.body;
        if (!title || !title.trim()) return res.status(400).json({ message: 'Judul board wajib diisi' });
        const result = await pool.query(
            'INSERT INTO boards (title, position) VALUES ($1, $2) RETURNING *',
            [title.trim(), position ?? 0]
        );
        broadcastKanbanChange();
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Jalur API: Mengubah judul board (PUT)
app.put('/api/boards/:id', async (req, res) => {
    try {
        const { title } = req.body;
        if (!title || !title.trim()) return res.status(400).json({ message: 'Judul board wajib diisi' });
        const result = await pool.query(
            'UPDATE boards SET title = $1 WHERE id = $2 RETURNING *',
            [title.trim(), req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ message: 'Board tidak ditemukan' });
        broadcastKanbanChange();
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Jalur API: Menghapus board (DELETE)
app.delete('/api/boards/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM tasks WHERE board_id = $1', [req.params.id]);
        const result = await client.query('DELETE FROM boards WHERE id = $1 RETURNING *', [req.params.id]);
        if (!result.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Board tidak ditemukan' });
        }
        await client.query('COMMIT');
        broadcastKanbanChange();
        res.json({ message: 'Board berhasil dihapus' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
});

// Jalur API: Membuat kartu tugas baru (POST)
app.post('/api/tasks', async (req, res) => {
    try {
        const { board_id, content, description, position, priority = 'Low', due_date = null } = req.body;
        const result = await pool.query(
            'INSERT INTO tasks (board_id, content, description, position, priority, due_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [board_id, content, description, position, priority, due_date || null]
        );
        broadcastKanbanChange();
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Jalur API: Memperbarui tugas saat DND atau Edit (PUT)
app.put('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { board_id, position, content, description, priority, due_date, clear_due_date = false } = req.body;
        const result = await pool.query(
            `UPDATE tasks 
             SET board_id = COALESCE($1, board_id), 
                 position = COALESCE($2, position), 
                 content = COALESCE($3, content), 
                 description = COALESCE($4, description), 
                 priority = COALESCE($5, priority),
                 due_date = CASE WHEN $6 = true THEN NULL WHEN $7::date IS NOT NULL THEN $7::date ELSE due_date END
             WHERE id = $8 RETURNING *`,
            [board_id, position, content, description, priority, clear_due_date, due_date || null, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Task not found" });
        }
        broadcastKanbanChange();
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Jalur API: Menghapus kartu tugas (DELETE)
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'DELETE FROM tasks WHERE id = $1 RETURNING *',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Task not found" });
        }
        broadcastKanbanChange();
        res.json({ message: "Task deleted successfully" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Melayani file statis Frontend (Vite Build) di tahap Production
const path = require('path');
app.use(express.static(path.join(__dirname, 'dist')));

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Nyalakan Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server Backend jalan di http://localhost:${PORT}`);
});