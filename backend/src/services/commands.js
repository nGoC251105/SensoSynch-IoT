'use strict';

const { timestamp } = require('../utils');

module.exports = function (context) {
    const { db, client, state, broadcast } = context;


async function publish(topic, payload) {
    if (!state.mqttReady) {
        throw new Error('MQTT broker chưa kết nối');
    }

    await new Promise((resolve, reject) => {
        client.publish(
            topic,
            JSON.stringify(payload),
            {
                qos: 1,
                retain: false
            },
            (e) => {
                if (e) {
                    reject(e);
                } else {
                    resolve();
                }
            }
        );
    });
}

async function finishCommand(status, reason = null) {
    const job = state.currentCommand;

    if (!job || job.finished) {
        return;
    }

    job.finished = true;
    clearTimeout(job.timer);

    try {
        await db.execute(
            'UPDATE action_history ' +
            'SET status=?, completed_at=?, reason=? ' +
            'WHERE id=? AND status=?',
            [
                status,
                timestamp(),
                reason,
                job.id,
                'PENDING'
            ]
        );

        broadcast('action:update', {
            id: job.id,
            status,
            reason
        });
    } catch (e) {
        console.error('Lỗi cập nhật hành động', e);
    } finally {
        if (state.currentCommand === job) {
            state.currentCommand = null;
        }
    }
}

    return { publish, finishCommand };
};
