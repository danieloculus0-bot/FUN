#!/usr/bin/env node
/* Verify all 3000 original-physics BEAN Q3 decision ledgers and compare
 * on identical new seeds. Q3 must beat the equally assisted predecessor
 * to justify policy promotion. No fabricated game results. */
"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {game,episode,Q}=require("./bean-retry-engine.cjs");
const parentDir=process.env.BEAN_PARENT_DIR,shardRoot=process.env.BEAN_SHARD_ROOT;
if(!parentDir||!shardRoot)throw Error("Parent checkpoint and all 6 shard artifacts required");
const load=(dir,name)=>fs.readFileSync(path.join(dir,name),"utf8");
const parentRaw=load(parentDir,"bean-sight-3000-policy-q2.json");
const parent=JSON.parse(parentRaw);
const earlier=JSON.parse(load(parentDir,"bean-sight-3000-summary.json"));
const history=load(parentDir,"bean-sight-3000-full-history.jsonl").trim().split("\n").map(JSON.parse);
if(parent.version!==2||parent.updates!==192712||earlier.q2Updates!==192712||
   history.filter(x=>x.kind==="training").length!==9350)throw Error("Unexpected source: expected 9350 old training games");
const hash=crypto.createHash("sha256").update(parentRaw).digest("hex");
const historicalSeeds=new Set(history.filter(x=>x.kind==="training").map(x=>x.seed));
const shards=[],fresh=[],visits=new Map(),causes={};
for(let n=0;n<6;n++){
 const folder=path.join(shardRoot,"bean-retry-shard-"+n);
 const manifest=JSON.parse(load(folder,"manifest.json"));
 const policy=JSON.parse(load(folder,"q3-policy.json"));
 const episodes=load(folder,"episodes.jsonl").trim().split("\n").map(JSON.parse);
 if(manifest.shard!==n||manifest.episodes!==500||episodes.length!==500||
   manifest.parentSha256!==hash||manifest.parentRun!==39549202298||policy.version!==3||
   policy.updates!==episodes.reduce((count,r)=>count+r.steps,0))throw Error("Bad Q3 batch "+n);
 let kills=0,warnings=0,redirects=0,protections=0;
 for(let i=0;i<500;i++){
  const e=episodes[i],seed=44000001+(n*500+i)*59;
  if(e.seed!==seed||historicalSeeds.has(seed)||e.trace?.seed!==seed||e.trace.version!==3||
   e.kind!=="training"||e.policy!=="Q3 momentum-aware"||e.trace.rows.length!==e.steps||
   e.trace.rows.at(-1)?.[4]!==1)throw Error("Corrupt/duplicate episode "+n+":"+i);
  historicalSeeds.add(seed);
  let mReward=0,mRedirects=0,mProtections=0;
  for(let j=0;j<e.trace.rows.length;j++){
   const row=e.trace.rows[j];
   if(!Array.isArray(row)||row.length!==10||row[0]<0||row[0]>=e.trace.states.length||
    row[3]<0||row[3]>=e.trace.states.length||!Number.isInteger(row[1])||
    row[1]<0||row[1]>=Q.Old.ACTIONS.length||!Number.isInteger(row[2])||
    ![0,1].includes(row[4])||(j<e.trace.rows.length-1&&row[4])||
    !Number.isInteger(row[8])||row[8]<0||row[8]>3||
    !Number.isInteger(row[9])||row[9]<0||row[9]>3)throw Error("Invalid Q3 transition "+n+":"+i+":"+j);
   const state=e.trace.states[row[0]],tag=n+"\x00"+state+"\x00"+row[1];
   visits.set(tag,(visits.get(tag)||0)+1);
   mReward+=row[2];mRedirects+=row[8];mProtections+=row[9];
  }
  if(e.trace.rows.at(-1)[5]!==e.kills||Math.abs(mReward/1000-e.reward)>.025||
    mRedirects!==e.pathRedirects||mProtections!==e.friendPrevents)
    throw Error("Q3 ledger numeric mismatch "+n+":"+i);
  kills+=e.kills;warnings+=e.sealWarnings;redirects+=e.pathRedirects;
  protections+=e.friendPrevents;
  causes[e.termination]=(causes[e.termination]||0)+1;
 }
 if(kills!==manifest.killsTotal||warnings!==manifest.sealWarnings||
    redirects!==manifest.pathRedirects||protections!==manifest.friendPrevents)
  throw Error("Q3 shard totals inconsistent "+n);
 fresh.push(...episodes);shards.push({n,manifest,policy});
}
if(fresh.length!==3000||new Set(fresh.map(x=>x.seed)).size!==3000)throw Error("Less than 3000 genuine games");
const keys=new Set(shards.flatMap(s=>Object.keys(s.policy.table)));
const merged=Object.create(null);
for(const key of keys){
 const ancestor=parent.table[key.split("|v3:")[0]]||Array(Q.Old.ACTIONS.length).fill(0);
 const dst=Array(Q.Old.ACTIONS.length).fill(0);
 for(let a=0;a<dst.length;a++){
  let sum=ancestor[a]*2,weight=2;
  for(const s of shards){
   const v=visits.get(s.n+"\x00"+key+"\x00"+a)||0;
   if(v){sum+=v*s.policy.table[key][a];weight+=v;}
  }
  dst[a]=sum/weight;
 }
 merged[key]=dst;
}
const policy={version:3,alpha:.14,gamma:.95,epsilon:0,
 updates:shards.reduce((n,s)=>n+s.policy.updates,0),
 seededFromQ2:shards.reduce((n,s)=>n+(s.policy.seededFromQ2||0),0),table:merged};
const env=game(),heldout=[],testLedger=[],N=48;
const actors={
 "previous-q2":new Q.Previous.SightLearner({parentSnapshot:null,table:Object.assign(Object.create(null),parent.table),
  epsilon:0,alpha:parent.alpha,gamma:parent.gamma,seed:33}),
 "old-q2-assisted":new Q.Previous.SightLearner({parentSnapshot:null,table:Object.assign(Object.create(null),parent.table),
  epsilon:0,alpha:parent.alpha,gamma:parent.gamma,seed:33}),
 "new-q3":new Q.Learner({parentQ2:parent,table:merged,epsilon:0,seed:33})
};
for(let i=0;i<N;i++){
 const seed=55000001+i*137;
 if(historicalSeeds.has(seed))throw Error("Test seed collides with training");
 const row={seed};
 for(const name of ["previous-q2","old-q2-assisted","new-q3"]){
  const runner=name==="previous-q2"?"old":name==="old-q2-assisted"?"assisted":"new";
  let e;
  if(runner==="old"){
   // Historical 18-tick control cadence for unmodified Q2 comparison.
   const H=require("./bean-sight-headless.cjs");
   e=H.episode(env,actors[name],seed,{train:false,mode:"sighted",stepsMax:600,log:true});
  }else{
   e=episode(env,actors[name],seed,{mode:"q3",maxDecisions:600,log:true});
  }
  row[name]={kills:e.kills,steps:e.steps,cause:e.termination,warnings:e.sealWarnings,
   redirects:e.pathRedirects,friendPrevents:e.friendPrevents};
  testLedger.push({kind:"holdout",policy:name,seed,record:e});
 }
 heldout.push(row);
}
const mean=(name,key)=>heldout.reduce((s,r)=>s+r[name][key],0)/N;
const holdout=Object.fromEntries(["previous-q2","old-q2-assisted","new-q3"].map(name=>[name,{
 meanKills:mean(name,"kills"),meanDecisions:mean(name,"steps"),
 sealWarnings:heldout.reduce((s,r)=>s+r[name].warnings,0),
 bestKills:Math.max(...heldout.map(r=>r[name].kills)),
 deaths:heldout.reduce((obj,r)=>(obj[r[name].cause]=(obj[r[name].cause]||0)+1,obj),{})
}]));
const delta=heldout.map(r=>r["new-q3"].kills-r["old-q2-assisted"].kills);
const gain=delta.reduce((s,x)=>s+x,0)/N;
const sd=Math.sqrt(delta.reduce((s,x)=>s+(x-gain)**2,0)/(N-1));
const margin=1.96*sd/Math.sqrt(N);
const promotion=gain-margin>0&&holdout["new-q3"].sealWarnings<=holdout["old-q2-assisted"].sealWarnings;
const report={
 experiment:"BEAN retry 3000 momentum-aware Q3",originalGamePhysics:true,
 parentTrainingEpisodes:9350,additionalTrainingEpisodes:3000,
 totalTrainingEpisodes:12350,parallelShards:6,
 trainingBest:Math.max(...fresh.map(x=>x.kills)),
 allTimeBest:Math.max(86,...fresh.map(x=>x.kills)),
 trainingTotalKills:fresh.reduce((n,x)=>n+x.kills,0),
 trainingMeanKills:fresh.reduce((n,x)=>n+x.kills,0)/3000,
 trainingSealWarnings:fresh.reduce((n,x)=>n+x.sealWarnings,0),
 trainingFriendPreventions:fresh.reduce((n,x)=>n+x.friendPrevents,0),
 trainingPathRedirections:fresh.reduce((n,x)=>n+x.pathRedirects,0),
 trainingDeaths:causes,
 q3States:Object.keys(merged).length,q3Updates:policy.updates,
 priorQ2States:Object.keys(parent.table).length,
 priorQ2Updates:parent.updates,holdoutCount:N,holdout,
 pairedMeanQ3MinusEquallyAssistedQ2:gain,
 approx95pctPairedCI:[gain-margin,gain+margin],
 promotionSupported:promotion,
 championRetained:!promotion,priorSourceRun:39549202298,
 reproducibility:{trainingSeed:"44000001+(shard*500+i)*59",testSeed:"55000001+i*137",
  gameTicksPerDecision:18,steeringReassessmentTicks:6,maxDecisions:600},
 limitations:"Six parallel 500-match learners, not one serial 3000-game brain. Simulator state information is not camera vision. A single benchmark does not guarantee generalization.",
 shardManifests:shards.map(s=>s.manifest),pairedHeldout:heldout
};
fs.writeFileSync("bean-retry-3000-summary.json",JSON.stringify(report,null,2)+"\n");
fs.writeFileSync("bean-retry-3000-policy-q3.json",JSON.stringify(policy)+"\n");
fs.writeFileSync("bean-retry-3000-new-ledger.jsonl",fresh.map(e=>JSON.stringify(e)).join("\n")+"\n");
fs.writeFileSync("bean-retry-3000-full-history.jsonl",history.concat(fresh).map(e=>JSON.stringify(e)).join("\n")+"\n");
fs.writeFileSync("bean-retry-3000-holdout-ledger.jsonl",testLedger.map(e=>JSON.stringify(e)).join("\n")+"\n");
console.log("BEAN RETRY 3000 VERIFIED");
console.log(JSON.stringify({...report,shardManifests:"in archive",pairedHeldout:"in archive"},null,2));
