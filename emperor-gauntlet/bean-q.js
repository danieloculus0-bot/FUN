/* BEAN Emperor Gauntlet Q-learning. Experimental, not enabled during ordinary play.
 * Dependency-free UMD so the policy also runs under Node's test runner.
 * Gameplay decisions are learned from reward; the feature encoder is fixed. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object" && module.exports)module.exports=api;
  else root.EmperorBeanQ=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const VERSION=1;
  const ACTIONS=[
    "approach","retreat","orbit_cw","orbit_ccw","stand_fire",
    "pickup","camp","sprint_approach","grenade",
    "uzi","shotgun","ion","rocket","flame","melee"
  ];
  const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
  const bucket=(x,stops)=>stops.reduce((n,v)=>n+(x>v?1:0),0);
  function stateKey(o){
    const target=o.target||{dx:0,dy:0,distance:1e9};
    const a=Math.atan2(target.dy,target.dx);
    const dir=target.distance>900?8:(Math.round(a*4/Math.PI)+8)%8;
    return [
      dir,bucket(target.distance,[100,280,650]),
      bucket(o.hp,[35,72]),bucket(o.temp,[28,65]),
      bucket(o.stamina,[25,70]),
      (o.crowd||0)>=4?1:0,
      o.phase==="night"?1:0,
      o.pickup&&o.pickup.distance<280?1:0,
      o.camp&&o.camp.distance<220?1:0,
      o.owned&&o.owned.uzi?1:0,
      o.owned&&o.owned.shotgun?1:0,
      o.owned&&o.owned.ion?1:0,
      o.owned&&o.owned.rocket?1:0,
      o.owned&&o.owned.flame?1:0,
      o.ammo&&o.ammo[o.weapon]>0?1:0,
      o.grenades>0?1:0
    ].join(".");
  }
  function legalActions(o){
    const out=[0,1,2,3,4,5,6,7];
    if(o.grenades>0 && o.target)out.push(8);
    for(let i=9;i<=13;i++){
      const kind=ACTIONS[i];
      if(o.owned&&o.owned[kind]&&o.ammo&&o.ammo[kind]>0)out.push(i);
    }
    out.push(14);
    return out;
  }
  class QLearner {
    constructor({alpha=.20,gamma=.94,epsilon=.28,seed=12345,table=null}={}){
      this.alpha=alpha;this.gamma=gamma;this.epsilon=epsilon;
      this.table=table||Object.create(null);this.updates=0;
      this.rngState=seed>>>0||1;
    }
    random(){
      let x=this.rngState;
      x^=x<<13;x^=x>>>17;x^=x<<5;
      this.rngState=x>>>0;
      return this.rngState/4294967296;
    }
    values(key){
      if(!this.table[key])this.table[key]=Array(ACTIONS.length).fill(0);
      return this.table[key];
    }
    select(o,{explore=true}={}){
      const key=stateKey(o),allowed=legalActions(o),values=this.values(key);
      if(explore&&this.random()<this.epsilon)return allowed[Math.floor(this.random()*allowed.length)];
      let top=-Infinity,best=[];
      for(const i of allowed){
        const q=values[i];
        if(q>top+1e-9){top=q;best=[i];}
        else if(Math.abs(q-top)<1e-9)best.push(i);
      }
      return best[Math.floor(this.random()*best.length)];
    }
    update(before,action,reward,after,done=false){
      if(!Number.isFinite(reward)||!Number.isInteger(action)||action<0||action>=ACTIONS.length)throw Error("invalid transition");
      const old=this.values(stateKey(before));
      const target=reward+(done?0:this.gamma*Math.max(...legalActions(after).map(i=>this.values(stateKey(after))[i])));
      old[action]+=this.alpha*(target-old[action]);
      this.updates++;
    }
    snapshot(){return {version:VERSION,alpha:this.alpha,gamma:this.gamma,epsilon:this.epsilon,updates:this.updates,table:this.table};}
    static restore(data,opts={}){
      if(!data||data.version!==VERSION||!data.table||typeof data.table!=="object")throw Error("unsupported Q snapshot");
      const table=Object.create(null);
      for(const [k,v] of Object.entries(data.table)){
        if(!Array.isArray(v)||v.length!==ACTIONS.length||v.some(x=>!Number.isFinite(x)))throw Error("invalid Q row");
        table[k]=v.slice();
      }
      const agent=new QLearner({...data,...opts,table});agent.updates=data.updates||0;return agent;
    }
  }
  function rewardFor(before,after,done){
    const kills=Math.max(0,after.kills-before.kills);
    const wave=Math.max(0,after.wave-before.wave);
    const lostHP=Math.max(0,before.hp-after.hp);
    const cold=Math.max(0,35-after.temp);
    const earnedGear=["uzi","shotgun","ion","rocket","flame"]
      .filter(k=>!before.owned?.[k]&&after.owned?.[k]).length;
    const pickupProgress=before.pickup&&after.pickup&&before.pickup.kind===after.pickup.kind
      ?clamp(before.pickup.distance-after.pickup.distance,-35,35)*.03:0;
    const closingDistance=before.target&&after.target&&before.owned?.uzi
      ?clamp(before.target.distance-after.target.distance,-30,30)*.01:0;
    const warmUp=before.temp<45?Math.max(0,after.temp-before.temp)*.2:0;
    return Number((30*kills+3*wave+10*earnedGear+pickupProgress+closingDistance+
      warmUp-.5*lostHP-.02*cold-.08+(done?-35:0)).toFixed(3));
  }
  function policyCommand(o,action){
    const t=o.target||{dx:1,dy:0,distance:1e9};
    let x=t.dx,y=t.dy;
    const length=Math.hypot(x,y)||1;
    x/=length;y/=length;
    const toward=(v)=>({dx:x*v,dy:y*v});
    const cmd={...toward(0),fire:true,sprint:false,grenade:false,weapon:null,aimX:o.x+t.dx,aimY:o.y+t.dy};
    switch(action){
      case 0:Object.assign(cmd,toward(1));break;
      case 1:Object.assign(cmd,toward(-1));break;
      case 2:cmd.dx=-y;cmd.dy=x;break;
      case 3:cmd.dx=y;cmd.dy=-x;break;
      case 4:break;
      case 5:
        if(o.pickup){let n=Math.hypot(o.pickup.dx,o.pickup.dy)||1;cmd.dx=o.pickup.dx/n;cmd.dy=o.pickup.dy/n;}
        cmd.sprint=true;break;
      case 6:
        if(o.camp){let n=Math.hypot(o.camp.dx,o.camp.dy)||1;cmd.dx=o.camp.dx/n;cmd.dy=o.camp.dy/n;}
        break;
      case 7:Object.assign(cmd,toward(1));cmd.sprint=true;break;
      case 8:cmd.grenade=true;break;
      case 9:case 10:case 11:case 12:case 13:cmd.weapon=ACTIONS[action];break;
      case 14:cmd.weapon=o.owned&&o.owned.staff?"staff":"fists";Object.assign(cmd,toward(1));break;
      default:throw Error("invalid action");
    }
    return cmd;
  }
  function Trace(seed){
    this.seed=seed;this.states=[];this.ids=Object.create(null);this.rows=[];
  }
  Trace.prototype.state=function(s){
    if(this.ids[s]===undefined){this.ids[s]=this.states.length;this.states.push(s);}
    return this.ids[s];
  };
  Trace.prototype.add=function(before,action,reward,after,done){
    this.rows.push([this.state(stateKey(before)),action,Math.round(reward*1000),this.state(stateKey(after)),done?1:0,after.kills,Math.round(after.hp),Math.round(after.temp)]);
  };
  Trace.prototype.export=function(meta={}){
    return {version:VERSION,seed:this.seed,states:this.states,rows:this.rows,...meta};
  };
  return {VERSION,ACTIONS,QLearner,Trace,stateKey,legalActions,rewardFor,policyCommand};
});
