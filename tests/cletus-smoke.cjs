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
assert.match(source,/i\.leads===5&&!i\.tonyGangSpawned/,'Gang must wait for final lead');
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
vm.runInNewContext('const '+source.slice(start,wholeEnd)+';globalThis.polish={Y0,Fh,n2,je,w0,Yu,Wh,$h,updateCopper,shopTest:Nt};',worldCtx);
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
active.leads=5;active.tonyGangSpawned=true;active.tonyReinforced=true;
active.player.x=active.boss.x+130;active.player.y=active.boss.y-22;
active.bossNextCharge=0;
for(let tick=0;tick<40;tick++)polish.Fh(active,new Set(),null,false);
assert.ok(active.bossDash>0||active.bossWindup>0,'Tony should wind up and charge');
active.boss.hp=300;
for(let tick=0;tick<40;tick++)polish.Fh(active,new Set(),null,false);
assert.equal(active.bossPhase2,true,'Tony must enter his furious second phase');
console.log('PASS Cletus camera zoom, detailed art, boss charge/enrage, render and supply accessibility.');


// Street scavenging, weapon cycling and healing regression checks.
assert.equal(polish.shopTest.length,5,'There must be five distinct clues');
assert.deepEqual(Array.from(polish.shopTest,c=>c.label),[
  'TIRE TRACKS','GRAFFITI WARNING','PAYPHONE WITNESS','GARAGE RECEIPT','GANG DROP SITE'
],'Five clues must retain their story order');
assert.doesNotMatch(html,/data-testid="button-cycle-weapon"/,'Cycle button should be gone');
assert.doesNotMatch(html,/data-testid="button-heal-desktop"/,'Heal button should be gone');
assert.match(source,/UZI AMMO \+68/,'Uzi ammo must increase from 52 to 68 per pickup');
assert.match(source,/Math\.random\(\)<\.55/,'XXX pickups should sometimes cause wooziness');
assert.match(source,/function nextLoadedWeapon/,'Auto weapon fallback missing');
assert.match(source,/function updateCopper/,'Copper harvesting missing');
const upgrades=polish.Y0(0);upgrades.phase='playing';
const p=upgrades.player;
p.hp=35;
polish.$h(upgrades,{x:p.x,y:p.y,type:'xxx'},null,false);
assert.equal(p.hp,79,'XXX should auto-heal 44 without a button');
assert.equal(p.xxx,1,'XXX counter should count used bottles');
polish.$h(upgrades,{x:p.x,y:p.y,type:'uzi'},null,false);
assert.equal(p.ammo[2],68,'Uzi pickup should grant 68 ammo');
p.weapon=1;p.ammo[1]=1;p.ammo[2]=2;p.ammo[3]=1;p.cool=0;
polish.Wh(upgrades,null,false);
assert.equal(p.weapon,2,'Bottles should switch to loaded Uzi');
p.cool=0;p.ammo[2]=1;polish.Wh(upgrades,null,false);
assert.equal(p.weapon,3,'Empty Uzi should switch to rockets');
p.cool=0;polish.Wh(upgrades,null,false);
assert.equal(p.weapon,0,'Fists are last resort');
assert.ok(upgrades.props.filter(d=>d.type==='car').length>12,'City should contain distinct cars');
assert.ok(new Set(upgrades.props.filter(d=>d.type==='car').map(d=>d.model)).size>=4,'Cars need several identifiable models');
assert.equal(upgrades.drops.some(d=>d.type==='copper'),false,'Copper cannot drop on streets');
let harvested=0,ownersBefore=upgrades.enemies.length;
for(let k=0;k<upgrades.buildings.length&&harvested<5;k++){
 const b=upgrades.buildings[k];if(b.pawn||b.wireStripped)continue;
 const candidates=[
   {x:b.x-15,y:b.y+b.h/2},
   {x:b.x+b.w+15,y:b.y+b.h/2},
   {x:b.x+b.w/2,y:b.y-15},
   {x:b.x+b.w/2,y:b.y+b.h+15}
 ];
 const loc=candidates.find(q=>!polish.Yu(upgrades,q.x,q.y,8));
 if(!loc)continue;
 p.x=loc.x;p.y=loc.y;
 for(let tick=0;tick<94;tick++){upgrades.tick++;polish.updateCopper(upgrades,new Set(['interact']),null,false,0)}
 if(b.wireStripped)harvested++;
}
assert.equal(harvested,5,'Five buildings should yield sufficient wire');
assert.equal(p.copper,10,'Copper must come only from building harvesting');
assert.ok(upgrades.enemies.length>ownersBefore,'Building owners must confront Cletus');
p.x=upgrades.shop.x;p.y=upgrades.shop.y;upgrades.tick++;
polish.updateCopper(upgrades,new Set(['interact']),null,false,0);
assert.equal(p.copper,0,'Pawn shop must consume exactly 10 copper');
assert.equal(p.uziGold,true,'Pawn shop must unlock the golden Uzi');
assert.equal(p.weapon,2,'Pawn shop must equip the golden Uzi');
assert.equal(upgrades.shop.purchased,true,'Pawn shop purchase must be one-time');
console.log('PASS 5 clues, +30% Uzi ammo, auto-heal, smart weapons, 7+ car models, copper shop and fighting building owners.');

// Mobile handheld layout and installation checks.
const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.webmanifest'),'utf8'));
assert.equal(manifest.display,'standalone','iOS/Android home-screen standalone mode');
assert.equal(manifest.start_url,'/FUN/cletus/play.html');
assert.match(html,/apple-mobile-web-app-capable/,'iOS standalone web app hint');
assert.match(html,/viewport-fit=cover/,'Use mobile safe-area insets');
assert.match(html,/manifest\.webmanifest/,'Web app manifest link');
assert.match(html,/window\.cletusFullscreen=function/,'Full-screen gesture button');
assert.match(html,/document\.addEventListener\('touchmove'/,'Prevent mobile page rubber-band scroll');
assert.match(html,/html,body,#root\{height:100%/,'Lock viewport height for touch screens');
assert.match(html,/@media\(pointer:coarse\) and \(max-width:1180px\) and \(orientation:landscape\)/,'Landscape gamepad mode');
assert.match(html,/\.mobile-pad\.touch-controls\{display:contents\}/,'Controller must flank the canvas in landscape');
const deckStart=source.indexOf('className:"mobile-pad touch-controls"');
const deckEnd=source.indexOf('className:"controls-row"',deckStart);
assert.ok(deckStart>0&&deckEnd>deckStart,'Mobile controller React component missing');
const deck=source.slice(deckStart,deckEnd);
for(const id of ['control-up','control-down','control-left','control-right','control-attack','control-dash','button-interact','control-swap','control-prev-weapon','control-next-weapon','button-pause-touch','button-sound-mobile','button-fullscreen']){
 assert.ok(deck.includes('data-testid:"'+id+'"'),'Missing SNES control '+id);
}
assert.ok(deck.includes('className:"dpad-hub"'),'D-pad cross hub missing');
assert.ok(deck.includes('className:"action-pad"'),'ABXY face cluster missing');
assert.ok(deck.includes('H("interact")'),'Copper action must support press-and-hold on touch');
assert.ok(deck.includes('H("attack")'),'Fire must support press-and-hold on touch');
assert.ok(deck.includes('H("dash")'),'Dash must support press-and-hold on touch');
assert.doesNotMatch(deck,/children:"Heal"/,'No old manual healing control');
console.log('PASS SNES mobile ABXY/dpad/LR, locked portrait and landscape, fullscreen gesture and home-screen app manifest.');
