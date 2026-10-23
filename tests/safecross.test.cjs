const assert=require('node:assert/strict'),S=require('../dist/safecross-engine');
const close=(a,b)=>assert(Math.abs(a-b)<1e-7);
close(S.assess({speed:60,reaction:2.5,deceleration:3,margin:30}).stop,117.96296296296298);
close(S.assess({speed:80,reaction:2.5,deceleration:3,margin:30}).stop,167.86008230452677);
close(S.assess({distance:45,speed:54}).ttc,3);
assert.equal(S.assess({speed:0}).ttc,null);
assert.equal(S.assess({scene:'bridge',bridge:4.5,height:4.48,uncertainty:.05}).decision,'stop-truck');
for(const invalid of [{speed:-1},{speed:NaN},{height:Infinity},{age:-1},{scene:'other'},{sensor:'yes'}])assert.throws(()=>S.assess(invalid));
let cases=0,steps=0;
for(const scene of ['pedestrian','bridge'])for(const speed of [0,30,60,120])for(const distance of [5,80,300])for(const fault of [{},{sensor:false},{confidence:.2},{age:5}]){
 const e=new S.Experiment({scene,speed,distance,...fault});let previous=Infinity;
 for(let i=0;i<2500&&!e.done;i++){
  e.step(.05);const s=e.snapshot();assert(s.speed>=0);assert(s.distance<=previous);previous=s.distance;
  if(s.walk){assert.equal(scene,'pedestrian');assert(e.assessment.healthy);assert.equal(s.speed,0);assert(s.distance>=e.input.margin);assert(!s.hazard);}
  if(!e.assessment.healthy)assert(!s.walk);
  close(s.fuelLitres,(s.idleVehicleSeconds*.8+s.movingVehicleSeconds*4)/3600);close(s.co2Kg,s.fuelLitres*8.887/3.785411784);steps++;
 }assert(e.done);cases++;
}
function run(p){const e=new S.Experiment(p);while(!e.done)e.step(.05);return e;}
const normal=run({});assert.equal(normal.phase,'passed');assert(normal.distance<=-S.settings.exitDistance);
const resume=normal.events.find(e=>e.type==='resume');close(resume.distance,20);assert(normal.events.some(e=>e.type==='recovery'));
assert(run({distance:5}).hazard);
assert.equal(run({scene:'bridge',alternative:true}).phase,'diverted');
assert.equal(run({scene:'bridge',height:3}).phase,'passed');
assert.equal(run({sensor:false}).events.some(e=>e.type==='walk'),false);
assert.deepEqual(run({offline:true}).snapshot(),run({offline:false}).snapshot());
assert.deepEqual(run({}).snapshot(),run({}).snapshot());
for(const speed of [0,30,54,120])for(const reaction of [0,1.5,5])for(const deceleration of [.5,3,10]){
 const e=run({scene:'bridge',distance:500,speed,reaction,deceleration});const v=speed/3.6,physical=v*reaction+v*v/(2*deceleration);
 close(e.distance,500-physical);close(e.travelled,physical);assert.equal(e.speed,0);
}
const zero=run({idleRate:0,movingRate:0});assert.equal(zero.snapshot().fuelLitres,0);assert.equal(zero.snapshot().co2Kg,0);
const mismatch=run({speed:60,distance:80});assert.equal(mismatch.phase,'margin-hold');assert(!mismatch.events.some(e=>e.type==='walk'));
console.log(`PASS: ${cases} experiments, ${steps} state checks; 36 independent braking integrals, zero fuel rates, margin holds, safety gating, uncertainty, faults, offline-equivalence and deterministic replay.`);
