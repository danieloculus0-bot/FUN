"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Q=require("../emperor-gauntlet/bean-retry-q.cjs");
const {game,episode}=require("../emperor-gauntlet/bean-retry-engine.cjs");
const make=(patch={})=>({x:100,y:100,vx:7,vy:0,hp:100,temp:100,stamina:100,
 phase:"day",crowd:0,target:{dx:180,dy:0,distance:180},pickup:null,camp:null,
 weapon:"fists",owned:{fists:true},ammo:{},grenades:2,kills:0,wave:1,
 terrain:{here:0,rays:[0,0,0,0,0,0,0,0],driftRays:[12,8,0,0,0,0,0,6],stopRisk:4},
 seal:null,yeti:null,sealWarnings:0,...patch});
test("Q3 state records velocity direction, speed and stopping hazards",()=>{
 const a=make(),slow=make({vx:0,vy:0}),other=make({vx:-7,vy:0});
 assert.notEqual(Q.stateKey(a),Q.stateKey(slow));
 assert.notEqual(Q.stateKey(a),Q.stateKey(other));
 assert.notEqual(Q.stateKey(a),Q.stateKey(make({terrain:{...a.terrain,stopRisk:12}})));
});
test("Q3 inherits already-learned Q2 state scores, then updates separately",()=>{
 const s=make(),q2State=Q.Previous.observationKey(s);
 const row=Array(Q.Old.ACTIONS.length).fill(0);row[0]=5;
 const parent={version:2,table:{[q2State]:row},alpha:.15,gamma:.95,epsilon:.1,updates:42};
 const agent=new Q.Learner({parentQ2:parent,epsilon:0,alpha:1,gamma:0,seed:4});
 const values=agent.values(Q.stateKey(s));
 assert.equal(values[0],5);assert.equal(agent.seededFromQ2,1);
 agent.update(s,0,10,s,true);assert.equal(agent.values(Q.stateKey(s))[0],10);
 assert.equal(parent.table[q2State][0],5,"source Q2 brain must remain untouched");
 assert.equal(agent.snapshot().version,3);
});
test("momentum-aware route redirects danger, friend shots are vetoed",()=>{
 const s=make();
 const plan=Q.Previous.commandFor(s,0);
 assert.equal(plan.redirected,true);
 assert.notEqual(plan.command.dx,1);
 const seal=make({terrain:{here:0,rays:[0,0,0,0,0,0,0,0],driftRays:[0,0,0,0,0,0,0,0],stopRisk:0},
   seal:{dx:90,dy:0,distance:90}});
 const friendPlan=Q.Previous.commandFor(seal,0);
 assert.equal(friendPlan.command.fire,false);
});
test("real game gives momentum risk and split-step policy is reproducible",()=>{
 const env=game(),s=env.reset(192);
 assert.equal(s.terrain.driftRays.length,8);
 assert.ok(s.terrain.driftRays.every(x=>Number.isFinite(x)&&x>=0));
 const parent={version:2,table:{},updates:0,alpha:.15,gamma:.95,epsilon:0};
 const play=()=>episode(env,new Q.Learner({parentQ2:parent,epsilon:0,seed:9}),4846,
   {train:false,mode:"q3",maxDecisions:32,log:true});
 const a=play(),b=play();
 assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
 assert.equal(a.trace.version,3);assert.equal(a.trace.rows.length,a.steps);
});
