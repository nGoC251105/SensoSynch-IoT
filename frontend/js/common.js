// SENSOSYNCH | common.js
const fmt = t => new Date(t).toLocaleString('vi-VN');
function toast(msg) {
    let el = $('#toast');
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(window.tt);
    window.tt = setTimeout(() => el.style.display = 'none', 2100);
}
function icon(name) {
    const icons = { thermo: '<svg viewBox="0 0 24 24"><path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0Z"></path><path d="M12 12V6"></path></svg>', drop: '<svg viewBox="0 0 24 24"><path d="M12 3s5 6 5 9.5A5 5 0 0 1 7 12.5C7 9 12 3 12 3Z"></path></svg>', sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"></circle><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.8 5.8l1.8 1.8M16.4 16.4l1.8 1.8M18.2 5.8l-1.8 1.8M7.6 16.4l-1.8 1.8"></path></svg>', bulb: '<svg viewBox="0 0 24 24"><path d="M9 17h6"></path><path d="M10 20h4"></path><path d="M8.8 14.5c-1.6-1.1-2.8-3-2.8-5.2A6 6 0 1 1 18 9.3c0 2.1-1.1 4-2.8 5.2-.4.3-.7.8-.7 1.3V17H9.5v-1.2c0-.5-.3-1-.7-1.3Z"></path></svg>', layers: '<svg viewBox="0 0 24 24"><path d="m12 4 8 4-8 4-8-4 8-4Z"></path><path d="m4 12 8 4 8-4"></path><path d="m4 16 8 4 8-4"></path></svg>', check: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"></path></svg>' };
    return icons[name] || '';
}
function head(title, description) { return `<div class="head">\
<div>\
<h1>${title}</h1>\
<p class="sub">${description}</p>\
</div>\
<span class="demo">ESP32 / DỮ LIỆU THẬT</span>\
</div>`; }


/** Chuyển chuỗi nhập dd/mm/yyyy sang yyyy-mm-dd để so khớp dữ liệu. */
function parseVietnameseDate(raw) {
    const text = raw.trim();

    if (text === '') {
        return ''; // Không nhập ngày = xem mọi ngày.
    }

    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (!match) {
        return null;
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    // Kiểm tra ngày không tồn tại như 31/02/2026.
    if (date.getUTCFullYear() !== year ||
        date.getUTCMonth() + 1 !== month ||
        date.getUTCDate() !== day) {
        return null;
    }

    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Chuyển ngày đã lưu từ yyyy-mm-dd thành dd/mm/yyyy khi hiển thị trên ô lọc. */
function formatVietnameseDate(isoDate) {
    if (!isoDate) {
        return '';
    }

    const parts = isoDate.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
