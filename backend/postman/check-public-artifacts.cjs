'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('assert/strict');
const root=__dirname;
const env=require('../node_modules/dotenv').parse(fs.readFileSync(path.join(root,'../.env'),'utf8'));
const privateValues=[env.JWT_SECRET,env.AUTH_PASSWORD_HASH].filter(Boolean);
let checked=0;
function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='node_modules')continue;
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()){scan(file);continue;}
    if(!/\.(json|md|cjs|js|html)$/.test(entry.name))continue;
    const text=fs.readFileSync(file,'utf8');
    assert(!privateValues.some(value=>text.includes(value)),`Private JWT configuration leaked into ${path.relative(root,file)}`);
    assert(!/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}/.test(text),`JWT-like runtime token found in ${path.relative(root,file)}`);
    checked++;
}}
scan(root);
for(const name of ['IoT_Local.postman_environment.json','SensoSynch_Local.postman_environment.json']){
    const data=JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
    for(const value of data.values)if(/password|token/i.test(value.key))assert.equal(value.value,'',`Public environment ${value.key} must be empty`);
}
console.log(`PASS: ${checked} public artifact files scanned; no configured JWT secret/hash or runtime JWT; public credential/token variables empty.`);
