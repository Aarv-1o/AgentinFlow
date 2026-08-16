// One-time connection for each platform, and the way to check what is
// currently connected.
//
//   node social/setup.mjs                    what is connected, what is missing
//   node social/setup.mjs x                  connect X (browser flow)
//   node social/setup.mjs linkedin           connect LinkedIn (browser flow, needs HTTPS)
//   node social/setup.mjs linkedin --token   paste a token instead
//
// Re-running for a platform replaces its stored token, which is also how you
// recover when LinkedIn's 60-day access token lapses - and it will, because
// LinkedIn issues refresh tokens only to approved partners.

import { createInterface } from 'node:readline/promises';
import { authorize, status, PROVIDERS, saveManualToken } from './auth/oauth.mjs';
import { config, envPath } from './config.mjs';
import { colour as c } from './ui.mjs';

const target = process.argv[2];
const MANUAL = process.argv.includes('--token');

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
        if (PROVIDERS[s.provider].requiresHttps) {
            console.log(c.dim('    LinkedIn registers HTTPS callbacks only —'));
            console.log(c.dim(`    easiest path: node social/setup.mjs ${s.provider} --token`));
        } else {
            console.log(`    redirect URI to register: ${c.dim(config[s.provider].redirectUri)}`);
        }
        console.log('');
    }
}

async function main() {
    if (!target) return showStatus();

    if (!PROVIDERS[target]) {
        console.error(`\n  Unknown platform "${target}". Try: ${Object.keys(PROVIDERS).join(', ')}\n`);
        process.exit(1);
    }

    // LinkedIn refuses to register an http:// callback, so the browser flow
    // needs a tunnel. Pasting a token from their own generator is quicker,
    // and for a one-operator tool loses nothing.
    if (MANUAL) {
        console.log('\n  Paste an access token from');
        console.log(c.dim('  https://www.linkedin.com/developers/tools/oauth/token-generator\n'));
        const io = createInterface({ input: process.stdin, output: process.stdout });
        const token = (await io.question('  token > ')).trim();
        io.close();
        if (!token) {
            console.error(c.wine('\n  Nothing pasted.\n'));
            process.exit(1);
        }
        const entry = await saveManualToken(target, token);
        console.log(`\n  ${PROVIDERS[target].label} token stored.`);
        console.log(`  assumed to expire ${new Date(entry.expiresAt).toDateString()} ${c.dim('(LinkedIn issues 60 days)')}`);
        console.log(c.wine('  No refresh token — rerun this before it lapses.\n'));
        return;
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
