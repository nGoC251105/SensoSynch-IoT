'use strict';
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const root=__dirname;
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const write=(n,v)=>fs.writeFileSync(path.join(root,n),JSON.stringify(v,null,2)+'\n');
const source=read('IoT_Smart_Home_API.postman_collection.json');
const oldItems=source.item.flatMap(f=>f.item);
const clone=v=>JSON.parse(JSON.stringify(v));
const event=(listen,code)=>({listen,script:{type:'text/javascript',exec:code.trim().split('\n')}});
const protectedPre=`if(!pm.environment.get('access_token')){pm.variables.set('blocked_'+pm.info.requestName.split(' ')[0],'Login required');pm.execution.skipRequest();}`;
const tests=(status,code)=>event('test',`
pm.test('HTTP ${status}',()=>pm.response.to.have.status(${status}));
pm.test('JSON response',()=>pm.expect(pm.response.headers.get('Content-Type')).to.include('application/json'));
let j;pm.test('Parse JSON',()=>{j=pm.response.json();});
${code}`);
const url=raw=>({raw:'{{base_url}}'+raw,host:['{{base_url}}'],path:raw.split('?')[0].slice(1).split('/'),
 ...(raw.includes('?')?{query:[...new URLSearchParams(raw.split('?')[1])].map(([key,value])=>({key,value}))}:{})});
function request(id,name,method,endpoint,code,description){return {id:crypto.randomUUID(),name:id+' - '+name,
 request:{method,url:url(endpoint),header:[{key:'Accept',value:'application/json'}],description},
 event:[event('prerequest',protectedPre),tests(200,code)],response:[]};}
// New collection; originals and their saved Examples are never overwritten.
const sourceMap=[1,2,3,6,5,4];
const titles=['Health Check','Login Success','Login Invalid Credentials','Valid JWT','Invalid JWT','Missing JWT'];
const initial=sourceMap.map((n,i)=>{
 const item=clone(oldItems.find(v=>v.name.startsWith('TC'+String(n).padStart(2,'0')+' ')));
 item.id=crypto.randomUUID();item.name='TC'+String(i+1).padStart(2,'0')+' - '+titles[i];
 if(i===1){item.request.body.raw=item.request.body.raw.replace('{{password}}','{{api_password}}');
  item.event.find(e=>e.listen==='prerequest').script.exec=item.event.find(e=>e.listen==='prerequest').script.exec.map(s=>s.replace(/get\('password'\)/g,"get('api_password')").replace('username/password','username/api_password'));}
 return item;
});
initial[0].event.unshift(event('prerequest',`['action_id','action_id_source','last_control_target','last_control_action','last_control_status'].forEach(k=>pm.environment.unset(k));`));
const latest=request('TC07','Get Latest Sensor Data','GET','/api/sensors/latest',`
pm.test('Latest sensor fields and ADC range',()=>{
 pm.expect(j).to.have.all.keys('temperature','humidity','light','demo','measuredAt');
 [['temperature',-40,80],['humidity',0,100],['light',0,4095],['demo',0,100]].forEach(([key,min,max])=>{
  pm.expect(j[key]===null||(typeof j[key]==='number'&&Number.isFinite(j[key])&&j[key]>=min&&j[key]<=max)).to.eql(true);
 });
 pm.expect(j.measuredAt===null||Number.isFinite(Date.parse(j.measuredAt))).to.eql(true);
});`, 'Real latest MySQL rows. Null means no stored sample; it does not mean zero or fresh ESP32 data. Light remains ADC.');
const rowContract=`pm.expect(r).to.have.all.keys('id','type','device','value','time');
pm.expect(r.id).to.match(/^SEN-\\d+$/);pm.expect(['Temperature','Humidity','Light','Demo']).to.include(r.type);
pm.expect(r.device).to.be.a('string');pm.expect(r.value).to.be.a('string');pm.expect(Number.isFinite(Date.parse(r.time))).to.eql(true);
const units={Temperature:'°C',Humidity:'%',Light:'ADC',Demo:'%'};
const limits={Temperature:[-40,80],Humidity:[0,100],Light:[0,4095],Demo:[0,100]};
const n=Number(r.value.slice(0,-units[r.type].length).trim());
pm.expect(r.value.endsWith(' '+units[r.type])).to.eql(true);pm.expect(Number.isFinite(n)).to.eql(true);
pm.expect(n).to.be.within(...limits[r.type]);`;
const chart=request('TC08','Get Chart Data','GET','/api/sensors/chart?limit=12',`
pm.test('Chart array, sensor units and at most 12 rows per series',()=>{
 pm.expect(j).to.be.an('array');const counts={};j.forEach(r=>{${rowContract}counts[r.type]=(counts[r.type]||0)+1;});
 Object.values(counts).forEach(n=>pm.expect(n).to.be.at.most(12));
 for(let i=1;i<j.length;i++)pm.expect(Date.parse(j[i].time)).to.be.at.most(Date.parse(j[i-1].time));
});`, 'limit=1..100, default 12 PER SERIES. Response is an array; value includes unit, not separate temperature/humidity/light properties.');
const status=request('TC09','Get ESP32 Connection','GET','/api/esp32/status',`
pm.test('Distinguish online and offline',()=>{
 pm.expect(j).to.have.all.keys('online','lastSeen','timeoutMs','mqttConnected');
 pm.expect(j.online).to.be.a('boolean');pm.expect(j.mqttConnected).to.be.a('boolean');pm.expect(j.timeoutMs).to.eql(8000);
 pm.expect(j.lastSeen===null||Number.isFinite(Date.parse(j.lastSeen))).to.eql(true);
 if(j.online){pm.expect(j.mqttConnected).to.eql(true);pm.expect(j.lastSeen).to.be.a('string');}
 pm.environment.set('observed_esp32_status',j.online?'ONLINE':'OFFLINE');
});`, 'online requires MQTT and a sensor packet within 8000ms. Offline is a valid HTTP 200, never inferred from historic sensor rows.');
const paging=`pm.expect(j).to.have.all.keys('content','page','size','totalElements','totalPages');pm.expect(j.content).to.be.an('array');
['page','size','totalElements','totalPages'].forEach(k=>pm.expect(Number.isInteger(j[k])).to.eql(true));
pm.expect(j.page).to.eql(1);pm.expect(j.size).to.eql(10);pm.expect(j.content.length).to.be.at.most(j.size);
pm.expect(j.totalPages).to.eql(Math.ceil(j.totalElements/j.size));`;
const sensorHistory=request('TC10','Get Sensor History','GET','/api/sensor-data?type=all&sort=desc&page=1&size=10',`
pm.test('Sensor history paging and real row structure',()=>{${paging}j.content.forEach(r=>{${rowContract}});});`,
 'Queries: type=all|Temperature|Humidity|Light|Demo, sort=asc|desc, page>=1, size=1..100, optional date=YYYY-MM-DD (UTC+7 day). Empty content is valid; not proof of live sensing.');
const actionHistory=request('TC11','Get Action History','GET','/api/action-history?action=all&status=all&page=1&size=10',`
pm.test('Action history fields and terminal states',()=>{${paging}
 j.content.forEach(r=>{pm.expect(r).to.have.all.keys('id','device','action','status','time','reason');
 pm.expect(r.id).to.match(/^#\\d+$/);pm.expect(r.device).to.be.a('string');pm.expect(['ON','OFF']).to.include(r.action);
 pm.expect(['PENDING','SUCCESS','FAILED']).to.include(r.status);pm.expect(Number.isFinite(Date.parse(r.time))).to.eql(true);
 pm.expect(r.reason===null||typeof r.reason==='string').to.eql(true);});
});`, 'Queries action=all|ON|OFF, status=all|PENDING|SUCCESS|FAILED, page, size and optional date. Read only.');
const controls=[];
for(const [id,target,gpio] of [['TC12','1','25'],['TC13','2','26'],['TC14','all','25/26/27/32'],['TC16','3','27'],['TC17','4','32']]){
 const item=request(id,'Control '+(target==='all'?'ALL 4 LEDs':'LED'+target),'POST','/api/devices/'+target+'/control','',
  `MANUAL ONLY. GPIO ${gpio}. Default locked: Collection Runner must not actuate hardware. To manually Send ONE request, change hardwareRequestLocked to false in its pre-request script and set manual_confirmation=${id}, control_action=ON or OFF. Restore true afterwards. HTTP 202 is admission, not SUCCESS. Poll actual action id and verify final history/device state.`);
 item.request.header.push({key:'Content-Type',value:'application/json'});
 item.request.body={mode:'raw',raw:'{"action":"{{control_action}}"}',options:{raw:{language:'json'}}};
 item.event=[event('prerequest',`
const hardwareRequestLocked = true;
if(hardwareRequestLocked){pm.variables.set('blocked_${id}','Hardware request locked; manual Send only');pm.execution.skipRequest();}
if(pm.environment.get('manual_confirmation')!=='${id}'){
 pm.variables.set('blocked_${id}','Set manual_confirmation=${id} for one deliberate Send');pm.execution.skipRequest();
}
pm.environment.unset('manual_confirmation');
if(!['ON','OFF'].includes(pm.environment.get('control_action'))){pm.variables.set('blocked_${id}','Choose control_action ON or OFF');pm.execution.skipRequest();}
['action_id','action_id_source','last_control_target','last_control_action','last_control_status'].forEach(k=>pm.environment.unset(k));
${protectedPre}`),tests(202,`
pm.test('202 command admitted, not proof of LED success',()=>{
 pm.expect(j.id).to.be.a('number').and.above(0);pm.expect(j.device).to.eql('${target==='all'?'all':'led'+target}');
 pm.expect(j.action).to.eql(pm.environment.get('control_action'));pm.expect(['PENDING','FAILED']).to.include(j.status);
});
if(pm.response.code===202&&Number.isInteger(j.id)&&j.id>0){
 pm.environment.set('action_id',String(j.id));pm.environment.set('action_id_source','POST /api/devices/${target}/control response');
 pm.environment.set('last_control_target','${target}');pm.environment.set('last_control_action',j.action);
 const base=pm.environment.get('base_url'),auth={key:'Authorization',value:'Bearer '+pm.environment.get('access_token')};
 const expected=pm.environment.get('expected_control_status')||'SUCCESS';
 const interval=Math.min(2000,Math.max(100,Number(pm.environment.get('poll_interval_ms'))||500));
 const max=30;
 function poll(attempt){pm.sendRequest({url:base+'/api/actions/'+encodeURIComponent(j.id),method:'GET',header:[auth]},(error,response)=>{
  pm.test('Action polling HTTP 200',()=>{pm.expect(error).to.eql(null);pm.expect(response.code).to.eql(200);});
  if(error||!response||response.code!==200)return;
  const result=response.json();
  pm.test('Poll id/state matches command',()=>{pm.expect(result.id).to.eql(j.id);pm.expect(result.device).to.eql(j.device);pm.expect(result.action).to.eql(j.action);pm.expect(['PENDING','SUCCESS','FAILED']).to.include(result.status);});
  if(result.status==='PENDING'&&attempt<max){setTimeout(()=>poll(attempt+1),interval);return;}
  pm.test('Final result (202 alone cannot pass)',()=>{pm.expect(['SUCCESS','FAILED']).to.include(result.status);pm.expect(result.status).to.eql(expected);if(result.status==='FAILED')pm.expect(result.reason).to.be.a('string').and.not.empty;});
  pm.environment.set('last_control_status',result.status);
  pm.sendRequest({url:base+'/api/action-history?page=1&size=100',method:'GET',header:[auth]},(err,history)=>{
   pm.test('Final Action History record matches',()=>{pm.expect(err).to.eql(null);pm.expect(history.code).to.eql(200);const row=history.json().content.find(r=>r.id==='#'+j.id);pm.expect(row,'record by command id').to.exist;pm.expect(row.status).to.eql(result.status);pm.expect(row.action).to.eql(j.action);pm.expect(row.reason).to.eql(result.reason);});
  });
  if(result.status==='SUCCESS')pm.sendRequest({url:base+'/api/devices',method:'GET',header:[auth]},(err,devices)=>{
   pm.test('ACK-confirmed device states match command',()=>{pm.expect(err).to.eql(null);pm.expect(devices.code).to.eql(200);const ids='${target}'==='all'?[1,2,3,4]:[Number('${target}')];const rows=devices.json().data;ids.forEach(id=>{const d=rows.find(r=>r.id===id);pm.expect(d).to.exist;pm.expect(d.state).to.eql(j.action);});});
  });
 });}poll(1);
}`)];
 controls.push(item);
}
const action=request('TC15','Get Action by ID','GET','/api/actions/{{action_id}}',`
pm.test('Action comes from actual control response',()=>{
 pm.expect(j).to.have.all.keys('id','device','action','status','reason');
 pm.expect(j.id).to.eql(Number(pm.environment.get('action_id')));
 pm.expect(j.device).to.eql(pm.environment.get('last_control_target')==='all'?'all':'led'+pm.environment.get('last_control_target'));
 pm.expect(j.action).to.eql(pm.environment.get('last_control_action'));pm.expect(['PENDING','SUCCESS','FAILED']).to.include(j.status);
 if(pm.environment.get('last_control_status'))pm.expect(j.status).to.eql(pm.environment.get('last_control_status'));
 if(j.status==='FAILED')pm.expect(j.reason).to.be.a('string').and.not.empty;
});`, 'Read only. action_id is assigned ONLY by an actual control HTTP response, not a hardcoded id or an invented history id. BLOCKED in safe run without prior command. After control polling, verifies the final result.');
action.event[0]=event('prerequest',`
${protectedPre}
const actionId=Number(pm.environment.get('action_id'));
const sources=['1','2','3','4','all'].map(n=>'POST /api/devices/'+n+'/control response');
if(!Number.isInteger(actionId)||actionId<1||!sources.includes(pm.environment.get('action_id_source'))){
 pm.variables.set('blocked_TC15','No action_id from a control response; no fabricated id');pm.execution.skipRequest();
}`);
const hardware=[...controls.slice(0,3),action,...controls.slice(3)];
const collection={info:{_postman_id:'a84325d3-b398-4b4a-a385-a0d1bc7fc117',name:'IoT Smart Home API - SensoSynch Full TC01-TC17',
 schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',description:'Separate Full edition; originals/Examples preserved. TC04 Valid, TC05 Invalid, TC06 Missing per user. All real hardware POSTs locked by default. TC15 is read-only but kept between TC14 and TC16 to preserve numerical order and actual action-id dependency. Do not export private environment values.'},
 auth:clone(source.auth),variable:[{key:'base_url',value:'http://localhost:3000'}],item:[
 {name:'System',item:[initial[0]]},{name:'Authentication',item:initial.slice(1)},
 {name:'Sensor Data',item:[latest,chart]},{name:'Device Status',item:[status]},
 {name:'History',item:[sensorHistory,actionHistory]},
 {name:'Hardware Control - Manual',description:'TC12/13/14/16/17 are locked; TC15 is a read-only dependent result lookup. Use Send for deliberate control, never full Runner with an unlocked request.',item:hardware}]};
write('SensoSynch_Full_API.postman_collection.json',collection);
// Extend both compatible environments without losing existing variables. All secrets remain empty.
const environment=read('SensoSynch_Local.postman_environment.json');
const additions={api_password:'',action_id:'',action_id_source:'',last_control_target:'',last_control_action:'',last_control_status:'',manual_confirmation:'',control_action:'OFF',expected_control_status:'SUCCESS',poll_interval_ms:'500'};
for(const [key,value]of Object.entries(additions))if(!environment.values.some(v=>v.key===key))environment.values.push({key,value,type:key==='api_password'?'secret':'default',enabled:true});
for(const v of environment.values)if(/password|token/i.test(v.key))v.value='';
write('SensoSynch_Local.postman_environment.json',environment);write('IoT_Local.postman_environment.json',environment);
console.log('Generated separate Full collection: TC01-TC17 in order, six folders, hardware locked, no credentials exported.');
