'use strict';

const { timestamp, error, validState, safeRoute } = require('../utils');

module.exports = function (context) {
    const { app, db, state, broadcast, TIMEOUT } = context;
    const devices = (...args) => context.devices(...args);
    const publish = (...args) => context.publish(...args);
    const finishCommand = (...args) => context.finishCommand(...args);
    const isEsp32Online = (...args) => context.isEsp32Online(...args);
    const applyOfflineState = (...args) => context.applyOfflineState(...args);

app.post('/api/devices/:target/control', safeRoute(async (req, res) => {
    const target = req.params.target;

    if (!['1', '2', '3', '4', 'all'].includes(target)) {
        return error(res, 404, 'Thiết bị không tồn tại');
    }

    const action = req.body?.action;

    if (!validState(action)) {
        return error(res, 400, 'action phải là ON hoặc OFF');
    }

    if (state.currentCommand) {
        return error(res, 409, 'Hệ thống đang xử lý lệnh khác');
    }

    const device = target === 'all' ? 'all' : `led${target}`;

    // Ghi nhận mọi lệnh hợp lệ, kể cả khi ESP32 đã offline.
    // Trả về HTTP 202 với status FAILED để giao diện
    // hiển thị kết quả từ Action History thay vì lỗi 503.
    if (!isEsp32Online()) {
        const reason = !state.mqttReady
            ? 'MQTT Broker không kết nối; ESP32 offline'
            : 'ESP32 offline hoặc đã bị ngắt nguồn';

        const [result] = await db.execute(
            'INSERT INTO action_history ' +
            '(device, action, status, requested_at, completed_at, reason) ' +
            'VALUES (?, ?, ?, ?, ?, ?)',
            [
                device,
                action,
                'FAILED',
                timestamp(),
                timestamp(),
                reason
            ]
        );

        // Khi offline, công tắc phải hiển thị tắt.
        await applyOfflineState();

        broadcast('action:update', {
            id: result.insertId,
            status: 'FAILED',
            reason
        });

        return res.status(202).json({
            id: result.insertId,
            device,
            action,
            status: 'FAILED',
            reason
        });
    }

    // Khóa một lệnh trên một tiến trình Node.js.
    const job = {
        id: null,
        device,
        action,
        expected: new Set(
            device === 'all' ? ['led1', 'led2', 'led3', 'led4'] : [device]
        ),
        acks: new Set(),
        finished: false,
        timer: null
    };

    state.currentCommand = job;

    try {
        const [r] = await db.execute(
            'INSERT INTO action_history' +
            '(device,action,status,requested_at) ' +
            'VALUES(?,?,?,?)',
            [
                device,
                action,
                'PENDING',
                timestamp()
            ]
        );

        job.id = r.insertId;

        await publish(
            `device/control/${target}`,
            {
                action,
                commandId: job.id
            }
        );

        if (!job.finished) {
            job.timer = setTimeout(() => {
                finishCommand(
                    'FAILED',
                    'ESP32 không phản hồi trong thời gian chờ'
                );
            }, TIMEOUT);
        }

        return res.status(202).json({
            id: job.id,
            status: 'PENDING',
            device,
            action
        });
    } catch (e) {
        if (job.id) {
            await db.execute(
                'UPDATE action_history ' +
                'SET status=?, completed_at=?, reason=? ' +
                'WHERE id=?',
                [
                    'FAILED',
                    timestamp(),
                    e.message,
                    job.id
                ]
            ).catch(console.error);
        }

        if (state.currentCommand === job) {
            state.currentCommand = null;
        }

        if (job.id) {
            const reason = 'Không gửi được lệnh: ' + e.message;

            broadcast('action:update', {
                id: job.id,
                status: 'FAILED',
                reason
            });

            return res.status(202).json({
                id: job.id,
                device,
                action,
                status: 'FAILED',
                reason
            });
        }

        // Database lỗi nên chưa lưu được lịch sử.
        return error(res, 500, 'Không lưu được lệnh điều khiển');
    }
}));
};
