'use strict';

const { timestamp, validState } = require('../utils');

module.exports = function (context) {
    const { db, state, broadcast } = context;
    const devices = (...args) => context.devices(...args);
    const finishCommand = (...args) => context.finishCommand(...args);
    const isEsp32Online = (...args) => context.isEsp32Online(...args);

async function onStatus(value) {
    const allowedDevices = ['led1', 'led2', 'all'];

    if (
        !value ||
        !allowedDevices.includes(value.device) ||
        !validState(value.state)
    ) {
        return;
    }

    const commandId = Number(value.commandId || 0);
    const job = state.currentCommand;

    // commandId = 0 là bản tin BOOT/SYNC, không tạo lịch sử thao tác.
    if (commandId === 0) {
        if (value.device !== 'all' && !job && isEsp32Online()) {
            const deviceId = value.device === 'led1' ? 1 : 2;

            await db.execute(
                'UPDATE devices ' +
                'SET current_state=?, updated_at=? ' +
                'WHERE id=?',
                [
                    value.state,
                    timestamp(),
                    deviceId
                ]
            );

            broadcast('device:update', {
                devices: await devices()
            });
        }

        return;
    }

    if (!job || job.finished || commandId !== job.id) {
        return;
    }

    if (value.status === 'FAILED') {
        await finishCommand(
            'FAILED',
            'ESP32 từ chối lệnh'
        );

        return;
    }

    if (
        value.status !== 'SUCCESS' ||
        !job.expected.has(value.device) ||
        value.state !== job.action
    ) {
        return;
    }

    job.acks.add(value.device);

    // Lệnh ALL chỉ thành công khi cả LED1 và LED2 đều phản hồi.
    if (job.acks.size === job.expected.size) {
        try {
            const ids = job.device === 'all'
                ? [1, 2]
                : [job.device === 'led1' ? 1 : 2];

            const conn = await db.getConnection();

            try {
                await conn.beginTransaction();

                for (const id of ids) {
                    await conn.execute(
                        'UPDATE devices ' +
                        'SET current_state=?, updated_at=? ' +
                        'WHERE id=?',
                        [
                            job.action,
                            timestamp(),
                            id
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

            broadcast('device:update', {
                devices: await devices()
            });

            await finishCommand('SUCCESS');
        } catch (e) {
            console.error(e);

            await finishCommand(
                'FAILED',
                'Lỗi ghi database'
            );
        }
    }
}

    return { onStatus };
};
