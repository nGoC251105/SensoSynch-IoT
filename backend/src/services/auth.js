'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = function (config) {
    async function login(username, password) {
        if (typeof username !== 'string' || typeof password !== 'string' ||
            !password.length || Buffer.byteLength(password) > 72 || username.length > 128) return null;
        // Always compare a bcrypt hash, including for an unknown username.
        const matches = await bcrypt.compare(password, config.passwordHash);
        if (!matches || username !== config.username) return null;
        return {
            access_token: jwt.sign({ token_use: 'access' }, config.secret, {
                algorithm: 'HS256', subject: config.username, issuer: config.issuer,
                audience: config.audience, expiresIn: config.expiresIn
            }),
            token_type: 'Bearer', expires_in: config.expiresIn
        };
    }
    function verify(token) {
        const claims = jwt.verify(token, config.secret, {
            algorithms: ['HS256'], issuer: config.issuer, audience: config.audience
        });
        if (!claims || typeof claims !== 'object' || claims.sub !== config.username ||
            claims.token_use !== 'access' || !Number.isInteger(claims.exp) ||
            !Number.isInteger(claims.iat) || claims.iat > Math.floor(Date.now() / 1000) ||
            claims.exp <= claims.iat) throw new Error('Invalid access token');
        return claims;
    }
    return { login, verify };
};
