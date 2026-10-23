const crypto = require('crypto');

function requestContext(req, res, next) {
    const requestId = req.get('X-Request-ID') || crypto.randomUUID();
    req.requestId = requestId;
    res.set('X-Request-ID', requestId);
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        console.info(JSON.stringify({
            event: 'http_request',
            requestId,
            method: req.method,
            path: req.originalUrl.split('?')[0],
            status: res.statusCode,
            durationMs: Math.round(durationMs * 100) / 100,
        }));
    });

    next();
}

module.exports = requestContext;
