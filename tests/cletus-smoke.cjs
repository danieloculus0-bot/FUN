// Cletus Saves Candy: standalone syntax and Big Tony gang regression checks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.join(__dirname, '../docs/cletus');
const html = fs.readFileSync(path.join(base, 'play.html'), 'utf8');
const landing = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
assert.ok(html.length > 100000, 'Game content missing');
assert.match(html, /<div id="root"><\/div>/, 'Game root missing');
assert.match(html, /Cletus Saves Candy/, 'Title missing');
assert.match(html, /og:image/, 'Cover preview missing');
assert.match(landing, /href="play\.html"/, 'Landing must link to game');
assert.match(landing, /Cletus%20Saves%20Candy_%20Neon%20City%20Rescue\.png/, 'Landing cover missing');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
assert.ok(script,'Inline game module missing');
const source=script[1];
new vm.Script(source,{filename:'cletus-game.js'});
assert.match(source,/tonyMob\(i,12\)/,'Initial gang trigger missing');
assert.match(source,/tonyMob\(i,6\)/,'Reinforcement trigger missing');
assert.match(source,/i\.leads===3&&!i\.tonyGangSpawned/,'Gang must wait for final lead');
assert.match(source,/i\.boss\.hp<i\.boss\.max\*\.42/,'Reinforcement health trigger missing');
const start=source.indexOf('bl=480,vl=270'),stop=source.indexOf('function ti(i,o',start);
assert.ok(start>0&&stop>start,'Game rules cannot be isolated');
const ctx={Math};
vm.runInNewContext('const '+source.slice(start,stop)+';globalThis.test={Y0,tonyMob,Yu};',ctx);
const world=ctx.test.Y0(0);
assert.equal(world.boss.hp,780);
assert.equal(world.boss.max,780);
assert.equal(world.boss.damage,19);
assert.equal(ctx.test.tonyMob(world,12),12,'Tony needs 12 minions');
assert.equal(ctx.test.tonyMob(world,6),6,'Reinforcements need open positions');
const gang=world.enemies.filter(e=>e.tonyMinion);
assert.equal(gang.length,18);
for(const thug of gang){
  assert.equal(thug.hp,27);
  assert.equal(ctx.test.Yu(world,thug.x,thug.y,thug.radius),false,'Gang member inside obstacle');
}
console.log('PASS Cletus landing, script syntax, cover tags, boss gang and reinforcements.');
