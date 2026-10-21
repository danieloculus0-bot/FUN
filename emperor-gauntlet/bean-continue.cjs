#!/usr/bin/env node
/* BEAN learns again from REAL Emperor Gauntlet physics and a validated,
 * previous Q-policy + episode ledger (GitHub Actions artifact).
 * Emits full-chain ledger, updated policy and independent paired evaluation. */
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),crypto=require("node:crypto");
const Q=require("./bean-q.js");
const PREVIOUS_RUN="39543055899";
const PREVIOUS_SHA="051a8df1ed3916dff1b334775affc6666df3881b";
const ROOT=process.env.BEAN_RESUME_DIR;
if(!ROOT)throw Error("BEAN_RESUME_DIR must point to downloaded prior-run artifact; refusing cold start");
function read(name){return fs.readFileSync(path.join(ROOT,name),"utf8");}
const priorPolicy=JSON.parse(read("bean-emperor-trained-policy.json"));
const priorEpisodes=read("bean-emperor-episode-ledger.jsonl").trim().split("\n").map(JSON.parse);
const priorBenchmark=JSON.parse(read("bean-emperor-benchmark.json"));
if(priorBenchmark.training_episodes!==150||priorPolicy.version!==1||priorPolicy.updates!==3994)
 throw Error("Unexpected predecessor policy or benchmark");
const seen=new Set(),trainReceipts=[];
for(const ep of priorEpisodes){
 if(ep.sourceCommit!==PREVIOUS_SHA||ep.trace?.version!==1||ep.trace?.seed!==ep.seed)
   throw Error("Source provenance/seed mismatch in stored episode");
 if(!Number.isInteger(ep.seed)||!Number.isInteger(ep.steps)||ep.steps!==ep.trace.rows?.length||
    !Array.isArray(ep.trace.states)||ep.trace.states.some(s=>typeof s!=="string")||
    !["training","random-control","learned-holdout"].includes(ep.kind))throw Error("Malformed prior episode");
 const identity=ep.kind+":"+ep.seed;if(seen.has(identity))throw Error("Duplicate prior episode");seen.add(identity);
 let count=0,score=0,sum=0;
 for(const [i,row] of ep.trace.rows.entries()){
   if(row.length!==8||row[0]<0||row[0]>=ep.trace.states.length||row[3]<0||
      row[3]>=ep.trace.states.length||row[1]<0||row[1]>=Q.ACTIONS.length||
      (row[4]!==0&&row[4]!==1)||(!Number.isInteger(row[2]))||
      (i<ep.steps-1&&row[4]!==0))throw Error("Invalid old ledger transition");
   count++;score=row[5];sum+=row[2];
 }
 if(score!==ep.kills||Math.abs(sum/1000-ep.reward)>.011||
    ep.trace.rows.at(-1)?.[4]!==1)throw Error("Score/reward mismatch in previous ledger");
 if(ep.kind==="training")trainReceipts.push(ep);
}
const originalUpdates=trainReceipts.reduce((total,ep)=>total+ep.steps,0);
if(originalUpdates!==priorPolicy.updates||trainReceipts.length!==150||
    priorEpisodes.length!==150+2*priorBenchmark.heldout_count)
 throw Error("Saved Q checkpoint inconsistent with full training receipts");
const oldPolicyHash=crypto.createHash("sha256").update(JSON.stringify(priorPolicy)).digest("hex");
const oldLedgerHash=crypto.createHash("sha256").update(read("bean-emperor-episode-ledger.jsonl")).digest("hex");
const q=Q.QLearner.restore(priorPolicy,{seed:155201});
const frozen=Q.QLearner.restore(priorPolicy,{seed:155201});
const oldStateCount=Object.keys(q.table).length,oldUpdates=q.updates;
if(oldStateCount!==priorBenchmark.q_states)throw Error("Stored Q states disagree with benchmark");
const source=fs.readFileSync(path.join(__dirname,"play.html"),"utf8");
const match=source.match(/<script>\s*(\(\(\) => \{[\s\S]*?\}\)\(\);)\s*<\/script>/);
if(!match)throw Error("Original game script missing");
function createEnvironment(){
 const node=()=>({hidden:false,textContent:"",classList:{add(){},remove(){}},
   addEventListener(){},getContext(){return{};},focus(){},getBoundingClientRect(){return{width:1000,height:640,left:0,top:0};}});
 const keys=["game","overlay","overlay-kicker","overlay-title","overlay-copy","overlay-hint","play-button","pause-button","fullscreen-button","game-status","game-frame","touch-shove","touch-grenade","touch-swap","sound-button","touch-prev","touch-next","touch-select","touch-start"];
 const nodes=Object.fromEntries(keys.map(k=>[k,node()]));
 const window={addEventListener(){}};
 const document={getElementById:key=>nodes[key],querySelectorAll:()=>[],addEventListener(){},hidden:false};
 const context={window,document,location:{search:"?bean=1"},URLSearchParams,localStorage:{getItem(){return null;},setItem(){}},requestAnimationFrame(){}};
 vm.runInNewContext(match[1],context,{filename:"game-original.js"});
 if(!window.__EG_BEAN_GAME)throw Error("Game learning adapter not available");
 return window.__EG_BEAN_GAME;
}
const env=createEnvironment();
const STEPS=Number(process.env.BEAN_STEPS||160),TICKS=Number(process.env.BEAN_TICKS||18);
const EXTRA=Number(process.env.BEAN_EXTRA_TRAIN||200),HELDOUT=Number(process.env.BEAN_HOLDOUT||32);
if(!Number.isInteger(EXTRA)||EXTRA<1||EXTRA>2000||!Number.isInteger(HELDOUT)||HELDOUT<12||
   HELDOUT>200)throw Error("Invalid experiment dimensions");
const receipts=priorEpisodes.slice();
function run(seed,{agent=q,learning=false,random=false,kind=null}={}){
 const actor=random?new Q.QLearner({epsilon:1,seed:seed+877}):agent;
 // Independent tie-breaking and exploration RNG for reproducible paired trials.
 if(!random)actor.rngState=(seed^0x4f2ba571)>>>0||1;
 let obs=env.reset(seed),total=0,steps=0;
 const trace=new Q.Trace(seed);
 for(;steps<STEPS&&obs.status==="running";steps++){
   const action=actor.select(obs,{explore:random||learning});
   env.act(Q.policyCommand(obs,action));
   const next=env.step(TICKS);
   const done=next.status!=="running"||steps===STEPS-1;
   const reward=Q.rewardFor(obs,next,next.status!=="running");
   trace.add(obs,action,reward,next,done);
   if(learning)q.update(obs,action,reward,next,done);
   total+=reward;obs=next;
 }
 const result={seed,kills:obs.kills,wave:obs.wave,steps,reason:obs.cause,reward:+total.toFixed(3)};
 if(kind)receipts.push({kind,...result,gameVersion:env.version,
   sourceCommit:process.env.GITHUB_SHA||"local",trace:trace.export()});
 return result;
}
// True ledger rehearsal. Since old checkpoint already includes all original
// transitions, only a small additional Q-update pass is used. The compact v1
// trace lacks next-state available-ammo masks, so bootstrap uses the 9 actions
// always legal; this is a *conservative replay target*, not fabricated actions.
const originalAlpha=q.alpha;
q.alpha=Math.min(q.alpha,.06);
let replayed=0;
for(const ep of trainReceipts){
 const legend=ep.trace.states;
 for(const [stateId,action,rewardInt,nextId,done] of ep.trace.rows){
   const current=q.values(legend[stateId]),next=q.values(legend[nextId]);
   const legalAlways=[0,1,2,3,4,5,6,7,14];
   const target=rewardInt/1000+(done?0:q.gamma*Math.max(...legalAlways.map(i=>next[i])));
   current[action]+=q.alpha*(target-current[action]);
   replayed++;q.updates++;
 }
}
q.alpha=originalAlpha;
if(replayed!==3994)throw Error("Incomplete replay");
const baseline=[];
const newHoldoutSeed=i=>990001+i*101; // unseen in previous 800001 seed block
for(let i=0;i<HELDOUT;i++){
 const seed=newHoldoutSeed(i);
 baseline.push({seed,random:run(seed,{random:true}).kills,
   previous:run(seed,{agent:frozen}).kills,
   rehearsed:run(seed,{agent:q}).kills});
}
const training=[];
for(let i=0;i<EXTRA;i++){
 const absolute=151+i,seed=100000+absolute*37;
 if(seen.has("training:"+seed))throw Error("Training seed reused");
 q.epsilon=Math.max(.025,.18*Math.exp(-i/160));
 training.push(run(seed,{learning:true,kind:"training"}));
}
const holdout=[];
for(let i=0;i<HELDOUT;i++){
 const r=baseline[i],seed=r.seed;
 holdout.push({...r,continued:run(seed,{agent:q,kind:"learned-holdout"}).kills});
}
const mean=(rows,key)=>rows.reduce((n,r)=>n+r[key],0)/rows.length;
const diff=holdout.map(x=>x.continued-x.previous);
const average=diff.reduce((a,b)=>a+b,0)/diff.length;
const sd=Math.sqrt(diff.reduce((a,b)=>a+(b-average)**2,0)/(diff.length-1));
const ci=1.96*sd/Math.sqrt(diff.length);
const result={
 experiment:"continued-BEAN-emperor-gauntlet",game:"original-HTML-physics",
 resumed_from_run:PREVIOUS_RUN,resumed_from_commit:PREVIOUS_SHA,
 original_policy_sha256:oldPolicyHash,original_ledger_sha256:oldLedgerHash,
 validated_prior_episodes:priorEpisodes.length,prior_training_episodes:trainReceipts.length,
 prior_policy_states:oldStateCount,prior_q_updates:oldUpdates,
 replayed_prior_decisions:replayed,extra_training_episodes:EXTRA,
 extra_training_best:Math.max(...training.map(x=>x.kills)),
 extra_training_mean:mean(training,"kills"),all_training_best:Math.max(24,...training.map(x=>x.kills)),
 new_policy_states:Object.keys(q.table).length,new_policy_updates:q.updates,
 new_policy_epsilon:q.epsilon,heldout_count:HELDOUT,
 heldout_random_mean:mean(holdout,"random"),heldout_prior_policy_mean:mean(holdout,"previous"),
 heldout_rehearsed_prior_mean:mean(holdout,"rehearsed"),
 heldout_continued_policy_mean:mean(holdout,"continued"),
 paired_gain_continued_minus_prior:average,
 approx_95pct_ci_paired_gain:[average-ci,average+ci],
 holdout,
 evidence_note:"Reward-driven tabular Q-policy on arcade game, not BEAN language-model weights. CI is approximate; independent repeats recommended.",
 reproducibility:{new_train_seed:"100000 + absolute_episode*37, starting episode 151",
  new_holdout_seed:"990001 + index*101",steps:STEPS,ticks_per_step:TICKS,
  predecessor_artifact:12320048487}
};
fs.writeFileSync("bean-emperor-continued-benchmark.json",JSON.stringify(result,null,2)+"\n");
fs.writeFileSync("bean-emperor-full-chain-ledger.jsonl",receipts.map(x=>JSON.stringify(x)).join("\n")+"\n");
fs.writeFileSync("bean-emperor-continued-policy.json",JSON.stringify(q.snapshot())+"\n");
fs.writeFileSync("bean-emperor-previous-policy.json",JSON.stringify(priorPolicy)+"\n");
console.log("BEAN CONTINUED WITH VALIDATED LEDGER");
console.log(JSON.stringify({...result,holdout:"available in artifact"},null,2));
