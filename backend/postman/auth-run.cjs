'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const assert = require('assert/strict');
const bcrypt = require('../node_modules/bcryptjs');
const jwt = require('../node_modules/jsonwebtoken');
const newman = require('newman');
const root = __dirname;
const reports = path.join(root,'reports');
const read = name => JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const manifest=read('test-cases.json');
const results=[];
const startedAt=new Date().toISOString();
const secrets=[];
let liveRuntime;
const redact=value=>secrets.reduce((s,secret)=>secret?s.split(secret).join('[REDACTED]'):s,String(value));
const fixtures=(config)=>{
    const payload={token_use:'access'};
    const options={algorithm:'HS256',issuer:config.issuer,audience:config.audience,subject:config.username};
    const tokens={
        expired_token:jwt.sign({...payload,exp:Math.floor(Date.now()/1000)-60},config.secret,options),
        wrong_algorithm_token:jwt.sign(payload,config.secret,{...options,algorithm:'HS384',expiresIn:3600}),
        wrong_signature_token:jwt.sign(payload,crypto.randomBytes(64),{...options,expiresIn:3600}),
        no_expiry_token:jwt.sign(payload,config.secret,options),
        wrong_issuer_token:jwt.sign(payload,config.secret,{...options,issuer:'wrong-issuer',expiresIn:3600}),
        wrong_audience_token:jwt.sign(payload,config.secret,{...options,audience:'wrong-audience',expiresIn:3600})
    };
    secrets.push(...Object.values(tokens));return tokens;
};
async function runNewman(scope, baseUrl, credentials, config, filter, mockCounters) {
    const collection=read('IoT_Smart_Home_API.postman_collection.json');
    for(const folder of collection.item)folder.item=folder.item.filter(filter);
    const environment=read('IoT_Local.postman_environment.json');
    const values={base_url:baseUrl,username:credentials?.username||'',password:credentials?.password||'',
        isolated_mock_server:scope==='isolated'?'true':'false',...(config?fixtures(config):{})};
    for(const v of environment.values)if(v.key in values)v.value=values[v.key];
    const observed=new Map();let previousPublishes=mockCounters?.publishes.length||0;
    const summary=await new Promise((resolve,reject)=>{
        const run=newman.run({collection,environment,reporters:['cli'],iterationCount:1,timeoutRequest:6000,timeoutScript:8000},
            (err,summary)=>err?reject(err):resolve(summary));
        run.on('request',(_error,event)=>{
            if(mockCounters){const total=mockCounters.publishes.length;observed.set(event.item.name.split(' ')[0],total-previousPublishes);previousPublishes=total;}
        });
    });
    const byId=new Map(summary.run.executions.filter(e=>e.response||e.requestError||e.assertions?.length).map(e=>[e.item.name.split(' ')[0],e]));
    for(const folder of collection.item)for(const item of folder.item){
        const id=item.name.split(' ')[0],c=manifest.find(c=>c.id===id),execution=byId.get(id);
        const failures=(execution?.assertions||[]).filter(a=>a.error&&!a.skipped).map(a=>redact(a.error.message));
        let status=execution?.response?(failures.length?'FAIL':'PASS'):'BLOCKED';
        let reason=execution?.requestError?redact(execution.requestError.code||'HTTP transport error'):!execution?.response?'Required runtime credential/token fixture unavailable or request skipped':failures.join('; ');
        if(scope==='isolated'&&['TC08','TC09'].includes(id)&&observed.get(id)!==0){status='FAIL';reason+=' Unexpected MQTT publish';}
        if(scope==='isolated'&&id==='TC10'&&observed.get(id)!==1){status='FAIL';reason+=' Expected exactly one mock MQTT publish';}
        results.push({scope,id,name:c.name,method:c.method,endpoint:c.url,expectedStatus:c.expectedStatus,
            actualStatus:execution?.response?.code||null,status,reason,
            assertionCount:execution?.assertions?.length||0,
            ...(mockCounters&&observed.has(id)?{mqttPublishes:observed.get(id)}:{})});
    }
    // Do not serialize Newman summary: it contains login password, Authorization headers and token response.
    return summary;
}
async function isolated() {
    const password=crypto.randomBytes(32).toString('base64url');secrets.push(password);
    const config=require('../src/config/auth')({JWT_SECRET:crypto.randomBytes(64).toString('base64url'),AUTH_USERNAME:'isolated-auth-test',AUTH_PASSWORD_HASH:await bcrypt.hash(password,12)});
    secrets.push(config.secret);
    const auth=require('../src/services/auth')(config);
    const {createApp,registerApi}=require('../src/app');
    const app=createApp(auth);
    const counters={publishes:[],writes:[]};
    const db={
        async query(sql){
            if(sql.includes('FROM devices'))return [[{id:1,code:'LED1',name:'LED 1',current_state:'OFF',updated_at:'2026-11-11 00:00:00.000'},{id:2,code:'LED2',name:'LED 2',current_state:'OFF',updated_at:'2026-11-11 00:00:00.000'}]];
            return [[]];
        },
        async execute(sql,args){counters.writes.push({sql,args});return [{insertId:42}];},
        async getConnection(){return {...db,async beginTransaction(){},async commit(){},async rollback(){},release(){}};}
    };
    const state={mqttReady:true,lastSeen:new Date().toISOString(),lastSensor:null,currentCommand:null,offlineApplied:false,offlineTask:null};
    const events=[];
    const context={app,db,state,TIMEOUT:10000,broadcast:(type,data)=>events.push({type,data}),
        client:{publish(topic,payload,options,callback){counters.publishes.push({topic,payload:JSON.parse(payload),options});callback();}}};
    registerApi(context);require('../src/middleware/error-handler')(app);
    const server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    try{
        await runNewman('isolated',`http://127.0.0.1:${server.address().port}`,{username:config.username,password},config,i=>/^TC\d+ /.test(i.name),counters);
        await context.onStatus({device:'led1',state:'OFF',status:'SUCCESS',commandId:42});
        const success=events.some(e=>e.type==='action:update'&&e.data.id===42&&e.data.status==='SUCCESS');
        const row=results.find(r=>r.scope==='isolated'&&r.id==='TC10');
        row.mockAckResult=success?'SUCCESS':'MISSING';
        if(!success){row.status='FAIL';row.reason='Mock ACK did not complete the actual command service';}
        assert.equal(counters.publishes.length,1,'Only TC10 may publish, to mock MQTT only');
        assert.equal(counters.publishes[0].topic,'device/control/1');
        assert.deepEqual(counters.publishes[0].options,{qos:1,retain:false});
    }finally{if(state.currentCommand?.timer)clearTimeout(state.currentCommand.timer);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
async function live() {
    require('../node_modules/dotenv').config({path:path.join(root,'../.env')});
    const baseUrl=process.env.AUTH_TEST_BASE_URL||`http://localhost:${Number(process.env.PORT||3000)}`;
    let password=process.env.AUTH_TEST_PASSWORD;
    let env=require('../node_modules/dotenv').parse(fs.readFileSync(path.join(root,'../.env'),'utf8'));
    if(!env.AUTH_PASSWORD_HASH){
        password=crypto.randomBytes(32).toString('base64url');
        await require('../scripts/configure-auth.cjs')({password});
        env=require('../node_modules/dotenv').parse(fs.readFileSync(path.join(root,'../.env'),'utf8'));
    }
    if(password)secrets.push(password);
    let reachable=false;
    try{await fetch(baseUrl+'/api/health',{signal:AbortSignal.timeout(2000)});reachable=true;}catch{}
    if(!reachable&&process.argv.includes('--start-local')){
        let conn;
        try{
            conn=await require('../node_modules/mysql2/promise').createConnection({host:env.DB_HOST||'127.0.0.1',port:Number(env.DB_PORT||3306),user:env.DB_USER||'root',password:env.DB_PASSWORD||'',database:env.DB_NAME||'sensosynch',connectTimeout:4000});
            const [[row]]=await conn.query("SELECT COUNT(*) total FROM action_history WHERE status='PENDING'");
            if(row.total)throw new Error('Refusing startup: existing PENDING records would be marked FAILED');
        }finally{if(conn)await conn.end();}
        // The production bootstrap and services are used; no alternate auth path or bypass flag exists.
        require('../node_modules/dotenv').config({path:path.join(root,'../.env'),override:true});
        liveRuntime=require('../server');
        for(let i=0;i<50;i++){
            try{const r=await fetch(baseUrl+'/api/health',{signal:AbortSignal.timeout(1000)});if(r.ok){reachable=true;break;}}catch{}
            await new Promise(resolve=>setTimeout(resolve,100));
        }
    }
    let config;
    try{config=require('../src/config/auth')(env);secrets.push(config.secret);}catch{}
    await runNewman('live',baseUrl,password?{username:env.AUTH_USERNAME,password}:null,config,
        i=>!/^CTL0[89] /.test(i.name)&&!/^TC10 /.test(i.name));
    results.push({scope:'live',id:'TC10',name:'Real hardware actuation intentionally blocked',method:'POST',endpoint:'/api/devices/1/control',expectedStatus:202,actualStatus:null,status:'BLOCKED',reason:'TC10 executed on isolated server with mock MQTT/DB; no authenticated real LED control sent.'});
}
function report() {
    const counts={total:results.length,pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length,blocked:results.filter(r=>r.status==='BLOCKED').length};
    const authCounts={total:results.filter(r=>/^TC\d+$/.test(r.id)).length,pass:results.filter(r=>/^TC\d+$/.test(r.id)&&r.status==='PASS').length,fail:results.filter(r=>/^TC\d+$/.test(r.id)&&r.status==='FAIL').length,blocked:results.filter(r=>/^TC\d+$/.test(r.id)&&r.status==='BLOCKED').length};
    const json={startedAt,finishedAt:new Date().toISOString(),counts,authCounts,policy:{public:['GET /api/health','POST /api/auth/login'],protected:'All remaining /api endpoints',websocket:'First auth message with valid JWT, no telemetry before auth; disconnect at expiry',algorithm:'HS256',passwordHash:'bcrypt cost 12',roleBasedAccess:false},results};
    fs.mkdirSync(reports,{recursive:true});
    fs.writeFileSync(path.join(reports,'auth-test-results.json'),JSON.stringify(json,null,2)+'\n');
    const rows=results.map(r=>`| ${r.scope} | ${r.id} | ${r.method} ${r.endpoint} | ${r.expectedStatus} | ${r.actualStatus??'—'} | ${r.status} | ${(r.reason||'Assertions passed').replaceAll('|','/')} ${r.mqttPublishes===undefined?'':`MQTT publish=${r.mqttPublishes} (mock).`} |`).join('\n');
    fs.writeFileSync(path.join(root,'AUTH_TEST_REPORT.md'),`# JWT Authentication — kết quả chạy thật\n\nThời gian UTC: ${startedAt} → ${json.finishedAt}. Tổng ${counts.total}: PASS ${counts.pass}, FAIL ${counts.fail}, BLOCKED ${counts.blocked}. Các ca TCxx: ${authCounts.total}, PASS ${authCounts.pass}, FAIL ${authCounts.fail}, BLOCKED ${authCounts.blocked}.\n\n## Backend xác thực thực sự\n\nMiddleware bắt buộc tại /api trước JSON parser và trước route. Health/login public; mọi API trạng thái, cảm biến, lịch sử, điều khiển cần JWT. Kiểm tra chữ ký HS256, issuer, audience, exp, iat, subject, token_use. Không có cờ tắt auth. Mật khẩu bcrypt cost 12; .env chỉ lưu hash và JWT_SECRET, không lưu plaintext. Chưa triển khai roles nên không có nhánh 403 giả định. WebSocket cần auth message và bị đóng khi token hết hạn.\n\n## Kết quả\n\n| Phạm vi | Case | Endpoint | Expected HTTP | Actual HTTP | Trạng thái | Ghi chú |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows}\n\n## Giới hạn và bằng chứng\n\n- isolated chạy HTTP thật qua cùng createApp/registerApi/middleware/service như production; chỉ DB và MQTT là mock. TC08/TC09 kiểm tra publish bằng 0, TC10 đúng một mock publish và ACK đi qua command service kết thúc SUCCESS. Không coi đây là bằng chứng phần cứng thật đã đổi trạng thái.\n- live dùng MySQL/MQTT cấu hình hiện có; không gửi POST LED hợp lệ. TC10 live BLOCKED có chủ đích. Các lỗi 500 cũ của parser/date nếu vẫn có được giữ FAIL, không sửa ngoài phạm vi Auth.\n- JSON báo cáo chỉ chứa metadata và kết quả, không serialize Newman request/response/environment vì có thông tin đăng nhập và JWT. Token hết hạn fixture có chữ ký đúng, exp trong quá khứ; không có test-only endpoint hay bypass ở backend.\n- Tài khoản cấu hình tự động (nếu trước đó chưa có) dùng mật khẩu ngẫu nhiên 256 bit chỉ nằm trong bộ nhớ lúc kiểm thử; .env lưu bcrypt hash. Dùng configure-auth.cjs để thiết lập mật khẩu riêng sau khi nhận bàn giao.\n- File JSON Collection/Environment công khai chỉ có biến rỗng/placeholder. Không tự commit/push.\n`);
    console.log(JSON.stringify({counts,authCounts},null,2));
    process.exitCode=counts.fail?1:counts.blocked?2:0;
}
(async()=>{await isolated();if(!process.argv.includes('--isolated-only'))await live();report();})()
    .catch(error=>{results.push({scope:'runner',id:'SETUP',status:'BLOCKED',reason:redact(error.message)});report();process.exitCode=1;})
    .finally(async()=>{
        if(liveRuntime){clearInterval(liveRuntime.mqttInterval);liveRuntime.client.end(true);await liveRuntime.db.end();liveRuntime.server.closeAllConnections();liveRuntime.server.close();}
    });
