async function boardAccess(db, boardId, userId, mode = 'view') {
    const editor = mode === 'edit';
    if (!userId) {
        const res = await db.query('SELECT *, \'owner\' AS role FROM boards WHERE id = $1 AND user_id IS NULL', [boardId]);
        return res.rows[0] || null;
    }
    const result = await db.query(
        `SELECT boards.*,
                CASE WHEN boards.user_id = $2 THEN 'owner' ELSE board_members.role END AS role
         FROM boards LEFT JOIN board_members
           ON board_members.board_id = boards.id AND board_members.user_id = $2
         WHERE boards.id = $1 AND (
           boards.user_id = $2 OR board_members.user_id = $2
         )`,
        [boardId, userId]
    );
    const access = result.rows[0];
    if (!access || (editor && access.role !== 'owner' && access.role !== 'editor')) return null;
    return access;
}

async function taskAccess(db, taskId, userId, mode = 'view') {
    if (!userId) {
        const res = await db.query(
            `SELECT tasks.*, boards.user_id AS board_owner_id, 'owner' AS access_role
             FROM tasks JOIN boards ON boards.id = tasks.board_id
             WHERE tasks.id = $1 AND boards.user_id IS NULL`,
            [taskId]
        );
        return res.rows[0] || null;
    }
    const result = await db.query(
        `SELECT tasks.*, boards.user_id AS board_owner_id,
                CASE WHEN boards.user_id = $2 THEN 'owner' ELSE board_members.role END AS access_role
         FROM tasks JOIN boards ON boards.id = tasks.board_id
         LEFT JOIN board_members ON board_members.board_id = boards.id AND board_members.user_id = $2
         WHERE tasks.id = $1 AND (boards.user_id = $2 OR board_members.user_id = $2)`,
        [taskId, userId]
    );
    const task = result.rows[0];
    if (!task || (mode === 'edit' && !['owner', 'editor'].includes(task.access_role))) return null;
    return task;
}

module.exports = { boardAccess, taskAccess };
