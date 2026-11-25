'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert/strict');
const results=[];
const calls=[];
let dialog,denyControl=false;
const response=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body});
const form={elements:{username:{value:''},password:{value:''}},button:{disabled:false},error:{textContent:''},querySelector(s){return s==='button'?this.button:this.error;}};
const document={createElement(type){
    if(type!=='dialog')return {};
    dialog={style:{},setAttribute(){},innerHTML:'',querySelector(){return form;},addEventListener(){},showModal(){},close(){},remove(){}};return dialog;
},body:{append(){}},querySelector(){return {append(){}};}};
class Socket {static OPEN=1;constructor(){Socket.last=this;this.readyState=1;this.sent=[];}send(value){this.sent.push(JSON.parse(value));}close(){}}
const sandbox={document,Headers,console,setTimeout,Date,URLSearchParams,WebSocket:Socket,location:{protocol:'http:',host:'localhost:3000',reload(){}},
    fetch:async(url,options={})=>{
        calls.push({url,options});
        if(url==='/api/auth/login'){
            const body=JSON.parse(options.body);
            return body.password==='correct-ephemeral-test-input'?response(200,{access_token:'ephemeral-token-for-frontend-unit-test',expires_in:3600,token_type:'Bearer'}):response(401,{error:'Invalid username or password'});
        }
        if(url.includes('/control'))return denyControl?response(401,{error:'Unauthorized'}):response(202,{id:42,status:'PENDING'});
        return response(200,{data:[]});
    }};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../..','frontend/js/auth.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'../..','frontend/js/api.js'),'utf8')+'\nglobalThis.apiTest=api;globalThis.authTest=authSession;globalThis.connectTest=connectRealtime;',sandbox);
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',reason:e.message});}}
(async()=>{
    await check('Concurrent protected requests share one login dialog',async()=>{
        const first=sandbox.apiTest.devices(),second=sandbox.apiTest.devices();
        assert(dialog);form.elements.username.value='ephemeral-user';form.elements.password.value='incorrect-ephemeral-input';
        await form.onsubmit({preventDefault(){}});assert(form.error.textContent);assert.equal(form.button.disabled,false);
        form.elements.password.value='correct-ephemeral-test-input';await form.onsubmit({preventDefault(){}});await Promise.all([first,second]);
        assert.equal(form.elements.password.value,'');assert.equal(calls.filter(c=>c.url==='/api/auth/login').length,2);
    });
    await check('Protected frontend requests attach Authorization Bearer',async()=>{
        const requests=calls.filter(c=>c.url==='/api/devices');assert.equal(requests.length,2);
        requests.forEach(r=>assert.equal(r.options.headers.get('Authorization'),'Bearer ephemeral-token-for-frontend-unit-test'));
    });
    await check('401 on LED POST clears token and never retries the command',async()=>{
        denyControl=true;await assert.rejects(()=>sandbox.apiTest.control('1','OFF'));
        assert.equal(calls.filter(c=>c.url.includes('/control')).length,1);assert.equal(sandbox.authTest.token,null);
    });
    await check('WebSocket sends auth message after login, without token in URL',async()=>{
        sandbox.authTest.token='ephemeral-token-for-frontend-unit-test';sandbox.authTest.expiresAt=Date.now()+3600000;
        await sandbox.connectTest();await Socket.last.onopen();assert.equal(Socket.last.sent.length,1);
        assert.equal(Socket.last.sent[0].type,'auth');assert.equal(Socket.last.sent[0].access_token,'ephemeral-token-for-frontend-unit-test');
    });
    const report={checkedAt:new Date().toISOString(),scope:'actual frontend api.js in VM with DOM/fetch/WebSocket stubs; not visual browser QA',counts:{total:results.length,pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length},results};
    fs.writeFileSync(path.join(__dirname,'reports/frontend-auth-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.counts.fail)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
