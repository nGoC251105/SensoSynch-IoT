'use strict';

const { timestamp } = require('./utils');

module.exports = function ({ db, server, PORT, state }) {
(async () => {
    try {
        await db.query('SELECT 1');

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
