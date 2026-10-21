#!/usr/bin/env node
"use strict";
/* Real Emperor game physics. BEAN V2 perceptual Q-learning.
 * Six independent 500-game shards warm-start from the 6,350-game v1 policy.
 * The recorded Q2 ledger preserves every state, reward and friend-safe redirect. */
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {game,episode,Sight}=require("./bean-sight-headless.cjs");
const shard=Number(process.env.BEAN_SHARD),parent=process.env.BEAN_PARENT_DIR;
if(!Number.isInteger(shard)||shard<0||shard>5||!parent)throw Error("Requires shard 0..5 and authentic parent artifact");
const baseText=fs.readFileSync(path.join(parent,"bean-emperor-6000-policy-merged.json"),"utf8");
const base=JSON.parse(baseText);
const summary=JSON.parse(fs.readFileSync(path.join(parent,"bean-emperor-6000-summary.json"),"utf8"));
if(base.version!==1||base.updates!==188779||summary.merged_q_updates!==188779||
  summary.prior_training_episodes!==3350||summary.training_episodes_this_run!==3000)throw Error("Refuse stale/mismatched historic BEAN brain");
const sha=crypto.createHash("sha256").update(baseText).digest("hex");
const q=new Sight.SightLearner({parentSnapshot:base,seed:9001+shard*181,
 alpha:.15,gamma:.95,epsilon:.25});
const engine=game(),receipts=[],start=Date.now(),causes={};
let best=0,kills=0,friendWarnings=0,friendPrevents=0,redirects=0,timeouts=0;
for(let i=0;i<500;i++){
 const seed=22000001+(shard*500+i)*53;
 const epsilon=Math.max(.04,.24*Math.exp(-i/300));
 const e=episode(engine,q,seed,{train:true,mode:"sighted",stepsMax:600,epsilon,log:true});
 if(!e.trace||e.trace.rows.length!==e.steps||e.trace.rows.at(-1)?.[4]!==1)
   throw Error("Incomplete ledger for episode "+i);
 receipts.push({kind:"training",policy:"hazard-aware-v2",sourceCommit:process.env.GITHUB_SHA||"local",
  ...e});
 best=Math.max(best,e.kills);kills+=e.kills;friendWarnings+=e.sealWarnings;
 friendPrevents+=e.friendRedirects;redirects+=e.pathRedirects;
 if(!e.ended)timeouts++;causes[e.termination]=(causes[e.termination]||0)+1;
}
const output=path.join(process.cwd(),"sight-shard-"+shard);
fs.mkdirSync(output,{recursive:true});
const manifest={experiment:"BEAN 3000 hazard-aware, friend-aware",shard,episodes:500,
 sourceCommit:process.env.GITHUB_SHA||"local",parentPolicySha256:sha,
 sourceParentRun:39546036769,seedStart:receipts[0].seed,seedEnd:receipts.at(-1).seed,
 killsTotal:kills,best,meanKills:kills/500,friendWarnings,friendPrevents,pathRedirects:redirects,
 trueGameOvers:500-timeouts,timeouts,causes,qUpdates:q.updates,qStates:Object.keys(q.table).length,
 seededFromV1States:q.seededStates,elapsedMs:Date.now()-start};
fs.writeFileSync(path.join(output,"episodes.jsonl"),receipts.map(e=>JSON.stringify(e)).join("\n")+"\n");
fs.writeFileSync(path.join(output,"q2-policy.json"),JSON.stringify(q.snapshot())+"\n");
fs.writeFileSync(path.join(output,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
console.log("BEAN SIGHT SHARD VERIFIED");
console.log(JSON.stringify(manifest,null,2));
