# FUN — Original browser games

Independent, free browser arcade games. FUN includes Emperor Gauntlet, an Antarctic penguin-survival arcade game, and Cletus Saves Candy, a gritty urban rescue adventure. Not part of the manufacturing ERP engine.

## Current build state

**Reviewed:** 2026-10-20 · **Inspected main:** `f0e50d4042c4`.

- [pages build and deployment](https://github.com/danieloculus0-bot/FUN/actions/runs/39489952300) — **Passed** at inspected `main`.

[Live workflow history](https://github.com/danieloculus0-bot/FUN/actions) is the source for newer results.

## Play the games

- **[Cletus Saves Candy](https://danieloculus0-bot.github.io/FUN/cletus/)**: full browser game with city exploration, clue hunting, improvised weapons, Uzis, rockets, Big Tony and his gang. [Launch game](https://danieloculus0-bot.github.io/FUN/cletus/play.html) · [Game source](docs/cletus/play.html)
- **[Emperor Gauntlet](https://danieloculus0-bot.github.io/FUN/)**: Antarctic arcade shooter with day/night combat, penguins, seals and Yeti.

## Implemented features

- [Emperor Gauntlet](https://danieloculus0-bot.github.io/FUN/) has browser/mobile controls, day/night mechanics, weapons, pickups and arcade rounds.
- Playable GitHub Pages edition plus offline browser copy and historical Pygame prototype.
- Website build/deploy and browser-game checks exist; deployment does not prove all device-specific controls.

## Run or test

[Play the hosted edition](https://danieloculus0-bot.github.io/FUN/) or open `emperor-gauntlet/play.html` offline in a browser. Development/test commands are retained in the [archived original README](docs/archive/README_2026-10-20_before_refresh.md).

## Included in venvWin Portable's Puppy image

**Emperor Gauntlet is the only bundled game chosen for venvWin Portable.** The portable OS [vendors the existing playable offline HTML file](https://github.com/danieloculus0-bot/venvWin/blob/main/src/venvwin/games/emperor-gauntlet/play.html), sourced from FUN at commit `49dfdb3127e6ba2fcacd610cfea211a61ee36e53`, with an offline desktop/Games-menu launcher. A real HTML5 Canvas/JavaScript browser is required, but **no Pygame, game service or internet**.

This is an ISO build-recipe integration, **not** proof of a booted Puppy ISO or an in-guest gameplay test. The FUN repository stays an independent game project, not part of the Axiom ERP engine.

## Boundaries

- Touch/landscape/D-pad controls need physical-device usability testing outside standard browser CI.
- This independent game is not part of the BEAN intelligence/ERP integration evidence.

## Next step

Expand cross-device touch and responsive-control tests, then balance play mechanics while preserving the standalone game.

## Documentation

- [Play on GitHub Pages](https://danieloculus0-bot.github.io/FUN/)
- [Complete earlier README, including historical development notes](docs/archive/README_2026-10-20_before_refresh.md)
