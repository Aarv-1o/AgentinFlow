// Story sources. JSON APIs only, deliberately - an RSS reader means either a
// dependency or a regex over XML, and both cost more than they return while
// Hacker News and dev.to already cover general tech news.
//
// Everything is normalised to one shape so scoring does not care where a
// story came from:
//   { id, title, url, source, points, comments, publishedAt, summary }

const UA = 'AgentinFlow-social/1.0 (+https://www.agentinflow.com)';

async function getJSON(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    return res.json();
}

// Algolia's HN index rather than the Firebase API: one request returns the
// front page already populated, where Firebase needs 1 + N.
async function hackerNews() {
    const data = await getJSON('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30');
    return (data.hits || [])
        // Ask HN and Show HN threads have no external link to comment on.
        .filter((h) => h.url)
        .map((h) => ({
            id: `hn:${h.objectID}`,
            title: h.title,
            url: h.url,
            source: 'Hacker News',
            points: h.points || 0,
            comments: h.num_comments || 0,
            publishedAt: h.created_at,
            summary: '',
            discussion: `https://news.ycombinator.com/item?id=${h.objectID}`
        }));
}

async function devTo() {
    const data = await getJSON('https://dev.to/api/articles?per_page=30&top=2');
    return (data || []).map((a) => ({
        id: `devto:${a.id}`,
        title: a.title,
        url: a.url,
        source: 'dev.to',
        points: a.public_reactions_count || 0,
        comments: a.comments_count || 0,
        publishedAt: a.published_at,
        summary: a.description || '',
        discussion: a.url
    }));
}

// One source failing must not take the run down - a story from the other is
// still a usable run, and a silent partial is better than no post at all.
export async function fetchAll() {
    const results = await Promise.allSettled([hackerNews(), devTo()]);
    const stories = [];
    const failures = [];

    for (const [i, r] of results.entries()) {
        const name = ['Hacker News', 'dev.to'][i];
        if (r.status === 'fulfilled') stories.push(...r.value);
        else failures.push(`${name}: ${r.reason.message}`);
    }

    return { stories, failures };
}
