'use strict';

const fs = require('fs');
const path = require('path');
require('../node_modules/dotenv').config({ path: path.join(__dirname, '../.env') });

async function diagnose() {
    const result = { checkedAt: new Date().toISOString(), port: Number(process.env.PORT || 3000), commandTimeoutMs: Number(process.env.COMMAND_TIMEOUT_MS || 10000) };
    try {
        const response = await fetch(`http://localhost:${result.port}/api/health`, { signal: AbortSignal.timeout(4000) });
        result.backend = { reachable: true, status: response.status, health: await response.json() };
    } catch (error) {
        result.backend = { reachable: false, code: error.cause?.code || error.name };
    }
    let db;
    try {
        db = await require('../node_modules/mysql2/promise').createConnection({
            host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
            user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'sensosynch', connectTimeout: 4000
        });
        const [history] = await db.query('SELECT status,COUNT(*) total FROM action_history GROUP BY status');
        const [tables] = await db.query('SHOW TABLES');
        result.mysql = { connected: true, history, tableCount: tables.length };
        result.safeToStart = !history.some(row => row.status === 'PENDING' && row.total > 0);
    } catch (error) {
        result.mysql = { connected: false, code: error.code };
        result.safeToStart = false;
    } finally { if (db) await db.end(); }
    result.mqtt = await new Promise(resolve => {
        const client = require('../node_modules/mqtt').connect(process.env.MQTT_URL || 'mqtt://127.0.0.1:1884', {
            username: process.env.MQTT_USERNAME || undefined, password: process.env.MQTT_PASSWORD || undefined,
            clientId: `sensosynch-diagnostic-${process.pid}`, reconnectPeriod: 0, connectTimeout: 4000
        });
        let finished = false;
        const done = value => { if (finished) return; finished = true; clearTimeout(timer); client.end(true); resolve(value); };
        const timer = setTimeout(() => done({ connected: false, code: 'TIMEOUT' }), 5000);
        client.on('connect', () => done({ connected: true }));
        client.on('error', error => done({ connected: false, code: String(error.code || error.message).replace(/mqtt[s]?:\/\/\S+/g, '[redacted]') }));
    });
    fs.mkdirSync(path.join(__dirname, 'reports'), { recursive: true });
    const name = process.argv.includes('--after') ? 'postflight.json' : 'preflight.json';
    fs.writeFileSync(path.join(__dirname, 'reports', name), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
}
diagnose().catch(error => { console.error(error.name); process.exitCode = 1; });
