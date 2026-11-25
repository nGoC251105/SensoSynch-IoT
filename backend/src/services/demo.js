"use strict";
const {timestamp,iso}=require('../utils');
module.exports=function({db,broadcast,server}) {
 let timer=null,busy=false;
 async function sample() {
  if(busy)return;
  busy=true;
  try {
   const time=timestamp(),value=+(40+Math.random()*20).toFixed(1);
   await db.execute('INSERT INTO sensor_data (sensor_id,value,measured_at) SELECT id,?,? FROM sensors WHERE type=?',[value,time,'Demo']);
   broadcast('demo:update',{demo:value,measuredAt:iso(time)});
  } finally {busy=false;}
 }
 async function startDemo() {
  await db.execute("INSERT INTO sensors (code,type,device_name,unit) VALUES ('DEMO_01','Demo','Demo Generator','%') ON DUPLICATE KEY UPDATE code=VALUES(code)");
  await sample();
  timer=setInterval(()=>sample().catch(e=>console.error('Demo sample:',e.message)),3000);
  timer.unref();
 }
 server.on('close',()=>clearInterval(timer));
 return {startDemo};
};
