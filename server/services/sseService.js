const sseClients = new Set();
const heartbeat = setInterval(() => {
    for (const client of sseClients) client.write(': heartbeat\n\n');
}, 25000);

heartbeat.unref();

function addClient(res) {
    sseClients.add(res);
}

function removeClient(res) {
    sseClients.delete(res);
}

function broadcast(type, payload = {}) {
    const message = `data: ${JSON.stringify({ type, ...payload })}\n\n`;
    for (const client of sseClients.keys()) client.write(message);
}

function closeAll() {
    clearInterval(heartbeat);
    for (const client of sseClients) {
        try {
            client.end();
        } catch {}
    }
    sseClients.clear();
}

module.exports = {
    addClient,
    removeClient,
    broadcast,
    closeAll,
};
