# Emperor Gauntlet v2.1: cross-agent finishing notes

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
