# SensoSynch Full API — TC01 đến TC17

## Import và giữ bản Postman hiện tại

1. Sao lưu Collection đang dùng trong Postman bằng Export (không xuất Environment chứa bí mật).
2. Import `SensoSynch_Full_API.postman_collection.json`. Bản này có tên và Collection ID riêng: **IoT Smart Home API - SensoSynch Full TC01-TC17**. Chọn tạo Collection mới; không Replace bản cũ.
3. Import `SensoSynch_Local.postman_environment.json` vào Environment mới nếu bản đang dùng có giá trị cục bộ cần giữ. Đặt `base_url=http://localhost:3000`, `username` và `api_password` bằng giá trị riêng cục bộ. Không điền JWT_SECRET hoặc MQTT_PASSWORD.
4. TC02 tự lưu JWT vào `access_token`. Collection dùng Bearer `{{access_token}}`; request dữ liệu/thiết bị kế thừa auth. TC01/02/03 dùng No Auth; TC05 dùng token sai công khai để kiểm tra 401, TC06 dùng No Auth để kiểm tra 401.

Hai file Collection gốc `IoT_Smart_Home_API.postman_collection.json` và `SensoSynch_API.postman_collection.json` không bị thay đổi. Các assertion và Example TC01–TC06 được sao chép nguyên nội dung sang bản Full. Theo lựa chọn của người dùng, bản Full đổi ánh xạ số: TC04 = Valid JWT, TC05 = Invalid JWT, TC06 = Missing JWT. Tên được chuẩn hóa; Login dùng `api_password` thay cho biến `password`. Không thay nội dung test gốc hoặc xóa request/Example trong app.

Nếu muốn merge vào bản Postman tự tạo: chỉ copy TC07–TC17 từ bản Full sang bản hiện tại, đặt đúng folder và **không Replace Collection/không xóa TC01–TC06**. Giữ Collection Auth là Bearer `{{access_token}}`. Với Login đang có, dùng mật khẩu từ biến `{{api_password}}` và giữ script tự lưu token. Example riêng chỉ có trong app không thể khôi phục từ file dự án, vì vậy bản app luôn được giữ làm bản gốc.

## Danh mục và hợp đồng API

| TC | Method và URL | Expected | Body/query |
| --- | --- | --- | --- |
| TC01 | GET `/api/health` | 200 health | No Auth |
| TC02 | POST `/api/auth/login` | 200 JWT | `{username,password}` từ biến riêng |
| TC03 | POST `/api/auth/login` | 401 | Thông tin thử sai, không có mật khẩu thật |
| TC04 | GET `/api/devices` | 200 | Bearer hợp lệ |
| TC05 | GET `/api/devices` | 401 | Bearer sai |
| TC06 | GET `/api/devices` | 401 | Không token |
| TC07 | GET `/api/sensors/latest` | 200 object | temperature/humidity/light/demo/measuredAt; null nếu chưa có mẫu |
| TC08 | GET `/api/sensors/chart?limit=12` | 200 array | 12 mẫu mỗi loại; value có đơn vị |
| TC09 | GET `/api/esp32/status` | 200 object | online/lastSeen/timeoutMs/mqttConnected |
| TC10 | GET `/api/sensor-data?type=all&sort=desc&page=1&size=10` | 200 paging | type, sort, page, size, date tùy chọn |
| TC11 | GET `/api/action-history?action=all&status=all&page=1&size=10` | 200 paging | action, status, page, size, date tùy chọn |
| TC12 | POST `/api/devices/1/control` | 202 rồi terminal | GPIO25, `{"action":"ON"}` hoặc OFF |
| TC13 | POST `/api/devices/2/control` | 202 rồi terminal | GPIO26, cùng body |
| TC14 | POST `/api/devices/all/control` | 202 rồi đủ 4 ACK | GPIO25/26/27/32 |
| TC15 | GET `/api/actions/{{action_id}}` | 200 actual action | ID lấy từ response control, không tự bịa |
| TC16 | POST `/api/devices/3/control` | 202 rồi terminal | GPIO27 |
| TC17 | POST `/api/devices/4/control` | 202 rồi terminal | GPIO32 |

Request được sắp TC01→TC17. TC15 là GET an toàn nhưng nằm trong Hardware Control - Manual giữa TC14 và TC16 để giữ thứ tự và phụ thuộc action_id. Sáu folder còn lại đúng yêu cầu. TC02 luôn trước mọi request cần token.

API lịch sử cảm biến trả `{content,page,size,totalElements,totalPages}`; mỗi row `{id,type,device,value,time}`. Chart trả array cùng row, không có field temperature/humidity/light riêng trên mỗi điểm. Các loại là Temperature, Humidity, Light, Demo, đơn vị lần lượt °C, %, ADC, %. Demo là dữ liệu giả lập do backend hiện có lưu DB; test không tự tạo mẫu. Latest có thể là dữ liệu cũ dù ESP32 offline; TC09 mới là trạng thái kết nối.

Các lỗi hợp lệ hiện có: 401 thiếu/sai/hết hạn JWT; 400 query/action/id sai; 404 target/action không tồn tại; 409 khi có lệnh đang xử lý. Khi offline, lệnh hợp lệ trả **202 với status FAILED**, không phải 503. Online trả **202 PENDING** và chỉ SUCCESS sau ACK đúng commandId/action từ các LED cần xác nhận. POST body JSON lỗi/oversize hiện do error-handler cũ trả 500; bộ test này không sửa backend để ép 400/413.

## Runner an toàn và báo cáo

Trong `backend`, khởi động bằng `npm start` nếu chưa chạy. Tác vụ startup/Demo/nhận MQTT có sẵn vẫn hoạt động bình thường; test không trực tiếp thay đổi MySQL.

Trong `backend/postman`:

```powershell
node generate-full.cjs
node validate-full.cjs
node run-full.cjs
```

`run-full.cjs` chạy các request GET/Login thật và hard-filter mọi POST control, rồi kiểm tra guard với HTTP sink và chạy luồng điều khiển qua adapter MQTT/DB in-memory riêng. Không import cấu hình broker/MySQL thật trong scope mock. Nếu có file riêng `backend/.auth-login.local.json`, runner dùng tài khoản đó trong bộ nhớ; nếu mật khẩu đã đổi thì cập nhật file riêng hoặc đặt biến môi trường `POSTMAN_USERNAME`, `POSTMAN_API_PASSWORD` cho tiến trình chạy. Không gửi mật khẩu vào chat hay export vào JSON công khai.

Nếu không có thông tin đăng nhập đúng, TC02 FAIL/BLOCKED và các TC cần token BLOCKED. Báo cáo vẫn ghi kết quả thật; không đổi Auth hoặc dùng token tự ký để giả lập live PASS. Trường hợp backend không chạy, request thực tế lỗi kết nối sẽ FAIL; không tạo server cảm biến giả thay thế.

Kết quả ở `reports/test-results.json`, `reports/test-report.html`, `TEST_SUMMARY.md`. PASS mock tách khỏi live; các ca phần cứng thật luôn BLOCKED cho đến khi bạn chủ động thử. `reports/full-source-audit.json` đối chiếu SHA-256 backend và Collection cũ; `reports/full-validation.json` ghi schema/scripts hợp lệ. Không lưu Newman raw request/response vì chứa mật khẩu/token Login.

## Chủ động chạy LED bằng Send

1. ESP32 dùng firmware 4 LED hiện có; xác nhận TC09 online. Chạy TC02 để có token. Đặt `control_action=ON` hoặc `OFF`, `expected_control_status=SUCCESS`.
2. Mở **một** request TC12/13/14/16/17 trong folder Hardware Control - Manual. Scripts → Pre-request: đổi dòng `const hardwareRequestLocked = true;` thành `false` **chỉ cho request sắp bấm Send**. Đặt `manual_confirmation` đúng TC đó (ví dụ TC12).
3. Bấm **Send**, không chạy Collection Runner. Confirmation tự bị xóa trước khi gửi; script chờ tối đa khoảng 15 giây, poll GET action id và kiểm tra terminal status, Action History, devices. 202 đơn thuần không được coi là LED đã bật.
4. Sau thao tác, đặt lại `hardwareRequestLocked = true`. Không lưu/xuất bản mở khóa. Guard mặc định của file chia sẻ luôn khóa; runner đi kèm còn loại toàn bộ POST control dù bạn lỡ sửa guard.
5. TC14 chỉ đạt SUCCESS khi backend nhận đủ ACK LED1/2/3/4. Sau control thành công, TC15 dùng `action_id` tự lưu từ response; không nhập một ID giả. Nếu chạy safe Runner từ TC01, ID được xóa để tránh dùng nhầm lệnh cũ.
6. Muốn thử offline: chủ động tắt/ngắt ESP32, chờ ít nhất 8 giây và xác nhận TC09 offline. Đặt `expected_control_status=FAILED`, thực hiện một Send có chủ đích như trên, xác nhận reason trong Action History. Đổi lại SUCCESS cho lần thử online. Không coi FAILED offline là LED bật thành công.

Script polling dùng API đọc trạng thái backend; không thể độc lập quan sát điện áp GPIO. Việc thấy SUCCESS chỉ chứng minh backend đã xử lý ACK theo code hiện có, nên khi nộp bài phần hardware nên kèm ảnh/video LED và trạng thái Action History của lần Send thực tế.

Tham khảo chính thức: [Postman skipRequest](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-execution) giải thích guard bỏ qua request trước khi gửi.
