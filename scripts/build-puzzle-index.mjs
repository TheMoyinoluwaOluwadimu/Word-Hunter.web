// Scans the puzzle folders and writes an index.json in each, the ordered lists the app uses:
//   public/puzzles/     the daily schedule (one puzzle per day, in this order)
//   public/challenges/  the pool the Challenge spinner picks from
// Runs automatically before `npm run dev` and `npm run build`, so adding a puzzle is just
// dropping its .json file into the folder.
//
// Order is by file name (numbers sort naturally), so prefix files to control the sequence:
//   001-Music.json, 002-Coffee.json, ...  Append new daily puzzles at the END to avoid reshuffling days.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

// Challenge file names are stored in the database, which only accepts this shape (see supabase/challenges.sql).
const CHALLENGE_NAME = /^[A-Za-z0-9_-]+\.json$/;

let failed = false;

for (const folder of ['puzzles', 'challenges']) {
  const dir = new URL(`../public/${folder}/`, import.meta.url);

  const files = readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.json') && f !== 'index.json')
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));

  // Fail the build now rather than ship a puzzle that breaks on its day.
  for (const f of files) {
    try {
      const data = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
      const rows = Array.isArray(data) ? data : data?.puzzle;
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('no non-empty "puzzle" array');
      if (folder === 'challenges' && !CHALLENGE_NAME.test(f)) {
        throw new Error('file name may only use letters, numbers, "_" and "-" (e.g. Space-Race.json)');
      }
    } catch (e) {
      console.error(`[puzzles] ${folder}/${f}: ${e.message}`);
      failed = true;
    }
  }
  if (files.length === 0) {
    console.error(`[puzzles] No puzzle files found in public/${folder}/.`);
    failed = true;
    continue;
  }

  writeFileSync(new URL('index.json', dir), JSON.stringify({ files }, null, 2) + '\n');
  console.log(`[puzzles] ${folder}/index.json: ${files.length} puzzle${files.length === 1 ? '' : 's'} (${files.join(', ')})`);
}

if (failed) process.exit(1);
