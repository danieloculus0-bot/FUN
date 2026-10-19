// Dependency-free smoke tests for the browser edition.
// Run: node tests/web-smoke.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let source = fs.readFileSync(path.join(__dirname, "../docs/game.js"), "utf8");
const last = "  requestAnimationFrame(frame);\n})();";
assert.ok(source.includes(last), "Game entrypoint missing");
// Test instrumentation is only applied in Node. The browser game is unchanged.
source = source.replace(last,
  "  requestAnimationFrame(frame);\n" +
  "  globalThis.__test = { get game() { return game; }, get state() { return state; }, start, pause, shove, tick, downBird, throwGrenade, selectWeapon, cycleWeapon, hurtYeti, warnSeal, yetiSnack, collisions };\n" +
  "})();"
);
const events = new Map();
let nightLightRenders=0;
const ctx = new Proxy({}, {
  get(_target, prop) {
    if (prop === "createLinearGradient") return () => ({ addColorStop() {} });
    if (prop === "createRadialGradient") return () => {
      nightLightRenders++;
      return { addColorStop() {} };
    };
    return () => {};
  }
});
function element() {
  return {
    hidden: false, textContent: "", handlers: {},
    classList: { add() {}, remove() {} },
    addEventListener(type, fn) { this.handlers[type] = fn; },
    getContext() { return ctx; }, focus() {}, setPointerCapture() {},
    getBoundingClientRect() { return {left:0,top:0,width:1000,height:640}; },
    setAttribute() {}
  };
}
const names = [
  "game", "overlay", "overlay-kicker", "overlay-title", "overlay-copy",
  "overlay-hint", "play-button", "pause-button", "fullscreen-button",
  "game-status", "game-frame", "touch-shove", "touch-grenade", "touch-swap", "sound-button"
];
const nodes = Object.fromEntries(names.map(name => [name, element()]));
const document = {
  hidden: false,
  getElementById(name) { return nodes[name]; },
  createElement(tag) {
    assert.equal(tag,"canvas","Nightfall may only create an offscreen canvas");
    return {width:1000,height:640,getContext(){return ctx;}};
  },
  querySelectorAll() { return []; },
  addEventListener(name, fn) { events.set("document:" + name, fn); }
};
const window = {
  addEventListener(name, fn) { events.set("window:" + name, fn); }
};
const frames = [];
const storage = new Map();
const sandbox = {
  document, window, Math, Set, Number, String,
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); }
  },
  requestAnimationFrame(fn) { frames.push(fn); }
};
vm.runInNewContext(source, sandbox, { filename: "game.js" });
const g = sandbox.__test;
assert.equal(g.state, "menu");
assert.equal(g.game.birds.length, 22);
assert.ok(g.game.drops.length >= 8, "Gear must exist in the arena");
assert.ok(g.game.seal && g.game.seal.x>=300, "Baby seal is spawned near first gameplay view");
assert.equal(g.game.fires.length, 8, "Eight warming campfires exist");
assert.ok(g.game.yetiNext<=210, "The Yeti first appears quickly");
nodes["play-button"].handlers.click();
assert.equal(g.state, "running");
assert.equal(nodes.overlay.hidden, true);
const warmPlayer = g.game.player;
warmPlayer.x=g.game.fires[0].x;warmPlayer.y=g.game.fires[0].y;
warmPlayer.vx=warmPlayer.vy=0;warmPlayer.temp=55;
g.tick();
assert.ok(warmPlayer.temp>55,"Campfires restore body temperature");
assert.equal(warmPlayer.warming,true);
warmPlayer.x=170;warmPlayer.y=180;warmPlayer.vx=warmPlayer.vy=0;warmPlayer.temp=55;
g.tick();
assert.ok(warmPlayer.temp<55,"Cold exposure resumes away from fires");
assert.equal(warmPlayer.warming,false);
warmPlayer.temp=100;
for (let t = 1; t <= 50; t++) {
  const frame = frames.shift();
  assert.equal(typeof frame, "function");
  frame(t * (1000 / 60));
}
const player = g.game.player;
const bird = g.game.birds[0];
g.game.birds = [bird];
bird.x = player.x + 40;
bird.y = player.y;
bird.vx = 0; bird.vy = 0;
bird.hp = 66;
g.shove();
const id = player.swingId;
g.collisions();
const firstHit = bird.hp;
assert.ok(firstHit <= 44 && firstHit >= 28, "One shove must cause normal damage");
for (let i = 0; i < 9; i++) {
  bird.x = player.x + 40;
  bird.y = player.y;
  bird.vx = bird.vy = 0;
  g.collisions();
}
assert.equal(bird.hp, firstHit, "A shove must not damage the same bird twice");
assert.equal(bird.lastSwing, id);
const beforeFalling=g.game.score,beforeFallCount=g.game.falls;
g.downBird(bird,"ice");
assert.equal(g.game.score,beforeFalling+1,"Ice falls count toward penguin kills");
assert.equal(g.game.falls,beforeFallCount+1);
g.pause();
assert.equal(g.state, "paused");
assert.equal(nodes.overlay.hidden, false);
g.start();
assert.equal(g.state, "running");
assert.equal(nodes.overlay.hidden, true);
// New weapon and inventory regression checks.
g.start();
const armed = g.game.player;
armed.x = 275; armed.y = 230;
g.tick();
assert.equal(armed.weapon, "uzi", "Walking over Uzi pickup equips it");
assert.equal(armed.owned.uzi, true);
g.game.drops.push({kind:"knife",x:armed.x,y:armed.y,life:1000,spin:0});
g.tick();
assert.equal(armed.weapon,"uzi","Other pickups cannot replace the default Uzi");
assert.equal(g.selectWeapon("knife"),true,"Player can switch away from default Uzi");
g.game.drops.push({kind:"shotgun",x:armed.x,y:armed.y,life:1000,spin:0});
g.tick();
assert.equal(armed.weapon,"knife","Manual selection persists when collecting other guns");
assert.equal(g.selectWeapon("uzi"),true);
const ammoBefore = armed.ammo.uzi;
g.shove();
assert.equal(armed.ammo.uzi, ammoBefore - 1, "Uzi fires one round");
assert.ok(g.game.bullets.length > 0, "Uzi projectile spawned");
const grenadesBefore = armed.grenades;
g.throwGrenade();
assert.equal(armed.grenades, grenadesBefore - 1, "Grenade removed from inventory");
assert.equal(g.game.bombs.length, 1, "Grenade projectile spawned");
for (let i=0; i<57; i++) g.tick();
assert.equal(g.game.bombs.length, 0, "Grenade fuse expired");
assert.ok(g.game.explosions.length > 0, "Grenade detonated");

// v2.2: The fictional ion cannon opens persistent holes and plasma fractures.
g.game.drops.push({kind:"ion",x:armed.x,y:armed.y,life:1000,spin:0});
g.tick();
assert.equal(armed.weapon,"uzi","Ion cannon pickup must not override the Uzi default");
assert.equal(g.selectWeapon("ion"),true);
const ionAmmo=armed.ammo.ion,ionHoles=g.game.holes.length;
armed.shoveCD=0;
g.shove();
assert.equal(armed.ammo.ion,ionAmmo-1,"Ion cannon consumes one energy cell");
const plasma=g.game.bullets.find(b=>b.ion);
assert.ok(plasma,"Ion projectile must spawn");
plasma.x=1200;plasma.y=850;plasma.vx=plasma.vy=0;plasma.life=1;
g.tick();
assert.ok(g.game.holes.length>ionHoles,"Ion impact creates a hole in the ice");
assert.ok(g.game.ionCracks.length>=3,"Ion impact fractures nearby ice");
const beforeIce=g.game.score, beforePoints=g.game.points;
const icedBird=g.game.birds.find(b=>!b.down);
g.downBird(icedBird,"ice");
assert.equal(g.game.score,beforeIce+1,"Penguin deaths in cracks count");
assert.equal(g.game.points,beforePoints+100,"Crack kills earn points");

// v2.5: fuel fire is on solid ice, temporarily warms, then expires.
const flamePickup={kind:"flame",x:armed.x,y:armed.y,life:1000,spin:0};
g.game.drops.push(flamePickup);
g.tick();
assert.equal(armed.owned.flame,true,"Flamethrower can be picked up");
assert.equal(armed.weapon,"ion","Daytime flamethrower pickup does not override manual selection");
assert.equal(g.selectWeapon("flame"),true);
armed.x=140;armed.y=570;armed.vx=armed.vy=0;armed.fx=1;armed.fy=0;
armed.shoveCD=0;
const previousFuel=armed.ammo.flame;
g.shove();
assert.equal(armed.ammo.flame,previousFuel-1,"Flamethrower burns fuel");
const fuelFire=g.game.fires.find(f=>f.kind==="fuel");
assert.ok(fuelFire&&fuelFire.life>0,"Flamethrower leaves a temporary fuel fire");
armed.x=fuelFire.x;armed.y=fuelFire.y;armed.vx=armed.vy=0;armed.temp=55;
g.tick();
assert.ok(armed.temp>55,"Fuel fire warms the player");
fuelFire.life=1;g.tick();
assert.equal(g.game.fires.includes(fuelFire),false,"Temporary fuel fires extinguish");
g.selectWeapon("uzi");
armed.x=275;armed.y=230;armed.vx=armed.vy=0;armed.temp=100;

// v2.1: actual wave progression, boss spawning, boss health and loot.
while(g.game.score < 10) {
  const live = g.game.birds.find(b => !b.down);
  assert.ok(live, "A live target is required for score advancement");
  g.downBird(live, "combat");
}
g.tick();
assert.equal(g.game.wave, 2, "Ten defeats must advance to wave two");
const boss = g.game.birds.find(b => b.variant === "boss" && !b.down);
assert.ok(boss, "Wave two must spawn an Emperor boss");
assert.ok(boss.maxHp >= 800, "Emperor must have meaningful boss HP");
const beforeRewards = g.game.drops.length;
g.downBird(boss, "combat");
assert.ok(g.game.drops.length >= beforeRewards + 3, "Boss defeat must award supplies");
assert.ok(g.game.goreBursts>=1,"Penguin kills produce gore");
assert.ok(g.game.gibs.length>=26,"Killing an Emperor produces a cartoon gore explosion");
assert.ok(g.game.stains.length>=22,"Big penguins stain the ice with blood");

// Every third wave queues a hybrid polar night: 15 sec dusk, 59 sec dark,
// 15 sec dawn, with several minutes of forced daylight before the next night.
assert.equal(g.game.phase,"day");
g.game.score=g.game.nextWaveAt;
g.tick();
assert.equal(g.game.wave,3,"Third wave queues polar night");
assert.ok(g.game.nightQueue>=1);
assert.equal(g.game.night,false,"Milestone does not abruptly cut to black");
g.tick();
assert.equal(g.game.phase,"dusk","Night event begins with gradual dusk");
g.game.phaseTicks=899;g.tick();
assert.equal(g.game.phase,"night","Dusk lasts 15 seconds");
assert.equal(g.game.night,true);
assert.equal(armed.weapon,"flame","Night automatically equips flamethrower");
assert.ok(armed.ammo.flame>=100,"Night guarantees fuel");
const nightBefore=nightLightRenders;
const nightFrame=frames.shift();
assert.equal(typeof nightFrame,"function");
nightFrame(900);
assert.ok(nightLightRenders>nightBefore,"Night draws localized illumination");
g.game.phaseTicks=3539;g.tick();
assert.equal(g.game.phase,"dawn","Full darkness lasts precisely 59 seconds");
assert.ok(g.game.darkness>.85,"Dawn begins dark and fades");
g.game.phaseTicks=899;g.tick();
assert.equal(g.game.phase,"day","Dawn fades back to daylight over 15 seconds");
assert.equal(g.game.darkness,0);
assert.equal(armed.weapon,"uzi","Daylight automatically equips the Uzi");
const minimumDay=g.game.nextNightAllowed;
assert.ok(minimumDay-g.game.clock>=10800,"At least 3 minutes of daylight before another night");
g.game.score=g.game.nextWaveAt;g.tick();assert.equal(g.game.wave,4);
g.game.score=g.game.nextWaveAt;g.tick();assert.equal(g.game.wave,5);
g.game.score=g.game.nextWaveAt;g.tick();
assert.equal(g.game.wave,6);
assert.ok(g.game.nightQueue>0,"Wave six queues the next night");
assert.equal(g.game.phase,"day","Second night cannot interrupt minimum daylight");
g.game.clock=g.game.nextNightAllowed;
g.tick();
assert.equal(g.game.phase,"dusk","Queued wave-six darkness starts once daytime expires");

// Peaceful Yeti is warm, non-colliding, and dangerous only when attacked.
g.game.clock=949;
g.tick();
const yeti=g.game.yeti;
assert.ok(yeti?.alive,"A Yeti appears periodically");
assert.ok(Math.hypot(yeti.x-armed.x,yeti.y-armed.y)<250,"The first Yeti appears visibly near the player");
assert.equal(yeti.rage,0,"Yeti starts peaceful");
armed.x=yeti.x;armed.y=yeti.y;armed.vx=armed.vy=0;armed.temp=55;
g.tick();
assert.ok(armed.temp>55,"Peaceful Yeti grants warmth");
assert.equal(armed.yetiWarming,true);
// Yeti eats ordinary penguins but its meal must never count toward your record.
const snackTarget=g.game.birds.find(b=>!b.down&&b.variant!=="boss");
assert.ok(snackTarget,"Penguin target exists for Yeti snack");
const preSnackScore=g.game.score,preSnackPoints=g.game.points,preSnackGore=g.game.goreBursts;
assert.equal(g.yetiSnack(snackTarget),true,"Peaceful Yeti consumes a penguin");
assert.equal(g.game.yetiEats,1,"Separate Yeti meal counter increments");
assert.equal(g.game.score,preSnackScore,"Yeti's food earns no player kill");
assert.equal(g.game.points,preSnackPoints,"Yeti's food earns no player points");
assert.equal(g.game.goreBursts,preSnackGore,"Eating is not counted as player's gore burst");
assert.equal(g.yetiSnack(snackTarget),false,"Same penguin cannot be eaten twice");
g.hurtYeti(10);
assert.ok(yeti.rage>0,"Attacking the Yeti provokes it");
const pointsBeforeYeti=g.game.points, killsBeforeYeti=g.game.score;
g.hurtYeti(10000);
assert.equal(g.game.points,pointsBeforeYeti+1000,"Yeti defeat awards 1000 points");
assert.equal(g.game.score,killsBeforeYeti,"Yeti is separate from penguin count");
// A punished seal attack summons a guardian, halves current health,
// leaves a visible message, and never earns any kill/points.
armed.hp=80;
g.game.seal.hurtCooldown=0;
const warningCountBefore=g.game.sealWarnings;
const beforeSealKills=g.game.score, beforeSealPoints=g.game.points;
assert.equal(g.warnSeal(),true,"Seal attack triggers a warning smack");
assert.equal(armed.hp,40,"Seal warning takes exactly half current health");
assert.equal(g.game.sealWarnings,warningCountBefore+1,"Warning is recorded separately");
assert.ok(g.game.yeti?.alive,"Yeti appears to defend the seal");
assert.equal(g.game.yeti.rage,0,"Guardian stays friendly after warning");
assert.ok(g.game.guardianNotice>0,"Warning is visible in the HUD");
assert.equal(g.game.score,beforeSealKills,"Seal doesn't count as a penguin");
assert.equal(g.game.points,beforeSealPoints,"Seal doesn't award points");
assert.equal(g.warnSeal(),false,"Cooldown prevents repeated warning slaps");
assert.equal(armed.hp,40,"Repeated seal hit cannot drain health immediately");

// Mouse target coordinates are converted from CSS pixels to canvas world space.
const pointerMove = nodes.game.handlers.pointermove;
assert.equal(typeof pointerMove, "function", "Canvas must support mouse aiming");
const focusPlayer = g.game.player;
focusPlayer.x = 250; focusPlayer.y = 280; focusPlayer.vx = focusPlayer.vy = 0;
pointerMove({pointerType:"mouse",clientX:250,clientY:60});
g.tick();
assert.ok(focusPlayer.fy < -.5, "Mouse aiming must update player facing");
assert.equal(g.selectWeapon("fists"), true, "Previous weapons remain available");
// A death test must explicitly remove the friendly heating Yeti and all fires.
g.game.yeti=null;
g.game.yetiNext=Infinity;
g.game.player.x=50;g.game.player.y=50;
g.game.player.vx=g.game.player.vy=0;
g.game.player.temp=0.001;
g.tick();
assert.equal(g.state, "over", "The player must be able to freeze");
assert.match(g.game.cause, /froze/i);
console.log("Emperor Gauntlet web smoke tests: PASS");
