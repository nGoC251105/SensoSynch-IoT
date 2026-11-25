> JWT Login/Postman: xem [AUTH_SETUP.md](AUTH_SETUP.md) v? [b?o c?o ki?m th? hi?n t?i](postman/IMPLEMENTATION_TEST_REPORT.md).

# SensoSynch backend

Chạy backend như trước:

```sh
npm start
```

Cấu hình tiếp tục được đọc từ `.env` tại thư mục backend.

## Cấu trúc mã nguồn

- `server.js`: tạo Express/HTTP server, kết nối các module theo thứ tự và khởi động.
- `src/config/database.js`: cấu hình pool MySQL.
- `src/config/mqtt.js`: cấu hình kết nối MQTT.
- `src/state.js`: trạng thái dùng chung của MQTT, ESP32 và lệnh đang xử lý.
- `src/utils/index.js`: thời gian UTC, lọc ngày Việt Nam, kiểm tra đầu vào, phân trang và bọc route bất đồng bộ.
- `src/services/devices.js`: truy vấn trạng thái thiết bị.
- `src/services/commands.js`: gửi MQTT và hoàn tất lệnh điều khiển.
- `src/services/esp32.js`: kiểm tra ESP32 online và áp dụng trạng thái offline.
- `src/services/device-status.js`: xử lý BOOT/SYNC, ACK và cập nhật trạng thái LED.
- `src/services/sensors.js`: kiểm tra, lưu và phát dữ liệu cảm biến.
- `src/realtime/mqtt.js`: đăng ký các sự kiện MQTT và kiểm tra kết nối mỗi giây.
- `src/realtime/websocket.js`: tạo WebSocket `/ws` và phát sự kiện tới trình duyệt.
- `src/routes/`: các API riêng cho health, cảm biến, thiết bị, điều khiển và lịch sử; `frontend.js` phục vụ frontend.
- `src/middleware/error-handler.js`: xử lý lỗi HTTP.
- `src/startup.js`: kiểm tra database, đồng bộ trạng thái khi khởi động và mở cổng HTTP.

Các service nhận cùng một `context`. Trạng thái thay đổi được truy cập qua `context.state`, giúp các module cùng theo dõi một lệnh và cùng trạng thái kết nối. Các hàm gọi giữa service được tra cứu qua `context` để tránh phụ thuộc vòng giữa các file.

Các endpoint, câu SQL, cấu hình kết nối, MQTT topic, WebSocket event, thời gian chờ và thứ tự đăng ký route được giữ theo bản ban đầu. Đường dẫn frontend vẫn được tính từ thư mục chứa `server.js`.
