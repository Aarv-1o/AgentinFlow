// Find the numeric id of a company page you administer.
//
//   node social/lookup-org.mjs
//
// LINKEDIN_ORG_ID has to be the number, not the vanity name, and the number
// is not shown anywhere obvious in the LinkedIn UI. This asks the API for
// every organisation the connected account has a role on.
//
// Needs r_organization_admin on the token. If that scope was not granted,
// the call 403s and the id has to be found by hand - see the message below.

import { accessToken } from './auth/oauth.mjs';
import { config } from './config.mjs';
import { colour as c } from './ui.mjs';

async function main() {
    const token = await accessToken('linkedin');

    const url = 'https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&state=APPROVED';
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'Linkedin-Version': config.linkedin.version
        }
    });

    const body = await res.text();

    if (res.status === 403) {
        console.log(c.wine('\n  403 — the token does not carry r_organization_admin.\n'));
        console.log('  Find the id by hand instead:');
        console.log('    1. Open your company page while signed in as an admin');
        console.log('    2. View source and search for "organizationalPage:" or "fsd_company:"');
        console.log('    3. The number after it is the id\n');
        console.log(c.dim('  Then set LINKEDIN_ORG_ID in social/.env\n'));
        return;
    }

    if (!res.ok) throw new Error(`LinkedIn ${res.status}: ${body.slice(0, 300)}`);

    const data = JSON.parse(body);
    const rows = data.elements || [];

    if (!rows.length) {
        console.log(c.wine('\n  No organisations found for this account.'));
        console.log('  The signed-in member needs an admin role on the page.\n');
        return;
    }

    console.log('');
    for (const r of rows) {
        // The field is organizationTarget in some responses, organization in
        // others - the docs show both.
        const urn = r.organizationTarget || r.organization || '';
        const id = urn.split(':').pop();
        console.log(`  ${c.bold(id)}   ${c.dim(`${r.role} · ${r.state}`)}`);
    }
    console.log(c.dim('\n  Put the id in social/.env as LINKEDIN_ORG_ID\n'));
}

main().catch((err) => {
    console.error(c.wine(`\n  ${err.message}\n`));
    process.exit(1);
});
