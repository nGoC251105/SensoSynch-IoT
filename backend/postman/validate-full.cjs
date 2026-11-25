'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),Ajv=require('ajv');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,n),'utf8'));
const ajv=new Ajv({schemaId:'auto',allErrors:true});
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
const validate=ajv.compile(read('schemas/collection-v2.1.0.json'));
const c=read('SensoSynch_Full_API.postman_collection.json');
assert(validate(c),JSON.stringify(validate.errors));
const items=c.item.flatMap(f=>f.item);
assert.deepEqual(c.item.map(f=>f.name),['System','Authentication','Sensor Data','Device Status','History','Hardware Control - Manual']);
assert.deepEqual(items.map(i=>i.name.match(/^TC\d+/)[0]),Array.from({length:17},(_,i)=>'TC'+String(i+1).padStart(2,'0')));
const routes=[];
for(const f of fs.readdirSync(path.join(__dirname,'../src/routes'))){
 const s=fs.readFileSync(path.join(__dirname,'../src/routes',f),'utf8');
 for(const m of s.matchAll(/app\.(get|post)\('([^']+)'/g))routes.push([m[1].toUpperCase(),m[2]]);
}
let scripts=0;
for(const item of items){
 const pathname='/'+item.request.url.path.join('/');
 assert(routes.some(([method,p])=>method===item.request.method&&new RegExp('^'+p.replace(/:[^/]+/g,'[^/]+')+'$').test(pathname)),'Unknown backend endpoint');
 assert(item.event.some(e=>e.listen==='test'));
 for(const e of item.event){new vm.Script(e.script.exec.join('\n'));scripts++;}
 if(item.request.url.raw.includes('/control')){
  assert(c.item.find(f=>f.item.includes(item)).name==='Hardware Control - Manual');
  assert(item.event[0].script.exec.join('\n').includes('const hardwareRequestLocked = true;'));
  assert(item.event[0].script.exec.join('\n').includes('pm.execution.skipRequest()'));
 }
}
assert(c.auth.type==='bearer'&&c.auth.bearer[0].value==='{{access_token}}');
const env=read('SensoSynch_Local.postman_environment.json');
assert(env.values.some(v=>v.key==='api_password'&&v.value===''));
for(const v of env.values){if(/password|token/i.test(v.key))assert(v.value==='');assert(!/JWT_SECRET|MQTT_PASSWORD/.test(v.key));}
assert(items[1].request.body.raw.includes('{{api_password}}'));
const source=read('IoT_Smart_Home_API.postman_collection.json').item.flatMap(f=>f.item);
// Original tests copied intact, apart from user-approved IDs/titles and the Login variable rename.
for(const [index,n]of [1,2,3,6,5,4].entries()){
 const original=source.find(i=>i.name.startsWith('TC'+String(n).padStart(2,'0')+' '));
 assert.deepEqual(items[index].event.find(e=>e.listen==='test'),original.event.find(e=>e.listen==='test'));
 assert.deepEqual(items[index].response,original.response);
}
const publicText=fs.readFileSync(path.join(__dirname,'SensoSynch_Full_API.postman_collection.json'),'utf8');
assert(!/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}/.test(publicText));
const result={checkedAt:new Date().toISOString(),status:'PASS',schema:'Postman Collection v2.1 official schema',requests:items.length,
 scripts,folders:6,sequence:'TC01..TC17',originalTestAssertionsAndExamplesPreserved:true,hardwareLocked:true,secretVariablesEmpty:true};
fs.writeFileSync(path.join(__dirname,'reports/full-validation.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
