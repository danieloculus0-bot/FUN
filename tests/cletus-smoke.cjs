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


// Polish-pass regression checks: closer camera, detailed render, boss mechanics,
// and supplies placed on traversable street instead of inside buildings.
assert.match(source, /i\.scale\(4\/3,4\/3\)/, 'World camera must be zoomed 33%');
assert.match(source, /i\.aim\.x\/\(4\/3\)/, 'Pointer aim must compensate for zoom');
assert.match(source, /function cletusBossPhase\(/, 'Boss attack phases missing');
assert.match(source, /o\.bossWindup=0/, 'Boss charge state missing');
assert.match(source, /o\.bossPhase2/, 'Boss enrage tracking missing');
assert.match(source, /function w0\(/, 'Vehicle art renderer missing');
assert.match(source, /function je\(/, 'Detailed character renderer missing');
assert.match(html, /overlay-menu/, 'Opening cover art mode missing');
assert.match(html, /Cletus%20Saves%20Candy_%20Neon%20City%20Rescue\.png/, 'Opening cover asset link missing');
const wholeEnd=source.indexOf('function Ce(',start);
assert.ok(wholeEnd>stop,'Renderer and boss logic not found');
const worldCtx={Math};
vm.runInNewContext('const '+source.slice(start,wholeEnd)+';globalThis.polish={Y0,Fh,n2,je,w0,Yu};',worldCtx);
const polish=worldCtx.polish, active=polish.Y0(0);
for(const pickup of active.drops.slice(-4)) {
  assert.equal(polish.Yu(active,pickup.x,pickup.y,8),false,'Final boss supply pickup trapped in a wall');
}
active.phase='playing';
active.player.x=900;active.player.y=790;
for(let tick=0;tick<30;tick++)polish.Fh(active,new Set(['right']),null,false);
assert.ok(active.camera.x>0,'Camera must follow the player');
let rectangles=0;
const graphics=new Proxy({createRadialGradient(){return {addColorStop(){}};}}, {
  get(obj,key){if(key in obj)return obj[key];return (...args)=>{if(key==='fillRect')rectangles++;};},
  set(obj,key,value){obj[key]=value;return true;}
});
polish.n2(graphics,active);
polish.je(graphics,'cletus',100,100,0,0,0);
polish.je(graphics,'boss',100,100,0,0,0);
polish.w0(graphics,50,50,2,false,0);
polish.w0(graphics,50,50,2,true,0);
assert.ok(rectangles>50,'Sprite and city renderer produced too few draw calls');
active.leads=3;active.tonyGangSpawned=true;active.tonyReinforced=true;
active.player.x=active.boss.x+130;active.player.y=active.boss.y-22;
active.bossNextCharge=0;
for(let tick=0;tick<40;tick++)polish.Fh(active,new Set(),null,false);
assert.ok(active.bossDash>0||active.bossWindup>0,'Tony should wind up and charge');
active.boss.hp=300;
for(let tick=0;tick<40;tick++)polish.Fh(active,new Set(),null,false);
assert.equal(active.bossPhase2,true,'Tony must enter his furious second phase');
console.log('PASS Cletus camera zoom, detailed art, boss charge/enrage, render and supply accessibility.');
