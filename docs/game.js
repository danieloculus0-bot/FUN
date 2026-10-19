(() => {
  "use strict";

  // A native HTML5 Canvas port of Emperor Gauntlet.
  // The original Pygame version remains at emperor-gauntlet/emperor_gauntlet.py.
  const W = 1000, H = 640, FPS = 60, WORLD_W = 2450, WORLD_H = 1700;
  const PR = 18, ER = 15, START_PENGUINS = 22, MAX_PENGUINS = 54;
  const ARMORY = {
    fists: {name:"FISTS",type:"melee",damage:30,reach:43,cooldown:28,stamina:12,color:"#fbb667"},
    knife: {name:"KNIFE",type:"melee",damage:44,reach:48,cooldown:18,stamina:8,color:"#e5f3fa"},
    nunchucks: {name:"NUNCHUCKS",type:"melee",damage:27,reach:60,cooldown:11,stamina:7,color:"#f8d578"},
    staff: {name:"BO STAFF",type:"melee",damage:56,reach:86,cooldown:27,stamina:10,color:"#deb179"},
    uzi: {name:"UZI",type:"gun",damage:26,cooldown:5,velocity:24,spread:.11,color:"#ffeb80"},
    shotgun: {name:"SHOTGUN",type:"gun",damage:26,cooldown:39,velocity:20,spread:.37,pellets:7,color:"#ffc16d"}
  };
  const WEAPON_ORDER = Object.keys(ARMORY);
  // Permanent survival campfires keep the cold mechanic playable during extended waves.
  const CAMP_SITES = [
    {x:245,y:345},{x:795,y:700},{x:1170,y:305},{x:1750,y:790},
    {x:1920,y:1420},{x:420,y:1440},{x:1160,y:1450},{x:2250,y:1500}
  ];
  const WARMTH_RADIUS=145;
  const DROP_COLORS = {uzi:"#f9cb5d",shotgun:"#f4a575",knife:"#dcebf5",
    nunchucks:"#ffdf6e",staff:"#caa47b",parka:"#77e0f5",medkit:"#f76879",
    grenade:"#f1af51",ammo:"#ffe48b",coffee:"#dbafff",cleats:"#afff7a"};
  const C = {
    snow: "#e8f4f7", ice: "#b0dce9", darkIce: "#123b51", blueIce: "#57a7c8",
    white: "#f3f8f9", black: "#0b1319", gray: "#4c6270", red: "#dd5c63",
    orange: "#ecaa55", yellow: "#e8ea81", green: "#c3f47e", cyan: "#92f3ff",
    ink: "#152e3b"
  };
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const overlayKicker = document.getElementById("overlay-kicker");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayCopy = document.getElementById("overlay-copy");
  const overlayHint = document.getElementById("overlay-hint");
  const playButton = document.getElementById("play-button");
  const pauseButton = document.getElementById("pause-button");
  const fullButton = document.getElementById("fullscreen-button");
  const statusText = document.getElementById("game-status");
  const gameFrame = document.getElementById("game-frame");
  const pressed = new Set();
  // Mouse aim is optional. Keyboard and touch users retain move-to-face aiming.
  const pointerAim={active:false,x:500,y:320};
  const soundButton=document.getElementById("sound-button");
  let audio=null, soundOn=false, lastSfxTick={};
  function playSfx(type){
    if(!soundOn||!audio||!game)return;
    const tick=game.clock;
    const repeatLimit={uzi:4,shotgun:20,hit:3,collect:12,boss:40,boom:5,melee:8};
    if(lastSfxTick[type]!==undefined&&tick-lastSfxTick[type]<(repeatLimit[type]||2))return;
    lastSfxTick[type]=tick;
    try{
      const now=audio.currentTime;
      const osc=audio.createOscillator(),amp=audio.createGain();
      const tones={
        uzi:[170,48,.095,"sawtooth"],shotgun:[95,31,.24,"sawtooth"],
        melee:[350,90,.09,"triangle"],hit:[195,55,.095,"square"],
        collect:[480,880,.17,"sine"],boom:[95,23,.36,"sawtooth"],
        boss:[150,52,.45,"sawtooth"],wave:[360,640,.28,"triangle"],
        heal:[450,850,.26,"sine"],grenade:[310,160,.12,"square"]
      };
      const t=tones[type]||tones.melee;
      osc.type=t[3];
      osc.frequency.setValueAtTime(t[0],now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20,t[1]),now+t[2]);
      amp.gain.setValueAtTime(.0001,now);
      amp.gain.exponentialRampToValueAtTime(type==="boom"?.22:.12,now+.006);
      amp.gain.exponentialRampToValueAtTime(.0001,now+t[2]);
      osc.connect(amp);amp.connect(audio.destination);
      osc.start(now);osc.stop(now+t[2]+.02);
    }catch(_){ /* Sound is optional and must never break gameplay. */ }
  }
  if(soundButton){
    soundButton.hidden=false;
    soundButton.textContent="SOUND OFF";
    soundButton.addEventListener("click",()=>{
      if(!audio){
        const AC=window.AudioContext||window.webkitAudioContext;
        if(!AC){soundButton.textContent="SOUND UNAVAILABLE";return;}
        try{audio=new AC();}catch(_){soundButton.textContent="SOUND UNAVAILABLE";return;}
      }
      soundOn=!soundOn;
      if(soundOn)audio.resume?.().catch?.(()=>{});
      soundButton.textContent=soundOn?"SOUND ON":"SOUND OFF";
      soundButton.setAttribute?.("aria-pressed",String(soundOn));
      if(soundOn)playSfx("collect");
    });
  }
  let state = "menu", game, nextId = 1, accumulator = 0, lastTime = 0;
  let best = 0;
  try { best = Number(localStorage.getItem("emperorGauntletBest") || 0) || 0; } catch (_) { /* private browsing */ }

  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const norm = (x, y) => {
    const len = Math.hypot(x, y);
    return len > 0.00001 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const within = (x, y, r) => x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
  const held = name => pressed.has(name);

  function penguin(x, y) {
    const variant=Math.random()<.11?"bruiser":Math.random()<.2?"berserker":"emperor";
    return {
      id: nextId++, x, y, vx: rand(-1, 1), vy: rand(-1, 1),
      hp: rand(58, 76)*(variant==="bruiser"?1.9:variant==="berserker"?.8:1),
      fear: rand(.2, .7), aggression: rand(.05, .28)+(variant==="berserker"?.38:0),
      mass: rand(.9, 1.25)*(variant==="bruiser"?1.6:1),
      state: "wander", down: false, downTimer: 0,
      peckCD: Math.floor(rand(0, 80)), phase: rand(0, Math.PI * 2),
      panic: 0, lastSwing: -1, variant, flash:0
    };
  }
  function makeDrop(kind,x,y) {return {kind,x,y,life:2500,spin:rand(0,6.28)};}
  function newGame() {
    nextId = 1;
    const g = {
      player: {
        x: 170, y: 200, vx: 0, vy: 0, fx: 1, fy: 0,
        temp: 100, hp: 100, stamina: 100, wet: 0, slip: 0,
        shoveCD: 0, swing: 0, swingId: 0, provocation: 0,
        weapon:"fists",owned:{fists:true},ammo:{uzi:120,shotgun:20},
        grenades:2,parka:0,cleats:false,rage:0,combo:0,comboTime:0,
        swingReach:43,swingColor:"#fbb667",muzzle:0,warming:false
      },
      birds: [], drifts: [
        { x: 360, y: 300, w: 270, h: 120 },
        { x: 820, y: 1040, w: 360, h: 150 },
        { x: 1420, y: 450, w: 300, h: 135 },
        { x: 1850, y: 1180, w: 260, h: 150 },
        { x: 2100, y: 650, w: 210, h: 105 }
      ],
      cracks: [
        { x: 690, y: 220, w: 28, h: 540, depth: .8 },
        { x: 1230, y: 780, w: 580, h: 24, depth: .7 },
        { x: 1730, y: 170, w: 24, h: 420, depth: .6 },
        { x: 410, y: 1240, w: 680, h: 24, depth: .9 },
        { x: 2040, y: 930, w: 30, h: 470, depth: 1 }
      ],
      holes: [
        { x: 1040, y: 470, r: 58 }, { x: 1540, y: 1120, r: 72 },
        { x: 2200, y: 350, r: 52 }, { x: 540, y: 910, r: 48 }
      ],
      fires:CAMP_SITES.map((site,i)=>({x:site.x,y:site.y,phase:i*1.87,life:Infinity,kind:"campfire"})),
      particles: [], stains: [], bullets: [], bombs: [], explosions: [], drops: [], floats: [], shake:0,
      wave:1, waveBanner:0, bossWave:0, nextWaveAt:10,
      score: 0, falls: 0, clock: 0,
      windAngle: rand(0, Math.PI * 2), windStrength: rand(.3, 1),
      blizzardTimer: 0, message: "GET GEAR. FIND AN UZI. RAISE HELL.",
      messageTimer: 260, cause: ""
    };
    for (let i = 0; i < START_PENGUINS; i++) {
      g.birds.push(penguin(rand(500, WORLD_W - 200), rand(180, WORLD_H - 180)));
    }
    g.drops.push(makeDrop("uzi",275,230),makeDrop("parka",350,285),
      makeDrop("knife",440,290),makeDrop("medkit",560,350),makeDrop("grenade",675,410),
      makeDrop("nunchucks",780,505),makeDrop("shotgun",1050,590),
      makeDrop("staff",1260,440),makeDrop("cleats",1460,620),makeDrop("coffee",840,270));
    return g;
  }

  function say(message, duration = 170) { game.message = message; game.messageTimer = duration; }
  function particles(x, y, color, count = 12, speed = 3) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2), s = rand(.4, speed);
      game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(20, 58), color, radius: rand(1, 3) });
    }
    if (game.particles.length > 500) game.particles.splice(0, game.particles.length - 500);
  }
  function stain(x, y, radius = 10, color = "#9b2635") {
    game.stains.push({ x, y, radius, color, life: 900 });
    if (game.stains.length > 170) game.stains.shift();
  }
  function wind() {
    return { x: Math.cos(game.windAngle) * game.windStrength,
      y: Math.sin(game.windAngle) * game.windStrength };
  }
  function recordBest() {
    if (game.score > best) {
      best = game.score;
      try { localStorage.setItem("emperorGauntletBest", String(best)); } catch (_) { /* optional */ }
    }
  }
  function setOverlay(kicker, title, copy, action, hint = "") {
    overlayKicker.textContent = kicker;
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    playButton.textContent = action;
    overlayHint.textContent = hint;
    overlay.hidden = false;
  }
  function start() {
    if (state === "paused") {
      state = "running";
    } else {
      game = newGame();
      state = "running";
    }
    pressed.clear();
    pointerAim.active=false;
    overlay.hidden = true;
    pauseButton.textContent = "PAUSE  P";
    statusText.textContent = "IN THE ARENA · GOOD LUCK, YOU IDIOT";
    lastTime = 0;
    accumulator = 0;
    canvas.focus?.();
  }
  function pause() {
    if (state === "running") {
      state = "paused";
      setOverlay("TAKING A BREATHER", "THE ICE CAN WAIT.",
        "Your score is " + game.score + ". Get back out there before the penguins start celebrating.",
        "RESUME THE CHAOS", "P / ENTER TO RESUME");
      pauseButton.textContent = "RESUME  P";
      statusText.textContent = "PAUSED · THE PENGUINS ARE JUDGING YOU";
      pressed.clear();
    } else if (state === "paused") {
      start();
    }
  }
  function finish(cause) {
    if (state !== "running") return;
    game.cause = cause;
    state = "over";
    pressed.clear();
    recordBest();
    particles(game.player.x, game.player.y, C.cyan, 25, 5);
    setOverlay("EMPEROR GAUNTLET OVER",
      game.score + " PENGUINS DOWN.",
      cause + ". " + game.falls + " additional penguin ice falls. Your personal best: " + best +
      ". The legendary target: 37.",
      "TRY AGAIN", "R / ENTER TO RESTART");
    statusText.textContent = "GAME OVER · " + game.score + " DOWN · PERSONAL BEST " + best;
    pauseButton.textContent = "PAUSE  P";
  }
  function selectWeapon(which){
    const p=game.player;
    if(state!=="running"||!p.owned[which])return false;
    p.weapon=which;
    say("EQUIPPED: "+ARMORY[which].name,110);
    return true;
  }
  function cycleWeapon(direction){
    const p=game.player,index=WEAPON_ORDER.indexOf(p.weapon);
    for(let n=1;n<=WEAPON_ORDER.length;n++){
      const k=WEAPON_ORDER[(index+n*direction+WEAPON_ORDER.length*10)%WEAPON_ORDER.length];
      if(p.owned[k])return selectWeapon(k);
    }
    return false;
  }
  function floatText(x,y,label,color=C.yellow){
    game.floats.push({x,y,label,color,life:75});
    if(game.floats.length>70)game.floats.shift();
  }
  function smack(b,damage,pushX,pushY){
    if(b.down)return;
    b.hp-=damage;
    b.vx+=pushX/Math.max(.6,b.mass);
    b.vy+=pushY/Math.max(.6,b.mass);
    b.panic=110;b.flash=7;
    particles(b.x,b.y,C.red,18,5);
    for(let i=0;i<4;i++)stain(b.x+rand(-20,20),b.y+rand(-20,20),rand(4,11));
    floatText(b.x,b.y-30,Math.round(damage)+"");
    game.shake=Math.min(12,game.shake+2);
    playSfx("hit");
    if(b.hp<=0)downBird(b,"combat");
  }
  function fireWeapon(){
    const p=game.player,w=ARMORY[p.weapon];
    if(p.ammo[p.weapon]<=0){
      p.shoveCD=18;say("CLICK. EMPTY. FIND AMMO OR SWITCH WEAPONS.",120);return;
    }
    p.ammo[p.weapon]--;p.shoveCD=w.cooldown;p.provocation+=.8;p.muzzle=5;
    const angle=Math.atan2(p.fy,p.fx);
    for(let i=0;i<(w.pellets||1);i++){
      const theta=angle+rand(-w.spread,w.spread);
      game.bullets.push({x:p.x+p.fx*25,y:p.y+p.fy*25,
        vx:Math.cos(theta)*w.velocity,vy:Math.sin(theta)*w.velocity,
        damage:w.damage*rand(.8,1.18),life:w.pellets?18:48,color:w.color});
    }
    particles(p.x+p.fx*35,p.y+p.fy*35,w.color,9,6);
    if(w.pellets)game.shake+=5;
    playSfx(w.pellets?"shotgun":"uzi");
  }
  function throwGrenade(){
    if(state!=="running"||game.player.grenades<1)return;
    const p=game.player;p.grenades--;
    game.bombs.push({x:p.x+p.fx*22,y:p.y+p.fy*22,
      vx:p.fx*10+p.vx*.3,vy:p.fy*10+p.vy*.3,life:56});
    say("GRENADE OUT! THIS IS FINE.",100);
    playSfx("grenade");
  }
  function boom(x,y){
    game.explosions.push({x,y,r:0,life:22});
    particles(x,y,C.orange,75,10);particles(x,y,C.red,25,7);
    for(const b of game.birds){
      if(b.down)continue;
      const distance=Math.hypot(b.x-x,b.y-y);
      if(distance<150){
        const n=norm(b.x-x,b.y-y);
        smack(b,Math.max(20,180*(1-distance/170)),n.x*15,n.y*15);
      }
    }
    const p=game.player,d=Math.hypot(p.x-x,p.y-y);
    if(d<110)p.hp-=Math.max(4,25*(1-d/120));
    game.shake=16;say("BOOM. ANTARCTICA FILES A FORMAL COMPLAINT.",155);
    playSfx("boom");
  }
  function moveProjectiles(){
    for(const bullet of game.bullets){
      const ox=bullet.x,oy=bullet.y;
      bullet.x+=bullet.vx;bullet.y+=bullet.vy;bullet.life--;
      if(bullet.x<0||bullet.y<0||bullet.x>WORLD_W||bullet.y>WORLD_H)bullet.life=0;
      for(const b of game.birds){
        if(b.down||bullet.life<=0)continue;
        const dx=bullet.x-ox,dy=bullet.y-oy,den=dx*dx+dy*dy;
        const t=clamp(den?((b.x-ox)*dx+(b.y-oy)*dy)/den:0,0,1);
        if(Math.hypot(b.x-(ox+t*dx),b.y-(oy+t*dy))<(b.variant==="boss"?42:b.variant==="bruiser"?24:17)){
          const n=norm(dx,dy);
          smack(b,bullet.damage*(game.player.rage>0?1.5:1),n.x*5,n.y*5);
          bullet.life=0;break;
        }
      }
    }
    game.bullets=game.bullets.filter(b=>b.life>0);
    for(const bomb of game.bombs){
      bomb.x+=bomb.vx;bomb.y+=bomb.vy;
      bomb.vx*=.95;bomb.vy*=.95;bomb.life--;
      if(bomb.life<=0)boom(bomb.x,bomb.y);
    }
    game.bombs=game.bombs.filter(b=>b.life>0);
    for(const blast of game.explosions){blast.life--;blast.r=Math.min(135,blast.r+15);}
    game.explosions=game.explosions.filter(b=>b.life>0);
    for(const p of game.floats){p.y-=.65;p.life--;}
    game.floats=game.floats.filter(p=>p.life>0);
  }
  function collectDrops(){
    const p=game.player;
    for(let i=game.drops.length-1;i>=0;i--){
      const drop=game.drops[i];drop.life--;
      if(drop.life<=0){game.drops.splice(i,1);continue;}
      if(Math.hypot(p.x-drop.x,p.y-drop.y)>36)continue;
      game.drops.splice(i,1);
      const k=drop.kind;
      if(ARMORY[k]){
        p.owned[k]=true;
        if(k==="uzi")p.ammo.uzi+=130;
        if(k==="shotgun")p.ammo.shotgun+=18;
        p.weapon=k;
        say("NEW WEAPON: "+ARMORY[k].name+"! LET'S FUCKING GO.",190);
      }else if(k==="parka"){p.parka=Math.min(3,p.parka+1);p.temp=clamp(p.temp+30,0,100);say("PARKA EQUIPPED. COLD RESISTANCE UP.",145);}
      else if(k==="medkit"){p.hp=clamp(p.hp+50,0,100);say("FIRST AID KIT: +50 HEALTH.",120);}
      else if(k==="cleats"){p.cleats=true;say("ICE CLEATS. TRACTION, YOU BEAUTIFUL BASTARD.",125);}
      else if(k==="ammo"){p.ammo.uzi+=100;p.ammo.shotgun+=16;say("AMMO RESTOCKED.",110);}
      else if(k==="grenade"){p.grenades+=3;say("THREE MORE GRENADES. NO ONE TELL THE PENGUINS.",150);}
      else if(k==="coffee"){p.rage=900;p.stamina=100;p.temp=clamp(p.temp+16,0,100);say("CAFFEINATED RAGE: 15 SECONDS OF POOR JUDGMENT.",180);}
      playSfx(k==="medkit"||k==="parka"?"heal":"collect");
      floatText(drop.x,drop.y-35,k.toUpperCase()+"!",DROP_COLORS[k]);
      particles(drop.x,drop.y,DROP_COLORS[k],20,5);
    }
  }
  function shove() {
    if (state !== "running") return;
    const p = game.player;
    const w=ARMORY[p.weapon];
    if(p.shoveCD>0)return;
    if(w.type==="gun"){fireWeapon();return;}
    if(p.stamina<w.stamina)return;
    p.shoveCD=w.cooldown;p.stamina-=w.stamina;
    p.swing=9;p.swingReach=w.reach;p.swingColor=w.color;
    p.swingId++;p.provocation++;
    particles(p.x+p.fx*w.reach,p.y+p.fy*w.reach,w.color,12,4);
    playSfx("melee");
  }

  function downBird(bird, reason) {
    if (bird.down) return;
    bird.down = true;
    bird.downTimer = 240;
    if (reason !== "ice") {
      game.score++;
      game.player.provocation += 2;
      if(bird.variant==="boss"){
        say("THE KING IS DEAD. LONG LIVE YOUR TERRIBLE DECISIONS.",280);
        game.drops.push(makeDrop("medkit",bird.x-35,bird.y),makeDrop("ammo",bird.x+35,bird.y),makeDrop("grenade",bird.x,bird.y+40));
        playSfx("wave");
      }
      game.player.combo++;
      game.player.comboTime=180;
      if(game.player.combo%5===0)floatText(bird.x,bird.y-55,game.player.combo+"x COMBO!");
      if(Math.random()<.19)game.drops.push(makeDrop(["ammo","medkit","grenade","coffee","parka"][Math.floor(rand(0,5))],bird.x,bird.y));
      particles(bird.x, bird.y, C.red, 25, 4);
      stain(bird.x, bird.y, rand(8, 16));
      if(bird.variant!=="boss")say([
        "PENGUIN DOWN. THE ROOKERY FILES A COMPLAINT.",
        "ONE TUXEDO PANCAKE. NATURE IS JUDGING YOU.",
        "IMPACT CONFIRMED. BAD KARMA.",
        "THAT ONE IS NOT WADDLING FOR A MINUTE."
      ][Math.floor(rand(0, 4))]);
      if (game.score === 37) say("37! YOU'VE TIED THE LEGENDARY RECORD. NOW DON'T FREEZE.", 280);
      if (game.score === 38) say("38! THE LEGEND HAS BEEN TOPPLED. ANTARCTICA IS FURIOUS.", 310);
    } else {
      game.falls++;
      particles(bird.x, bird.y, C.blueIce, 22, 3.6);
      say("A PENGUIN FELL THROUGH BAD ICE. NOT A HAND-TO-HAND KILL.");
    }
  }

  function updatePlayer() {
    const p = game.player;
    let mx = (held("right") ? 1 : 0) - (held("left") ? 1 : 0);
    let my = (held("down") ? 1 : 0) - (held("up") ? 1 : 0);
    const move = norm(mx, my);
    const sprint = held("sprint") && p.stamina > 8 && (mx !== 0 || my !== 0);
    let terrainSlow = 1;
    for (const drift of game.drifts) {
      if (within(p.x, p.y, drift)) terrainSlow = .48;
    }
    if (sprint) p.stamina -= .43;
    else p.stamina += .22;
    p.stamina = clamp(p.stamina, 0, 100);
    if (mx !== 0 || my !== 0) {
      if(!pointerAim.active){p.fx=move.x;p.fy=move.y;}
      const acceleration = sprint ? .72 : .43;
      p.vx += move.x * acceleration * terrainSlow;
      p.vy += move.y * acceleration * terrainSlow;
    }
    const w = wind();
    p.vx += w.x * .012;
    p.vy += w.y * .012;
    const friction = p.slip > 0 && !p.cleats ? .973 : terrainSlow >= .8 ? .945 : .89;
    if (p.slip > 0) p.slip--;
    p.vx *= friction;
    p.vy *= friction;
    p.x = clamp(p.x + p.vx, PR, WORLD_W - PR);
    p.y = clamp(p.y + p.vy, PR, WORLD_H - PR);
    if(pointerAim.active){
      const camX=clamp(p.x-W/2,0,WORLD_W-W),camY=clamp(p.y-H/2,0,WORLD_H-H);
      const face=norm(pointerAim.x+camX-p.x,pointerAim.y+camY-p.y);
      if(face.x!==0||face.y!==0){p.fx=face.x;p.fy=face.y;}
    }
    if (p.shoveCD > 0) p.shoveCD--;
    if(p.muzzle>0)p.muzzle--;
    if(p.rage>0)p.rage--;
    if(p.comboTime>0)p.comboTime--;else p.combo=0;
    if (p.swing > 0) p.swing--;
    let loss = .018 + (game.blizzardTimer > 0 ? .04 : 0) - (sprint ? .008 : 0);
    if (p.wet > 0) { p.wet--; loss += .058; }
    loss*=1-p.parka*.2;
    // Standing in the golden ring turns the fire into a real warming station.
    // It offsets blizzards and even wet clothing if you move in close enough.
    let fireHeat=0;
    for(const fire of game.fires){
      const d=Math.hypot(p.x-fire.x,p.y-fire.y);
      if(d<WARMTH_RADIUS){
        const gain=.30*(1-d/WARMTH_RADIUS);
        fireHeat=Math.max(fireHeat,gain);
      }
    }
    p.warming=fireHeat>loss;
    p.temp=clamp(p.temp-loss+fireHeat,0,100);
    if (p.temp <= 0) {
      finish("Froze after losing a very predictable thermodynamics argument");
    } else if (p.hp <= 0) {
      finish("Got swarmed by furious tuxedo linebackers");
    }
  }
  function checkTerrain() {
    const p = game.player;
    for (const hole of game.holes) {
      const d = Math.hypot(p.x - hole.x, p.y - hole.y);
      if (d < hole.r * .78) {
        finish("Fell through weak ice because confidence is not buoyancy");
        return;
      }
      if (d < hole.r * 1.15 && Math.hypot(p.vx, p.vy) > 4.5) {
        p.slip = Math.max(p.slip, 35);
        p.wet = Math.max(p.wet, 240);
      }
    }
    for (const crack of game.cracks) {
      if (!within(p.x, p.y, crack)) continue;
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 3.4 && Math.random() < .06 * crack.depth) {
        p.slip = 55;
        p.hp -= rand(3, 9);
        particles(p.x, p.y, C.white, 14, 2.4);
        say("YOU ATE SHIT ON A PRESSURE CRACK. THE ICE REMAINS UNDEFEATED.");
      }
      if (speed > 5.8 && Math.random() < .012 * crack.depth) {
        finish("Vanished into a pressure crack like a cautionary pamphlet");
        return;
      }
    }
    if (p.hp <= 0) finish("Got defeated by ice before the penguins even finished laughing");
  }
  function updateBirds() {
    const birds = game.birds;
    const player = game.player;
    const w = wind();
    for (const b of birds) {
      if (b.down) {
        b.downTimer--;
        continue;
      }
      if(b.variant==="boss"){
        b.state="mob";
        b.aggression=2;
      }
      const dx = player.x - b.x, dy = player.y - b.y;
      const dist = Math.hypot(dx, dy);
      let nearby = 0, cx = 0, cy = 0, sx = 0, sy = 0;
      for (const other of birds) {
        if (other === b || other.down) continue;
        const ox = b.x - other.x, oy = b.y - other.y;
        const d = Math.hypot(ox, oy);
        if (d < 130) { nearby++; cx += other.x; cy += other.y; }
        if (d > .00001 && d < 36) {
          sx += ox / d * (36 - d) * .018;
          sy += oy / d * (36 - d) * .018;
        }
      }
      if (nearby) { cx /= nearby; cy /= nearby; }
      const mobChance = b.aggression + player.provocation * .018 + nearby * .018;
      if (b.variant==="boss"){
        b.state="mob";b.panic=Math.max(b.panic,40);
      } else if (dist < 80 && nearby >= 4 && Math.random() < mobChance * .045) {
        b.state = "mob";
        b.panic = Math.max(b.panic, 80);
      } else if (dist < 155 && b.state !== "mob") {
        b.state = "flee";
        b.panic = Math.max(b.panic, 55);
      } else if (dist >= 190 && b.state === "mob") {
        b.state = "wander";
      } else if (game.blizzardTimer > 0 && nearby > 0 && dist >= 155) {
        b.state = "huddle";
      } else if (Math.random() < .01) {
        b.state = "wander";
      }
      let ax = 0, ay = 0;
      if (b.state === "flee") {
        const n = norm(dx, dy);
        ax -= n.x * (.18 + b.fear * .22);
        ay -= n.y * (.18 + b.fear * .22);
        if (nearby) {
          const c = norm(cx - b.x, cy - b.y);
          ax += c.x * .04; ay += c.y * .04;
        }
      } else if (b.state === "mob") {
        const n = norm(dx, dy);
        ax += n.x * .22; ay += n.y * .22;
      } else if (b.state === "huddle" && nearby) {
        const n = norm(cx - b.x, cy - b.y);
        ax += n.x * .12 - w.x * .018;
        ay += n.y * .12 - w.y * .018;
      } else {
        b.phase += .025;
        ax += Math.cos(b.phase) * .045;
        ay += Math.sin(b.phase * .7) * .045;
      }
      ax += sx + w.x * .004;
      ay += sy + w.y * .004;
      if (b.panic > 0) { b.panic--; ax *= 1.25; ay *= 1.25; }
      b.vx += ax; b.vy += ay;
      const v = Math.hypot(b.vx, b.vy), maxSpeed = ((b.state === "flee" || b.state === "mob") ? 3 : 1.55) * (b.variant==="boss"?.95:b.variant==="berserker"?1.65:b.variant==="bruiser"?.75:1);
      if (v > maxSpeed) { b.vx *= maxSpeed / v; b.vy *= maxSpeed / v; }
      b.vx *= .94; b.vy *= .94;
      b.x = clamp(b.x + b.vx, ER, WORLD_W - ER);
      b.y = clamp(b.y + b.vy, ER, WORLD_H - ER);
      if (b.peckCD > 0) b.peckCD--;
      if (b.flash > 0) b.flash--;
      for (const hole of game.holes) {
        if (Math.hypot(b.x - hole.x, b.y - hole.y) < hole.r * .72) {
          downBird(b, "ice");
          break;
        }
      }
      if (b.down) continue;
      for (const crack of game.cracks) {
        if (within(b.x, b.y, crack) && b.panic > 20 && Math.random() < .045 * crack.depth) {
          downBird(b, "ice");
          break;
        }
      }
    }
    // Prevent indefinite growth in the living list as bodies expire.
    game.birds = game.birds.filter(b => !b.down || b.downTimer > 0);
  }
  function collisions() {
    const p = game.player;
    for (const b of game.birds) {
      if (b.down) continue;
      let dx = p.x - b.x, dy = p.y - b.y;
      const d = Math.hypot(dx, dy);
      const contactRadius=PR+(b.variant==="boss"?41:b.variant==="bruiser"?21:ER);
      if (d > 0.00001 && d < contactRadius) {
        const nx = dx / d, ny = dy / d, overlap = contactRadius - d;
        p.x += nx * overlap * .42;
        p.y += ny * overlap * .42;
        b.x -= nx * overlap * .58;
        b.y -= ny * overlap * .58;
        if (b.state === "mob" && b.peckCD <= 0) {
          b.peckCD = Math.floor(rand(35, 70));
          p.hp -= rand(4, 9)*(b.variant==="boss"?2.5:b.variant==="bruiser"?1.7:1);
          p.vx += nx * rand(1.5, 2.8);
          p.vy += ny * rand(1.5, 2.8);
          particles(p.x - nx * 14, p.y - ny * 14, C.red, 8, 2.3);
          stain(p.x - nx * 16, p.y - ny * 16, rand(5, 10));
          say("PECKED AND FLIPPER-SLAPPED. DEEPLY EMBARRASSING.");
        }
      }
      if (p.swing > 0 && b.lastSwing !== p.swingId) {
        const rx = p.x + p.fx * p.swingReach - b.x, ry = p.y + p.fy * p.swingReach - b.y;
        const toward = norm(b.x - p.x, b.y - p.y);
        if (Math.hypot(rx, ry) < (b.variant==="boss"?62:43) && toward.x * p.fx + toward.y * p.fy > .15) {
          b.lastSwing = p.swingId; // Exactly one hit per penguin per shove.
          const push = norm(b.x - p.x, b.y - p.y);
          const w=ARMORY[p.weapon];
          smack(b,w.damage*rand(.8,1.2)*(p.rage>0?1.5:1),push.x*8,push.y*8);
          p.vx-=p.fx*.5;p.vy-=p.fy*.5;
        }
      }
    }
    if (p.hp <= 0) finish("Got swarmed by furious tuxedo linebackers");
  }
  function spawnBoss(){
    // Position within the arena, away from the player and from any water holes.
    const p=game.player;
    let x=p.x,y=p.y;
    for(let attempt=0;attempt<24;attempt++){
      const a=rand(0,Math.PI*2),r=rand(330,480);
      x=clamp(p.x+Math.cos(a)*r,60,WORLD_W-60);
      y=clamp(p.y+Math.sin(a)*r,80,WORLD_H-80);
      if(game.holes.every(h=>Math.hypot(x-h.x,y-h.y)>h.r+75))break;
    }
    const b=penguin(x,y);
    b.variant="boss";b.hp=650+game.wave*75;b.maxHp=b.hp;
    b.mass=4.4;b.aggression=2;b.fear=0;b.state="mob";b.peckCD=30;
    game.birds.push(b);
    // Boss fights light an extra orange signal brazier for a temporary safe zone.
    const fireX=clamp(x+165,55,WORLD_W-55),fireY=clamp(y+55,65,WORLD_H-65);
    if(game.holes.every(h=>Math.hypot(fireX-h.x,fireY-h.y)>h.r+40)){
      game.fires.push({x:fireX,y:fireY,phase:rand(0,6.28),life:2400,kind:"signal"});
    }
    game.drops.push(makeDrop("medkit",clamp(p.x+100,20,WORLD_W-20),clamp(p.y+70,20,WORLD_H-20)));
    say("BOSS ALERT: THE EMPEROR OF BAD DECISIONS HAS ARRIVED!",290);
    playSfx("boss");
    game.shake=13;
  }
  function waveDirector(){
    if(game.score<game.nextWaveAt)return;
    game.wave++;
    game.nextWaveAt+=10+Math.min(20,(game.wave-1)*2);
    game.waveBanner=205;
    game.player.temp=clamp(game.player.temp+10,0,100);
    game.drops.push(makeDrop("ammo",clamp(game.player.x+65,40,WORLD_W-40),clamp(game.player.y+55,40,WORLD_H-40)));
    say("WAVE "+game.wave+": THE ROOKERY REQUESTS REINFORCEMENTS.",230);
    playSfx("wave");
    if(game.wave%2===0){game.bossWave=game.wave;spawnBoss();}
  }
  function maintainPopulation() {
    let living = 0;
    for (const b of game.birds) if (!b.down) living++;
    const target = Math.min(MAX_PENGUINS, START_PENGUINS + Math.floor(game.score / 2));
    if (living < target && Math.random() < .02) {
      const side = Math.floor(rand(0, 4));
      let x, y;
      if (side === 0) { x = rand(80, WORLD_W - 80); y = 40; }
      else if (side === 1) { x = rand(80, WORLD_W - 80); y = WORLD_H - 40; }
      else if (side === 2) { x = 40; y = rand(80, WORLD_H - 80); }
      else { x = WORLD_W - 40; y = rand(80, WORLD_H - 80); }
      game.birds.push(penguin(x, y));
    }
  }
  function tick() {
    if (state !== "running") return;
    game.clock++;
    if (Math.random() < .002 && game.blizzardTimer <= 0) {
      game.blizzardTimer = Math.floor(rand(420, 900));
      game.windStrength = rand(1.2, 2.2);
      say("WHITEOUT ROLLING IN. YOUR EYEBROWS RECONSIDER THEIR LIFE CHOICES.", 230);
    }
    if (game.blizzardTimer > 0) {
      game.blizzardTimer--;
      if (game.blizzardTimer === 0) {
        game.windStrength = rand(.35, 1);
        game.windAngle += rand(-.8, .8);
      }
    }
    if (game.clock % 420 === 0) {
      game.windAngle += rand(-.65, .65);
      game.windStrength = clamp(game.windStrength + rand(-.25, .3), .25, 2.2);
    }
    for(const fire of game.fires)if(Number.isFinite(fire.life))fire.life--;
    game.fires=game.fires.filter(fire=>fire.life>0);
    updatePlayer();
    if (state !== "running") return;
    checkTerrain();
    if (state !== "running") return;
    updateBirds();
    if(held("attack"))shove();
    collisions();
    moveProjectiles();
    collectDrops();
    waveDirector();
    maintainPopulation();
    if(game.waveBanner>0)game.waveBanner--;
    if(game.clock%650===0){const p=game.player;game.drops.push(makeDrop(["ammo","medkit","coffee","grenade","parka"][Math.floor(rand(0,5))],clamp(p.x+rand(-300,300),35,WORLD_W-35),clamp(p.y+rand(-280,280),35,WORLD_H-35)));}
    if(game.shake>0)game.shake=Math.max(0,game.shake-.65);
    for (const particle of game.particles) {
      particle.x += particle.vx; particle.y += particle.vy;
      particle.vx *= .94; particle.vy *= .94; particle.life--;
    }
    game.particles = game.particles.filter(p => p.life > 0);
    for (const s of game.stains) s.life--;
    game.stains = game.stains.filter(s => s.life > 0);
    if (game.messageTimer > 0) game.messageTimer--;
  }

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  function circle(x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  function ellipse(x, y, rx, ry, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  function text(label, x, y, size = 17, color = C.white, align = "left", weight = 800) {
    ctx.font = weight + " " + size + "px Arial, sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
  }
  function drawCampfire(fire){
    const x=fire.x,y=fire.y,t=game.clock*.095+fire.phase;
    const pulse=1+Math.sin(t*2.3)*.055;
    const signal=fire.kind==="signal";
    // Warm illumination on the ice, with translucent rings rather than expensive filters.
    circle(x,y,117*pulse,"#ff952011");
    circle(x,y,82*pulse,"#ffb43120");
    circle(x,y,49*pulse,"#ffac3430");
    ellipse(x,y+13,39,16,"#324c56a8");
    // Charred crossed logs and hot coals.
    ctx.save();ctx.translate(x,y+7);
    ctx.strokeStyle="#4e291d";ctx.lineWidth=11;ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(-20,-6);ctx.lineTo(20,11);
    ctx.moveTo(20,-7);ctx.lineTo(-20,11);ctx.stroke();
    ctx.strokeStyle="#98613b";ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(-19,-7);ctx.lineTo(19,10);ctx.stroke();
    circle(0,0,14,"#e94b1e");
    circle(0,-3,10,"#ffb23e");
    ctx.restore();
    // Five independently flickering flames, bright yellow cores and wisps.
    for(let i=0;i<5;i++){
      const ox=(i-2)*7+Math.sin(t+i*3.2)*3;
      const height=(i===2?31:21)+Math.sin(t*1.9+i*2)*6+(signal?8:0);
      const fy=y-7+Math.sin(t*1.4+i)*1.5;
      ctx.beginPath();
      ctx.moveTo(x+ox-8,fy+9);
      ctx.quadraticCurveTo(x+ox-8,fy-height*.35,x+ox+Math.sin(t*1.2+i)*5,fy-height);
      ctx.quadraticCurveTo(x+ox+11,fy-height*.2,x+ox+8,fy+9);
      ctx.closePath();
      ctx.fillStyle=i%2?"#f87924":"#ffb22c";ctx.fill();
      ctx.beginPath();ctx.moveTo(x+ox-3,fy+5);
      ctx.quadraticCurveTo(x+ox-2,fy-height*.3,x+ox+2,fy-height*.57);
      ctx.quadraticCurveTo(x+ox+5,fy-height*.12,x+ox+4,fy+5);
      ctx.closePath();ctx.fillStyle="#fff090";ctx.fill();
    }
    // Procedural drifting smoke and floating embers: animated but allocation-free.
    for(let i=0;i<7;i++){
      const age=(game.clock*.7+i*20+fire.phase*31)%145;
      const windDrift=Math.sin(game.windAngle)*age*.12;
      const dx=Math.sin(i*4+t*.7)*10+windDrift;
      const dy=-20-age*.63;
      const r=(i%2===0?2.2:3.6);
      circle(x+dx,y+dy,r,i%3===0?"#a5a9a959":"#ffb450a8");
    }
    if(signal){
      ctx.strokeStyle="#ffda71";ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(x,y,36,0,Math.PI*2);ctx.stroke();
    }
  }
  function drawWorld(camX, camY) {
    rect(0, 0, W, H, C.ice);
    const grd = ctx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, "#d4ecf3");
    grd.addColorStop(.6, "#b2d7e3");
    grd.addColorStop(1, "#91c0d4");
    rect(0, 0, W, H, grd);
    // Static snow specks drift with the camera, no per-frame randomness.
    for (let sx = -80; sx < W + 120; sx += 80) {
      for (let sy = -80; sy < H + 120; sy += 80) {
        circle(sx + (camX * .18 % 80), sy + (camY * .18 % 80), 2, "#f4fcff");
      }
    }
    ctx.save();
    ctx.translate(-camX, -camY);
    for (const d of game.drifts) {
      ellipse(d.x + d.w / 2, d.y + d.h / 2, d.w / 2, d.h / 2, "#effbff");
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(d.x + d.w / 2, d.y + d.h / 2, d.w / 2, d.h / 2, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "#b5d9e3";
      ctx.stroke();
    }
    for (const c of game.cracks) {
      rect(c.x, c.y, c.w, c.h, C.darkIce);
      rect(c.x + 3, c.y + 3, Math.max(1, c.w - 6), Math.max(1, c.h - 6), "#2d7189");
    }
    for (const hole of game.holes) {
      circle(hole.x, hole.y, hole.r, C.darkIce);
      circle(hole.x, hole.y, hole.r - 5, C.blueIce);
      circle(hole.x, hole.y, hole.r * .58, "#0a2c3f");
    }
    for (const s of game.stains) {
      circle(s.x, s.y, Math.max(2, s.radius * clamp(s.life / 900, .25, 1)), s.color);
    }
    for(const fire of game.fires)drawCampfire(fire);
    for(const item of game.drops)drawDrop(item);
    for(const b of game.birds)drawBird(b);
    drawPlayer(game.player);
    for(const bullet of game.bullets){
      const n=norm(bullet.vx,bullet.vy);
      ctx.beginPath();ctx.moveTo(bullet.x-n.x*13,bullet.y-n.y*13);
      ctx.lineTo(bullet.x+n.x*5,bullet.y+n.y*5);
      ctx.strokeStyle=bullet.color;ctx.lineWidth=4;ctx.stroke();
    }
    for(const bomb of game.bombs){
      circle(bomb.x,bomb.y,8,"#293e3b");
      circle(bomb.x-2,bomb.y-3,3,C.yellow);
    }
    for(const blast of game.explosions){
      circle(blast.x,blast.y,blast.r,"#ef7b2633");
      ctx.beginPath();ctx.arc(blast.x,blast.y,blast.r,0,Math.PI*2);
      ctx.strokeStyle="#ffcb59";ctx.lineWidth=7;ctx.stroke();
    }
    for (const p of game.particles) circle(p.x, p.y, p.radius, p.color);
    for(const ft of game.floats)text(ft.label,ft.x,ft.y,17,ft.color,"center",1000);
    ctx.restore();
  }
  function drawDrop(item){
    const bob=Math.sin(game.clock*.09+item.spin)*5;
    const x=item.x,y=item.y+bob,c=DROP_COLORS[item.kind];
    circle(x,y+7,19,"#153d5150");
    circle(x,y,18,c+"66");
    ctx.strokeStyle=c;ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(x,y,17,0,Math.PI*2);ctx.stroke();
    if(ARMORY[item.kind]){
      ctx.save();ctx.translate(x,y);ctx.rotate(-.38);
      rect(-11,-4,22,8,"#1b2a31");rect(4,-3,6,8,c);
      rect(-6,2,4,11,"#374c53");
      ctx.restore();
    }else{
      const icons={medkit:"+",parka:"J",cleats:"C",ammo:"A",grenade:"G",coffee:"!"};
      text(icons[item.kind]||"?",x,y,22,"#132231","center",1000);
    }
    text(item.kind.toUpperCase(),x,y+28,11,"#19384a","center",950);
  }
  function drawBird(b) {
    ctx.save();ctx.translate(b.x,b.y);
    if(b.down){
      ellipse(0,5,24,8,"#557d92");
      ellipse(0,0,23,12,C.black);
      ellipse(0,0,15,7,C.white);
      circle(22,2,5,C.orange);
      ctx.restore();return;
    }
    const boss=b.variant==="boss",bruiser=b.variant==="bruiser",psycho=b.variant==="berserker";
    const scale=boss?2.25:bruiser?1.32:(psycho?.88:1);
    const bob=Math.sin(game.clock*(psycho?0.23:0.11)+b.phase)*3;
    ctx.translate(0,bob);ctx.scale(scale,scale);
    ellipse(0,21,19,7,"#466d8290");
    // Tiny flippers with real silhouettes, feet, belly, and a beak.
    ellipse(-13,3,7,19,C.black);ellipse(13,3,7,19,C.black);
    ellipse(-10,24,8,5,C.orange);ellipse(11,24,8,5,C.orange);
    ellipse(0,0,15,22,C.black);
    ellipse(2,4,10,16,C.white);
    ellipse(-8,-2,2.5,10,"#f8d774");ellipse(10,-1,2.5,9,"#f8d774");
    circle(0,-23,14,C.black);
    ellipse(1,-27,9,5,"#363f45");
    circle(-5,-26,4,C.white);circle(6,-26,4,C.white);
    circle(-4,-26,2.1,C.black);circle(7,-26,2.1,C.black);
    ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(14,-16);ctx.lineTo(0,-13);
    ctx.closePath();ctx.fillStyle=C.orange;ctx.fill();
    if(boss){
      ctx.beginPath();
      ctx.moveTo(-14,-38);ctx.lineTo(-13,-51);ctx.lineTo(-5,-44);
      ctx.lineTo(0,-55);ctx.lineTo(6,-44);ctx.lineTo(14,-51);
      ctx.lineTo(14,-38);ctx.closePath();ctx.fillStyle="#ebc650";ctx.fill();
      circle(0,-46,2.6,C.red);
      ctx.strokeStyle="#f7b648";ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,0,29,-.4,2.7);ctx.stroke();
    }
    if(bruiser){
      ctx.beginPath();ctx.moveTo(-14,-34);ctx.lineTo(14,-34);
      ctx.lineWidth=5;ctx.strokeStyle="#b14b59";ctx.stroke();
      text("!",0,-44,15,C.red,"center",900);
    }
    if(psycho){ctx.strokeStyle=C.red;ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(-10,-30);ctx.lineTo(-2,-26);
      ctx.moveTo(13,-30);ctx.lineTo(3,-26);ctx.stroke();}
    if(b.flash>0){ellipse(0,-1,16,24,"#ff4f6599");}
    if(b.state==="mob"){
      circle(-4,-26,2.5,C.red);circle(7,-26,2.5,C.red);
    }
    ctx.restore();
  }
  function drawPlayer(p){
    ctx.save();ctx.translate(p.x,p.y);
    const angle=Math.atan2(p.fy,p.fx);
    ctx.rotate(angle+Math.PI/2);
    ellipse(0,10,21,9,"#30526c99");
    // Legs and boots.
    rect(-12,11,10,17,"#1e3039");rect(3,11,10,17,"#1e3039");
    ellipse(-9,25,8,5,"#111d26");ellipse(9,25,8,5,"#111d26");
    // Arms and gloves.
    ellipse(-19,0,8,14,"#375564");ellipse(19,0,8,14,"#375564");
    circle(-20,-8,6,"#212a2d");circle(20,-8,6,"#212a2d");
    // Upgradeable expedition jacket.
    const jacket=p.parka>0?"#f1a834":"#417c87";
    ellipse(0,0,20,22,"#18333e");
    ellipse(0,0,16,20,jacket);
    rect(-3,-19,6,37,"#ecf4dd");
    rect(-14,2,28,4,"#263c41");
    // Hood, goggles, and expressive head.
    circle(0,-14,15,p.parka>0?"#f3e7bc":"#cbd2c8");
    circle(0,-14,12,"#253942");
    ellipse(0,-14,11,6,"#a4e6ff");
    rect(-9,-16,18,4,"#152532");
    circle(0,-8,5,"#d1a481");
    if(p.rage>0){ctx.strokeStyle=C.red;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,-13,19,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    // Weapon points along the movement direction.
    const fx=p.fx,fy=p.fy,x=p.x+fx*23,y=p.y+fy*23;
    if(p.weapon==="uzi"||p.weapon==="shotgun"){
      const nx=-fy,ny=fx,len=p.weapon==="shotgun"?32:22;
      ctx.beginPath();ctx.moveTo(x-fx*8,y-fy*8);
      ctx.lineTo(x+fx*len,y+fy*len);
      ctx.lineWidth=p.weapon==="shotgun"?8:7;ctx.strokeStyle="#202d34";ctx.stroke();
      if(p.muzzle>0){circle(x+fx*(len+4),y+fy*(len+4),rand(7,13),C.yellow);}
    }else if(p.weapon==="staff"||p.weapon==="nunchucks"||p.weapon==="knife"){
      ctx.beginPath();ctx.moveTo(x-fx*10,y-fy*10);
      ctx.lineTo(x+fx*(p.weapon==="staff"?44:24),y+fy*(p.weapon==="staff"?44:24));
      ctx.lineWidth=p.weapon==="staff"?6:4;
      ctx.strokeStyle=ARMORY[p.weapon].color;ctx.stroke();
    }
    if(p.swing>0){
      ctx.beginPath();ctx.arc(p.x+fx*p.swingReach,p.y+fy*p.swingReach,25,0,Math.PI*2);
      ctx.lineWidth=5;ctx.strokeStyle=p.swingColor;ctx.stroke();
    }
  }
  function bar(x, y, width, percent, color, label) {
    text(label, x, y - 12, 12, C.white, "left", 900);
    rect(x, y, width, 13, "#2d4553");
    rect(x, y, width * clamp(percent / 100, 0, 1), 13, color);
    ctx.strokeStyle = "#f3f8fa";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, 13);
  }
  function drawObjectiveCompass(){
    const player=game.player;
    let nearest=null, minDist=Infinity;
    for(const item of game.drops){
      const d=Math.hypot(item.x-player.x,item.y-player.y);
      if(d<minDist){nearest=item;minDist=d;}
    }
    // Below half temperature, point to a real fire instead of ammunition.
    if(player.temp<48&&game.fires.length){
      nearest=null;minDist=Infinity;
      for(const fire of game.fires){
        const d=Math.hypot(fire.x-player.x,fire.y-player.y);
        if(d<minDist){nearest={x:fire.x,y:fire.y,kind:"FIRE"};minDist=d;}
      }
    }
    if(!nearest){
      const boss=game.birds.find(b=>b.variant==="boss"&&!b.down);
      if(boss){nearest={x:boss.x,y:boss.y,kind:"BOSS"};minDist=Math.hypot(boss.x-player.x,boss.y-player.y);}
    }
    if(!nearest)return;
    const angle=Math.atan2(nearest.y-player.y,nearest.x-player.x);
    rect(712,126,275,45,"#0a2232d4");
    circle(737,148,15,"#294a57");
    ctx.save();
    ctx.translate(737,148);ctx.rotate(angle);
    ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-6,-7);ctx.lineTo(-3,0);ctx.lineTo(-6,7);ctx.closePath();
    ctx.fillStyle=C.yellow;ctx.fill();
    ctx.restore();
    text("NEAREST "+nearest.kind.toUpperCase(),760,141,13,C.white);
    text(Math.round(minDist)+"m · FOLLOW THE ARROW",760,158,11,C.cyan);
  }
  function drawHud() {
    rect(0, 0, W, 84, "#091925f2");
    rect(0, 82, W, 2, "#425c69");
    text("EMPEROR GAUNTLET", 18, 24, 23, C.white);
    text("PENGUINS DOWN: " + game.score, 310, 24, 19, C.red);
    text("ICE FALLS: " + game.falls, 580, 24, 17, C.cyan);
    text("WAVE " + game.wave, 858, 23, 17, C.yellow);
    bar(18, 53, 192, game.player.hp, C.red, "HEALTH");
    bar(247, 53, 192, game.player.temp, game.player.warming?C.orange:C.cyan,game.player.warming?"TEMPERATURE + WARMING":"TEMPERATURE");
    bar(476, 53, 192, game.player.stamina, C.green, "STAMINA");
    ctx.beginPath();
    ctx.arc(776, 56, 19, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#607c8c";
    ctx.stroke();
    const w = wind(), n = norm(w.x, w.y);
    ctx.beginPath();
    ctx.moveTo(776, 56);
    ctx.lineTo(776 + n.x * 18, 56 + n.y * 18);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.yellow;
    ctx.stroke();
    circle(776 + n.x * 18, 56 + n.y * 18, 3, C.yellow);
    text("WIND", 748, 21, 12, C.white);
    text(game.blizzardTimer > 0 ? "BLIZZARD" : "CLEAR-ISH", 843, 57, 17,
      game.blizzardTimer > 0 ? C.yellow : C.white);
    // Second row: the active weapon, ammunition, throwable inventory and combo feedback.
    rect(0,83,W,36,"#0b2330e8");
    const p=game.player;
    const weaponSpec=ARMORY[p.weapon];
    text("WEAPON: "+weaponSpec.name,18,100,17,weaponSpec.color);
    text(weaponSpec.type==="gun"?"AMMO: "+p.ammo[p.weapon]:"MELEE / UNLIMITED",310,100,15,C.white);
    text("GRENADES: "+p.grenades,500,100,15,C.orange);
    text(p.warming?"FIRE WARMTH ACTIVE":p.combo>1?p.combo+"x COMBO":"FIND FIRE TO WARM UP",695,100,15,p.warming?C.orange:p.combo>1?C.yellow:C.white);
        if (game.messageTimer > 0 && game.message) {
      rect(80, H - 47, W - 160, 34, "#091925ed");
      ctx.strokeStyle = C.yellow;
      ctx.lineWidth = 2;
      ctx.strokeRect(80, H - 47, W - 160, 34);
      text(game.message, W / 2, H - 30, game.message.length > 80 ? 12 : 15, C.white, "center");
    }
    const boss=game.birds.find(b=>b.variant==="boss"&&!b.down);
    if(boss){
      const x=300,y=H-98,w=400;
      rect(x-3,y-18,w+6,40,"#081523d9");
      text("THE EMPEROR OF BAD DECISIONS",W/2,y-8,15,C.yellow,"center");
      rect(x,y,400,13,"#582b3d");
      rect(x,y,400*clamp(boss.hp/Math.max(1,boss.maxHp),0,1),13,C.red);
      ctx.strokeStyle="#ffe58b";ctx.lineWidth=1.5;ctx.strokeRect(x,y,w,13);
    }
    drawObjectiveCompass();
    if(game.waveBanner>0){
      const alpha=clamp(game.waveBanner/55,0,1);
      ctx.save();ctx.globalAlpha=alpha;
      text("WAVE " + game.wave,W/2,200,64,C.yellow,"center",1000);
      text(game.wave%2===0?"THE EMPEROR COMETH":"THE ROOKERY WANTS REVENGE",W/2,243,20,C.white,"center",900);
      ctx.restore();
    }
    text("BEST: " + best + "   /   TARGET: 37", W - 14, H - 72, 15, "#14384a", "right");
  }
  function drawBlizzard() {
    if (game.blizzardTimer <= 0) return;
    const w = wind();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#f4fbffce";
    ctx.beginPath();
    for (let i = 0; i < 140; i++) {
      const x = ((i * 71 + game.clock * .7 * w.x) % W + W) % W;
      const y = ((i * 43 + game.clock * .7 * w.y) % H + H) % H;
      ctx.moveTo(x, y);
      ctx.lineTo(x - w.x * 18, y - w.y * 18);
    }
    ctx.stroke();
    rect(0, 84, W, H - 84, "#f5fcff25");
  }
  function draw() {
    if (!game) return;
    const camX = clamp(game.player.x - W / 2, 0, WORLD_W - W);
    const camY = clamp(game.player.y - H / 2, 0, WORLD_H - H);
    ctx.save();
    if(game.shake>0)ctx.translate(rand(-game.shake,game.shake),rand(-game.shake,game.shake));
    drawWorld(camX,camY);
    drawBlizzard();
    ctx.restore();
    drawHud();
    if(pointerAim.active&&state==="running"){
      const x=pointerAim.x,y=pointerAim.y;
      ctx.strokeStyle=C.yellow;ctx.lineWidth=2;ctx.beginPath();
      ctx.arc(x,y,12,0,Math.PI*2);
      ctx.moveTo(x-20,y);ctx.lineTo(x-7,y);
      ctx.moveTo(x+7,y);ctx.lineTo(x+20,y);
      ctx.moveTo(x,y-20);ctx.lineTo(x,y-7);
      ctx.moveTo(x,y+7);ctx.lineTo(x,y+20);
      ctx.stroke();
    }
  }
  function frame(now) {
    if (!lastTime) lastTime = now;
    const elapsed = Math.min(now - lastTime, 100);
    lastTime = now;
    if (state === "running") {
      accumulator += elapsed;
      let ticks = 0;
      while (accumulator >= 1000 / FPS && ticks < 6 && state === "running") {
        tick();
        accumulator -= 1000 / FPS;
        ticks++;
      }
    } else {
      accumulator = 0;
    }
    draw();
    requestAnimationFrame(frame);
  }

  function keyName(event) {
    const k = event.key.toLowerCase();
    if (k === "arrowup" || k === "w") return "up";
    if (k === "arrowdown" || k === "s") return "down";
    if (k === "arrowleft" || k === "a") return "left";
    if (k === "arrowright" || k === "d") return "right";
    if (k === "shift") return "sprint";
    if (event.code === "Space") return "attack";
    return "";
  }
  window.addEventListener("keydown", e => {
    const k = keyName(e);
    const space = e.code === "Space";
    if (k || space || ["g","q","e","1","2","3","4","5","6"].includes(e.key.toLowerCase())) e.preventDefault();
    if (k && state === "running") pressed.add(k);
    if (e.repeat) return;
    if (e.key.toLowerCase() === "p" || e.key === "Escape") {
      if (state === "running" || state === "paused") pause();
    } else if (space) {
      if (state === "running") shove();
      else if (state === "menu" || state === "over" || state === "paused") start();
    } else if (state === "running" && e.key.toLowerCase() === "g") {
      throwGrenade();
    } else if (state === "running" && (e.key.toLowerCase() === "q" || e.key.toLowerCase() === "e")) {
      cycleWeapon(e.key.toLowerCase()==="e"?1:-1);
    } else if (state === "running" && /^[1-6]$/.test(e.key)) {
      selectWeapon(WEAPON_ORDER[Number(e.key)-1]);
    } else if (e.key.toLowerCase() === "r" && state === "over") {
      start();
    } else if (e.key === "Enter" && state !== "running") {
      start();
    }
  });
  window.addEventListener("keyup", e => {
    const k = keyName(e);
    if (k) pressed.delete(k);
  });
  window.addEventListener("blur", () => {
    pressed.clear();
    if (state === "running") pause();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") pause();
  });
  document.querySelectorAll("[data-hold]").forEach(button => {
    const action = button.dataset.hold;
    const release = () => { pressed.delete(action); button.classList.remove("pressed"); };
    button.addEventListener("pointerdown", e => {
      e.preventDefault();
      if (state !== "running") return;
      button.setPointerCapture?.(e.pointerId);
      pressed.add(action);
      button.classList.add("pressed");
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });
  const attackTouch = document.getElementById("touch-shove");
  attackTouch.addEventListener("pointerdown",e=>{
    e.preventDefault();
    if(state!=="running")return;
    attackTouch.setPointerCapture?.(e.pointerId);
    pressed.add("attack");
    shove();
  });
  const releaseAttack=()=>pressed.delete("attack");
  attackTouch.addEventListener("pointerup",releaseAttack);
  attackTouch.addEventListener("pointercancel",releaseAttack);
  attackTouch.addEventListener("lostpointercapture",releaseAttack);
  const grenadeTouch=document.getElementById("touch-grenade");
  if(grenadeTouch)grenadeTouch.addEventListener("pointerdown",e=>{e.preventDefault();throwGrenade();});
  const swapTouch=document.getElementById("touch-swap");
  if(swapTouch)swapTouch.addEventListener("pointerdown",e=>{e.preventDefault();cycleWeapon(1);});
  canvas.addEventListener("pointermove",e=>{
    if(e.pointerType==="touch")return;
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    pointerAim.x=clamp((e.clientX-rect.left)*W/rect.width,0,W);
    pointerAim.y=clamp((e.clientY-rect.top)*H/rect.height,0,H);
    pointerAim.active=true;
  });
  canvas.addEventListener("pointerdown",e=>{
    if(state!=="running"||e.pointerType==="touch")return;
    if(e.button!==0)return;
    pressed.add("attack");shove();
  });
  const releasePointer=()=>pressed.delete("attack");
  canvas.addEventListener("pointerup",releasePointer);
  canvas.addEventListener("pointercancel",releasePointer);
  canvas.addEventListener("pointerleave",()=>{releasePointer();pointerAim.active=false;});
  playButton.addEventListener("click", start);
  pauseButton.addEventListener("click", pause);
  fullButton.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else gameFrame.requestFullscreen?.();
  });
  gameFrame.addEventListener("contextmenu", e => e.preventDefault());
  game = newGame();
  requestAnimationFrame(frame);
})();
