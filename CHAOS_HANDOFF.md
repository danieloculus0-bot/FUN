# Emperor Gauntlet v2.5: cross-agent finishing notes

**Repository:** danieloculus0-bot/FUN
**Active playable edition:** `docs/index.html`, `docs/game.js`, `docs/style.css`
**Standalone offline edition:** `emperor-gauntlet/play.html`, assembled from the three web files
**Historical baseline:** `emperor-gauntlet/emperor_gauntlet.py`
**Deployment:** GitHub Pages native branch publishing from `main` and folder `/docs`. One-time activation in repository Settings > Pages > Source: Deploy from a branch > Branch: main > Folder: /docs > Save. `.github/workflows/pages.yml` only runs CI tests; it does not attempt deployment.

## Current implemented build

Browser-based Canvas top-down Antarctic arena. Movement / sprint, shoves and weapon cooldowns, Uzi/shotgun bullets, knife, bo staff, nunchucks, grenades with player splash damage, ammo inventory, pickups, jacket cold resistance, medkits, cleats, rage boost, blood effects, popup damage, screen shake, combo counter, basic penguin variants, crowned Emperor boss with a health bar, ten-kill wave director, loot compass, mouse aiming, optional Web Audio oscillator sound effects, blizzard, terrain hazards, camera, touch controls, and local best-score storage.

The humor, exaggerated weapons and simulated cartoon violence are intentional.

## Controls

WASD/arrows to move; Shift sprint; mouse moves aiming cursor within the arena; Space or left mouse button to attack (hold to repeat); G grenade; Q/E cycle owned weapons; 1-6 quick weapon select; P/Escape pause; SOUND button toggles generated audio (off by default). Touch arrows, sprint, swap, boom, fire are provided.

## Finishing pass priorities

1. Open the GitHub Pages site and the offline HTML in real browsers (desktop and mobile); validate touch input and sizing. Check Pages setup if the site is still unavailable.
2. Run `node --check docs/game.js` and `node tests/web-smoke.cjs`, then click through real gameplay, weapon pickups, firing, switches, inventory/ammo, grenades, deaths and restarts.
3. Play-balance cold drain, survivability, grenade friendly fire, drop frequencies, player attack timing and enemy composition. The original 37-penguin baseline is not directly comparable to the armed arcade edition.
4. Improve character animation and hitbox alignment. Current characters are procedural Canvas illustrations, not imported sprite sheets.
5. Evaluate synthesized browser sound effects, screen transitions, and legible responsive UI. Audio is now optional and off by default.
6. Add wave pacing, optional mini-bosses and more absurd rare drops only after controls and combat are stable.

## Key development rule

Keep the repository's `main` branch as the current source of truth. Do not replace it with the older Python prototype. Preserve `emperor-gauntlet/emperor_gauntlet.py` as history. When `docs/` changes, regenerate `emperor-gauntlet/play.html` from the HTML, CSS, and JS so offline and hosted editions don't diverge.

## Verification to date

JavaScript syntax and mocked Canvas event/render/gameplay loops have passed in the development session, including item pickup, Uzi bullet, grenade explosion, weapon switch, pause/resume and freeze death. The GitHub Pages site and real interactive browser playthrough have **not** been independently verified. No claim is made that this is a polished or balanced release.

## v2.1 engineering note

Wave two begins at ten combat defeats. Each subsequent wave needs incrementally more kills and even-numbered waves spawn a crowned Emperor boss. Bosses have different hit and contact radii, increased health and damage, and guaranteed supply drops. Audio uses the browser's Web Audio API, is opt-in, and should be tested across Chromium, Safari, Firefox and mobile. Mouse aim is relative to the canvas element's displayed size and accounts for scrolling camera movement; touch users retain directional movement-facing. The on-screen pickup compass helps players find scattered supplies. Validate boss health, collision radius, aiming transform, audio playback and offline parity during the finishing pass.

## Yeti + HUD visibility fix (v2.2.1)

The Yeti now appears about 3 seconds after starting (`yetiNext=190` frames), roughly 195 world units away from the player, rather than far off-screen at 950 frames. It is a large, clearly rendered white ape-like creature with a normal-size status label. Boss and Yeti encounter announcements, compass, and health displays stay entirely in opaque top/bottom bands; gameplay viewport is clipped to y=120..535 on the 1000x640 canvas. The camera tracks the player's screen position at (500,385), including near world boundaries, with mouse aim using the same transform. Native GitHub Pages publishes from `main/docs`. Automated smoke tests now assert Yeti spawning close to the player, warmth at fires and the Yeti, ion terrain destruction, Uzi default selection, and frost death away from all heat.

## v2.3: Side-profile Yeti and polar night

The Yeti is now a **boss-penguin-sized, side-profile Bigfoot**. The sprite has hunched shoulders, long gorilla arms, single-profile eye, projecting muzzle and oversized snow feet. It remains white and warm when unprovoked, red-eyed when enraged. Bullet/melee hit radii were shrunk to match the smaller sprite while preserving the health and 1,000-point reward. Night happens for waves 3, 6, 9, and all waves divisible by three, with daybreak immediately the next wave. Night masks only the gameplay area and illuminates around the player, campfires, Yeti, ion projectiles and explosions using an offscreen compositing mask (with a safe fallback for headless tests). The HUD is rendered on top, remains bright, and displays NIGHT plus a daybreak/nightfall announcement inside the HUD bands. The offline HTML must be regenerated when these files change. Night transitions and spotlight rendering are covered by automated regression tests.

## v2.4 Bloodbath: Gore, protected seal and Yeti feeding

Cartoon gore is now intentionally high-intensity by default: boss and bruiser penguin kills generate large red particle blasts, spinning illustrated fragments, copious blood decals on snow, blood-colored explosion rings, popup text, and stronger camera shake. Limits apply to particle, gib and stain arrays to preserve performance. These are stylized Canvas effects, not realistic imagery.

A baby seal begins near the player's starting area and wanders in view. It has a clearly marked name and is not collectible. A direct melee hit, firearm projectile, grenade blast, or ion explosion will trigger `warnSeal`; the pup isn't killed, and the Yeti gives a nonlethal warning slap costing exactly half of current health. The warning has a cooldown to avoid stacking every frame, includes a priority notice inside the lower HUD, and spawns or repositions a protective Yeti. The guardian is temporarily shielded from accidental melee retaliation by the same swing that provoked it.

The Yeti randomly grows hungry, stalks normal penguins and consumes them. Such penguins are marked eaten and removed from the drawing loop; their deaths generate no player kills, points, combo, ice-fall count or wave credit. A separate `yetiEats` counter records these meals. The Yeti's mouth animates while munching; snacks do not create player-triggered gore bursts. Direct attacks against the Yeti still enrage it and defeating it still awards 1000 points.

Automated gameplay checks cover the Emperor gore output, Yeti meals with zero player rewards, seal warning health and cooldown, and continued original combat mechanics. Hosted source lives in `docs/`; regenerate the offline HTML using the same inline CSS and game JavaScript.

## v2.5 POLAR FIRE implementation (current behavior overrides historic notes)

Every third wave **queues** a timed darkness event; prior instant third-wave/night-until-wave-end behavior is obsolete. The current sequence is exactly 900 gameplay ticks (15 seconds) of dusk, 3540 ticks (59 seconds) of full night, then 900 ticks (15 seconds) of dawn. After dawn at least 10800 ticks (3 min) of full daylight are enforced before another queued night event. Temperature drain rises proportionally with darkness; daylight is warmer. The night mask supports a directional flashlight beam, a tiny player glow, orange campfire/fuel-fire light, and temporary projectile/explosion lights. HUD remains outside the clipped gameplay viewport.

Weapon preferences: Uzi by day (when owned), flamethrower at onset of night. A fueled flamethrower is guaranteed at nightfall even if the pickup was missed. Manual selection of any owned weapon is permitted between transitions. Early map drops provide Uzi, ion cannon, rocket launcher, flamethrower and fuel. Ammo crates and recurring supply drops include fuel/rockets/ion cells. Flamethrower uses 1 fuel every 3 frames when fired and sweeps a fiery damage cone, with optional nonflammable ice scorch fissures. Every ~75 frames of spraying it creates a roughly 12-second temporary fuel fire on safe solid ice (not on a penguin or water). These fires warm the player in a 107-unit radius, light the night, visually die down, and expire; capped at 14 temporary patches. Blood has **no flammability mechanic**.

Original rectangular water trenches replaced by five precomputed irregular river paths. Their drawing and collision share sampled centerlines, uneven widths and jagged banks. Small ice bridges provide safe crossings; penguins entering water count as ice kills. Leopard seals partially emerge from two holes and ambush nearby players; they have twice the current Emperor boss HP. They can be hurt by ordinary bullets, melee, grenades, plasma blasts, rockets and flamethrower. Their defeat gives 650 bonus points separately from penguin waves.

Browser smoke tests now include river/channel count, seal health scaling, ion availability, rocket/flame pickups, temporary fuel-fire heat and expiration, timed dusk/night/dawn progression, night flashlight light-rendering, Uzi/flame automatic equipment, and existing core scoring. The game remains **top-down**; FPS is only a possible future experiment and has not been implemented.
