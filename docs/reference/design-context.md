# Lyfe App — Design Context

> Extracted from `CLAUDE.md` 2026-07-16 to keep per-session context lean. Read
> this before any UI/design change. Longer-form canonical brief:
> `lyfe-app/.impeccable.md`. Captured 2026-04-22 via `/impeccable:teach`.

## Users & context

Five personas on one mobile app, all Singapore-based insurance-agency staff:

- **Agents** (20s–40s) — in-hand, on-the-go, often one-handed, often in bright daylight between client meetings.
- **Managers** (30s–50s) — short bursts between meetings; occasional deep sessions.
- **Directors** (40s+) — senior eyes, value clarity over density.
- **PAs** — admin role, creates candidates for managers. Currently sees identical UI to managers (known UX gap).
- **Candidates** (20s) — mobile-native; learning the app from scratch during onboarding + training.

Context is always mobile, never desktop, often tired/rushed/distracted. Build for all three moods.

## Brand personality

**Three words:** *warm, humane, editorial.* Think *The Wirecutter*, *Tropic Skincare*, *Craft Docs* — not Stripe dashboards, not Duolingo, not corporate-insurance navy.

**Voice:** colleague who respects you. Plain English. Singapore-contextual (multi-ethnic example names: Siti Rahman, Raj Kumar, Wei Ming Lee, Priya Selvaraj — never "John Doe"). Confident but not boastful. Takes responsibility on errors.

**Emotional register by moment:**
- Everyday actions → invisible UI, zero friction.
- Meaningful wins (lead converted, exam passed, module complete) → **consistently playful and celebratory**. Terracotta confetti (never indigo), spring physics, warm copy ("Nice — three this week"). Never cartoonish, never shouty.
- Hard moments (exam failed, lead lost) → supportive, never cold, never condescending.
- Empty states → teach the interface, not "No data."

## Aesthetic direction

**Editorial magazine meets iOS-native app.** Warm cream surfaces, terracotta accent, spacious, readable, asymmetric compositions preferred over centered layouts. Dual theme required: light (cream `#F5F0E6`) + warm-dark (`#141310`, never pure black).

**Hard anti-reference — the interface must actively avoid:**
- **AI-generated SaaS templates.** No indigo/purple gradients, no hero-metric layouts, no 3-equal-column stat grids, no glassmorphism, no gradient text, no neon glow, no "Elevate/Seamless/Unleash" copy.

**Soft anti-references** (allowed sparingly, never default): corporate insurance navy/white/red, Duolingo mascot gamification, Stripe-style cold density.

## Typography rules (currently violated — must be enforced)

Current font stack (via `expo-font`):
- `Fonts.serif` = **Fraunces** — display/accent only.
- `Fonts.sans` = **Inter** → decided in teach: **swap for something rarer.** Finalist shortlist: **Albert Sans** (primary), **Manrope**, **Figtree**. Pick locked in `/impeccable:typeset`.
- `Fonts.mono` = **JetBrainsMono** — timestamps and IDs only.

**Role rules (enforce on every screen):**
1. **Serif (Fraunces):** greetings, ONE big hero number per screen, ONE italic accent per screen. **Never** on labels, stat values, list-row names, activity-item names, or generic section headers.
2. **Mono (JetBrainsMono):** timestamps (`2m ago`), IDs (`REQ-8J2K`), short codes. **Never** on counts, percentages, currency, or UI labels.
3. **Sans (new choice):** everything else. The workhorse.

**Scale:**
- Body text ≥15pt minimum (WCAG AA + in-hand mobile).
- Line-height 1.5+ on body, 1.2 on display.
- Hierarchy ≥1.25 ratio between steps.
- Use `P.letterSpacing()` helper — never hardcode negative tracking.

## Color rules

Keep:
- Cream `#F5F0E6` + warm-dark `#141310`.
- Terracotta accent `#D6552B` + Tropic semantic colors (sage/butter/danger/dusty-slate).

Fix:
- `AVATAR_COLORS` (`ui.ts:10`) — replace indigo/violet/magenta with Tropic-warm family (muted terracotta, dusty rose, sage, ochre, clay, persimmon).
- Interview status colors (`ui.ts:83`) — retint away from iOS defaults.
- Migrate all hardcoded hex (`login.tsx`, `leads/[leadId].tsx` WhatsApp `#25D366`, `face-test.tsx`, etc.) to `colors.*` tokens.

Never: pure `#000` or `#FFF` in screens. Every screen works in both themes — no module-level brand colors.

## Motion rules

- Tokens: `ANIM.MICRO=200, TRANSITION=300, REVEAL=600`.
- Easing: exponential ease-out or reanimated spring. No linear, no bounce, no elastic.
- Animate `transform` + `opacity` only. Never `height/width/padding`.
- Onboarding screens currently have zero motion — each needs at least one `FadeInDown` spring entrance.
- Celebration motion auto-dismisses (1–2s). Never loops.
- Respect `prefers-reduced-motion` — disable decorative motion, keep functional transitions.

## Layout & materiality rules

- 4pt spacing scale (already in `SPACING.XS=4 → XXL=24` — use the tokens, never raw numbers).
- Asymmetric compositions. Top-left anchored titles. No centered-everything (biggest onboarding violation).
- Cards only when elevation communicates hierarchy. Otherwise: iOS-grouped rows with hairline dividers.
- **3-equal-column stat grid pattern BANNED.** Find another composition.
- Shadows via `P.shadow('sm'|'md'|'lg')` (platform-aware). Radii vary by size (chip 6–8, card 12–16, hero 20+). No uniform 8px-everything.

## Accessibility

- WCAG AA contrast minimum.
- Touch targets ≥44pt.
- Body text ≥15pt; never below 13pt even for meta.
- Support iOS Dynamic Type where feasible.
- Test critical flows with VoiceOver (login, lead detail, exam-taking).

## The 5 design principles (apply to every decision)

1. **Editorial over dashboard.** Agents aren't SREs. Choose the magazine over the data grid.
2. **Celebrate warmly, not loudly.** Every meaningful moment gets a beat of delight — but keep the register humane, not cartoon.
3. **Typography is role-based.** Fraunces is a scalpel. Mono is IDs. Sans is everything else. This single discipline lifts the most screens.
4. **Readable first, dense second, clever never.** 15pt body minimum. If a layout needs 12pt to fit, simplify the layout.
5. **Every screen lives in both themes.** Dark mode is half the brand, not a nice-to-have.

## Known execution debt (from 2026-04-22 audit — routed to next skills)

1. Serif-on-labels across hero stats, stat cards, activity cards, pipeline, candidate hero → `/impeccable:typeset`.
2. Avatar palette indigo/violet → warm family → `/impeccable:colorize`.
3. PA tab is 100% delegation with zero role differentiation → product design + `/impeccable:layout` + copy pass.
4. Onboarding's 6 centered-everything static screens → `/impeccable:layout` + motion pass.
5. `candidates/[candidateId].tsx` is a 1,376-line single-column scroll → needs tabs or collapsible sections → `/impeccable:layout` (biggest daily-UX win).
6. Hardcoded hex breaking dark mode (login, WhatsApp green, face-test, rejected) → `/impeccable:colorize` + `/impeccable:polish`.
7. Empty-state icons blend into cream → `/impeccable:polish`.
8. DISC/Enneagram/VARK result screens have inconsistent section names + card shapes → `/impeccable:polish`.
9. Privacy + Terms long-form text lacks max-width / line-length discipline → `/impeccable:typeset`.
