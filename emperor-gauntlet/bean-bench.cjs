#!/usr/bin/env node
/* Headless Emperor Gauntlet benchmark. ORIGINAL HTML physics, not a toy game.
 * Reproducible training seeds, independent held-out seeds, honest output. */
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const Q=require("./bean-q.js");
const source=fs.readFileSync(path.join(__dirname,"play.html"),"utf8");
const match=source.match(/<script>\s*(\(\(\) => \{[\s\S]*?\}\)\(\);)\s*<\/script>/);
if(!match)throw Error("Original game script missing");
function createEnvironment(){
 const node=()=>({hidden:false,textContent:"",classList:{add(){},remove(){}},
    addEventListener(){},getContext(){return{};},focus(){},getBoundingClientRect(){return{width:1000,height:640,left:0,top:0};}});
 const nodes=Object.fromEntries(["game","overlay","overlay-kicker","overlay-title","overlay-copy","overlay-hint","play-button","pause-button","fullscreen-button","game-status","game-frame","touch-shove","touch-grenade","touch-swap","sound-button","touch-prev","touch-next","touch-select","touch-start"].map(k=>[k,node()]));
 const window={addEventListener(){}};
 const document={getElementById:key=>nodes[key],querySelectorAll:()=>[],addEventListener(){},hidden:false};
 const context={window,document,location:{search:"?bean=1"},URLSearchParams,localStorage:{getItem(){return null;},setItem(){}},requestAnimationFrame(){}};
 vm.runInNewContext(match[1],context,{filename:"game-original.js"});
 return window.__EG_BEAN_GAME;
}
const env=createEnvironment();
const STEPS=Number(process.env.BEAN_STEPS||160),TICKS=Number(process.env.BEAN_TICKS||18);
const TRAIN=Number(process.env.BEAN_TRAIN||40),HELDOUT=Number(process.env.BEAN_HOLDOUT||12);
const q=new Q.QLearner({epsilon:.30,alpha:.25,seed:819});
const trainHistory=[];
function run(seed,{learning=false,random=false}={}){
 const actor=random?new Q.QLearner({epsilon:1,seed:seed+877}):q;
 let o=env.reset(seed),total=0,steps=0;
 for(;steps<STEPS&&o.status==="running";steps++){
  const a=actor.select(o,{explore:random||learning});
  env.act(Q.policyCommand(o,a));
  const after=env.step(TICKS);
  const done=after.status!=="running"||steps===STEPS-1;
  const reward=Q.rewardFor(o,after,after.status!=="running");
  if(learning)q.update(o,a,reward,after,done);
  total+=reward;o=after;
 }
 return {seed,kills:o.kills,wave:o.wave,steps,reason:o.cause,reward:+total.toFixed(2)};
}
const t0=Date.now();
for(let i=0;i<TRAIN;i++){
 q.epsilon=Math.max(.05,.3*Math.exp(-i/75));
 const seed=100000+(i+1)*37;
 trainHistory.push(run(seed,{learning:true}));
}
const heldout=[];
for(let i=0;i<HELDOUT;i++){
 const seed=800001+i*101;
 const baseline=run(seed,{random:true});
 const learner=run(seed);
 heldout.push({seed,random:baseline.kills,learned:learner.kills});
}
const mean=(a,k)=>a.reduce((v,r)=>v+r[k],0)/Math.max(1,a.length);
const result={game:"emperor-gauntlet",mode:"actual-HTML-physics",training_episodes:TRAIN,
 training_best:Math.max(...trainHistory.map(x=>x.kills)),
 training_mean:mean(trainHistory,"kills"),
 heldout_count:HELDOUT,heldout_random_mean:mean(heldout,"random"),
 heldout_trained_mean:mean(heldout,"learned"),heldout,
 q_states:Object.keys(q.table).length,q_updates:q.updates,
 elapsed_ms:Date.now()-t0,
 reproducibility:{training_seed:"100000 + episode*37",holdout_seed:"800001 + index*101",max_steps:STEPS,ticks_per_step:TICKS}};
console.log("BEAN EMPEROR GAUNTLET VERIFIED BENCHMARK");
console.log(JSON.stringify(result,null,2));
fs.writeFileSync("bean-emperor-benchmark.json",JSON.stringify(result,null,2)+"\n");
if(!Number.isFinite(result.heldout_trained_mean))process.exitCode=1;
