// Turn a pile of stories into the one worth asking about.
//
// Scoring is intentionally simple and readable. The goal is not the
// "best" story by some objective measure - it is a story recent enough to
// be news, popular enough to be real, and close enough to what AgentinFlow
// does that there is something to say about it. A story we have no standing
// to comment on produces a post that reads as filler no matter how well the
// view is written.

export const MAX_AGE_HOURS = 48;

// Topics the agency can speak to with authority. Topic scope is general tech
// news, so this is a nudge, not a gate - an unrelated big story still wins on
// engagement, it just has to clear a higher bar.
const AFFINITY = [
    { re: /\b(ai|llm|gpt|claude|model|agent|ml|machine learning)\b/i, w: 12 },
    { re: /\b(automation|workflow|n8n|zapier|integration|pipeline)\b/i, w: 12 },
    { re: /\b(web|frontend|browser|css|javascript|typescript|react|astro)\b/i, w: 8 },
    { re: /\b(startup|founder|saas|indie|bootstrap)\b/i, w: 6 },
    { re: /\b(api|developer|open source|self-host|database)\b/i, w: 5 }
];

// Recurring genres that read badly coming from an agency account.
const PENALTY = [
    { re: /\b(layoff|fired|lawsuit|sues|acquisition rumou?r)\b/i, w: -14 },
    { re: /\b(crypto|nft|web3|token|blockchain)\b/i, w: -10 },
    { re: /\b(show hn|ask hn)\b/i, w: -30 }
];

const hoursSince = (iso) => (Date.now() - new Date(iso).getTime()) / 36e5;

// Strip the parts of a URL that vary without changing the article, so the
// same story arriving from two sources dedupes to one entry.
export function canonical(url) {
    try {
        const u = new URL(url);
        u.hash = '';
        u.hostname = u.hostname.replace(/^www\./, '').toLowerCase();
        for (const k of [...u.searchParams.keys()]) {
            if (/^(utm_|ref|source|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
        }
        u.pathname = u.pathname.replace(/\/+$/, '') || '/';
        return u.toString();
    } catch {
        return url;
    }
}

export function score(story) {
    const age = hoursSince(story.publishedAt);
    const parts = {};

    // Fresh matters more than popular: a 40-hour-old story is stale to post on
    // even if it did well.
    parts.recency = Math.max(0, 30 * (1 - age / MAX_AGE_HOURS));

    // Log, not linear - a 900-point story is not 9x more postable than a 100.
    parts.engagement = Math.min(30, Math.log10(1 + story.points) * 14);
    parts.discussion = Math.min(10, Math.log10(1 + story.comments) * 5);

    const text = `${story.title} ${story.summary}`;
    parts.affinity = AFFINITY.reduce((n, a) => n + (a.re.test(text) ? a.w : 0), 0);
    parts.penalty = PENALTY.reduce((n, p) => n + (p.re.test(text) ? p.w : 0), 0);

    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    return { total: Math.round(total * 10) / 10, parts };
}

export function selectStory(stories, seen = new Set()) {
    const byUrl = new Map();

    for (const s of stories) {
        const key = canonical(s.url);
        if (seen.has(key)) continue;
        if (hoursSince(s.publishedAt) > MAX_AGE_HOURS) continue;

        // Same story from two sources: keep whichever scored higher.
        const scored = { ...s, canonical: key, score: score(s) };
        const prev = byUrl.get(key);
        if (!prev || scored.score.total > prev.score.total) byUrl.set(key, scored);
    }

    return [...byUrl.values()].sort((a, b) => b.score.total - a.score.total);
}
