// The whole run, in one process.
//
//   node social/run.mjs              full interactive run
//   node social/run.mjs --dry-run    everything except publishing
//   node social/run.mjs --pick       choose from the shortlist instead of the top story
//   node social/run.mjs --list       just show what is available and exit (no keys needed)
//
// Publishing is M3/M4 and is not wired up yet, so every run is effectively a
// dry run today. The flag exists so it stays possible afterwards.

import { fetchAll } from './sources.mjs';
import { selectStory, MAX_AGE_HOURS } from './select.mjs';
import { seenUrls, markPosted } from './store.mjs';
import { draft } from './draft.mjs';
import { requireOpenAI } from './config.mjs';
import * as ui from './ui.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const DRY = has('--dry-run');
const LIST = has('--list');
const PICK = has('--pick');

const ago = (iso) => {
    const h = (Date.now() - new Date(iso).getTime()) / 36e5;
    return h < 1 ? `${Math.round(h * 60)}m ago` : `${h.toFixed(1)}h ago`;
};

// Publish to both, independently. One platform failing must not stop the
// other - they are separate accounts with separate approvals, and LinkedIn
// may be unavailable for weeks while X works fine.
async function publishAll(story, drafts) {
    const targets = [
        { key: 'linkedin', text: drafts.linkedin, load: () => import('./publish/linkedin.mjs') },
        { key: 'x', text: drafts.x, load: () => import('./publish/x.mjs') }
    ];

    const results = [];
    for (const t of targets) {
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

async function choose(ranked) {
    if (!PICK) return ranked[0];

    console.log('');
    ui.rule('shortlist');
    ranked.slice(0, 5).forEach((s, i) => {
        console.log(`  ${i + 1}. ${String(s.score.total).padStart(5)}  ${s.title.slice(0, 62)}`);
    });
    console.log('');
    const io = (await import('node:readline/promises')).createInterface({
        input: process.stdin, output: process.stdout
    });
    const n = Number(await io.question('  which? [1] ')) || 1;
    io.close();
    return ranked[Math.min(Math.max(n, 1), 5) - 1];
}

async function run() {
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

    const story = await choose(ranked);
    ui.notify('AgentinFlow: story ready', story.title);
    ui.showStory(story, ago(story.publishedAt));

    let view = await ui.askView();
    if (!view) {
        console.log(ui.colour.dim('\n  Skipped. Nothing posted, nothing recorded.\n'));
        return;
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

        // Recorded if either platform took it. Re-offering a story already
        // live on LinkedIn because X failed would be worse than losing the
        // X post - the failed draft is saved for a manual retry instead.
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
