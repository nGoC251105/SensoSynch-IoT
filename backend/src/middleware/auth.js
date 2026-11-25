'use strict';

module.exports = function (auth) {
    return (req, res, next) => {
        if ((req.method === 'GET' && /^\/health\/?$/.test(req.path)) ||
            (req.method === 'POST' && /^\/auth\/login\/?$/.test(req.path))) return next();
        const match = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') || '');
        try {
            if (!match) throw new Error('Missing token');
            req.auth = auth.verify(match[1]);
            next();
        } catch {
            res.set('WWW-Authenticate', 'Bearer');
            res.status(401).json({ error: 'Unauthorized' });
        }
    };
};
