'use strict';

const { iso, error, vnDayRange, parsePaging, safeRoute } = require('../utils');

module.exports = function (context) {
    const { app, db } = context;


app.get('/api/action-history', safeRoute(async (req, res) => {
    const { page, size, offset } = parsePaging(req);

    const where = [];
    const args = [];

    const action = req.query.action || 'all';
    const status = req.query.status || 'all';

    if (!['all', 'ON', 'OFF'].includes(action)) {
        return error(res, 400, 'Action không hợp lệ');
    }

    if (!['all', 'PENDING', 'SUCCESS', 'FAILED'].includes(status)) {
        return error(res, 400, 'Status không hợp lệ');
    }

    if (action !== 'all') {
        where.push('action=?');
        args.push(action);
    }

    if (status !== 'all') {
        where.push('status=?');
        args.push(status);
    }

    const day = vnDayRange(req.query.date);

    if (day) {
        where.push('requested_at>=? AND requested_at<?');
        args.push(...day);
    }

    const clause = where.length
        ? ' WHERE ' + where.join(' AND ')
        : '';

    const [[count]] = await db.execute(
        `SELECT COUNT(*) total
         FROM action_history${clause}`,
        args
    );

    const [rows] = await db.execute(
        `SELECT id,device,action,status,requested_at,reason
         FROM action_history${clause}
         ORDER BY requested_at DESC,id DESC
         LIMIT ? OFFSET ?`,
        [
            ...args,
            size,
            offset
        ]
    );

    const display = {
        led1: 'LED 1',
        led2: 'LED 2',
        all: 'ALL LIGHTS'
    };

    res.json({
        content: rows.map((r) => {
            return {
                id: '#' + r.id,
                device: display[r.device] || r.device,
                action: r.action,
                status: r.status,
                time: iso(r.requested_at),
                reason: r.reason
            };
        }),
        page,
        size,
        totalElements: count.total,
        totalPages: Math.ceil(count.total / size)
    });
}));
};
