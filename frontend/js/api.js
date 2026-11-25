const api = {
 async request(url,options={}) {
  await authSession.ensure();
  const headers=new Headers(options.headers);
  headers.set('Content-Type','application/json');
  headers.set('Authorization','Bearer '+authSession.token);
  const res=await fetch(url,{...options,headers});
  if(res.status===401){authSession.clear();throw new Error('Phi?n ??ng nh?p h?t h?n. Vui l?ng ??ng nh?p l?i.');}
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
  reading={temperature:latest.temperature??'--',humidity:latest.humidity??'--',light:latest.light??'--',demo:latest.demo??'--'};
  state.chartRows=chart;
  for(const d of deviceList.data){if([1,2,3,4].includes(d.id))state['led'+d.id]=d.state==='ON';}
  state.online=status.online;state.mqttConnected=status.mqttConnected;
  if(state.page==='dashboard' && !state.busy)render();
 }catch(e){toast('Không tải được Dashboard: '+e.message);}
}
async function connectRealtime(){
 await authSession.ensure();
 const socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');
 socket.onopen=()=>{socket.send(JSON.stringify({type:'auth',access_token:authSession.token}));};
 socket.onmessage=ev=>{
  let m;try{m=JSON.parse(ev.data);}catch{return;}
  if(m.type==='sensor:update'){
   const d=m.data;
   reading={temperature:d.temperature??reading.temperature,humidity:d.humidity??reading.humidity,light:d.light??reading.light,demo:reading.demo};
   // Đọc lại 12 điểm từ database, không tự tạo mẫu.
   api.chart().then(rows=>{state.chartRows=rows;if(state.page==='dashboard'&&!state.busy)render();}).catch(console.error);
   if(state.page==='sensors')loadSensors();
  }
  if(m.type==='demo:update'){
   reading.demo=m.data.demo;
   if(state.page==='dashboard')api.chart().then(rows=>{state.chartRows=rows;if(state.page==='dashboard'&&!state.busy)render();}).catch(console.error);
   if(state.page==='sensors')loadSensors();
  }
  if(m.type==='device:update'){
   for(const d of m.data.devices){if([1,2,3,4].includes(d.id))state['led'+d.id]=d.state==='ON';}
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
 socket.onclose=event=>{if(event.code===1008)authSession.clear();setTimeout(()=>connectRealtime().catch(console.error),2000);};
 socket.onerror=()=>socket.close();
}
