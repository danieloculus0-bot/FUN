#!/usr/bin/env node
/* Six independent BEAN Q-learning workers: 500 ORIGINAL-game episodes each.
 * Start from the SAME previous durable policy. Never erase earlier receipts. */
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const Q=require("./bean-q.js");
const shard=Number(process.env.BEAN_SHARD);
const parent=process.env.BEAN_PARENT_DIR;
const COUNT=500,STEPS=160,TICKS=18;
if(!Number.isInteger(shard)||shard<0||shard>5||!parent)throw Error("Expected shard 0..5 and parent artifact directory");
const read=n=>fs.readFileSync(path.join(parent,n),"utf8");
const saved=JSON.parse(read("bean-emperor-continued-policy.json"));
const report=JSON.parse(read("bean-emperor-continued-benchmark.json"));
const prior=read("bean-emperor-full-chain-ledger.jsonl").trim().split("\n").map(JSON.parse);
if(report.new_policy_updates!==13419||saved.updates!==13419||saved.version!==1||
   report.new_policy_states!==Object.keys(saved.table).length||
   report.validated_prior_episodes!==198||report.extra_training_episodes!==200||
   prior.filter(r=>r.kind==="training").length!==350)
 throw Error("Saved memory or prior result mismatch: refuse cold-start replacement");
const parentDigest=crypto.createHash("sha256").update(read("bean-emperor-continued-policy.json")).digest("hex");
const q=Q.QLearner.restore(saved,{seed:81431+shard*109});
const source=fs.readFileSync(path.join(__dirname,"play.html"),"utf8");
const script=source.match(/<script>\s*(\(\(\) => \{[\s\S]*?\}\)\(\);)\s*<\/script>/)?.[1];
if(!script)throw Error("Original HTML5 game engine missing");
const node=()=>({hidden:false,textContent:"",classList:{add(){},remove(){}},addEventListener(){},
  getContext(){return{};},focus(){},getBoundingClientRect(){return{left:0,top:0,width:1000,height:640}}});
const ids=["game","overlay","overlay-kicker","overlay-title","overlay-copy","overlay-hint","play-button","pause-button",
 "fullscreen-button","game-status","game-frame","touch-shove","touch-grenade","touch-swap","sound-button",
 "touch-prev","touch-next","touch-select","touch-start"];
const nodes=Object.fromEntries(ids.map(x=>[x,node()]));
const window={addEventListener(){}};
vm.runInNewContext(script,{window,document:{getElementById:k=>nodes[k],querySelectorAll:()=>[],addEventListener(){},hidden:false},
  location:{search:"?bean=1"},URLSearchParams,localStorage:{getItem(){return null},setItem(){}},requestAnimationFrame(){}},{filename:"EmperorGauntlet.original.js"});
const game=window.__EG_BEAN_GAME;
if(!game||game.version!==1)throw Error("Unexpected game bridge");
const receipts=[];
const start=Date.now();
let best=0,totalKills=0;
for(let i=0;i<COUNT;i++){
 const ordinal=shard*COUNT+i;
 const seed=5000001+ordinal*53;
 q.rngState=((seed^0x4f2ba571)>>>0)||1;
 q.epsilon=Math.max(.025,.14*Math.exp(-(i+shard*75)/400));
 let state=game.reset(seed),rewardTotal=0;
 const trace=new Q.Trace(seed);
 let steps=0;
 for(;steps<STEPS&&state.status==="running";steps++){
  const action=q.select(state,{explore:true});
  game.act(Q.policyCommand(state,action));
  const next=game.step(TICKS);
  const done=next.status!=="running"||steps===STEPS-1;
  const reward=Q.rewardFor(state,next,next.status!=="running");
  trace.add(state,action,reward,next,done);
  q.update(state,action,reward,next,done);
  rewardTotal+=reward;state=next;
 }
 if(trace.rows.at(-1)?.[4]!==1)throw Error("No terminal decision marker");
 const row={kind:"training",seed,kills:state.kills,wave:state.wave,steps,reason:state.cause,
  reward:+rewardTotal.toFixed(3),sourceCommit:process.env.GITHUB_SHA||"local",
  gameVersion:game.version,shard,episode:ordinal+1,trace:trace.export()};
 receipts.push(row);best=Math.max(best,row.kills);totalKills+=row.kills;
}
const dir=path.join(process.cwd(),"shard-"+shard);
fs.mkdirSync(dir,{recursive:true});
const manifest={experiment:"bean-emperor-3000",shard,seed_start:receipts[0].seed,seed_end:receipts.at(-1).seed,
 expected_episodes:COUNT,episodes:receipts.length,kills_total:totalKills,best,
 mean_kills:totalKills/COUNT,previous_updates:saved.updates,
 new_updates:q.updates,additional_q_updates:q.updates-saved.updates,
 learned_states:Object.keys(q.table).length,parent_policy_sha256:parentDigest,
 source_commit:process.env.GITHUB_SHA||"local",elapsed_ms:Date.now()-start};
fs.writeFileSync(path.join(dir,"episodes.jsonl"),receipts.map(x=>JSON.stringify(x)).join("\n")+"\n");
fs.writeFileSync(path.join(dir,"policy.json"),JSON.stringify(q.snapshot())+"\n");
fs.writeFileSync(path.join(dir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
console.log("BEAN 3000 SHARD COMPLETE");
console.log(JSON.stringify(manifest,null,2));
