// SENSOSYNCH - DATA SENSOR
// Luồng: lấy dữ liệu -> lọc theo điều kiện đã nhấn Search -> vẽ bảng.
/** Trả về các dòng phù hợp với bộ lọc đã ÁP DỤNG trong state. */
function filterSensorRows(){return state.sensorRows;}
/** Vẽ trang Data Sensor, giữ nguyên các ô lọc và bảng của V6. */
function sensors() {
    const filtered = filterSensorRows();
    // Chỉ lấy 10 bản ghi cho mỗi trang. Tổng trang phụ thuộc kết quả lọc.
    const pageSize = state.sensorPageSize;
    const totalPages = Math.max(1, Math.ceil(state.sensorTotal / pageSize));
    state.sensorPage = Math.min(Math.max(1, state.sensorPage), totalPages);
    const start = (state.sensorPage - 1) * pageSize;
    const currentRows = filtered;

    const typeOptions = ['Temperature', 'Humidity', 'Light', 'Demo']
        .map(type => `<option ${state.filterType === type ? 'selected' : ''}>${type}</option>`)
        .join('');
    const rowsHtml = currentRows.length
        ? currentRows.map(row => `
      <tr>\
<td>\
<b>${row.id}</b>\
</td>\
<td>${row.type}</td>
          <td>${row.device}</td>\
<td>\
<b>${row.value}</b>\
</td>\
<td>${fmt(row.time)}</td>\
</tr>`).join('')
        : '<tr><td colspan="5" class="empty">Không có dữ liệu phù hợp</td></tr>';
    return head('Sensor Data Management', 'Tra cứu dữ liệu cảm biến lịch sử từ ESP32') + `
    <section class="panel sensors-panel">
      <div class="filters">
        <select id="sensorType">\
<option value="all">All Sensors</option>${typeOptions}</select>
        <label class="date-field" for="sensorDate">
          <input
            type="text"
            id="sensorDate"
            placeholder="dd/mm/yyyy"
            inputmode="numeric"
            maxlength="10"
            value="${formatVietnameseDate(state.sensorDate)}"
            aria-label="Nhập ngày theo định dạng dd/mm/yyyy"
          >
        </label>
        <select id="sensorSort">
          <option value="desc" ${state.sensorSort === 'desc' ? 'selected' : ''}>Latest First</option>
          <option value="asc" ${state.sensorSort === 'asc' ? 'selected' : ''}>Oldest First</option>
        </select>
        <button class="primary" id="sensorSearch">Search</button>
        <button class="secondary" id="resetSensor">Xóa lọc</button>
      </div>
      <div class="table-scroll sensors-table-scroll">\
<table>
        <thead>\
<tr>\
<th>ID</th>\
<th>Sensor Type</th>\
<th>Device Name</th>\
<th>Value</th>\
<th>Timestamp</th>\
</tr>\
</thead>
        <tbody>${rowsHtml}</tbody>
      </table>\
</div>
      <div class="sensors-footer">
        <div class="table-footer-left">
          <label class="page-size-label" for="sensorPageSize">
            Hiển thị
            <select id="sensorPageSize" aria-label="Số bản ghi mỗi trang">
                <option value="10" ${state.sensorPageSize === 10 ? 'selected' : ''}>10</option>
                <option value="20" ${state.sensorPageSize === 20 ? 'selected' : ''}>20</option>
                <option value="50" ${state.sensorPageSize === 50 ? 'selected' : ''}>50</option>
                <option value="100" ${state.sensorPageSize === 100 ? 'selected' : ''}>100</option>
            </select>
            bản ghi/trang
          </label>
          <span class="muted table-record-count">
            ${state.sensorTotal ? start + 1 : 0}–${Math.min(start + pageSize, state.sensorTotal)} / ${state.sensorTotal} bản ghi
          </span>
        </div>
        <nav class="pagination" aria-label="Phân trang dữ liệu cảm biến">
          <button class="secondary" data-sensor-page="prev" ${state.sensorPage === 1 ? 'disabled' : ''}>Trước</button>
          <span>Trang ${state.sensorPage} / ${totalPages}</span>
          <button class="secondary" data-sensor-page="next" ${state.sensorPage === totalPages ? 'disabled' : ''}>Sau</button>
        </nav>
      </div>
    </section>`;
}
/** Sự kiện thay đổi select/input KHÔNG tự lọc; chỉ nút Search mới áp dụng. */
function bindSensors() {
    $('#sensorSearch').onclick = () => {
        state.filterType = $('#sensorType').value;
        const selectedDate = parseVietnameseDate($('#sensorDate').value);

        if (selectedDate === null) {
            toast('Ngày không hợp lệ. Hãy nhập theo dạng dd/mm/yyyy.');
            $('#sensorDate').focus();
            return;
        }

        state.sensorDate = selectedDate;
        state.sensorSort = $('#sensorSort').value;
        state.sensorPage = 1;
        loadSensors(); // Chỉ Search mới áp dụng bộ lọc
    };
    $('#resetSensor').onclick = () => {
        state.filterType = 'all';
        state.sensorDate = '';
        state.sensorSort = 'desc';
        state.sensorPage = 1;
        loadSensors();
    };

    // Chỉ chuyển trang khi người dùng bấm Trước hoặc Sau.
    // Cho phép đổi 10/20/50/100 dòng ngay tại chân bảng.
    $('#sensorPageSize').onchange = () => {
        state.sensorPageSize = Number($('#sensorPageSize').value);
        state.sensorPage = 1;
        loadSensors();
    };

    document.querySelectorAll('[data-sensor-page]').forEach(button => {
        button.onclick = () => {
            if (button.dataset.sensorPage === 'prev') {
                state.sensorPage -= 1;
            } else {
                state.sensorPage += 1;
            }
            loadSensors();
        };
    });
}
