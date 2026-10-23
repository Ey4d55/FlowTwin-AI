/* Browser traffic experiment. One geometry definition serves lanes, routes and signals. */
(function(root){
 'use strict';
 const ROAD={left:372,right:528,top:192,bottom:348,cx:450,cy:270};
 const MOVEMENTS=['left','straight','right'];
 const APPROACHES=[{id:'W',group:'EW',angle:0,length:900,stop:350,positions:[284,308,332]},
  {id:'E',group:'EW',angle:180,length:900,stop:350,positions:[256,232,208]},
  {id:'N',group:'NS',angle:90,length:530,stop:170,positions:[436,412,388]},
  {id:'S',group:'NS',angle:-90,length:530,stop:160,positions:[464,488,512]}];
 const LANES=APPROACHES.flatMap((a,approach)=>MOVEMENTS.map((movement,m)=>({...a,id:a.id+'-'+movement,approach,movement,
  xy:p=>approach===0?[p,a.positions[m]]:approach===1?[900-p,a.positions[m]]:approach===2?[a.positions[m],p]:[a.positions[m],530-p]})));
 const STAGES=[{id:'NS-through',group:'NS',left:false,lanes:[7,8,10,11]},
  {id:'NS-left',group:'NS',left:true,lanes:[6,9]},
  {id:'EW-through',group:'EW',left:false,lanes:[1,2,4,5]},
  {id:'EW-left',group:'EW',left:true,lanes:[0,3]}];
 const CURVES=[{left:[[364,284],[464,284],[464,184],[464,-45]],right:[[364,332],[388,332],[388,356],[388,575]]},
  {left:[[536,256],[436,256],[436,356],[436,575]],right:[[536,208],[512,208],[512,184],[512,-45]]},
  {left:[[436,184],[436,284],[536,284],[945,284]],right:[[388,184],[388,208],[364,208],[-45,208]]},
  {left:[[464,356],[464,256],[364,256],[-45,256]],right:[[512,356],[512,332],[536,332],[945,332]]}];
 const ROUTES=LANES.map(l=>{
  let xy=[l.xy(0)];
  if(l.movement==='straight')xy.push(l.xy(l.length+45));
  else{const [a,c,b,end]=CURVES[l.approach][l.movement];xy.push(a);for(let j=1;j<=50;j++){const t=j/50;xy.push([(1-t)**2*a[0]+2*(1-t)*t*c[0]+t*t*b[0],(1-t)**2*a[1]+2*(1-t)*t*c[1]+t*t*b[1]]);}xy.push(end);}
  const points=[{x:xy[0][0],y:xy[0][1],s:0}];
  for(let j=1;j<xy.length;j++){const prev=points.at(-1),end=xy[j],length=Math.hypot(end[0]-prev.x,end[1]-prev.y),count=Math.max(1,Math.ceil(length/5));for(let k=1;k<=count;k++)points.push({x:prev.x+(end[0]-prev.x)*k/count,y:prev.y+(end[1]-prev.y)*k/count,s:prev.s+length*k/count});}
  const last=points.filter(p=>p.x>=ROAD.left-18&&p.x<=ROAD.right+18&&p.y>=ROAD.top-18&&p.y<=ROAD.bottom+18).at(-1);
  return {[l.movement]:{points,length:points.at(-1).s,clear:(last?.s||l.stop+160)+20}};
 });
  function pose(v){if(v._pose&&v._pose.p===v.p)return v._pose;const route=ROUTES[v.lane][v.movement||'straight'],pts=route.points;let a=pts[0],b=pts[1];
    if(v.p>=route.length){a=pts.at(-2);b=pts.at(-1);}else if(v.p>0){let lo=0,hi=pts.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(pts[m].s<=v.p)lo=m;else hi=m;}a=pts[lo];b=pts[hi];}
    const t=(v.p-a.s)/(b.s-a.s),angle=Math.atan2(b.y-a.y,b.x-a.x),c=Math.cos(angle),sn=Math.sin(angle);v._pose={p:v.p,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:angle*180/Math.PI,c,sn};return v._pose;
  }
  function overlap(a,b,padding=0){const pa=pose(a),pb=pose(b),bound=(a.length+b.length)/2+9+padding*4;
    if(Math.abs(pa.x-pb.x)>bound||Math.abs(pa.y-pb.y)>bound)return false;
    const axes=[[pa.c,pa.sn],[-pa.sn,pa.c],[pb.c,pb.sn],[-pb.sn,pb.c]];
    const ua=axes[0],va=axes[1],ub=axes[2],vb=axes[3];
    return axes.every(([x,y])=>Math.abs((pa.x-pb.x)*x+(pa.y-pb.y)*y)<(a.length/2+padding)*Math.abs(ua[0]*x+ua[1]*y)+(4.5+padding)*Math.abs(va[0]*x+va[1]*y)+(b.length/2+padding)*Math.abs(ub[0]*x+ub[1]*y)+(4.5+padding)*Math.abs(vb[0]*x+vb[1]*y)-.01);
  }
 class TrafficEngine{
  constructor({mode='optimized',scenario='congestion',demand=70,seed=19}={}){
   this.mode=mode;this.scenario=scenario;this.demand=demand;this.seed=seed;this.time=0;
   this.stage=0;this.group='NS';this.phase='green';this.phaseTime=0;this.nextDecision=8;
   this.vehicles=[];this.serial=0;this.spawnTimes=[0,.6,1.2,1.8];this.demandQueues=LANES.map(()=>[]);
   this.arrived=0;this.crossed=0;this.exited=0;this.waitSeconds=0;this.movingSeconds=0;this.idleSeconds=0;this.busWaitSeconds=0;this.busArrived=0;
   this.emergencyAdded=false;this.emergencyCrossing=null;this.events=[];this.decisions=[];this.spatialStops=0;
   this.priority={detected:null,amber:null,green:null,crossed:null};this.movementCrossings={straight:0,left:0,right:0};
   for(let a=0;a<4;a++)for(let m=0;m<3;m++){
    this.addDemand(a,m===1&&a===0?'bus':'car',MOVEMENTS[m]);const lane=a*3+m,v=this.demandQueues[lane].shift();
    this.vehicles.push({...v,p:LANES[lane].stop-24,speed:0,committed:false,crossed:false});
   }
  }
  random(){this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296;}
  pose(v){return pose(v);}
  box(v){const p=pose(v);return {...p,w:Math.abs(p.c)*v.length+Math.abs(p.sn)*9,h:Math.abs(p.sn)*v.length+Math.abs(p.c)*9};}
  inIntersection(v){const b=this.box(v);return b.x+b.w/2>ROAD.left&&b.x-b.w/2<ROAD.right&&b.y+b.h/2>ROAD.top&&b.y-b.h/2<ROAD.bottom;}
  signal(lane){return STAGES[this.stage].lanes.includes(lane)?this.phase==='green'?'green':this.phase==='amber'?'amber':'red':'red';}
  isGreen(lane){return this.signal(lane)==='green';}
  emergency(){return [...this.vehicles,...this.demandQueues.flat()].find(v=>v.type==='ambulance'&&!v.crossed);}
  pendingPriority(){return this.mode==='optimized'&&!!this.emergency();}
  queue(group){return this.vehicles.filter(v=>(!group||LANES[v.lane].group===group)&&!v.committed&&v.speed<1).length;}
  record(type,extra={}){if(!this._planning)this.events.push({time:this.time,type,group:this.group,stage:this.stage,...extra});}
  nextStage(){
   for(let offset=1;offset<=4;offset++){const next=(this.stage+offset)%4;
    if(this.mode==='baseline'||this.vehicles.some(v=>!v.committed&&STAGES[next].lanes.includes(v.lane))||STAGES[next].lanes.some(i=>this.demandQueues[i].length))return next;
   }return (this.stage+1)%4;
  }
  beginSwitch(reason){this.phase='amber';this.phaseTime=0;this.record('amber',{reason});}
  forecast(action){
   const clone=Object.assign(Object.create(TrafficEngine.prototype),JSON.parse(JSON.stringify(this)));
   clone.emergencyAdded=true;clone._planning=true;clone._holdUntil=clone.time+(action==='hold'?4:0);clone.events=[];clone.decisions=[];
   if(action==='switch'){clone.phase='amber';clone.phaseTime=0;}
   const w=clone.waitSeconds,b=clone.busWaitSeconds;for(let i=0;i<480;i++)clone.step(.05);
   const waiting=clone.waitSeconds-w,bus=clone.busWaitSeconds-b;return {action,waiting,bus,cost:waiting+2*bus};
  }
  control(dt){
   this.phaseTime+=dt;const stage=STAGES[this.stage],amb=this.emergency(),target=amb?STAGES.findIndex(s=>s.lanes.includes(amb.lane)):null;
   if(!this._planning&&amb&&this.priority.detected===null){this.priority.detected=this.time;this.record('detected');}
   if(this.phase==='green'){
    if(!this._planning&&this.mode==='optimized'&&amb){
     if(this.stage!==target){this.priority.amber??=this.time;this.beginSwitch('emergency');}
     else if(this.priority.green===null){this.priority.green=this.time;this.record('priority-green');}return;
    }
    const fixed=stage.left?6:12,min=stage.left?4:8,max=stage.left?12:24;
    if(this._planning){if(this.time>=this._holdUntil&&this.phaseTime>=fixed)this.beginSwitch('forecast-rollout');return;}
    if(this.mode==='baseline'){if(this.phaseTime>=fixed)this.beginSwitch('fixed');return;}
    if(this.phaseTime>=max){this.beginSwitch('max-green');return;}
    if(this.phaseTime>=min&&this.time>=this.nextDecision){
     const hold=this.forecast('hold'),change=this.forecast('switch'),action=change.cost+.5<hold.cost?'switch':'hold';
     this.decisions.push({time:this.time,group:this.group,stage:this.stage,horizon:24,hold,change,action});this.nextDecision=this.time+4;this.record('decision',{action});if(action==='switch')this.beginSwitch('forecast');
    }
   }else if(this.phase==='amber'&&this.phaseTime>=3){this.phase='clearance';this.phaseTime=0;this.record('clearance');}
   else if(this.phase==='clearance'&&this.phaseTime>=1.5&&!this.vehicles.some(v=>this.inIntersection(v)||v.committed&&!v.crossed)){
    this.stage=this.mode==='optimized'&&target!==null?target:this.nextStage();this.group=STAGES[this.stage].group;this.phase='green';this.phaseTime=0;this.nextDecision=this.time+(STAGES[this.stage].left?4:8);this.record('green');
    if(this.mode==='optimized'&&target===this.stage&&this.priority.green===null){this.priority.green=this.time;this.record('priority-green');}
   }
  }
  addDemand(approach,type='car',movement){
   const id=++this.serial,m=movement||(type==='ambulance'?'straight':id%10<6?'straight':id%10<8?'right':'left'),lane=approach*3+MOVEMENTS.indexOf(m);
   const item={id,lane,type,movement:m,arrival:this.time,length:type==='bus'?30:type==='ambulance'?25:19,wait:0};this.demandQueues[lane].push(item);this.arrived++;if(type==='bus')this.busArrived++;
  }
  step(dt){
   if(!Number.isFinite(dt)||dt<=0)return;if(dt>.05){const n=Math.ceil(dt/.05);for(let i=0;i<n;i++)this.step(dt/n);return;}
   this.time+=dt;if(this.scenario==='ambulance'&&!this.emergencyAdded&&this.time>=6){this.addDemand(0,'ambulance');this.emergencyAdded=true;}this.control(dt);
   for(let a=0;a<4;a++)if(this.time>=this.spawnTimes[a]){this.addDemand(a,this.serial%11===4?'bus':'car');const multiplier=this.scenario==='congestion'&&a===2?.7:1;this.spawnTimes[a]+=((100/this.demand)*2.4+this.random()*.7)*multiplier;}
   LANES.forEach((lane,i)=>{
    const cars=this.vehicles.filter(v=>v.lane===i).sort((a,b)=>b.p-a.p),last=cars.at(-1),next=this.demandQueues[i][0];
    if(next&&(!last||last.p-last.length/2>-32+next.length/2+12)){this.demandQueues[i].shift();const v={...next,p:-32,speed:24,committed:false,crossed:false};this.vehicles.push(v);cars.push(v);}
    let leader=null;for(const v of cars){
     let ceiling=leader?leader.p-(leader.length+v.length)/2-12:Infinity;v.waitReason=null;
     if(!v.committed&&!this.isGreen(i)){ceiling=Math.min(ceiling,lane.stop-v.length/2);v.waitReason='signal';}
     const gap=Math.max(0,ceiling-v.p),turning=v.movement!=='straight'&&v.p>lane.stop&&v.p<ROUTES[i][v.movement].clear;
     const desired=Math.min(turning?26:v.type==='bus'?39:46,Math.sqrt(2*38*gap));v.speed=Math.max(0,Math.min(desired,v.speed+22*dt));
     const old=v.p;v.p=Math.max(old,Math.min(ceiling,v.p+v.speed*dt));
     if(this.vehicles.some(other=>other.id!==v.id&&overlap(v,other,1))){v.p=old;v.waitReason='downstream';this.spatialStops++;}
     v.speed=(v.p-old)/dt;if(v.speed<.1&&!v.waitReason&&leader)v.waitReason='following';
     if(!v.committed&&v.p+v.length/2>lane.stop+.001)v.committed=true;
     if(v.speed<1){v.wait+=dt;this.waitSeconds+=dt;this.idleSeconds+=dt;if(v.type==='bus')this.busWaitSeconds+=dt;}else this.movingSeconds+=dt;
     if(v.committed&&!v.crossed&&v.p>ROUTES[i][v.movement].clear){v.crossed=true;this.crossed++;this.movementCrossings[v.movement]++;if(v.type==='ambulance'){this.emergencyCrossing=this.time-v.arrival;this.priority.crossed=this.time;this.record('ambulance-crossed');}}
     leader=v;
    }
    for(const v of this.demandQueues[i]){v.wait+=dt;this.waitSeconds+=dt;this.idleSeconds+=dt;if(v.type==='bus')this.busWaitSeconds+=dt;}
   });
   const before=this.vehicles.length;this.vehicles=this.vehicles.filter(v=>v.p<ROUTES[v.lane][v.movement].length);this.exited+=before-this.vehicles.length;
  }
  snapshot(){const external=this.demandQueues.reduce((n,q)=>n+q.length,0),fuel=(this.idleSeconds*.8+this.movingSeconds*4)/3600;return {time:this.time,waiting:this.waitSeconds/Math.max(1,this.arrived),queue:this.queue()+external,idle:this.idleSeconds,fuel,co2:fuel*8.887/3.785411784,busDelay:this.busWaitSeconds/Math.max(1,this.busArrived),arrived:this.arrived,crossed:this.crossed,exited:this.exited,emergency:this.emergencyCrossing,external};}
  collisions(){const hits=[];for(let i=0;i<this.vehicles.length;i++)for(let j=i+1;j<this.vehicles.length;j++)if(overlap(this.vehicles[i],this.vehicles[j]))hits.push([this.vehicles[i].id,this.vehicles[j].id]);return hits;}
 }
 TrafficEngine.lanes=LANES;TrafficEngine.approaches=APPROACHES;TrafficEngine.routes=ROUTES;TrafficEngine.stages=STAGES;TrafficEngine.road=ROAD;
 if(typeof module!=='undefined')module.exports=TrafficEngine;else root.TrafficEngine=TrafficEngine;
})(typeof window==='undefined'?globalThis:window);
