# SensoSynch V12 — API theo mã nguồn hiện tại

Đã đọc backend, frontend và schema SQL hiện tại. Project không có thư mục controllers: handler ở `src/routes/` gọi service. Sau bổ sung JWT có **10 API JSON**, **11 route HTTP được khai báo** nếu tính `GET /`. Endpoint mới duy nhất là `POST /api/auth/login`; không có CRUD cảm biến, xóa lịch sử hoặc reset database.

Base URL: `http://localhost:3000`; port từ `Number(process.env.PORT || 3000)`. Middleware JWT tại `/api` chạy trước `express.json({ limit: '16kb' })`. Chỉ GET/HEAD health và POST login public; mọi API còn lại cần `Authorization: Bearer <JWT>`, thiếu/sai/hết hạn trả 401 `{"error":"Unauthorized"}` trước khi gọi DB/MQTT. GET không có body; POST dùng JSON. Login body `{"username":"<private>","password":"<private>"}`, đúng trả 200 `{access_token,token_type:"Bearer",expires_in:3600}`, sai trả 401 `{"error":"Invalid username or password"}`. BCrypt hash cost 12; HS256, issuer/audience, exp/iat/subject/token_use được kiểm tra. Không có roles/403 trong triển khai hiện tại.

## Danh sách đầy đủ

| Method | URL | Query / path / body | Thành công | Lỗi thực tế trong code |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | Public; body username/password | 200 `{access_token,token_type,expires_in}` | 401 sai/missing credential; lỗi JSON parser theo middleware chung |
| GET | `/api/health` | Không | 200 `{ok,mqttConnected,esp32Online}` | 500 nếu truy vấn DB lỗi |
| GET | `/api/esp32/status` | Không | 200 `{online,lastSeen,timeoutMs,mqttConnected}` | Không có nhánh lỗi riêng |
| GET | `/api/sensors/latest` | Không | 200 `{temperature,humidity,light,measuredAt}` | 500 nếu DB/xử lý lỗi |
| GET | `/api/sensors/chart` | `limit` mặc định 12, số nguyên 1..100 | 200 mảng chart rows | 400 limit sai; 500 DB/xử lý lỗi |
| GET | `/api/devices` | Không | 200 `{data:[device...]}` | 500 DB/xử lý lỗi |
| POST | `/api/devices/:target/control` | target `1`, `2`, `all`; body `{"action":"ON"}` hoặc `{"action":"OFF"}` | 202 PENDING hoặc FAILED, **không phải 200/SUCCESS** | 404 target; 400 action; 409 đang xử lý lệnh; 500 không lưu được lệnh; các lỗi khác có thể đi qua middleware 500 |
| GET | `/api/actions/:id` | id số nguyên 1..1,000,000 | 200 `{id,device,action,status,reason}` | 400 id sai; 404 không có bản ghi; 500 DB/xử lý lỗi |
| GET | `/api/sensor-data` | `page`, `size`, `type`, `sort`, `date` | 200 trang sensor rows | 400 tham số sai; một số date sai gây 500; 500 DB/xử lý lỗi |
| GET | `/api/action-history` | `page`, `size`, `action`, `status`, `date` | 200 trang action rows | 400 tham số sai; một số date sai gây 500; 500 DB/xử lý lỗi |
| GET | `/` | Không | 200 HTML `../frontend/index.html` | Lỗi đọc file đi qua middleware |

Mọi row `/api` ngoài health/login trong bảng còn có nhánh **401** do auth middleware. Express phục vụ frontend tĩnh; HEAD cho GET có thể được tự hỗ trợ. Route `/api` không khớp vẫn cần JWT trước fallback 404; không có JSON 404 middleware riêng.

## Cấu trúc phản hồi

### System

`GET /api/health` gọi `SELECT 1` trước khi phản hồi:

```json
{"ok":true,"mqttConnected":true,"esp32Online":true}
```

`ok=true` xác nhận truy vấn DB thành công; MQTT hoặc ESP32 offline vẫn có thể HTTP 200. Không dùng HTTP 200 để suy ra toàn hệ thống online.

`GET /api/esp32/status`:

```json
{"online":true,"lastSeen":"2026-11-11T07:27:59.728Z","timeoutMs":8000,"mqttConnected":true}
```

Hai cờ boolean; `lastSeen` là ISO UTC hoặc `null`; `timeoutMs` cố định 8000. Online khi MQTT sẵn sàng, `lastSeen` có giá trị và tuổi tín hiệu từ 0 đến dưới 8000 ms. `lastSeen` chỉ cập nhật sau khi dữ liệu cảm biến hợp lệ được lưu DB thành công, không dựa trên ACK điều khiển.

### Sensors

`GET /api/sensors/latest`: mỗi loại lấy bản ghi mới nhất theo `measured_at DESC, id DESC`. Các giá trị có thể `null` nếu chưa có dữ liệu; `measuredAt` là thời gian lớn nhất trong các bản ghi trả về. Kết quả có thể chứa các loại đo ở những thời điểm khác nhau.

```json
{"temperature":25.5,"humidity":60,"light":1200,"measuredAt":"2026-11-11T07:27:59.728Z"}
```

`GET /api/sensors/chart?limit=12`: `limit` là số **thời điểm đo phân biệt**, không phải số row. Có thể trả tối đa nhiều loại cảm biến cho mỗi thời điểm. Thứ tự `measured_at DESC, id DESC`.

```json
[
  {"id":"SEN-123","type":"Temperature","device":"DHT11 Sensor","value":"25.5 °C","time":"2026-11-11T07:27:59.728Z"}
]
```

Fields: `id` string `SEN-<id>`; `type` Temperature/Humidity/Light; `device` DHT11 Sensor hoặc Light Sensor; `value` string kèm °C/%/ADC; `time` ISO UTC. Mảng có thể rỗng.

### Devices

`GET /api/devices` đọc `devices ORDER BY id`:

```json
{"data":[{"id":1,"code":"LED1","name":"LED 1","state":"OFF","updatedAt":"2026-11-11T07:27:59.728Z"}]}
```

`id` number; `code`, `name` string lấy từ DB; `state` ON/OFF; `updatedAt` ISO UTC. Phản hồi không cố định phải có hai row nếu DB thực tế đã bị thay đổi. Khi offline, OFF có thể chỉ là trạng thái hiển thị giả định theo chính sách backend, không xác nhận trạng thái điện vật lý.

### Control và kết quả bất đồng bộ

```http
POST {{base_url}}/api/devices/1/control
Content-Type: application/json

{"action":"ON"}
```

`target=1` ánh xạ led1; `2` ánh xạ led2; `all` ánh xạ all. Phân biệt hoa thường cho action. Thứ tự kiểm tra: target → action → khóa lệnh hiện tại → online → ghi DB/gửi MQTT.

Nếu online và gửi MQTT thành công:

```json
{"id":35,"status":"PENDING","device":"led1","action":"ON"}
```

HTTP **202**: chỉ tiếp nhận. Backend tạo `action_history` PENDING, gửi topic `device/control/1` (hoặc `/2`, `/all`), payload `{"action":"ON","commandId":35}`, QoS 1, retain false. Chỉ một lệnh được xử lý trong một tiến trình Node.js.

Nếu offline hoặc lỗi gửi sau khi đã có ID, vẫn có thể HTTP **202**:

```json
{"id":35,"device":"led1","action":"ON","status":"FAILED","reason":"ESP32 offline hoặc đã bị ngắt nguồn"}
```

Khi offline, vẫn ghi lịch sử FAILED và có thể đồng bộ trạng thái hiển thị OFF; không dùng API này như một phép kiểm tra chỉ đọc. Lý do MQTT không kết nối là `MQTT Broker không kết nối; ESP32 offline`. Lỗi gửi có reason bắt đầu `Không gửi được lệnh: `. Ghi INSERT online không thành công trả 500 `Không lưu được lệnh điều khiển`; lỗi INSERT ở nhánh offline đi qua middleware chung.

`GET /api/actions/35` chỉ đọc kết quả; phản hồi **không có** `requested_at` hoặc `completed_at`, mặc dù câu SELECT có đọc chúng:

```json
{"id":35,"device":"led1","action":"ON","status":"SUCCESS","reason":null}
```

`status` có thể PENDING/SUCCESS/FAILED; reason null hoặc string. SUCCESS cần ACK cùng commandId, đúng action và đúng thiết bị. ALL cần đủ ACK led1 và led2. Nhận status FAILED từ ESP32, lỗi ghi DB, mất kết nối hoặc quá `COMMAND_TIMEOUT_MS` (đọc được: 10000 ms) có thể kết thúc FAILED. Bộ test chỉ poll GET theo ID đã nhận, không POST lại để chờ kết quả. Dữ liệu SUCCESS có sẵn từ lịch sử không chứng minh bộ kiểm thử vừa điều khiển thành công.

409 `Hệ thống đang xử lý lệnh khác` là lỗi hợp lệ nhưng không ép xảy ra bằng việc POST hai lệnh thật: khi ACK đến sớm, request thứ hai có thể trở thành lệnh mới và đổi phần cứng.

### Sensor History

| Query | Mặc định | Miền hợp lệ / cách xử lý |
| --- | --- | --- |
| `page` | 1 | Số nguyên 1..1,000,000; offset `(page-1)*size` |
| `size` | 10 | Số nguyên 1..100 |
| `type` | all | `all`, `Temperature`, `Humidity`, `Light` (phân biệt hoa thường) |
| `sort` | desc | `asc`, `desc`; áp dụng cho thời gian và ID |
| `date` | Không lọc | Ngày Việt Nam `YYYY-MM-DD`; UTC+7 nửa đêm → UTC, lọc `>= start AND < end` |

```json
{
  "content":[{"id":"SEN-123","type":"Temperature","device":"DHT11 Sensor","value":"25.5 °C","time":"2026-11-11T07:27:59.728Z"}],
  "page":1,"size":10,"totalElements":1,"totalPages":1
}
```

`device` và đơn vị trong `value` lấy từ bảng sensors. `totalPages=Math.ceil(totalElements/size)`; không có row thì content `[]`, totalPages 0; page vượt phạm vi không bị đổi lại hoặc báo lỗi. Thứ tự mặc định mới nhất trước, ID làm tiêu chí thứ hai. Không có search/value-range trong API này.

### Action History

| Query | Mặc định | Miền hợp lệ |
| --- | --- | --- |
| `page`, `size` | 1, 10 | Giống Sensor History |
| `action` | all | `all`, `ON`, `OFF` |
| `status` | all | `all`, `PENDING`, `SUCCESS`, `FAILED` |
| `date` | Không lọc | Giống Sensor History nhưng lọc `requested_at` |

Không có tham số sort hoặc device filter được xử lý ở route này. Thứ tự luôn `requested_at DESC,id DESC`.

```json
{
  "content":[{"id":"#35","device":"LED 1","action":"ON","status":"SUCCESS","time":"2026-11-11T07:27:59.728Z","reason":null}],
  "page":1,"size":10,"totalElements":1,"totalPages":1
}
```

Device hiển thị `LED 1`, `LED 2`, `ALL LIGHTS` theo mapping led1/led2/all; giá trị khác giữ nguyên. `id` string bắt đầu `#`; khác với number ID của API action result. `time` là requested_at, không phải completed_at. Metadata phân trang giống Sensor History.

## Validation và lỗi hiện có

Mọi lỗi do helper `error()` hoặc middleware trả có body `{"error":"<message>"}`. Các nhánh 400: `limit không hợp lệ`, `ID không hợp lệ`, `page/size không hợp lệ`, `Loại cảm biến không hợp lệ`, `Thứ tự không hợp lệ`, `Ngày không hợp lệ`, `Action không hợp lệ`, `Status không hợp lệ`, `action phải là ON hoặc OFF`. Hai nhánh 404: `Thiết bị không tồn tại`, `Không tìm thấy hành động`.

`integer()` chuyển bằng `Number()` rồi kiểm tra số nguyên và khoảng; không dùng regex chữ số. `page/size` chỉ dùng mặc định nếu query `undefined`; chuỗi rỗng thành 0 và lỗi. `type/sort/action/status` dùng `||` nên chuỗi rỗng tương đương mặc định; date rỗng không lọc. Những query không được đọc không tạo tính năng API mới.

Middleware chung chỉ dùng `err.code === 400` để trả 400 và `err.message`; các lỗi khác trả 500 `Lỗi máy chủ`. Ba vấn đề đã xác nhận bằng request thật:

1. JSON lỗi cú pháp: parser có `status=400` nhưng không phải `code=400` → **500**, đáng ra 400.
2. JSON vượt giới hạn 16kb: parser có `status=413` → **500**, đáng ra 413.
3. `date=2026-13-01`: `vnDayRange` gọi `.toISOString()` trước khi kiểm tra `validDate` → RangeError → **500**, đáng ra 400. Tái hiện ở cả hai route lịch sử. Date sai định dạng hoặc ngày tràn như `2026-02-30` vẫn trả 400.

Collection cố ý đánh dấu FAIL cho các sai lệch này, đồng thời tài liệu giữ đúng hành vi thực tế; không sửa source để làm test PASS.

## MQTT, WebSocket và database (không tính thêm API HTTP)

- MQTT nhận `sensor/data` và `device/status`, QoS subscribe 1; gửi `device/control/:target`, QoS publish 1, retain false. Thông tin broker/credential được đọc từ `.env`, không chép vào artifact chia sẻ.
- Dữ liệu cảm biến: object, không phải array; temperature number hữu hạn -40..80, humidity 0..100, light 0..4095. Chỉ trường hợp lệ được lưu trong transaction; ít nhất một trường hợp lệ mới cập nhật lastSeen và broadcast.
- WebSocket `/ws` cần message đầu `{"type":"auth","access_token":"..."}` trong 5 giây; sai token đóng 1008, chưa xác thực không được nhận broadcast, token hết hạn bị đóng. Sau xác thực phát `{type,data}` với sensor:update/device:update/action:update/esp32:status. Kiểm thử WebSocket bằng server cô lập nằm trong reports/security-check-results.json; không coi mock ACK là ACK phần cứng thật.
- MySQL pool: timezone UTC (`Z`), dateStrings true, decimalNumbers true, connectionLimit 10. Các bảng: sensors, devices, sensor_data, action_history; không thực thi lại schema hay seed.
- Khi `npm start`, startup kiểm tra DB, cập nhật trạng thái hiển thị devices OFF và chuyển lịch sử PENDING thành FAILED/Backend restarted. Lần chạy này đã kiểm tra **không có PENDING trước khi khởi động**. Không restart backend đang chạy chỉ để test.
- Interval mỗi giây kiểm tra online; offline đồng bộ devices OFF và phát event. Backend hoạt động bình thường có thể tiếp tục ghi dữ liệu cảm biến từ ESP32; đây không phải bản ghi do bộ test giả lập hoặc reset.

Nguồn: `src/routes/*.js`, `src/utils/index.js`, `src/middleware/error-handler.js`, `src/services/*.js`, `src/realtime/*.js`, `src/config/*.js`, `src/startup.js`, `server.js`, `package.json`, `../database/*.sql`.
