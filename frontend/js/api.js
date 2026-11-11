const api = {
 async request(url,options={}) {
  const res=await fetch(url,{headers:{'Content-Type':'application/json'},...options});
  let body;try{body=await res.json();}catch{body={};}
  if(!res.ok)throw new Error(body.error||`HTTP ${res.status}`);
  return body;
 },
 latest(){return this.request('/api/sensors/latest');},
 chart(){return this.request('/api/sensors/chart?limit=12');},
 devices(){return this.request('/api/devices');},
 control(target,action){return this.request(`/api/devices/${target}/control`,{method:'POST',body:JSON.stringify({action})});},
 status(){return this.request('/api/esp32/status');},
 actionStatus(id){return this.request('/api/actions/'+encodeURIComponent(id));},
 sensorRows(){const q=new URLSearchParams({type:state.filterType,date:state.sensorDate,sort:state.sensorSort,page:state.sensorPage,size:state.sensorPageSize});return this.request('/api/sensor-data?'+q);},
 logs(){const q=new URLSearchParams({action:state.actionFilter,status:state.statusFilter,date:state.historyDate,page:state.historyPage,size:state.historyPageSize});return this.request('/api/action-history?'+q);}
};
let dataRequestVersion=0, historyRequestVersion=0;
async function loadSensors(){
 const version=++dataRequestVersion;
 try{const result=await api.sensorRows();if(version!==dataRequestVersion)return;
  state.sensorRows=result.content;state.sensorTotal=result.totalElements;if(state.page==='sensors')render();
 }catch(e){toast('Không tải được dữ liệu cảm biến: '+e.message);}
}
async function loadHistory(){
 const version=++historyRequestVersion;
 try{const result=await api.logs();if(version!==historyRequestVersion)return;
  state.logs=result.content;state.historyTotal=result.totalElements;if(state.page==='history')render();
 }catch(e){toast('Không tải được lịch sử: '+e.message);}
}
async function refreshDashboard(){
 try{
  const [latest,chart,deviceList,status]=await Promise.all([api.latest(),api.chart(),api.devices(),api.status()]);
  reading={temperature:latest.temperature??'--',humidity:latest.humidity??'--',light:latest.light??'--'};
  state.chartRows=chart;
  for(const d of deviceList.data){if(d.id===1)state.led1=d.state==='ON';if(d.id===2)state.led2=d.state==='ON';}
  state.online=status.online;state.mqttConnected=status.mqttConnected;
  if(state.page==='dashboard' && !state.busy)render();
 }catch(e){toast('Không tải được Dashboard: '+e.message);}
}
function connectRealtime(){
 const socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');
 socket.onmessage=ev=>{
  let m;try{m=JSON.parse(ev.data);}catch{return;}
  if(m.type==='sensor:update'){
   const d=m.data;
   reading={temperature:d.temperature??reading.temperature,humidity:d.humidity??reading.humidity,light:d.light??reading.light};
   // Đọc lại 12 điểm từ database, không tự tạo mẫu.
   api.chart().then(rows=>{state.chartRows=rows;if(state.page==='dashboard'&&!state.busy)render();}).catch(console.error);
   if(state.page==='sensors')loadSensors();
  }
  if(m.type==='device:update'){
   for(const d of m.data.devices){if(d.id===1)state.led1=d.state==='ON';if(d.id===2)state.led2=d.state==='ON';}
   if(state.page==='dashboard'&&!state.busy)render();
  }
  if(m.type==='action:update'){
   if(state.page==='history')loadHistory();
   if(state._waitingCommandId===m.data.id){
    state._lastCommandResult=m.data;
    window.dispatchEvent(new Event('sensosynch-command-finished'));
   }
  }
  if(m.type==='esp32:status')state.online=m.data.online;
 };
 socket.onclose=()=>{setTimeout(connectRealtime,2000);};
 socket.onerror=()=>socket.close();
}
