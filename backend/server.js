'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');

const app = express();
app.use(express.json({ limit: '16kb' }));
const server = http.createServer(app);
const broadcast = require('./src/realtime/websocket')(server);

const PORT = Number(
    process.env.PORT || 3000
);

const TIMEOUT = Number(
    process.env.COMMAND_TIMEOUT_MS || 10000
);

const db = require('./src/config/database');
const client = require('./src/config/mqtt');
const state = require('./src/state');
const context = { app, server, db, client, state, broadcast, PORT, TIMEOUT };

for (const name of ['devices', 'commands', 'esp32', 'device-status', 'sensors']) {
    Object.assign(context, require('./src/services/' + name)(context));
}

require('./src/realtime/mqtt')(context);

// Keep API registration in the same order as the original server.
for (const name of [
    'health', 'sensor-latest', 'sensor-chart', 'devices',
    'device-control', 'action-result', 'sensor-data', 'action-history'
]) {
    require('./src/routes/' + name)(context);
}

require('./src/routes/frontend')(app, __dirname);
require('./src/middleware/error-handler')(app);
require('./src/startup')(context);
