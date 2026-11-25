'use strict';

// Exercise the actual collection pre-request guards against a temporary local HTTP sink.
// This never points to the SensoSynch backend and never publishes MQTT.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const newman = require('newman');
const root = __dirname;
const collection = JSON.parse(fs.readFileSync(path.join(root,'SensoSynch_API.postman_collection.json'),'utf8'));
const control=collection.item.find(f=>f.name==='Control');
collection.item=[{name:'Guard verification against local HTTP sink',item:control.item.filter(i=>/^CTL0[89] /.test(i.name))}];
collection.event=[];
let received=0;
const server=http.createServer((_req,res)=>{received++;res.writeHead(500);res.end('Guard failed');});
server.listen(0,'127.0.0.1',()=>{
    const base='http://127.0.0.1:'+server.address().port;
    const environment={values:[{key:'base_url',value:base,enabled:true},{key:'enable_hardware_tests',value:'false',enabled:true},{key:'hardware_confirmation',value:'',enabled:true}]};
    newman.run({collection,environment,reporters:[],timeoutRequest:1000,timeoutScript:3000},(error,summary)=>{
        server.close();
        try{
            assert.ifError(error);
            assert.equal(received,0,'A guarded request reached the HTTP sink');
            assert.equal(summary.run.failures.length,0,'Sandbox guards failed');
            const result={checkedAt:new Date().toISOString(),newmanVersion:require('newman/package.json').version,requestsReceived:received,status:'PASS',meaning:'Actual CTL08/CTL09 guard scripts skipped all network requests with default safe environment. Executed only against isolated HTTP sink, not hardware.'};
            fs.writeFileSync(path.join(root,'reports/safety-check.json'),JSON.stringify(result,null,2)+'\n');
            console.log(result.meaning);
        }catch(err){console.error(err);process.exitCode=1;}
    });
});
