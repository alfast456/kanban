const express = require('express');
const router = express.Router();
const sse = require('../services/sseService');
const { optionalAuth } = require('../middleware/auth');

router.get('/events', optionalAuth, (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
    });
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    res.write(`retry: 3000\n\n`);
    sse.addClient(res, req.user?.id || null);

    req.on('close', () => sse.removeClient(res));
});

module.exports = router;
