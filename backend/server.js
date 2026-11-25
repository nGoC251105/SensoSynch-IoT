'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const http = require('http');
const auth = require('./src/services/auth')(require('./src/config/auth')());
const { createApp, registerApi } = require('./src/app');

const app = createApp(auth);
const server = http.createServer(app);
const broadcast = require('./src/realtime/websocket')(server, auth);

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

registerApi(context);

require('./src/realtime/mqtt')(context);

require('./src/routes/frontend')(app, __dirname);
require('./src/middleware/error-handler')(app);
require('./src/startup')(context);
