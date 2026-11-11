// SENSOSYNCH - DASHBOARD
// Phần thầy có thể hỏi: hiển thị cảm biến, tooltip, bật/tắt LED, loading 900ms.
/**
 * Sinh công tắc điều khiển một LED hoặc cả hai.
 * Với ALL, công tắc được bật chỉ khi cả led1 và led2 cùng bật.
 */
function toggle(label, key, iconName, all = false) {
    const isOn = all ? (state.led1 && state.led2) : state[key];
    let status;
    if (all) {
        if (state.led1 && state.led2)
            status = 'Cả hai đang bật';
        else if (!state.led1 && !state.led2)
            status = 'Cả hai đang tắt';
        else
            status = 'Một đèn đang bật';
    }
    else {
        status = isOn ? 'Đang bật' : 'Đang tắt';
    }
    // Trong lúc loading, khóa tất cả công tắc để tránh gửi lệnh liên tiếp.
    if (state.busy)
        status = 'Đang xử lý lệnh...';
    const toggleKey = all ? 'all' : key;
    return `
    <div class="switch-row ${all ? 'all' : ''} ${state.busy ? 'processing' : ''}">
      <div class="device">
        <div class="device-icon ${all ? 'all' : 'led'}">${icon(iconName)}</div>
        <div>\
<b>${label}</b>\
<small>${status}</small>\
</div>
      </div>
      <button class="switch ${isOn ? 'on' : ''}"
              role="switch" aria-label="${label}" aria-checked="${isOn}"
              ${state.busy ? 'disabled' : ''} data-toggle="${toggleKey}">\
</button>
    </div>`;
}
/**
 * Vẽ 3 đường biểu đồ SVG từ 12 mẫu đo mới nhất.
 * sensorRows chứa mỗi lần đo dưới dạng 3 dòng: Temperature / Humidity / Light.
 * Biểu đồ chỉ HIỂN THỊ dữ liệu, không điều khiển LED.
 */
function chart() {
    // Mỗi thời điểm gồm 3 bản ghi được tạo cùng lúc trong sensorRows.
    const groups = new Map();
    [...state.chartRows].sort((a, b) => a.time.localeCompare(b.time)).forEach(r => {
        if (!groups.has(r.time))
            groups.set(r.time, { time: r.time });
        groups.get(r.time)[r.type] = parseFloat(r.value);
    });
    const points = [...groups.values()].filter(r => ['Temperature', 'Humidity', 'Light'].every(k => Number.isFinite(r[k]))).slice(-12);
    if (!points.length)
        return '<p class="empty">Chưa có dữ liệu biểu đồ</p>';
    // Giữ đúng màu V12, tự chọn thang theo dữ liệu thật (ADC có thể 0–4095).
    const series = [['Temperature', '#2c75ff'], ['Humidity', '#00a985'], ['Light', '#e39a28']]
      .map(([key,color]) => {const values=points.map(p=>p[key]);const lo=Math.min(...values),hi=Math.max(...values);const pad=Math.max((hi-lo)*0.15,key==='Light'?80:1);return [key,color,lo-pad,hi+pad];});
    const x = i => 42 + i * 570 / Math.max(points.length - 1, 1);
    const y = (val, min, max) => 220 - (val - min) / (max - min) * 185;
    const lines = series.map(([key, color, min, max]) => `<polyline fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${points.map((p, i) => x(i) + ',' + y(p[key], min, max)).join(' ')}"/>${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p[key], min, max)}" r="3.2" fill="#fff" stroke="${color}" stroke-width="2"/>`).join('')}`).join('');
    const ticks = points.filter((_, i) => i === 0 || i === points.length - 1 || i % 2 === 0).map(p => {
        const i = points.indexOf(p);
        return `<text x="${x(i)}" y="255" text-anchor="middle" fill="#8491a3" font-size="11">${new Date(p.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</text>`;
    }).join('');
    const hit = points.map((p, i) => `<rect x="${x(i) - 570 / Math.max(1, points.length - 1) / 2}" y="20" width="${570 / Math.max(1, points.length - 1)}" height="215" fill="transparent" data-chart-point="${i}" tabindex="0" role="button" aria-label="Xem số đo tại ${new Date(p.time).toLocaleString('vi-VN')}"/>`).join('');
    return `<div class="chart-wrap">\
<svg class="chart" viewBox="0 0 660 265" role="img" aria-label="Xu hướng 12 lần đo mới nhất; di chuột vào biểu đồ để xem chi tiết">\
<g stroke="#e8edf5" stroke-dasharray="3 5">${[35, 80, 125, 170, 220].map(v => `<line x1="30" x2="625" y1="${v}" y2="${v}"/>`).join('')}</g>${lines}${ticks}${hit}</svg>\
<div class="chart-tooltip" id="chartTooltip" hidden>\
</div>\
</div>\
<p class="hint">Di chuột vào điểm trên biểu đồ để xem giờ đo và cả 3 thông số. Mỗi đường được chuẩn hóa theo thang đo riêng.</p>`;
}
/** Gắn sự kiện hover/focus để hiện tooltip tại đúng thời điểm đo. */
function bindChart() {
    const wrap = $('.chart-wrap');
    if (!wrap)
        return;
    const tip = $('#chartTooltip');
    const groups = new Map();
    [...state.chartRows].sort((a, b) => a.time.localeCompare(b.time)).forEach(r => {
        if (!groups.has(r.time))
            groups.set(r.time, { time: r.time });
        groups.get(r.time)[r.type] = parseFloat(r.value);
    });
    const points = [...groups.values()].filter(r => ['Temperature', 'Humidity', 'Light'].every(k => Number.isFinite(r[k]))).slice(-12);
    wrap.querySelectorAll('[data-chart-point]').forEach(hit => {
        const show = () => {
            const p = points[Number(hit.dataset.chartPoint)];
            if (!p)
                return;
            tip.innerHTML = `<strong>${new Date(p.time).toLocaleString('vi-VN')}</strong>\
<div>\
<span class="tt-dot" style="background:#2c75ff">\
</span>Nhiệt độ: <b>${p.Temperature.toFixed(1)} °C</b>\
</div>\
<div>\
<span class="tt-dot" style="background:#00a985">\
</span>Độ ẩm: <b>${p.Humidity.toFixed(1)} %</b>\
</div>\
<div>\
<span class="tt-dot" style="background:#e39a28">\
</span>Ánh sáng: <b>${Math.round(p.Light)} ADC</b>\
</div>`;
            tip.hidden = false;
            const xr = Number(hit.dataset.chartPoint) / Math.max(points.length - 1, 1);
            tip.style.left = `${Math.min(78, Math.max(22, xr * 92 + 4))}%`;
        };
        hit.addEventListener('mouseenter', show);
        hit.addEventListener('focus', show);
        hit.addEventListener('click', show);
        hit.addEventListener('mouseleave', () => { tip.hidden = true; });
        hit.addEventListener('blur', () => { tip.hidden = true; });
    });
}
/** Tạo nội dung giao diện Dashboard: 3 thẻ cảm biến + biểu đồ + 3 công tắc. */
function dashboard() {
    return head('Tổng quan hệ thống', 'Giám sát cảm biến và điều khiển thiết bị') +
        `<section class="cards">\
<div class="card">\
<div class="metric-top">\
<span class="glyph">${icon('thermo')}</span>\
<span class="tag">Ổn định</span>\
</div>\
<div class="metric-label">Nhiệt độ</div>\
<div class="metric-value">${reading.temperature}°C</div>\
<div class="metric-note">Cảm biến DHT11</div>\
</div>\
<div class="card">\
<div class="metric-top">\
<span class="glyph warn">${icon('drop')}</span>\
<span class="tag warn">Trung bình</span>\
</div>\
<div class="metric-label">Độ ẩm</div>\
<div class="metric-value">${reading.humidity}%</div>\
<div class="metric-note">Độ ẩm môi trường</div>\
</div>\
<div class="card">\
<div class="metric-top">\
<span class="glyph sun">${icon('sun')}</span>\
<span class="tag">Đang nhận</span>\
</div>\
<div class="metric-label">Cường độ ánh sáng</div>\
<div class="metric-value">${reading.light} <span style="font-size:16px">ADC</span>\
</div>\
<div class="metric-note">LDR / cảm biến ánh sáng</div>\
</div>\
</section>
     <div class="dash-grid">\
<section class="panel">\
<h2>Biểu đồ theo dõi <span class="legend">\
<i style="color:#2c75ff">● Nhiệt độ</i>\
<i style="color:#00c58b">● Độ ẩm</i>\
<i style="color:#f5a319">● Ánh sáng</i>\
</span>\
</h2>${chart()}<p class="hint">Biểu đồ 12 lần đo gần nhất từ ESP32, cập nhật qua MQTT/WebSocket.</p>\
</section>
     <section>\
<p class="section-title">Điều khiển thiết bị</p>${toggle('Đèn 1', 'led1', 'bulb')}${toggle('Đèn 2', 'led2', 'bulb')}${toggle('Điều khiển tất cả', null, 'layers', true)}<p class="hint">Trạng thái LED được cập nhật khi ESP32 phản hồi về backend.</p>\
</section>\
</div>`;
}
/** Gửi lệnh thật; không thay state LED cho đến khi ESP32 ACK qua MQTT. */
async function setLeds(next1,next2,source) {
 if(state.busy)return;
 if(state.led1===next1 && state.led2===next2)return;
 const target=source==='ALL'?'all':source==='LED1'?'1':'2';
 const action=(source==='LED1'?next1:source==='LED2'?next2:next1)?'ON':'OFF';
 state.busy=true;render();toast('Đang gửi lệnh tới ESP32...');
 try {
  const job=await api.control(target,action);
  // HTTP 202 nghia la backend da nhan lenh; CHUA phai ESP32 da xac nhan.
  // Poll record theo commandId tranh race khi ACK toi truoc HTTP response.
  let result=null;
  for(let attempt=0;attempt<44;attempt++){
   result=await api.actionStatus(job.id);
   if(result.status!=='PENDING')break;
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  const response=await api.devices();
  for(const d of response.data){if(d.id===1)state.led1=d.state==='ON';if(d.id===2)state.led2=d.state==='ON';}
  toast(result?.status==='SUCCESS'?'Điều khiển thành công':result?.status==='FAILED'?'Lệnh thất bại: '+(result.reason||'ESP32 không phản hồi'):'Chưa nhận được xác nhận từ ESP32');
  if(state.page==='history')loadHistory();
 } catch(e){toast('Điều khiển thất bại: '+e.message);await refreshDashboard();}
 finally {state._waitingCommandId=null;state.busy=false;render();}
}
/** Gắn hành động click cho 3 công tắc trên Dashboard. */
function bindDashboard() {
    bindChart(); // Gắn tương tác tooltip của biểu đồ.
    document.querySelectorAll('[data-toggle]').forEach(button => {
        button.onclick = () => {
            const key = button.dataset.toggle;
            if (key === 'all') {
                // Nếu chưa bật đủ 2 LED thì bật cả 2; nếu đã bật đủ thì tắt cả 2.
                const turnOn = !(state.led1 && state.led2);
                setLeds(turnOn, turnOn, 'ALL');
            }
            else {
                const next1 = key === 'led1' ? !state.led1 : state.led1;
                const next2 = key === 'led2' ? !state.led2 : state.led2;
                setLeds(next1, next2, key.toUpperCase());
            }
        };
    });
}
