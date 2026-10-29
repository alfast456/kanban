const express = require('express');
const pool = require('../../db');
const sseService = require('../services/sseService');
const { requireId, validateBoard } = require('../middleware/validation');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
    try {
        const query = req.user
            ? {
                text: `SELECT DISTINCT boards.*,
                              CASE WHEN boards.user_id = $1 THEN 'owner' ELSE board_members.role END AS access_role
                       FROM boards
                       LEFT JOIN board_members ON board_members.board_id = boards.id AND board_members.user_id = $1
                       WHERE boards.user_id = $1 OR board_members.user_id = $1
                       ORDER BY boards.position ASC, boards.id ASC`,
                values: [req.user.id],
            }
            : {
                text: `SELECT *, 'owner' AS access_role
                       FROM boards
                       WHERE user_id IS NULL
                       ORDER BY position ASC, id ASC`,
                values: [],
            };
        const result = await pool.query(query.text, query.values);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching boards:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

router.post('/:id/members', requireId, requireAuth, async (req, res) => {
    const { username, role } = req.body;
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
        return res.status(400).json({ message: 'Username anggota tidak valid' });
    }
    if (!['viewer', 'editor'].includes(role)) {
        return res.status(400).json({ message: 'Role harus viewer atau editor' });
    }
    try {
        const owner = await pool.query('SELECT id FROM boards WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (!owner.rows.length) return res.status(404).json({ message: 'Board tidak ditemukan' });
        const member = await pool.query('SELECT id, username FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
        if (!member.rows.length) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
        if (member.rows[0].id === req.user.id) return res.status(400).json({ message: 'Pemilik board tidak dapat ditambahkan sebagai anggota' });
        const result = await pool.query(
            `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)
             ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role
             RETURNING board_id, user_id, role`,
            [req.params.id, member.rows[0].id, role]
        );
        sseService.broadcast('board:members', { boardId: Number(req.params.id) });
        res.status(201).json({ ...result.rows[0], username: member.rows[0].username });
    } catch (err) {
        console.error('Error adding member:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

router.get('/:id/members', requireId, requireAuth, async (req, res) => {
    try {
        const board = await pool.query(
            'SELECT id FROM boards WHERE id = $1 AND (user_id = $2 OR EXISTS (SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2))',
            [req.params.id, req.user.id]
        );
        if (!board.rows.length) return res.status(404).json({ message: 'Board tidak ditemukan' });
        const members = await pool.query(
            `SELECT users.id, users.username, board_members.role FROM board_members
             JOIN users ON users.id = board_members.user_id WHERE board_members.board_id = $1 ORDER BY users.username`,
            [req.params.id]
        );
        res.json(members.rows);
    } catch (err) {
        console.error('Error fetching members:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

router.delete('/:id/members/:userId', requireId, requireAuth, async (req, res) => {
    if (!/^\d+$/.test(req.params.userId) || Number(req.params.userId) < 1) return res.status(400).json({ message: 'ID tidak valid' });
    try {
        const result = await pool.query(
            `DELETE FROM board_members USING boards WHERE board_members.board_id = boards.id
             AND board_members.board_id = $1 AND board_members.user_id = $2 AND boards.user_id = $3 RETURNING board_members.user_id`,
            [req.params.id, req.params.userId, req.user.id]
        );
        if (!result.rows.length) return res.status(404).json({ message: 'Anggota tidak ditemukan' });
        sseService.broadcast('board:members', { boardId: Number(req.params.id) });
        res.status(204).end();
    } catch (err) {
        console.error('Error deleting member:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

router.get('/:id/labels', requireId, optionalAuth, async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const result = await pool.query(
            `SELECT labels.* FROM labels JOIN boards ON boards.id = labels.board_id
             LEFT JOIN board_members ON board_members.board_id = boards.id AND board_members.user_id = $2
             WHERE labels.board_id = $1 AND (boards.user_id = $2 OR board_members.user_id = $2 OR (boards.user_id IS NULL AND $2 IS NULL)) ORDER BY labels.name`,
            [req.params.id, userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching labels:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

router.post('/:id/labels', requireId, optionalAuth, async (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const color = typeof req.body.color === 'string' ? req.body.color : '';
    if (!name || name.length > 40 || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return res.status(400).json({ message: 'Nama atau warna label tidak valid' });
    }
    try {
        const userId = req.user?.id || null;
        const access = await pool.query(
            `SELECT boards.id FROM boards LEFT JOIN board_members ON board_members.board_id = boards.id AND board_members.user_id = $2
             WHERE boards.id = $1 AND (boards.user_id = $2 OR board_members.role = 'editor' OR (boards.user_id IS NULL AND $2 IS NULL))`,
            [req.params.id, userId]
        );
        if (!access.rows.length) return res.status(404).json({ message: 'Board tidak ditemukan' });
        const result = await pool.query('INSERT INTO labels (board_id, name, color) VALUES ($1, $2, $3) RETURNING *', [req.params.id, name, color]);
        sseService.broadcast('board:labels', { boardId: Number(req.params.id) });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Nama label sudah digunakan' });
        console.error('Error creating label:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

router.post('/', optionalAuth, validateBoard, async (req, res) => {
    try {
        const { title, position } = req.body;
        const userId = req.user?.id || null;
        const result = await pool.query(
            'INSERT INTO boards (title, position, user_id) VALUES ($1, $2, $3) RETURNING *',
            [title.trim(), position ?? 0, userId]
        );
        sseService.broadcast('board:created', { board: result.rows[0] });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating board:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

router.put('/:id', requireId, optionalAuth, validateBoard, async (req, res) => {
    try {
        const { title, position } = req.body;
        const userId = req.user?.id || null;
        const result = await pool.query(
            `UPDATE boards
             SET title = $1,
                 position = COALESCE($2, position)
             WHERE id = $3 AND (
                (user_id = $4 OR (user_id IS NULL AND $4 IS NULL)) OR
                EXISTS (SELECT 1 FROM board_members WHERE board_id = boards.id AND user_id = $4 AND role = 'editor')
            ) RETURNING *`,
            [title.trim(), position !== undefined ? position : null, req.params.id, userId]
        );
        if (!result.rows.length) return res.status(404).json({ message: 'Board tidak ditemukan' });
        sseService.broadcast('board:updated', { board: result.rows[0] });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating board:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

router.delete('/:id', requireId, optionalAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user?.id || null;
        await client.query('BEGIN');
        const boardCheck = await client.query(
            'SELECT id FROM boards WHERE id = $1 AND (user_id = $2 OR (user_id IS NULL AND $2 IS NULL)) FOR UPDATE',
            [req.params.id, userId]
        );
        if (!boardCheck.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Board tidak ditemukan' });
        }

        // Delete cascade automatically removes tasks & child items
        await client.query('DELETE FROM boards WHERE id = $1', [req.params.id]);

        // Reindex remaining boards for this user/scope
        const remaining = await client.query(
            'SELECT id FROM boards WHERE (user_id = $1 OR (user_id IS NULL AND $1 IS NULL)) ORDER BY position ASC, id ASC',
            [userId]
        );
        for (let i = 0; i < remaining.rows.length; i++) {
            await client.query('UPDATE boards SET position = $1 WHERE id = $2', [i, remaining.rows[i].id]);
        }

        await client.query('COMMIT');
        sseService.broadcast('board:deleted', { id: Number(req.params.id) });
        res.json({ message: 'Board berhasil dihapus' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting board:', err.message);
        res.status(500).json({ message: 'Server Error' });
    } finally {
        client.release();
    }
});

module.exports = router;
