/* BEAN Emperor Q3: keep actual Q2 memory while learning the missing
 * momentum/braking context. Independent experimental policy, not a rewrite. */
"use strict";
const Previous=require("./bean-sight.cjs"),Old=Previous.Old;
const VERSION=3;
const bucket=(v,breaks)=>breaks.reduce((n,x)=>n+(v>x?1:0),0);
function stateKey(o){
 const old=Previous.observationKey(o);
 const target=o.target||{dx:1,dy:0},v=Math.hypot(o.vx||0,o.vy||0);
 const toward=v>0.1?((o.vx||0)*target.dx+(o.vy||0)*target.dy)/(v*(Math.hypot(target.dx,target.dy)||1)):0;
 const trajectory=o.terrain?.driftRays||[];
 const risk=trajectory.length===8?Math.max(...trajectory):0;
 return old+"|v3:"+[bucket(v,[2,5]),bucket(toward,[-.4,.4]),bucket(o.terrain?.stopRisk||0,[2.5,8]),
   bucket(risk,[3.5,12])].join(".");
}
class Learner extends Old.QLearner{
 constructor({parentQ2=null,...args}={}){
  super({alpha:.12,gamma:.95,epsilon:.23,...args});
  if(!parentQ2||parentQ2.version!==2||!parentQ2.table)
   throw Error("Required original learned Q2 snapshot, refusing to start from scratch");
  this.parentQ2=parentQ2;this.seededFromQ2=0;
 }
 values(key){
  if(!this.table[key]){
   const prevKey=key.split("|v3:")[0];
   const prior=this.parentQ2.table[prevKey];
   this.table[key]=prior?prior.slice():Array(Old.ACTIONS.length).fill(0);
   if(prior)this.seededFromQ2++;
  }
  return this.table[key];
 }
 select(o,{explore=true}={}){
  const allowed=Old.legalActions(o),row=this.values(stateKey(o));
  if(explore&&this.random()<this.epsilon)return allowed[Math.floor(this.random()*allowed.length)];
  let high=-Infinity,ties=[];
  for(const action of allowed){
   if(row[action]>high+1e-9){high=row[action];ties=[action];}
   else if(Math.abs(row[action]-high)<1e-9)ties.push(action);
  }
  return ties[Math.floor(this.random()*ties.length)];
 }
 update(a,action,reward,b,done=false){
  if(!Number.isFinite(reward)||!Number.isInteger(action)||action<0||action>=Old.ACTIONS.length)throw Error("Invalid update");
  const cur=this.values(stateKey(a));
  const next=this.values(stateKey(b));
  const target=reward+(done?0:this.gamma*Math.max(...Old.legalActions(b).map(i=>next[i])));
  cur[action]+=this.alpha*(target-cur[action]);this.updates++;
 }
 snapshot(){return {version:VERSION,alpha:this.alpha,gamma:this.gamma,epsilon:this.epsilon,
   updates:this.updates,seededFromQ2:this.seededFromQ2,table:this.table};}
}
module.exports={VERSION,Learner,stateKey,Previous,Old};