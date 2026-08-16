// Publish to X.
//
// POST https://api.x.com/2/tweets with a user-context bearer token and a body
// of { text }. That is the whole API surface this needs.

import { accessToken } from '../auth/oauth.mjs';
import { config } from '../config.mjs';

export async function publish(text) {
    if (text.length > config.limits.xMaxChars) {
        // Checked again here, not just at draft time: an edited draft can
        // arrive over the limit and a 403 from X is far less clear than this.
        throw new Error(`Post is ${text.length} chars, X allows ${config.limits.xMaxChars}`);
    }

    const token = await accessToken('x');

    const res = await fetch('https://api.x.com/2/tweets', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
    });

    const body = await res.text();
    if (!res.ok) throw new Error(`X ${res.status}: ${body.slice(0, 400)}`);

    const data = JSON.parse(body);
    const id = data?.data?.id;
    return {
        platform: 'X',
        id,
        // X does not return a permalink, and the handle is not in the response
        // either - the i/web form redirects to the canonical URL.
        url: id ? `https://x.com/i/web/status/${id}` : null
    };
}
