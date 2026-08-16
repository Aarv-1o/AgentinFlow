// Config and secrets.
//
// Reads social/.env by hand rather than requiring `node --env-file`, so the
// scheduled task can invoke `node social/run.mjs` with no flags and nothing
// silently loses its keys when the task is edited later.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = join(HERE, '.env');

if (existsSync(ENV_FILE)) {
    for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
        if (!m) continue;
        // A real environment variable always wins, so a one-off override on
        // the command line does not need the file edited.
        if (process.env[m[1]] !== undefined) continue;
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
}

export const config = {
    openai: {
        key: process.env.OPENAI_API_KEY || '',
        // Small, current, and fast enough that the wait between typing a view
        // and seeing drafts is a couple of seconds. Overridable because model
        // names move faster than this script will.
        model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    },
    // Both redirect URIs must be registered byte-for-byte in the respective
    // developer app, or the authorise call is rejected before it starts.
    x: {
        clientId: process.env.X_CLIENT_ID || '',
        clientSecret: process.env.X_CLIENT_SECRET || '',
        redirectUri: process.env.X_REDIRECT_URI || 'http://localhost:8721/callback'
    },
    linkedin: {
        clientId: process.env.LINKEDIN_CLIENT_ID || '',
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
        redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:8722/callback',
        // The numeric id of the company page, not its vanity name.
        orgId: process.env.LINKEDIN_ORG_ID || '',
        // YYYYMM. LinkedIn sunsets versions on a rolling basis - 202507 is
        // already dead - so this needs bumping periodically.
        version: process.env.LINKEDIN_VERSION || '202607'
    },

    limits: {
        // X's hard ceiling. Enforced before sending, not discovered from a 403.
        xMaxChars: Number(process.env.X_MAX_CHARS || 280),
        linkedinMaxChars: Number(process.env.LINKEDIN_MAX_CHARS || 2800)
    }
};

export function requireOpenAI() {
    if (!config.openai.key) {
        console.error(
            '\nOPENAI_API_KEY is not set.\n' +
            `Create ${ENV_FILE} with:\n\n` +
            '  OPENAI_API_KEY=sk-...\n' +
            '  # optional\n' +
            '  OPENAI_MODEL=gpt-4o-mini\n'
        );
        process.exit(1);
    }
}

export const envPath = ENV_FILE;
