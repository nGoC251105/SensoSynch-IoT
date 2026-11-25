'use strict';

const { timestamp } = require('./utils');

module.exports = function ({ db, server, PORT, state, startDemo }) {
(async () => {
    try {
        await db.query('SELECT 1');

        // Idempotent registration for existing installations; no schema change.
        await db.execute(
            "INSERT INTO devices (id,code,name) VALUES " +
            "(3,'LED3','LED 3'),(4,'LED4','LED 4') " +
            "ON DUPLICATE KEY UPDATE code=VALUES(code)"
        );

        // Vừa khởi động backend chưa có tín hiệu sống từ ESP32.
        // Đưa trạng thái hiển thị về OFF để tránh giữ ON cũ.
        await db.execute(
            'UPDATE devices SET current_state=?, updated_at=?',
            ['OFF', timestamp()]
        );
        state.offlineApplied = true;

        await db.execute(
            "UPDATE action_history " +
            "SET status='FAILED', completed_at=?, reason='Backend restarted' " +
            "WHERE status='PENDING'",
            [timestamp()]
        );

        await startDemo();

        server.listen(PORT, '0.0.0.0', () => {
            console.log(
                `SensoSynch: http://localhost:${PORT}`
            );
        });
    } catch (e) {
        console.error(
            'Không kết nối MySQL:',
            e.message
        );

        process.exit(1);
    }
})();
};
