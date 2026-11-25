'use strict';

const { iso, error, vnDayRange, parsePaging, safeRoute } = require('../utils');

module.exports = function (context) {
    const { app, db } = context;


app.get('/api/sensor-data', safeRoute(async (req, res) => {
    const { page, size, offset } = parsePaging(req);

    const type = req.query.type || 'all';

    if (!['all', 'Temperature', 'Humidity', 'Light', 'Demo'].includes(type)) {
        return error(res, 400, 'Loại cảm biến không hợp lệ');
    }

    const sort = req.query.sort || 'desc';

    if (!['asc', 'desc'].includes(sort)) {
        return error(res, 400, 'Thứ tự không hợp lệ');
    }

    const where = [];
    const args = [];

    if (type !== 'all') {
        where.push('s.type=?');
        args.push(type);
    }

    const day = vnDayRange(req.query.date);

    if (day) {
        where.push('d.measured_at>=? AND d.measured_at<?');
        args.push(...day);
    }

    const clause = where.length
        ? ' WHERE ' + where.join(' AND ')
        : '';

    const [[count]] = await db.execute(
        `SELECT COUNT(*) total
         FROM sensor_data d
         JOIN sensors s ON s.id=d.sensor_id${clause}`,
        args
    );

    const [rows] = await db.execute(
        `SELECT d.id,s.type,s.device_name,s.unit,d.value,d.measured_at
         FROM sensor_data d
         JOIN sensors s ON s.id=d.sensor_id${clause}
         ORDER BY d.measured_at ${sort.toUpperCase()},
                  d.id ${sort.toUpperCase()}
         LIMIT ? OFFSET ?`,
        [
            ...args,
            size,
            offset
        ]
    );

    res.json({
        content: rows.map((r) => {
            return {
                id: `SEN-${r.id}`,
                type: r.type,
                device: r.device_name,
                value: `${r.value} ${r.unit}`,
                time: iso(r.measured_at)
            };
        }),
        page,
        size,
        totalElements: count.total,
        totalPages: Math.ceil(count.total / size)
    });
}));
};
