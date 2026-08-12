# AgentinFlow — Implementation Plan

**Created:** 2026-08-12
**Status:** Awaiting inputs (see [Blocked On](#blocked-on)) — no code written yet

---

## Decisions locked

| Question | Decision |
|---|---|
| Hosting | Vercel |
| Framework | **Astro** (migrate from plain static) |
| Order of work | **Phase 1 email → Phase 2 redesign → Phase 3 social** |
| Social publishing rail | **Deferred** — to be discussed before Phase 3 |

---

## Current state

Plain static site, no build step, no backend.

```
agentinflow/
├── index.html          226 lines   home (hero, reviews, services, benefits, contact)
├── style.css           628 lines
├── script.js           136 lines   reviews render + EmailJS contact form
├── service/            404 + 758 + 130 lines
├── aboutus/            206 + 596 + 130 lines
├── img/                logo ×2, founder photos ×2
├── sitemap.xml, robots.txt, googlec80824fd69824385.html (Search Console)
```

**Problems with the current structure**

- CSS is duplicated three times (~1,980 lines total) with no shared tokens. A palette change means editing three files.
- Nav and footer are copy-pasted per page; the "active" link state is hand-maintained.
- The Search Console verification file is duplicated into every folder (two of the three copies are empty, i.e. broken).
- Design: pure `#000` background, `#E43636` red, `#E2DDB4` cream, system font stack. No scroll animations, no motion design, no portfolio section.
- EmailJS public key is inline in client JS — anyone can burn the free-tier quota.

---

## Phase 1 — Contact form email

Goal: every submission reliably reaches `aarvsinghchauhan@gmail.com`, the sender gets an acknowledgement, and the UI states the true outcome.

### Root cause analysis

Three independent bugs. Only one is in the JS.

**1.1 — "A message by ___ has been received" (name missing)**
The EmailJS *template* references a variable the code never sends. Code sends `from_name`
([script.js:113](agentinflow/script.js#L113)); the template body almost certainly uses `{{name}}` or
`{{user_name}}`. Unknown variables render as empty string, hence the gap in the sentence. The
message body renders correctly only because `message` happens to match on both sides.
→ **Fix location: EmailJS dashboard template, not code.**

**1.2 — Mail arrives "from aarvsinghchauhan@gmail.com"**
Working as designed. EmailJS's Gmail service always sends *as* the connected Gmail account; it
cannot spoof the visitor's address (SPF/DKIM would reject it). The actual problem is that hitting
Reply goes back to yourself instead of to the lead.
→ **Fix: set the template's Reply-To field to `{{from_email}}`.**

**1.3 — No confirmation of success/failure**
Two gaps:
- The visitor receives nothing at all — there is no auto-reply template.
- Failures are surfaced via a browser `alert()` ([script.js:130](agentinflow/script.js#L130)), and
  `response.ok` is checked without reading the response body, so soft failures can render as success.

### Work items

- [ ] **1.a** — Audit the live EmailJS template and align variable names end to end.
      Standardise on: `from_name`, `from_email`, `company`, `message`, `submitted_at`.
- [ ] **1.b** — Rewrite the notification template (clean HTML, all fields visible, Reply-To = `{{from_email}}`).
- [ ] **1.c** — Create a **second template: auto-reply to the visitor**. Sent to `{{from_email}}`,
      confirms receipt, restates their message, sets a response-time expectation, signs off as AgentinFlow.
- [ ] **1.d** — Rewrite the form handler:
      - inline toast/banner for success and error (no `alert()`)
      - read and surface the real EmailJS response text on failure
      - honeypot hidden field + minimum-time-on-form check for bot filtering
      - client-side validation with per-field error messages
      - button states: idle → sending → sent → reset
      - `aria-live` region so screen readers announce the outcome
- [ ] **1.e** — Fallback path: if the send fails, show a `mailto:` link pre-filled with their message
      so the lead is never silently lost.
- [ ] **1.f** — End-to-end test: submit → confirm both emails land → confirm Reply goes to the lead.

### Note on wasted work

Phase 2 replaces the client-side call with a Vercel API route. That is deliberate and cheap:
items **1.a–1.c** are dashboard work that carries over 100% unchanged, and **1.f** is a test.
Only the ~60-line handler from **1.d** gets rewritten. Fixing this now stops leads leaking
during the redesign.

### Phase 2 upgrade (deferred to the migration)

Once on Astro/Vercel, the send moves to `POST /api/contact`:
- EmailJS private key server-side, out of the browser
- Rate limiting by IP (Vercel KV or Upstash)
- Server-side validation and spam scoring
- Optional: append every lead to a Google Sheet / Notion DB as a durable backup, so a mail
  failure never means a lost lead

---

## Phase 2 — Astro migration + design overhaul

### 2.1 Migration

Target structure:

```
/
├── astro.config.mjs
├── package.json
├── public/                  img/, robots.txt, google verification (ONE copy, at root)
└── src/
    ├── layouts/BaseLayout.astro        html head, meta, nav, footer, JSON-LD
    ├── components/                     Nav, Footer, Hero, ServiceCard, ReviewMarquee,
    │                                   ProjectCard, ContactForm, StatCounter, SectionHeading
    ├── content/
    │   ├── projects/                   ← Portfolio entries as markdown, one file per project
    │   └── reviews/
    ├── pages/
    │   ├── index.astro
    │   ├── services.astro
    │   ├── about.astro
    │   ├── work.astro                  ← NEW portfolio index
    │   ├── work/[slug].astro           ← NEW per-project case study
    │   └── api/contact.ts              ← serverless send
    └── styles/tokens.css, global.css
```

Migration guarantees:
- **URLs preserved.** `/service/` and `/aboutus/` must keep working (they are in the sitemap and
  indexed by Google). Handled via `vercel.json` redirects or by keeping the directory names.
- Google Search Console verification file preserved at root; the three broken duplicates deleted.
- `sitemap.xml` generated by `@astrojs/sitemap` and extended with the new `/work/` routes.
- Astro ships **zero JS by default** — the site stays as fast as the current static one. Interactive
  bits (form, marquee, counters) are small islands or plain vanilla scripts.

### 2.2 Design system

- **Tokens**: CSS custom properties for colour, type scale, spacing, radii, shadows, easing, durations. Single source of truth.
- **Palette**: keep `#E43636` as the accent, but replace flat `#000` with layered near-blacks
  (`#08080A` → `#0F1014` → `#16171D`) so surfaces have depth. Accent used sparingly for emphasis
  rather than on every heading. Add a muted success/error pair for form states.
- **Type**: premium pairing replacing the system stack — a distinctive display face for headings
  (candidates: Satoshi, General Sans, Clash Display, Instrument Serif for contrast) with Inter or
  Geist for body. Self-hosted woff2, subset, `font-display: swap`. Fluid `clamp()` type scale.
- **Layout**: consistent max-width and vertical rhythm, proper section spacing, a real grid system.

### 2.3 Motion

All CSS-driven or IntersectionObserver — no animation library, nothing that hurts Lighthouse.

- Scroll-reveal (fade + rise) with stagger on card grids
- Animated stat counters (the `90%` block)
- Gradient mesh / aurora hero background, subtle grain overlay
- Glass nav that condenses on scroll
- Magnetic or shine-sweep hover on primary buttons
- Card hover: lift, border glow, cursor-tracked spotlight
- Seamless review marquee, pausing on hover
- Page transitions via Astro's View Transitions API
- **`prefers-reduced-motion: reduce` fully honoured throughout** — non-negotiable

### 2.4 Portfolio section ← the explicitly requested addition

- `/work` index: filterable card grid (AI Automation / n8n / Web Dev)
- `/work/[slug]`: per-project case study — problem → approach → build → result → stack
- Each project authored as a markdown file in `src/content/projects/`, so adding one later is
  writing a file, not editing HTML
- **Blocked on content from you** — see [Blocked On](#blocked-on). I will scaffold the section with
  clearly-marked placeholders so it is buildable before the real content arrives.

### 2.5 Content & SEO

- Tighten copy across all pages toward "premium, techy, concise"
- Per-page meta descriptions, Open Graph and Twitter card images
- JSON-LD: `Organization`, `LocalBusiness`, `Service`, and `Review` for the testimonials
- Fix `<link rel="icon" type="img/agentinflow.png">` — that is not a valid MIME type
- Fix broken relative favicon paths on the root page (`../img/...` from root resolves outside the site)
- Verify Lighthouse ≥95 across all four categories after the rebuild

---

## Phase 3 — Social posting automation (3×/week, LinkedIn + X)

**Publishing rail deliberately undecided.** Captured here so the discussion has a written baseline.

### The actual constraint

The hard part is not the automation — it is API access.

- **LinkedIn Company Page** posting requires a LinkedIn Developer app with the Community Management
  API and `w_organization_social`. Review typically takes **2–6 weeks** and is regularly rejected
  for vaguely-worded use cases.
- **X** free tier permits 500 writes/month (12/mo is well within it), but app setup is fiddly.
- n8n's LinkedIn node does **not** avoid this — it still consumes those same OAuth credentials.

### Options on the table

| Option | Setup time | Cost | Notes |
|---|---|---|---|
| n8n + **Postiz** (self-hosted) | Hours | Free | Open-source, sits beside your n8n, has an API, no LinkedIn app review |
| n8n + **Buffer** | Minutes | Free tier covers 3/wk | Fastest to live; external dependency |
| **Pure n8n**, direct APIs | 2–6 weeks | Free | Full dogfooding, doubles as a sales asset — "here's the workflow running our own socials" |
| Pure n8n, Buffer as interim | Minutes, then migrate | Free | Posting starts this week; direct API becomes the end state |

### Pipeline (rail-independent — this part is the same either way)

```
Cron (Mon/Wed/Fri) → fetch RSS + Hacker News + dev.to
  → filter by relevance/recency → dedupe against already-posted store
  → LLM drafts LinkedIn variant + X variant in AgentinFlow's voice
  → approval step → publish → log to store
```

Notes:
- The two platforms need genuinely different drafts, not one text cross-posted — LinkedIn rewards
  longer narrative, X rewards compression.
- Dedupe store prevents reposting the same story; Google Sheets or Postgres.
- Approval via Telegram/Slack with Approve/Reject buttons was the recommendation.
- Whichever rail is chosen, the workflow JSON is importable and version-controlled in this repo.

---

## Blocked On

Ordered by what blocks the earliest phase.

### For Phase 1 (email) — needed to start

1. **The current EmailJS template body and its variable names.**
   EmailJS dashboard → Email Templates → your template → Content. Paste the body or screenshot it.
   This is the single thing that pins down bug 1.1.
2. Confirm the destination address stays `aarvsinghchauhan@gmail.com`.
3. Whether the EmailJS account is free tier (200 emails/month) — affects whether the auto-reply
   doubles your consumption and whether rate limiting is urgent.

### For Phase 2 (migration) — needed before restructuring

4. **Vercel project settings** — specifically the Root Directory, since the site currently lives in
   an `agentinflow/` subfolder rather than the repo root. Restructuring without this breaks the deploy.
5. Confirm `/service/` and `/aboutus/` URLs must be preserved (assumed yes — they are in the sitemap).

### For Phase 2 (design) — needed before the Portfolio section is real

6. **Portfolio content.** Per project: name, client (or "Confidential"), 1–2 line problem,
   what was built, result metric, tech stack, screenshot/thumbnail. **Three projects is enough to ship.**
7. Are the five testimonials in [script.js:2-30](agentinflow/script.js#L2-L30) real or placeholder?
   Determines whether they can carry `Review` JSON-LD — fabricated reviews in structured data are a
   Google penalty risk, and real names may need permission.
8. Brand assets: logo as SVG if it exists, any brand guide, and 2–3 reference sites whose look you want.

### For Phase 3 (social) — not yet needed

9. Where n8n runs (cloud vs self-hosted — the RepoCloud lead suggests self-hosted experience).
10. LinkedIn: Company Page or personal profile.
11. X API tier.
12. Which LLM key for drafting (Anthropic recommended — you already have Claude access).
13. Final call on the publishing rail.

---

## Assumptions

Stated explicitly so they can be corrected rather than discovered later.

- Hosting is Vercel with the repo connected for auto-deploy on push to `main`.
- The domain is `www.agentinflow.com` and DNS stays untouched.
- No CMS is wanted — content lives in the repo as markdown and updates via git.
- No analytics currently installed; Vercel Analytics or Plausible can be added in Phase 2 if desired.
- English only, no i18n.
- The site remains a marketing site — no auth, dashboard, or client portal (that would have argued
  for Next.js over Astro).

---

## Risks

| Risk | Mitigation |
|---|---|
| Migration drops SEO ranking | Preserve all URLs, keep verification file, regenerate sitemap, resubmit in Search Console after deploy |
| EmailJS free-tier quota exhausted by bots | Honeypot now; server-side rate limiting in Phase 2 |
| Portfolio content never arrives, blocking the redesign | Ship the section with placeholders; it goes live the day content lands |
| Redesign drifts from "premium" into "busy" | Motion budget: no more than 2 animated elements per viewport; token-driven so restraint is enforced by the system |
| LinkedIn app review rejected | Postiz/Buffer rail sidesteps review entirely |
| **Variable-name drift between Phase 1 and Phase 2 reintroduces the missing-name bug** | The five EmailJS variables are a frozen contract — see below. Phase 2's `/api/contact` route must send exactly the Phase 1 names |

### Frozen: EmailJS variable contract

`from_name` · `from_email` · `company` · `message` · `submitted_at`

Both dashboard templates and **every** sender (today's `script.js` handler, tomorrow's Vercel
`/api/contact` route) use exactly these names. Do not rename them during the Astro migration.

`from_name`/`from_email` look redundant beside plain `name`/`email` and are tempting to tidy up,
but the templates are the other half of the contract and live **outside the repo** — a rename there
is caught by no build error and no test. EmailJS renders an unknown variable as empty string and
still returns success, so the failure is completely silent: the exact "A message by ___ has been
received" bug returns, looking like a fresh mystery rather than a regression.

If a rename is genuinely wanted: change the dashboard templates first, then the code, then send a
live test submission.

---

## Immediate next step

Provide item **#1** (the EmailJS template body) and Phase 1 starts.
Items **#6–8** can be gathered in parallel while Phase 1 is in flight.
