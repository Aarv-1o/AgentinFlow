// M1 entry point: fetch, filter, dedupe, and pick the story to ask about.
//
// Stops at the selection. Drafting needs your view, and asking for it is M2.
//
//   node social/run.mjs            top story plus the shortlist behind it
//   node social/run.mjs --json     machine-readable, for the M2 step to consume
//   node social/run.mjs --top 10   show more of the shortlist

import { fetchAll } from './sources.mjs';
import { selectStory, MAX_AGE_HOURS } from './select.mjs';
import { seenUrls } from './store.mjs';

const args = process.argv.slice(2);
const asJSON = args.includes('--json');
const topN = Number(args[args.indexOf('--top') + 1]) || 5;

const log = (...a) => { if (!asJSON) console.log(...a); };

const ago = (iso) => {
    const h = (Date.now() - new Date(iso).getTime()) / 36e5;
    return h < 1 ? `${Math.round(h * 60)}m ago` : `${h.toFixed(1)}h ago`;
};

const run = async () => {
    const { stories, failures } = await fetchAll();
    for (const f of failures) log(`  ! source failed - ${f}`);

    if (!stories.length) {
        // Both sources down is a real failure, not an empty day.
        console.error('No stories fetched from any source.');
        process.exit(1);
    }

    const seen = await seenUrls();
    const ranked = selectStory(stories, seen);

    if (!ranked.length) {
        log(`\nNothing to post: no unseen story inside ${MAX_AGE_HOURS}h.`);
        if (asJSON) console.log(JSON.stringify({ candidate: null, reason: 'no-eligible-story' }));
        return;
    }

    const [pick, ...rest] = ranked;

    if (asJSON) {
        console.log(JSON.stringify({ candidate: pick, shortlist: rest.slice(0, topN - 1) }, null, 2));
        return;
    }

    log(`\nfetched ${stories.length} · eligible ${ranked.length} · already posted ${seen.size}`);
    log('\n─── selected ' + '─'.repeat(52));
    log(`  ${pick.title}`);
    log(`  ${pick.url}`);
    log(`  ${pick.source} · ${pick.points} points · ${pick.comments} comments · ${ago(pick.publishedAt)}`);
    log(`  score ${pick.score.total}  ${JSON.stringify(pick.score.parts)}`);
    if (pick.discussion !== pick.url) log(`  discussion: ${pick.discussion}`);

    log('\n─── runners-up ' + '─'.repeat(51));
    for (const s of rest.slice(0, topN - 1)) {
        log(`  ${String(s.score.total).padStart(5)}  ${s.title.slice(0, 68)}`);
    }
    log('');
};

run().catch((err) => {
    console.error('Run failed:', err.message);
    process.exit(1);
});
