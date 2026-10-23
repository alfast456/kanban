const express = require('express');
const pool = require('../../db');
const sseService = require('../services/sseService');
const { requireId, validateTask } = require('../middleware/validation');
const { optionalAuth } = require('../middleware/auth');
const { insertAt, reindex } = require('../services/taskPositions');
const { boardAccess, taskAccess } = require('../services/boardAccess');

const router = express.Router();

async function logActivity(db, taskId, userId, action, detail = null) {
    try {
        await db.query(
            'INSERT INTO task_activity (task_id, user_id, action, detail) VALUES ($1, $2, $3, $4)',
            [taskId, userId || null, action, detail]
        );
    } catch (err) {
        console.warn('Gagal mencatat aktivitas:', err.message);
    }
}

router.get('/', optionalAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT tasks.*,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', l.id, 'name', l.name, 'color', l.color))
                     FROM labels l JOIN task_labels tl ON tl.label_id = l.id WHERE tl.task_id = tasks.id),
                    '[]'::json
                ) AS labels,
                COALESCE((SELECT COUNT(*)::int FROM task_checklist_items WHERE task_id = tasks.id), 0) AS checklist_total,
                COALESCE((SELECT COUNT(*)::int FROM task_checklist_items WHERE task_id = tasks.id AND completed = true), 0) AS checklist_done
             FROM tasks
             JOIN boards ON boards.id = tasks.board_id
             LEFT JOIN board_members ON board_members.board_id = boards.id AND board_members.user_id = $1
             WHERE (boards.user_id = $1 OR board_members.user_id = $1 OR (boards.user_id IS NULL AND $1 IS NULL))
             ORDER BY tasks.board_id ASC, tasks.position ASC`,
            [req.user?.id || null]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.post('/', optionalAuth, validateTask, async (req, res) => {
    const client = await pool.connect();
    try {
        const { board_id, content, description, position, priority = 'Low', due_date = null } = req.body;
        await client.query('BEGIN');
        const board = await boardAccess(client, board_id, req.user?.id, 'edit');
        if (!board) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Board not found' });
        }
        const existing = await client.query('SELECT * FROM tasks WHERE board_id = $1 ORDER BY position ASC, id ASC', [board_id]);
        const task = { board_id, content: content.trim(), description: description ?? null, priority, due_date: due_date || null };
        const orderedTasks = reindex(insertAt(existing.rows, task, position ?? existing.rows.length));
        let createdTask;
        for (const [index, item] of orderedTasks.entries()) {
            if (item.id === undefined) {
                const result = await client.query(
                    'INSERT INTO tasks (board_id, content, description, position, priority, due_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                    [item.board_id, item.content, item.description, index, item.priority, item.due_date]
                );
                createdTask = result.rows[0];
            } else {
                await client.query('UPDATE tasks SET position = $1 WHERE id = $2', [index, item.id]);
            }
        }
        await logActivity(client, createdTask.id, req.user?.id, 'created', 'Task dibuat');
        await client.query('COMMIT');
        sseService.broadcast('task:created', { task: createdTask });
        res.status(201).json(createdTask);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ message: 'Server Error' });
    } finally {
        client.release();
    }
});

router.put('/:id', requireId, optionalAuth, validateTask, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { board_id, position, content, description, priority, due_date, clear_due_date = false } = req.body;

        await client.query('BEGIN');
        const currentTask = await taskAccess(client, id, req.user?.id, 'edit');
        if (!currentTask) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Task not found' });
        }
        const sourceBoardId = currentTask.board_id;
        const destinationBoardId = board_id ?? sourceBoardId;
        const boardIds = [...new Set([sourceBoardId, destinationBoardId])];
        const boards = await Promise.all(boardIds.map(boardId => boardAccess(client, boardId, req.user?.id, 'edit')));
        if (boards.some(board => !board)) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Board not found' });
        }

        const result = await client.query(
            `UPDATE tasks
             SET board_id = $1,
                 content = COALESCE($2, content),
                 description = COALESCE($3, description),
                 priority = COALESCE($4, priority),
                 due_date = CASE WHEN $5 = true THEN NULL WHEN $6::date IS NOT NULL THEN $6::date ELSE due_date END
             WHERE id = $7 RETURNING *`,
            [destinationBoardId, content, description, priority, clear_due_date, due_date || null, id]
        );
        let updatedTask = result.rows[0];
        const movedBoard = sourceBoardId !== destinationBoardId;

        if (movedBoard || position !== undefined) {
            const destinationTasks = await client.query(
                'SELECT * FROM tasks WHERE board_id = $1 AND id != $2 ORDER BY position ASC, id ASC',
                [destinationBoardId, id]
            );
            const orderedDestination = reindex(
                insertAt(destinationTasks.rows, updatedTask, position ?? destinationTasks.rows.length)
            );
            for (const item of orderedDestination) {
                await client.query('UPDATE tasks SET position = $1 WHERE id = $2', [item.position, item.id]);
            }
            updatedTask = orderedDestination.find(task => task.id === Number(id));

            if (movedBoard) {
                const sourceTasks = await client.query(
                    'SELECT id FROM tasks WHERE board_id = $1 ORDER BY position ASC, id ASC',
                    [sourceBoardId]
                );
                for (const item of reindex(sourceTasks.rows)) {
                    await client.query('UPDATE tasks SET position = $1 WHERE id = $2', [item.position, item.id]);
                }
            }
        }

        await logActivity(client, id, req.user?.id, movedBoard ? 'moved' : 'updated', movedBoard ? `Board ${sourceBoardId} ke ${destinationBoardId}` : 'Task diperbarui');
        await client.query('COMMIT');
        sseService.broadcast('task:updated', { task: updatedTask });
        res.json(updatedTask);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ message: 'Server Error' });
    } finally {
        client.release();
    }
});

router.put('/:id/labels', requireId, optionalAuth, async (req, res) => {
    const labelIds = req.body.label_ids;
    if (!Array.isArray(labelIds) || labelIds.some(id => !Number.isInteger(id) || id < 1) || new Set(labelIds).size !== labelIds.length) {
        return res.status(400).json({ message: 'label_ids harus berupa daftar ID unik yang valid' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const task = await taskAccess(client, req.params.id, req.user?.id, 'edit');
        if (!task) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Task not found' });
        }
        const labels = await client.query('SELECT id FROM labels WHERE board_id = $1 AND id = ANY($2::int[])', [task.board_id, labelIds]);
        if (labels.rows.length !== labelIds.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Label harus berasal dari board yang sama' });
        }
        await client.query('DELETE FROM task_labels WHERE task_id = $1', [req.params.id]);
        for (const labelId of labelIds) await client.query('INSERT INTO task_labels (task_id, label_id) VALUES ($1, $2)', [req.params.id, labelId]);
        await logActivity(client, req.params.id, req.user?.id, 'labels_updated', 'Label tugas diperbarui');
        await client.query('COMMIT');
        sseService.broadcast('task:updated', { taskId: Number(req.params.id) });
        res.json({ task_id: Number(req.params.id), label_ids: labelIds });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ message: 'Server Error' });
    } finally {
        client.release();
    }
});

router.get('/:id/attachments', requireId, optionalAuth, async (req, res) => {
    try {
        const task = await taskAccess(pool, req.params.id, req.user?.id);
        if (!task) return res.status(404).json({ message: 'Task not found' });
        const result = await pool.query('SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY created_at DESC', [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

router.post('/:id/attachments', requireId, optionalAuth, async (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    let url;
    try { url = new URL(req.body.url); } catch {}
    if (!name || name.length > 255 || !url || !['http:', 'https:'].includes(url.protocol)) {
        return res.status(400).json({ message: 'Nama file atau URL lampiran tidak valid' });
    }
    try {
        const task = await taskAccess(pool, req.params.id, req.user?.id, 'edit');
        if (!task) return res.status(404).json({ message: 'Task not found' });
        const result = await pool.query('INSERT INTO task_attachments (task_id, name, url) VALUES ($1, $2, $3) RETURNING *', [req.params.id, name, url.toString()]);
        await logActivity(pool, req.params.id, req.user?.id, 'attachment_added', `Lampiran ditambahkan: ${name}`);
        sseService.broadcast('task:updated', { taskId: Number(req.params.id) });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

router.delete('/:id/attachments/:attachmentId', requireId, optionalAuth, async (req, res) => {
    if (!/^\d+$/.test(req.params.attachmentId) || Number(req.params.attachmentId) < 1) return res.status(400).json({ message: 'ID tidak valid' });
    try {
        const task = await taskAccess(pool, req.params.id, req.user?.id, 'edit');
        if (!task) return res.status(404).json({ message: 'Task not found' });
        const result = await pool.query('DELETE FROM task_attachments WHERE task_id = $1 AND id = $2 RETURNING name', [req.params.id, req.params.attachmentId]);
        if (!result.rows.length) return res.status(404).json({ message: 'Lampiran tidak ditemukan' });
        await logActivity(pool, req.params.id, req.user?.id, 'attachment_deleted', `Lampiran dihapus: ${result.rows[0].name}`);
        sseService.broadcast('task:updated', { taskId: Number(req.params.id) });
        res.status(204).end();
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

router.get('/:id/checklist', requireId, optionalAuth, async (req, res) => {
    try {
        const access = await taskAccess(pool, req.params.id, req.user?.id);
        if (!access) return res.status(404).json({ message: 'Task not found' });
        const result = await pool.query('SELECT * FROM task_checklist_items WHERE task_id = $1 ORDER BY position, id', [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

router.post('/:id/checklist', requireId, optionalAuth, async (req, res) => {
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    if (!content) return res.status(400).json({ message: 'Checklist content wajib diisi' });
    try {
        const access = await taskAccess(pool, req.params.id, req.user?.id, 'edit');
        if (!access) return res.status(404).json({ message: 'Task not found' });
        const result = await pool.query(
            `INSERT INTO task_checklist_items (task_id, content, position)
             VALUES ($1, $2, (SELECT COALESCE(MAX(position) + 1, 0) FROM task_checklist_items WHERE task_id = $1)) RETURNING *`,
            [req.params.id, content]
        );
        sseService.broadcast('task:updated', { taskId: Number(req.params.id) });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

router.put('/:id/checklist/:itemId', requireId, optionalAuth, async (req, res) => {
    if (!/^\d+$/.test(req.params.itemId)) return res.status(400).json({ message: 'ID tidak valid' });
    try {
        const access = await taskAccess(pool, req.params.id, req.user?.id, 'edit');
        if (!access) return res.status(404).json({ message: 'Task not found' });
        const updates = [];
        const values = [];
        if (typeof req.body.content === 'string' && req.body.content.trim()) { values.push(req.body.content.trim()); updates.push(`content = $${values.length}`); }
        if (typeof req.body.completed === 'boolean') { values.push(req.body.completed); updates.push(`completed = $${values.length}`); }
        if (!updates.length) return res.status(400).json({ message: 'Tidak ada perubahan' });
        values.push(req.params.id, req.params.itemId);
        const result = await pool.query(`UPDATE task_checklist_items SET ${updates.join(', ')} WHERE task_id = $${values.length - 1} AND id = $${values.length} RETURNING *`, values);
        if (!result.rows.length) return res.status(404).json({ message: 'Checklist tidak ditemukan' });
        sseService.broadcast('task:updated', { taskId: Number(req.params.id) });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

router.delete('/:id/checklist/:itemId', requireId, optionalAuth, async (req, res) => {
    try {
        const access = await taskAccess(pool, req.params.id, req.user?.id, 'edit');
        if (!access) return res.status(404).json({ message: 'Task not found' });
        const result = await pool.query('DELETE FROM task_checklist_items WHERE task_id = $1 AND id = $2 RETURNING id', [req.params.id, req.params.itemId]);
        if (!result.rows.length) return res.status(404).json({ message: 'Checklist tidak ditemukan' });
        sseService.broadcast('task:updated', { taskId: Number(req.params.id) });
        res.status(204).end();
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

router.get('/:id/activity', requireId, optionalAuth, async (req, res) => {
    try {
        const access = await taskAccess(pool, req.params.id, req.user?.id);
        if (!access) return res.status(404).json({ message: 'Task not found' });
        const result = await pool.query(
            `SELECT task_activity.*, users.username FROM task_activity LEFT JOIN users ON users.id = task_activity.user_id
             WHERE task_id = $1 ORDER BY task_activity.created_at DESC LIMIT 100`, [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

router.delete('/:id', requireId, optionalAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const task = await taskAccess(client, req.params.id, req.user?.id, 'edit');
        if (!task) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Task not found' });
        }

        const boardId = task.board_id;
        await client.query('SELECT id FROM boards WHERE id = $1 FOR UPDATE', [boardId]);
        await client.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
        const remaining = await client.query(
            'SELECT id FROM tasks WHERE board_id = $1 ORDER BY position ASC, id ASC',
            [boardId]
        );
        for (const item of reindex(remaining.rows)) {
            await client.query('UPDATE tasks SET position = $1 WHERE id = $2', [item.position, item.id]);
        }
        await logActivity(client, req.params.id, req.user?.id, 'deleted', 'Task dihapus');
        await client.query('COMMIT');

        sseService.broadcast('task:deleted', { id: Number(req.params.id) });
        res.json({ message: 'Task deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ message: 'Server Error' });
    } finally {
        client.release();
    }
});

module.exports = router;
