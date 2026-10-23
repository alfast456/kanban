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
    // ponytail: event carries no board data; clients reload only data their API permission allows.
    for (const client of sseClients.keys()) client.write(message);
}

module.exports = {
    addClient,
    removeClient,
    broadcast,
};
