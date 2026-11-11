// SENSOSYNCH - ACTION HISTORY
// Luồng: lấy logs (từ Dashboard) -> lọc SAU Search -> hiển thị -> có thể xuất CSV.
/** Icon LED / ALL dùng chung cho từng dòng nhật ký. */
function deviceBadge(device) {
    if (device === 'ALL LIGHTS') {
        return `<span class="mini-icon all">${icon('layers')}</span>`;
    }
    return `<span class="mini-icon led">${icon('bulb')}</span>`;
}
/** Tìm nhật ký theo Action, Status và ngày đã áp dụng khi bấm Search. */
function filterHistoryLogs(){return state.logs;}
/** Hiển thị trang Action History, giữ các badge và cột của bản V6. */
function history() {
    const filtered = filterHistoryLogs();
    const pageSize = state.historyPageSize;
    const totalPages = Math.max(1, Math.ceil(state.historyTotal / pageSize));
    state.historyPage = Math.min(Math.max(1, state.historyPage), totalPages);
    const start = (state.historyPage - 1) * pageSize;
    const currentRows = filtered;
    const rowsHtml = currentRows.length
        ? currentRows.map(log => `
      <tr>
        <td>${log.id}</td>
        <td>\
<div class="table-device">${deviceBadge(log.device)}<span>${log.device}</span>\
</div>\
</td>
        <td>\
<span class="state ${log.action === 'OFF' ? 'off' : ''}">${log.action}</span>\
</td>
        <td>\
<span class="state ${log.status === 'FAILED' ? 'failed' : ''}">${log.status === 'FAILED' ? '●' : ''}${log.status}</span>\
</td>
        <td>${fmt(log.time)}</td>
      </tr>`).join('')
        : '<tr><td colspan="5" class="empty">Chưa có lịch sử. Hãy vào Dashboard và bấm công tắc đèn.</td></tr>';
    return head('Action History', 'Nhật ký điều khiển thiết bị từ ESP32') + `
    <section class="panel history-panel">
      <div class="filters">
        <select id="actionFilter">
          <option value="all">All Actions</option>
          <option ${state.actionFilter === 'ON' ? 'selected' : ''}>ON</option>
          <option ${state.actionFilter === 'OFF' ? 'selected' : ''}>OFF</option>
        </select>
        <select id="statusFilter">
          <option value="all">All Status</option>
          <option value="SUCCESS" ${state.statusFilter === 'SUCCESS' ? 'selected' : ''}>SUCCESS</option>
          <option value="FAILED" ${state.statusFilter === 'FAILED' ? 'selected' : ''}>FAILED</option>
        </select>
        <label class="date-field" for="historyDate">
          <input
            type="text"
            id="historyDate"
            placeholder="dd/mm/yyyy"
            inputmode="numeric"
            maxlength="10"
            value="${formatVietnameseDate(state.historyDate)}"
            aria-label="Nhập ngày theo định dạng dd/mm/yyyy"
          >
        </label>
        <button class="primary" id="historySearch">Search</button>
        <button class="secondary" id="resetHistory">Xóa lọc</button>
      </div>
      <div class="table-scroll history-table-scroll">\
<table>
        <thead>\
<tr>\
<th>ID</th>\
<th>Device Name</th>\
<th>Action</th>\
<th>Status</th>\
<th>Timestamp</th>\
</tr>\
</thead>
        <tbody>${rowsHtml}</tbody>
      </table>\
</div>
      <div class="history-footer">
        <div class="table-footer-left">
          <label class="page-size-label" for="historyPageSize">
            Hiển thị
            <select id="historyPageSize" aria-label="Số bản ghi mỗi trang">
                <option value="10" ${state.historyPageSize === 10 ? 'selected' : ''}>10</option>
                <option value="20" ${state.historyPageSize === 20 ? 'selected' : ''}>20</option>
                <option value="50" ${state.historyPageSize === 50 ? 'selected' : ''}>50</option>
                <option value="100" ${state.historyPageSize === 100 ? 'selected' : ''}>100</option>
            </select>
            bản ghi/trang
          </label>
          <span class="muted table-record-count">
            ${state.historyTotal ? `${start + 1}–${Math.min(start + pageSize, state.historyTotal)}` : '0'} / ${state.historyTotal} bản ghi
          </span>
        </div>
        <nav class="pagination" aria-label="Phân trang lịch sử">
          <button class="secondary" data-history-page="prev" ${state.historyPage === 1 ? 'disabled' : ''}>Trước</button>
          <span>Trang ${state.historyPage} / ${totalPages}</span>
          <button class="secondary" data-history-page="next" ${state.historyPage === totalPages ? 'disabled' : ''}>Sau</button>
        </nav>
      </div>
    </section>`;
}
/** Chỉ áp dụng bộ lọc khi nhấn Search; Reset đưa điều kiện về mặc định. */
function bindHistory() {
    $('#historySearch').onclick = () => {
        state.actionFilter = $('#actionFilter').value;
        state.statusFilter = $('#statusFilter').value;
        const selectedDate = parseVietnameseDate($('#historyDate').value);

        if (selectedDate === null) {
            toast('Ngày không hợp lệ. Hãy nhập theo dạng dd/mm/yyyy.');
            $('#historyDate').focus();
            return;
        }

        state.historyDate = selectedDate;
        state.historyPage = 1;
        loadHistory();
    };
    $('#resetHistory').onclick = () => {
        state.actionFilter = 'all';
        state.statusFilter = 'all';
        state.historyDate = '';
        state.historyPage = 1;
        loadHistory();
    };

    // Phân trang: chỉ đổi trang khi người dùng bấm Trước / Sau.
    // Cho phép đổi 10/20/50/100 dòng ngay tại chân bảng.
    $('#historyPageSize').onchange = () => {
        state.historyPageSize = Number($('#historyPageSize').value);
        state.historyPage = 1;
        loadHistory();
    };

    document.querySelectorAll('[data-history-page]').forEach(button => {
        button.onclick = () => {
            if (button.dataset.historyPage === 'prev') {
                state.historyPage -= 1;
            } else {
                state.historyPage += 1;
            }
            loadHistory();
        };
    });
}
/** Xuất tất cả log (không chỉ phần đang lọc) ra file CSV để làm báo cáo. */
function exportCsv() {
    const rows = [
        ['ID', 'Device', 'Action', 'Status', 'Timestamp'],
        ...state.logs.map(log => [log.id, log.device, log.action, log.status, log.time])
    ];
    const csv = '\ufeff' + rows.map(row => row.join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'sensosynch-action-history.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}
