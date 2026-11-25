// SENSOSYNCH | profile.js
function profile() {
    const postmanUrl = "https://buiminhngoc2511-7708305.postman.co/workspace/B%C3%B9i-Minh-Ng%E1%BB%8Dc---B23DCCN604's-Wo~b7ad0578-476a-444d-84dd-31998d1ba3c5/collection/60112539-5126ab97-bc5c-426d-a562-f5f2f2321149?action=share&creator=60112539&active-environment=60112539-f4769e16-5691-4d50-bd70-1c40f87a0341";
    const resources = {
        github: ['https://github.com/nGoC251105/SensoSynch-IoT', 'Mở GitHub'],
        figma: ['https://www.figma.com/design/Zkpz5khYtPvyDiShXlbCLV/IOT_GiaoDien?node-id=0-1&t=HbvQrm4wjLnlmzD0-1', 'Mở Figma'],
        api: [postmanUrl, 'Mở Postman'],
        pdf: ['docs/IOT_BuiNgoc.pdf', 'Mở PDF']
    };
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
<div class="quick resource-grid">${items.map(([title, description, symbol, id]) => `<section class="panel resource"><div class="resource-top"><span class="resource-icon ${symbol}">${symbol === 'pdf' ? 'PDF' : symbol === 'api' ? 'API' : symbol === 'figma' ? 'F' : '⌘'}</span><span class="resource-kind">TÀI NGUYÊN</span></div><h3>${title}</h3><p>${description}</p><a class="secondary" href="${resources[id][0].replaceAll('&', '&amp;')}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none">${resources[id][1]}</a></section>`).join('')}</div>\
<p class="hint">Mở mã nguồn GitHub, thiết kế Figma, bộ kiểm thử Postman và báo cáo PDF của dự án.</p>`;
}
