# Kiểm tra chiều LDR GPIO34

Firmware hiện đọc ADC thật 12 bit (0–4095), đơn vị ADC. Theo yêu cầu đảo logic cho mạch hiện tại, `LIGHT_RAW_DECREASES_WHEN_BRIGHTER = true`: giá trị gửi đi là `4095 - lightRaw`. Không đổi phần cứng hoặc backend. Tài liệu dự án chỉ ghi **AO → GPIO34**, chưa mô tả mạch chia áp bên trong module; chiều thực tế vẫn cần xác nhận bằng phép che/chiếu sáng dưới đây sau khi nạp firmware.

## Xác định chiều trước khi đổi cấu hình

1. Kiểm tra nguồn module phù hợp, GND chung và AO không vượt 3.3 V. Với cầu chia áp rời: `3.3V — LDR — GPIO34 — điện trở — GND` thường cho ADC tăng khi sáng; `3.3V — điện trở — GPIO34 — LDR — GND` thường cho ADC giảm khi sáng. Với module AO phải kiểm tra sơ đồ module hoặc đo thực tế.
2. Nạp sketch, mở Serial Monitor 115200 baud, kết nối MQTT để hàm gửi cảm biến chạy. Ghi ít nhất 5 mẫu `LIGHT raw=... display=... inverted=...` khi ánh sáng ổn định.
3. Che LDR, đợi vài chu kỳ gửi (2 giây/mẫu), ghi 5 mẫu raw. Sau đó bỏ che và chiếu sáng, ghi tiếp 5 mẫu. Tránh dùng các mức đều bão hòa 0/4095.
4. Nếu raw khi sáng **lớn hơn** khi tối: đặt lại `false`. Nếu raw khi sáng **nhỏ hơn** khi tối: giữ cấu hình hiện tại `true`. Khi đó chỉ firmware thực hiện `lightDisplay = 4095 - lightRaw`. Nếu đổi cấu hình, biên dịch và nạp lại. Nếu raw không đổi rõ ràng, kiểm tra AO/DO, nguồn và đấu dây trước; không dùng dữ liệu ngẫu nhiên.
5. Lặp lại che/chiếu sáng: display phải giảm khi tối, tăng khi sáng. Đối chiếu `SENSOR ->` trên Serial với MQTT `sensor/data.light`, API `/api/sensors/latest`, `/api/sensors/chart?limit=12`, Data Sensor và Dashboard. So sánh cùng mẫu/thời điểm, tránh khác chu kỳ gửi.

Backend lưu nguyên `light` trong MySQL rồi truyền WebSocket `sensor:update`; frontend không đảo thêm. Temperature/Humidity và Demo không thay đổi.

## Dữ liệu lịch sử khi thay đổi chiều

Không cập nhật hay đảo các bản ghi MySQL đã lưu. Nếu chuyển cấu hình false → true, ghi thời điểm mẫu đầu tiên sau khi nạp firmware làm mốc T (dùng `measured_at` của database/API), cùng chiều cũ/mới. Trước T là ADC raw cũ; từ T là ADC đã chuẩn hóa chiều tăng theo sáng.

Biểu đồ hiện lấy 12 mẫu Light mới nhất. Trong thời gian chuyển tiếp, nó có thể chứa cả hai ý nghĩa. Không dùng đoạn nối qua T để đánh giá xu hướng. Để tránh hiển thị lẫn khi đưa lại vào sử dụng, tạm ngừng mở Dashboard trong lúc chuyển cấu hình, chờ ít nhất 12 mẫu Light mới được lưu thành công và kiểm tra `/api/sensors/chart?limit=12` chỉ còn mẫu Light từ T trở đi. Với chu kỳ 2 giây, thời gian tối thiểu khoảng 24 giây, nhưng phải kiểm tra mẫu thực lưu. Data Sensor/API lịch sử vẫn giữ nguyên dữ liệu cũ; khi phân tích phải tách tại T. Nếu cần xem biểu đồ ngay trong giai đoạn chuyển tiếp, cần bổ sung bộ lọc mốc T riêng; bản sửa này không thay đổi API hoặc lịch sử.

## Phạm vi xác nhận

Chưa có kết quả che/chiếu sáng trên ESP32 thực tế thì chưa thể xác nhận chiều cảm biến hoặc chọn `true` một cách có cơ sở. Kiểm thử phần mềm không thay thế phép đo này.
