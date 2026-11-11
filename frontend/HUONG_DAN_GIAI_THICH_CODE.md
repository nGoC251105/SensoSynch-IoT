> File giải thích này thuộc frontend demo trước khi kết nối. Xem `../README_BAT_DAU.md` để hiểu backend và hệ thống mới.

# HƯỚNG DẪN GIẢI THÍCH SOURCE CODE SENSOSYNCH

## 1. Trang Dashboard — `js/dashboard.js`

- `dashboard()`: tạo giao diện ba thẻ nhiệt độ, độ ẩm, ánh sáng, biểu đồ và ba công tắc.
- `toggle(label, key, iconName, all)`: tạo HTML công tắc LED 1 / LED 2 / ALL, đọc trạng thái `state.led1` và `state.led2`.
- `bindDashboard()`: lắng nghe sự kiện người dùng bấm nút. Với ALL, nếu cả hai đang bật thì tắt cả hai; trường hợp khác thì bật cả hai.
- `setLeds(next1, next2, source)`: kiểm tra có đang bận hay không → bật `state.busy` → `setTimeout(..., 900)` mô phỏng thời gian xử lý → cập nhật LED → ghi `state.logs` → `save()` → `render()`.
- `chart()`: lấy 12 bộ số đo gần nhất từ `state.sensorRows` để vẽ 3 đường SVG.
- `bindChart()`: khi rê chuột/focus lên từng thời điểm, hiện tooltip: giờ đo, nhiệt độ °C, độ ẩm %, ánh sáng ADC.

**Thầy hỏi: Vì sao có loading 900 ms?** Vì đây là giao diện mô phỏng, dùng `setTimeout` giả lập độ trễ gửi lệnh và phản hồi; chưa kết nối MQTT và chưa phải thiết bị xác nhận thực tế.

**Thầy hỏi: Dữ liệu cảm biến từ đâu?** Ở `js/state.js`, hàm `samples()` sinh số đo giả lập; `addReading()` thêm các dòng mới, còn `setInterval(addReading, 5000)` trong `js/app.js` chạy mỗi 5 giây. Dữ liệu không đến từ ESP32 ở phiên bản này.

## 2. Trang Data Sensor — `js/sensors.js`

- `sensors()`: vẽ bộ lọc và bảng dữ liệu.
- `filterSensorRows()`: lọc theo loại (Temperature/Humidity/Light), ngày và sắp xếp cũ-mới.
- `bindSensors()`: **chỉ khi nhấn Search**, mới lấy giá trị từ ba ô lọc vào `state` và gọi `render()`. Nhấn `Xóa lọc` thì đặt lại giá trị mặc định.

**Thầy hỏi: Tại sao chọn loại cảm biến chưa lọc ngay?** Vì giao diện dùng kiểu tìm kiếm có xác nhận: người dùng chọn hết điều kiện rồi mới bấm `Search`; `filterSensorRows()` đọc điều kiện đã được áp dụng trong `state`.

## 3. Trang Action History — `js/history.js`

- `history()`: hiển thị danh sách ID, thiết bị, ON/OFF, SUCCESS/FAILED và thời gian.
- `filterHistoryLogs()`: chỉ hiển thị log phù hợp với điều kiện Action, Status và ngày đang có trong `state`.
- `bindHistory()`: lấy lựa chọn người dùng chỉ sau khi nhấn `Search`; nút `Xóa lọc` trả điều kiện mặc định.
- `deviceBadge()`: lấy icon đèn hoặc ALL cho cột thiết bị.
- `exportCsv()`: xuất danh sách lịch sử ra tập tin CSV.

**Thầy hỏi: Khi bật đèn, log được tạo tại đâu?** Trong `setLeds()` ở `js/dashboard.js`: sau 900 ms, thêm bản ghi bằng `state.logs.unshift(...)`. Vì `unshift()` nên bản ghi mới nằm đầu danh sách.

## 4. Luồng chung

1. `index.html` nạp CSS và lần lượt các file JS.
2. `state.js` tạo `state`, đọc/ghi `localStorage`, tạo dữ liệu giả lập.
3. `app.js` gọi `render()` và gắn sự kiện menu.
4. `render()` gọi `dashboard()`, `sensors()`, `history()` hoặc `profile()` tùy menu, rồi gọi `bindDashboard()`, `bindSensors()` hoặc `bindHistory()`.
5. Khi muốn đổi giao diện sau thay đổi dữ liệu, gọi `render()`.

**Tại sao không tạo ba trang HTML riêng?** Đây là ứng dụng một trang đơn giản: chỉ có một `index.html` và thay vùng nội dung `<main id="main">` khi chọn menu; JavaScript đã chia theo chức năng để dễ sửa và dễ kiểm tra.

**Cần nói rõ khi báo cáo:** `SUCCESS` trong bản này là kết quả **mô phỏng**. Chưa có xác nhận thật từ ESP32/MQTT; dữ liệu được lưu cục bộ trong trình duyệt.
