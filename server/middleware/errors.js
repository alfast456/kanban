function notFound(req, res, next) {
    if (req.originalUrl.startsWith('/api') || req.path.startsWith('/api') || req.baseUrl === '/api') {
        return res.status(404).json({ message: 'Endpoint tidak ditemukan', requestId: req.requestId });
    }
    next();
}

function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;
    if (statusCode >= 500) {
        console.error(JSON.stringify({
            event: 'http_error',
            requestId: req.requestId,
            method: req.method,
            path: req.originalUrl.split('?')[0],
            status: statusCode,
            message: err.message,
            stack: err.stack,
        }));
    }
    res.status(statusCode).json({
        message: statusCode >= 500 ? 'Server Error' : err.message,
        requestId: req.requestId,
    });
}

module.exports = { notFound, errorHandler };
