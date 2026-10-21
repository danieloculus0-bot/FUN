/* BEAN visual-spatial perception, friend-aware combat and hazard-aware Q-learning.
 * Version 2 is EXPERIMENTAL: the original game and its v1 ledger are immutable.
 * Vision is game-state sensing (collision geometry), not screenshot recognition. */
"use strict";
const Old=require("./bean-q.js");
const VERSION=2;
const DIRS=[[1,0],[Math.SQRT1_2,Math.SQRT1_2],[0,1],
 [-Math.SQRT1_2,Math.SQRT1_2],[-1,0],[-Math.SQRT1_2,-Math.SQRT1_2],[0,-1],[Math.SQRT1_2,-Math.SQRT1_2]];
const bucket=(v,breaks)=>breaks.reduce((n,x)=>n+(v>x?1:0),0);
function directionIndex(dx,dy){
 if(!dx&&!dy)return 0;
 const a=(Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2);
 return Math.round(a/(Math.PI/4))%8;
}
function observationKey(o){
 const rays=o.terrain?.rays||Array(8).fill(0),target=o.target||{dx:1,dy:0};
 const heading=directionIndex(target.dx,target.dy);
 const angry=o.yeti?.angry?1:0;
 return Old.stateKey(o)+"|"+[
  bucket(o.terrain?.here||0,[1.5,6]),
  bucket(rays[heading]||0,[2,7]),
  bucket(Math.min(...rays),[2,7]),
  angry,
  o.seal?.distance<260?1:0,
  o.yeti?.distance<320?1:0
 ].join(".");
}
class SightLearner extends Old.QLearner{
 constructor({parentSnapshot=null,...args}={}){
  super({alpha:.18,gamma:.94,epsilon:.2,...args});
  this.parentSnapshot=parentSnapshot;
  if(parentSnapshot&&(parentSnapshot.version!==1||!parentSnapshot.table))throw Error("Explicit prior v1 Q-table required");
  this.seededStates=0;
 }
 values(key){
  if(!this.table[key]){
   const base=this.parentSnapshot?.table?.[key.split("|")[0]];
   this.table[key]=base?base.slice():Array(Old.ACTIONS.length).fill(0);
   if(base)this.seededStates++;
  }
  return this.table[key];
 }
 select(o,{explore=true}={}){
  const key=observationKey(o),allowed=Old.legalActions(o),v=this.values(key);
  if(explore&&this.random()<this.epsilon)return allowed[Math.floor(this.random()*allowed.length)];
  let top=-Infinity,best=[];
  for(const a of allowed){
   if(v[a]>top+1e-9){top=v[a];best=[a]}
   else if(Math.abs(v[a]-top)<1e-9)best.push(a);
  }
  return best[Math.floor(this.random()*best.length)];
 }
 update(before,action,reward,after,done=false){
  if(!Number.isFinite(reward)||!Number.isInteger(action)||action<0||action>=Old.ACTIONS.length)throw Error("Invalid Q transition");
  const old=this.values(observationKey(before));
  const next=this.values(observationKey(after));
  const legal=Old.legalActions(after);
  const target=reward+(done?0:this.gamma*Math.max(...legal.map(a=>next[a])));
  old[action]+=this.alpha*(target-old[action]);this.updates++;
 }
 snapshot(){return {version:VERSION,alpha:this.alpha,gamma:this.gamma,epsilon:this.epsilon,
  updates:this.updates,seededStates:this.seededStates,table:this.table};}
}
// Over-ride motion only when a predicted trajectory is dangerous, retaining the
// agent's selected target, weapon and rewards for reproducible ablation tests.
function steerAroundHazards(o,cmd){
 const rays=o.terrain?.rays;
 if(!rays||rays.length!==8)return {command:cmd,redirected:false};
 const movement=Math.hypot(cmd.dx,cmd.dy);
 const dx=movement?cmd.dx/movement:0,dy=movement?cmd.dy/movement:0;
 const predicted=o.terrain?.driftRays?.length===8?o.terrain.driftRays:rays;
 const direction=movement?directionIndex(dx,dy):directionIndex(o.vx||0,o.vy||0);
 const velocity=Math.hypot(o.vx||0,o.vy||0);
 const ahead=Math.max(predicted[direction]||0,rays[direction]||0);
 const momentumRisk=o.terrain?.stopRisk||0;
 if(ahead<=2.5&&momentumRisk<=2.5&&(o.terrain?.here||0)<=3)
  return {command:cmd,redirected:false};
 const options=DIRS.map(([x,y],i)=>{
  const deviation=movement?1-(x*dx+y*dy):.8;
  const velocityOpposition=velocity>1?((x*(o.vx||0)+y*(o.vy||0))/velocity):0;
  const projected=Math.max(predicted[i]||0,rays[i]||0);
  // Move against existing velocity when braking is needed. With no danger
  // keep the requested policy action rather than silently overriding it.
  const score=projected*3.5+deviation*3+
     (momentumRisk>3?Math.max(0,velocityOpposition)*3:0);
  return {i,x,y,score};
 });
 options.sort((a,b)=>a.score-b.score||a.i-b.i);
 const best=options[0];
 const avoid=(ahead>2.5||momentumRisk>3||(o.terrain?.here||0)>3);
 if(!avoid||movement&&best.i===direction)
  return {command:cmd,redirected:false};
 return {command:{...cmd,dx:best.x,dy:best.y,sprint:false},
  redirected:true,reason:"momentum-and-hazard"};
}
function friendInFiringLane(o,cmd){
 const friends=[o.seal,o.yeti].filter(Boolean);
 if(!friends.length||(!cmd.fire&&!cmd.grenade))return false;
 const ax=(cmd.aimX??o.x+1)-o.x,ay=(cmd.aimY??o.y)-o.y,mag=Math.hypot(ax,ay)||1;
 const ux=ax/mag,uy=ay/mag;
 const weapon=cmd.weapon||o.weapon;
 const explosive=cmd.grenade||["ion","rocket"].includes(weapon);
 const flame=weapon==="flame",melee=["fists","knife","staff","nunchucks"].includes(weapon);
 const maxRange=melee?120:flame?210:1200;
 for(const f of friends){
  const distance=f.distance??Math.hypot(f.dx,f.dy);
  const projection=f.dx*ux+f.dy*uy;
  const sideways=Math.abs(f.dx*uy-f.dy*ux);
  // A nearby friend can move into the weapon over the next 18 physics ticks.
  if(distance<105)return true;
  if(explosive&&distance<390)return true;
  if(projection>=-15&&projection<maxRange&&
     sideways<(melee?105:flame?170:explosive?320:165))return true;
  if(explosive&&o.target&&Math.hypot(o.target.dx-f.dx,o.target.dy-f.dy)<320)return true;
 }
 return false;
}

function commandFor(o,action,{spatial=true,friends=true}={}){
 const raw=Old.policyCommand(o,action);
 let result=spatial?steerAroundHazards(o,raw):{command:raw,redirected:false};
 let cmd=result.command,protectedFriend=false;
 if(friends&&friendInFiringLane(o,cmd)){
  cmd={...cmd,fire:false,grenade:false};protectedFriend=true;
 }
 return {command:cmd,redirected:result.redirected,protectedFriend,action};
}
function sightReward(before,after,done){
 const riskBefore=before.terrain?.here||0,riskAfter=after.terrain?.here||0;
 const friendshipViolation=Math.max(0,(after.sealWarnings||0)-(before.sealWarnings||0));
 const yetiEnraged=!before.yeti?.angry&&!!after.yeti?.angry;
 return +(Old.rewardFor(before,after,done)-
  .10*riskAfter-.35*Math.max(0,riskAfter-riskBefore)-
  140*friendshipViolation-(yetiEnraged?140:0)).toFixed(3);
}
module.exports={VERSION,DIRS,Old,SightLearner,observationKey,commandFor,steerAroundHazards,friendInFiringLane,sightReward};
