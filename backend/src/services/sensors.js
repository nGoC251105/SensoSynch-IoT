'use strict';

const { iso, timestamp } = require('../utils');

module.exports = function (context) {
    const { db, state, broadcast } = context;


async function onSensor(data) {
    if (
        !data ||
        typeof data !== 'object' ||
        Array.isArray(data)
    ) {
        return;
    }

    const limits = [
        ['temperature', 'Temperature', -40, 80],
        ['humidity', 'Humidity', 0, 100],
        ['light', 'Light', 0, 4095]
    ];

    const values = limits.filter(([key, , min, max]) => {
        return (
            typeof data[key] === 'number' &&
            Number.isFinite(data[key]) &&
            data[key] >= min &&
            data[key] <= max
        );
    });

    if (!values.length) {
        return;
    }

    const time = timestamp();
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        const [meta] = await conn.query(
            'SELECT id,type FROM sensors'
        );

        const ids = Object.fromEntries(
            meta.map((x) => [x.type, x.id])
        );

        for (const [key, type] of values) {
            await conn.execute(
                'INSERT INTO sensor_data' +
                '(sensor_id,value,measured_at) VALUES(?,?,?)',
                [
                    ids[type],
                    data[key],
                    time
                ]
            );
        }

        await conn.commit();
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }

    state.lastSeen = new Date().toISOString();
    state.offlineApplied = false;

    state.lastSensor = {
        ...data,
        measuredAt: iso(time)
    };

    broadcast('sensor:update', state.lastSensor);

    broadcast('esp32:status', {
        online: true,
        lastSeen: state.lastSeen,
        timeoutMs: 8000
    });
}

    return { onSensor };
};
