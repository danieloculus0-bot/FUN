# FUN

Weird experiments, tiny games, and dramatically overengineered answers to ridiculous questions.

## Emperor Gauntlet

> One unarmed human. A lot of penguins. Antarctica does most of the killing.

An arcade survival game born from the question: **"How many penguins could you defeat in hand-to-hand combat on their turf?"**

**Legendary record: 37 penguins before freezing to death.**

### Ways to play

- **Browser:** [Play Emperor Gauntlet](https://danieloculus0-bot.github.io/FUN/) (requires GitHub Pages to be enabled for this repository).
- **Offline HTML:** [Download `emperor-gauntlet/play.html`](emperor-gauntlet/play.html) and open the saved file in Chrome, Firefox, Edge, or Safari. No installation or internet required.
- **Original Python:** [Pygame source and local run instructions](emperor-gauntlet/README.md).

### Development

The Python original is preserved. The HTML5 Canvas port lives under [`docs/`](docs/) and is dependency-free. The GitHub Pages deployment workflow is at [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

To enable online hosting: repository **Settings > Pages > Build and deployment > Source > GitHub Actions**. The deployment workflow runs automatically after changes to the web edition. You can also run it from **Actions**.

**Reminder:** This is an absurdist arcade game, not a real-world animal combat simulation.
