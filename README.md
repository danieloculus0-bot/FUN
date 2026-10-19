# FUN

Weird experiments, tiny games, and dramatically overengineered answers to ridiculous questions.

## Emperor Gauntlet: POLAR FIRE (v2.5)

> One deranged explorer. An army of penguins. Antarctica does most of the killing.

A ridiculous, free, browser-based Antarctic arcade game, based on a hypothetical question about surviving hand-to-hand combat with emperor penguins.

**Original creator's record: 37 penguins before freezing to death.**

### Play it

- **Online (GitHub Pages):** [Emperor Gauntlet](https://danieloculus0-bot.github.io/FUN/)
- **Offline in a browser:** Download [`emperor-gauntlet/play.html`](emperor-gauntlet/play.html) as a file and open it. No install or internet needed.
- **Original Python prototype:** [Pygame edition](emperor-gauntlet/emperor_gauntlet.py)

The browser game is the actively developed main edition in [`docs/`](docs/). The Pygame original stays available for history.

### Chaos build features

- **Nine weapon slots:** fists, knife, nunchucks, bo staff, Uzi, shotgun, plasma ion cannon, rocket launcher, flamethrower
- **Throwables:** grenades with area damage and dangerous splashback
- **Survival gear:** parkas, first-aid kits, ice cleats, ammo, caffeine rage boosts
- **Better characters:** illustrated Antarctic explorer, animated penguins, bruisers and berserkers
- **Effects:** huge comic-book blood detonations and flying gore fragments, especially for bruisers and Emperor bosses, persistent red-snow stains, damage numbers, combos and heavy screen shake
- **Cross-device:** keyboard/mouse, click-to-fire aiming, touch controls, browser-local personal best
- **Waves and bosses:** escalating waves, giant crowned Emperor boss, boss health bar and reward drops
- **Audio:** optional synthesized arcade effects (off by default, no external sound files)
- **Navigation:** compass points toward loot or heat sources
- **Fire:** permanent campfires, boss braziers, and 12-second flamethrower fuel fires that visibly flicker out and actually warm the player
- **Ion cannon:** absurdly powerful plasma blasts that open dangerous permanent ice holes and glowing cracks, potentially near the player
- **Yeti:** a boss-sized side-profile Bigfoot who provides warmth when friendly, independently snatches and eats penguins without giving the player kill credit, and defends the seal with a half-health warning smack. Provoking him directly leads to a difficult fight worth 1,000 points
- **Day/night weapon preferences:** Uzi automatically becomes active in full daylight if owned; flamethrower is supplied and automatically equipped at nightfall. Other owned weapons remain manually selectable until the next transition
- **HUD:** locked player camera and clear arena bounded by opaque top/bottom information bands
- **Polar night:** every 3rd wave queues 15-second dusk → exactly 59 seconds of night → 15-second dawn, with at least 3 minutes of daylight between events; directional flashlight and fire/energy/explosion lighting, increased night cold
- **Baby seal:** a visible white pup near the starting area. Attacking it triggers the Yeti guardian, reducing current player HP by 50% (without a lethal warning blow); the seal survives
- **Environment:** five winding, jagged-edged river channels with matching hazards and ice bridges, water holes, blizzards, dangerous pressure cracks, fatigue and cold
- **Leopard seals:** predators surface partly from water holes and ambush players who linger; their health scales to 2x current giant Emperor boss health
- **Ammo:** flame fuel pickups, rockets and significantly easier-to-find ion cannon pickups

### Controls

| Key / input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Shift | Sprint |
| Space / mouse click | Attack; hold for automatic attacks |
| Mouse movement over the arena | Aim in any direction; movement alone controls facing otherwise |
| SOUND button | Toggle generated arcade sounds |
| G | Throw grenade |
| Q / E | Switch between owned weapons |
| 1 through 9 | Select a weapon slot |
| P / Esc | Pause |
| Walk over equipment | Collect it |

### Dev and testing

Plain JavaScript and HTML5 Canvas. Zero runtime libraries or services. Start by opening `docs/index.html` or the bundled offline `emperor-gauntlet/play.html`.

Regression checks can run with Node:

```sh
node --check docs/game.js
node tests/web-smoke.cjs
```

GitHub Actions runs the JavaScript checks. The website publishes directly from **`main` / `/docs`** using GitHub Pages' native branch publishing. One-time setup: **Settings > Pages > Source: Deploy from a branch > Branch: main > Folder: /docs > Save.** After activation, future pushes to `main/docs` will publish automatically. GitHub Pages has previously published successfully; verify the latest deployment run for the newest build.

This is a deliberately unpolished chaos build. Cross-browser controls, game balance, boss and wave difficulty, sprite polishing and deployment verification are next-pass work, suitable for Replit or independent review with Claude.

**No real penguins were harmed.**
