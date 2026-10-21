// Runs after `vite build`: writes a fresh id into dist/sw.js so every deploy produces a byte-different
// service worker. That is how installed copies notice there is a new version (see public/sw.js).
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../dist/sw.js', import.meta.url);
const id = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 8) || Date.now().toString(36);
writeFileSync(file, readFileSync(file, 'utf8').split('__BUILD_ID__').join(id));
console.log(`[sw] build id ${id}`);
