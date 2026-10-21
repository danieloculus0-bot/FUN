#!/usr/bin/env node
/* Audit the real recorded decisions and termination causes from all
 * 6,350 BEAN Emperor Gauntlet training episodes.
 * No interpolated synthetic games or unverifiable scoreboard claims. */
"use strict";
const fs=require("node:fs");
const ledger=process.env.BEAN_LEDGER_FILE;
if(!ledger)throw Error("Provide BEAN_LEDGER_FILE for the authoritative 6000+ historical episodes");
const episodes=fs.readFileSync(ledger,"utf8").trim().split("\n").map(JSON.parse)
 .filter(x=>x.kind==="training");
if(episodes.length!==6350)throw Error("Unexpected training ledger size "+episodes.length);
const actions=["approach","retreat","orbit_cw","orbit_ccw","stand_fire",
 "pickup","camp","sprint_approach","grenade","uzi","shotgun","ion","rocket","flame","melee"];
const buckets=[{name:"0-9",f:x=>x<10},{name:"10-19",f:x=>x>=10&&x<20},
 {name:"20-29",f:x=>x>=20&&x<30},{name:"30-39",f:x=>x>=30&&x<40},
 {name:"40+",f:x=>x>=40}];
function group(rows){
 const causes={},steps=[],kills=[],actionsCount=actions.map(_=>0),lastActions=actions.map(_=>0),
   windows={endedBefore40:0,ended40to79:0,ended80to159:0,cappedAt160:0},
   scores={},lastHP=[],lastTemp=[],bestRows=[];
 for(const e of rows){
  if(!e.trace||e.steps!==e.trace.rows.length)throw Error("Corrupt receipt");
  const reason=e.reason||e.cause||(e.steps===160?"TIME_LIMIT_160":"NO_CAUSE");
  const c=causes[reason]||(causes[reason]={count:0,killsSum:0,killsMax:0,stepsSum:0,examples:[]});
  c.count++;c.killsSum+=e.kills;c.stepsSum+=e.steps;c.killsMax=Math.max(c.killsMax,e.kills);
  if(c.examples.length<3)c.examples.push({seed:e.seed,kills:e.kills,steps:e.steps});
  steps.push(e.steps);kills.push(e.kills);
  if(e.steps<40)windows.endedBefore40++;else if(e.steps<80)windows.ended40to79++;
  else if(e.steps<160)windows.ended80to159++;else windows.cappedAt160++;
  for(const r of e.trace.rows)actionsCount[r[1]]++;
  if(e.trace.rows.length){
   const r=e.trace.rows.at(-1);lastActions[r[1]]++;
   lastHP.push(r[6]);lastTemp.push(r[7]);
  }
  for(const b of buckets)if(b.f(e.kills)){scores[b.name]=(scores[b.name]||0)+1;break;}
  if(e.kills>=30)bestRows.push({seed:e.seed,kills:e.kills,reason,steps:e.steps,
     final_hp:e.trace.rows.at(-1)?.[6],final_temp:e.trace.rows.at(-1)?.[7],
     last_action:actions[e.trace.rows.at(-1)?.[1]]});
 }
 const sorted=steps.slice().sort((a,b)=>a-b);
 const total=rows.length,totalDecisions=actionsCount.reduce((a,b)=>a+b,0);
 return {episodes:total,mean_steps:totalDecisions/total,median_steps:sorted[Math.floor(total/2)],
   p90_steps:sorted[Math.floor(total*.9)],max_steps:sorted.at(-1),
   mean_kills:kills.reduce((a,b)=>a+b,0)/total,best_kills:Math.max(...kills),
   windows,causes:Object.fromEntries(Object.entries(causes).map(([k,v])=>[k,{count:v.count,
      percent:+(v.count/total*100).toFixed(1),avg_kills:v.killsSum/v.count,
      avg_steps:v.stepsSum/v.count,max_kills:v.killsMax,examples:v.examples}])),
   kills_distribution:scores,
   actions:Object.fromEntries(actions.map((a,i)=>[a,{uses:actionsCount[i],share:+(actionsCount[i]/totalDecisions*100).toFixed(2),terminal_count:lastActions[i]}])),
   final_hp_below_zero:lastHP.filter(x=>x<=0).length,
   final_temp_below_zero:lastTemp.filter(x=>x<=0).length,
   high_score_death_examples:bestRows.sort((a,b)=>b.kills-a.kills).slice(0,20)
 };
}
const latest=episodes.filter(e=>e.seed>=11000001&&e.seed<11160000),
 previous=episodes.filter(e=>e.seed>=5000001&&e.seed<5160000);
if(latest.length!==3000||previous.length!==3000)throw Error("Ledger does not include both distinct 3000-game batches");
const report={source:"authoritative complete per-decision episode ledger from GitHub Actions",all:group(episodes),
 latest_3000:group(latest),prior_3000:group(previous)};
fs.writeFileSync("bean-emperor-cause-diagnosis.json",JSON.stringify(report,null,2)+"\n");
console.log("BEAN EMPEROR REAL CAUSE DIAGNOSIS");
console.log(JSON.stringify({
 latest:{episodes:report.latest_3000.episodes,mean_steps:report.latest_3000.mean_steps,
 median_steps:report.latest_3000.median_steps,p90_steps:report.latest_3000.p90_steps,
 windows:report.latest_3000.windows,causes:report.latest_3000.causes,
 actions:report.latest_3000.actions,high_score_death_examples:report.latest_3000.high_score_death_examples},
 old_causes:report.prior_3000.causes
},null,2));
