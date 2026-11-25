# SensoSynch V12 — Báo cáo kiểm thử API

Thời điểm: 14:28:12 11/11/2026 (UTC+7). Base URL: http://localhost:3000. Công cụ: Newman 6.2.3.

9 API JSON; 10 HTTP route được khai báo (gồm GET /). 61 ca Collection + 6 kịch bản bất đồng bộ = 67 ca: **PASS 55, FAIL 4, BLOCKED 8**. Assertions thực chạy: 251, lỗi 4. PASS/FAIL/BLOCKED đếm theo ca, không theo assertion.

Health trước chạy: {"status":200,"body":{"ok":true,"mqttConnected":true,"esp32Online":true}}. ESP32 trước chạy: {"status":200,"body":{"online":true,"lastSeen":"2026-11-11T07:27:59.728Z","timeoutMs":8000,"mqttConnected":true}}.

Không gửi lệnh điều khiển LED hợp lệ trong chế độ mặc định; không xóa/reset lịch sử. Fingerprint backend trước/sau chạy khớp: true. Backend được khởi động bằng npm start sau khi xác nhận không có bản ghi PENDING; startup vốn có cập nhật devices về OFF và đánh dấu PENDING là FAILED. Không sửa cơ chế này.

## Kết quả từng ca

| Method | Endpoint | Test case | Expected result | Actual result | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| GET | /api/health | SYS01 Health / MySQL connectivity | HTTP 200 | HTTP 200; 0 assertion failure(s) | PASS |
| GET | /api/esp32/status | SYS02 ESP32 and MQTT status | HTTP 200 | HTTP 200; 0 assertion failure(s) | PASS |
| GET | / | SYS03 Frontend entry point (not a JSON API) | HTTP 200 | HTTP 200; 0 assertion failure(s) | PASS |
| GET | /api/sensors/latest | SEN01 Latest sensor values | HTTP 200 | HTTP 200; 0 assertion failure(s) | PASS |
| GET | /api/sensors/chart | SEN02 Chart default 12 measurement times | HTTP 200 | HTTP 200; 0 assertion failure(s) | PASS |
| GET | /api/sensors/chart?limit=1 | SEN_LIMIT_1 Chart limit=1 | HTTP 200 | HTTP 200; 0 assertion failure(s) | PASS |
| GET | /api/sensors/chart?limit=100 | SEN_LIMIT_100 Chart limit=100 | HTTP 200 | HTTP 200; 0 assertion failure(s) | PASS |
| GET | /api/sensors/chart?limit=0 | SEN_BAD_0 Reject chart limit=0 | HTTP 400 | HTTP 400; 0 assertion failure(s); limit không hợp lệ | PASS |
| GET | /api/sensors/chart?limit=101 | SEN_BAD_101 Reject chart limit=101 | HTTP 400 | HTTP 400; 0 assertion failure(s); limit không hợp lệ | PASS |
| GET | /api/sensors/chart?limit=-1 | SEN_BAD_-1 Reject chart limit=-1 | HTTP 400 | HTTP 400; 0 assertion failure(s); limit không hợp lệ | PASS |
| GET | /api/sensors/chart?limit=1.5 | SEN_BAD_1.5 Reject chart limit=1.5 | HTTP 400 | HTTP 400; 0 assertion failure(s); limit không hợp lệ | PASS |
| GET | /api/sensors/chart?limit=abc | SEN_BAD_abc Reject chart limit=abc | HTTP 400 | HTTP 400; 0 assertion failure(s); limit không hợp lệ | PASS |
| GET | /api/devices | DEV01 List devices | HTTP 200 | HTTP 200; 0 assertion failure(s) | PASS |
| POST | /api/devices/3/control | CTL01 Reject unknown device without publishing | HTTP 404 | HTTP 404; 0 assertion failure(s); Thiết bị không tồn tại | PASS |
| POST | /api/devices/1/control | CTL02 Reject unsupported action | HTTP 400 | HTTP 400; 0 assertion failure(s); action phải là ON hoặc OFF | PASS |
| POST | /api/devices/2/control | CTL03 Reject missing action | HTTP 400 | HTTP 400; 0 assertion failure(s); action phải là ON hoặc OFF | PASS |
| POST | /api/devices/all/control | CTL04 Reject lowercase action | HTTP 400 | HTTP 400; 0 assertion failure(s); action phải là ON hoặc OFF | PASS |
| POST | /api/devices/1/control | CTL05 Reject null action | HTTP 400 | HTTP 400; 0 assertion failure(s); action phải là ON hoặc OFF | PASS |
| POST | /api/devices/1/control | CTL06 Malformed JSON should be HTTP 400 | HTTP 400 | HTTP 500; 1 assertion failure(s); Lỗi máy chủ; express.json throws status=400, but middleware only reads err.code; current code returns 500.; HTTP 400: expected response to have status code 400 but got 500 | FAIL |
| POST | /api/devices/1/control | CTL07 JSON over 16kb should be HTTP 413 | HTTP 413 | HTTP 500; 1 assertion failure(s); Lỗi máy chủ; Body limit is 16kb; current error middleware converts status=413 to 500.; HTTP 413: expected response to have status code 413 but got 500 | FAIL |
| POST | /api/devices/{{control_target}}/control | CTL08 OPT-IN: dispatch exactly one LED command | HTTP 202 | Hardware opt-in disabled; no valid LED command sent. | BLOCKED |
| GET | /api/actions/{{command_id}} | CTL09 OPT-IN: poll result of that command, never resend | HTTP 200 | Hardware opt-in disabled; no valid LED command sent. | BLOCKED |
| GET | /api/action-history | ACT01 Action history defaults; capture existing ID | HTTP 200 | HTTP 200; 0 assertion failure(s); 10 rows, total=34 | PASS |
| GET | /api/actions/{{existing_action_id}} | ACT02 Get existing action result | HTTP 200 | HTTP 200; 0 assertion failure(s); command status=FAILED | PASS |
| GET | /api/actions/{{missing_action_id}} | ACT03 Unknown valid action ID | HTTP 404 | HTTP 404; 0 assertion failure(s); Không tìm thấy hành động | PASS |
| GET | /api/actions/0 | ACT_ID_0 Reject action ID 0 | HTTP 400 | HTTP 400; 0 assertion failure(s); ID không hợp lệ | PASS |
| GET | /api/actions/-1 | ACT_ID_-1 Reject action ID -1 | HTTP 400 | HTTP 400; 0 assertion failure(s); ID không hợp lệ | PASS |
| GET | /api/actions/abc | ACT_ID_abc Reject action ID abc | HTTP 400 | HTTP 400; 0 assertion failure(s); ID không hợp lệ | PASS |
| GET | /api/actions/1.5 | ACT_ID_1.5 Reject action ID 1.5 | HTTP 400 | HTTP 400; 0 assertion failure(s); ID không hợp lệ | PASS |
| GET | /api/actions/1000001 | ACT_ID_1000001 Reject action ID 1000001 | HTTP 400 | HTTP 400; 0 assertion failure(s); ID không hợp lệ | PASS |
| GET | /api/action-history?status=PENDING&page=1&size=5 | ACT_STATUS_PENDING Filter status PENDING | HTTP 200 | HTTP 200; 0 assertion failure(s); 0 rows, total=0 | PASS |
| GET | /api/action-history?status=SUCCESS&page=1&size=5 | ACT_STATUS_SUCCESS Filter status SUCCESS | HTTP 200 | HTTP 200; 0 assertion failure(s); 5 rows, total=30 | PASS |
| GET | /api/action-history?status=FAILED&page=1&size=5 | ACT_STATUS_FAILED Filter status FAILED | HTTP 200 | HTTP 200; 0 assertion failure(s); 4 rows, total=4 | PASS |
| GET | /api/action-history?action=ON&size=5 | ACT_ACTION_ON Filter action ON | HTTP 200 | HTTP 200; 0 assertion failure(s); 5 rows, total=19 | PASS |
| GET | /api/action-history?action=OFF&size=5 | ACT_ACTION_OFF Filter action OFF | HTTP 200 | HTTP 200; 0 assertion failure(s); 5 rows, total=15 | PASS |
| GET | /api/action-history?date={{filter_date}}&page=2&size=5 | ACT_DATE Filter action history by Vietnam day | HTTP 200 | HTTP 200; 0 assertion failure(s); 5 rows, total=34 | PASS |
| GET | /api/action-history?action=TOGGLE | ACT_BAD_action_TOGGLE Reject action=TOGGLE | HTTP 400 | HTTP 400; 0 assertion failure(s); Action không hợp lệ | PASS |
| GET | /api/action-history?status=unknown | ACT_BAD_status_unknown Reject status=unknown | HTTP 400 | HTTP 400; 0 assertion failure(s); Status không hợp lệ | PASS |
| GET | /api/action-history?page=0 | ACT_BAD_page_0 Reject page=0 | HTTP 400 | HTTP 400; 0 assertion failure(s); page/size không hợp lệ | PASS |
| GET | /api/action-history?size=101 | ACT_BAD_size_101 Reject size=101 | HTTP 400 | HTTP 400; 0 assertion failure(s); page/size không hợp lệ | PASS |
| GET | /api/action-history?date=11-11-2026 | ACT_BAD_date_11-11-2026 Reject date=11-11-2026 | HTTP 400 | HTTP 400; 0 assertion failure(s); Ngày không hợp lệ | PASS |
| GET | /api/action-history?date=2026-02-30 | ACT_BAD_date_2026-02-30 Reject date=2026-02-30 | HTTP 400 | HTTP 400; 0 assertion failure(s); Ngày không hợp lệ | PASS |
| GET | /api/action-history?date=2026-13-01 | ACT_DATE_INVALID Invalid month should be HTTP 400 | HTTP 400 | HTTP 500; 1 assertion failure(s); Lỗi máy chủ; vnDayRange calls toISOString before checking validDate, resulting in HTTP 500.; HTTP 400: expected response to have status code 400 but got 500 | FAIL |
| GET | /api/sensor-data | HIS01 Sensor history defaults | HTTP 200 | HTTP 200; 0 assertion failure(s); 10 rows, total=1602 | PASS |
| GET | /api/sensor-data?type=Temperature&sort=asc&page=1&size=5 | HIS_Temperature_asc Temperature, sort=asc | HTTP 200 | HTTP 200; 0 assertion failure(s); 5 rows, total=534 | PASS |
| GET | /api/sensor-data?type=Temperature&sort=desc&page=1&size=5 | HIS_Temperature_desc Temperature, sort=desc | HTTP 200 | HTTP 200; 0 assertion failure(s); 5 rows, total=534 | PASS |
| GET | /api/sensor-data?type=Humidity&sort=asc&page=1&size=5 | HIS_Humidity_asc Humidity, sort=asc | HTTP 200 | HTTP 200; 0 assertion failure(s); 5 rows, total=534 | PASS |
| GET | /api/sensor-data?type=Humidity&sort=desc&page=1&size=5 | HIS_Humidity_desc Humidity, sort=desc | HTTP 200 | HTTP 200; 0 assertion failure(s); 5 rows, total=534 | PASS |
| GET | /api/sensor-data?type=Light&sort=asc&page=1&size=5 | HIS_Light_asc Light, sort=asc | HTTP 200 | HTTP 200; 0 assertion failure(s); 5 rows, total=534 | PASS |
| GET | /api/sensor-data?type=Light&sort=desc&page=1&size=5 | HIS_Light_desc Light, sort=desc | HTTP 200 | HTTP 200; 0 assertion failure(s); 5 rows, total=534 | PASS |
| GET | /api/sensor-data?date={{filter_date}}&size=5&page=2 | HIS_DATE Filter sensor history by Vietnam day | HTTP 200 | HTTP 200; 0 assertion failure(s); 5 rows, total=1602 | PASS |
| GET | /api/sensor-data?type=temperature | HIS_BAD_type_temperature Reject type=temperature | HTTP 400 | HTTP 400; 0 assertion failure(s); Loại cảm biến không hợp lệ | PASS |
| GET | /api/sensor-data?sort=invalid | HIS_BAD_sort_invalid Reject sort=invalid | HTTP 400 | HTTP 400; 0 assertion failure(s); Thứ tự không hợp lệ | PASS |
| GET | /api/sensor-data?page=0 | HIS_BAD_page_0 Reject page=0 | HTTP 400 | HTTP 400; 0 assertion failure(s); page/size không hợp lệ | PASS |
| GET | /api/sensor-data?page=1.5 | HIS_BAD_page_1.5 Reject page=1.5 | HTTP 400 | HTTP 400; 0 assertion failure(s); page/size không hợp lệ | PASS |
| GET | /api/sensor-data?page=1000001 | HIS_BAD_page_1000001 Reject page=1000001 | HTTP 400 | HTTP 400; 0 assertion failure(s); page/size không hợp lệ | PASS |
| GET | /api/sensor-data?size=0 | HIS_BAD_size_0 Reject size=0 | HTTP 400 | HTTP 400; 0 assertion failure(s); page/size không hợp lệ | PASS |
| GET | /api/sensor-data?size=101 | HIS_BAD_size_101 Reject size=101 | HTTP 400 | HTTP 400; 0 assertion failure(s); page/size không hợp lệ | PASS |
| GET | /api/sensor-data?date=11-11-2026 | HIS_BAD_date_11-11-2026 Reject date=11-11-2026 | HTTP 400 | HTTP 400; 0 assertion failure(s); Ngày không hợp lệ | PASS |
| GET | /api/sensor-data?date=2026-02-30 | HIS_BAD_date_2026-02-30 Reject date=2026-02-30 | HTTP 400 | HTTP 400; 0 assertion failure(s); Ngày không hợp lệ | PASS |
| GET | /api/sensor-data?date=2026-13-01 | HIS_DATE_INVALID Invalid month should be HTTP 400 | HTTP 400 | HTTP 500; 1 assertion failure(s); Lỗi máy chủ; vnDayRange calls toISOString before checking validDate, resulting in HTTP 500.; HTTP 400: expected response to have status code 400 but got 500 | FAIL |
| POST | /api/devices/:target/control | ASYNC_PENDING 202 admission with PENDING | HTTP 202 | Requires an explicitly authorized live command. | BLOCKED |
| GET | /api/actions/:id | ASYNC_SUCCESS ACK -> SUCCESS | HTTP 200 | Requires actual matching ESP32 ACK(s); ALL requires LED1 and LED2. | BLOCKED |
| POST | /api/devices/:target/control | ASYNC_OFFLINE Offline command -> 202 FAILED | HTTP 202 | Would insert action history; not triggered automatically. | BLOCKED |
| GET | /api/actions/:id | ASYNC_TIMEOUT No ACK -> FAILED after command timeout | HTTP 200 | Requires a command and deliberately missing ACK; no fault injection performed. | BLOCKED |
| POST | /api/devices/:target/control | ASYNC_BUSY Concurrent command -> 409 | HTTP 409 | No second valid command is sent: a race could actuate hardware. | BLOCKED |
| GET | /api/actions/:id | ASYNC_REJECT ESP32 rejection -> FAILED | HTTP 200 | No fake MQTT status or device rejection injected. | BLOCKED |

## Cách hiểu kết quả

- Health HTTP 200 chỉ xác nhận truy vấn MySQL thành công; MQTT/ESP32 phải đọc các cờ riêng. ESP32 offline không tự làm health trả lỗi.
- Lịch sử rỗng vẫn có thể PASS hợp đồng JSON/phân trang; không chứng minh đã có dữ liệu cảm biến hoặc ACK mới. GET existing action kiểm tra dữ liệu đã tồn tại, không chứng minh lệnh do bộ test tạo ra.
- HTTP 202/PENDING chỉ là tiếp nhận. SUCCESS cần ACK hợp lệ; FAILED là kết quả thất bại, kể cả HTTP vẫn là 202 hoặc 200. Các kịch bản chưa quan sát được ghi BLOCKED.
- Các lỗi malformed JSON, body quá 16kb và tháng không hợp lệ có expected theo ngữ nghĩa HTTP 400/413; code hiện trả 500 nên được báo FAIL, không thay backend để làm đẹp báo cáo.
- Không thử ngắt MySQL/MQTT/ESP32, không phát MQTT giả và không tạo hai lệnh hợp lệ để ép 409.

## Bằng chứng và giới hạn

- [Newman JSON](reports/newman-report.json): báo cáo gốc, request/response và assertions.
- [Báo cáo HTML](reports/test-report.html): bảng kết quả dễ trình chiếu.
- [Kết quả có cấu trúc](reports/test-results.json): tổng số, nguyên nhân và source hashes.
- [Preflight](reports/preflight.json): kết nối, số lịch sử trước khi khởi động. Đây là ảnh chụp thời điểm kiểm tra, không phải giám sát liên tục.
- [API reference](API_REFERENCE.md): hợp đồng thực tế theo source.

Runner trả exit code 1 nếu có FAIL, 2 nếu không có FAIL nhưng còn BLOCKED, 0 khi toàn bộ ca đã PASS. Không tự commit/push hoặc xuất bản collection.

## Đối chiếu sau kiểm thử

[Postflight](reports/postflight.json) xác nhận MySQL/MQTT/ESP32 vẫn online; action_history vẫn 30 SUCCESS + 4 FAILED = 34 bản ghi, giống tổng theo trạng thái ở preflight. Không có PENDING. Đây là đối chiếu tổng theo trạng thái, không phải checksum từng row.

[Safety check](reports/safety-check.json) xác nhận guard CTL08/CTL09 thực sự skip trong Newman 6.2.3: HTTP sink thử riêng nhận 0 request. Đây là kiểm tra tooling, không cộng vào 55 ca API PASS.
