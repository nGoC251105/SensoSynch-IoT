'use strict';

const { error, integer, safeRoute } = require('../utils');

module.exports = function (context) {
    const { app, db } = context;


app.get('/api/actions/:id', safeRoute(async (req, res) => {
    const id = integer(req.params.id, null);

    if (!id) {
        return error(res, 400, 'ID không hợp lệ');
    }

    const [rows] = await db.execute(
        'SELECT id,device,action,status,requested_at,completed_at,reason ' +
        'FROM action_history WHERE id=?',
        [id]
    );

    if (!rows.length) {
        return error(res, 404, 'Không tìm thấy hành động');
    }

    res.json({
        id: rows[0].id,
        device: rows[0].device,
        action: rows[0].action,
        status: rows[0].status,
        reason: rows[0].reason
    });
}));
};
