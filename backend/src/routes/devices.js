'use strict';

const { safeRoute } = require('../utils');

module.exports = function (context) {
    const { app, state } = context;
    const devices = (...args) => context.devices(...args);
    const isEsp32Online = (...args) => context.isEsp32Online(...args);

app.get('/api/devices', safeRoute(async (req, res) => {
    res.json({
        data: await devices()
    });
}));

app.get('/api/esp32/status', (req, res) => {
    res.json({
        online: isEsp32Online(),
        lastSeen: state.lastSeen,
        timeoutMs: 8000,
        mqttConnected: state.mqttReady
    });
});
};
