'use strict';

module.exports = function (context) {
    const { client, state, broadcast } = context;
    const isEsp32Online = (...args) => context.isEsp32Online(...args);
    const applyOfflineState = (...args) => context.applyOfflineState(...args);
    const onStatus = (...args) => context.onStatus(...args);
    const onSensor = (...args) => context.onSensor(...args);

client.on('connect', () => {
    state.mqttReady = true;

    client.subscribe(
        ['sensor/data', 'device/status'],
        { qos: 1 },
        (e) => {
            if (e) {
                console.error('Subscribe lỗi:', e);
            } else {
                console.log('MQTT connected/subscribed');
            }
        }
    );
});

client.on('offline', () => {
    state.mqttReady = false;
    applyOfflineState().catch(console.error);
});

client.on('close', () => {
    state.mqttReady = false;
    applyOfflineState().catch(console.error);
});

client.on('error', (e) => {
    console.error('MQTT:', e.message);
});

client.on('message', (topic, raw) => {
    let value;

    try {
        value = JSON.parse(raw.toString());
    } catch {
        return;
    }

    const fn = topic === 'sensor/data'
        ? onSensor
        : topic === 'device/status'
            ? onStatus
            : null;

    if (fn) {
        fn(value).catch((e) => {
            console.error('MQTT processing:', e);
        });
    }
});

// Mỗi giây kiểm tra mốc nhận dữ liệu gần nhất.
// Nếu ESP32 mất nguồn, sau tối đa khoảng 8–9 giây
// hai đèn trên dashboard tự chuyển thành OFF.
setInterval(() => {
    if (!isEsp32Online()) {
        applyOfflineState().catch(console.error);
    }

    broadcast('esp32:status', {
        online: isEsp32Online(),
        lastSeen: state.lastSeen,
        timeoutMs: 8000
    });
}, 1000);
};
