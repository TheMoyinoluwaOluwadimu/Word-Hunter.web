// Scans public/puzzles/*.json and writes public/puzzles/index.json, the ordered list the app
// schedules from. Runs automatically before `npm run dev` and `npm run build`, so adding a
// puzzle is just dropping its .json file into the folder.
//
// Order is by file name (numbers sort naturally), so prefix files to control the sequence:
//   001-Music.json, 002-Coffee.json, ...  Append new files at the END to avoid reshuffling days.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../public/puzzles/', import.meta.url);

const files = readdirSync(dir)
  .filter((f) => f.toLowerCase().endsWith('.json') && f !== 'index.json')
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));

// Fail the build now rather than ship a puzzle that breaks on its day.
let bad = 0;
for (const f of files) {
  try {
    const data = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    const rows = Array.isArray(data) ? data : data?.puzzle;
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('no non-empty "puzzle" array');
  } catch (e) {
    console.error(`[puzzles] ${f}: ${e.message}`);
    bad++;
  }
}
if (bad > 0) process.exit(1);
if (files.length === 0) {
  console.error('[puzzles] No puzzle files found in public/puzzles/.');
  process.exit(1);
}

writeFileSync(new URL('index.json', dir), JSON.stringify({ files }, null, 2) + '\n');
console.log(`[puzzles] index.json: ${files.length} puzzle${files.length === 1 ? '' : 's'} (${files.join(', ')})`);
