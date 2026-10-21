#!/usr/bin/env node
"use strict";
/* Verify EVERY transition from all six original-physics training shards, combine
 * V2 tables using observed Q-state/action visitation, then use never-trained-on
 * paired holdout seeds to separate perception, deterministic navigation, and Q2. */
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {game,episode,Sight,Old}=require("./bean-sight-headless.cjs");
const p=process.env.BEAN_PARENT_DIR,root=process.env.BEAN_SHARD_ROOT;
if(!p||!root)throw Error("Must load archived parent and all six shards");
const read=(dir,file)=>fs.readFileSync(path.join(dir,file),"utf8");
const baseText=read(p,"bean-emperor-6000-policy-merged.json");
const base=JSON.parse(baseText),prior=read(p,"bean-emperor-6000-full-history.jsonl").trim().split("\n").map(JSON.parse);
if(base.version!==1||base.updates!==188779||
 prior.filter(e=>e.kind==="training").length!==6350)throw Error("Original 6350 training receipts/Q brain not validated");
const baseHash=crypto.createHash("sha256").update(baseText).digest("hex");
const savedKeys=new Set(prior.filter(x=>x.kind==="training").map(x=>x.seed));
const shards=[],fresh=[],visits=new Map(),originalTrainingEpisodes=6350;
for(let n=0;n<6;n++){
 const folder=path.join(root,"sight-shard-"+n);
 const manifest=JSON.parse(read(folder,"manifest.json")),policy=JSON.parse(read(folder,"q2-policy.json"));
 const episodes=read(folder,"episodes.jsonl").trim().split("\n").map(JSON.parse);
 if(manifest.shard!==n||manifest.episodes!==500||manifest.parentPolicySha256!==baseHash||
    manifest.sourceParentRun!==39546036769||policy.version!==2||
    policy.updates!==episodes.reduce((sum,r)=>sum+r.steps,0)||
    episodes.length!==500||!manifest.sourceCommit)throw Error("Bad shard manifest "+n);
 let killsSum=0,friendWarnings=0,redirects=0,protections=0;
 for(let i=0;i<500;i++){
  const e=episodes[i],seed=22000001+(n*500+i)*53;
  if(e.seed!==seed||savedKeys.has(seed)||e.trace?.version!==2||e.trace.seed!==seed||
    e.trace.rows.length!==e.steps||e.trace.rows.at(-1)?.[4]!==1||
    !["training"].includes(e.kind)||e.policy!=="hazard-aware-v2")throw Error("Bad receipt in shard "+n+", match "+i);
  savedKeys.add(seed);
  let rewards=0,protectedCount=0,redirectCount=0;
  for(const [index,row]of e.trace.rows.entries()){
   if(!Array.isArray(row)||row.length!==10||row[0]<0||row[0]>=e.trace.states.length||
    row[3]<0||row[3]>=e.trace.states.length||row[1]<0||row[1]>=Old.ACTIONS.length||
    !Number.isInteger(row[2])||![0,1].includes(row[4])||![0,1].includes(row[8])||
    ![0,1].includes(row[9])||(index<e.trace.rows.length-1&&row[4]))throw Error("Bad Q2 transition");
   const key=e.trace.states[row[0]]+"\x00"+row[1];
   const tag=n+"\x00"+key;
   visits.set(tag,(visits.get(tag)||0)+1);
   rewards+=row[2];protectedCount+=row[9];redirectCount+=row[8];
  }
  if(Math.abs(rewards/1000-e.reward)>.012||
    e.trace.rows.at(-1)[5]!==e.kills||
    protectedCount!==e.friendRedirects||redirectCount!==e.pathRedirects)
   throw Error("Q2 ledger mismatch in shard "+n+" episode "+i);
  killsSum+=e.kills;friendWarnings+=e.sealWarnings;
  redirects+=e.pathRedirects;protections+=e.friendRedirects;
 }
 if(killsSum!==manifest.killsTotal||friendWarnings!==manifest.friendWarnings||
   protections!==manifest.friendPrevents||redirects!==manifest.pathRedirects)
  throw Error("Receipt not consistent with shard manifest "+n);
 fresh.push(...episodes);
 shards.push({id:n,manifest,policy});
}
if(fresh.length!==3000||new Set(fresh.map(e=>e.seed)).size!==3000)
 throw Error("Must have 3000 genuinely distinct new games");
const allKeys=new Set(shards.flatMap(s=>Object.keys(s.policy.table)));
const mergedTable=Object.create(null);
for(const key of allKeys){
 const backing=base.table[key.split("|")[0]]||Array(Old.ACTIONS.length).fill(0);
 const row=Array(Old.ACTIONS.length).fill(0);
 for(let a=0;a<row.length;a++){
  let sum=backing[a]*2,weight=2;
  for(const s of shards){
   const n=visits.get(s.id+"\x00"+key+"\x00"+a)||0;
   if(n>0){sum+=n*s.policy.table[key][a];weight+=n;}
  }
  row[a]=sum/weight;
 }
 mergedTable[key]=row;
}
const q2={version:2,alpha:.15,gamma:.95,epsilon:0,
 updates:shards.reduce((t,s)=>t+s.policy.updates,0),
 seededStates:shards.reduce((t,s)=>t+(s.policy.seededStates||0),0),
 table:mergedTable};
const env=game(),sample=48,tests=[],testLedger=[];
const factory=()=>({
 "old-blind":new Old.QLearner({table:Object.assign(Object.create(null),base.table),alpha:base.alpha,gamma:base.gamma,epsilon:0,seed:90}),
 "old-assisted":new Old.QLearner({table:Object.assign(Object.create(null),base.table),alpha:base.alpha,gamma:base.gamma,epsilon:0,seed:90}),
 "sighted-q2":new Sight.SightLearner({parentSnapshot:base,table:mergedTable,epsilon:0,alpha:.15,gamma:.95,seed:90})
});
const agents=factory();
for(let i=0;i<sample;i++){
 const seed=33000001+i*131;
 if(savedKeys.has(seed))throw Error("Holdout seed reused");
 const row={seed};
 for(const name of ["old-blind","old-assisted","sighted-q2"]){
  const e=episode(env,agents[name],seed,{mode:name==="old-blind"?"blind":"sighted",
   train:false,stepsMax:600,log:true});
  row[name]={kills:e.kills,steps:e.steps,reason:e.termination,sealWarnings:e.sealWarnings,
   pathRedirects:e.pathRedirects,friendPrevents:e.friendRedirects};
  testLedger.push({kind:"heldout",policy:name,seed,record:e});
 }
 tests.push(row);
}
const mean=(name,key)=>tests.reduce((sum,r)=>sum+r[name][key],0)/sample;
const summary=Object.fromEntries(["old-blind","old-assisted","sighted-q2"].map(name=>[name,{
 meanKills:mean(name,"kills"),meanSteps:mean(name,"steps"),sealWarnings:tests.reduce((s,r)=>s+r[name].sealWarnings,0),
 totalFriendProtections:tests.reduce((s,r)=>s+r[name].friendPrevents,0),
 totalPathRedirects:tests.reduce((s,r)=>s+r[name].pathRedirects,0),
 best:Math.max(...tests.map(r=>r[name].kills)),
 causes:tests.reduce((out,r)=>(out[r[name].reason]=(out[r[name].reason]||0)+1,out),{})
}]));
const diffs=tests.map(r=>r["sighted-q2"].kills-r["old-assisted"].kills);
const avg=diffs.reduce((a,b)=>a+b,0)/sample;
const sd=Math.sqrt(diffs.reduce((n,x)=>n+(x-avg)**2,0)/(sample-1));
const ci=1.96*sd/Math.sqrt(sample);
const blindDiff=mean("sighted-q2","kills")-mean("old-blind","kills");
const report={
 experiment:"BEAN 3000 next-generation hazard-aware Q learning",
 actualGameEngine:true,parentTrainingEpisodes:originalTrainingEpisodes,
 newTrainingEpisodes:3000,totalTrainingEpisodes:9350,shards:6,
 genuinelyUniqueNewSeeds:3000,previousRecord:39,
 newestTrainingRecord:Math.max(...fresh.map(e=>e.kills)),
 combinedRecord:Math.max(39,...fresh.map(e=>e.kills)),
 newTrainingMean:fresh.reduce((n,e)=>n+e.kills,0)/3000,
 newTrainingDeaths:fresh.reduce((out,e)=>(out[e.termination]=(out[e.termination]||0)+1,out),{}),
 newTrainingSealWarnings:fresh.reduce((n,e)=>n+e.sealWarnings,0),
 newTrainingFriendProtections:fresh.reduce((n,e)=>n+e.friendRedirects,0),
 newTrainingPathRedirects:fresh.reduce((n,e)=>n+e.pathRedirects,0),
 q2States:Object.keys(mergedTable).length,q2Updates:q2.updates,
 q2SeededLegacyStates:q2.seededStates,
 originalV1States:Object.keys(base.table).length,originalV1Updates:base.updates,
 heldoutGames:sample,holdout:summary,
 pairedGainQ2VsAssisted:avg,approx95pctCiQ2MinusAssisted:[avg-ci,avg+ci],
 sightedVsBlindMeanGain:blindDiff,
 evidenceOfSignificantQGain:avg>0&&(avg-ci)>0,
 promotionSupported:avg>0&&(avg-ci)>0,
 sourceArtifactRun:39546036769,
 limitations:"Six parallel 500-match learners, not a single 3000-step serial agent; Q2 receives simulator geometric collision state, not screen image pixels; no guarantee of no accidental friend injury",
 reproducibility:{trainingSeed:"22000001 + (shard*500+index)*53",
  holdoutSeed:"33000001 + i*131",maxDecisions:600,ticksPerDecision:18},
 shardManifests:shards.map(s=>s.manifest),pairedHoldout:tests
};
fs.writeFileSync("bean-sight-3000-summary.json",JSON.stringify(report,null,2)+"\n");
fs.writeFileSync("bean-sight-3000-policy-q2.json",JSON.stringify(q2)+"\n");
fs.writeFileSync("bean-sight-3000-new-ledger.jsonl",fresh.map(e=>JSON.stringify(e)).join("\n")+"\n");
fs.writeFileSync("bean-sight-3000-full-history.jsonl",prior.concat(fresh).map(e=>JSON.stringify(e)).join("\n")+"\n");
fs.writeFileSync("bean-sight-3000-heldout-ledger.jsonl",testLedger.map(e=>JSON.stringify(e)).join("\n")+"\n");
console.log("BEAN SIGHTED 3000 VERIFIED");
console.log(JSON.stringify({...report,shardManifests:"see archive",pairedHoldout:"see archive"},null,2));
