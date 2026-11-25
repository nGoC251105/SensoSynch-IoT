# JWT Authentication

Backend ban đầu chưa đăng ký Login API hoặc middleware xác thực; POST `/api/auth/login` vì thế trả 404. Các Collection/test JWT có sẵn không chứng minh backend đã hỗ trợ JWT. Bản sửa bổ sung duy nhất một route Login vào ứng dụng thật.

## Khởi động

```powershell
cd D:\Downloads\SensoSynch_Complete\SensoSynch_Complete\backend
npm install
npm start
```

Backend đọc `.env` cạnh `server.js`, mặc định port 3000. Nếu một backend cũ đang chạy thì dừng tiến trình đó rồi khởi động lại. Không chạy hai bản trên cùng cổng.

`.env` cần `JWT_SECRET` tối thiểu 32 byte, `AUTH_USERNAME`, `AUTH_PASSWORD_HASH` là bcrypt hash, `JWT_EXPIRES_IN_SECONDS` (mặc định 3600). Thiếu/sai cấu hình thì backend từ chối khởi động. Tài khoản đơn được cấu hình cục bộ; không thêm bảng MySQL hay đăng ký công khai.

Trong lần sửa này hash cũ không hợp lệ nên đã thay bằng bcrypt cost 12 từ mật khẩu ngẫu nhiên 256 bit. JWT_SECRET hiện có được giữ nguyên. Thông tin đăng nhập nằm riêng trong `.auth-login.local.json`, bị Git bỏ qua và giới hạn quyền truy cập Windows; không gửi file này lên GitHub. Đây là bản sao mật khẩu ban đầu: sau khi lưu mật khẩu vào nơi riêng an toàn, xóa file này. Script kiểm thử live cần file đó hoặc biến `AUTH_TEST_PASSWORD`.

Để đặt lại tài khoản bằng mật khẩu của bạn (nhập 20–72 byte, không lưu plaintext trong `.env`):

```powershell
$securePassword = Read-Host 'Mat khau moi (20-72 bytes)' -AsSecureString
$env:AUTH_SETUP_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
try { npm run configure-auth -- --update } finally { Remove-Item Env:AUTH_SETUP_PASSWORD }
```

Khởi động lại backend sau khi thay đổi. Nếu đã đổi mật khẩu, file `.auth-login.local.json` chứa mật khẩu cũ và nên được xóa. Không ghi mật khẩu mới vào Collection hoặc file Environment xuất công khai.

## Postman

Import `postman/IoT_Smart_Home_API.postman_collection.json` và `postman/IoT_Local.postman_environment.json`. Hai file tên SensoSynch tương ứng là bản sao đồng bộ cùng cấu trúc. Chọn Environment, đặt **giá trị cục bộ riêng**:

- `base_url`: `http://localhost:3000`
- `username`, `password`: lấy từ file đăng nhập riêng ở trên.
- `access_token`: để trống ban đầu, request TC02 Login sẽ tự điền sau HTTP 200.

POST `{{base_url}}/api/auth/login`, Authorization **No Auth**, Body **raw / JSON**:

```json
{"username":"{{username}}","password":"{{password}}"}
```

Response HTTP 200 có đúng cấu trúc (JWT thật được lược bỏ trong tài liệu):

```json
{"access_token":"<JWT>","token_type":"Bearer","expires_in":3600}
```

Sai thông tin đăng nhập: HTTP 401 `{"error":"Invalid username or password"}`. API được bảo vệ thiếu/sai/hết hạn token: HTTP 401 `{"error":"Unauthorized"}`. Các request dữ liệu/LED dùng **Inherit auth from parent**, Collection đặt Bearer `{{access_token}}`. Không bao giờ đưa `JWT_SECRET` vào Postman. Public chỉ có GET `/api/health` và POST `/api/auth/login`. Login giới hạn 20 lần/15 phút/IP; quá giới hạn trả 429.

Mọi API còn lại dưới `/api` cần JWT, gồm latest/chart/Data Sensor/devices/ESP32 status/Action History/action result và POST điều khiển từng LED/ALL. Middleware chạy trước JSON parser và trước DB/MQTT. JWT kiểm tra HS256, chữ ký, issuer, audience, subject, token_use, iat và exp bằng jsonwebtoken; mật khẩu so sánh bằng bcryptjs, không so sánh plaintext hoặc decode JWT thay cho verify.

## Frontend và WebSocket

Dashboard V12 giữ nguyên bố cục; thêm hộp đăng nhập sử dụng cùng màu/font. `auth.js` quản lý một phiên đăng nhập dùng chung cho các request đồng thời; `api.js` thêm Authorization Bearer. Token chỉ ở bộ nhớ, tải lại trang sẽ đăng nhập lại. Không tự gửi lại lệnh LED khi gặp 401 để tránh điều khiển hai lần.

WebSocket vẫn `/ws`, không truyền token trong URL. Sau khi mở, client gửi `{"type":"auth","access_token":"<JWT>"}`. Server trả `auth:ready`, sau đó mới gửi telemetry; đóng kết nối khi token hết hạn. MQTT/ESP32 không dùng JWT và không cần nạp firmware cho thay đổi xác thực này.

## Kiểm thử

```powershell
node --test tests/four-leds.test.cjs
node postman/auth-run.cjs --isolated-only
node postman/security-check.cjs
node postman/frontend-auth-check.cjs
node postman/live-auth-check.cjs
node postman/validate.cjs
node postman/check-public-artifacts.cjs
```

Live check cần backend đang chạy và tài khoản cục bộ. Test cô lập dùng HTTP thật cùng app/middleware/service nhưng DB/MQTT giả lập; không tạo dữ liệu cảm biến giả trong database thật. Live check chỉ đọc dữ liệu và kiểm tra từ chối lệnh không xác thực, không gửi lệnh LED hợp lệ. Xem `postman/IMPLEMENTATION_TEST_REPORT.md` để biết kết quả và giới hạn thực tế.
