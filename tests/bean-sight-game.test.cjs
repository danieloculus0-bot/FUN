"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {game,episode,Sight,Old}=require("../emperor-gauntlet/bean-sight-headless.cjs");
test("real game opt-in sensing reveals baby seal, rivers, ice hazards and direction risk",()=>{
 const env=game(),o=env.reset(123);
 assert.ok(o.seal&&o.seal.distance>0);
 assert.equal(o.terrain.rays.length,8);
 assert.ok(o.terrain.rays.every(x=>Number.isFinite(x)&&x>=0));
 assert.ok(o.sealWarnings===0);
 assert.ok(Number.isFinite(o.vx)&&Number.isFinite(o.vy));
});
test("protects baby seal in actual scene without removing penguin targets",()=>{
 const env=game(),o=env.reset(2);
 const aimSeal={...o,target:{dx:o.seal.dx,dy:o.seal.dy,distance:o.seal.distance},
  weapon:"uzi",owned:{...o.owned,uzi:true},ammo:{...o.ammo,uzi:50}};
 const cmd=Sight.commandFor(aimSeal,9);
 assert.equal(cmd.protectedFriend,true);
 assert.equal(cmd.command.fire,false);
 const clear={...aimSeal,seal:{dx:-100,dy:80,distance:128}};
 assert.equal(Sight.commandFor(clear,9).command.fire,true);
});
test("same seeded sighted policy yields deterministic real-game gameplay and receipts",()=>{
 const env=game(),parent=new Old.QLearner({seed:15}).snapshot();
 const build=()=>new Sight.SightLearner({parentSnapshot:parent,epsilon:0,seed:77});
 const a=episode(env,build(),791,{stepsMax:30,mode:"sighted",log:true});
 const b=episode(env,build(),791,{stepsMax:30,mode:"sighted",log:true});
 assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
 assert.equal(a.trace.rows.length,a.steps);
});
