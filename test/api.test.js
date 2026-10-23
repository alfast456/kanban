const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server/app');
const pool = require('../db');
const { hashPassword, verifyPassword, createToken, verifyToken } = require('../server/services/authService');

let server;
let baseUrl;

test.before(async () => {
    await new Promise(resolve => {
        server = app.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
});

test.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
});

test('HTTP security and request ID headers are attached to responses', async () => {
    const requestId = 'test-request-id';
    const res = await fetch(`${baseUrl}/health`, { headers: { 'X-Request-ID': requestId } });
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(res.headers.get('x-request-id'), requestId);
    const body = await res.json();
    assert.equal(body.requestId, requestId);
});

test('auth service hashes passwords and verifies signed token expiry', async () => {
    const { salt, hash } = hashPassword('correct-password');
    assert.equal(verifyPassword('correct-password', salt, hash), true);
    assert.equal(verifyPassword('wrong-password', salt, hash), false);

    const token = createToken({ id: 42, username: 'tester' }, 60_000);
    assert.deepEqual(verifyToken(token).id, 42);
    assert.equal(verifyToken(`${token}x`), null);
    assert.equal(verifyToken(createToken({ id: 42 }, -1)), null);
});

test('auth endpoints validate requests without database mutation', async () => {
    const register = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'x', password: 'short' }),
    });
    assert.equal(register.status, 400);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: '', password: '' }),
    });
    assert.equal(login.status, 400);
});

test('Google login reports unavailable when OAuth credentials are missing', async () => {
    const oldClientId = process.env.GOOGLE_CLIENT_ID;
    const oldClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    try {
        const res = await fetch(`${baseUrl}/api/auth/google`);
        assert.equal(res.status, 503);
        assert.equal((await res.json()).message, 'Login Google belum dikonfigurasi');
    } finally {
        if (oldClientId !== undefined) process.env.GOOGLE_CLIENT_ID = oldClientId;
        if (oldClientSecret !== undefined) process.env.GOOGLE_CLIENT_SECRET = oldClientSecret;
    }
});

test('GET /api/auth/me rejects missing token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(res.status, 401);
    assert.equal((await res.json()).message, 'Autentikasi dibutuhkan');
});

test('authenticated user registration, login, profile, and board isolation flow', async () => {
    const suffix = Date.now().toString(36);
    const userA = { username: `user_a_${suffix}`, password: 'password123' };
    const userB = { username: `user_b_${suffix}`, password: 'password456' };

    // Register user A
    const regResA = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userA),
    });
    assert.equal(regResA.status, 201);
    const regDataA = await regResA.json();
    assert.equal(regDataA.user.username, userA.username);
    assert.ok(regDataA.token);

    // Duplicate registration returns 409
    const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userA),
    });
    assert.equal(dupRes.status, 409);

    // Register user B
    const regResB = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userB),
    });
    assert.equal(regResB.status, 201);
    const regDataB = await regResB.json();

    // Login user A
    const loginResA = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userA),
    });
    assert.equal(loginResA.status, 200);
    const loginDataA = await loginResA.json();
    assert.equal(loginDataA.user.username, userA.username);

    // Wrong password login returns 401
    const wrongLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userA.username, password: 'wrongpassword' }),
    });
    assert.equal(wrongLogin.status, 401);

    // Profile lookup with Bearer token
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${loginDataA.token}` },
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.user.username, userA.username);

    // Board isolation: User A creates board
    const boardRes = await fetch(`${baseUrl}/api/boards`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${loginDataA.token}`,
        },
        body: JSON.stringify({ title: `Board A ${suffix}` }),
    });
    assert.equal(boardRes.status, 201);
    const createdBoard = await boardRes.json();

    // User A sees created board
    const listA = await fetch(`${baseUrl}/api/boards`, {
        headers: { Authorization: `Bearer ${loginDataA.token}` },
    });
    const boardsA = await listA.json();
    assert.ok(boardsA.some(b => b.id === createdBoard.id));

    // User B does not see User A's board
    const listB = await fetch(`${baseUrl}/api/boards`, {
        headers: { Authorization: `Bearer ${regDataB.token}` },
    });
    const boardsB = await listB.json();
    assert.ok(!boardsB.some(b => b.id === createdBoard.id));

    // Anonymous does not see User A's board
    const listAnon = await fetch(`${baseUrl}/api/boards`);
    const boardsAnon = await listAnon.json();
    assert.ok(!boardsAnon.some(b => b.id === createdBoard.id));

    // Cleanup: delete user board & test users
    await fetch(`${baseUrl}/api/boards/${createdBoard.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${loginDataA.token}` },
    });
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [regDataA.user.id, regDataB.user.id]);
});

test('GET /health returns health status json', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.ok(res.status === 200 || res.status === 503);
    const body = await res.json();
    assert.ok(typeof body.status === 'string');
    assert.ok(typeof body.database === 'string');
});

test('GET /api/unknown returns 404 with standard json', async () => {
    const res = await fetch(`${baseUrl}/api/unknown-endpoint`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.message, 'Endpoint tidak ditemukan');
    assert.match(body.requestId, /^[0-9a-f-]{36}$/);
});

test('POST /api/boards rejects blank title with 400', async () => {
    const res = await fetch(`${baseUrl}/api/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '   ' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.message, 'Judul board wajib diisi');
});

test('POST /api/tasks rejects invalid priority with 400', async () => {
    const res = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board_id: 1, content: 'Test Task', priority: 'Critical' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.message, 'Priority harus Low, Medium, atau High');
});

test('PUT /api/tasks/:id rejects invalid non-numeric ID with 400', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/abc`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.message, 'ID tidak valid');
});

test('board collaboration and task details (checklist, activity)', async () => {
    const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const owner = { username: `own_${suffix}`, password: 'password123' };
    const member = { username: `mem_${suffix}`, password: 'password123' };

    const regOwner = await (await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(owner),
    })).json();

    const regMember = await (await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member),
    })).json();

    // Owner creates board
    const boardRes = await (await fetch(`${baseUrl}/api/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${regOwner.token}` },
        body: JSON.stringify({ title: `Collab Board ${suffix}` }),
    })).json();

    // Add member as editor
    const addMemberRes = await fetch(`${baseUrl}/api/boards/${boardRes.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${regOwner.token}` },
        body: JSON.stringify({ username: member.username, role: 'editor' }),
    });
    assert.equal(addMemberRes.status, 201);

    // Member can create task on owner's board
    const taskRes = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${regMember.token}` },
        body: JSON.stringify({ board_id: boardRes.id, content: 'Collab Task' }),
    });
    assert.equal(taskRes.status, 201);
    const task = await taskRes.json();

    // Member adds checklist item
    const checkRes = await fetch(`${baseUrl}/api/tasks/${task.id}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${regMember.token}` },
        body: JSON.stringify({ content: 'Subtask 1' }),
    });
    assert.equal(checkRes.status, 201);
    const checkItem = await checkRes.json();

    // Member completes checklist item
    const checkPut = await fetch(`${baseUrl}/api/tasks/${task.id}/checklist/${checkItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${regMember.token}` },
        body: JSON.stringify({ completed: true }),
    });
    assert.equal(checkPut.status, 200);

    // Activity log recorded
    const actRes = await fetch(`${baseUrl}/api/tasks/${task.id}/activity`, {
        headers: { Authorization: `Bearer ${regOwner.token}` },
    });
    assert.equal(actRes.status, 200);
    const acts = await actRes.json();
    assert.ok(acts.length >= 1);

    // Cleanup
    await pool.query('DELETE FROM boards WHERE id = $1', [boardRes.id]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [regOwner.user.id, regMember.user.id]);
});
