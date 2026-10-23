const priorities = new Set(['Low', 'Medium', 'High']);

function fail(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function requireId(req, res, next) {
    if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
        return next(fail('ID tidak valid'));
    }
    next();
}

function validateBoard(req, res, next) {
    const { title, position } = req.body;
    if (typeof title !== 'string' || !title.trim()) return next(fail('Judul board wajib diisi'));
    if (title.trim().length > 255) return next(fail('Judul board maksimal 255 karakter'));
    if (position !== undefined && (!Number.isInteger(position) || position < 0)) {
        return next(fail('Position board harus bilangan bulat tidak negatif'));
    }
    next();
}

function validateTask(req, res, next) {
    const { board_id, content, description, position, priority, due_date } = req.body;
    if (board_id !== undefined && (!Number.isInteger(board_id) || board_id < 1)) {
        return next(fail('board_id tidak valid'));
    }
    if (content !== undefined && (typeof content !== 'string' || !content.trim())) {
        return next(fail('Content task wajib diisi'));
    }
    if (description !== undefined && description !== null && typeof description !== 'string') {
        return next(fail('Description task harus berupa teks'));
    }
    if (position !== undefined && (!Number.isInteger(position) || position < 0)) {
        return next(fail('Position task harus bilangan bulat tidak negatif'));
    }
    if (priority !== undefined && !priorities.has(priority)) {
        return next(fail('Priority harus Low, Medium, atau High'));
    }
    if (due_date !== undefined && due_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
        return next(fail('due_date harus berformat YYYY-MM-DD'));
    }
    if (req.method === 'POST' && (board_id === undefined || typeof content !== 'string' || !content.trim())) {
        return next(fail('board_id dan content wajib diisi'));
    }
    next();
}

module.exports = { requireId, validateBoard, validateTask };
