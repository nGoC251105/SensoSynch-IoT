'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const newman=require('newman');
const root=__dirname,reportDir=path.join(root,'reports');
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const collection=()=>read('SensoSynch_Full_API.postman_collection.json');
const flatten=c=>c.item.flatMap(f=>f.item);
const id=i=>i.name.match(/^TC\d+/)[0];
const isControl=i=>i.request.method==='POST'&&i.request.url.raw.includes('/control');
const results=[];
const evidence={hardwarePostsToLive:0,hardwareSafety:null,mockAcks:[]};
const startedAt=new Date().toISOString();
const expectedStatus=i=>isControl(i)?202:['TC03','TC05','TC06'].includes(id(i))?401:200;
const endpoint=i=>i.request.url.raw.replace('{{base_url}}','');
function environment(values){
 const env=read('SensoSynch_Local.postman_environment.json');
 for(const v of env.values)if(v.key in values)v.value=values[v.key];
 return env;
}
async function run(c,values){return new Promise((resolve,reject)=>{
 const mainResponses=new Map();
 const runner=newman.run({collection:c,environment:environment(values),reporters:[],timeoutRequest:5000,timeoutScript:25000},
  (err,summary)=>{if(err)return reject(err);summary.mainResponses=mainResponses;resolve(summary);});
 // Newman reuses execution objects for pm.sendRequest subrequests; capture the main response before it is overwritten.
 runner.on('request',(err,e)=>{
  if(values.__liveScope&&e.request?.method==='POST'&&/\/api\/devices\/(1|2|3|4|all)\/control/.test(e.request.url.toString()))evidence.hardwarePostsToLive++;
  if(e.item?.id&&!mainResponses.has(e.item.id))mainResponses.set(e.item.id,{response:e.response,error:!!err});
 });
});}
function record(scope,c,summary){
 for(const item of flatten(c)){
  const executions=[...new Set(summary.run.executions.filter(e=>e.item.id===item.id))];
  const executed=summary.mainResponses.get(item.id);
  const failures=executions.flatMap(e=>(e.assertions||[]).filter(a=>a.error).map(a=>a.assertion));
  const errors=summary.run.failures.filter(e=>e.source?.id===item.id);
  const status=executed?.response?(failures.length||errors.length||executed.error?'FAIL':'PASS'):executed?.error?'FAIL':'BLOCKED';
  const actual=executed?.response;
  let observed='';
  if(actual&&id(item)!=='TC02')try{
   const j=JSON.parse(actual.stream.toString());
   if(id(item)==='TC07')observed='Stored real sensor fields: '+['temperature','humidity','light'].map(k=>k+'='+(j[k]===null?'null (no sample)':typeof j[k])).join(', ');
   if(id(item)==='TC08')observed='Real DB chart rows='+j.length+'; types='+[...new Set(j.map(r=>r.type))].join(',');
   if(id(item)==='TC09')observed='ESP32 '+(j.online?'ONLINE':'OFFLINE')+'; MQTT '+(j.mqttConnected?'connected':'disconnected');
   if(['TC10','TC11'].includes(id(item)))observed='Real DB page rows='+j.content.length+'; total='+j.totalElements;
   if(isControl(item))observed='Admission='+j.status+'; actual mock command id='+j.id+'; terminal checked by polling assertions';
   if(id(item)==='TC15')observed='Action id='+j.id+'; terminal='+j.status;
  }catch{}
  results.push({scope,id:id(item),name:item.name,method:item.request.method,endpoint:endpoint(item),
   expected:'HTTP '+expectedStatus(item)+(isControl(item)?'; terminal '+(scope==='mock-offline'?'FAILED':'SUCCESS')+' after matching ACK/history verification':''),
   actual:observed||(actual?'HTTP '+actual.code:'No HTTP request sent'),status,httpStatus:actual?.code||null,
   responseTimeMs:actual?.responseTime??null,assertions:executions.flatMap(e=>e.assertions||[]).length,
   reason:status==='FAIL'?(failures.join('; ')||'Transport or script error; sensitive payload omitted'):
    status==='BLOCKED'?(id(item)==='TC15'?'No action id from actual control response; no fabricated id':'Login credentials/token unavailable or request guard skipped'):'Assertions passed'});
 }
}
async function live(){
 const c=collection();
 // Hard filter is independent of exported guards: even an edited request cannot actuate live hardware here.
 for(const f of c.item)f.item=f.item.filter(i=>!isControl(i));
 let credentials={};
 if(process.env.POSTMAN_API_PASSWORD)credentials={username:process.env.POSTMAN_USERNAME||'',api_password:process.env.POSTMAN_API_PASSWORD};
 else{
  const privatePath=path.join(root,'../.auth-login.local.json');
  if(fs.existsSync(privatePath)){
   const saved=JSON.parse(fs.readFileSync(privatePath,'utf8'));
   credentials={username:saved.username,api_password:saved.password};
  }
 }
 const summary=await run(c,{base_url:process.env.POSTMAN_BASE_URL||'http://localhost:3000',...credentials,__liveScope:true});
 record('live-safe',c,summary);
 for(const item of flatten(collection()).filter(isControl))results.push({scope:'live-safe',id:id(item),name:item.name,
  method:'POST',endpoint:endpoint(item),expected:'Manual hardware control, HTTP 202 then matching ACK/history final result',
  actual:'Not sent to real hardware',status:'BLOCKED',httpStatus:null,responseTimeMs:null,assertions:0,
  reason:'Hardware manual-only; automatic runner hard-excludes every LED POST'});
}
async function safety(){
 let requests=0;const sink=http.createServer((req,res)=>{requests++;res.writeHead(500);res.end('{}');});
 await new Promise(r=>sink.listen(0,'127.0.0.1',r));
 try{
  const c=collection();for(const f of c.item)f.item=f.item.filter(isControl);
  const summary=await run(c,{base_url:'http://127.0.0.1:'+sink.address().port,access_token:'non-secret-safety-fixture',
   manual_confirmation:'TC12',control_action:'ON',enable_hardware_tests:'true'});
  evidence.hardwareSafety={status:requests===0&&summary.run.failures.length===0?'PASS':'FAIL',
   requestsReceived:requests,scope:'Real Newman pre-request scripts against local isolated HTTP sink, even with opt-in variables set'};
  if(requests!==0||summary.run.failures.length)throw new Error('Exported hardware guards failed');
 }finally{sink.closeAllConnections();await new Promise(r=>sink.close(r));}
}
async function mock(offline=false){
 // No production DB/MQTT configuration or credentials are imported in this scope.
 const bcrypt=require('../node_modules/bcryptjs');
 const password=crypto.randomBytes(32).toString('base64url');
 const config=require('../src/config/auth')({JWT_SECRET:crypto.randomBytes(64).toString('base64url'),
  AUTH_USERNAME:'isolated-full-suite',AUTH_PASSWORD_HASH:await bcrypt.hash(password,12)});
 const auth=require('../src/services/auth')(config),{createApp,registerApi}=require('../src/app');
 const app=createApp(auth);let context;
 const history=new Map(),devices=[1,2,3,4].map(n=>({id:n,code:'LED'+n,name:'LED '+n,current_state:'OFF',updated_at:'2026-11-26 00:00:00.000'}));
 let sequence=crypto.randomInt(1000,5000),publishes=0;
 const sqlTime=()=>new Date().toISOString().replace('T',' ').replace('Z','');
 const db={async execute(sql,args){
  if(sql.startsWith('INSERT INTO action_history')){
   const commandId=++sequence;
   history.set(commandId,{id:commandId,device:args[0],action:args[1],status:args[2],requested_at:args[3],completed_at:args[4]||null,reason:args[5]||null});
   return [{insertId:commandId}];
  }
  if(sql.startsWith('UPDATE action_history')){
   const row=history.get(args[3]);if(row){row.status=args[0];row.completed_at=args[1];row.reason=args[2];}return [{}];
  }
  if(sql.startsWith('UPDATE devices')){
   const rows=args.length>2?devices.filter(d=>d.id===args[2]):devices;
   rows.forEach(d=>{d.current_state=args[0];d.updated_at=args[1];});return [{}];
  }
  if(sql.includes('COUNT(*) total')&&sql.includes('action_history'))return [[{total:history.size}]];
  if(sql.includes('FROM action_history WHERE id=?'))return [[history.get(args[0])].filter(Boolean)];
  if(sql.includes('FROM action_history'))return [[...history.values()].sort((a,b)=>b.id-a.id)];
  throw new Error('Unexpected isolated SQL');
 },async query(sql){if(sql.includes('FROM devices'))return [devices];throw new Error('Unexpected isolated query');},
 async getConnection(){return {...db,async beginTransaction(){},async commit(){},async rollback(){},release(){}};}};
 const state={mqttReady:!offline,lastSeen:offline?null:new Date().toISOString(),currentCommand:null,offlineApplied:false};
 const client={publish(topic,payload,options,callback){
  publishes++;state.lastSeen=new Date().toISOString();callback();
  const job=JSON.parse(payload),target=topic.split('/').pop(),ids=target==='all'?[1,2,3,4]:[Number(target)];
  setTimeout(async()=>{
   try{
    for(const n of ids){
     await context.onStatus({device:'led'+n,state:job.action,status:'SUCCESS',commandId:job.commandId});
     const after=history.get(job.commandId).status;
     evidence.mockAcks.push({scope:offline?'mock-offline':'mock-online',commandId:job.commandId,device:'led'+n,statusAfterAck:after});
     if(target==='all'&&n<4&&after!=='PENDING')throw new Error('ALL completed before four ACKs');
    }
   }catch{evidence.mockAckError=true;}
  },30);
 }};
 context={app,db,state,client,TIMEOUT:1000,broadcast(){}};
 registerApi(context);require('../src/middleware/error-handler')(app);
 const server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const c=collection();for(const f of c.item)f.item=f.item.filter(i=>(isControl(i)&&(!offline||id(i)==='TC12'))||id(i)==='TC15');
  // Unlock only a transient in-memory copy, restricted to this known isolated HTTP server.
  for(const item of flatten(c))if(isControl(item))item.event[0]={listen:'prerequest',script:{type:'text/javascript',exec:[
   `if(pm.environment.get('base_url')!=='http://127.0.0.1:${server.address().port}')pm.execution.skipRequest();`]}};
  const login=await auth.login(config.username,password);
  const summary=await run(c,{base_url:'http://127.0.0.1:'+server.address().port,access_token:login.access_token,
   control_action:'ON',expected_control_status:offline?'FAILED':'SUCCESS',poll_interval_ms:'100'});
  record(offline?'mock-offline':'mock-online',c,summary);
  evidence[offline?'offlineMockPublishes':'onlineMockPublishes']=publishes;
  if((offline&&publishes!==0)||(!offline&&publishes!==5)||evidence.mockAckError)throw new Error('Mock publish/ACK verification failed');
 }finally{if(state.currentCommand?.timer)clearTimeout(state.currentCommand.timer);server.closeAllConnections();await new Promise(r=>server.close(r));}
}
function save(){
 const counts=scope=>{const list=results.filter(r=>!scope||r.scope===scope);return {total:list.length,pass:list.filter(r=>r.status==='PASS').length,fail:list.filter(r=>r.status==='FAIL').length,blocked:list.filter(r=>r.status==='BLOCKED').length};};
 results.sort((a,b)=>a.scope.localeCompare(b.scope)||Number(a.id.slice(2))-Number(b.id.slice(2)));
 const audit=read('reports/full-source-audit.json');audit.current=Object.fromEntries(Object.keys(audit.baseline).map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'..',p))).digest('hex')]));
 audit.unchanged=Object.keys(audit.baseline).every(p=>audit.baseline[p]===audit.current[p]);
 fs.writeFileSync(path.join(reportDir,'full-source-audit.json'),JSON.stringify(audit,null,2)+'\n');
 const report={startedAt,finishedAt:new Date().toISOString(),timezone:'Asia/Bangkok',counts:counts(),
  liveCounts:counts('live-safe'),mockOnlineCounts:counts('mock-online'),mockOfflineCounts:counts('mock-offline'),evidence,
  unchangedBackendAndOriginalCollections:audit.unchanged,results};
 const serialized=JSON.stringify(report,null,2)+'\n';
 if(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}/.test(serialized))throw new Error('Refusing report containing runtime JWT');
 fs.writeFileSync(path.join(reportDir,'test-results.json'),serialized);
 const escape=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rows=results.map(r=>`<tr><td>${escape(r.scope)}</td><td>${r.id}</td><td>${escape(r.method+' '+r.endpoint)}</td><td>${escape(r.expected)}</td><td>${escape(r.actual)}</td><td class="${r.status}">${r.status}</td><td>${r.httpStatus??'—'}</td><td>${r.responseTimeMs??'—'}</td><td>${escape(r.reason)}</td></tr>`).join('');
 fs.writeFileSync(path.join(reportDir,'test-report.html'),`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>SensoSynch TC01–TC17</title><style>body{font:14px Segoe UI,Arial;color:#24334a;margin:24px;background:#f3f5f8}table{border-collapse:collapse;background:white;width:100%}th,td{border:1px solid #dbe3ed;padding:10px;text-align:left;vertical-align:top}th{background:#eaf0f8}.PASS{color:#147d50}.FAIL{color:#c52e31}.BLOCKED{color:#9a6b16}.scroll{overflow:auto}</style><h1>SensoSynch IoT V12 — TC01–TC17</h1><p>${escape(new Date().toLocaleString('vi-VN',{timeZone:'Asia/Bangkok'}))} (Asia/Bangkok)</p><p>PASS ${report.counts.pass} / FAIL ${report.counts.fail} / BLOCKED ${report.counts.blocked}. Các phạm vi được báo cáo riêng; mock PASS không chứng minh phần cứng thật hoạt động.</p><p>Không gửi lệnh LED thật. Live dùng API/MySQL hiện có; mock chỉ dùng bộ nhớ và adapter MQTT riêng. Không có mật khẩu/token trong báo cáo.</p><div class="scroll"><table><tr><th>Scope</th><th>TC</th><th>API</th><th>Expected</th><th>Actual</th><th>Result</th><th>HTTP</th><th>ms</th><th>Reason</th></tr>${rows}</table></div></html>`);
 const markdownRows=results.map(r=>`| ${r.scope} | ${r.id} | ${r.method} ${r.endpoint} | ${r.expected} | ${r.actual} | ${r.status} | ${r.httpStatus??'—'} | ${r.responseTimeMs??'—'} | ${r.reason} |`).join('\n');
 fs.writeFileSync(path.join(root,'TEST_SUMMARY.md'),`# SensoSynch IoT V12 — báo cáo TC01–TC17\n\nThời gian: ${new Date().toLocaleString('vi-VN',{timeZone:'Asia/Bangkok'})} (Asia/Bangkok).\n\nTổng theo từng phạm vi: PASS ${report.counts.pass}, FAIL ${report.counts.fail}, BLOCKED ${report.counts.blocked}. Live: ${JSON.stringify(report.liveCounts)}. Mock online: ${JSON.stringify(report.mockOnlineCounts)}. Mock offline: ${JSON.stringify(report.mockOfflineCounts)}.\n\n**Mock PASS không phải PASS phần cứng thật.** TC12/13/14/16/17 live bị BLOCKED có chủ đích. TC15 live BLOCKED nếu chưa có id từ response điều khiển thật, không gán id giả.\n\n| Scope | TC | API endpoint | Expected | Actual | Result | HTTP | ms | Nguyên nhân |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${markdownRows}\n\n## Bằng chứng và giới hạn\n\n- Collection v2.1 riêng, giữ nguyên Collection cũ/Examples. TC04/05/06 bản Full lần lượt Valid/Invalid/Missing theo lựa chọn người dùng.\n- Live TC07–TC11 chỉ gọi GET từ backend/MySQL thật, không mock cảm biến, không INSERT/UPDATE/DELETE từ test. Backend khởi động bằng lệnh chuẩn npm start; các tác vụ runtime vốn có (nhận cảm biến, Demo, trạng thái offline) vẫn có thể ghi DB theo logic cũ.\n- TC09 ghi trạng thái quan sát thực tế trong Actual; chỉ quan sát một trạng thái không chứng minh đã kiểm thử cả online lẫn offline vật lý.\n- SUCCESS của mock được xác nhận qua GET action id, GET Action History và trạng thái devices; ALL giữ PENDING sau ACK1/2/3, SUCCESS sau ACK4. Mock offline trả 202 FAILED và ghi lý do; không publish.\n- Safety sink: ${JSON.stringify(evidence.hardwareSafety)}. Mock publishes online=${evidence.onlineMockPublishes}, offline=${evidence.offlineMockPublishes}; real hardware POSTs=${evidence.hardwarePostsToLive}.\n- Backend/routes/services/Auth và hai Collection gốc giữ nguyên SHA-256: ${audit.unchanged?'PASS':'FAIL'} (reports/full-source-audit.json). Không sửa firmware, GPIO, giao diện, cấu hình MQTT hoặc dữ liệu MySQL bằng test.\n- Không lưu Newman raw summary vì chứa body Login/token. Báo cáo chỉ có metadata, thời gian, trạng thái và tên assertion.\n- Không commit/push. Hướng dẫn import/merge và chạy lại: FULL_API_GUIDE.md.\n`);
 console.log(JSON.stringify({counts:report.counts,live:report.liveCounts,mockOnline:report.mockOnlineCounts,mockOffline:report.mockOfflineCounts,unchanged:audit.unchanged,safety:evidence.hardwareSafety}));
 if(report.counts.fail||!audit.unchanged)process.exitCode=1;
}
(async()=>{await live();await safety();await mock();await mock(true);})().catch(()=>{
 results.push({scope:'runner',id:'TC00',name:'Runner infrastructure',method:'—',endpoint:'—',expected:'Complete test execution',actual:'Setup or transport failure; sensitive data omitted',status:'FAIL',httpStatus:null,responseTimeMs:null,assertions:0,reason:'Check local backend/credentials and installed test dependencies'});
 process.exitCode=1;
}).finally(save);
