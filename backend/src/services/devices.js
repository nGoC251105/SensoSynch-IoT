'use strict';

const { iso } = require('../utils');

module.exports = function (context) {
    const { db, state } = context;


async function devices() {
    const [rows] = await db.query(
        'SELECT id,code,name,current_state,updated_at ' +
        'FROM devices ORDER BY id'
    );

    return rows.map((r) => {
        return {
            id: r.id,
            code: r.code,
            name: r.name,
            state: r.current_state,
            updatedAt: iso(r.updated_at)
        };
    });
}

    return { devices };
};
