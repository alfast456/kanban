const express = require('express');
const cors = require('cors');
const path = require('path');
const { notFound, errorHandler } = require('./middleware/errors');
const requestContext = require('./middleware/requestContext');

const app = express();

app.use(requestContext);

const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true;
app.use(cors({ origin: allowedOrigins }));
app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
    });
    next();
});
app.use(express.json({ limit: '100kb' }));

// API routes
app.use('/health', require('./routes/health'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/events'));
app.use('/api/boards', require('./routes/boards'));
app.use('/api/tasks', require('./routes/tasks'));

// Error handlers
app.use(notFound);
app.use(errorHandler);

// Static frontend build
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

module.exports = app;
