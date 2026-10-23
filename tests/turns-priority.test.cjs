const assert=require('node:assert/strict'),Engine=require('../dist/traffic-engine'),Safe=require('../dist/safecross-engine');
for(let i=0;i<Engine.lanes.length;i++){
 const lane=Engine.lanes[i],route=Engine.routes[i][lane.movement],e=new Engine({mode:'baseline'}),v={lane:i,movement:lane.movement,p:lane.stop,length:19};
 const start=e.pose(v);v.p=route.clear+30;const end=e.pose(v);
 if(lane.movement!=='straight'){assert(Math.abs(end.x-start.x)>15&&Math.abs(end.y-start.y)>15);assert(Math.abs(Math.abs(end.angle-start.angle)%180-90)<.01);}
 for(let j=1;j<route.points.length;j++)assert(route.points[j].s>route.points[j-1].s);
 // Independent swept-body road check, using the largest represented vehicle.
 const road=Engine.road;
 for(let distance=0;distance<=route.length;distance+=3){const p=e.pose({lane:i,movement:lane.movement,p:distance,length:30});
  const samples=[];for(let along=-15;along<=15;along++)samples.push([along,-4.5],[along,4.5]);for(let across=-4.5;across<=4.5;across++)samples.push([-15,across],[15,across]);
  for(const [along,across]of samples){const x=p.x+along*p.c-across*p.sn,y=p.y+along*p.sn+across*p.c;assert(x>=road.left-.1&&x<=road.right+.1||y>=road.top-.1&&y<=road.bottom+.1,'Vehicle body crossed a curb');}
 }

 // Isolated stop-line vehicle: actual green must release every movement, actual red must hold it.
 for(const stage of Engine.stages.keys()){
  const model=new Engine({mode:'baseline'});model.stage=stage;model.group=Engine.stages[stage].group;model.vehicles=[];model.demandQueues=Engine.lanes.map(()=>[]);model.spawnTimes.fill(Infinity);
  model.addDemand(lane.approach,'car',lane.movement);const item=model.demandQueues[i].shift(),car={...item,p:lane.stop-item.length/2,speed:0,committed:false,crossed:false};model.vehicles.push(car);const old=car.p;model.step(.05);
  assert.equal(model.signal(i),Engine.stages[stage].lanes.includes(i)?'green':'red');assert.equal(car.p>old,model.isGreen(i));
 }
}
const probe=new Engine();for(let i=0;i<100;i++)probe.step(.05);const before=JSON.stringify(probe);probe.forecast('hold');probe.forecast('switch');assert.equal(JSON.stringify(probe),before);
for(const demand of [30,70,100]){
 const e=new Engine({scenario:'ambulance',demand});
 for(let i=0;i<3600;i++){
  e.step(.05);assert.equal(e.collisions().length,0);assert.equal(e.spatialStops,0,'No hidden conflict may suppress a permitted movement');
  if(e.phase==='green')assert(!e.vehicles.some(v=>e.inIntersection(v)&&!Engine.stages[e.stage].lanes.includes(v.lane)));
  if(e.pendingPriority()&&e.phase==='green')assert(e.isGreen(e.emergency().lane));
 }
 assert(e.priority.amber-e.priority.detected<.051);assert(e.priority.green>=e.priority.amber+4.5);assert(e.priority.crossed>e.priority.green);
 for(const m of ['straight','left','right'])assert(e.movementCrossings[m]>0);
 for(const d of e.decisions)assert.equal(d.action,d.change.cost+.5<d.hold.cost?'switch':'hold');
}
for(const input of [{},{scene:'bridge'},{scene:'bridge',height:4},{scene:'bridge',alternative:true},{sensor:false},{occupied:true},{pedestrian:false}]){
 const e=new Safe.Experiment(input);assert.equal(e.snapshot().vehicle,'off');
 for(let i=0;i<2500&&!e.done;i++){
  e.step(.05);const s=e.snapshot();
  if(s.walk){assert.equal(s.vehicle,'red');assert.equal(s.pedestrian,'green');assert.equal(s.speed,0);}else assert.equal(s.pedestrian,'red');
  if(!e.assessment.healthy)assert.equal(s.vehicle,'red');
  if(s.phase==='resume'||s.phase==='diverting')assert.equal(s.vehicle,'green');
 }
 assert(e.done);if(['passed','diverted'].includes(e.phase))assert.equal(e.snapshot().vehicle,'off');
}
const full=new Safe.Experiment({});while(!full.done)full.step(.05);
assert.deepEqual(full.events.map(e=>e.type),['observation','warning','clearance','walk','recovery','resume','passed']);
const release=full.events.find(e=>e.type==='resume');assert.equal(release.speed,0);assert(full.speed>0);assert(full.distance<0);
const stopped=new Safe.Experiment({scene:'bridge'});while(!stopped.done)stopped.step(.05);assert.equal(stopped.phase,'stopped');assert.equal(stopped.snapshot().vehicle,'red');
console.log('PASS: 12 dedicated lanes / 8 curved routes, 48 isolated signal permissions, 3 emergency runs with zero hidden conflict stops, counterfactual isolation, and complete SafeCross release/exit cycles.');
