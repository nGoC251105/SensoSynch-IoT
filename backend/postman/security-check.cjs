'use strict';

const fs=require('fs');
const path=require('path');
const http=require('http');
const crypto=require('crypto');
const jwt=require('../node_modules/jsonwebtoken');
const bcrypt=require('../node_modules/bcryptjs');
const WebSocket=require('../node_modules/ws');
const {createApp,registerApi}=require('../src/app');
const results=[];
const endpoints=[['GET','/api/sensors/latest'],['GET','/api/sensors/chart'],['GET','/api/devices'],['GET','/api/esp32/status'],['GET','/api/sensor-data'],['GET','/api/action-history'],['GET','/api/actions/1'],['POST','/api/devices/1/control']];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});}catch(error){results.push({name,status:'FAIL',reason:error.message});}}
const assert=require('assert/strict');
(async()=>{
    const config=require('../src/config/auth')({JWT_SECRET:crypto.randomBytes(64).toString('base64url'),AUTH_USERNAME:'matrix-auth-test',AUTH_PASSWORD_HASH:await bcrypt.hash(crypto.randomBytes(32).toString('hex'),12)});
    const auth=require('../src/services/auth')(config);
    let dbCalls=0,publishes=0;
    const app=createApp(auth);
    const context={app,state:{mqttReady:true,lastSeen:new Date().toISOString()},TIMEOUT:10000,
        db:{async query(){dbCalls++;return [[]];},async execute(){dbCalls++;return [{}];}},
        client:{publish(){publishes++;}},broadcast(){}};
    registerApi(context);
    const server=http.createServer(app);
    const broadcast=require('../src/realtime/websocket')(server,auth);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    try{
        for(const [method,endpoint] of endpoints)for(const kind of ['missing','fake']){
            await check(`${method} ${endpoint} rejects ${kind} JWT before DB/MQTT`,async()=>{
                const before=dbCalls;
                const response=await fetch(base+endpoint,{method,headers:{'Content-Type':'application/json',...(kind==='fake'?{Authorization:'Bearer invalid.jwt.token'}:{})},...(method==='POST'?{body:JSON.stringify({action:'OFF'})}:{})});
                assert.equal(response.status,401);assert.equal(dbCalls,before);assert.equal(publishes,0);
            });
        }
        await check('Protected malformed POST without token is still 401',async()=>{
            const r=await fetch(base+'/api/devices/1/control',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":'});assert.equal(r.status,401);assert.equal(publishes,0);
        });
        await check('Unsigned alg=none token rejected',async()=>{
            const token=jwt.sign({token_use:'access'},null,{algorithm:'none',expiresIn:60,subject:config.username,issuer:config.issuer,audience:config.audience});
            const r=await fetch(base+'/api/devices',{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,401);
        });
        await check('Missing JWT_SECRET fails closed',async()=>{assert.throws(()=>require('../src/config/auth')({}));});
        const wsBase=base.replace('http:','ws:')+'/ws';
        await check('Unauthenticated WebSocket receives no telemetry',async()=>{
            const peer=new WebSocket(wsBase);const messages=[];peer.on('message',data=>messages.push(data.toString()));
            await new Promise((resolve,reject)=>{peer.once('open',resolve);peer.once('error',reject);});
            broadcast('sensor:update',{temperature:20});await pause(40);assert.equal(messages.length,0);peer.close();
        });
        await check('Fake WebSocket JWT closes with 1008',async()=>{
            const peer=new WebSocket(wsBase);const closed=new Promise(resolve=>peer.once('close',code=>resolve(code)));
            await new Promise((resolve,reject)=>{peer.once('open',resolve);peer.once('error',reject);});peer.send(JSON.stringify({type:'auth',access_token:'invalid.jwt.token'}));assert.equal(await closed,1008);
        });
        await check('WebSocket accepts valid JWT and closes at expiry',async()=>{
            const token=jwt.sign({token_use:'access'},config.secret,{algorithm:'HS256',expiresIn:2,subject:config.username,issuer:config.issuer,audience:config.audience});
            const peer=new WebSocket(wsBase);const messages=[];peer.on('message',raw=>messages.push(JSON.parse(raw.toString())));
            const closed=new Promise(resolve=>peer.once('close',code=>resolve(code)));
            await new Promise((resolve,reject)=>{peer.once('open',resolve);peer.once('error',reject);});peer.send(JSON.stringify({type:'auth',access_token:token}));
            for(let i=0;i<30&&!messages.some(m=>m.type==='auth:ready');i++)await pause(10);
            assert(messages.some(m=>m.type==='auth:ready'));broadcast('sensor:update',{temperature:20});await pause(30);assert(messages.some(m=>m.type==='sensor:update'));
            assert.equal(await Promise.race([closed,pause(4000).then(()=>{peer.terminate();throw Error('WebSocket expiry timeout');})]),1008);
        });
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    const report={checkedAt:new Date().toISOString(),scope:'isolated actual HTTP/middleware/WebSocket with mock DB/MQTT',counts:{total:results.length,pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length},results};
    fs.writeFileSync(path.join(__dirname,'reports/security-check-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.counts.fail)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
