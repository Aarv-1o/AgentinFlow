// Persistence for the run. A JSON file on disk for now.
//
// M2 moves this to Upstash, because the two halves of the conversation
// happen in different processes - the run that asks "what do you think"
// has exited long before the answer arrives. Until then a file is enough
// to develop and test against, and keeping the interface to four functions
// means the swap touches this file only.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE = join(HERE, 'state');
const POSTED = join(STATE, 'posted.json');

// How long a story stays in the dedupe set. Long enough that a story
// resurfacing on a second aggregator does not get posted twice; short enough
// that a genuine follow-up story a quarter later is allowed.
const RETAIN_DAYS = 90;

async function readJSON(path, fallback) {
    try {
        return JSON.parse(await readFile(path, 'utf8'));
    } catch (err) {
        if (err.code === 'ENOENT') return fallback;
        throw err;
    }
}

async function writeJSON(path, data) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(data, null, 2) + '\n');
}

export async function loadPosted() {
    const raw = await readJSON(POSTED, []);
    const cutoff = Date.now() - RETAIN_DAYS * 864e5;
    // Prune on read rather than on write: a run that crashes mid-way should
    // not leave the file half-pruned.
    return raw.filter((e) => new Date(e.postedAt).getTime() > cutoff);
}

export async function seenUrls() {
    return new Set((await loadPosted()).map((e) => e.url));
}

export async function markPosted(entry) {
    const posted = await loadPosted();
    posted.push({ ...entry, postedAt: new Date().toISOString() });
    await writeJSON(POSTED, posted);
    return posted.length;
}

export const paths = { STATE, POSTED };
