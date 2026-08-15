// OAuth for both platforms, and the token store.
//
// Both flows are "open a browser, catch the redirect on localhost, swap the
// code for a token". The differences are small enough to live in a config
// object rather than two near-identical files:
//
//   X         OAuth 2.0 + PKCE, confidential client (basic auth on token)
//   LinkedIn  OAuth 2.0, client_secret in the body, no PKCE
//
// Tokens are written to social/state/tokens.json, which is gitignored. That
// file is a credential - anyone holding it can post as you.

import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS = join(HERE, '..', 'state', 'tokens.json');

// Refresh this far before actual expiry, so a token cannot lapse between the
// check and the post.
const EXPIRY_SKEW_MS = 5 * 60 * 1000;

export const PROVIDERS = {
    x: {
        label: 'X',
        authUrl: 'https://x.com/i/oauth2/authorize',
        tokenUrl: 'https://api.x.com/2/oauth2/token',
        // offline.access is what yields a refresh token; without it the
        // connection dies in a couple of hours.
        scope: 'tweet.write tweet.read users.read offline.access',
        pkce: true,
        // X wants the client credentials as HTTP basic auth on the token call.
        tokenAuth: 'basic'
    },
    linkedin: {
        label: 'LinkedIn',
        authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
        tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        scope: 'w_organization_social',
        pkce: false,
        tokenAuth: 'body'
    }
};

// --- token store -----------------------------------------------------------

async function readStore() {
    try {
        return JSON.parse(await readFile(TOKENS, 'utf8'));
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw err;
    }
}

async function writeStore(store) {
    await mkdir(dirname(TOKENS), { recursive: true });
    await writeFile(TOKENS, JSON.stringify(store, null, 2) + '\n', { mode: 0o600 });
}

function record(raw) {
    return {
        accessToken: raw.access_token,
        refreshToken: raw.refresh_token || null,
        // expires_in is seconds from now; store the absolute moment so a
        // long gap between runs is handled correctly.
        expiresAt: raw.expires_in ? Date.now() + raw.expires_in * 1000 : null,
        scope: raw.scope || null,
        obtainedAt: new Date().toISOString()
    };
}

// --- the browser round trip ------------------------------------------------

const b64url = (buf) => buf.toString('base64url');

function openBrowser(url) {
    try {
        if (process.platform === 'win32') {
            // The empty string is the window title; without it, a URL
            // containing & is parsed as the title and the browser never opens.
            spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
        } else if (process.platform === 'darwin') {
            spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
        } else {
            spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
        }
    } catch {
        /* the URL is printed too - the operator can paste it */
    }
}

// Serve exactly one request, then shut down.
function catchRedirect(port, path) {
    return new Promise((resolve, reject) => {
        const server = createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${port}`);
            if (url.pathname !== path) {
                res.writeHead(404).end();
                return;
            }
            const params = Object.fromEntries(url.searchParams);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(
                `<body style="font:16px system-ui;background:#121212;color:#c3cacf;padding:3rem">` +
                (params.error
                    ? `<h1 style="color:#8e2039">Authorisation failed</h1><p>${params.error_description || params.error}</p>`
                    : `<h1 style="color:#8e2039">Connected</h1><p>You can close this tab and go back to the terminal.</p>`) +
                `</body>`
            );
            server.close();
            params.error ? reject(new Error(params.error_description || params.error)) : resolve(params);
        });

        server.on('error', reject);
        server.listen(port);
        // Do not hang forever if the browser never comes back.
        setTimeout(() => {
            server.close();
            reject(new Error('Timed out waiting for the browser redirect (5 min)'));
        }, 5 * 60 * 1000).unref();
    });
}

async function exchange(provider, body) {
    const p = PROVIDERS[provider];
    const creds = config[provider];
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

    if (p.tokenAuth === 'basic') {
        headers.Authorization =
            'Basic ' + Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
    } else {
        body.client_id = creds.clientId;
        body.client_secret = creds.clientSecret;
    }

    const res = await fetch(p.tokenUrl, {
        method: 'POST',
        headers,
        body: new URLSearchParams(body)
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`${p.label} token exchange ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
}

export async function authorize(provider) {
    const p = PROVIDERS[provider];
    const creds = config[provider];
    if (!creds.clientId) throw new Error(`${p.label}: client ID is not set in social/.env`);

    const redirect = new URL(creds.redirectUri);
    const state = b64url(randomBytes(16));

    const params = {
        response_type: 'code',
        client_id: creds.clientId,
        redirect_uri: creds.redirectUri,
        scope: p.scope,
        state
    };

    let verifier;
    if (p.pkce) {
        verifier = b64url(randomBytes(32));
        params.code_challenge = b64url(createHash('sha256').update(verifier).digest());
        params.code_challenge_method = 'S256';
    }

    const authUrl = `${p.authUrl}?${new URLSearchParams(params)}`;
    console.log(`\n  Opening ${p.label} in your browser.`);
    console.log(`  If it does not open, paste this:\n\n  ${authUrl}\n`);

    const waiting = catchRedirect(Number(redirect.port), redirect.pathname);
    openBrowser(authUrl);
    const back = await waiting;

    // Guards against a redirect being replayed or forged.
    if (back.state !== state) throw new Error('State mismatch on the OAuth redirect');

    const raw = await exchange(provider, {
        grant_type: 'authorization_code',
        code: back.code,
        redirect_uri: creds.redirectUri,
        ...(verifier ? { code_verifier: verifier } : {})
    });

    const store = await readStore();
    store[provider] = record(raw);
    await writeStore(store);
    return store[provider];
}

async function refresh(provider, entry) {
    const raw = await exchange(provider, {
        grant_type: 'refresh_token',
        refresh_token: entry.refreshToken
    });
    const store = await readStore();
    // A refresh response may or may not include a new refresh token; keeping
    // the old one when it does not is the difference between this working
    // next month and silently dying.
    store[provider] = { ...record(raw), refreshToken: raw.refresh_token || entry.refreshToken };
    await writeStore(store);
    return store[provider];
}

export async function accessToken(provider) {
    const store = await readStore();
    const entry = store[provider];
    if (!entry) throw new Error(`${PROVIDERS[provider].label} is not connected. Run: node social/setup.mjs ${provider}`);

    const expiring = entry.expiresAt && entry.expiresAt - Date.now() < EXPIRY_SKEW_MS;
    if (!expiring) return entry.accessToken;

    if (!entry.refreshToken) {
        throw new Error(
            `${PROVIDERS[provider].label} token has expired and there is no refresh token. ` +
            `Reconnect with: node social/setup.mjs ${provider}`
        );
    }
    return (await refresh(provider, entry)).accessToken;
}

export async function status() {
    const store = await readStore();
    return Object.entries(PROVIDERS).map(([key, p]) => {
        const e = store[key];
        if (!e) return { provider: key, label: p.label, connected: false };
        return {
            provider: key,
            label: p.label,
            connected: true,
            expiresAt: e.expiresAt ? new Date(e.expiresAt).toISOString() : 'no expiry given',
            canRefresh: Boolean(e.refreshToken),
            scope: e.scope
        };
    });
}
