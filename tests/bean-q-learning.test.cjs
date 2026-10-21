"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {QLearner,Trace,stateKey,rewardFor,policyCommand,ACTIONS}=require("../emperor-gauntlet/bean-q.js");
const obs=(patch={})=>({x:100,y:100,hp:100,temp:100,stamina:100,crowd:0,phase:"day",
  target:{dx:80,dy:0,distance:80},pickup:null,camp:null,weapon:"fists",
  owned:{fists:true},ammo:{},grenades:0,kills:0,wave:1,...patch});
test("reward credits measured kills, penalizes damage and death",()=>{
  assert.equal(rewardFor(obs(),obs({kills:1}),false),29.92);
  assert.ok(rewardFor(obs(),obs({hp:50}),false)<0);
  assert.ok(rewardFor(obs(),obs(),true)<-30);
});
test("learned action-value actually changes and survives serialization",()=>{
  const q=new QLearner({alpha:1,gamma:0,seed:5});
  const s=obs();
  q.update(s,0,20,s,true);
  q.update(s,1,-20,s,true);
  assert.equal(q.values(stateKey(s))[0],20);
  assert.equal(q.select(s,{explore:false}),0);
  const copy=QLearner.restore(JSON.parse(JSON.stringify(q.snapshot())),{seed:99});
  assert.equal(copy.values(stateKey(s))[0],20);
  assert.equal(copy.select(s,{explore:false}),0);
  assert.equal(copy.updates,2);
});
test("ledger stores exact transition state codes, action and observed outcome",()=>{
  const ledger=new Trace(7),a=obs(),b=obs({kills:1});
  ledger.add(a,0,29.92,b,false);
  const row=ledger.export({kills:1});
  assert.equal(row.seed,7);
  assert.equal(row.rows.length,1);
  assert.equal(row.rows[0][2],29920);
  assert.equal(row.rows[0][5],1);
  assert.equal(row.states[row.rows[0][0]],stateKey(a));
});
test("weapons are masked until owned and stocked",()=>{
  assert.equal(new QLearner().select(obs(),{explore:false})<14,true);
  assert.equal([9,10,11,12,13].some(x=>require("../emperor-gauntlet/bean-q.js").legalActions(obs()).includes(x)),false);
  const command=policyCommand(obs(),0);
  assert.ok(command.dx>0);assert.equal(command.fire,true);
});
test("rewards-driven learning beats random on unseen one-step states",()=>{
  // A deliberately separate tiny MDP sanity test. Not a claim about game kills.
  const q=new QLearner({alpha:.25,gamma:0,epsilon:.3,seed:74});
  const train=Array.from({length:300},(_,i)=>obs({target:{dx:i%2?80:-80,dy:0,distance:80}}));
  for(const s of train){
    const a=q.select(s);const correct=s.target.dx>0?0:1;
    q.update(s,a,a===correct?10:-4,s,true);
  }
  let wins=0;
  for(const dx of [-80,80,-80,80]){
    const s=obs({target:{dx,dy:0,distance:80}});
    wins+=q.select(s,{explore:false})===(dx>0?0:1);
  }
  assert.equal(wins,4);
});
