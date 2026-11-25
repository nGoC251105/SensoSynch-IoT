'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

async function configure({ username, password, allowUpdate = false } = {}) {
    const envPath = path.resolve(__dirname, '../.env');
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const current = dotenv.parse(content);
    if (current.AUTH_PASSWORD_HASH && !allowUpdate) throw new Error('Account already configured; use AUTH_SETUP_PASSWORD and --update intentionally');
    if (typeof password !== 'string' || Buffer.byteLength(password) < 20 || Buffer.byteLength(password) > 72) {
        throw new Error('AUTH_SETUP_PASSWORD must be 20..72 bytes; plaintext is never saved');
    }
    username = username || current.AUTH_USERNAME || `sensosynch-${crypto.randomBytes(6).toString('hex')}`;
    if (!/^[\w.@-]{3,128}$/.test(username)) throw new Error('Use a username of 3..128 letters, digits, dot, @, underscore or dash');
    const settings = { JWT_SECRET: current.JWT_SECRET || crypto.randomBytes(64).toString('base64url'),
        AUTH_USERNAME: username, AUTH_PASSWORD_HASH: await bcrypt.hash(password, 12),
        JWT_EXPIRES_IN_SECONDS: current.JWT_EXPIRES_IN_SECONDS || '3600' };
    for (const [key,value] of Object.entries(settings)) {
        const line = key + '=' + value;
        const pattern = new RegExp('^' + key + '=.*$', 'm');
        content = pattern.test(content) ? content.replace(pattern, () => line) : content.trimEnd() + '\n' + line + '\n';
    }
    fs.writeFileSync(envPath, content);
    return { username, ...settings };
}

module.exports = configure;
if (require.main === module) configure({ username: process.env.AUTH_SETUP_USERNAME,
    password: process.env.AUTH_SETUP_PASSWORD, allowUpdate: process.argv.includes('--update') })
    .then(() => console.log('Stored bcrypt hash and JWT configuration in .env; no plaintext password was saved. Restart backend to apply.'))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
