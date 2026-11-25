const {test}=require('node:test');
const assert=require('node:assert/strict');
const register=require('../src/routes/device-control');
const statusService=require('../src/services/device-status');
function setup(online=true){
 const writes=[],sent=[],finished=[];let route;
 const conn={beginTransaction:async()=>{},execute:async(...v)=>writes.push(v),commit:async()=>{},rollback:async()=>{},release:()=>{}};
 const c={app:{post:(_p,fn)=>route=fn},db:{execute:async(...v)=>{writes.push(v);return [{insertId:42}];},getConnection:async()=>conn},state:{mqttReady:true},TIMEOUT:10000,broadcast:()=>{},devices:async()=>[],publish:async(...v)=>sent.push(v),isEsp32Online:()=>online,applyOfflineState:async()=>{},finishCommand:async(status)=>{finished.push(status);clearTimeout(c.state.currentCommand?.timer);c.state.currentCommand=null;}};
 register(c);Object.assign(c,statusService(c));
 const request=async(target,action='ON')=>{const res={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await route({params:{target},body:{action}},res,e=>{throw e;});return res;};
 return {c,writes,sent,finished,request};
}
for(const id of [1,2,3,4])test(`LED${id}: topic, ACK validation, database state`,async()=>{
 const {c,writes,sent,finished,request}=setup();
 try{
 const res=await request(String(id));assert.equal(res.code,202);assert.equal(res.body.device,`led${id}`);
 assert.deepEqual(sent[0],[`device/control/${id}`,{action:'ON',commandId:42}]);
 await c.onStatus({device:`led${id}`,state:'ON',status:'SUCCESS',commandId:41});assert.equal(finished.length,0);
 await c.onStatus({device:`led${id}`,state:'OFF',status:'SUCCESS',commandId:42});assert.equal(finished.length,0);
 await c.onStatus({device:`led${id}`,state:'ON',status:'SUCCESS',commandId:42});
 assert.deepEqual(finished,['SUCCESS']);assert(writes.some(([sql,args])=>sql.startsWith('UPDATE devices')&&args[2]===id));
 }finally{clearTimeout(c.state.currentCommand?.timer);}
});
test('ALL waits for four individual ACKs',async()=>{
 const {c,finished,request}=setup();try{
 await request('all');
 for(const id of [1,2,3])await c.onStatus({device:`led${id}`,state:'ON',status:'SUCCESS',commandId:42});
 assert.equal(finished.length,0);
 await c.onStatus({device:'led4',state:'ON',status:'SUCCESS',commandId:42});assert.deepEqual(finished,['SUCCESS']);
 }finally{clearTimeout(c.state.currentCommand?.timer);}
});
test('LED3/4 boot sync and rejection; offline and invalid targets',async()=>{
 for(const id of [3,4]){
 const {c,writes,finished,request}=setup();
 await c.onStatus({device:`led${id}`,state:'ON',status:'SUCCESS',commandId:0});
 assert.equal(writes[0][1][2],id);
 try{await request(String(id));await c.onStatus({device:`led${id}`,state:'OFF',status:'FAILED',commandId:42});assert.deepEqual(finished,['FAILED']);}finally{clearTimeout(c.state.currentCommand?.timer);}
 const offline=setup(false);const res=await offline.request(String(id));assert.equal(res.body.status,'FAILED');assert.equal(offline.sent.length,0);
 }
 assert.equal((await setup().request('5')).code,404);
});
