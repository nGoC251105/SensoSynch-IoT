# SensoSynch IoT V12 — báo cáo TC01–TC17

Thời gian: 02:43:40 26/11/2026 (Asia/Bangkok).

Tổng theo từng phạm vi: PASS 12, FAIL 1, BLOCKED 12. Live: {"total":17,"pass":4,"fail":1,"blocked":12}. Mock online: {"total":6,"pass":6,"fail":0,"blocked":0}. Mock offline: {"total":2,"pass":2,"fail":0,"blocked":0}.

**Mock PASS không phải PASS phần cứng thật.** TC12/13/14/16/17 live bị BLOCKED có chủ đích. TC15 live BLOCKED nếu chưa có id từ response điều khiển thật, không gán id giả.

| Scope | TC | API endpoint | Expected | Actual | Result | HTTP | ms | Nguyên nhân |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| live-safe | TC01 | GET /api/health | HTTP 200 | HTTP 200 | PASS | 200 | 39 | Assertions passed |
| live-safe | TC02 | POST /api/auth/login | HTTP 200 | HTTP 401 | FAIL | 401 | 603 | HTTP 200; Login returns expiring Bearer JWT |
| live-safe | TC03 | POST /api/auth/login | HTTP 401 | HTTP 401 | PASS | 401 | 608 | Assertions passed |
| live-safe | TC04 | GET /api/devices | HTTP 200 | No HTTP request sent | BLOCKED | — | — | Login credentials/token unavailable or request guard skipped |
| live-safe | TC05 | GET /api/devices | HTTP 401 | HTTP 401 | PASS | 401 | 4 | Assertions passed |
| live-safe | TC06 | GET /api/devices | HTTP 401 | HTTP 401 | PASS | 401 | 5 | Assertions passed |
| live-safe | TC07 | GET /api/sensors/latest | HTTP 200 | No HTTP request sent | BLOCKED | — | — | Login credentials/token unavailable or request guard skipped |
| live-safe | TC08 | GET /api/sensors/chart?limit=12 | HTTP 200 | No HTTP request sent | BLOCKED | — | — | Login credentials/token unavailable or request guard skipped |
| live-safe | TC09 | GET /api/esp32/status | HTTP 200 | No HTTP request sent | BLOCKED | — | — | Login credentials/token unavailable or request guard skipped |
| live-safe | TC10 | GET /api/sensor-data?type=all&sort=desc&page=1&size=10 | HTTP 200 | No HTTP request sent | BLOCKED | — | — | Login credentials/token unavailable or request guard skipped |
| live-safe | TC11 | GET /api/action-history?action=all&status=all&page=1&size=10 | HTTP 200 | No HTTP request sent | BLOCKED | — | — | Login credentials/token unavailable or request guard skipped |
| live-safe | TC12 | POST /api/devices/1/control | Manual hardware control, HTTP 202 then matching ACK/history final result | Not sent to real hardware | BLOCKED | — | — | Hardware manual-only; automatic runner hard-excludes every LED POST |
| live-safe | TC13 | POST /api/devices/2/control | Manual hardware control, HTTP 202 then matching ACK/history final result | Not sent to real hardware | BLOCKED | — | — | Hardware manual-only; automatic runner hard-excludes every LED POST |
| live-safe | TC14 | POST /api/devices/all/control | Manual hardware control, HTTP 202 then matching ACK/history final result | Not sent to real hardware | BLOCKED | — | — | Hardware manual-only; automatic runner hard-excludes every LED POST |
| live-safe | TC15 | GET /api/actions/{{action_id}} | HTTP 200 | No HTTP request sent | BLOCKED | — | — | No action id from actual control response; no fabricated id |
| live-safe | TC16 | POST /api/devices/3/control | Manual hardware control, HTTP 202 then matching ACK/history final result | Not sent to real hardware | BLOCKED | — | — | Hardware manual-only; automatic runner hard-excludes every LED POST |
| live-safe | TC17 | POST /api/devices/4/control | Manual hardware control, HTTP 202 then matching ACK/history final result | Not sent to real hardware | BLOCKED | — | — | Hardware manual-only; automatic runner hard-excludes every LED POST |
| mock-offline | TC12 | POST /api/devices/1/control | HTTP 202; terminal FAILED after matching ACK/history verification | Admission=FAILED; actual mock command id=3108; terminal checked by polling assertions | PASS | 202 | 8 | Assertions passed |
| mock-offline | TC15 | GET /api/actions/{{action_id}} | HTTP 200 | Action id=3108; terminal=FAILED | PASS | 200 | 3 | Assertions passed |
| mock-online | TC12 | POST /api/devices/1/control | HTTP 202; terminal SUCCESS after matching ACK/history verification | Admission=PENDING; actual mock command id=1115; terminal checked by polling assertions | PASS | 202 | 51 | Assertions passed |
| mock-online | TC13 | POST /api/devices/2/control | HTTP 202; terminal SUCCESS after matching ACK/history verification | Admission=PENDING; actual mock command id=1116; terminal checked by polling assertions | PASS | 202 | 8 | Assertions passed |
| mock-online | TC14 | POST /api/devices/all/control | HTTP 202; terminal SUCCESS after matching ACK/history verification | Admission=PENDING; actual mock command id=1117; terminal checked by polling assertions | PASS | 202 | 6 | Assertions passed |
| mock-online | TC15 | GET /api/actions/{{action_id}} | HTTP 200 | Action id=1117; terminal=SUCCESS | PASS | 200 | 4 | Assertions passed |
| mock-online | TC16 | POST /api/devices/3/control | HTTP 202; terminal SUCCESS after matching ACK/history verification | Admission=PENDING; actual mock command id=1118; terminal checked by polling assertions | PASS | 202 | 5 | Assertions passed |
| mock-online | TC17 | POST /api/devices/4/control | HTTP 202; terminal SUCCESS after matching ACK/history verification | Admission=PENDING; actual mock command id=1119; terminal checked by polling assertions | PASS | 202 | 4 | Assertions passed |

## Bằng chứng và giới hạn

- Collection v2.1 riêng, giữ nguyên Collection cũ/Examples. TC04/05/06 bản Full lần lượt Valid/Invalid/Missing theo lựa chọn người dùng.
- Live TC07–TC11 chỉ gọi GET từ backend/MySQL thật, không mock cảm biến, không INSERT/UPDATE/DELETE từ test. Backend khởi động bằng lệnh chuẩn npm start; các tác vụ runtime vốn có (nhận cảm biến, Demo, trạng thái offline) vẫn có thể ghi DB theo logic cũ.
- TC09 ghi trạng thái quan sát thực tế trong Actual; chỉ quan sát một trạng thái không chứng minh đã kiểm thử cả online lẫn offline vật lý.
- SUCCESS của mock được xác nhận qua GET action id, GET Action History và trạng thái devices; ALL giữ PENDING sau ACK1/2/3, SUCCESS sau ACK4. Mock offline trả 202 FAILED và ghi lý do; không publish.
- Safety sink: {"status":"PASS","requestsReceived":0,"scope":"Real Newman pre-request scripts against local isolated HTTP sink, even with opt-in variables set"}. Mock publishes online=5, offline=0; real hardware POSTs=0.
- Backend/routes/services/Auth và hai Collection gốc giữ nguyên SHA-256: PASS (reports/full-source-audit.json). Không sửa firmware, GPIO, giao diện, cấu hình MQTT hoặc dữ liệu MySQL bằng test.
- Không lưu Newman raw summary vì chứa body Login/token. Báo cáo chỉ có metadata, thời gian, trạng thái và tên assertion.
- Không commit/push. Hướng dẫn import/merge và chạy lại: FULL_API_GUIDE.md.
