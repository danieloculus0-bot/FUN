"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {Old,SightLearner,observationKey,steerAroundHazards,commandFor,friendInFiringLane,sightReward}=require("../emperor-gauntlet/bean-sight.cjs");
const observation=(patch={})=>({x:200,y:100,vx:0,vy:0,hp:100,temp:100,stamina:100,
 crowd:0,phase:"day",target:{dx:100,dy:0,distance:100},pickup:null,camp:null,
 weapon:"fists",owned:{fists:true},ammo:{},grenades:2,kills:0,wave:1,terrain:{here:0,rays:[0,0,0,0,0,0,0,0]},seal:null,yeti:null,sealWarnings:0,...patch});
test("learned v2 state differentiates lethal river proximity and friendly Yeti",()=>{
 const safe=observation(),river=observation({terrain:{here:17,rays:[17,17,0,0,0,0,0,10]}});
 assert.notEqual(observationKey(safe),observationKey(river));
 assert.notEqual(observationKey(safe),observationKey(observation({yeti:{dx:75,dy:0,distance:75,angry:true}})));
});
test("a dangerous eastbound trajectory is redirected away from river",()=>{
 const o=observation({terrain:{here:0,rays:[17,17,0,0,0,0,0,12]}});
 const planned=steerAroundHazards(o,{dx:1,dy:0,fire:true});
 assert.equal(planned.redirected,true);
 assert.notEqual(planned.command.dx,1);
 assert.equal(planned.command.fire,true);
});
test("baby seal and friendly Yeti are never targeted down the same firing lane",()=>{
 const seal=observation({seal:{dx:90,dy:0,distance:90}});
 let result=commandFor(seal,8);
 assert.equal(result.command.fire,false);assert.equal(result.command.grenade,false);
 const yeti=observation({weapon:"uzi",owned:{fists:true,uzi:true},ammo:{uzi:90},
   yeti:{dx:120,dy:7,distance:121,angry:false}});
 result=commandFor(yeti,9);
 assert.equal(result.command.fire,false);
 assert.equal(result.protectedFriend,true);
 assert.equal(friendInFiringLane(observation(),{aimX:300,aimY:100}),false);
});
test("friends outside the line of fire do not prevent combat",()=>{
 const o=observation({seal:{dx:0,dy:300,distance:300}});
 const r=commandFor(o,0);
 assert.equal(r.command.fire,true);
});
test("friend incidents and hazard encounters are penalized in reward",()=>{
 const a=observation(),b=observation({sealWarnings:1});
 assert.ok(sightReward(a,b,false)<-100);
 assert.ok(sightReward(a,observation({yeti:{dx:150,dy:10,distance:150,angry:true}}),false)<-100);
 assert.ok(sightReward(a,observation({terrain:{here:15,rays:[15,15,15,15,15,15,15,15]}}),false)<0);
});
test("v2 Q updates are distinct, seeded from real v1 history, and reproducible",()=>{
 const o=observation(),key=Old.stateKey(o);
 const parent={version:1,alpha:.20,gamma:.94,epsilon:.05,updates:10,table:{[key]:Array(Old.ACTIONS.length).fill(3)}};
 const q=new SightLearner({parentSnapshot:parent,seed:2});
 assert.equal(q.values(observationKey(o))[0],3);
 const q0=q.values(observationKey(o))[0];
 q.update(o,0,15,o,true);
 assert.ok(q.values(observationKey(o))[0]>q0);
 assert.equal(q.snapshot().version,2);
 assert.equal(q.updates,1);
 assert.equal(q.seededStates,1);
});
