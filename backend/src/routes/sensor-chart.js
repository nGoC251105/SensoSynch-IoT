'use strict';

const { iso, error, integer, safeRoute } = require('../utils');

module.exports = function (context) {
    const { app, db } = context;


app.get('/api/sensors/chart', safeRoute(async (req, res) => {
    const limit = integer(req.query.limit, 12, 100);

    if (!limit) {
        return error(res, 400, 'limit không hợp lệ');
    }

    const [rows] = await db.execute(`
        SELECT d.id, s.type, d.value, d.measured_at
        FROM sensor_data d
        JOIN sensors s ON s.id = d.sensor_id
        WHERE d.measured_at IN (
            SELECT measured_at
            FROM (
                SELECT DISTINCT measured_at
                FROM sensor_data
                ORDER BY measured_at DESC
                LIMIT ?
            ) recent
        )
        ORDER BY d.measured_at DESC, d.id DESC
    `, [limit]);

    // Mỗi lần ESP32 đo sẽ có các giá trị chung measured_at.
    res.json(rows.map((r) => {
        let unit = 'ADC';

        if (r.type === 'Temperature') {
            unit = '°C';
        } else if (r.type === 'Humidity') {
            unit = '%';
        }

        return {
            id: `SEN-${r.id}`,
            type: r.type,
            device: r.type === 'Light'
                ? 'Light Sensor'
                : 'DHT11 Sensor',
            value: `${r.value} ${unit}`,
            time: iso(r.measured_at)
        };
    }));
}));
};
