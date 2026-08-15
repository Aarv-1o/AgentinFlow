// One-time connection for each platform, and the way to check what is
// currently connected.
//
//   node social/setup.mjs            what is connected, and what is missing
//   node social/setup.mjs x          connect X
//   node social/setup.mjs linkedin   connect the LinkedIn company page
//
// Re-running for a platform replaces its stored token, which is also how you
// recover when LinkedIn's 60-day access token lapses.

import { authorize, status, PROVIDERS } from './auth/oauth.mjs';
import { config, envPath } from './config.mjs';
import { colour as c } from './ui.mjs';

const target = process.argv[2];

function missingCreds(provider) {
    const creds = config[provider];
    const missing = [];
    if (!creds.clientId) missing.push(`${provider.toUpperCase()}_CLIENT_ID`);
    if (!creds.clientSecret) missing.push(`${provider.toUpperCase()}_CLIENT_SECRET`);
    if (provider === 'linkedin' && !creds.orgId) missing.push('LINKEDIN_ORG_ID');
    return missing;
}

async function showStatus() {
    console.log('');
    for (const s of await status()) {
        const creds = missingCreds(s.provider);
        console.log(`  ${c.bold(s.label)}`);
        if (creds.length) {
            console.log(`    ${c.wine('missing in ' + envPath)}: ${creds.join(', ')}`);
        }
        if (!s.connected) {
            console.log(`    not connected — ${c.dim(`node social/setup.mjs ${s.provider}`)}`);
        } else {
            console.log(`    connected · expires ${s.expiresAt}`);
            console.log(`    refresh token: ${s.canRefresh ? 'yes' : c.wine('no — will need reconnecting by hand')}`);
            console.log(`    scope: ${c.dim(s.scope || 'not reported')}`);
        }
        console.log(`    redirect URI to register: ${c.dim(config[s.provider].redirectUri)}`);
        console.log('');
    }
}

async function main() {
    if (!target) return showStatus();

    if (!PROVIDERS[target]) {
        console.error(`\n  Unknown platform "${target}". Try: ${Object.keys(PROVIDERS).join(', ')}\n`);
        process.exit(1);
    }

    const missing = missingCreds(target);
    if (missing.length) {
        console.error(`\n  Add these to ${envPath} first:\n    ${missing.join('\n    ')}\n`);
        process.exit(1);
    }

    const entry = await authorize(target);
    console.log(`\n  ${PROVIDERS[target].label} connected.`);
    console.log(`  expires: ${entry.expiresAt ? new Date(entry.expiresAt).toISOString() : 'not stated'}`);
    if (!entry.refreshToken) {
        console.log(c.wine('  No refresh token was issued — this will need reconnecting by hand when it lapses.'));
    }
    console.log('');
}

main().catch((err) => {
    console.error(c.wine(`\n  ${err.message}\n`));
    process.exit(1);
});
