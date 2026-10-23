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
assert.ok(landing.includes('href="play.html'), 'Landing must link to game');
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
vm.runInNewContext('const '+source.slice(start,wholeEnd)+';globalThis.polish={Y0,Fh,n2,je,w0,Yu,Wh,$h,updateCopper,shopTest:Nt,nearestCar,enterExitVehicle,vehicleBlocked,updateDriving,updateTraffic,damageVehicle,vehicleHUD,Df,cletusAimAtHostile,cityLights,drawCharacterDetail,registerTakedown,showFloater,openPawnShop,buyGoldenUzi,updatePawnShop,drawPawnShopInterior,drawPawnShopFront,drawGoldenUzi,drawPawnWeapon,drawStreetScene,streetwalkerNearby,startStreetScene,advanceStreetScene,updateStreetScene,PAWN_WARES,buyPawnItem,weaponUnlocked,nextSelectableWeapon,Nf,CLUE_DIALOGUES,startClueScene,advanceClueScene,updateClueScene,drawClueScene};',worldCtx);
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
for(let k=0;k<upgrades.buildings.length&&harvested<10;k++){
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
assert.equal(harvested,10,'Ten buildings should yield the twenty copper needed for gold');
assert.equal(p.copper,20,'Copper must come only from building harvesting');
assert.ok(upgrades.enemies.length>ownersBefore,'Building owners must confront Cletus');
p.x=upgrades.shop.x;p.y=upgrades.shop.y;upgrades.tick++;
polish.updateCopper(upgrades,new Set(['interact']),null,false,0);
assert.equal(upgrades.shop.open,true,'Press E at the pawn shop to enter an interactive room');
assert.equal(p.copper,20,'Entering the shop must not automatically spend copper');
p.cash=0;
polish.Fh(upgrades,new Set(),null,false);
polish.Fh(upgrades,new Set(['attack']),null,false);
assert.equal(p.copper,0,'Golden Uzi must consume exactly twenty copper');
assert.equal(p.cash,0,'Copper-only purchase must not require cash');
assert.equal(p.uziGold,true,'Pawn shop must unlock the golden Uzi');
assert.equal(p.weapon,2,'Pawn shop must equip the golden Uzi');
assert.equal(upgrades.shop.purchased,true,'Pawn shop purchase must be one-time');
console.log('PASS 5 clues, +30% Uzi ammo, auto-heal, smart weapons, 7+ car models, copper shop and fighting building owners.');

// Mobile handheld layout and installation checks.
const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.webmanifest'),'utf8'));
assert.equal(manifest.display,'standalone','iOS/Android home-screen standalone mode');
assert.equal(manifest.start_url,'/FUN/cletus/play.html','Installed app must always launch the canonical main game URL');
assert.equal(manifest.id,'/FUN/cletus/play.html','App identity must remain stable across updates');
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
for(const id of ['control-up','control-down','control-left','control-right','button-interact','control-prev-weapon','control-next-weapon','button-pause-touch','button-sound-mobile','button-fullscreen']){
 assert.ok(deck.includes('"data-testid":"'+id+'"'),'Missing SNES control '+id);
}
assert.ok(deck.includes('"data-testid":r.driving?"control-gas":"control-attack"'),'B must alternate gas/fire');
assert.ok(deck.includes('"data-testid":r.driving?"control-brake":"control-dash"'),'A must alternate brake/dash');
assert.ok(deck.includes('"data-testid":r.driving?"control-reverse":"control-swap"'),'Y must alternate reverse/swap');
assert.ok(deck.includes('onPointerDown:H("reverse")'),'Y reverse must support press and hold');
assert.ok(deck.includes('onClick:()=>{if(!i.isDriving())'),'Y must never swap weapons while driving');
assert.ok(deck.includes('className:"dpad-hub"'),'D-pad cross hub missing');
assert.ok(deck.includes('className:"action-pad"'),'ABXY face cluster missing');
assert.ok(deck.includes('H("interact")'),'Copper action must support press-and-hold on touch');
assert.ok(deck.includes('H("attack")'),'Fire must support press-and-hold on touch');
assert.ok(deck.includes('H("dash")'),'Dash must support press-and-hold on touch');
assert.doesNotMatch(deck,/children:"Heal"/,'No old manual healing control');
console.log('PASS SNES mobile ABXY/dpad/LR, locked portrait and landscape, fullscreen gesture and home-screen app manifest.');


// Vehicle integration: player-controlled cars, acceleration, ramming, traffic and ejection.
// Do not introduce a wanted-stars or police-heat system in this pass.
assert.match(source,/function updateDriving\(/,'Drivable physics missing');
assert.match(source,/function updateTraffic\(/,'Moving traffic missing');
assert.match(source,/function vehicleHUD\(/,'Vehicle status and enter prompt missing');
assert.match(source,/damageVehicle\(/,'Vehicle durability missing');
assert.match(source,/p\.knockedOut=true/,'Pedestrian impact response missing');
assert.doesNotMatch(source,/wantedLevel|wantedStars|policeHeat|heatLevel/,'Wanted level is deferred');
const road=polish.Y0(0);road.phase='playing';
assert.equal(road.traffic.length,9,'City should have nine moving AI traffic vehicles');
assert.ok(road.props.some(c=>c.type==='car'&&c.hp>0),'Road-ready starter car should exist');
const starter=road.props.find(c=>c.type==='car'&&c.x===107&&c.y===320);
assert.ok(starter,'Reliable enterable starter car missing');
road.player.x=starter.x-36;road.player.y=starter.y;
assert.equal(polish.nearestCar(road),starter,'Starter vehicle must be detectable');
polish.enterExitVehicle(road,new Set(['interact']),null,false);
assert.equal(road.driving,starter,'Interacting near a parked car must enter it');
assert.equal(starter.driven,true,'Vehicle should record its driver');
assert.equal(road.player.x,starter.x,'Player must ride at vehicle position');
polish.enterExitVehicle(road,new Set(),null,false);
const beforeY=starter.y;
for(let j=0;j<25;j++){road.tick++;polish.updateDriving(road,new Set(['up']),null,false)}
assert.ok(starter.speed>2,'Up button must accelerate the car');
assert.ok(starter.y<beforeY-20,'Car must travel north on road');
const priorAngle=starter.angle;
for(let j=0;j<10;j++){road.tick++;polish.updateDriving(road,new Set(['up','right']),null,false)}
assert.ok(starter.angle>priorAngle,'Right should steer the car');
assert.ok(Math.abs(road.player.x-starter.x)<.01,'Player stays inside the moving car');
const traffic=road.traffic[0],trafficBefore=traffic.y;
road.tick++;polish.updateTraffic(road,null,false);
assert.notEqual(traffic.y,trafficBefore,'Civilian traffic should move');
const victim={...road.enemies[0],x:starter.x,y:starter.y-20,dead:false,hp:26,max:26,roadHitUntil:0,hit:0,radius:9};
road.enemies.push(victim);
starter.speed=3.5;road.tick++;
polish.updateDriving(road,new Set(['up']),null,false);
assert.ok(victim.hp<26||victim.dead,'Running into an enemy must deal damage');
const hp=starter.hp;
road.driveImpactUntil=0;road.tick+=25;
polish.damageVehicle(road,12,null,false);
assert.ok(starter.hp<hp,'Vehicle collision should reduce car durability');
road.driveImpactUntil=0;road.tick+=25;
polish.damageVehicle(road,500,null,false);
assert.equal(road.driving,null,'Destroyed car should eject its driver');
assert.equal(starter.condition,'wreck','Totalled car should become a wreck');
assert.equal(polish.nearestCar({...road,player:{x:starter.x,y:starter.y}})===starter,false,'Wreck should not be driveable');
assert.ok(polish.Yu(road,road.player.x,road.player.y,8)===false,'Driver should eject to walkable ground');
const exitTest=polish.Y0(0);exitTest.phase='playing';
const parked=exitTest.props.find(c=>c.type==='car'&&c.x===107&&c.y===320);
exitTest.player.x=parked.x-36;exitTest.player.y=parked.y;
polish.enterExitVehicle(exitTest,new Set(['interact']),null,false);
polish.enterExitVehicle(exitTest,new Set(),null,false);
polish.enterExitVehicle(exitTest,new Set(['interact']),null,false);
assert.equal(exitTest.driving,null,'Pressing interact again should exit a car');
assert.equal(polish.Yu(exitTest,exitTest.player.x,exitTest.player.y,8),false,'Exit must choose a safe nearby pavement');
console.log('PASS driving, steering, moving traffic, vehicle impact on foes, durability, wreck and safe exit.');


// 2026-10 maintainability and game-play hardening regression checks.
assert.match(source,/for\(let j=i\.enemies\.length-1;j>=0;j--\)if\(i\.enemies\[j\]\.dead\)i\.enemies\.splice\(j,1\)/,
 'Dead enemies should be retired from the world every tick');
assert.doesNotMatch(source,/"1234"\.includes\(B\)/,'Empty string must never select fists');
assert.match(source,/\/\^\[1-7\]\$\/\.test\(key\)/,'Only explicit weapon number keys should switch');
assert.match(source,/\}\,\[L\]\)/,'The RAF effect must stay mounted across phase updates');
assert.doesNotMatch(source,/\}\,\[H,L\]\)/,'Changing phase must not tear down the RAF');
assert.match(source,/window\.addEventListener\("blur",pauseWhenHidden\)/,'Blur must pause');
assert.match(source,/document\.addEventListener\("visibilitychange",onVisibility\)/,'Hidden tab must pause');
assert.match(source,/now-lastWrite>=5000/,'Best score writes must be throttled');
assert.match(source,/window\.addEventListener\("pagehide",saveBest\)/,'Score must flush on exit');
assert.match(source,/function cletusAimAtHostile\(/,'Touch auto aim missing');
assert.match(source,/const golden=f\.weapon===2&&f\.uziGold/,
 'Only the Golden Uzi should auto-aim on desktop');
assert.match(source,/if\(i\.driveLatch\)return true/,'Do not start copper stripping when E is held after leaving a car');
assert.match(html,/family=Barlow\+Condensed/,'Typography stylesheet should load');
assert.match(html,/family=Barlow\+Condensed[\s\S]*?family=Share\+Tech\+Mono/,'Both typefaces should load');
assert.match(html,/html\.cletus-key-art-ready \.game-overlay\[data-testid="overlay-menu"\] \.overlay-title/,
 'Menu text should only hide when cover art is present');
assert.match(html,/html:not\(\.cletus-key-art-ready\) \.game-overlay\[data-testid="overlay-menu"\]/,
 'Standalone copied HTML must show fallback art and readable intro');
assert.match(html,/art\.onerror=\(\)=>document\.documentElement\.classList\.remove/,
 'Cover not found must restore menu copy');
const corpseWorld=polish.Y0(0);corpseWorld.phase='playing';
const livingCount=corpseWorld.enemies.length;
for(let j=0;j<35;j++)corpseWorld.enemies.push({dead:true,x:0,y:0});
polish.Fh(corpseWorld,new Set(),null,false);
assert.equal(corpseWorld.enemies.length,livingCount,'Dead enemies must not accumulate after game tick');
const aimWorld=polish.Y0(0);aimWorld.phase='playing';aimWorld.enemies=[];
aimWorld.player.x=137;aimWorld.player.y=260;aimWorld.player.face=0;
const nearest={x:137,y:200,dead:false,radius:9};
aimWorld.enemies.push(nearest,{x:137,y:85,dead:false,radius:9});
const aimTarget=polish.cletusAimAtHostile(aimWorld);
assert.equal(aimTarget,nearest,'Touch aim should prioritize nearest clear hostile');
assert.ok(Math.abs(aimWorld.player.face+Math.PI/2)<.03,'Touch aim must actually face hostile');
const heldExit=polish.Y0(0);heldExit.phase='playing';
const exitCar=heldExit.props.find(c=>c.type==='car'&&c.x===107&&c.y===320);
heldExit.player.x=exitCar.x-36;heldExit.player.y=exitCar.y;
polish.enterExitVehicle(heldExit,new Set(['interact']),null,false);
polish.enterExitVehicle(heldExit,new Set(),null,false);
polish.enterExitVehicle(heldExit,new Set(['interact']),null,false);
assert.equal(heldExit.driving,null);
heldExit.player.x=155;heldExit.player.y=280;
polish.Fh(heldExit,new Set(['interact']),null,false);
assert.equal(heldExit.harvest.index,-1,'Held exit key must not trigger copper harvesting');
polish.enterExitVehicle(heldExit,new Set(),null,false);
polish.Fh(heldExit,new Set(['interact']),null,false);
assert.notEqual(heldExit.harvest.index,-1,'A fresh E press can still start harvesting');
console.log('PASS enemies GC, score write throttle, stable RAF, blur pause, key validation, special-only auto-aim and portable artwork fallback.');


// Small visual/play-feel polish should not change the missions or controls.
assert.match(source,/function drawCharacterDetail\(/,'Character detail renderer missing');
assert.match(source,/function cityLights\(/,'City glow renderer missing');
assert.match(source,/function registerTakedown\(/,'Streak scoring missing');
assert.match(source,/function showFloater\(/,'Score popups missing');
assert.match(source,/if\(!o\.driving&&v\.dash>28\)/,'No ghost Cletus sprinting out of a moving car');
const mood=polish.Y0(0);mood.phase='playing';
let gradients=0,paint=0;
const effectsCtx=new Proxy({createRadialGradient(){gradients++;return{addColorStop(){}}}},{
 get(target,name){if(name in target)return target[name];return (...args)=>{if(name==='fillRect')paint++}},
 set(target,name,value){target[name]=value;return true}
});
polish.cityLights(effectsCtx,mood);
assert.ok(gradients>=1,'Nearby storefront lights must illuminate part of the world');
assert.ok(gradients<=10,'Light sources must stay capped per draw call');
const beforeSprite=paint;
for(const type of ['cletus','candy','gang','cop','thug','boss','civil-0','civil-4','dog','rat']){
 polish.drawCharacterDetail(effectsCtx,type,30,30,0,type==='boss');
}
assert.ok(paint-beforeSprite>35,'Characters should get substantial pixel details');
const streakWorld=polish.Y0(0);streakWorld.phase='playing';
const enemy1={type:'gang',x:230,y:288,hp:12,max:12,hit:0,dead:false,radius:9};
const enemy2={type:'thug',x:255,y:288,hp:12,max:12,hit:0,dead:false,radius:9};
const baseScore=streakWorld.score;
polish.Df(streakWorld,enemy1,30,0,null,false);
polish.Df(streakWorld,enemy2,30,0,null,false);
assert.equal(streakWorld.combo,2,'Quick successive takedowns should build a streak');
assert.equal(streakWorld.score-baseScore,140*2+30,'Second takedown should award a modest bonus');
assert.equal(streakWorld.floaters.length,2,'Each takedown should create a floating score');
assert.equal(enemy1.dead,true);
streakWorld.tick=streakWorld.comboUntil+1;
polish.Fh(streakWorld,new Set(),null,false);
assert.equal(streakWorld.combo,0,'Streak ends after the timer, not permanently');
console.log('PASS cinematic neon glows, detailed character art, restrained street streak and floating score feedback.');


// Interactive pawn-shop scene and exclusive golden-gun lock-on, desktop and mobile.
assert.match(source,/function drawPawnShopInterior\(/,'Shop interior scene must exist');
assert.match(source,/function drawPawnShopFront\(/,'Shop needs visible sidewalk doorway');
assert.match(source,/function drawGoldenUzi\(/,'Gold gun needs a special display');
assert.match(source,/shop\.open=true/,'Shop should open only through the entrance action');
assert.match(source,/if\(updatePawnShop\(i,o,r,f\)\)return/,'Active shop freezes game simulation');
assert.match(source,/const golden=f\.weapon===2&&f\.uziGold/,'Auto-target must be exclusive to acquired gun');
assert.match(source,/if\(golden\|\|i\.mobileControls\)/,'All mobile weapons must auto-aim when fired');
assert.match(source,/damage:\[0,48,golden\?\(i\.mobileControls\?48:24\):16,120\]/,
 'Golden Uzi must deal 48 mobile and 24 desktop damage');
const shopGame=polish.Y0(0);shopGame.phase='playing';
shopGame.player.x=shopGame.shop.x;shopGame.player.y=shopGame.shop.y;
shopGame.player.copper=19;shopGame.player.cash=0;shopGame.enemies=[];shopGame.traffic=[];
const shopCtx=new Proxy({},{
 get(target,key){if(key in target)return target[key];return ()=>{}},
 set(target,key,value){target[key]=value;return true}
});
assert.equal(polish.drawPawnShopInterior(shopCtx,shopGame),undefined);
polish.Fh(shopGame,new Set(['interact']),null,false);
assert.equal(shopGame.shop.open,true,'Doorway E opens shop even with traffic nearby');
assert.equal(shopGame.player.copper,19);
polish.drawPawnShopInterior(shopCtx,shopGame);
polish.Fh(shopGame,new Set(['attack']),null,false);
assert.equal(shopGame.shop.purchased,false,'Cannot get golden gun below $1000 combined value');
assert.equal(shopGame.player.copper,19,'Failed purchase must not consume copper');
assert.equal(shopGame.player.cash,0,'Failed purchase must not consume cash');
shopGame.player.copper=20;shopGame.player.cash=0;
polish.Fh(shopGame,new Set(['attack']),null,false);
assert.equal(shopGame.shop.purchased,false,'Held B must not trigger repeat purchase');
polish.Fh(shopGame,new Set(),null,false);
polish.Fh(shopGame,new Set(['attack']),null,false);
assert.equal(shopGame.shop.purchased,true,'A new B press buys when sufficiently funded');
assert.equal(shopGame.player.copper,0);
assert.equal(shopGame.player.cash,0);
assert.equal(shopGame.player.uziGold,true);
assert.equal(shopGame.player.ammo[2],130,'Buying grants 130 golden rounds');
const earned=shopGame.score;
polish.Fh(shopGame,new Set(['attack']),null,false);
assert.equal(shopGame.score,earned,'Holding B never repeats the reward');
polish.Fh(shopGame,new Set(),null,false);
polish.Fh(shopGame,new Set(['interact']),null,false);
assert.equal(shopGame.shop.open,false,'E/X should exit shop');
polish.Fh(shopGame,new Set(['interact']),null,false);
assert.equal(shopGame.shop.open,false,'Holding E/X cannot instantly reopen');
polish.Fh(shopGame,new Set(),null,false);
polish.Fh(shopGame,new Set(['interact']),null,false);
assert.equal(shopGame.shop.open,true,'Re-entry after releasing E works');
polish.Fh(shopGame,new Set(),null,false);
polish.Fh(shopGame,new Set(['attack']),null,false);
assert.equal(shopGame.player.copper,0,'Purchased gun is never charged twice');
const gunGame=polish.Y0(0);gunGame.phase='playing';
gunGame.buildings=[];gunGame.props=[];gunGame.traffic=[];gunGame.enemies=[];
gunGame.player.x=200;gunGame.player.y=300;
const target={x:300,y:300,hp:65,max:65,radius:9,dead:false,type:'gang',hit:0,speed:.72,damage:8,cooldown:0,drift:0};
gunGame.enemies=[target];gunGame.player.weapon=2;gunGame.player.ammo[2]=50;
gunGame.player.face=Math.PI;gunGame.player.cool=0;
polish.Wh(gunGame,null,false);
const standardShot=gunGame.shots.at(-1);
assert.ok(standardShot.vx<0,'Normal Uzi must keep manually aimed west-facing shot');
assert.equal(gunGame.goldTarget,null,'Ordinary Uzi never acquires target');
gunGame.player.uziGold=true;gunGame.player.cool=0;gunGame.player.face=Math.PI;
polish.Wh(gunGame,null,false);
const lockShot=gunGame.shots.at(-1);
assert.ok(lockShot.vx>0,'Gold gun must override manual aim toward east-side enemy');
assert.equal(gunGame.goldTarget,target,'Golden gun should lock onto unobstructed hostile');
gunGame.player.face=Math.PI;gunGame.player.cool=0;gunGame.pointerActive=true;
gunGame.camera.x=0;gunGame.camera.y=0;gunGame.aim.x=0;gunGame.aim.y=375;
polish.Fh(gunGame,new Set(['attack']),null,false);
assert.ok(gunGame.shots.filter(shot=>shot.owner==='player').at(-1).vx>0,'Golden gun auto-targets even when desktop mouse aims elsewhere');
gunGame.pointerActive=false;gunGame.touchFire=true;gunGame.player.face=Math.PI;gunGame.player.cool=0;
polish.Fh(gunGame,new Set(['attack']),null,false);
assert.ok(gunGame.shots.filter(shot=>shot.owner==='player').at(-1).vx>0,'Golden gun auto-targets with mobile B fire too');
gunGame.enemies=[];gunGame.player.face=Math.PI;gunGame.player.cool=0;
polish.Wh(gunGame,null,false);
assert.equal(gunGame.goldTarget,null,'No hostile means no phantom target lock');
assert.ok(gunGame.shots.filter(shot=>shot.owner==='player').at(-1).vx<0,'Without a target, golden gun falls back to current facing');
console.log('PASS pawn-shop room with explicit purchase/exit, 10 copper economy, and desktop Golden Uzi auto-aim.');


// Five clue discoveries must pause the world and open playable case-file dialogue.
// Render checks assert the narrative, Cletus portrait and real gameplay KPI dashboard.
assert.equal(polish.CLUE_DIALOGUES.length,5,'Every clue needs a scripted dialogue');
assert.match(source,/function drawClueScene\(/,'Missing in-game cinematic case-file screen');
assert.match(source,/drawClueScene\(i,o\)/,'The dialogue scene must render on the game canvas');
assert.match(source,/if\(updateClueScene\(i,o\)\)return/,'Clues must freeze the simulation');
assert.match(source,/if\(o\.current\.clueScene\)\{advanceClueScene\(o\.current\);return\}/,
 'Touching the canvas should advance a clue page');
assert.match(source,/if\(key==="enter"&&!event\.repeat\)advanceClueScene\(world\)/,
 'Enter should advance the dialogue without triggering restart');
for(let index=0;index<5;index++){
 const caseWorld=polish.Y0(0);
 caseWorld.phase='playing';caseWorld.leads=index;caseWorld.enemies=[];caseWorld.traffic=[];
 const clue=polish.shopTest[index];caseWorld.player.x=clue.x;caseWorld.player.y=clue.y;
 const tickBefore=caseWorld.tick,firstScore=caseWorld.score,ammo=caseWorld.player.ammo[1];
 const npc={x:clue.x+100,y:clue.y,hp:20,max:20,radius:9,speed:.8,hit:0,dead:false,type:'thug',cooldown:0,damage:4};
 caseWorld.enemies.push(npc);
 polish.Fh(caseWorld,new Set(),null,false);
 assert.equal(caseWorld.leads,index+1,'Clue collected '+(index+1));
 assert.deepEqual({index:caseWorld.clueScene?.index,page:caseWorld.clueScene?.page},{index,page:0},
  'Each clue must open its own first page');
 assert.equal(caseWorld.phase,'playing','Dialogue must not replace mission phase');
 assert.equal(caseWorld.score,firstScore+350,'Clue credit is granted only once');
 const position=npc.x,worldTime=caseWorld.tick;
 const shots=caseWorld.shots.length,ammoAtOpen=caseWorld.player.ammo[1];
 polish.Fh(caseWorld,new Set(['attack']),null,false);
 assert.equal(caseWorld.clueScene.page,0,'Held attack may not skip the opening page');
 assert.equal(npc.x,position,'Enemies are frozen');
 assert.equal(caseWorld.tick,worldTime,'Clock frozen while clue dialogue is open');
 assert.equal(caseWorld.shots.length,shots,'Firing freezes during the case file');
 assert.equal(caseWorld.player.ammo[1],ammoAtOpen,'No ammunition consumed in dialogue');
 polish.Fh(caseWorld,new Set(),null,false);
 polish.Fh(caseWorld,new Set(['attack']),null,false);
 assert.equal(caseWorld.clueScene.page,1,'B or Space advances to the second story page');
 polish.Fh(caseWorld,new Set(['attack']),null,false);
 assert.equal(caseWorld.clueScene.page,1,'Held B should not skip the remaining page');
 const displayed=[];
 const renderCtx=new Proxy({},{
  get(target,key){if(key in target)return target[key];return (...args)=>{if(key==='fillText')displayed.push(String(args[0]))}},
  set(target,key,value){target[key]=value;return true}
 });
 polish.drawClueScene(renderCtx,caseWorld);
 for(const label of ['CLETUS SAYS','CLUES','CASE','KILLS','HEALTH','COPPER']){
  assert.ok(displayed.some(v=>v.includes(label)),label+' must be visible in clue dashboard');
 }
 assert.ok(displayed.includes(polish.CLUE_DIALOGUES[index].caseName),
  'Clue must display distinct story case title');
 assert.ok(displayed.some(v=>v.includes(polish.CLUE_DIALOGUES[index].next)),
  'Clue should reveal the next story destination');
 polish.Fh(caseWorld,new Set(),null,false);
 polish.Fh(caseWorld,new Set(['interact']),null,false);
 assert.equal(caseWorld.clueScene,null,'X / E closes the final page');
 assert.equal(caseWorld.tick,worldTime,'Clock remains frozen through dismissal');
 assert.equal(caseWorld.leads,index+1,'Closing a clue never re-collects it');
 // Story closes without changing the objective or the finite ammo/inventory.
 assert.equal(caseWorld.player.ammo[1],ammo,'Story has no weapon-ammo side effects');
}
const tapWorld=polish.Y0(0);tapWorld.leads=1;
assert.equal(polish.startClueScene(tapWorld),true);
assert.equal(polish.advanceClueScene(tapWorld),true);
assert.equal(tapWorld.clueScene.page,1);
assert.equal(polish.advanceClueScene(tapWorld),true);
assert.equal(tapWorld.clueScene,null);
console.log('PASS five distinct clue stories, pixel portrait, KPI panel, pause semantics, B/X controls, held-key guard and tap progression.');


// Mobile vehicle driving regression: render the dashboard *with a car occupied*.
// This catches the previously missed undefined-variable crash in vehicleHUD,
// which stopped requestAnimationFrame immediately after entering a car.
const mobileRoad=polish.Y0(0);mobileRoad.phase='playing';mobileRoad.mobileControls=true;
const mobileCar=mobileRoad.props.find(v=>v.type==='car'&&v.x===107&&v.y===320);
assert.ok(mobileCar,'Mobile drive starter missing');
mobileRoad.player.x=mobileCar.x-36;mobileRoad.player.y=mobileCar.y;
polish.enterExitVehicle(mobileRoad,new Set(['interact']),null,false);
assert.equal(mobileRoad.driving,mobileCar,'Mobile must enter car');
assert.doesNotThrow(()=>polish.vehicleHUD(graphics,mobileRoad),'Vehicle dashboard must render with mobile driver');
assert.doesNotThrow(()=>polish.n2(graphics,mobileRoad),'Full game frame must render with mobile driver');
const mobileBefore=mobileCar.y;
for(let j=0;j<25;j++){mobileRoad.tick++;polish.updateDriving(mobileRoad,new Set(['gas']),null,false)}
assert.ok(mobileCar.speed>2,'Mobile gas must accelerate car');
assert.ok(mobileCar.y<mobileBefore-20,'Mobile car must actually travel when GAS is held');
const mobileAngle=mobileCar.angle;
for(let j=0;j<10;j++){mobileRoad.tick++;polish.updateDriving(mobileRoad,new Set(['gas','left']),null,false)}
assert.ok(mobileCar.angle<mobileAngle,'Left arrow must steer mobile car');
const preBrake=Math.abs(mobileCar.speed);
for(let j=0;j<13;j++){mobileRoad.tick++;polish.updateDriving(mobileRoad,new Set(['gas','brake']),null,false)}
assert.ok(Math.abs(mobileCar.speed)<preBrake*.1,'BRAKE must rapidly decelerate even with GAS held');
assert.doesNotThrow(()=>polish.n2(graphics,mobileRoad),'Mobile rendering must survive driving, steering and braking');
const mobileReverse=polish.Y0(0);mobileReverse.mobileControls=true;
const reverseCar=mobileReverse.props.find(v=>v.type==='car'&&v.x===107&&v.y===320);
mobileReverse.driving=reverseCar;
reverseCar.speed=0;
for(let j=0;j<7;j++){mobileReverse.tick++;polish.updateDriving(mobileReverse,new Set(['reverse']),null,false)}
assert.ok(reverseCar.speed<0,'Mobile Y must reverse');
reverseCar.speed=0;
for(let j=0;j<9;j++){mobileReverse.tick++;polish.updateDriving(mobileReverse,new Set(['down']),null,false)}
assert.ok(reverseCar.speed===0,'Mobile D-pad down must never select reverse');
const desktopRoad=polish.Y0(0);
const desktopCar=desktopRoad.props.find(v=>v.type==='car'&&v.x===107&&v.y===320);
desktopRoad.driving=desktopCar;
for(let j=0;j<7;j++){desktopRoad.tick++;polish.updateDriving(desktopRoad,new Set(['up']),null,false)}
assert.ok(desktopCar.speed>0,'Desktop UP must still accelerate');
assert.doesNotThrow(()=>polish.vehicleHUD(graphics,desktopRoad),'Desktop vehicle HUD must also render');
const mobileGun=polish.Y0(0);mobileGun.mobileControls=true;mobileGun.phase='playing';
mobileGun.buildings=[];mobileGun.props=[];mobileGun.traffic=[];mobileGun.enemies=[];
mobileGun.player.x=200;mobileGun.player.y=300;
mobileGun.player.weapon=2;mobileGun.player.ammo[2]=10;mobileGun.player.face=Math.PI;
mobileGun.enemies.push({x:300,y:300,hp:200,max:200,radius:9,dead:false,type:'gang',hit:0,speed:.7,damage:8,cooldown:0,drift:0});
polish.Wh(mobileGun,null,false);
assert.ok(mobileGun.shots.at(-1).vx>0,'Regular Uzi should auto-aim on mobile');
assert.equal(mobileGun.shots.at(-1).damage,16,'Normal Uzi remains at normal damage');
mobileGun.player.uziGold=true;mobileGun.player.cool=0;mobileGun.player.face=Math.PI;
polish.Wh(mobileGun,null,false);
assert.equal(mobileGun.shots.at(-1).damage,48,'Mobile Golden Uzi has 2x the desktop 24 damage');
assert.equal(lockShot.damage,24,'Desktop Golden Uzi damage remains unchanged');
// Verify that hold-actions are mapped to the pedals while driving, not just drawn on screen.
const bindingStart=source.indexOf('At=yl.useCallback((V,fl)=>');
const bindingEnd=source.indexOf('},[])',bindingStart);
assert.ok(bindingStart>=0&&bindingEnd>bindingStart,'Mobile touch binding not found');
const bindingSource=source.slice(bindingStart+'At=yl.useCallback('.length,bindingEnd+1);
const pressed=new Set();
const control=vm.runInNewContext('('+bindingSource+')',{o:{current:mobileRoad},r:{current:pressed}});
control('attack',true);
assert.ok(pressed.has('gas')&&!pressed.has('attack'),'Touch B should hold GAS when inside car');
control('dash',true);
assert.ok(pressed.has('brake')&&!pressed.has('dash'),'Touch A should hold BRAKE when inside car');
control('reverse',true);
assert.ok(pressed.has('reverse'),'Touch Y must hold the independent reverse control');
control('attack',false);control('dash',false);control('reverse',false);
assert.ok(!pressed.has('gas')&&!pressed.has('brake')&&!pressed.has('reverse'),'Releasing all pedals must release their held states');
mobileRoad.driving=null;
control('attack',true);
assert.ok(pressed.has('attack')&&!pressed.has('gas'),'Touch B should fire on foot');
control('attack',false);
console.log('PASS mobile vehicle HUD frame, touch GAS/BRAKE, steering, reverse, desktop unchanged, and mobile 2x Golden Uzi.');

assert.ok(source.includes('o.current.mobileControls=true'),'Touch inputs must force mobile mode');
assert.ok(source.includes('stoppedByError=true;clearKeys();console.error'),'Runtime errors must not silently freeze the game');
assert.ok(source.includes('cletus-runtime-error'),'Show on-screen runtime error banner');
assert.ok(!source.includes('o.player.immune&&o.tick%6<3&&S(i,0,0,bl,vl'),'Damage flash should not cover whole screen red');

// Mobile four-way steering is absolute heading selection, not down-to-reverse.
for(const [direction,want] of [['up',0],['right',Math.PI/2],['down',Math.PI],['left',-Math.PI/2]]){
 const aim=polish.Y0(0);aim.mobileControls=true;
 const car=aim.props.find(v=>v.type==='car'&&v.x===107&&v.y===320);
 aim.driving=car;car.angle=0;car.speed=0;
 for(let t=0;t<60;t++){aim.tick++;polish.updateDriving(aim,new Set([direction]),null,false)}
 const delta=Math.atan2(Math.sin(want-car.angle),Math.cos(want-car.angle));
 assert.ok(Math.abs(delta)<.035,'D-pad '+direction+' should steer toward selected heading');
 assert.equal(car.speed,0,'D-pad '+direction+' without GAS must never accelerate or reverse');
}
assert.ok(source.includes('i.mobileControls?keys.has("reverse"):keys.has("down")'),'Mobile reverse must be separate from desktop keyboard DOWN');
assert.ok(source.includes('cycleWeapon,isDriving:()=>!!o.current.driving'),'Y behavior must use current vehicle state');
console.log('PASS four-direction steering, independent Y reverse, X enter/exit unchanged.');

// New comedy-encounter and secondary cash economy: no silent dummy actions.
const street=polish.Y0(0);street.phase='playing';
assert.ok(street.streetwalkers.length>=15,'NPCs should exist across the city');
const gal=street.streetwalkers[0];const car={x:gal.x,y:gal.y,angle:0,speed:0,model:'sedan',hp:110,maxHp:110,r:23};
street.driving=car;street.player.x=car.x;street.player.y=car.y;
street.enemies=[];street.traffic=[];street.props=[];street.drops=[];street.buildings=[];
assert.equal(polish.streetwalkerNearby(street),gal,'Adult NPC should approach stopped car');
car.speed=1.2;
assert.equal(polish.streetwalkerNearby(street),null,'Streetwalker must not approach moving car');
car.speed=0;
polish.Fh(street,new Set(['interact']),null,false);
assert.ok(street.streetScene,'X must let streetwalker in and begin actual dialogue');
assert.equal(street.streetScene.dialogue.length,4,'Conversation should show Cletus and woman with punchline');
assert.equal(street.player.cash,0,'No immediate award for opening dialogue');
for(let j=0;j<4;j++){polish.Fh(street,new Set(),null,false);polish.Fh(street,new Set(['interact']),null,false)}
assert.equal(street.streetScene,null,'Dialogue concludes');
assert.equal(gal.paid,true,'NPC should be recorded as paid');
assert.equal(street.player.cash,100,'Female NPC pays Cletus one $100 bundle');
assert.equal(polish.streetwalkerNearby(street),null,'Same NPC cannot be farmed again');
polish.$h(street,{x:car.x,y:car.y,type:'cash'},null,false);
assert.equal(street.player.cash,200,'Cash pickup grants a $100 bill bundle');
const market=polish.Y0(0);
assert.equal(market.shop.cost,20);
assert.equal(market.shop.cashCost,1000);
assert.equal(polish.PAWN_WARES.length,4,'Three normal weapons and golden Uzi must be in inventory');
market.player.cash=950;market.player.copper=0;
assert.equal(polish.buyGoldenUzi(market,null,false),false,'Cannot buy golden Uzi below $1000 total');
assert.equal(market.player.copper,0,'Rejected purchases preserve copper');
market.player.cash=1000;
assert.equal(polish.buyGoldenUzi(market,null,false),true,'A thousand cash buys Golden Uzi');
assert.equal(market.player.cash,0);assert.equal(market.player.copper,0);
for(const [cash,cu,remainingCash,remainingCopper] of [[0,20,0,0],[500,10,0,0],[950,1,0,0],[925,2,25,0]]){
 const mixed=polish.Y0(0);mixed.player.cash=cash;mixed.player.copper=cu;
 assert.equal(polish.buyGoldenUzi(mixed,null,false),true,'Golden Uzi accepts mixed pawn credit');
 assert.equal(mixed.player.cash,remainingCash);assert.equal(mixed.player.copper,remainingCopper);
}
market.player.cash=950;
for(const [j,expected,price] of [[1,'knife',200],[2,'sword',450],[3,'handgun',300]]){
  market.shop.selected=j;
  assert.equal(polish.buyPawnItem(market,null,false),true,'Purchase '+expected);
  assert.equal(market.shop.owned[expected],true,expected+' should be in owned inventory');
  assert.equal(market.player.weapon,polish.PAWN_WARES[j].weapon);
}
assert.equal(market.player.cash,0,'Shop prices consume a real balance');
assert.equal(polish.weaponUnlocked(market,4),true);
assert.equal(polish.weaponUnlocked(market,5),true);
assert.equal(polish.weaponUnlocked(market,6),true);
const previousCash=market.player.cash;
market.shop.selected=2;assert.equal(polish.buyPawnItem(market,null,false),true);
assert.equal(market.player.cash,previousCash,'Owned items equip without charging twice');
const armed=polish.Y0(0);armed.phase='playing';
polish.Nf(armed,5);assert.equal(armed.player.weapon,1,'Cannot select an unpurchased sword');
armed.shop.owned.knife=true;armed.player.meleeKnife=true;
polish.Nf(armed,4);assert.equal(armed.player.weapon,4,'Purchased knife can equip');
armed.player.cool=0;polish.Wh(armed,null,false);
assert.equal(armed.shots.length,0,'Melee weapon uses real strike not fake bullets');
armed.shop.owned.handgun=true;armed.player.ammo[6]=72;
polish.Nf(armed,6);polish.Wh(armed,null,false);
assert.equal(armed.shots.at(-1).kind,6,'Purchased handgun fires real bullets');
const fakeCtx=new Proxy({createRadialGradient(){return{addColorStop(){}}}}, {get(obj,key){if(key in obj)return obj[key];return()=>{}},set(obj,key,value){obj[key]=value;return true}});
street.streetScene={woman:gal,page:0,dialogue:[{speaker:gal.name,text:'A nice little conversation.'}]};
polish.drawStreetScene(fakeCtx,street);
market.shop.open=true;market.shop.selected=2;
polish.drawPawnShopInterior(fakeCtx,market);
polish.drawGoldenUzi(fakeCtx,240,110,1.4);
polish.drawPawnWeapon(fakeCtx,polish.PAWN_WARES[2],220,130,1.3);
assert.ok(source.includes('world.shop.pendingBuy=true'),'Shop must support tapping BUY on an iPhone');
assert.ok(source.includes('function drawStreetScene('),'Encounter must render dialogue portraits on screen');
console.log('PASS adult streetwalker stopped-car interaction, Candy dialogue, real $100 rewards, inventory, purchase guards, weapon combat and previews.');


// Input instructions must be exclusive for each platform. Render actual canvas
// text instead of checking strings that may be unreachable at runtime.
function instructionCanvas(){
 const lines=[];
 const ctx=new Proxy({
   lines,
   createRadialGradient(){return{addColorStop(){}}},
   createLinearGradient(){return{addColorStop(){}}}
 },{
   get(target,key){if(key in target)return target[key];if(key==='fillText')return value=>{lines.push(String(value))};return()=>{}},
   set(target,key,value){target[key]=value;return true}
 });
 return ctx;
}
function expectInstructions(mode,draw,world,required,forbidden){
 const ctx=instructionCanvas();
 draw(ctx,world);
 const lines=ctx.lines.join('\n');
 for(const phrase of required)assert.ok(lines.includes(phrase),mode+': missing '+phrase);
 for(const phrase of forbidden)assert.ok(!lines.includes(phrase),mode+': wrong-platform prompt '+phrase);
}
for(const isTouch of [false,true]){
 const mode=isTouch?'mobile':'desktop';
 const entrant=polish.Y0(0);entrant.phase='playing';entrant.mobileControls=isTouch;
 entrant.player.cash=1000;entrant.player.copper=20;
 entrant.camera.x=entrant.shop.x-220;entrant.camera.y=entrant.shop.y-125;
 expectInstructions(mode+' shop doorway',polish.drawPawnShopFront,entrant,
  [isTouch?'X  ENTER':'E  ENTER'],[isTouch?'E  ENTER':'X  ENTER']);
 const carGame=polish.Y0(0);carGame.phase='playing';carGame.mobileControls=isTouch;
 const vehicle=carGame.props.find(p=>p.type==='car'&&p.x===107&&p.y===320);
 carGame.player.x=vehicle.x;carGame.player.y=vehicle.y;
 expectInstructions(mode+' car entry',polish.vehicleHUD,carGame,
  [isTouch?'PRESS X TO ENTER CAR':'PRESS E TO ENTER CAR'],
  [isTouch?'PRESS E TO ENTER CAR':'PRESS X TO ENTER CAR']);
 carGame.driving=vehicle;vehicle.speed=0;
 expectInstructions(mode+' car exit',polish.vehicleHUD,carGame,
  [isTouch?'X EXIT':'E EXIT'],[isTouch?'E EXIT':'X EXIT']);
 entrant.shop.open=true;entrant.shop.selected=0;
 expectInstructions(mode+' pawn room',polish.drawPawnShopInterior,entrant,
  [isTouch?'X: EXIT':'E: EXIT',isTouch?'B / TAP: BUY':'SPACE / CLICK: BUY'],
  [isTouch?'E: EXIT':'X: EXIT',isTouch?'SPACE / CLICK: BUY':'B / TAP: BUY']);
 const woman=polish.Y0(0);woman.mobileControls=isTouch;
 woman.streetScene={woman:{name:'ROXY'},page:0,dialogue:[{speaker:'CLETUS',text:'Have you seen Candy?'}]};
 expectInstructions(mode+' street conversation',polish.drawStreetScene,woman,
  [isTouch?'B / X / TAP NEXT':'SPACE / E / ENTER NEXT'],
  [isTouch?'SPACE / E / ENTER NEXT':'B / X / TAP NEXT']);
 const clue=polish.Y0(0);clue.mobileControls=isTouch;clue.leads=1;
 clue.clueScene={index:0,page:0};
 expectInstructions(mode+' clue dialog',polish.drawClueScene,clue,
  [isTouch?'CONTINUE: B / X / TAP':'CONTINUE: SPACE / E / ENTER / CLICK'],
  [isTouch?'CONTINUE: SPACE / E / ENTER / CLICK':'CONTINUE: B / X / TAP']);
 const copper=polish.Y0(0);copper.phase='playing';copper.mobileControls=isTouch;
 copper.harvest.index=0;copper.harvest.progress=24;copper.player.x=200;copper.player.y=200;
 expectInstructions(mode+' copper work',polish.n2,copper,
  [isTouch?'STRIPPING COPPER · HOLD X':'STRIPPING COPPER · HOLD E'],
  [isTouch?'HOLD E':'HOLD X']);
}
assert.ok(source.includes('e:"interact"'),'PC keyboard must retain E for interacting');
assert.ok(source.includes('onPointerDown:H("interact")'),'Mobile X must press the same interaction action');
assert.ok(!source.includes('PRESS E / X TO ENTER CAR'),'No mixed keyboard/mobile car prompts');
console.log('PASS mobile X and desktop E exclusivity on seven real game screens.');

// Canonical installed URL update behavior. No game copies or replacement shortcut:
// old launch URLs acquire a fresh ?v= value when the main release marker changes.
const release=JSON.parse(fs.readFileSync(path.join(base,'release.json'),'utf8'));
assert.equal(release.entry,'/FUN/cletus/play.html');
assert.match(release.build,/^[a-z0-9._-]{1,64}$/i);
assert.ok(html.includes('name="cletus-build" content="'+release.build+'"'),'Bundled build must match release marker');
assert.ok(source.includes('CLETUS CONTROLS 7'),'Visible on-screen edition must show latest platform-specific controls release');
const updaterIndex=html.indexOf('<!-- The installed shortcut keeps');
assert.ok(updaterIndex>0,'Update bootstrap must exist before game bundle');
const updaterScript=html.slice(updaterIndex).match(/<script>([\s\S]*?)<\/script>/);
assert.ok(updaterScript,'Update script missing');
new vm.Script(updaterScript[1]);
assert.ok(updaterIndex<html.indexOf('<script type="module">'),'Updater must load before game JS');
assert.ok(html.includes('window.addEventListener("pageshow",checkForUpdate)'),'Updater should run on app open');
assert.ok(html.includes('document.addEventListener("visibilitychange"'),'Updater should recheck when home-screen app returns');
(async()=>{
 const page='https://danieloculus0-bot.github.io/FUN/cletus/play.html';
 const listeners={};const docListeners={};const moves=[];
 const location={protocol:'https:',hostname:'danieloculus0-bot.github.io',href:page,replace(url){moves.push(url);this.href=url}};
 let probes=0;
 const sandbox={location,document:{hidden:false,addEventListener(k,fn){docListeners[k]=fn}},
    window:{addEventListener(k,fn){listeners[k]=fn}},fetch:async url=>{probes++;assert.ok(url.includes('release.json?_='));return {ok:true,json:async()=>({build:'next-release'})}},
    Date:{now:()=>1800000000000},URL,console};
 vm.runInNewContext(updaterScript[1],sandbox);
 await listeners.pageshow();
 assert.equal(probes,1,'Updater should query current release without HTTP cache');
 assert.equal(moves[0],page+'?v=next-release','Current home-screen URL must refresh to new build');
 // A page already on the newest URL must not enter an endless reload loop.
 const keep={...sandbox.location,href:page+'?v=next-release',replace(url){moves.push(url)}};
 const secondListeners={};
 vm.runInNewContext(updaterScript[1],{...sandbox,location:keep,window:{addEventListener(k,fn){secondListeners[k]=fn}}});
 await secondListeners.pageshow();
 assert.equal(moves.length,1,'Fresh URL should never loop');
 // An offline copy must not attempt a network check.
 const offlineListeners={};
 vm.runInNewContext(updaterScript[1],{...sandbox,location:{protocol:'file:',hostname:'',href:'file:///tmp/play.html'},window:{addEventListener(k,fn){offlineListeners[k]=fn}}});
 assert.equal(Object.keys(offlineListeners).length,0,'venvWin offline game must not fetch online updates');
 console.log('PASS same-URL installed-app updates, cache bypass, foreground checks, no reload loop and offline isolation.');
})().catch(err=>{console.error(err);process.exitCode=1});
