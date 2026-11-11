'use strict';

const mqtt = require('mqtt');

module.exports = mqtt.connect(
    process.env.MQTT_URL || 'mqtt://127.0.0.1:1884',
    {
        username: process.env.MQTT_USERNAME || undefined,
        password: process.env.MQTT_PASSWORD || undefined,
        clientId: `sensosynch-backend-${process.pid}`,
        reconnectPeriod: 2000,
        connectTimeout: 8000,
        clean: true
    }
);
