'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = __dirname;
const write = (name, data) => fs.writeFileSync(path.join(root, name), JSON.stringify(data, null, 2) + '\n');
const cases = [];
const shape = {
    health: `pm.expect(j).to.have.all.keys('ok','mqttConnected','esp32Online'); pm.expect(j.ok).to.eql(true); ['mqttConnected','esp32Online'].forEach(k => pm.expect(j[k]).to.be.a('boolean'));`,
    esp32: `pm.expect(j).to.have.all.keys('online','lastSeen','timeoutMs','mqttConnected'); pm.expect(j.online).to.be.a('boolean'); pm.expect(j.mqttConnected).to.be.a('boolean'); pm.expect(j.timeoutMs).to.eql(8000); pm.expect(j.lastSeen === null || (typeof j.lastSeen === 'string' && Number.isFinite(Date.parse(j.lastSeen)))).to.eql(true); if(j.online) { pm.expect(j.mqttConnected).to.eql(true); pm.expect(j.lastSeen).to.be.a('string'); }`,
    latest: `pm.expect(j).to.have.all.keys('temperature','humidity','light','demo','measuredAt'); ['temperature','humidity','light','demo'].forEach(k => pm.expect(j[k] === null || typeof j[k] === 'number').to.eql(true)); pm.expect(j.measuredAt === null || Number.isFinite(Date.parse(j.measuredAt))).to.eql(true);`,
    chart: `pm.expect(j).to.be.an('array'); j.forEach(r => { pm.expect(r).to.have.all.keys('id','type','device','value','time'); pm.expect(r.id).to.match(/^SEN-\\d+$/); pm.expect(['Temperature','Humidity','Light','Demo']).to.include(r.type); pm.expect(r.value).to.be.a('string'); pm.expect(Number.isFinite(Date.parse(r.time))).to.eql(true); });`,
    devices: `pm.expect(j).to.have.all.keys('data'); pm.expect(j.data).to.be.an('array'); j.data.forEach(r => { pm.expect(r).to.have.all.keys('id','code','name','state','updatedAt'); pm.expect(r.id).to.be.a('number'); pm.expect(['ON','OFF']).to.include(r.state); pm.expect(Number.isFinite(Date.parse(r.updatedAt))).to.eql(true); });`,
    paging: `pm.expect(j).to.have.all.keys('content','page','size','totalElements','totalPages'); pm.expect(j.content).to.be.an('array'); ['page','size','totalElements','totalPages'].forEach(k => pm.expect(j[k]).to.be.a('number')); pm.expect(j.content.length).to.be.at.most(j.size); pm.expect(j.totalPages).to.eql(Math.ceil(j.totalElements/j.size)); pm.expect(j.page).to.be.at.least(1);`,
    sensorRows: `j.content.forEach(r => { pm.expect(r).to.have.all.keys('id','type','device','value','time'); pm.expect(r.id).to.match(/^SEN-\\d+$/); pm.expect(['Temperature','Humidity','Light','Demo']).to.include(r.type); pm.expect(Number.isFinite(Date.parse(r.time))).to.eql(true); });`,
    actionRows: `j.content.forEach(r => { pm.expect(r).to.have.all.keys('id','device','action','status','time','reason'); pm.expect(r.id).to.match(/^#\\d+$/); pm.expect(['ON','OFF']).to.include(r.action); pm.expect(['PENDING','SUCCESS','FAILED']).to.include(r.status); pm.expect(Number.isFinite(Date.parse(r.time))).to.eql(true); });`,
    action: `pm.expect(j).to.have.all.keys('id','device','action','status','reason'); pm.expect(j.id).to.be.a('number'); pm.expect(['led1','led2','led3','led4','all']).to.include(j.device); pm.expect(['ON','OFF']).to.include(j.action); pm.expect(['PENDING','SUCCESS','FAILED']).to.include(j.status);`
};
function add(folder, id, name, method, url, status, options = {}) {
    cases.push({ folder, id, name, method, url, status, ...options });
}
function get(folder, id, name, url, shapeName, extra = '') {
    add(folder, id, name, 'GET', url, 200, { shape: shapeName, extra });
}
function bad(folder, id, name, url, status = 400, options = {}) {
    add(folder, id, name, options.method || 'GET', url, status, { error: true, ...options });
}
get('Authentication','TC01','Public health without token','/api/health','health');
cases.at(-1).noAuth=true;
add('Authentication','TC02','Login and save access_token','POST','/api/auth/login',200,{
    noAuth:true,guarded:'credentials',raw:'{"username":"{{username}}","password":"{{password}}"}',
    extra:`pm.test('Login returns expiring Bearer JWT',()=>{pm.expect(j.access_token).to.be.a('string');pm.expect(j.access_token.split('.')).to.have.length(3);pm.expect(j.token_type).to.eql('Bearer');pm.expect(j.expires_in).to.be.a('number').and.above(0);}); if(pm.response.code===200&&typeof j.access_token==='string')pm.environment.set('access_token',j.access_token);`
});
bad('Authentication','TC03','Incorrect login is rejected','/api/auth/login',401,{method:'POST',noAuth:true,body:{username:'invalid-account-for-test',password:'intentionally-invalid-test-input'}});
bad('Authentication','TC04','Protected GET without token','/api/devices',401,{noAuth:true});
bad('Authentication','TC05','Protected GET with fake token','/api/devices',401,{bearer:'invalid.jwt.token'});
get('Authentication','TC06','Protected GET with valid token','/api/devices','devices');
bad('Authentication','TC07','Expired correctly signed JWT','/api/devices',401,{bearer:'{{expired_token}}',guarded:'expired'});
bad('Authentication','TC08','Control without JWT; no MQTT publish','/api/devices/1/control',401,{method:'POST',noAuth:true,body:{action:'OFF'}});
bad('Authentication','TC09','Control with fake JWT; no MQTT publish','/api/devices/1/control',401,{method:'POST',bearer:'invalid.jwt.token',body:{action:'OFF'}});
add('Authentication','TC10','Valid JWT control on isolated mock MQTT only','POST','/api/devices/1/control',202,{
    guarded:'mock-only',body:{action:'OFF'},description:'Only runs against the isolated server explicitly authorized by auth-run.cjs. MQTT and DB are fakes; never runs against real LEDs.',
    extra:`pm.test('Control admission is PENDING',()=>{pm.expect(j.status).to.eql('PENDING');pm.expect(j.device).to.eql('led1');pm.expect(j.action).to.eql('OFF');pm.expect(j.id).to.be.a('number');});`
});
for(const [id,name,key] of [['TC11','Reject signed JWT with disallowed algorithm','wrong_algorithm_token'],['TC12','Reject JWT with wrong signature','wrong_signature_token'],['TC13','Reject signed JWT without expiry','no_expiry_token'],['TC14','Reject JWT with wrong issuer','wrong_issuer_token'],['TC15','Reject JWT with wrong audience','wrong_audience_token']]) {
    bad('Authentication',id,name,'/api/devices',401,{bearer:'{{'+key+'}}',guarded:key});
}
get('System', 'SYS01', 'Health / MySQL connectivity', '/api/health', 'health');
get('System', 'SYS02', 'ESP32 and MQTT status', '/api/esp32/status', 'esp32');
add('System', 'SYS03', 'Frontend entry point (not a JSON API)', 'GET', '/', 200, { html: true });
get('Sensors', 'SEN01', 'Latest sensor values', '/api/sensors/latest', 'latest');
get('Sensors', 'SEN02', 'Chart default 12 measurement times', '/api/sensors/chart', 'chart');
for (const limit of [1, 100]) get('Sensors', `SEN_LIMIT_${limit}`, `Chart limit=${limit}`, `/api/sensors/chart?limit=${limit}`, 'chart', `pm.test('Distinct measurement times respect limit', () => pm.expect(Math.max(0,...['Temperature','Humidity','Light','Demo'].map(t=>j.filter(x=>x.type===t).length))).to.be.at.most(${limit}));`);
for (const limit of ['0', '101', '-1', '1.5', 'abc']) bad('Sensors', `SEN_BAD_${limit}`, `Reject chart limit=${limit}`, `/api/sensors/chart?limit=${limit}`);
get('Devices', 'DEV01', 'List devices', '/api/devices', 'devices');
bad('Control', 'CTL01', 'Reject unknown device without publishing', '/api/devices/5/control', 404, { method: 'POST', body: {action: 'ON'} });
bad('Control', 'CTL02', 'Reject unsupported action', '/api/devices/1/control', 400, { method: 'POST', body: {action: 'TOGGLE'} });
bad('Control', 'CTL03', 'Reject missing action', '/api/devices/2/control', 400, { method: 'POST', body: {} });
bad('Control', 'CTL04', 'Reject lowercase action', '/api/devices/all/control', 400, { method: 'POST', body: {action: 'on'} });
bad('Control', 'CTL05', 'Reject null action', '/api/devices/1/control', 400, { method: 'POST', body: {action: null} });
bad('Control', 'CTL06', 'Malformed JSON should be HTTP 400', '/api/devices/1/control', 400, { method: 'POST', raw: '{"action":', knownIssue: 'express.json throws status=400, but middleware only reads err.code; current code returns 500.' });
bad('Control', 'CTL07', 'JSON over 16kb should be HTTP 413', '/api/devices/1/control', 413, { method: 'POST', raw: JSON.stringify({padding: 'x'.repeat(17000)}), knownIssue: 'Body limit is 16kb; current error middleware converts status=413 to 500.' });
add('Control', 'CTL08', 'OPT-IN: dispatch exactly one LED command', 'POST', '/api/devices/{{control_target}}/control', 202, {
    raw: '{"action":"{{control_action}}"}', guarded: 'hardware',
    description: 'May change real LEDs and insert action_history. Requires enable_hardware_tests=true and hardware_confirmation=SEND_ONE_COMMAND. One request only; no retries. target=1|2|3|4|all; action=ON|OFF. HTTP 202/PENDING is admission, not execution success.',
    extra: `pm.test('Admission differs from execution', () => { pm.expect(j.id).to.be.a('number'); pm.expect(['PENDING','FAILED']).to.include(j.status); pm.expect(j.action).to.eql(pm.environment.get('control_action')); if(j.status==='FAILED') pm.expect(j.reason).to.be.a('string'); }); if(pm.response.code===202 && Number.isInteger(j.id)) { pm.collectionVariables.set('command_id',j.id); pm.collectionVariables.set('dispatch_status',j.status); }`
});
add('Control', 'CTL09', 'OPT-IN: poll result of that command, never resend', 'GET', '/api/actions/{{command_id}}', 200, {
    guarded: 'poll', shape: 'action',
    description: 'Only polls the command ID captured by CTL08 in the same run. Bounded polling. FAILED is a completed failure, not SUCCESS. No new control request is sent.',
    extra: `const max=Number(pm.environment.get('poll_max_attempts')||15); const delay=Number(pm.environment.get('poll_interval_ms')||1000); function finish(r) { pm.test('Command reaches terminal status',()=>pm.expect(['SUCCESS','FAILED']).to.include(r.status)); if(r.status==='FAILED') pm.test('FAILED includes reason',()=>pm.expect(r.reason).to.be.a('string').and.not.empty); console.log('COMMAND_TERMINAL',r.id,r.status,r.reason||''); pm.collectionVariables.set('terminal_status',r.status); } function poll(r,n) { if(r.status!=='PENDING'||n>=max) return finish(r); setTimeout(()=>pm.sendRequest({url:pm.environment.get('base_url')+'/api/actions/'+pm.collectionVariables.get('command_id'),method:'GET',header:{Authorization:'Bearer '+pm.environment.get('access_token')}},(err,res)=>{ pm.test('Poll transport and HTTP 200',()=>{pm.expect(err).to.eql(null); pm.expect(res.code).to.eql(200);}); if(!err && res.code===200) poll(res.json(),n+1); }),delay); } poll(j,0);`
});
get('Action History', 'ACT01', 'Action history defaults; capture existing ID', '/api/action-history', 'paging', `${shape.actionRows}\nif(j.content.length) pm.collectionVariables.set('existing_action_id',j.content[0].id.slice(1));`);
get('Action History', 'ACT02', 'Get existing action result', '/api/actions/{{existing_action_id}}', 'action');
cases.at(-1).guarded = 'existing';
bad('Action History', 'ACT03', 'Unknown valid action ID', '/api/actions/{{missing_action_id}}', 404, { guarded: 'missing' });
for (const id of ['0', '-1', 'abc', '1.5', '1000001']) bad('Action History', `ACT_ID_${id}`, `Reject action ID ${id}`, `/api/actions/${id}`);
for (const status of ['PENDING','SUCCESS','FAILED']) get('Action History', `ACT_STATUS_${status}`, `Filter status ${status}`, `/api/action-history?status=${status}&page=1&size=5`, 'paging', `${shape.actionRows}\npm.test('Status filter',()=>j.content.forEach(r=>pm.expect(r.status).to.eql('${status}')));`);
for (const action of ['ON','OFF']) get('Action History', `ACT_ACTION_${action}`, `Filter action ${action}`, `/api/action-history?action=${action}&size=5`, 'paging', `${shape.actionRows}\npm.test('Action filter',()=>j.content.forEach(r=>pm.expect(r.action).to.eql('${action}')));`);
get('Action History','ACT_DATE','Filter action history by Vietnam day','/api/action-history?date={{filter_date}}&page=2&size=5','paging', `${shape.actionRows}\npm.test('Vietnam date filter',()=>j.content.forEach(r=>pm.expect(new Date(Date.parse(r.time)+7*3600000).toISOString().slice(0,10)).to.eql(pm.environment.get('filter_date')))); pm.test('Paging values',()=>{pm.expect(j.page).to.eql(2);pm.expect(j.size).to.eql(5);});`);
for (const [key,value] of [['action','TOGGLE'],['status','unknown'],['page','0'],['size','101'],['date','11-11-2026'],['date','2026-02-30']]) bad('Action History',`ACT_BAD_${key}_${value}`,`Reject ${key}=${value}`,`/api/action-history?${key}=${value}`);
bad('Action History','ACT_DATE_INVALID','Invalid month should be HTTP 400','/api/action-history?date=2026-13-01',400,{knownIssue:'vnDayRange calls toISOString before checking validDate, resulting in HTTP 500.'});
get('Sensor History','HIS01','Sensor history defaults','/api/sensor-data','paging',shape.sensorRows);
for (const type of ['Temperature','Humidity','Light','Demo']) for (const sort of ['asc','desc']) get('Sensor History',`HIS_${type}_${sort}`,`${type}, sort=${sort}`,`/api/sensor-data?type=${type}&sort=${sort}&page=1&size=5`,'paging',`${shape.sensorRows}\npm.test('Type and sort filter',()=>{j.content.forEach(r=>pm.expect(r.type).to.eql('${type}'));for(let i=1;i<j.content.length;i++){const a=j.content[i-1],b=j.content[i]; const sign='${sort}'==='asc'?1:-1; pm.expect(sign*(Date.parse(b.time)-Date.parse(a.time))).to.be.at.least(0);if(a.time===b.time)pm.expect(sign*(Number(b.id.slice(4))-Number(a.id.slice(4)))).to.be.at.least(0);}});`);
get('Sensor History','HIS_DATE','Filter sensor history by Vietnam day','/api/sensor-data?date={{filter_date}}&size=5&page=2','paging',`${shape.sensorRows}\npm.test('Vietnam date filter',()=>j.content.forEach(r=>pm.expect(new Date(Date.parse(r.time)+7*3600000).toISOString().slice(0,10)).to.eql(pm.environment.get('filter_date')))); pm.test('Paging values',()=>{pm.expect(j.page).to.eql(2);pm.expect(j.size).to.eql(5);});`);
for (const [key,value] of [['type','temperature'],['sort','invalid'],['page','0'],['page','1.5'],['page','1000001'],['size','0'],['size','101'],['date','11-11-2026'],['date','2026-02-30']]) bad('Sensor History',`HIS_BAD_${key}_${value}`,`Reject ${key}=${value}`,`/api/sensor-data?${key}=${value}`);
bad('Sensor History','HIS_DATE_INVALID','Invalid month should be HTTP 400','/api/sensor-data?date=2026-13-01',400,{knownIssue:'vnDayRange calls toISOString before checking validDate, resulting in HTTP 500.'});

// Explicit four-LED cases; run individually, waiting for each result before dispatching another.
for (const target of ['1','2','3','4','all']) for (const action of ['ON','OFF']) {
 add('Four LED control', `LED_${target}_${action}`, `${target==='all'?'ALL':'LED'+target} ${action}`, 'POST', `/api/devices/${target}/control`, 202, {
  body:{action}, description:'Real MQTT command. Poll /api/actions/:id until terminal before next request. ALL requires four ACKs.',
  extra:`pm.test('Accepted device',()=>{pm.expect(j.device).to.eql('${target==='all'?'all':'led'+target}');pm.expect(['PENDING','FAILED']).to.include(j.status);});if(j.id)pm.collectionVariables.set('command_id',j.id);`
 });
}

const collection = {
    info: { _postman_id: 'ab5ce92d-49e0-4545-ab6a-d71e87dc8c12', name: 'SensoSynch V12 - Existing Backend API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', description: 'Generated from the existing backend routes only. 9 JSON HTTP APIs plus frontend GET /. Safe default: read-only and rejected input tests; hardware commands require explicit opt-in. Known HTTP error mapping defects are intentionally tested against correct HTTP semantics, not falsely passed. No database resets or deletes.' },
    auth:{type:'bearer',bearer:[{key:'token',value:'{{access_token}}',type:'string'}]},
    variable: [{key:'base_url',value:'http://localhost:3000'}],
    event: [{listen:'prerequest',script:{type:'text/javascript',exec:[
        `if(pm.info.requestName.startsWith('SYS01 ')){ ['command_id','dispatch_status','terminal_status','existing_action_id','missing_action_id'].forEach(k=>pm.collectionVariables.unset(k)); }`
    ]}}],
    item: []
};
function preRequest(c) {
    if(c.guarded==='credentials')return `pm.environment.unset('access_token');if(!pm.environment.get('username')||!pm.environment.get('password')){console.warn('BLOCKED: configure private local username/password');pm.execution.skipRequest();}`;
    if(c.guarded==='mock-only')return `if(pm.environment.get('isolated_mock_server')!=='true'){console.warn('BLOCKED: mock MQTT server required; no real control allowed');pm.execution.skipRequest();}`;
    if(c.guarded==='expired'||c.guarded?.endsWith('_token')) {const key=c.guarded==='expired'?'expired_token':c.guarded;return `if(!pm.environment.get('${key}')){console.warn('BLOCKED: runtime token fixture required');pm.execution.skipRequest();}`;}
    if(c.guarded==='hardware') return `pm.collectionVariables.unset('command_id'); if(pm.environment.get('enable_hardware_tests')!=='true' || pm.environment.get('hardware_confirmation')!=='SEND_ONE_COMMAND' || !['1','2','3','4','all'].includes(pm.environment.get('control_target')) || !['ON','OFF'].includes(pm.environment.get('control_action')) || pm.collectionVariables.get('hardware_dispatched')==='true'){console.warn('BLOCKED: explicit one-command authorization required');pm.execution.skipRequest();} else {pm.collectionVariables.set('hardware_dispatched','true');}`;
    if(c.guarded==='poll') return `if(!pm.collectionVariables.get('command_id')){console.warn('BLOCKED: no command dispatched in this run');pm.execution.skipRequest();}`;
    if(c.guarded==='existing') return `if(!pm.collectionVariables.get('existing_action_id')){console.warn('BLOCKED: no existing history ID');pm.execution.skipRequest();}`;
    if(c.guarded==='missing') return `pm.collectionVariables.unset('missing_action_id'); const base=pm.environment.get('base_url'); function probe(id,n){pm.sendRequest({url:base+'/api/actions/'+id,header:{Authorization:'Bearer '+pm.environment.get('access_token')}},(e,r)=>{if(!e&&r.code===404){pm.collectionVariables.set('missing_action_id',id);}else if(!e&&r.code===200&&n<5){probe(id-1,n+1);}else{console.warn('BLOCKED: cannot establish unused ID');pm.execution.skipRequest();}});}probe(1000000,0);`;
    return '';
}
for(const c of cases) {
    let folder=collection.item.find(f=>f.name===c.folder);
    if(!folder){folder={name:c.folder,item:[]};collection.item.push(folder);}
    const [pathname,queryString]=c.url.split('?');
    const query=(queryString||'').split('&').filter(Boolean).map(p=>{const [key,value]=p.split('=');return {key,value,description:`See API_REFERENCE.md for ${key} validation and defaults.`};});
    const url={raw:'{{base_url}}'+c.url,host:['{{base_url}}'],path:pathname.split('/').filter(Boolean)};
    if(query.length)url.query=query;
    const request={method:c.method,header:[{key:'Accept',value:c.html?'text/html':'application/json'}],url,description:c.description||`${c.name}. Expected HTTP ${c.status}. ${c.knownIssue||'Source: existing src/routes/ and middleware; no hardware command is published by this validation/read request.'}`};
    if(c.noAuth||c.html||c.url==='/api/health')request.auth={type:'noauth'};
    else if(c.bearer)request.auth={type:'bearer',bearer:[{key:'token',value:c.bearer,type:'string'}]};
    if(c.method==='POST') {request.header.push({key:'Content-Type',value:'application/json'});request.body={mode:'raw',raw:c.raw===undefined?JSON.stringify(c.body,null,2):c.raw,options:{raw:{language:'json'}}};}
    const tests=[`pm.test('HTTP ${c.status}',()=>pm.response.to.have.status(${c.status}));`];
    if(c.html) tests.push(`pm.test('HTML response',()=>pm.expect(pm.response.headers.get('Content-Type')).to.include('text/html'));`);
    else {
        tests.push(`pm.test('JSON content type',()=>pm.expect(pm.response.headers.get('Content-Type')).to.include('application/json'));`, `let j; pm.test('Parse JSON',()=>{j=pm.response.json();});`);
        if(c.error) tests.push(`pm.test('Error body',()=>{pm.expect(j).to.have.all.keys('error');pm.expect(j.error).to.be.a('string').and.not.empty;});`);
        if(c.shape) tests.push(`pm.test('Response contract',()=>{${shape[c.shape]}});`);
        if(c.extra) tests.push(c.extra);
    }
    const item={id:crypto.createHash('md5').update(c.id).digest('hex'),name:`${c.id} ${c.name}`,request,event:[],response:[]};
    const pre=preRequest(c); if(pre)item.event.push({listen:'prerequest',script:{type:'text/javascript',exec:pre.split('\n')}});
    if(!request.auth && c.url!=='/api/health') item.event.unshift({listen:'prerequest',script:{type:'text/javascript',exec:[`if(!pm.environment.get('access_token')){console.warn('BLOCKED: login required');pm.execution.skipRequest();}`]}});
    item.event.push({listen:'test',script:{type:'text/javascript',exec:tests.join('\n').split('\n')}});
    folder.item.push(item);
}
collection.info.name='IoT Smart Home API — SensoSynch JWT';
collection.info.description='10 JSON APIs including real bcrypt/JWT login; GET /api/health and POST /api/auth/login are public. All other /api endpoints require backend JWT verification. TC10 is isolated-mock only. No real passwords, tokens or JWT_SECRET in this artifact.';
write('IoT_Smart_Home_API.postman_collection.json',collection);
write('SensoSynch_API.postman_collection.json',collection);
const envPath = path.join(root,'../.env');
const configuration = fs.existsSync(envPath) ? require('../node_modules/dotenv').parse(fs.readFileSync(envPath)) : {};
const port=Number(configuration.PORT||3000);
const timeout=Number(configuration.COMMAND_TIMEOUT_MS||10000);
const values={base_url:`http://localhost:${port}`,username:'',password:'',access_token:'',expired_token:'',wrong_algorithm_token:'',wrong_signature_token:'',no_expiry_token:'',wrong_issuer_token:'',wrong_audience_token:'',isolated_mock_server:'false',enable_hardware_tests:'false',hardware_confirmation:'',control_target:'1',control_action:'OFF',filter_date:'2026-11-11',poll_interval_ms:'1000',poll_max_attempts:String(Math.ceil(timeout/1000)+5)};
write('SensoSynch_Local.postman_environment.json',{id:'030f3208-1427-488f-8eaa-e91393e6f597',name:'SensoSynch Local (safe default)',values:Object.entries(values).map(([key,value])=>({key,value,enabled:true,type:'default'})),_postman_variable_scope:'environment',_postman_exported_using:'SensoSynch test generator'});
const environment=JSON.parse(fs.readFileSync(path.join(root,'SensoSynch_Local.postman_environment.json'),'utf8'));
environment.name='IoT Local — JWT (no saved credentials)';
environment.values.forEach(v=>{if(/password|token/.test(v.key))v.type='secret';});
write('IoT_Local.postman_environment.json',environment);
write('SensoSynch_Local.postman_environment.json',environment);
write('test-cases.json',cases.map(c=>({id:c.id,name:c.name,folder:c.folder,method:c.method,url:c.url,expectedStatus:c.status,guarded:c.guarded||null,knownIssue:c.knownIssue||null})));
console.log(`Generated ${cases.length} cases in ${collection.item.length} folders; local port ${port}.`);
