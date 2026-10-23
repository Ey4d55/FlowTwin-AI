const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
process.chdir(__dirname);
const Engine=require('../dist/traffic-engine.js');
const output=process.env.FLOWTWIN_AUDIT_OUTPUT||'generated';fs.mkdirSync(output,{recursive:true});
let checks=0; const rows=[];
for(const scenario of ['congestion','ambulance','offline'])for(const demand of [30,70,100])for(const seed of [1,2,3,4,5,6,7,8,9,19]){
 const engines=['baseline','optimized'].map(mode=>new Engine({scenario,demand,seed,mode}));
 for(let step=1;step<=3600;step++){
  for(const e of engines){
   const old=new Map(e.vehicles.map(v=>[v.id,{p:v.p,front:v.p+v.length/2,c:v.committed}]));
   e.step(.05);assert.equal(e.collisions().length,0);
   assert.equal(e.arrived,e.exited+e.vehicles.length+e.demandQueues.flat().length);
   for(const v of e.vehicles){const p=old.get(v.id);if(!p)continue;assert(v.p>=p.p);if(!p.c&&p.front<=Engine.lanes[v.lane].stop&&v.p+v.length/2>Engine.lanes[v.lane].stop+.001)assert(e.isGreen(v.lane));}
   if(e.phase==='green')assert(!e.vehicles.some(v=>e.inIntersection(v)&&!Engine.stages[e.stage].lanes.includes(v.lane)));
   assert.equal(e.spatialStops,0);
   const s=e.snapshot();assert(Math.abs(s.waiting*e.arrived-e.waitSeconds)<1e-7);assert(Math.abs(s.co2-s.fuel*8.887/3.785411784)<1e-9);
   checks++;
  }
  assert.equal(engines[0].arrived,engines[1].arrived);assert.deepEqual(engines[0].spawnTimes,engines[1].spawnTimes);assert.equal(engines[0].busArrived,engines[1].busArrived);
  if([1200,2400,3600].includes(step))for(const e of engines)rows.push({scenario,demand,seed,mode:e.mode,horizon:step/20,...e.snapshot(),straight:e.movementCrossings?.straight,left:e.movementCrossings?.left,right:e.movementCrossings?.right});
 }
}
const sensitivity=[];
const sourceHashes=Object.fromEntries(['index.html','app.js','simulation-view.js','traffic-engine.js','styles.css','eco.css','decision-view.js','decision.css','intersection-map.js','safecross-engine.js','safecross-view.js','safecross.css'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('../dist/'+f)).digest('hex')]));
fs.writeFileSync(output+'/results.json',JSON.stringify({checks,rows,sensitivity,sourceHashes},null,2));
const cols=Object.keys(rows[0]);fs.writeFileSync(output+'/results.csv',cols.join(',')+'\n'+rows.map(r=>cols.map(k=>r[k]??'').join(',')).join('\n'));
console.log(JSON.stringify({checks,default:rows.filter(r=>r.seed===19&&r.demand===70&&r.horizon===180),sensitivity},null,2));
