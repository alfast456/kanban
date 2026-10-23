const express = require('express');
const pool = require('../../db');
const { hashPassword, verifyPassword, createToken } = require('../services/authService');
const { requireAuth } = require('../middleware/auth');
const { createState, authorizationUrl, exchangeCode, fetchProfile } = require('../services/googleAuthService');

const oauthStates = new Map();
const stateTtlMs = 10 * 60 * 1000;

function setCookie(res, name, value, maxAge) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`);
}

function setAuthCookie(res, token) {
    setCookie(res, 'kanban_token', token, 604800);
}

function clearCookie(res, name) {
    setCookie(res, name, '', 0);
}

function readCookie(req, name) {
    const item = (req.get('Cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
    return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}

function frontendUrl(path = '') {
    return `${process.env.APP_URL || 'http://localhost:3333'}${path}`;
}

function redirectWithAuthResult(res, result) {
    const location = new URL(frontendUrl('/'));
    location.searchParams.set('auth', result);
    res.redirect(location.toString());
}

function rememberState(state) {
    oauthStates.set(state, Date.now() + stateTtlMs);
}

function consumeState(state) {
    const expiresAt = oauthStates.get(state);
    oauthStates.delete(state);
    for (const [key, expiry] of oauthStates) {
        if (expiry <= Date.now()) oauthStates.delete(key);
    }
    return Boolean(expiresAt && expiresAt > Date.now());
}

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
            return res.status(400).json({ message: 'Username harus 3-30 karakter alfanumerik atau underscore' });
        }
        if (!password || typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({ message: 'Password minimal 6 karakter' });
        }

        const normalizedUser = username.trim().toLowerCase();
        const existing = await pool.query('SELECT id FROM users WHERE LOWER(username) = $1', [normalizedUser]);
        if (existing.rows.length) {
            return res.status(409).json({ message: 'Username sudah digunakan' });
        }

        const { salt, hash } = hashPassword(password);
        const result = await pool.query(
            'INSERT INTO users (username, password_hash, salt) VALUES ($1, $2, $3) RETURNING id, username, created_at',
            [username.trim(), hash, salt]
        );
        const user = result.rows[0];
        const token = createToken({ id: user.id, username: user.username });
        setAuthCookie(res, token);
        res.status(201).json({ user, token });
    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username dan password wajib diisi' });
        }

        const normalizedUser = String(username).trim().toLowerCase();
        const result = await pool.query(
            'SELECT id, username, password_hash, salt FROM users WHERE LOWER(username) = $1',
            [normalizedUser]
        );
        if (!result.rows.length) {
            return res.status(401).json({ message: 'Username atau password salah' });
        }

        const user = result.rows[0];
        const isValid = verifyPassword(password, user.salt, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ message: 'Username atau password salah' });
        }

        const token = createToken({ id: user.id, username: user.username });
        setAuthCookie(res, token);
        res.json({
            user: { id: user.id, username: user.username },
            token,
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

router.get('/google', (req, res, next) => {
    try {
        const state = createState();
        rememberState(state);
        setCookie(res, 'google_oauth_state', state, 600);
        res.redirect(authorizationUrl(state));
    } catch (err) {
        if (err.message.startsWith('Missing Google OAuth config:')) {
            return res.status(503).json({ message: 'Login Google belum dikonfigurasi' });
        }
        next(err);
    }
});

router.get('/google/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const cookieState = readCookie(req, 'google_oauth_state');
    clearCookie(res, 'google_oauth_state');
    if (error || !code || !state || !consumeState(state) || (cookieState && cookieState !== state)) {
        return redirectWithAuthResult(res, 'error');
    }

    try {
        const accessToken = await exchangeCode(code);
        const profile = await fetchProfile(accessToken);
        const existing = await pool.query(
            'SELECT id, username, email FROM users WHERE google_subject = $1',
            [profile.sub]
        );

        let user = existing.rows[0];
        if (!user) {
            const usernameBase = String(profile.email).split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 24) || 'google_user';
            let username = usernameBase;
            let suffix = 1;
            while ((await pool.query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)', [username])).rows.length) {
                username = `${usernameBase}_${suffix++}`.slice(0, 30);
            }
            const result = await pool.query(
                'INSERT INTO users (username, email, google_subject) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
                [username, profile.email, profile.sub]
            );
            user = result.rows[0];
        }

        const token = createToken({ id: user.id, username: user.username });
        setAuthCookie(res, token);
        redirectWithAuthResult(res, 'success');
    } catch (err) {
        console.error('Google OAuth error:', err.message);
        res.redirect(frontendUrl('/?auth=error'));
    }
});

router.post('/logout', (req, res) => {
    clearAuthCookie(res);
    res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
    const result = await pool.query('SELECT id, username, email, created_at FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) return res.status(401).json({ message: 'Sesi tidak valid atau telah kedaluwarsa' });
    res.json({ user: result.rows[0] });
});

module.exports = router;
