const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './test/e2e',
    timeout: 30_000,
    use: {
        baseURL: 'http://127.0.0.1:5173',
        browserName: 'chromium',
        headless: true,
    },
    webServer: [
        {
            command: 'node server.js',
            url: 'http://127.0.0.1:3333/health',
            reuseExistingServer: true,
            timeout: 30_000,
        },
        {
            command: 'npm run dev:frontend -- --host 127.0.0.1',
            url: 'http://127.0.0.1:5173',
            reuseExistingServer: true,
            timeout: 30_000,
        },
    ],
});
