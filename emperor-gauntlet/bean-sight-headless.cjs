"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const Old=require("./bean-q.js"),Sight=require("./bean-sight.cjs");
function game(){
 const source=fs.readFileSync(path.join(__dirname,"play.html"),"utf8");
 const m=source.match(/<script>\s*(\(\(\) => \{[\s\S]*?\}\)\(\);)\s*<\/script>/);
 if(!m)throw Error("Cannot locate original game physics script");
 const element=()=>({hidden:false,textContent:"",classList:{add(){},remove(){}},
  addEventListener(){},getContext(){return{}},focus(){},
  getBoundingClientRect(){return{left:0,top:0,width:1000,height:640}}});
 const ids=["game","overlay","overlay-kicker","overlay-title","overlay-copy","overlay-hint",
  "play-button","pause-button","fullscreen-button","game-status","game-frame","touch-shove",
  "touch-grenade","touch-swap","sound-button","touch-prev","touch-next","touch-select","touch-start"];
 const nodes=Object.fromEntries(ids.map(x=>[x,element()]));
 const window={addEventListener(){}};
 const globals={window,document:{getElementById:k=>nodes[k],querySelectorAll:()=>[],addEventListener(){},hidden:false},
  location:{search:"?bean=1"},URLSearchParams,localStorage:{getItem(){return null},setItem(){}},
  requestAnimationFrame(){}};
 vm.runInNewContext(m[1],globals,{filename:"EmperorGauntlet.real.html"});
 const e=window.__EG_BEAN_GAME;
 if(!e||e.version!==1)throw Error("Original seeded game adapter missing");
 return e;
}
class SightTrace{
 constructor(seed){this.version=2;this.seed=seed;this.states=[];this.ids=new Map();this.rows=[];}
 id(k){if(!this.ids.has(k)){this.ids.set(k,this.states.length);this.states.push(k)}return this.ids.get(k)}
 add(a,action,reward,b,terminal,control){
  this.rows.push([this.id(Sight.observationKey(a)),action,Math.round(reward*1000),
   this.id(Sight.observationKey(b)),terminal?1:0,b.kills,
   Math.round(b.hp),Math.round(b.temp),control.redirected?1:0,
   control.protectedFriend?1:0]);
 }
 export(){return{version:this.version,seed:this.seed,states:this.states,rows:this.rows}}
}
function episode(env,agent,seed,{train=false,mode="sighted",stepsMax=600,log=false,epsilon=null}={}){
 if(!Number.isInteger(stepsMax)||stepsMax<1||stepsMax>2000)throw Error("bad step limit");
 if(epsilon!==null)agent.epsilon=epsilon;
 agent.rngState=(seed^0x4f2ba571)>>>0||1;
 let a=env.reset(seed),total=0,decisions=0,redirects=0,friendPrevents=0;
 const trace=log?new SightTrace(seed):null;
 const startWarn=a.sealWarnings||0;
 for(;decisions<stepsMax&&a.status==="running";decisions++){
  const action=agent.select(a,{explore:train});
  const plan=mode==="blind"?{command:Old.policyCommand(a,action),redirected:false,protectedFriend:false}:
   Sight.commandFor(a,action,{spatial:true,friends:true});
  redirects+=plan.redirected?1:0;friendPrevents+=plan.protectedFriend?1:0;
  env.act(plan.command);
  const b=env.step(18);
  const done=b.status!=="running";
  const reward=mode==="blind"?Old.rewardFor(a,b,done):Sight.sightReward(a,b,done);
  if(trace)trace.add(a,action,reward,b,done||decisions===stepsMax-1,plan);
  if(train)agent.update(a,action,reward,b,done||decisions===stepsMax-1);
  total+=reward;a=b;
 }
 return {seed,kills:a.kills,steps:decisions,wave:a.wave,ended:a.status!=="running",
  termination:a.status!=="running"?(a.cause||"GAME_OVER"):"TIME_LIMIT",
  hp:+a.hp.toFixed(2),temp:+a.temp.toFixed(2),reward:+total.toFixed(3),
  sealWarnings:(a.sealWarnings||0)-startWarn,friendRedirects:friendPrevents,
  pathRedirects:redirects,trace:trace?.export()||null};
}
module.exports={game,episode,SightTrace,Old,Sight};
