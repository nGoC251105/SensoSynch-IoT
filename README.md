# SensoSynch IoT V12

Dashboard giám sát Temperature, Humidity, Light từ ESP32 và điều khiển 4 LED qua MQTT. Backend Node.js/Express, MySQL, WebSocket và JWT Authentication. Demo là chuỗi giả lập riêng do backend lưu trong database.

## Tài nguyên

- [Mã nguồn GitHub](https://github.com/nGoC251105/SensoSynch-IoT)
- [Thiết kế Figma](https://www.figma.com/design/Zkpz5khYtPvyDiShXlbCLV/IOT_GiaoDien?node-id=0-1&t=HbvQrm4wjLnlmzD0-1)
- [Postman Collection](https://buiminhngoc2511-7708305.postman.co/workspace/B%C3%B9i-Minh-Ng%E1%BB%8Dc---B23DCCN604's-Wo~b7ad0578-476a-444d-84dd-31998d1ba3c5/collection/60112539-5126ab97-bc5c-426d-a562-f5f2f2321149?action=share&creator=60112539&active-environment=60112539-f4769e16-5691-4d50-bd70-1c40f87a0341)
- [Báo cáo PDF](frontend/docs/IOT_BuiNgoc.pdf) — xuất từ bản Word người dùng cung cấp.
- [Bản Word nguồn](docs/IOT_BuiNgoc.docx)

## Chạy backend và Dashboard

```powershell
cd backend
npm install
```

Tạo `.env` từ `.env.example`, điền cấu hình MySQL/MQTT riêng và cấu hình tài khoản theo [AUTH_SETUP.md](backend/AUTH_SETUP.md). Sau đó:

```powershell
npm start
```

Mở `http://localhost:3000`. Không mở `frontend/index.html` qua `file://`. Các API dữ liệu/điều khiển cần Bearer JWT; thông tin đăng nhập và JWT_SECRET không có trong repository.

## Firmware ESP32

Trong `firmware/SensoSynch_ESP32`, sao chép `secrets.example.h` thành `secrets.h` và điền thông tin Wi-Fi/MQTT riêng trước khi biên dịch/nạp bằng Arduino IDE. `secrets.h` và `.env` được Git bỏ qua. GPIO LED1/2/3/4 lần lượt 25/26/27/32; DHT11 GPIO4, LDR GPIO34.

Kiểm tra chiều ADC theo [LDR_CALIBRATION.md](firmware/LDR_CALIBRATION.md). Firmware hiện bật phép đảo `4095 - lightRaw`; cần nạp đúng firmware và xác nhận bằng che/chiếu sáng trên thiết bị thật.

## Kiểm thử Postman

Bản Full TC01–TC17 và hướng dẫn chạy ở [FULL_API_GUIDE.md](backend/postman/FULL_API_GUIDE.md). Các lệnh LED mặc định bị khóa, không tự điều khiển phần cứng khi chạy bộ test an toàn. Xem [TEST_SUMMARY.md](backend/postman/TEST_SUMMARY.md) để biết kết quả PASS/FAIL/BLOCKED thực tế; không coi kết quả mock là xác nhận LED vật lý.

Không đưa mật khẩu, token, `.env`, `secrets.h` hoặc báo cáo Newman thô lên repository.
