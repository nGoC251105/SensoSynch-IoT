// Three real sensor series and four MQTT-controlled LEDs.
const dashboardSeries = [
 ['Temperature','#2c75ff','\u00b0C','thermo'], ['Humidity','#00a985','%','drop'],
 ['Light','#e39a28','ADC','sun'], ['Demo','#8661c5','%','layers']
];
function dashboardPoints(key) {
 return [...state.chartRows].filter(r=>r.type===key && Number.isFinite(parseFloat(r.value)))
 .sort((a,b)=>a.time.localeCompare(b.time)).slice(-12).map(r=>({time:r.time,value:parseFloat(r.value)}));
}
function chart(series) {
 const [key,color,unit]=series, points=dashboardPoints(key);
 if(!points.length)return '<p class="empty">Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u ESP32</p>';
 const values=points.map(p=>p.value), lo=Math.min(...values), hi=Math.max(...values);
 const pad=Math.max((hi-lo)*.15,key==='Light'?80:1), min=lo-pad,max=hi+pad;
 const x=i=>60+i*520/Math.max(points.length-1,1), y=v=>210-(v-min)/(max-min)*180;
 const grid=[0,1,2,3,4].map(i=>{const v=min+(max-min)*i/4;return `<line x1="60" x2="580" y1="${y(v)}" y2="${y(v)}" stroke="#e8edf5" stroke-dasharray="3 5"/><text x="52" y="${y(v)+4}" text-anchor="end" fill="#8491a3" font-size="11">${v.toFixed(key==='Light'?0:1)}</text>`;}).join('');
 const dots=points.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="3.2" fill="white" stroke="${color}" stroke-width="2"/>`).join('');
 const ticks=points.map((p,i)=>i===0||i===points.length-1||i%3===0?`<text x="${x(i)}" y="245" text-anchor="middle" fill="#8491a3" font-size="11">${new Date(p.time).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</text>`:'').join('');
 const step=520/Math.max(points.length-1,1);
 const hits=points.map((p,i)=>`<rect x="${Math.max(55,x(i)-step/2)}" y="20" width="${Math.min(585,x(i)+step/2)-Math.max(55,x(i)-step/2)}" height="205" fill="transparent" data-chart-point="${i}" tabindex="0" role="button" aria-label="${key}: ${p.value} ${unit}, ${new Date(p.time).toLocaleString('vi-VN')}"/>`).join('');
 return `<div class="chart-wrap" data-series="${key}"><svg class="chart" viewBox="0 0 640 265" role="group" aria-label="${key} (${unit}), t\u1ed1i \u0111a 12 \u0111i\u1ec3m">${grid}<polyline fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" points="${points.map((p,i)=>`${x(i)},${y(p.value)}`).join(' ')}"/>${dots}${ticks}${hits}</svg><div class="chart-tooltip" role="status" hidden></div></div>`;
}
function bindChart(root=document) {
 root.querySelectorAll('.chart-wrap[data-series]').forEach(wrap=>{
  const [key,color,unit]=dashboardSeries.find(s=>s[0]===wrap.dataset.series),points=dashboardPoints(key),tip=wrap.querySelector('.chart-tooltip');
  wrap.querySelectorAll('[data-chart-point]').forEach(hit=>{
   const show=()=>{const i=Number(hit.dataset.chartPoint),p=points[i];
    tip.innerHTML=`<strong>${new Date(p.time).toLocaleString('vi-VN')}</strong><div><span class="tt-dot" style="background:${color}"></span>${key}: <b>${p.value.toFixed(key==='Light'?0:1)} ${unit}</b></div>`;
    tip.hidden=false;tip.style.left=`${Math.min(72,Math.max(28,i/Math.max(points.length-1,1)*100))}%`;
   };
   ['mouseenter','focus','click'].forEach(e=>hit.addEventListener(e,show));
   ['mouseleave','blur'].forEach(e=>hit.addEventListener(e,()=>{tip.hidden=true;}));
  });
 });
}
function toggle(label,key) {
 const on=state[key],busy=state.busy;
 return `<div class="switch-row led-card ${busy?'processing':''}"><div class="device"><div class="device-icon led">${icon('bulb')}</div><div><b>${label}</b><small>${busy?'\u0110ang x\u1eed l\u00fd l\u1ec7nh...':on?'\u0110ang b\u1eadt':'\u0110ang t\u1eaft'}</small></div></div><button class="switch ${on?'on':''}" role="switch" aria-label="${label}" aria-checked="${on}" ${busy?'disabled':''} data-toggle="${key}"></button></div>`;
}
function dashboard() {
 const values=[reading.temperature,reading.humidity,reading.light,reading.demo];
 const labels=['Nhi\u1ec7t \u0111\u1ed9','\u0110\u1ed9 \u1ea9m','C\u01b0\u1eddng \u0111\u1ed9 \u00e1nh s\u00e1ng','Latest Data - Demo'];
 const notes=['C\u1ea3m bi\u1ebfn DHT11','\u0110\u1ed9 \u1ea9m m\u00f4i tr\u01b0\u1eddng','LDR / c\u1ea3m bi\u1ebfn \u00e1nh s\u00e1ng','Demo - Database - 3s/update'];
 return head('T\u1ed5ng quan h\u1ec7 th\u1ed1ng','Gi\u00e1m s\u00e1t c\u1ea3m bi\u1ebfn v\u00e0 \u0111i\u1ec1u khi\u1ec3n thi\u1ebft b\u1ecb')+
 `<div class="dashboard-charts">${dashboardSeries.map(s=>`<section class="panel" ${s[0]==='Demo'?'id="dashboardDemoChart"':''}><h2 style="color:${s[1]}">${s[0]} <span class="legend">${s[2]} - ${s[0]==='Demo'?'Demo - Database':'ESP32'}</span></h2>${chart(s)}<p class="hint">${s[0]==='Demo'?'Demo - Database - 3s/update.':'ESP32 - MQTT/WebSocket.'} T\u1ed1i \u0111a 12 \u0111i\u1ec3m; ch\u1ecdn \u0111i\u1ec3m \u0111\u1ec3 xem chi ti\u1ebft.</p></section>`).join('')}</div>
 <div class="dash-grid dashboard-bottom"><section class="cards" aria-label="Th\u00f4ng s\u1ed1 c\u1ea3m bi\u1ebfn"><p class="section-title">Th\u00f4ng s\u1ed1 c\u1ea3m bi\u1ebfn</p>${dashboardSeries.map((s,i)=>`<div class="card"><div class="metric-top"><span class="glyph ${i===1?'warn':i===2?'sun':''}">${icon(s[3])}</span><span class="tag">${i===3?'Demo':'ESP32'}</span></div><div class="metric-label">${labels[i]}</div><div class="metric-value" ${i===3?'id="dashboardDemoLatest" aria-live="polite"':''}>${values[i]} <span class="metric-unit">${s[2]}</span></div><div class="metric-note">${notes[i]}</div></div>`).join('')}</section><section aria-label="\u0110i\u1ec1u khi\u1ec3n thi\u1ebft b\u1ecb"><p class="section-title">\u0110i\u1ec1u khi\u1ec3n thi\u1ebft b\u1ecb</p><div class="led-grid">${toggle('LED1 - GPIO 25','led1')}${toggle('LED2 - GPIO 26','led2')}${toggle('LED3 - GPIO 27','led3')}${toggle('LED4 - GPIO 32','led4')}</div><div class="switch-row all"><b>ALL - 4 LED</b><div><button class="primary" data-all="ON" ${state.busy?'disabled':''}>ALL ON</button> <button class="secondary" data-all="OFF" ${state.busy?'disabled':''}>ALL OFF</button></div></div><p class="hint">LED1/LED2/LED3/LED4: MQTT - SUCCESS/FAILED sau ACK ESP32.</p></section></div>`;
}
async function setLed(key,next) {
 if(state.busy)return;
 if(!['led1','led2','led3','led4','all'].includes(key))return;
 if(key!=='all'&&state[key]===next)return;
 const target=key==='all'?'all':key.slice(3);
 const action=next?'ON':'OFF';
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
  for(const d of response.data){if([1,2,3,4].includes(d.id))state['led'+d.id]=d.state==='ON';}
  toast(result?.status==='SUCCESS'?'Điều khiển thành công':result?.status==='FAILED'?'Lệnh thất bại: '+(result.reason||'ESP32 không phản hồi'):'Chưa nhận được xác nhận từ ESP32');
  if(state.page==='history')loadHistory();
 } catch(e){toast('Điều khiển thất bại: '+e.message);await refreshDashboard();}
 finally {state._waitingCommandId=null;state.busy=false;render();}
}
function bindDashboard() {
 bindChart();
 document.querySelectorAll('[data-all]').forEach(button=>{button.onclick=()=>setLed('all',button.dataset.all==='ON');});
 document.querySelectorAll('[data-toggle]').forEach(button=>{
  button.onclick=()=>{
   const key=button.dataset.toggle;
   if(!['led1','led2','led3','led4'].includes(key))return;
   setLed(key,!state[key]);
  };
 });
}
