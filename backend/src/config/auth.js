'use strict';

module.exports = function (env = process.env) {
    const secret = env.JWT_SECRET;
    const username = env.AUTH_USERNAME;
    const passwordHash = env.AUTH_PASSWORD_HASH;
    const expiresIn = Number(env.JWT_EXPIRES_IN_SECONDS || 3600);
    if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) {
        throw new Error('JWT_SECRET must contain at least 32 bytes in .env');
    }
    if (!username || !/^\$2[aby]\$(1[0-6])\$[./A-Za-z0-9]{53}$/.test(passwordHash || '')) {
        throw new Error('Configure AUTH_USERNAME and a bcrypt AUTH_PASSWORD_HASH (cost 10..16) in .env');
    }
    if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 86400) {
        throw new Error('JWT_EXPIRES_IN_SECONDS must be 1..86400');
    }
    return Object.freeze({ secret, username, passwordHash, expiresIn,
        issuer: 'sensosynch', audience: 'sensosynch-dashboard' });
};
