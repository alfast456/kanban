const test = require('node:test');
const assert = require('node:assert/strict');
const { requireId, validateBoard, validateTask } = require('../server/middleware/validation');

function run(middleware, req) {
    let error;
    middleware(req, {}, value => { error = value; });
    return error;
}

test('board validation accepts valid payload', () => {
    assert.equal(run(validateBoard, { body: { title: 'Backlog', position: 0 } }), undefined);
});

test('board validation rejects blank title', () => {
    assert.equal(run(validateBoard, { body: { title: '   ' } }).message, 'Judul board wajib diisi');
});

test('task validation rejects invalid priority', () => {
    assert.equal(
        run(validateTask, { method: 'POST', body: { board_id: 1, content: 'Task', priority: 'Urgent' } }).message,
        'Priority harus Low, Medium, atau High'
    );
});

test('task validation accepts valid create payload', () => {
    assert.equal(
        run(validateTask, { method: 'POST', body: { board_id: 1, content: 'Task', priority: 'High', due_date: '2026-10-23' } }),
        undefined
    );
});

test('ID validation rejects non-positive IDs', () => {
    assert.equal(run(requireId, { params: { id: '0' } }).message, 'ID tidak valid');
    assert.equal(run(requireId, { params: { id: 'abc' } }).message, 'ID tidak valid');
});
