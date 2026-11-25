'use strict';

const { iso, error, integer, safeRoute } = require('../utils');

module.exports = function (context) {
    const { app, db } = context;


app.get('/api/sensors/chart', safeRoute(async (req, res) => {
    const limit = integer(req.query.limit, 12, 100);

    if (!limit) {
        return error(res, 400, 'limit không hợp lệ');
    }

    // Each series has its own latest 12 points, including independently timed demo samples.
    const batches = await Promise.all(['Temperature','Humidity','Light','Demo'].map(async type => {
        const [rows] = await db.execute(`
            SELECT d.id,s.type,s.device_name,s.unit,d.value,d.measured_at
            FROM sensor_data d JOIN sensors s ON s.id=d.sensor_id
            WHERE s.type=? ORDER BY d.measured_at DESC,d.id DESC LIMIT ?
        `,[type,limit]);
        return rows;
    }));
    const rows=batches.flat().sort((a,b)=>new Date(b.measured_at)-new Date(a.measured_at)||b.id-a.id);

    res.json(rows.map((r) => {
        return {
            id: `SEN-${r.id}`,
            type: r.type,
            device: r.device_name,
            value: `${r.value} ${r.unit}`,
            time: iso(r.measured_at)
        };
    }));
}));
};
