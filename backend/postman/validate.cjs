'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const Ajv = require('ajv');
const root = __dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const ajv = new Ajv({schemaId:'auto',allErrors:true});
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
const schema=read('schemas/collection-v2.1.0.json');
const collection=read('IoT_Smart_Home_API.postman_collection.json');
const validate=ajv.compile(schema);
assert(validate(collection),JSON.stringify(validate.errors));
assert(validate(read('SensoSynch_API.postman_collection.json')),JSON.stringify(validate.errors));
assert.deepEqual(collection,read('SensoSynch_API.postman_collection.json'));
const environment=read('IoT_Local.postman_environment.json');
assert.equal(environment._postman_variable_scope,'environment');
const keys=new Set();
for(const v of environment.values){assert.equal(typeof v.key,'string');assert.equal(typeof v.value,'string');assert(!keys.has(v.key));keys.add(v.key);if(/password|token/i.test(v.key))assert.equal(v.value,'');assert(!/wifi|secret/i.test(v.key));}
assert.equal(collection.auth.type,'bearer');
assert.deepEqual(environment,read('SensoSynch_Local.postman_environment.json'));
assert.equal(environment.values.find(v=>v.key==='enable_hardware_tests').value,'false');
const routes=[];
for(const filename of fs.readdirSync(path.join(root,'../src/routes'))){
    const source=fs.readFileSync(path.join(root,'../src/routes',filename),'utf8');
    for(const match of source.matchAll(/app\.(get|post)\('([^']+)'/g))routes.push([match[1].toUpperCase(),match[2]]);
}
let requests=0,scripts=0;
const ids=new Set();
function checkEvents(events){for(const event of events||[]){new vm.Script(event.script.exec.join('\n'));scripts++;}}
checkEvents(collection.event);
for(const folder of collection.item)for(const item of folder.item){
    requests++;assert(!ids.has(item.id));ids.add(item.id);
    assert(item.request.url.raw.startsWith('{{base_url}}'));
    const pathname='/'+item.request.url.path.join('/');
    assert(routes.some(([method,url])=>method===item.request.method&&new RegExp('^'+url.replace(/:[^/]+/g,'[^/]+')+'$').test(pathname)),`Unknown route ${pathname}`);
    checkEvents(item.event);
    if(item.request.method==='POST')assert(item.request.body&&item.request.header.some(h=>h.key==='Content-Type'));
}
for(const [method,url] of routes){assert(collection.item.some(f=>f.item.some(i=>i.request.method===method&&new RegExp('^'+url.replace(/:[^/]+/g,'[^/]+')+'$').test('/'+i.request.url.path.join('/')))),`Route without coverage: ${url}`);}
let jsonFiles=0;
function parseAll(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name==='node_modules')continue;const file=path.join(dir,e.name);if(e.isDirectory())parseAll(file);else if(e.name.endsWith('.json')){JSON.parse(fs.readFileSync(file,'utf8'));jsonFiles++;}}}
parseAll(root);
const backendNames=['server.js'];
function checkJavaScript(dir, names){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name==='node_modules')continue;const file=path.join(dir,e.name);if(e.isDirectory())checkJavaScript(file,names);else if(/\.(js|cjs)$/.test(e.name)){new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});names.push(file);}}}
new vm.Script(fs.readFileSync(path.join(root,'../server.js'),'utf8'));
checkJavaScript(path.join(root,'../src'),backendNames);
const toolNames=[];checkJavaScript(root,toolNames);
fs.writeFileSync(path.join(root,'reports/validation.json'),JSON.stringify({checkedAt:new Date().toISOString(),status:'PASS',officialCollectionSchema:'v2.1.0',explicitRoutes:routes.length,jsonApiEndpoints:routes.filter(r=>r[1].startsWith('/api/')).length,collectionCases:requests,embeddedScripts:scripts,jsonFilesParsed:jsonFiles,backendJavaScriptFiles:backendNames.length,toolJavaScriptFiles:toolNames.length},null,2)+'\n');
console.log(`VALID: official Collection v2.1 schema; ${routes.length} routes (${routes.filter(r=>r[1].startsWith('/api/')).length} JSON APIs); ${requests} cases; ${scripts} scripts parsed; ${jsonFiles} JSON files parsed.`);
