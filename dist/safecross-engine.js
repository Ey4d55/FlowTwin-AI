/* SafeCross experiment engine. Model seconds/metres; no physical signal output. */
(function(root){
 'use strict';
 const defaults={scene:'pedestrian',speed:54,distance:80,reaction:1.5,deceleration:3,margin:10,bridge:4.5,height:4.65,uncertainty:.05,confidence:.95,sensor:true,age:0,pedestrian:true,occupied:false,alternative:false,offline:false,idleRate:.8,movingRate:4};
 function validate(input){
  const p={...defaults,...input};
  if(!['pedestrian','bridge'].includes(p.scene))throw Error('scene');
  for(const [k,min,max]of [['speed',0,120],['distance',1,500],['reaction',0,5],['deceleration',.5,10],['margin',0,100],['bridge',1,10],['height',1,10],['uncertainty',0,1],['confidence',0,1],['age',0,3600],['idleRate',0,20],['movingRate',0,100]])if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<min||p[k]>max)throw Error(k);
  for(const k of ['sensor','pedestrian','occupied','alternative','offline'])if(typeof p[k]!=='boolean')throw Error(k);
  return p;
 }
 function assess(input){const p=validate(input),v=p.speed/3.6,stop=v*p.reaction+v*v/(2*p.deceleration)+p.margin,healthy=p.sensor&&p.age<=2&&p.confidence>=.8;
  const clearance=p.bridge-p.height,conservative=clearance-p.uncertainty;
  let decision=p.scene==='pedestrian'?(p.pedestrian||p.occupied?'request-crossing':'monitor'):(conservative<=0?'stop-truck':'within-clearance');
  if(!healthy)decision='sensor-fault';
  return {v,stop,ttc:v>0?p.distance/v:null,clearance,conservative,healthy,decision,stopFeasible:p.distance>=stop,diversion:healthy&&decision==='stop-truck'&&p.alternative};
 }
 const settings={amberSeconds:3,clearanceSeconds:2,crossingSeconds:8,recoverySeconds:2,acceleration:2,exitDistance:60,diversionLength:40,holdSeconds:3,horizonSeconds:120};
 function signals(input,state){
  const p=validate(input),a=assess(p);
  if(!state||state.time===0)return {vehicle:'off',pedestrian:'red',command:'ready',observed:false};
  const observed=p.sensor&&!['passed','diverted'].includes(state.phase);
  if(!p.sensor)return {vehicle:'red',pedestrian:'red',command:'sensor-fault',observed:false};
  if(!observed)return {vehicle:'off',pedestrian:'red',command:'clear',observed:false};
  const released=['resume','diverting','parked'].includes(state.phase),stop=!a.healthy||state.hazard||(!released&&(p.scene==='bridge'?a.decision==='stop-truck':p.pedestrian||p.occupied));
  const vehicle=!stop?'green':a.healthy&&p.scene==='pedestrian'&&!p.occupied&&state.phase==='warning'?'amber':'red';
  return {vehicle,pedestrian:state.walk?'green':'red',command:!a.healthy?'sensor-fault':vehicle==='green'?'proceed':vehicle==='amber'?'prepare-stop':'stop',observed};
 }
 class Experiment{
  constructor(input){this.input=validate(input);this.assessment=assess(this.input);this.time=0;this.distance=this.input.distance;this.speed=this.assessment.v;this.phase='observe';this.phaseSince=0;this.walk=false;this.crossing=this.input.scene==='pedestrian'&&this.input.occupied?8:0;this.pedestrianCrossed=false;this.idle=0;this.moving=0;this.travelled=0;this.diversionDistance=0;this.events=[];this.done=false;this.warningAt=null;this.hazard=false;this.stoppedAt=null;this.releasedAt=null;this.emit('observation');}
  emit(type){this.events.push({sequence:this.events.length+1,time:Number(this.time.toFixed(3)),type,phase:this.phase,distance:this.distance,speed:this.speed,walk:this.walk});}
  setPhase(phase){if(this.phase!==phase){this.phase=phase;this.phaseSince=this.time;this.emit(phase);}}
  step(dt=.05){
   if(!Number.isFinite(dt)||dt<=0||dt>.1)throw Error('step');if(this.done)return;
   const previousTime=this.time;this.time+=dt;const p=this.input,a=this.assessment;
   const released=this.releasedAt!==null,mustStop=!a.healthy||this.hazard||(!released&&(p.scene==='bridge'?a.decision==='stop-truck':p.pedestrian||p.occupied));
   if(mustStop&&this.warningAt===null){this.warningAt=this.time;this.setPhase(a.healthy?'warning':'sensor-fault');}
   if(!mustStop&&this.phase==='observe')this.setPhase('cruise');
   const old=this.speed;let displacement=0;
   if(mustStop){
    const coast=Math.min(dt,Math.max(0,p.reaction-previousTime)),brake=Math.min(dt-coast,old/p.deceleration);
    displacement=old*coast+old*brake-.5*p.deceleration*brake*brake;this.speed=Math.max(0,old-p.deceleration*brake);
   }else{
    const target=a.v,ramp=Math.min(dt,Math.max(0,target-old)/settings.acceleration);
    displacement=old*ramp+.5*settings.acceleration*ramp*ramp+target*(dt-ramp);this.speed=Math.min(target,old+settings.acceleration*dt);
   }
   if(this.phase==='diverting')this.diversionDistance+=displacement;else this.distance-=displacement;
   this.travelled+=displacement;
   if(this.speed<.1)this.idle+=dt;else this.moving+=dt;
   if(this.crossing>0){this.crossing=Math.max(0,this.crossing-dt);if(this.crossing===0)this.pedestrianCrossed=true;}
   if(!released&&mustStop&&this.distance<=0&&!this.hazard){this.hazard=true;this.walk=false;this.setPhase('unsafe-arrival');}
   if(mustStop&&this.speed===0&&this.stoppedAt===null)this.stoppedAt=this.time;
   if(this.hazard){if(this.speed===0&&this.crossing===0&&this.time-this.stoppedAt>=settings.holdSeconds)this.done=true;return;}
   if(!a.healthy){this.walk=false;this.setPhase('sensor-fault');if(this.speed===0&&this.crossing===0&&this.time-this.stoppedAt>=settings.holdSeconds)this.done=true;return;}
   if(p.scene==='bridge'&&a.decision==='stop-truck'&&!released){
    if(this.speed===0){this.setPhase('stopped');if(this.time-this.stoppedAt>=settings.holdSeconds){if(p.alternative){this.releasedAt=this.time;this.setPhase(a.v===0?'parked':'diverting');if(a.v===0)this.done=true;}else this.done=true;}}
   }else if(p.scene==='pedestrian'&&!released&&(p.pedestrian||p.occupied)){
    if(this.phase==='warning'&&this.time>=settings.amberSeconds)this.setPhase('clearance');
    if(this.phase==='clearance'&&this.time-this.phaseSince>=settings.clearanceSeconds&&this.speed===0&&(this.distance>=p.margin||!p.pedestrian)&&this.crossing===0){
     if(p.pedestrian){this.walk=true;this.crossing=settings.crossingSeconds;this.setPhase('walk');}else this.setPhase('recovery');
    }
    if(this.phase==='clearance'&&this.speed===0&&this.crossing===0&&p.pedestrian&&this.distance<p.margin)this.setPhase('margin-hold');
    if(this.phase==='margin-hold'&&this.time-this.stoppedAt>=settings.holdSeconds)this.done=true;
    if(this.phase==='walk'&&this.crossing===0){this.walk=false;this.setPhase('recovery');}
    if(this.phase==='recovery'&&this.time-this.phaseSince>=settings.recoverySeconds){this.releasedAt=this.time;this.setPhase(a.v===0?'parked':'resume');if(a.v===0)this.done=true;}
   }
   if(this.phase==='diverting'&&this.diversionDistance>=settings.diversionLength){this.setPhase('diverted');this.done=true;}
   if((!mustStop||this.phase==='resume')&&this.phase!=='diverting'&&this.distance<=-settings.exitDistance){this.setPhase('passed');this.done=true;}
   if(!mustStop&&a.v===0&&this.time>=settings.holdSeconds){this.setPhase('parked');this.done=true;}
   if(this.time>=settings.horizonSeconds&&this.crossing===0&&!this.done){this.walk=false;this.setPhase('horizon-end');this.done=true;}
  }
  snapshot(){const p=this.input,fuel=(this.idle*p.idleRate+this.moving*p.movingRate)/3600;
   return {time:this.time,distance:this.distance,speed:this.speed,phase:this.phase,walk:this.walk,occupied:this.crossing>0,crossingRemaining:this.crossing,pedestrianCrossed:this.pedestrianCrossed,done:this.done,hazard:this.hazard,idleVehicleSeconds:this.idle,movingVehicleSeconds:this.moving,travelledMetres:this.travelled,diversionMetres:this.diversionDistance,fuelLitres:fuel,co2Kg:fuel*8.887/3.785411784,warningModelSeconds:this.warningAt,releasedAt:this.releasedAt,...signals(p,{time:this.time,phase:this.phase,walk:this.walk,hazard:this.hazard})};}
 }
 const api={defaults,settings,validate,assess,signals,Experiment};if(typeof module!=='undefined')module.exports=api;else root.SafeCross=api;
})(typeof window==='undefined'?globalThis:window);
