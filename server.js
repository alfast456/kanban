const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

// Jalur API: Membuat kartu tugas baru (POST)
app.post('/api/tasks', async (req, res) => {
    try {
        const { board_id, content, description, position, priority = 'Low' } = req.body;
        const result = await pool.query(
            'INSERT INTO tasks (board_id, content, description, position, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [board_id, content, description, position, priority]
        );
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
        const { board_id, position, content, description, priority } = req.body;
        const result = await pool.query(
            `UPDATE tasks 
             SET board_id = COALESCE($1, board_id), 
                 position = COALESCE($2, position), 
                 content = COALESCE($3, content), 
                 description = COALESCE($4, description), 
                 priority = COALESCE($5, priority) 
             WHERE id = $6 RETURNING *`,
            [board_id, position, content, description, priority, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Task not found" });
        }
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