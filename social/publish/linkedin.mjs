// Publish to a LinkedIn company page.
//
// POST https://api.linkedin.com/rest/posts, which replaced the old ugcPosts
// API. Three headers are mandatory and the call fails confusingly without
// them: the bearer token, X-Restli-Protocol-Version, and Linkedin-Version in
// YYYYMM form. LinkedIn sunsets versions - 202507 is already dead - so that
// value is configurable rather than baked in.
//
// The new post's URN comes back in the x-restli-id response header, not the
// body. The body is empty on 201.

import { accessToken } from '../auth/oauth.mjs';
import { config } from '../config.mjs';

// LinkedIn's commentary field is "little text format", where a handful of
// characters carry meaning - @[Name](urn:...) is a mention, and brackets are
// how it is delimited. Unescaped prose punctuation can therefore be eaten.
//
// URLs are skipped: escaping inside a link breaks the link, and these
// characters are rare in the URLs we post.
const RESERVED = /([\\(){}\[\]<>@|])/g;

export function escapeCommentary(text) {
    return text
        .split(/(\s+)/)
        .map((tok) => (/^https?:\/\//i.test(tok) ? tok : tok.replace(RESERVED, '\\$1')))
        .join('');
}

export async function publish(text) {
    const org = config.linkedin.orgId;
    if (!org) throw new Error('LINKEDIN_ORG_ID is not set in social/.env');

    const token = await accessToken('linkedin');

    const res = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'Linkedin-Version': config.linkedin.version,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            author: `urn:li:organization:${org}`,
            commentary: escapeCommentary(text),
            visibility: 'PUBLIC',
            distribution: {
                feedDistribution: 'MAIN_FEED',
                targetEntities: [],
                thirdPartyDistributionChannels: []
            },
            lifecycleState: 'PUBLISHED',
            isReshareDisabledByAuthor: false
        })
    });

    if (res.status !== 201) {
        const body = await res.text();
        // 403 here almost always means the page role or the scope, not the
        // token - worth saying so rather than printing a bare status.
        const hint = res.status === 403
            ? ' (check w_organization_social is granted and the account has an admin role on the page)'
            : '';
        throw new Error(`LinkedIn ${res.status}${hint}: ${body.slice(0, 400)}`);
    }

    const urn = res.headers.get('x-restli-id');
    return {
        platform: 'LinkedIn',
        id: urn,
        url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : null
    };
}
