// Scans public/puzzles/ and writes public/puzzles/index.json, the ordered list of themes the app uses:
//   - the daily schedule goes through the themes in this order (one theme per day)
//   - the Challenge spinner draws from the same themes
// Runs automatically before `npm run dev` and `npm run build`, so adding a theme is just dropping its
// .json file into the folder.
//
// Order is by file name (numbers sort naturally), so prefix files to control the sequence:
//   001-Music.json, 002-Coffee.json, ...  Append new themes at the END to avoid reshuffling days.
//
// Each theme file is a word bank. Every row says which lane it belongs to:
//   "pool": "daily"      Word of the Day (taken in a fixed shuffled order, 5 words per turn)
//   "pool": "challenge"  friend challenges
//   "pool": "practice"   extra words only Practice uses
// Words never move between lanes, so Practice cannot spoil a future daily or an open challenge.
// This script also checks the bank, and fails the build on anything that would break on its day.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

// Challenge file names are stored in the database, which only accepts this shape (see supabase/challenges.sql).
const FILE_NAME = /^[A-Za-z0-9_-]+\.json$/;
const POOLS = ['daily', 'challenge', 'practice'];
const MAX_CHUNKS = 3;
const SET_SIZE = 5;

const dir = new URL('../public/puzzles/', import.meta.url);
let failed = false;
const fail = (file, msg) => {
  console.error(`[puzzles] ${file}: ${msg}`);
  failed = true;
};
const warn = (file, msg) => console.warn(`[puzzles] ${file}: warning, ${msg}`);

const files = readdirSync(dir)
  .filter((f) => f.toLowerCase().endsWith('.json') && f !== 'index.json')
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));

if (files.length === 0) fail('public/puzzles', 'no puzzle files found.');

for (const f of files) {
  if (!FILE_NAME.test(f)) {
    fail(f, 'file name may only use letters, numbers, "_" and "-" (e.g. Space-Race.json)');
    continue;
  }
  let rows;
  try {
    const data = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    rows = Array.isArray(data) ? data : data?.puzzle;
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('no non-empty "puzzle" array');
  } catch (e) {
    fail(f, e.message);
    continue;
  }

  const counts = { daily: 0, challenge: 0, practice: 0 };
  const seen = new Set();
  rows.forEach((row, i) => {
    const at = `row ${i + 1}${row?.answer ? ` (${row.answer})` : ''}`;
    if (!Array.isArray(row?.chunks) || row.chunks.length === 0 || row.chunks.some((c) => typeof c !== 'string' || !c)) {
      return fail(f, `${at} needs a "chunks" array of non-empty strings`);
    }
    if (row.chunks.length > MAX_CHUNKS) fail(f, `${at} has ${row.chunks.length} chunks, the most allowed is ${MAX_CHUNKS}`);
    if (typeof (row.word ?? row.clue) !== 'string') fail(f, `${at} has no "word"/"clue" text`);
    if (row.answer && row.chunks.join('').toLowerCase() !== String(row.answer).toLowerCase()) {
      fail(f, `${at}: chunks ${row.chunks.join('+')} do not spell the answer`);
    }
    const pool = row.pool ?? 'daily';
    if (!POOLS.includes(pool)) return fail(f, `${at} has an unknown pool "${row.pool}"`);
    counts[pool]++;
    const id = String(row.answer ?? row.chunks.join('')).toLowerCase();
    if (seen.has(id)) fail(f, `${at} appears twice`);
    seen.add(id);
  });

  if (counts.daily < SET_SIZE) fail(f, `needs at least ${SET_SIZE} daily words, has ${counts.daily}`);
  else if (counts.daily % SET_SIZE !== 0) {
    warn(f, `${counts.daily} daily words; only ${counts.daily - (counts.daily % SET_SIZE)} are used (a multiple of ${SET_SIZE})`);
  }
  if (counts.challenge < SET_SIZE) warn(f, `${counts.challenge} challenge words: this theme is left out of the spinner (needs ${SET_SIZE}+)`);
  else if (counts.challenge < 10) warn(f, `only ${counts.challenge} challenge words, boards will repeat often`);
  if (counts.practice < SET_SIZE) warn(f, `only ${counts.practice} practice-only words, Practice leans on past daily words`);
}

if (files.length > 0 && !failed) {
  writeFileSync(new URL('index.json', dir), JSON.stringify({ files }, null, 2) + '\n');
  console.log(`[puzzles] puzzles/index.json: ${files.length} theme${files.length === 1 ? '' : 's'} (${files.join(', ')})`);
}

if (failed) process.exit(1);
