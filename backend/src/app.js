'use strict';

const express = require('express');

function createApp(auth) {
    const app = express();
    app.disable('x-powered-by');
    // Reject unauthenticated requests before parsing payloads or invoking DB/MQTT.
    app.use('/api', require('./middleware/auth')(auth));
    app.use(express.json({ limit: '16kb' }));
    require('./routes/auth')({ app, auth });
    return app;
}

function registerApi(context) {
    for (const name of ['devices', 'commands', 'esp32', 'device-status', 'sensors']) {
        Object.assign(context, require('./services/' + name)(context));
    }
    if (context.server) Object.assign(context, require('./services/demo')(context));
    for (const name of ['health', 'sensor-latest', 'sensor-chart', 'devices',
        'device-control', 'action-result', 'sensor-data', 'action-history']) {
        require('./routes/' + name)(context);
    }
}

module.exports = { createApp, registerApi };
