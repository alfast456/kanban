const { verifyToken } = require('../services/authService');

function readCookie(req, name) {
    const header = req.get('Cookie') || '';
    const item = header.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
    return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}

function extractToken(req) {
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }
    const cookieToken = readCookie(req, 'kanban_token');
    if (cookieToken) return cookieToken;
    if (req.query && req.query.token) return req.query.token;
    return null;
}

function requireAuth(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ message: 'Autentikasi dibutuhkan' });
    }
    const payload = verifyToken(token);
    if (!payload || !payload.id) {
        return res.status(401).json({ message: 'Sesi tidak valid atau telah kedaluwarsa' });
    }
    req.user = payload;
    next();
}

function optionalAuth(req, res, next) {
    const token = extractToken(req);
    if (token) {
        const payload = verifyToken(token);
        if (payload && payload.id) req.user = payload;
    }
    next();
}

module.exports = { requireAuth, optionalAuth };
