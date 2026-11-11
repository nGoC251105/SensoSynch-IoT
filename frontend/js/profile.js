// SENSOSYNCH | profile.js
function profile() {
    const items = [['GitHub', 'Mã nguồn của dự án', 'github', 'github'], ['Figma', 'Thiết kế giao diện', 'figma', 'figma'], ['API Documentation', 'Tài liệu các API của hệ thống', 'api', 'api'], ['Báo cáo PDF', 'Báo cáo đồ án và mô tả hệ thống', 'pdf', 'pdf']];
    return head('User Profile', 'Thông tin và tài nguyên của dự án') + `<section class="panel">\
<div class="profile">\
<div class="avatar">${icon('check')}</div>\
<div>\
<h2>Bùi Minh Ngọc</h2>\
<p class="sub">PTIT · IoT Dashboard</p>\
<p class="muted">Hệ thống giám sát cảm biến và điều khiển đèn qua ESP32</p>\
</div>\
</div>\
</section>\
<div class="quick resource-grid">${items.map(([title, description, symbol, id]) => `<section class="panel resource"><div class="resource-top"><span class="resource-icon ${symbol}">${symbol === 'pdf' ? 'PDF' : symbol === 'api' ? 'API' : symbol === 'figma' ? 'F' : '⌘'}</span><span class="resource-kind">TÀI NGUYÊN</span></div><h3>${title}</h3><p>${description}</p><button type="button" class="secondary" disabled title="Chưa cung cấp liên kết hoặc tệp">Chưa cấu hình</button></section>`).join('')}</div>\
<p class="hint">Đây là các mục tài nguyên dành cho đồ án. Khi có link GitHub, Figma, tài liệu API hoặc file PDF, có thể bổ sung để mở trực tiếp.</p>`;
}
