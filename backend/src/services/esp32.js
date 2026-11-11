'use strict';

const { timestamp } = require('../utils');

module.exports = function (context) {
    const { db, state, broadcast } = context;
    const devices = (...args) => context.devices(...args);
    const finishCommand = (...args) => context.finishCommand(...args);

// ESP32 gửi dữ liệu mỗi 2 giây; sau 8 giây không có dữ liệu,
// hệ thống coi thiết bị offline. Không thể phân biệt chắc chắn
// rút nguồn với mất Wi-Fi chỉ dựa vào MQTT.
function isEsp32Online() {
    if (!state.mqttReady || !state.lastSeen) {
        return false;
    }

    const elapsed = Date.now() - Date.parse(state.lastSeen);

    return elapsed >= 0 && elapsed < 8000;
}

// Khi mất kết nối, hiển thị OFF theo chính sách an toàn.
// OFF lúc này là trạng thái giao diện GIẢ ĐỊNH,
// không phải xác nhận vật lý từ ESP32 đã mất nguồn.
async function applyOfflineState() {
    if (state.offlineApplied || state.offlineTask) {
        return state.offlineTask;
    }

    state.offlineTask = (async () => {
        if (isEsp32Online()) {
            return;
        }

        if (state.currentCommand && !state.currentCommand.finished) {
            await finishCommand(
                'FAILED',
                'ESP32 mất kết nối trong khi xử lý lệnh'
            );
        }

        // Dùng chung một thời điểm cho cả hai đèn.
        await db.execute(
            'UPDATE devices SET current_state=?, updated_at=?',
            ['OFF', timestamp()]
        );

        state.offlineApplied = true;

        broadcast('device:update', {
            devices: await devices()
        });

        broadcast('esp32:status', {
            online: false,
            lastSeen: state.lastSeen,
            timeoutMs: 8000
        });
    })();

    try {
        await state.offlineTask;
    } catch (e) {
        console.error('Không đồng bộ được trạng thái offline:', e);
    } finally {
        state.offlineTask = null;
    }
}

    return { isEsp32Online, applyOfflineState };
};
