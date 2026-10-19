# Emperor Gauntlet

> One unarmed man. A lot of penguins. Antarctica does most of the killing.

A one-file Python/Pygame arcade prototype inspired by the question: **"How many penguins could you kill in hand-to-hand combat on their turf?"**

You play the human. The penguins generally try to avoid you, but things can escalate. The ice, cold, wind, and exhaustion are less interested in negotiating.

**Current personal best: 37 penguins down before freezing to death.**

## Run locally

Requires **Python 3** and **Pygame**. In a terminal in this directory:

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

If Python or Pygame isn't installed, install Python first and run the Pygame installation command above.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Move |
| Left Shift | Sprint |
| Space | Shove / grapple attempt |
| R | Restart after game over |
| Esc | Quit |

## Gameplay

- Body temperature, stamina, and health
- Blizzards, wind, snowdrifts, thin ice, and pressure cracks
- Penguin wandering, fleeing, huddling, panic, and occasional retaliation
- Increasing penguin population as the score climbs
- Comically unfortunate game-over messages

## Status

**Local Pygame prototype.** This is a game, not a calibrated biological combat model. Source has been syntax-checked, but a full interactive gameplay test has not been performed as part of this repository upload.

### Browser edition (planned)

A future HTML/WebAssembly version could use a browser-compatible Pygame runtime such as `pygbag`, with an adapted asynchronous event loop and GitHub Pages deployment. **Browser play is not currently available.** The original local version is preserved here for that work.
