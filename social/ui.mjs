// Everything the operator sees and types.
//
// Kept apart from the pipeline so that swapping this console for a phone
// notification later touches one file. The functions are all async and all
// return plain values; nothing else knows how the answer was obtained.

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { spawn } from 'node:child_process';

const rl = () => createInterface({ input: stdin, output: stdout });

const c = {
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    wine: (s) => `\x1b[38;5;131m${s}\x1b[0m`,
    grey: (s) => `\x1b[90m${s}\x1b[0m`
};

export const rule = (label = '') =>
    console.log(c.grey('─'.repeat(3) + (label ? ` ${label} ` : '') + '─'.repeat(Math.max(0, 68 - label.length))));

// Best effort. The console window the scheduled task opens is the real
// notification; this is only so it is noticeable when it is behind something.
// Uses the WinRT toast API directly rather than a PowerShell module, so there
// is nothing to install. Any failure is ignored on purpose.
export function notify(title, body) {
    if (process.platform !== 'win32') return;
    const ps = `
$ErrorActionPreference='SilentlyContinue'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime] | Out-Null
$t=[Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$n=$t.GetElementsByTagName('text')
$n.Item(0).AppendChild($t.CreateTextNode(@'
${title.replace(/'/g, "''")}
'@)) | Out-Null
$n.Item(1).AppendChild($t.CreateTextNode(@'
${body.replace(/'/g, "''")}
'@)) | Out-Null
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('AgentinFlow Social').Show([Windows.UI.Notifications.ToastNotification]::new($t))
`;
    try {
        const p = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
            stdio: 'ignore',
            detached: true
        });
        p.on('error', () => {});
        p.unref();
    } catch {
        /* the console window is enough */
    }
}

// Header shown once at the top of a run: what is connected, what model is
// drafting, and every command available. Printed rather than remembered -
// this runs three times a week and nobody memorises a tool they touch that
// rarely.
export function banner({ connections, model }) {
    console.log('');
    console.log('  ' + c.wine('AgentinFlow') + c.dim(' · social'));
    const line = connections
        .map((x) => (x.connected ? `${x.label} ${c.dim('connected')}` : `${x.label} ${c.wine('not connected')}`))
        .join(c.dim('  ·  '));
    console.log('  ' + line + c.dim(`  ·  ${model}`));
    console.log('');
}

const COMMANDS = [
    ['at the story', ''],
    ['  type anything', 'your view - this becomes the post'],
    ['  /n', 'next story'],
    ['  /l', 'numbered shortlist'],
    ['  /o', 'open the article in a browser'],
    ['  /d', 'open the discussion thread'],
    ['  /h', 'this help'],
    ['  /q', 'quit'],
    ['at the drafts', ''],
    ['  p', 'post it'],
    ['  r', 'regenerate from the same view'],
    ['  e', 'rewrite your view'],
    ['  s', 'skip, nothing recorded']
];

export function help() {
    console.log('');
    rule('commands');
    for (const [cmd, desc] of COMMANDS) {
        if (!desc) console.log('  ' + c.bold(cmd));
        else console.log('  ' + c.bold(cmd.padEnd(16)) + c.dim(desc));
    }
    console.log('');
}

export function openUrl(url) {
    if (!url) return;
    try {
        if (process.platform === 'win32') {
            spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
        } else {
            spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], {
                detached: true, stdio: 'ignore'
            }).unref();
        }
        console.log(c.dim(`  opening ${url}`));
    } catch {
        console.log(c.dim(`  could not open a browser - ${url}`));
    }
}

export function showStory(story, ago) {
    console.log('');
    rule('story');
    console.log('  ' + c.bold(story.title));
    console.log('  ' + c.dim(`${story.source} · ${story.points} points · ${ago}`));
    console.log('  ' + c.wine(story.url));
    if (story.summary) console.log('  ' + c.dim(story.summary.slice(0, 180)));
    console.log('');
}

// Returns { action, text }.
//   view  - they typed an opinion, text holds it
//   next  - not interested, show the following story
//   list  - show the shortlist and choose
//   quit  - done for now
//
// Slash prefixes rather than bare letters, so a one-word opinion is never
// mistaken for a command.
export async function askView({ remaining = 0 } = {}) {
    console.log(c.bold('  What do you think about this?'));
    console.log(c.dim(
        `  ${c.bold('/o')} read it` +
        (remaining ? `   ${c.bold('/n')} next (${remaining} left)` : '') +
        `   ${c.bold('/l')} list   ${c.bold('/d')} discussion   ${c.bold('/h')} help   ${c.bold('/q')} quit\n`
    ));
    const io = rl();
    const answer = (await io.question('  > ')).trim();
    io.close();

    if (!answer || /^\/q(uit)?$/i.test(answer)) return { action: 'quit' };
    if (/^\/n(ext)?$/i.test(answer)) return { action: 'next' };
    if (/^\/l(ist)?$/i.test(answer)) return { action: 'list' };
    if (/^\/o(pen)?$/i.test(answer)) return { action: 'open' };
    if (/^\/d(iscussion)?$/i.test(answer)) return { action: 'discussion' };
    if (/^\/h(elp)?|^\/\?$/i.test(answer)) return { action: 'help' };
    return { action: 'view', text: answer };
}

// Numbered shortlist. Returns an index into the array, or null to go back.
export async function chooseFrom(stories, ago) {
    console.log('');
    rule('shortlist');
    stories.slice(0, 10).forEach((s, i) => {
        console.log(`  ${String(i + 1).padStart(2)}. ${c.bold(s.title.slice(0, 62))}`);
        console.log(c.dim(`      ${s.source} · ${s.points}pts · ${ago(s.publishedAt)} · score ${s.score.total}`));
    });
    console.log('');
    const io = rl();
    const answer = (await io.question('  number, or blank to go back  > ')).trim();
    io.close();
    const n = Number(answer);
    if (!Number.isInteger(n) || n < 1 || n > Math.min(10, stories.length)) return null;
    return n - 1;
}

export function showDrafts(drafts) {
    console.log('');
    rule('linkedin');
    console.log(drafts.linkedin.split('\n').map((l) => '  ' + l).join('\n'));
    console.log('');
    rule(`x  (${drafts.x.length}/280)`);
    console.log('  ' + drafts.x.replace(/\n/g, '\n  '));
    console.log('');
    if (drafts.problems?.length) {
        console.log(c.wine('  ! ' + drafts.problems.join('\n  ! ')));
        console.log('');
    }
}

// Returns one of: post | regenerate | edit | skip
export async function reviewAction() {
    const io = rl();
    const answer = await io.question(
        c.bold('  [p]') + 'ost   ' + c.bold('[r]') + 'egenerate   ' +
        c.bold('[e]') + 'dit view   ' + c.bold('[s]') + 'kip   > '
    );
    io.close();
    const k = answer.trim().toLowerCase()[0];
    return { p: 'post', r: 'regenerate', e: 'edit', s: 'skip' }[k] || 'skip';
}

export async function confirm(question) {
    const io = rl();
    const answer = await io.question(`  ${question} [y/N] `);
    io.close();
    return /^y/i.test(answer.trim());
}

// Windows Task Scheduler closes the console the instant the process exits,
// which would take any error message with it.
export async function holdOpen() {
    if (!stdin.isTTY) return;
    const io = rl();
    await io.question(c.dim('\n  Press Enter to close. '));
    io.close();
}

export const colour = c;
