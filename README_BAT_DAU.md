# SENSOSYNCH V12 — ESP32 + Mosquitto + Node.js + MySQL

## 0. Nguyên tắc giữ nguyên giao diện đã pass

- Giữ nguyên toàn bộ CSS và bố cục HTML, điều hướng 4 màn hình Dashboard / Data Sensor / Action History / Profile.
- Dashboard vẫn có biểu đồ **12 điểm**, tooltip, ba công tắc LED1/LED2/ALL, loading và toast.
- Data Sensor và Action History chỉ áp dụng bộ lọc khi nhấn **Search**, nút **Xóa lọc** về điều kiện mặc định, hỗ trợ 10/20/50/100 dòng/trang.
- Nút ALL ON khi chưa bật cả hai LED, ALL OFF khi cả hai cùng bật; một lần nhấn ALL chỉ có **1 dòng Action History**.
- Chỉ thay phần giả lập (random, localStorage demo, setTimeout 900ms) bằng REST API, MQTT và dữ liệu thật.

## 1. Cấu trúc thư mục

```
SensoSynch_Complete/
├── frontend/                  # toàn bộ giao diện V12 gốc, chỉnh JS để gọi API
│   ├── index.html             # thêm js/api.js, giữ CSS
│   ├── css/                   # GIỮ NGUYÊN bản pass
│   └── js/
│       ├── state.js           # state in-memory, không còn random/localStorage demo
│       ├── api.js             # MỚI: REST/WebSocket + tải dữ liệu
│       ├── dashboard.js       # đổi setLeds thành lệnh API thật; chart 12 điểm
│       ├── sensors.js         # lấy từ MySQL thông qua backend, lọc/phân trang server
│       ├── history.js         # lọc/phân trang server, xem bản ghi thật
│       ├── app.js             # bootstrap realtime + tải trang
│       ├── common.js          # bỏ nhãn DEMO
│       └── profile.js         # giữ nguyên UI (link chưa cấu hình)
├── backend/
│   ├── package.json          # npm dependencies
│   ├── .env.example          # mẫu cấu hình (copy thành .env)
│   ├── .gitignore            # không commit mật khẩu
│   └── server.js             # API + MQTT + WebSocket + SQL
├── database/
│   └── schema.sql            # bảng dữ liệu + metadata ESP32
└── firmware/
    └── SensoSynch_ESP32/
        └── SensoSynch_ESP32.ino
```

## 2. Công cụ cần cài trên Windows

1. **VS Code**, **Node.js LTS** (kiểm tra bằng `node -v`, `npm -v`).
2. **MySQL Server 8.x** và MySQL Workbench (hoặc MySQL CLI).
3. **Mosquitto** (broker). Theo sketch hiện tại dự kiến `172.20.10.7:1884`, tài khoản `ngoc`. Cổng và IP phải khớp cấu hình trên PC thực tế.
4. **Arduino IDE 2.x**: Board Manager `esp32` by Espressif Systems; Library Manager cài `PubSubClient`, `DHT sensor library` (+ Adafruit Unified Sensor), `ArduinoJson` (v7).

## 3. MySQL — làm đầu tiên

Mở MySQL Workbench → kết nối máy local → File → Open SQL Script → chọn `database/schema.sql` → Execute.

Thử:
```sql
USE sensosynch;
SHOW TABLES;
SELECT * FROM sensors;
SELECT * FROM devices;
```

Mong đợi: 4 bảng `sensors`, `devices`, `sensor_data`, `action_history`; ba cảm biến và hai LED.

## 4. Mosquitto — đảm bảo máy tính mở broker cho ESP32

Dùng đúng broker cũ nếu vẫn hoạt động. Ví dụ cấu hình `mosquitto.conf` (đường dẫn `password_file` phải đúng với PC):

```conf
listener 1884 0.0.0.0
allow_anonymous false
password_file C:\\Program Files\\mosquitto\\passwords.txt
```

Tạo password file bằng công cụ `mosquitto_passwd -c "C:\\Program Files\\mosquitto\\passwords.txt" ngoc` nếu chưa có; `-c` tạo mới và sẽ GHI ĐÈ file cũ. **Không dùng -c nếu đã có user**. Restart broker sau khi chỉnh. Mở rule Windows Firewall inbound TCP port 1884 trên mạng riêng nếu ESP32 không truy cập được.

Kiểm tra PC bằng 2 terminal:
```powershell
mosquitto_sub -h 127.0.0.1 -p 1884 -u ngoc -P "YOUR_MQTT_PASSWORD" -t "#" -v
```
Và (để thử LED khi firmware chạy):
```powershell
mosquitto_pub -h 127.0.0.1 -p 1884 -u ngoc -P "YOUR_MQTT_PASSWORD" -t device/control/1 -m ON
```
Địa chỉ `172.20.10.7` trong firmware **chỉ đúng nếu PC hiện tại thật sự có IP đó** (kiểm tra `ipconfig`). ESP32 và PC phải nhìn thấy nhau trong mạng Wi-Fi.

## 5. Arduino IDE — nạp firmware

Mở `firmware/SensoSynch_ESP32/SensoSynch_ESP32.ino` bằng Arduino IDE.

1. Thay `YOUR_WIFI_SSID`, `YOUR_WIFI_PASSWORD`, `YOUR_MQTT_PASSWORD`, kiểm tra `MQTT_SERVER`, `MQTT_PORT`.
2. Nối chân **DHT11 DATA GPIO4, LDR AO GPIO34, LED1 GPIO25, LED2 GPIO26** theo sketch hiện tại. LED cần điện trở nối tiếp 220–330 Ω, tất cả GND chung. Dùng nguồn phù hợp; không nối LED trực tiếp không qua điện trở. Cảm biến analog không được đưa >3.3 V vào GPIO34.
3. Board `ESP32 Dev Module`, chọn đúng COM, Upload.
4. Mở Serial Monitor **115200 baud**. Mong đợi `MQTT connected` và bản tin `SENSOR -> {..}` mỗi 2 giây.
5. Từ `mosquitto_pub` gửi lệnh ON/OFF đến `device/control/1`, `/2`, `/all`. Firmware vẫn hỗ trợ **plain text** `ON`/`OFF` để test bằng terminal; backend sử dụng JSON có `commandId` nhằm ghi log chính xác.

## 6. VS Code — chạy backend + frontend

Mở VS Code → File → Open Folder → chọn **SensoSynch_Complete**.

Terminal VS Code:
```powershell
cd backend
copy .env.example .env
notepad .env
npm install
npm start
```

Trong `.env`, sửa mật khẩu DB, MQTT; chỉnh `MQTT_URL` theo broker. Không commit `.env` lên GitHub.

Sau khi thấy `SensoSynch: http://localhost:3000`, mở **http://localhost:3000**. **Không mở index.html bằng file:// và không cần Live Server**: Express đồng thời phục vụ frontend và API, tránh lỗi CORS.

Kiểm tra API:
```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:3000/api/devices
Invoke-RestMethod http://localhost:3000/api/sensors/latest
Invoke-RestMethod http://localhost:3000/api/sensors/chart
Invoke-RestMethod 'http://localhost:3000/api/sensor-data?page=1&size=10'
Invoke-RestMethod 'http://localhost:3000/api/action-history?page=1&size=10'
```

Thử điều khiển bằng PowerShell:
```powershell
Invoke-RestMethod http://localhost:3000/api/devices/1/control -Method POST -ContentType 'application/json' -Body '{"action":"ON"}'
```
Response HTTP **202** chỉ có nghĩa backend đã nhận lệnh. Kiểm tra `/api/actions/ID` cho đến khi SUCCESS/FAILED.

## 7. Luồng và bảng dữ liệu

- ESP32 publish `sensor/data` JSON {temperature,humidity,light} → backend validate/lưu `sensor_data` → WebSocket `sensor:update` → Dashboard.
- Frontend POST `/api/devices/1|2|all/control` → backend INSERT một dòng `action_history` PENDING → MQTT JSON {action,commandId} topic `device/control/1|2|all` → ESP32 đổi GPIO và publish `device/status` kèm `commandId` → backend cập nhật trạng thái, đổi log SUCCESS/FAILED → browser tải trạng thái thật. ALL cần cả **led1 + led2** ACK cùng mã lệnh.
- Nếu không phản hồi trong 10 giây: FAILED; trạng thái LED chưa được khẳng định thành công. Sau ESP32 reboot, firmware công bố trạng thái GPIO OFF và backend đồng bộ lại.

## 8. Các test case tối thiểu để quay demo / báo cáo

| Test | Kỳ vọng |
|---|---|
| Sensor gửi 2s | `/api/sensors/latest` thay đổi, `sensor_data` tăng |
| Biểu đồ | 12 mốc gần nhất có đủ 3 loại cảm biến |
| LED1 ON/OFF | GPIO25 đổi; chỉ một dòng log cho lần bấm |
| LED2 ON/OFF | GPIO26 đổi; chỉ một dòng log cho lần bấm |
| ALL ON/OFF | Hai chân đổi; 1 dòng log ALL mỗi lần bấm |
| Gửi action sai | HTTP 400 |
| Gửi lúc lệnh đang chạy | HTTP 409 |
| Mất ESP32 | HTTP 503 khi offline; Dashboard không báo thành công giả |
| Mất ACK | PENDING → FAILED sau 10s |
| Search / Xóa lọc | Chỉ Search áp dụng bộ lọc; Reset về mặc định |
| Phân trang | 10/20/50/100, chuyển Trước/Sau |
| Reset ESP32 | Backend nhận trạng thái OFF mới qua commandId 0 |

## 9. Các giới hạn chưa thể tuyên bố PASS ngay

- Chưa chạy tích hợp với **MySQL, Mosquitto, ESP32 vật lý trên máy bạn**; cần kiểm chứng phần cứng, mạng, log và ảnh.
- Frontend gốc không có trang đăng nhập; không thêm login làm khác thiết kế đã pass.
- Profile gốc chưa có URL Github/Figma/API/PDF thật; giữ nguyên chỗ trống, cấu hình khi có tài liệu.
- Chưa có xác thực người dùng hoặc mã hóa HTTPS/MQTT TLS; chỉ sử dụng trong mạng học phần tin cậy. Không mở trực tiếp cổng API hoặc MQTT ra Internet.
- Backend dùng một tiến trình, một lệnh điều khiển tại một thời điểm; phù hợp demo, chưa phải hệ thống multi-instance.
