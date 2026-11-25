'use strict';

const { rateLimit } = require('express-rate-limit');
const { safeRoute } = require('../utils');

module.exports = function ({ app, auth }) {
    const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20,
        standardHeaders: 'draft-7', legacyHeaders: false,
        message: { error: 'Too many login attempts; try again later' } });
    app.post('/api/auth/login', limiter, safeRoute(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        const result = await auth.login(req.body?.username, req.body?.password);
        if (!result) return res.status(401).json({ error: 'Invalid username or password' });
        res.json(result);
    }));
};
