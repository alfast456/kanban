const express = require('express');
const pool = require('../../db');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', database: 'up', requestId: req.requestId });
    } catch (err) {
        console.error(JSON.stringify({ event: 'health_check_failed', requestId: req.requestId, message: err.message }));
        res.status(503).json({ status: 'degraded', database: 'down', requestId: req.requestId });
    }
});

module.exports = router;
