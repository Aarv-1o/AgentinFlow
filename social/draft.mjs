// Turn (story + your view) into two posts.
//
// The provider lives behind one function. Swapping OpenAI for anything else
// with a chat-completions shape means editing `callModel` and nothing else.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// Read at call time, not at import: editing voice.md then re-running should
// take effect without restarting anything.
const voice = () => readFileSync(join(HERE, 'voice.md'), 'utf8');

async function callModel(messages) {
    const res = await fetch(`${config.openai.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.openai.key}`
        },
        body: JSON.stringify({
            model: config.openai.model,
            messages,
            // Enough spread to sound human, not enough to wander off the view.
            temperature: 0.75,
            response_format: { type: 'json_object' }
        })
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('OpenAI returned no content');
    return text;
}

function userPrompt(story, view) {
    return [
        'STORY',
        `Headline: ${story.title}`,
        `Source: ${story.source}`,
        `Link: ${story.url}`,
        story.summary ? `Summary: ${story.summary}` : null,
        '',
        'OUR VIEW (the operator wrote this — it is the point of the post)',
        view,
        '',
        'Return JSON exactly: { "linkedin": "...", "x": "..." }',
        'Use real newlines inside the strings, one sentence per line for LinkedIn.'
    ].filter(Boolean).join('\n');
}

// The model is told the limits, but told is not the same as did.
function validate(drafts) {
    const problems = [];
    if (!drafts.linkedin?.trim()) problems.push('linkedin is empty');
    if (!drafts.x?.trim()) problems.push('x is empty');

    if (drafts.x && drafts.x.length > config.limits.xMaxChars) {
        problems.push(`x is ${drafts.x.length} chars, limit is ${config.limits.xMaxChars}`);
    }
    if (drafts.linkedin && drafts.linkedin.length > config.limits.linkedinMaxChars) {
        problems.push(`linkedin is ${drafts.linkedin.length} chars, limit is ${config.limits.linkedinMaxChars}`);
    }
    // The one-sentence-per-line rule is the house style; a single wall of text
    // means it was ignored.
    if (drafts.linkedin && drafts.linkedin.split('\n').filter((l) => l.trim()).length < 4) {
        problems.push('linkedin is not broken one sentence per line');
    }
    return problems;
}

export async function draft(story, view, { onRetry } = {}) {
    const messages = [
        { role: 'system', content: voice() },
        { role: 'user', content: userPrompt(story, view) }
    ];

    // Two attempts. The second is given the specific failures rather than
    // being asked again and hoped over.
    for (let attempt = 1; attempt <= 2; attempt++) {
        const raw = await callModel(messages);

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            if (attempt === 2) throw new Error('Model did not return valid JSON twice');
            onRetry?.('malformed JSON');
            messages.push({ role: 'assistant', content: raw });
            messages.push({ role: 'user', content: 'That was not valid JSON. Return only the JSON object.' });
            continue;
        }

        const problems = validate(parsed);
        if (!problems.length) return { linkedin: parsed.linkedin.trim(), x: parsed.x.trim() };

        if (attempt === 2) {
            // Hand back the flawed draft rather than failing the run - the
            // review loop can still show it and let a human fix it.
            return {
                linkedin: (parsed.linkedin || '').trim(),
                x: (parsed.x || '').trim(),
                problems
            };
        }

        onRetry?.(problems.join('; '));
        messages.push({ role: 'assistant', content: raw });
        messages.push({
            role: 'user',
            content: `Fix these and return the JSON again: ${problems.join('; ')}.`
        });
    }
}
