"use strict";
// Exercise the ACTUAL HTML game's seeded Q-learning adapter using a fake browser DOM.
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../emperor-gauntlet/play.html"),"utf8");
const matched=html.match(/<script>\s*(\(\(\) => \{[\s\S]*?\}\)\(\);)\s*<\/script>/);
assert.ok(matched,"Emperor Gauntlet game script was not found");
function boot(query){
  const fake=()=>({hidden:false,textContent:"",handlers:{},classList:{add(){},remove(){}},
    addEventListener(name,cb){this.handlers[name]=cb;},
    getContext(){return new Proxy({},{get:()=>()=>{}});},focus(){},
    getBoundingClientRect(){return{left:0,top:0,width:1000,height:640}}});
  const nodes=Object.fromEntries(["game","overlay","overlay-kicker","overlay-title","overlay-copy","overlay-hint",
    "play-button","pause-button","fullscreen-button","game-status","game-frame","touch-shove",
    "touch-grenade","touch-swap","sound-button","touch-prev","touch-next","touch-select","touch-start"]
    .map(n=>[n,fake()]));
  const document={hidden:false,getElementById:id=>nodes[id],
    querySelectorAll:()=>[],
    addEventListener(){},createElement:()=>fake()};
  const window={addEventListener(){}};
  const ctx={window,document,location:{search:query},URLSearchParams,Math,Number,Set,
    localStorage:{getItem(){return null;},setItem(){}},requestAnimationFrame(){}};
  vm.runInNewContext(matched[1],ctx,{filename:"play.html"});
  return ctx.window.__EG_BEAN_GAME;
}
test("the AI bridge exists only with explicit opt-in",()=>{
  assert.equal(boot(""),undefined);
  assert.ok(boot("?bean=1"));
});
test("same seed and actions have matching physics and score",()=>{
  const game=boot("?bean=1");
  function episode(seed){
    let s=game.reset(seed);const sequence=[];
    for(let i=0;i<12;i++){
      game.act({dx:1,dy:0,fire:true,sprint:i<6,aimX:800,aimY:200});
      s=game.step(18);
      sequence.push([s.kills,s.hp,s.temp,s.x,s.y,s.status]);
    }
    return sequence;
  }
  assert.deepEqual(episode(123456),episode(123456));
});
test("the agent genuinely controls motion on real ticks",()=>{
  const g=boot("?bean=1");
  const before=g.reset(19);
  g.act({dx:1,dy:0,fire:false,sprint:true,aimX:800,aimY:200});
  const after=g.step(40);
  assert.ok(after.x>before.x+1,"moving right should advance player");
  assert.ok(after.clock>=40,"original clock should increment");
});
