# SensoSynch — JWT Authentication và Postman

JWT được xác thực **tại backend**, không phải mô phỏng trong Postman. Đọc [IMPLEMENTATION_TEST_REPORT.md](IMPLEMENTATION_TEST_REPORT.md) để xem kết quả chạy thật, [API_REFERENCE.md](API_REFERENCE.md) để xem hợp đồng API.

## Chính sách

- Public: `GET /api/health`, `POST /api/auth/login`, HTML/CSS/JS frontend.
- Cần Bearer JWT: mọi API còn lại trong `/api`, gồm cảm biến/latest/chart, `/api/devices`, `/api/esp32/status`, `/api/sensor-data`, `/api/action-history`, `/api/actions/:id`, `/api/devices/:target/control`.
- `/ws` chỉ phát telemetry sau message `{"type":"auth","access_token":"..."}` hợp lệ; đóng kết nối khi token hết hạn. Token không nằm trong URL.
- Backend kiểm tra chữ ký HS256, issuer, audience, subject, token_use, exp và iat. Thiếu token, sai chữ ký, sai thuật toán, hết hạn đều 401. Không có cờ bỏ qua middleware. Chưa có roles nên không tạo nhánh 403.
- Mật khẩu được hash **bcrypt cost 12** bằng bcryptjs. Không lưu plaintext trong `.env`, Collection, Environment hoặc báo cáo.

## Thiết lập tài khoản để sử dụng

`.env` đã có JWT_SECRET ngẫu nhiên và hash tài khoản thử nghiệm được tạo trong lần kiểm thử. Mật khẩu thử nghiệm ngẫu nhiên chỉ sống trong bộ nhớ lúc chạy và đã bị hủy; **hãy đặt mật khẩu riêng trước khi dùng giao diện/Postman**. Không có tài khoản/mật khẩu mặc định yếu.

Từ terminal PowerShell trong `backend`, nhập mật khẩu qua prompt ẩn (20..72 byte) và chọn username riêng:

```powershell
$authPasswordSecure = Read-Host 'Mat khau moi (20..72 byte)' -AsSecureString
$authPasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($authPasswordSecure)
try {
    $env:AUTH_SETUP_USERNAME = Read-Host 'Ten dang nhap'
    $env:AUTH_SETUP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($authPasswordPtr)
    node scripts/configure-auth.cjs --update
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($authPasswordPtr)
    Remove-Item Env:AUTH_SETUP_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:AUTH_SETUP_USERNAME -ErrorAction SilentlyContinue
}
npm start
```

Script lưu `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`, `JWT_SECRET`, `JWT_EXPIRES_IN_SECONDS` vào `.env`; giữ secret hiện có, không in/lưu plaintext. Backend cần restart sau khi đổi cấu hình. Script không tự restart, không sửa database. `.env` được gitignore. Xem biến mẫu ở `../.env.example`.

Không restart khi có lệnh PENDING: startup hiện có sẽ đổi PENDING thành FAILED và trạng thái hiển thị devices về OFF. Kiểm tra `node postman/diagnose.cjs` trước. Không chạy lại schema SQL hay reset lịch sử. Khi thiếu cấu hình auth hợp lệ, backend từ chối khởi động, không mở chế độ public thay thế.

## Frontend

Mở `http://localhost:3000`. Hộp đăng nhập yêu cầu tài khoản vừa cấu hình; mọi request qua `api.request` gửi `Authorization: Bearer <token>`. Token chỉ giữ trong bộ nhớ, tải lại trang phải đăng nhập lại. Có nút Đăng xuất; không lưu mật khẩu/localStorage. Khi POST LED gặp 401, frontend xóa token và thông báo, **không tự gửi lại lệnh**. MQTT topic, firmware, logic ACK và UI hiện có giữ nguyên; chỉ cập nhật `frontend/js/api.js` cho HTTP/WebSocket authentication.

## Import Collection

1. Import `IoT_Smart_Home_API.postman_collection.json` và `IoT_Local.postman_environment.json`.
2. Chọn Environment IoT Local; `base_url` đọc từ port cấu hình (hiện tại 3000).
3. Nhập `username`, `password` **chỉ trong giá trị local/private** của Postman. File chia sẻ giữ rỗng. Không thêm JWT_SECRET vào Postman.
4. Chạy TC02 Login. Response 200 gồm `access_token`, `token_type: Bearer`, `expires_in` (mặc định 3600 giây); script lưu vào Environment `access_token`.
5. Collection dùng Bearer `{{access_token}}`. Request bình thường để **Inherit auth from parent** (không khai báo auth override). Login/Health dùng No Auth; các ca kiểm thử thiếu/sai token có override có chủ đích.
6. Giữ `isolated_mock_server=false`, `enable_hardware_tests=false`, confirmation rỗng; 1 iteration. TC10 chỉ được runner cho phép trên server cô lập dùng mock MQTT/DB. Không bật cờ mock trên backend thật.

TC07/TC11..TC15 cần token fixture runtime có chữ ký/tham số đặc biệt: import công khai để rỗng và báo BLOCKED nếu chưa có. Không chép secret vào Collection để tự ký. Runner tạo chúng trong bộ nhớ. TC08/TC09 gửi action hợp lệ nhưng không có JWT/giả JWT: middleware phải trả 401 trước mọi publish.

Hai file tên cũ `SensoSynch_API.postman_collection.json` và `SensoSynch_Local.postman_environment.json` được đồng bộ với bản JWT để các link cũ vẫn import được.

## Chạy test

```powershell
npm ci
npm ci --prefix postman
npm --prefix postman run validate
npm --prefix postman run check:public
npm --prefix postman run test:auth
node postman/security-check.cjs
node postman/frontend-auth-check.cjs
node postman/finalize-auth-report.cjs
```

`test:auth` chạy **15 ca Newman** trên HTTP server thật, cùng middleware/routes/services production, với DB/MQTT giả lập. TC10 gửi đúng một mock publish, ACK qua service gốc kết thúc SUCCESS. Không khởi động kết nối phần cứng. `security-check.cjs` chạy ma trận không token/token giả trên đủ 8 API protected, bảo đảm không gọi DB/MQTT, và kiểm tra WebSocket; `frontend-auth-check.cjs` chạy `frontend/js/api.js` trong VM với DOM/fetch/WebSocket stubs, không phải kiểm tra giao diện trực quan trên trình duyệt.

Kiểm thử live cần backend đang chạy và mật khẩu chỉ trong process environment `AUTH_TEST_PASSWORD`; không lưu vào file. Lấy mật khẩu từ Read-Host ẩn tương tự phần setup, gán vào `$env:AUTH_TEST_PASSWORD`, sau đó:

```powershell
npm --prefix postman test
Remove-Item Env:AUTH_TEST_PASSWORD -ErrorAction SilentlyContinue
```

Nếu backend chưa chạy, `node postman/auth-run.cjs --start-local` có thể khởi động bootstrap production sau khi xác nhận không có PENDING; runner đóng runtime do nó khởi động khi xong. Không tự restart server đã chạy. Nếu chưa có hash account, runner tạo tài khoản mạnh với password ngẫu nhiên trong bộ nhớ và lưu **chỉ hash**. Khi account đã tồn tại và không được cấp AUTH_TEST_PASSWORD, login/những ca phụ thuộc login bị BLOCKED; các ca negative độc lập vẫn chạy. Có thể dùng `AUTH_TEST_BASE_URL` cho server khác; token fixture từ `.env` local chỉ phù hợp khi server dùng cùng cấu hình.

Runner không gửi TC10/CTL08/CTL09 lên backend thật; valid control chỉ chạy ở isolated. Exit 1 nếu có FAIL; 2 nếu chỉ còn BLOCKED; 0 khi toàn bộ ca đã PASS. Bốn lỗi input cũ vẫn báo FAIL trong kiểm thử live, không sửa ngoài phạm vi JWT. Entry cũ `node postman/run.cjs` chuyển sang auth runner mới.

## Kết quả và chia sẻ

- `AUTH_TEST_REPORT.md`: bảng đầy đủ expected/actual/PASS/FAIL/BLOCKED.
- `reports/auth-test-results.json`: metadata kết quả đã loại credential/token.
- `reports/security-check-results.json`: ma trận bảo vệ endpoint và WebSocket.
- `reports/frontend-auth-results.json`: kiểm tra tích hợp frontend bằng stubs.
- `reports/validation.json`: schema Collection v2.1, endpoint khớp source và cú pháp.

Lần triển khai này: 115 kiểm tra hành vi tổng hợp, 110 PASS / 4 FAIL / 1 BLOCKED. Riêng TCxx JWT: 29 PASS / 0 FAIL / 1 BLOCKED (TC10 trên hệ thống thật bị chặn có chủ đích; TC10 mock đã PASS). Bốn FAIL là các lỗi input cũ, chi tiết trong report. Các số liệu này có timestamp và không thay thế kết quả khi chạy lại.

Các file `API_TEST_REPORT.md`, `reports/newman-report.json`, `reports/test-results.json`, `reports/test-report.html` là **kết quả lịch sử trước JWT**, có timestamp riêng; không dùng chúng để kết luận bảo mật JWT hiện tại. Runner mới không serialize raw Newman request/response/environment vì chứa password và JWT. Không thêm reporter JSON thô cho lần chạy có credentials nếu chưa có bước lọc thông tin bí mật.

Để công khai: import hai file IoT vào Postman, giữ giá trị credential/token rỗng trong bản chia sẻ → chuyển Collection vào public workspace → Share → Link to collection in public workspace hoặc Run in Postman → Public → Copy link. Xem [hướng dẫn Postman](https://learning.postman.com/docs/collaborating-in-postman/sharing/). Chưa xuất bản/link công khai trong phiên này. `localhost` trên máy giảng viên vẫn cần backend riêng. Không chia sẻ `.env`, node_modules, token runtime hoặc password. Không commit/push tự động.

Schema và script references: [Postman v2.1](https://schema.getpostman.com/json/collection/v2.1.0/collection.json), [Newman](https://github.com/postmanlabs/newman), [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken), [bcryptjs](https://github.com/dcodeIO/bcrypt.js).
