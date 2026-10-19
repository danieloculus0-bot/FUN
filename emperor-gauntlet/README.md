# Emperor Gauntlet

> One unarmed man. A lot of penguins. Antarctica does most of the killing.

An arcade survival game inspired by the question: **"How many penguins could you kill in hand-to-hand combat on their turf?"**

**Creator's personal best: 37 penguins down before freezing to death.**

## Browser edition (new)

- [Play on GitHub Pages](https://danieloculus0-bot.github.io/FUN/) after Pages is enabled in this repository.
- **Play offline:** Download [play.html](play.html) as a file and open it in a modern browser. The game, styling, and graphics are included in that single HTML file.
- Web source: [HTML](../docs/index.html), [JavaScript](../docs/game.js), [CSS](../docs/style.css). It uses native Canvas and does not require Pygame or third-party scripts.

The browser version adds touch controls, a saved personal best, and combat scoring fixes: one hit per penguin per shove, with accidental ice falls tracked separately.

## Original Pygame version

Requires Python 3 and Pygame.

**Windows (PowerShell):**

```powershell
py -m pip install -r requirements.txt
py emperor_gauntlet.py
```

**macOS / Linux:**

```bash
python3 -m pip install -r requirements.txt
python3 emperor_gauntlet.py
```

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Move |
| Shift | Sprint |
| Space | Shove |
| P / Esc (browser) | Pause |
| R | Restart after game over |
| Touch arrows / sprint / shove (browser) | Play on phones and tablets |

## What's modeled

Player temperature, stamina, health, blizzards, wind, terrain, pressure cracks, penguin wandering, fleeing, huddling, panic, and occasional mobbing.

This is a stylized arcade prototype, **not** a calibrated biological or physiological simulation.

The Python code is preserved as contributed. The browser edition was checked for JavaScript syntax and tested with a simulated game loop, including shove damage, environmental scoring, pause/resume, and freezing. A full interactive cross-browser run has not yet been verified.
