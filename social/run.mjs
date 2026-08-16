// The whole run, in one process.
//
//   node social/run.mjs              full interactive run
//   node social/run.mjs --dry-run    everything except publishing
//   node social/run.mjs --pick       open on the shortlist
//   node social/run.mjs --list       what is available, then exit (no keys needed)
//   node social/run.mjs --help       flags and in-run commands
//
// X only. LinkedIn was dropped: company-page posting needs a business email
// on a custom domain, a 2-6 week review, and a manual reconnect every 60 days
// because refresh tokens go to approved partners only.

import { fetchAll } from './sources.mjs';
import { selectStory, MAX_AGE_HOURS } from './select.mjs';
import { seenUrls, markPosted } from './store.mjs';
import { draft } from './draft.mjs';
import { requireOpenAI, config } from './config.mjs';
import { status } from './auth/oauth.mjs';
import * as ui from './ui.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const DRY = has('--dry-run');
const HELP = has('--help') || has('-h');
const LIST = has('--list');
const PICK = has('--pick');

const ago = (iso) => {
    const h = (Date.now() - new Date(iso).getTime()) / 36e5;
    return h < 1 ? `${Math.round(h * 60)}m ago` : `${h.toFixed(1)}h ago`;
};

// Publish. Kept as a loop over a list rather than a single call, so adding a
// platform later is a list entry rather than a rewrite of the caller.
async function publishAll(story, drafts) {
    const connected = new Set(
        (await status()).filter((s) => s.connected).map((s) => s.provider)
    );

    const targets = [
        { key: 'x', text: drafts.x, load: () => import('./publish/x.mjs') }
    ];

    const results = [];
    for (const t of targets) {
        if (!connected.has(t.key)) {
            console.log(`  ${ui.colour.wine(t.key + ' is not connected')} — node social/setup.mjs ${t.key}`);
            continue;
        }
        try {
            const { publish } = await t.load();
            const res = await publish(t.text);
            console.log(`  ${ui.colour.bold(res.platform)} posted  ${ui.colour.dim(res.url || res.id || '')}`);
            results.push({ ok: true, platform: res.platform, ...res });
        } catch (err) {
            console.log(`  ${ui.colour.wine(t.key + ' failed')}  ${err.message}`);
            // Keep the text that failed so it can be posted by hand rather
            // than regenerated from scratch.
            await saveFailed(story, t.key, t.text, err.message);
            results.push({ ok: false, platform: t.key, error: err.message });
        }
    }
    return results;
}

async function saveFailed(story, platform, text, error) {
    const dir = join(dirname(fileURLToPath(import.meta.url)), 'state', 'failed');
    await mkdir(dir, { recursive: true });
    const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${platform}.json`;
    await writeFile(join(dir, name), JSON.stringify({ story: story.title, url: story.url, platform, text, error }, null, 2));
    console.log(ui.colour.dim(`    draft saved to state/failed/${name}`));
}

async function gather() {
    const { stories, failures } = await fetchAll();
    for (const f of failures) console.log(ui.colour.wine(`  ! source failed - ${f}`));
    if (!stories.length) throw new Error('No stories fetched from any source.');

    const seen = await seenUrls();
    const ranked = selectStory(stories, seen);
    console.log(ui.colour.dim(
        `  ${stories.length} fetched · ${ranked.length} eligible · ${seen.size} already posted`
    ));
    return ranked;
}

// --pick opens on the shortlist instead of the top story.
async function pickIndex(ranked) {
    const chosen = await ui.chooseFrom(ranked, ago);
    if (chosen === null) {
        console.log(ui.colour.dim('\n  Nothing chosen.\n'));
        return null;
    }
    return chosen;
}

async function run() {
    if (HELP) {
        console.log(`
  node social/run.mjs [options]

    --dry-run   everything except publishing
    --pick      open on the shortlist instead of the top story
    --list      show what is available and exit (no API key needed)
    --help      this
`);
        ui.help();
        return;
    }

    ui.banner({ connections: await status(), model: config.openai.model });
    const ranked = await gather();

    if (!ranked.length) {
        console.log(`\n  Nothing to post: no unseen story inside ${MAX_AGE_HOURS}h.\n`);
        return;
    }

    if (LIST) {
        console.log('');
        ui.rule('available');
        ranked.slice(0, 10).forEach((s) => {
            console.log(`  ${String(s.score.total).padStart(5)}  ${s.title.slice(0, 66)}`);
            console.log(ui.colour.dim(`         ${s.source} · ${s.points}pts · ${ago(s.publishedAt)}`));
        });
        console.log('');
        return;
    }

    // Only now is a key required - --list stays usable without one.
    requireOpenAI();

    // Walk the ranked list until one is worth writing about. Rejecting a
    // story is not the same as posting it: nothing is recorded, so it comes
    // back next run rather than being burned.
    let index = PICK ? await pickIndex(ranked) : 0;
    if (index === null) return;

    let story;
    let view;

    for (;;) {
        if (index >= ranked.length) {
            console.log(ui.colour.dim('\n  That is every eligible story. Nothing posted.\n'));
            return;
        }

        story = ranked[index];
        if (index === 0) ui.notify('AgentinFlow: story ready', story.title);
        ui.showStory(story, ago(story.publishedAt));

        const answer = await ui.askView({ remaining: ranked.length - index - 1 });

        if (answer.action === 'quit') {
            console.log(ui.colour.dim('\n  Nothing posted, nothing recorded.\n'));
            return;
        }
        if (answer.action === 'next') {
            index += 1;
            continue;
        }
        if (answer.action === 'list') {
            const chosen = await ui.chooseFrom(ranked, ago);
            if (chosen !== null) index = chosen;
            continue;
        }
        if (answer.action === 'open') {
            ui.openUrl(story.url);
            continue;
        }
        if (answer.action === 'discussion') {
            ui.openUrl(story.discussion || story.url);
            continue;
        }
        if (answer.action === 'help') {
            ui.help();
            continue;
        }

        view = answer.text;
        break;
    }

    // Loop until the drafts are approved, the view is rewritten, or it is
    // abandoned. Nothing is recorded as posted until publishing succeeds.
    for (;;) {
        console.log(ui.colour.dim('\n  drafting…'));
        const drafts = await draft(story, view, {
            onRetry: (why) => console.log(ui.colour.dim(`  retrying - ${why}`))
        });

        ui.showDrafts(drafts);
        const action = await ui.reviewAction();

        if (action === 'skip') {
            console.log(ui.colour.dim('\n  Abandoned. Story stays eligible for next time.\n'));
            return;
        }
        if (action === 'regenerate') continue;
        if (action === 'edit') {
            const next = await ui.askView();
            if (next) view = next;
            continue;
        }

        // action === 'post'
        if (DRY) {
            console.log(ui.colour.dim('\n  --dry-run: nothing published, story left eligible.\n'));
            return;
        }

        const results = await publishAll(story, drafts);
        const posted = results.filter((r) => r.ok);

        if (posted.length) {
            const n = await markPosted({
                url: story.canonical,
                title: story.title,
                platforms: posted.map((r) => r.platform)
            });
            console.log(ui.colour.dim(`  Recorded. ${n} stories in the dedupe store.\n`));
        } else {
            console.log(ui.colour.wine('  Nothing published. Story stays eligible for the next run.\n'));
        }
        return;
    }
}

run()
    .catch((err) => {
        console.error(ui.colour.wine(`\n  Run failed: ${err.message}\n`));
        process.exitCode = 1;
    })
    .finally(ui.holdOpen);
