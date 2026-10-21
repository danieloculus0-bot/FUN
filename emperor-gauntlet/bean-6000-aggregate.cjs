#!/usr/bin/env node
/* BEAN second 3000-episode auditable reconciliation and unseen-seed evaluation.
 * Six agents start from the same saved parent. We reconcile all observed
 * episode traces, retain complete history, and compare frozen candidates. */
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const Q=require("./bean-q.js");
const read=(dir,file)=>fs.readFileSync(path.join(dir,file),"utf8");
const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
const shardRoot=process.env.BEAN_SHARD_ROOT,parentDir=process.env.BEAN_PARENT_DIR,
 championDir=process.env.BEAN_CHAMPION_DIR;
if(!shardRoot||!parentDir||!championDir)throw Error("All three source artifact directories required");
const parentText=read(parentDir,"bean-emperor-6000-policy-merged.json");
const parent=JSON.parse(parentText),champion=JSON.parse(read(championDir,"bean-emperor-trained-policy.json"));
const history=read(parentDir,"bean-emperor-6000-full-history.jsonl").trim().split("\n").map(JSON.parse);
if(parent.version!==1||parent.updates!==99348||champion.updates!==3994||
  history.filter(e=>e.kind==="training").length!==3350)throw Error("Parent/champion provenance mismatch");
const parentHash=hash(parentText);
const shards=[],additional=[],allEpisodes=new Set(history.map(r=>r.kind+":"+r.seed));
const count=new Map();
function validate(r,shard){
 if(!r||r.kind!=="training"||r.shard!==shard||r.trace?.seed!==r.seed||
    r.trace?.version!==1||!Array.isArray(r.trace.states)||!Array.isArray(r.trace.rows)||
    r.trace.rows.length!==r.steps||r.steps<1||r.steps>160||
    r.trace.rows.at(-1)?.[4]!==1)throw Error("Malformed original-game receipt on shard "+shard);
 const key=r.kind+":"+r.seed;
 if(allEpisodes.has(key))throw Error("Duplicate training seed "+key);
 allEpisodes.add(key);
 let total=0;
 for(const [i,row] of r.trace.rows.entries()){
  if(row.length!==8||!Number.isInteger(row[0])||!Number.isInteger(row[3])||
     row[0]<0||row[0]>=r.trace.states.length||row[3]<0||
     row[3]>=r.trace.states.length||row[1]<0||row[1]>=Q.ACTIONS.length||
     !Number.isInteger(row[2])||![0,1].includes(row[4])||
     (i<r.trace.rows.length-1&&row[4]!==0))throw Error("Invalid transition");
  total+=row[2];
  const index=r.trace.states[row[0]]+"\u0000"+row[1];
  const signature=shard+"\u0000"+index;
  count.set(signature,(count.get(signature)||0)+1);
 }
 if(r.trace.rows.at(-1)[5]!==r.kills||Math.abs(total/1000-r.reward)>.011)
  throw Error("Failed score/reward verification");
}
for(let k=0;k<6;k++){
 const dir=path.join(shardRoot,"bean-6k-shard-"+k);
 const manifest=JSON.parse(read(dir,"manifest.json"));
 const policy=JSON.parse(read(dir,"policy.json"));
 const rows=read(dir,"episodes.jsonl").trim().split("\n").map(JSON.parse);
 if(manifest.shard!==k||manifest.episodes!==500||rows.length!==500||
    manifest.parent_policy_sha256!==parentHash||policy.version!==1||
    policy.updates-parent.updates!==manifest.additional_q_updates||
    policy.updates-parent.updates!==rows.reduce((n,r)=>n+r.steps,0))
    throw Error("Shard provenance or update-count verification failed: "+k);
 for(const r of rows)validate(r,k);
 shards.push({shard:k,manifest,policy});
 additional.push(...rows);
}
if(additional.length!==3000||new Set(additional.map(r=>r.seed)).size!==3000)
 throw Error("Required 3000 UNIQUE original-game training episodes");
const base=JSON.parse(JSON.stringify(parent));
const merged=Q.QLearner.restore(base,{seed:123131});
const allKeys=new Set([...Object.keys(parent.table),...shards.flatMap(s=>Object.keys(s.policy.table))]);
for(const state of allKeys){
 const existing=parent.table[state]||Array(Q.ACTIONS.length).fill(0);
 const output=merged.values(state);
 for(let action=0;action<Q.ACTIONS.length;action++){
  let numerator=existing[action]*2,denominator=2;
  for(const s of shards){
    const weight=count.get(s.shard+"\u0000"+state+"\u0000"+action)||0;
    if(weight){
      numerator+=weight*s.policy.table[state][action];denominator+=weight;
    }
  }
  output[action]=numerator/denominator;
 }
}
merged.updates=parent.updates+additional.reduce((n,r)=>n+r.steps,0);
const mergedSnapshot=merged.snapshot();
// Ledger replay is explicitly off-policy: use observed transitions and known,
// always-legal action subset for the bootstrap, not a fabricated full state.
const replay=Q.QLearner.restore(mergedSnapshot,{alpha:.045,seed:9401});
let replayCount=0;
for(const ep of additional){
 const states=ep.trace.states;
 for(const [sid,action,milli,nid,done] of ep.trace.rows){
  const q=replay.values(states[sid]),n=replay.values(states[nid]);
  const safe=[0,1,2,3,4,5,6,7,14];
  const target=milli/1000+(done?0:replay.gamma*Math.max(...safe.map(a=>n[a])));
  q[action]+=replay.alpha*(target-q[action]);replay.updates++;replayCount++;
 }
}
const replaySnapshot=replay.snapshot();
const candidateSnapshots={champion,incumbent:parent,merged:mergedSnapshot,replayed:replaySnapshot};
const source=fs.readFileSync(path.join(__dirname,"play.html"),"utf8");
const script=source.match(/<script>\s*(\(\(\) => \{[\s\S]*?\}\)\(\);)\s*<\/script>/)?.[1];
if(!script)throw Error("No original game logic");
const node=()=>({hidden:false,textContent:"",classList:{add(){},remove(){}},
 addEventListener(){},getContext(){return{};},focus(){},
 getBoundingClientRect(){return{left:0,top:0,width:1000,height:640}}});
const nodes=Object.fromEntries(["game","overlay","overlay-kicker","overlay-title","overlay-copy","overlay-hint",
"play-button","pause-button","fullscreen-button","game-status","game-frame","touch-shove","touch-grenade",
"touch-swap","sound-button","touch-prev","touch-next","touch-select","touch-start"].map(k=>[k,node()]));
const window={addEventListener(){}};
vm.runInNewContext(script,{window,document:{getElementById:k=>nodes[k],querySelectorAll:()=>[],addEventListener(){},hidden:false},
location:{search:"?bean=1"},URLSearchParams,localStorage:{getItem(){return null},setItem(){}},requestAnimationFrame(){}},{filename:"EmperorGauntlet.original.js"});
const env=window.__EG_BEAN_GAME;
if(!env||env.version!==1)throw Error("Wrong game engine");
const evaluation=[];
function play(seed,name,record=false){
 const actor=name==="random"?new Q.QLearner({epsilon:1,seed:seed+19}):
  Q.QLearner.restore(candidateSnapshots[name],{epsilon:0,seed:seed^0x4f2ba571});
 let obs=env.reset(seed),rewardTotal=0,steps=0;
 const trace=record?new Q.Trace(seed):null;
 for(;steps<160&&obs.status==="running";steps++){
  const action=actor.select(obs,{explore:name==="random"});
  env.act(Q.policyCommand(obs,action));
  const next=env.step(18),done=next.status!=="running"||steps===159;
  const reward=Q.rewardFor(obs,next,next.status!=="running");
  if(trace)trace.add(obs,action,reward,next,done);
  rewardTotal+=reward;obs=next;
 }
 if(trace)evaluation.push({kind:"evaluation",policy:name,seed,kills:obs.kills,
   steps,wave:obs.wave,reward:+rewardTotal.toFixed(3),trace:trace.export()});
 return obs.kills;
}
const validation=[];
for(let i=0;i<20;i++){
 const seed=13000001+i*101;
 const row={seed};
 for(const name of Object.keys(candidateSnapshots))row[name]=play(seed,name);
 validation.push(row);
}
const average=(rows,k)=>rows.reduce((n,r)=>n+r[k],0)/rows.length;
const validationMean=Object.fromEntries(Object.keys(candidateSnapshots).map(k=>[k,average(validation,k)]));
const selected=Object.keys(candidateSnapshots).sort((a,b)=>
 validationMean[b]-validationMean[a]||["champion","incumbent","merged","replayed"].indexOf(a)-
 ["champion","incumbent","merged","replayed"].indexOf(b))[0];
const holdout=[];
for(let i=0;i<48;i++){
 const seed=12000001+i*97,row={seed,random:play(seed,"random",true)};
 for(const name of Object.keys(candidateSnapshots))row[name]=play(seed,name,true);
 holdout.push(row);
}
const mean=Object.fromEntries(["random",...Object.keys(candidateSnapshots)].map(k=>[k,average(holdout,k)]));
const diffs=holdout.map(r=>r[selected]-r.incumbent);
const pairedMean=diffs.reduce((a,b)=>a+b,0)/diffs.length;
const std=Math.sqrt(diffs.reduce((n,x)=>n+(x-pairedMean)**2,0)/(diffs.length-1));
const ci=1.96*std/Math.sqrt(diffs.length);
const promoted=selected!=="incumbent"&&pairedMean>0&&pairedMean-ci>0;
const best=Math.max(35,...additional.map(x=>x.kills));
const report={experiment:"BEAN next 3000 distributed Q-learning Emperor Gauntlet",
  actual_game_physics:true,prior_training_episodes:3350,training_episodes_this_run:3000,
  parallel_shards:6,episodes_per_shard:500,unique_training_seeds:allEpisodes.size-
    history.length,previous_q_updates:parent.updates,distributed_updates:merged.updates-parent.updates,
  replayed_training_transitions:replayCount,merged_q_updates:merged.updates,
  replay_policy_updates:replay.updates,merged_states:Object.keys(mergedSnapshot.table).length,
  previous_record:35,best_new_run:Math.max(...additional.map(x=>x.kills)),
  overall_record:best,mean_training_kills:additional.reduce((n,x)=>n+x.kills,0)/3000,
  validation_mean:validationMean,validation_selected_policy:selected,
  new_holdout_episodes:48,heldout_average_kills:mean,
  selected_vs_previous_merged_mean_difference:pairedMean,
  selected_vs_original_champion_mean_difference:mean[selected]-mean.champion,
  new_episodes_without_seed_collisions:additional.length,
  approx_95pct_ci_selected_minus_previous_merged:[pairedMean-ci,pairedMean+ci],
  promotion_supported:promoted,
  final_policy_to_preserve:promoted?selected:"incumbent",
  reproducibility:{training_seeds:"11000001 + (shard*500 + episode)*53",
   validation_seeds:"13000001 + i*101",holdout_seeds:"12000001 + i*97",
   parent_artifact_run:39545071171,champion_artifact_run:39543055899},
  limitations:"3000 genuine runs across 6 parallel Q-learners; aggregation and off-policy replay are not identical to 3000 serial online episodes. CI is approximate; avoid equating game policy with general intelligence.",
  shard_manifests:shards.map(s=>s.manifest),validation,holdout};
fs.writeFileSync("bean-emperor-6000-summary.json",JSON.stringify(report,null,2)+"\n");
fs.writeFileSync("bean-emperor-6000-ledger.jsonl",additional.map(r=>JSON.stringify(r)).join("\n")+"\n");
fs.writeFileSync("bean-emperor-6000-full-history.jsonl",[...history,...additional].map(r=>JSON.stringify(r)).join("\n")+"\n");
fs.writeFileSync("bean-emperor-6000-evaluation.jsonl",evaluation.map(r=>JSON.stringify(r)).join("\n")+"\n");
for(const [name,policy]of Object.entries(candidateSnapshots))
 fs.writeFileSync("bean-emperor-6000-policy-"+name+".json",JSON.stringify(policy)+"\n");
console.log("BEAN 6000 VERIFIED EXPERIMENT");
console.log(JSON.stringify({...report,shard_manifests:"see artifact",validation:"see artifact",holdout:"see artifact"},null,2));
