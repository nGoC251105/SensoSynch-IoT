'use strict';

const { iso, safeRoute } = require('../utils');

module.exports = function (context) {
    const { app, db } = context;


app.get('/api/sensors/latest', safeRoute(async (req, res) => {
    const [rows] = await db.query(`
        SELECT s.type, d.value, d.measured_at
        FROM sensors s
        JOIN sensor_data d ON d.id = (
            SELECT d2.id
            FROM sensor_data d2
            WHERE d2.sensor_id = s.id
            ORDER BY d2.measured_at DESC, d2.id DESC
            LIMIT 1
        )
    `);

    const result = {
        temperature: null,
        humidity: null,
        light: null,
        measuredAt: null
    };

    for (const r of rows) {
        result[r.type.toLowerCase()] = r.value;

        const t = iso(r.measured_at);

        if (!result.measuredAt || t > result.measuredAt) {
            result.measuredAt = t;
        }
    }

    res.json(result);
}));
};
