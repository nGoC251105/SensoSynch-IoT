'use strict';

const { safeRoute } = require('../utils');

module.exports = function (context) {
    const { app, db, state } = context;
    const isEsp32Online = (...args) => context.isEsp32Online(...args);

app.get('/api/health', safeRoute(async (req, res) => {
    await db.query('SELECT 1');

    res.json({
        ok: true,
        mqttConnected: state.mqttReady,
        esp32Online: isEsp32Online()
    });
}));
};
