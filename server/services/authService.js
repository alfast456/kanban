const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'kanban-dev-secret-change-in-production';
// ponytail: lightweight HMAC token; upgrade to RS256 or Redis sessions if distributed microservices needed.

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { salt, hash };
}

function verifyPassword(password, salt, hash) {
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const testBuf = Buffer.from(testHash, 'hex');
    const hashBuf = Buffer.from(hash, 'hex');
    if (testBuf.length !== hashBuf.length) return false;
    return crypto.timingSafeEqual(testBuf, hashBuf);
}

function createToken(payload, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
    const body = { ...payload, exp: Date.now() + expiresInMs };
    const data = Buffer.from(JSON.stringify(body)).toString('base64url');
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    return `${data}.${sig}`;
}

function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

    try {
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

module.exports = {
    hashPassword,
    verifyPassword,
    createToken,
    verifyToken,
};
