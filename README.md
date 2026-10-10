# Wordhunter

A themed word-puzzle game. Each row gives you a clue; the answers are broken into chunks that are mixed together in one shared pool. Drag chunks into the slots. Nothing tells you right or wrong until every slot is full, then the board checks itself.

Built with React + TypeScript + Vite.

## Run it

Needs Node 18 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
npm run typecheck  # types only
```

If `npm install` ever fails with a "Cannot find native binding" error, delete `node_modules` and `package-lock.json` and run `npm install` again (this is a known npm bug with platform-specific packages). The project is pinned to Vite 6, which doesn't need a native bundler.

`dist/` is plain static files. Drop it on Netlify, Vercel, GitHub Pages, or any static host.
Routing uses `#/`, `#/play`, `#/practice` and `#/practice/<file>`, so no server rewrite rules are needed.

## Changing today's puzzle

Puzzle files live in `public/puzzles/`. The one used is set in `src/config.ts`:

```ts
export const DAILY_PUZZLE_FILE = 'OceanLife.json';
```

To use another puzzle (for example one exported from the puzzle generator), drop its `.json` into `public/puzzles/` and change that line.

### Puzzle file format

```json
{
  "theme": "Ocean Life",
  "puzzle": [
    { "clue": "Eight-armed sea creature", "chunks": ["oc", "to", "pus"] }
  ]
}
```

- `chunks` joined together make the answer. Every chunk becomes a tile.
- The text shown on each row is read from `clue` (or `word`).
- Files are validated on load; a bad file shows a specific error instead of a blank screen.

## Project layout

```
src/
  config.ts            which puzzle file + storage key
  types.ts             shared types
  App.tsx              routes: "/" menu, "/play" daily game, "/practice" archive, "/practice/:file" practice game
  pages/
    MainMenu.tsx       home screen (+ .module.css)
    Game.tsx           game screen (daily or practice): timer, streak, solved overlay, leave prompt
    Practice.tsx       archive list of past puzzles with best times
    PracticeGame.tsx   /practice/:file, only files in ARCHIVE_PUZZLE_FILES
  game/
    boardReducer.ts    the rules: placing, swapping, checking, locking (no UI)
    Board.tsx          drag-and-drop UI built on the reducer
  components/          icons, FireIcon, ConfirmDialog
  hooks/               usePuzzle, usePlayerStats, useTimer, useNow
  lib/
    storage.ts         streak rules + localStorage (UTC daily reset, no grace period)
    puzzle.ts          puzzle loading + validation
    sound.ts           synthesized click sounds (no audio files)
public/puzzles/        puzzle JSON files
```

## Streak rules

- One global reset at 00:00 UTC, not the player's local midnight.
- Solve on consecutive days: streak +1. Miss a day: back to 1. No grace period.
- Replaying an already-solved day does not count again.
- Stored in `localStorage` (key `wordhunter_state`), per browser, until there is a backend.

## Practice (archive)

- The Practice card on the menu opens `#/practice`, a list of past puzzles. Tapping one plays it at `#/practice/<file>`.
- The list comes from `ARCHIVE_PUZZLE_FILES` in `src/config.ts`. When you change `DAILY_PUZZLE_FILE`, add the old file to that list.
- Practice never changes the streak or the solved count. Each solve only saves the best time per puzzle, in `localStorage` under `wordhunter_practice`.
- After a practice solve the player can replay, jump to the next puzzle in the list, or go back to the archive.
