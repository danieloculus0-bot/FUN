#!/usr/bin/env node
/* Reproduce the EXACT previously observed 35-kill run and continue it past the cutoff.
 * Start from the SAME previous durable policy. Never erase earlier receipts. */
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const Q=require("./bean-q.js");
const shard=1;
const parent=process.env.BEAN_PARENT_DIR;
const COUNT=402,STEPS=160,TICKS=18;const EXTENDED=600;
if(!Number.isInteger(shard)||shard<0||shard>5||!parent)throw Error("Expected shard 0..5 and parent artifact directory");
const read=n=>fs.readFileSync(path.join(parent,n),"utf8");
const saved=JSON.parse(read("bean-emperor-3000-policy-merged.json"));
const report=JSON.parse(read("bean-emperor-3000-summary.json"));
const prior=read("bean-emperor-3000-full-history.jsonl").trim().split("\n").map(JSON.parse);
if(report.merged_q_updates!==99348||saved.updates!==99348||saved.version!==1||
   report.merged_states!==Object.keys(saved.table).length||
   report.prior_training_episodes!==350||report.training_episodes_this_run!==3000||
   prior.filter(r=>r.kind==="training").length!==3350)
 throw Error("Saved memory or prior result mismatch: refuse cold-start replacement");
const parentDigest=crypto.createHash("sha256").update(read("bean-emperor-3000-policy-merged.json")).digest("hex");
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
const receipts=[];const targetSeed=11047754;
const pastFile=process.env.BEAN_LATEST_LEDGER;
if(!pastFile)throw Error('Full past 35-kill receipt required');
const expected=fs.readFileSync(pastFile,'utf8').trim().split('\n').map(JSON.parse).find(r=>r.kind==='training'&&r.seed===targetSeed);
if(!expected||expected.kills!==35||expected.steps!==160)throw Error('Missing exact 35-kill receipt');
let checkpoint160=null,verifiedPrefix=false;
const start=Date.now();
let best=0,totalKills=0;
for(let i=0;i<COUNT;i++){
 const ordinal=shard*COUNT+i;
 const seed=11000001+ordinal*53;
 q.rngState=((seed^0x4f2ba571)>>>0)||1;
 q.epsilon=Math.max(.025,.14*Math.exp(-(i+shard*75)/400));
 let state=game.reset(seed),rewardTotal=0;
 const trace=new Q.Trace(seed);
 let steps=0;
 for(;steps<(i===401?EXTENDED:STEPS)&&state.status==="running";steps++){
  const action=q.select(state,{explore:true});
  game.act(Q.policyCommand(state,action));
  const next=game.step(TICKS);
  const done=next.status!=="running"||steps===(i===401?EXTENDED:STEPS)-1;
  const reward=Q.rewardFor(state,next,next.status!=="running");
  trace.add(state,action,reward,next,done);
  if(i===401&&steps===159){
   const actual=trace.rows.map(r=>r.slice());
   const prior=expected.trace.rows.map(r=>r.slice());
   actual[159][4]=1;
   if(JSON.stringify(actual)!==JSON.stringify(prior)){
    let mismatch=actual.findIndex((r,k)=>JSON.stringify(r)!==JSON.stringify(prior[k]));
    throw Error('Unable to reproduce exact 35-kill recorded prefix; first difference '+mismatch+' actual '+JSON.stringify(actual[mismatch])+' expected '+JSON.stringify(prior[mismatch]));
   }
   verifiedPrefix=true;
   checkpoint160={kills:next.kills,hp:next.hp,temp:next.temp,steps:160,status:next.status,cause:next.cause};
  }
  q.update(state,action,reward,next,done);
  rewardTotal+=reward;state=next;
 }
 if(trace.rows.at(-1)?.[4]!==1)throw Error('No terminal decision marker');
 const row={kind:"training",seed,kills:state.kills,wave:state.wave,steps,reason:state.cause,
  reward:+rewardTotal.toFixed(3),sourceCommit:process.env.GITHUB_SHA||"local",
  gameVersion:game.version,shard,episode:ordinal+1,trace:trace.export()};
 receipts.push(row);best=Math.max(best,row.kills);totalKills+=row.kills;
}

const target=receipts.find(x=>x.seed===targetSeed);
if(!target||!verifiedPrefix||checkpoint160.kills!==35)
 throw Error('35-kill reproduction failed');
const report={
 experiment:"continue EXACT archived 35-kill run beyond 160 decisions",
 original_run:39545665843,original_episode_seed:targetSeed,original_game_reproduced:true,
 original_160_decisions:checkpoint160,
 continued_max_steps:EXTENDED,
 continued:{kills:target.kills,steps:target.steps,reason:target.reason,status:target.reason?"game-over":target.steps===EXTENDED?"timeout":"unknown",
   final_hp:target.trace.rows.at(-1)[6],final_temp:target.trace.rows.at(-1)[7]},
 reached_37:target.kills>=37,surpassed_37:target.kills>=38,
 note:"All first 160 recorded actions, rewards, and states verified identical; continuation uses ongoing online Q-value updates."
};
fs.writeFileSync("bean-emperor-35-continued.json",JSON.stringify(report,null,2)+"\n");
console.log("BEAN VERIFIED EXACT 35 CONTINUATION");
console.log(JSON.stringify(report,null,2));
