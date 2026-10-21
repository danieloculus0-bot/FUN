/* Actual Emperor Gauntlet physics for Q3, 18-tick decisions with 3x
 * 6-tick friend/hazard replanning. Every experience is ledger-recorded. */
"use strict";
const {game}=require("./bean-sight-headless.cjs");
const Q=require("./bean-retry-q.cjs");
class Trace{
 constructor(seed){this.seed=seed;this.version=3;this.states=[];this.lookup=new Map();this.rows=[];}
 index(s){if(!this.lookup.has(s)){this.lookup.set(s,this.states.length);this.states.push(s)}return this.lookup.get(s)}
 add(a,action,reward,b,done,redirects,protection){
  this.rows.push([this.index(Q.stateKey(a)),action,Math.round(reward*1000),this.index(Q.stateKey(b)),
   done?1:0,b.kills,Math.round(b.hp),Math.round(b.temp),redirects,protection]);
 }
 export(){return{version:3,seed:this.seed,states:this.states,rows:this.rows}}
}
function episode(env,agent,seed,{train=false,mode="q3",maxDecisions=600,log=true,epsilon}={}){
 agent.rngState=((seed^0x4f2ba571)>>>0)||1;
 if(epsilon!==undefined)agent.epsilon=epsilon;
 let o=env.reset(seed),total=0,steps=0,redirections=0,protection=0;
 const trace=log?new Trace(seed):null,startWarnings=o.sealWarnings||0;
 for(;steps<maxDecisions&&o.status==="running";steps++){
  const before=o,act=agent.select(o,{explore:train});
  let actionRedirects=0,actionProtections=0;
  for(let k=0;k<3&&o.status==="running";k++){
   const plan=mode==="blind"?{command:Q.Old.policyCommand(o,act),redirected:false,protectedFriend:false}:
    Q.Previous.commandFor(o,act,{spatial:true,friends:true});
   if(plan.redirected){redirections++;actionRedirects++;}
   if(plan.protectedFriend){protection++;actionProtections++;}
   env.act(plan.command);
   o=env.step(6);
  }
  const done=o.status!=="running"||steps===maxDecisions-1;
  const reward=mode==="blind"?Q.Old.rewardFor(before,o,done):
   Q.Previous.sightReward(before,o,done);
  if(train)agent.update(before,act,reward,o,done);
  if(trace)trace.add(before,act,reward,o,done,actionRedirects,actionProtections);
  total+=reward;
 }
 return {seed,kills:o.kills,steps,wave:o.wave,ended:o.status!=="running",
  termination:o.status==="running"?"TIME_LIMIT":o.cause||"GAME_OVER",
  hp:+o.hp.toFixed(3),temp:+o.temp.toFixed(3),reward:+total.toFixed(3),
  sealWarnings:(o.sealWarnings||0)-startWarnings,pathRedirects:redirections,
  friendPrevents:protection,trace:trace?.export()||null};
}
module.exports={game,episode,Q,Trace};