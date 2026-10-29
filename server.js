require('dotenv').config();
const app = require('./server/app');
const pool = require('./db');
const { closeAll } = require('./server/services/sseService');

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
    console.log(`Server Backend jalan di http://localhost:${PORT}`);
});

async function shutdown(signal) {
    console.log(`${signal} diterima, menutup server...`);
    closeAll();
    server.close(async () => {
        await pool.end();
        process.exit(0);
    });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
