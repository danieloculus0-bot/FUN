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
  "  globalThis.__test = { get game() { return game; }, get state() { return state; }, start, pause, shove, tick, downBird, throwGrenade, selectWeapon, cycleWeapon };\n" +
  "})();"
);
const events = new Map();
const ctx = new Proxy({}, {
  get(_target, prop) {
    if (prop === "createLinearGradient") return () => ({ addColorStop() {} });
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
nodes["play-button"].handlers.click();
assert.equal(g.state, "running");
assert.equal(nodes.overlay.hidden, true);
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
g.tick();
const firstHit = bird.hp;
assert.ok(firstHit <= 44 && firstHit >= 28, "One shove must cause normal damage");
for (let i = 0; i < 9; i++) {
  bird.x = player.x + 40;
  bird.y = player.y;
  bird.vx = bird.vy = 0;
  g.tick();
}
assert.equal(bird.hp, firstHit, "A shove must not damage the same bird twice");
assert.equal(bird.lastSwing, id);
g.downBird(bird, "ice");
assert.equal(g.game.score, 0, "Ice falls should not inflate combat score");
assert.equal(g.game.falls, 1);
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

// Mouse target coordinates are converted from CSS pixels to canvas world space.
const pointerMove = nodes.game.handlers.pointermove;
assert.equal(typeof pointerMove, "function", "Canvas must support mouse aiming");
const focusPlayer = g.game.player;
focusPlayer.x = 250; focusPlayer.y = 280; focusPlayer.vx = focusPlayer.vy = 0;
pointerMove({pointerType:"mouse",clientX:250,clientY:60});
g.tick();
assert.ok(focusPlayer.fy < -.5, "Mouse aiming must update player facing");
assert.equal(g.selectWeapon("fists"), true, "Previous weapons remain available");
g.game.player.temp = 0.001;
g.tick();
assert.equal(g.state, "over", "The player must be able to freeze");
assert.match(g.game.cause, /froze/i);
console.log("Emperor Gauntlet web smoke tests: PASS");
