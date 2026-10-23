const assert=require('node:assert/strict'),S=require('../dist/safecross-engine');
function run(p){const e=new S.Experiment(p);for(let i=0;i<2500&&!e.done;i++)e.step(.05);assert(e.done);return e;}
const late=run({speed:72,reaction:5,deceleration:1,distance:400});assert.equal(late.phase,'passed');assert(!late.snapshot().occupied);assert(late.time>30);
const existing=run({pedestrian:false,occupied:true});assert(!existing.events.some(x=>x.type==='walk'));assert.equal(existing.phase,'passed');
for(const confidence of [.7999,.8,1])for(const age of [0,2,2.0001]){const e=run({confidence,age});assert.equal(e.phase==='passed',confidence>=.8&&age<=2);}
for(const delta of [-.01,0,.01]){const a=S.assess({scene:'bridge',bridge:4.5,height:4.5+delta,uncertainty:0});assert.equal(a.decision,delta>=0?'stop-truck':'within-clearance');}
let cases=0,checks=0;
for(const scene of ['pedestrian','bridge'])for(const speed of [0,30,72,120])for(const distance of [1,80,400])for(const reaction of [0,5])for(const deceleration of [.5,3,10])for(const pedestrian of [false,true])for(const occupied of [false,true]){
 const e=new S.Experiment({scene,speed,distance,reaction,deceleration,pedestrian,occupied});
 for(let i=0;i<2500&&!e.done;i++){e.step(.05);const s=e.snapshot();assert(Math.abs(s.idleVehicleSeconds+s.movingVehicleSeconds-s.time)<1e-7);if(s.walk){assert(pedestrian);assert.equal(s.speed,0);assert(!s.hazard);}checks++;}
 assert(e.done);assert(!e.snapshot().occupied);assert(!e.walk);cases++;
}
console.log(`PASS: release regressions; ${cases} boundary experiments, ${checks} state checks.`);
