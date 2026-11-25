'use strict';
// Real HTTP server/MySQL/MQTT configuration; no authenticated hardware commands.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('../node_modules/jsonwebtoken');
const newman = require('newman');
const WebSocket = require('../node_modules/ws');
const root = path.resolve(__dirname, '..');
const results = [];
const base = process.env.AUTH_TEST_BASE_URL || 'http://localhost:3000';
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));

(async () => {
    const env = require('../node_modules/dotenv').parse(fs.readFileSync(path.join(root, '.env')));
    const config = require('../src/config/auth')(env);
    const credentials = process.env.AUTH_TEST_PASSWORD
        ? { username: env.AUTH_USERNAME, password: process.env.AUTH_TEST_PASSWORD }
        : JSON.parse(fs.readFileSync(path.join(root, '.auth-login.local.json'), 'utf8'));
    const collection = read('IoT_Smart_Home_API.postman_collection.json');
    for (const folder of collection.item) folder.item = folder.item.filter(i => /^TC\d+ /.test(i.name) && !i.name.startsWith('TC10 '));
    const options = { algorithm: 'HS256', issuer: config.issuer, audience: config.audience, subject: config.username };
    const payload = { token_use: 'access' };
    const variables = { base_url: base, ...credentials,
        expired_token: jwt.sign({ ...payload, exp: Math.floor(Date.now() / 1000) - 60 }, config.secret, options),
        wrong_algorithm_token: jwt.sign(payload, config.secret, { ...options, algorithm: 'HS384', expiresIn: 3600 }),
        wrong_signature_token: jwt.sign(payload, crypto.randomBytes(64), { ...options, expiresIn: 3600 }),
        no_expiry_token: jwt.sign(payload, config.secret, options),
        wrong_issuer_token: jwt.sign(payload, config.secret, { ...options, issuer: 'wrong', expiresIn: 3600 }),
        wrong_audience_token: jwt.sign(payload, config.secret, { ...options, audience: 'wrong', expiresIn: 3600 })
    };
    const environment = read('IoT_Local.postman_environment.json');
    for (const v of environment.values) if (v.key in variables) v.value = variables[v.key];
    const summary = await new Promise((resolve, reject) => newman.run({ collection, environment,
        reporters: ['cli'], timeoutRequest: 6000 }, (e, s) => e ? reject(e) : resolve(s)));
    for (const execution of summary.run.executions) {
        results.push({ name: execution.item.name, status: execution.response && !execution.requestError &&
            !execution.assertions.some(a => a.error) ? 'PASS' : 'FAIL', http: execution.response?.code || null });
    }
    const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
    if (response.status !== 200) throw new Error('Live login failed');
    const { access_token: token } = await response.json();
    for (const endpoint of ['/api/sensors/latest', '/api/sensors/chart?limit=12', '/api/devices',
        '/api/esp32/status', '/api/sensor-data', '/api/action-history']) {
        for (const mode of ['missing', 'fake', 'valid']) {
            const r = await fetch(base + endpoint, { headers: mode === 'missing' ? {} : { Authorization: 'Bearer ' + (mode === 'valid' ? token : 'invalid.jwt.token') } });
            const expected = mode === 'valid' ? 200 : 401;
            results.push({ name: mode + ' JWT ' + endpoint, http: r.status, expected, status: r.status === expected ? 'PASS' : 'FAIL' });
        }
    }
    await new Promise((resolve, reject) => {
        const peer = new WebSocket(base.replace(/^http/, 'ws') + '/ws');
        const timer = setTimeout(() => { peer.terminate(); reject(new Error('Live WebSocket timeout')); }, 5000);
        peer.on('error', reject);
        peer.on('open', () => peer.send(JSON.stringify({ type: 'auth', access_token: token })));
        peer.on('message', raw => {
            if (JSON.parse(raw.toString()).type === 'auth:ready') {
                clearTimeout(timer);peer.close();results.push({ name: 'Live WebSocket JWT handshake', status: 'PASS' });resolve();
            }
        });
    });
})().catch(() => { results.push({ name: 'Live runner setup/transport', status: 'FAIL' }); }).finally(() => {
    const report = { checkedAt: new Date().toISOString(), scope: 'real production server, configured MySQL/MQTT; no authenticated LED control dispatched',
        counts: { total: results.length, pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length }, results };
    fs.writeFileSync(path.join(__dirname, 'reports/live-auth-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report.counts));
    if (report.counts.fail) process.exitCode = 1;
});
