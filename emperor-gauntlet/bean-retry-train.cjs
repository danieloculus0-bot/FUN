#!/usr/bin/env node
/* 500 authentic Emperor matches per shard; Q3 warm-starts from Q2.
 * Never discard parent learning or overwrite the historical champion. */
"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {game,episode,Q}=require("./bean-retry-engine.cjs");
const shard=Number(process.env.BEAN_SHARD),folder=process.env.BEAN_PARENT_DIR;
if(!Number.isInteger(shard)||shard<0||shard>=6||!folder)throw Error("Missing shard 0-5 or parent");
const source=fs.readFileSync(path.join(folder,"bean-sight-3000-policy-q2.json"),"utf8");
const parent=JSON.parse(source),summary=JSON.parse(fs.readFileSync(path.join(folder,"bean-sight-3000-summary.json"),"utf8"));
if(parent.version!==2||parent.updates!==192712||summary.q2Updates!==192712||summary.newTrainingEpisodes!==3000||
 Object.keys(parent.table).length!==summary.q2States)throw Error("Unexpected historical Q2 checkpoint");
const hash=crypto.createHash("sha256").update(source).digest("hex");
const agent=new Q.Learner({parentQ2:parent,seed:7820+shard*19,alpha:.14,gamma:.95,epsilon:.2});
const env=game(),records=[],causes={};
let total=0,best=0,warnings=0,steers=0,protections=0,timeouts=0;
for(let i=0;i<500;i++){
 const seed=44000001+(shard*500+i)*59;
 const e=episode(env,agent,seed,{train:true,mode:"q3",maxDecisions:600,log:true,
  epsilon:Math.max(.04,.22*Math.exp(-i/320))});
 if(e.steps!==e.trace?.rows.length||e.trace?.version!==3||e.trace.rows.at(-1)?.[4]!==1)
  throw Error("Incomplete decision receipt for episode "+i);
 records.push({kind:"training",policy:"Q3 momentum-aware",sourceCommit:process.env.GITHUB_SHA||"local",...e});
 total+=e.kills;best=Math.max(best,e.kills);warnings+=e.sealWarnings;
 steers+=e.pathRedirects;protections+=e.friendPrevents;
 if(!e.ended)timeouts++;causes[e.termination]=(causes[e.termination]||0)+1;
}
const out="retry-shard-"+shard;fs.mkdirSync(out,{recursive:true});
const manifest={experiment:"BEAN next 3000, momentum and friends",shard,episodes:500,
 sourceCommit:process.env.GITHUB_SHA||"local",parentSha256:hash,parentRun:39549202298,
 seedStart:records[0].seed,seedEnd:records.at(-1).seed,killsTotal:total,best,
 meanKills:total/500,sealWarnings:warnings,pathRedirects:steers,friendPrevents:protections,
 trueGameOvers:500-timeouts,timeouts,causes,q3Updates:agent.updates,
 q3States:Object.keys(agent.table).length,seededFromQ2:agent.seededFromQ2};
fs.writeFileSync(path.join(out,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
fs.writeFileSync(path.join(out,"episodes.jsonl"),records.map(r=>JSON.stringify(r)).join("\n")+"\n");
fs.writeFileSync(path.join(out,"q3-policy.json"),JSON.stringify(agent.snapshot())+"\n");
console.log("BEAN RETRY SHARD COMPLETE");console.log(JSON.stringify(manifest,null,2));
