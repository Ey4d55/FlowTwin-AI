const assert=require('node:assert/strict');
const Engine=require('../dist/traffic-engine.js');
let checks=0;
for(const scenario of ['congestion','ambulance','offline'])for(const mode of ['baseline','optimized'])for(const demand of [30,70,100]){
 const sim=new Engine({scenario,mode,demand});
 for(let i=0;i<3600;i++){
  const before=new Map(sim.vehicles.map(v=>[v.id,{p:v.p,front:v.p+v.length/2,committed:v.committed}]));
  sim.step(.05);
  assert.equal(sim.collisions().length,0,`Collision: ${scenario}/${mode}/${demand} at ${sim.time}`);
  for(const v of sim.vehicles){const old=before.get(v.id),lane=Engine.lanes[v.lane];if(!old)continue;
   assert(v.p>=old.p,'Vehicle reversed');
   if(!old.committed&&old.front<=lane.stop&&v.p+v.length/2>lane.stop+.001)assert(sim.isGreen(v.lane),`Red-light entry at ${sim.time}`);
  }
  if(sim.phase==='green')assert(!sim.vehicles.some(v=>sim.inIntersection(v)&&!Engine.stages[sim.stage].lanes.includes(v.lane)),'Conflicting green');
  checks++;
 }
 assert(sim.crossed>10,'Traffic is deadlocked');
 if(scenario==='ambulance')assert(sim.emergencyCrossing!==null,'Ambulance never crossed');
 assert.equal(sim.spatialStops,0,'Permitted green movements should not be blocked by hidden route conflicts');
 const s=sim.snapshot();for(const value of Object.values(s))if(value!==null)assert(Number.isFinite(value)&&value>=0);
 console.log(`${scenario}/${mode}/${demand}: ${sim.crossed} crossed; no overlap or red-light entry`);
}
const a=new Engine(),b=new Engine();for(let i=0;i<400;i++){a.step(.05);b.step(.05)}assert.deepEqual(a.snapshot(),b.snapshot(),'Replay is not deterministic');
for(let i=0;i<2000;i++){a.mode=i%400<200?'baseline':'optimized';a.step(.05);assert.equal(a.collisions().length,0)}
console.log(`PASS: ${checks} state checks, deterministic replay, live strategy changes.`);
