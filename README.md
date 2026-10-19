# FUN

Weird experiments, tiny games, and dramatically overengineered answers to ridiculous questions.

## Emperor Gauntlet: POLAR NIGHT (v2.3)

> One deranged explorer. An army of penguins. Antarctica does most of the killing.

A ridiculous, free, browser-based Antarctic arcade game, based on a hypothetical question about surviving hand-to-hand combat with emperor penguins.

**Original creator's record: 37 penguins before freezing to death.**

### Play it

- **Online (GitHub Pages):** [Emperor Gauntlet](https://danieloculus0-bot.github.io/FUN/)
- **Offline in a browser:** Download [`emperor-gauntlet/play.html`](emperor-gauntlet/play.html) as a file and open it. No install or internet needed.
- **Original Python prototype:** [Pygame edition](emperor-gauntlet/emperor_gauntlet.py)

The browser game is the actively developed main edition in [`docs/`](docs/). The Pygame original stays available for history.

### Chaos build features

- **Seven weapon slots:** fists, knife, nunchucks, bo staff, Uzi, shotgun, plasma ion cannon
- **Throwables:** grenades with area damage and dangerous splashback
- **Survival gear:** parkas, first-aid kits, ice cleats, ammo, caffeine rage boosts
- **Better characters:** illustrated Antarctic explorer, animated penguins, bruisers and berserkers
- **Effects:** blood splatter, blood trails, explosions, damage numbers, combos and screen shake
- **Cross-device:** keyboard/mouse, click-to-fire aiming, touch controls, browser-local personal best
- **Waves and bosses:** escalating waves, giant crowned Emperor boss, boss health bar and reward drops
- **Audio:** optional synthesized arcade effects (off by default, no external sound files)
- **Navigation:** compass points toward loot or heat sources
- **Fire:** animated permanent campfires, extra braziers during boss fights, and real body-temperature recovery
- **Ion cannon:** absurdly powerful plasma blasts that open dangerous permanent ice holes and glowing cracks, potentially near the player
- **Yeti:** a hunched, white-furred side-profile Bigfoot, scaled to boss-penguin height rather than towering over the arena; peaceful warmth source, or a difficult fight worth 1,000 points
- **Uzi default:** collecting an Uzi equips it; subsequent pickups never force you off the weapon you chose
- **HUD:** locked player camera and clear arena bounded by opaque top/bottom information bands
- **Polar night:** wave 3, 6, 9, etc. runs under darkness; player, campfires, friendly Yeti, ion shots and explosions provide local illumination. Daybreak returns on the following wave
- **Environment:** blizzards, pressure cracks, dangerous ice, fatigue, cold

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
| 1 through 7 | Select a weapon slot |
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
