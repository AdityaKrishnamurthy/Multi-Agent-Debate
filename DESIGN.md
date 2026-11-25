---
name: Multi-Agent Debate
description: AI agents argue a question across a ruled gutter, a Critic audits every claim, and a ruled verdict box settles it.
colors:
  ink: "#16181d"
  paper: "#ffffff"
  pro-cobalt: "#1f4fd1"
  pro-soft: "#ebf0fd"
  pro-ink: "#173da6"
  con-orange: "#c2410c"
  con-soft: "#fdf0e8"
  con-ink: "#9a3412"
  flag-amber: "#b45309"
  flag-soft: "#fef6e6"
  pass-green: "#15803d"
  pass-soft: "#ecf8f0"
  cool-grey: "#f3f4f6"
  panel: "#f6f7f9"
  rule: "#e3e5e9"
  input-line: "#d5d8de"
  muted-text: "#5b616e"
  destructive: "#b42318"
typography:
  display:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  ruling:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.375
    letterSpacing: "-0.025em"
  argument:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.65
  body:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.43
  tag:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.025em"
    fontFeature: "\"tnum\""
rounded:
  tag: "4px"
  row: "6.4px"
  control: "8px"
  box: "11.2px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  gutter: "32px"
  section: "40px"
  header: "60px"
  rail: "380px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
    typography: "{typography.body}"
  button-primary-lg:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.cool-grey}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-ghost:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.cool-grey}"
  side-tag-pro:
    backgroundColor: "{colors.pro-soft}"
    textColor: "{colors.pro-ink}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "0 8px"
    height: "24px"
  side-tag-con:
    backgroundColor: "{colors.con-soft}"
    textColor: "{colors.con-ink}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "0 8px"
    height: "24px"
  citation-chip:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "0 6px"
  citation-chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  timeline-step-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    height: "44px"
  verdict-box:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.box}"
    padding: "20px"
  evidence-rail:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.box}"
    padding: "20px"
  critic-flag:
    backgroundColor: "{colors.flag-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  critic-pass:
    backgroundColor: "{colors.pass-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
---

# Design System: Multi-Agent Debate

## Overview

**Creative North Star: "The Opposing-Views Spread"**

The system is a newspaper's Yes/No facing columns made interactive. Every round lands as Pro and Con side by side across one 1px gutter, so a rebuttal always sits opposite the claim it answers, and a ruled verdict box in a sticky right rail settles the argument. Ink on white paper, two stance colours and nothing else saturated: cobalt for Pro, burnt orange for Con. Structure comes from rules, not from cards.

Density is that of a reading page, not a dashboard. Argument prose is set in a text serif at a generous size because debates are text-heavy and must hold up on a 1280x720 projector; every control, label and number is set in a plain, sturdy sans. Trust signals (confidence, strength, Critic score, source credibility, vote split) are always printed as numbers next to their bars or dots, never as decoration.

Light is the default. Dark is an opt-in alternate reached only through the header toggle; it remaps every token and keeps the same structure.

**Key Characteristics:**
- Two facing columns per round, separated by a single 1px rule gutter.
- One rule weight (1px, `rule`) everywhere, with exactly one heavier mark: the verdict box's 2px ink border and the 2px ink rule that opens "Why this verdict".
- Cobalt is Pro, burnt orange is Con, and each always travels with a PRO/CON text tag.
- Serif for what agents argue; sans for everything the interface says.
- Flat surfaces; numbers set in tabular figures.

## Colors

Ink, white paper and cool greys carry the page; two stance hues and two status hues carry meaning, and nothing else is saturated.

### Primary
- **Debate Ink** (`ink`): text, primary buttons, the active timeline step, the active citation chip, the confidence bar fill, the verdict box border. It is the system's only "brand" tone; the primary action is ink, never a stance colour.

### Secondary
- **Pro Cobalt** (`pro-cobalt`): Pro's mark only. Agent avatar fill, key-claim bullets, the Pro share of the vote split, Pro vote-weight bars, the left half of the logo mark. Also focus feedback (focus ring, focused composer border, caret, selection tint), which is interaction state rather than stance.
- **Pro Wash / Pro Ink** (`pro-soft`, `pro-ink`): background and text of the PRO tag and the Pro legend figure.

### Tertiary
- **Con Burnt Orange** (`con-orange`): Con's mark only, in the same places Pro uses cobalt, and the right half of the logo mark.
- **Con Wash / Con Ink** (`con-soft`, `con-ink`): background and text of the CON tag and the Con legend figure.

### Status
- **Critic Amber** (`flag-amber`, `flag-soft`): a Critic score below 3.5 of 5. Amber icon on a pale amber panel; also the "still disputed" marker.
- **Critic Green** (`pass-green`, `pass-soft`): a passed Critic review, and the numerals of "Why it won" points.
- **Error Red** (`destructive`): form errors only; never used for Con.

### Neutral
- **Paper** (`paper`): page, card and verdict-box ground.
- **Cool Grey** (`cool-grey`): secondary buttons, ghost hover, tag backgrounds for DRAW/NEUTRAL, empty bar tracks.
- **Panel** (`panel`): hover wash on rows, the resting citation chip, the selected source card.
- **Rule** (`rule`): every divider, row rule, gutter, and container border.
- **Input Line** (`input-line`): field and timeline strokes, the pending verdict's dashed border, link underline at rest.
- **Muted Text** (`muted-text`): meta lines, labels, secondary copy.

Dark theme (opt-in): ground `#111318`, raised `#171a20`, ink `#eceef2`, rule `#2a2f39`, Pro `#7c9cf5`, Con `#f08a52`, amber `#f5b544`, green `#4ade80`. The full map lives in the sidecar and in `frontend/app/globals.css` under `.dark`.

### Named Rules
**The Stance Pair Rule.** Pro and Con colour never appears alone. Wherever a stance hue marks something a reader must interpret, a PRO or CON text tag, a "Pro 3.59 / Con 2.11" legend, or the agent's tagged name sits with it.

**The Ink Action Rule.** Actions are ink. Cobalt and orange belong to the two sides of the argument, so a cobalt button would read as taking Pro's side.

**The Light-First Rule.** Light is the default theme. Dark is reachable only through the header toggle and must remap tokens, never restyle components.

## Typography

**Display Font:** Public Sans (with ui-sans-serif, system-ui)
**Body Font (argument prose):** Source Serif 4 (with ui-serif, Georgia)
**Label/Mono Font:** Public Sans with tabular figures; system monospace is declared but unused.

**Character:** A sober civic sans for the interface and a warm text serif for what the agents actually say, so the reader can always tell the product's voice from the debaters'.

### Hierarchy
- **Display** (700, 2rem mobile to 2.75rem, 1.25, -0.025em): the new-debate question prompt only.
- **Headline** (700, 1.75rem mobile to 2rem, 1.25, -0.025em): the debate question at the top of the replay.
- **Title** (700, 1.5rem, -0.025em): section heads such as "Why this verdict" and "Sample debates". Smaller titles (600, 1.125rem) head the "How a debate runs" list and the sources sheet.
- **Ruling** (700, 22px, 1.375): the verdict's short ruling inside the verdict box.
- **Argument** (Source Serif 4, 400, 17px, 1.65): argument text and the verdict's full reasoning, capped at 70ch where it runs full width. Source quotes use the same serif at 15-16px.
- **Body** (400, 15px, 1.625): key claims, list rows, meta lines, rail copy.
- **Label** (600, 14px): round labels ("Round 2 · Rebuttal 1"), "Key claims", confidence/strength meta, timeline steps. Sentence case.
- **Tag** (700, 12px, 0.025em, uppercase): PRO / CON / DRAW / NEUTRAL tags only. Citation chips use 12px/600 in tabular figures.

### Named Rules
**The Two Voices Rule.** Serif is for agent and judge prose (arguments, reasoning, quoted evidence). Every word the interface itself says is Public Sans.

**The Printed Number Rule.** Every metric is printed as a tabular figure (`font-variant-numeric: tabular-nums`) beside its bar or dot.

**The Readable Floor Rule.** Reading text (arguments, claims, rail rows, verdict points) never drops below 15px; 14px is the floor for Critic notes, meta lines and labels; 12px is for tags and chips only.

## Layout

The replay is a two-column page inside a 1440px container (16px gutters on mobile, 32px from `sm`). The main column holds the question, meta line with Replay/Skip controls, the segmented step timeline, sticky agent heads, then the round rows; a 380px rail on the right (from `lg`, 40px gap) holds the verdict box and the sources list, sticky below the 60px header. The new-debate page uses a 1200px container with a 320px "How a debate runs" aside.

Each round row is a three-track grid: Pro column, a 1px `rule` gutter, Con column, with 32px between tracks and 32px of vertical padding, closed by a 1px rule beneath. Neutral arguments, when present, sit under a dashed rule below both columns. Agent heads use the same three-track grid and stick under the header, with a guide line beneath them that names the round currently in view.

Below `md` the gutter collapses: each argument stacks with its PRO/CON tag and agent name inline. Below `lg` the rail moves into the main column (verdict box above the rounds) and citation chips open the sources sheet instead of expanding inline in the rail.

### Named Rules
**The Facing Gutter Rule.** Pro and Con for the same round share one row and one gutter. Never split them into independent lanes that scroll out of alignment.

**The Sticky Guide Rule.** While the rounds scroll, the agent heads and a guide line naming the round in view stay pinned under the header.

## Elevation & Depth

The system is flat. Depth is expressed by rules and by one heavier border, not by shadow. Containers are distinguished from the page with a 1px `rule` border; state is shown by ink fills (active step, active chip) or the `panel` wash.

### Shadow Vocabulary
- **Composer lift** (`box-shadow: 0 1px 2px rgba(22,24,29,0.04), 0 8px 24px -12px rgba(22,24,29,0.12)`): the question composer on the new-debate page only, the one place the user writes. It is the system's single shadow.

### Named Rules
**The One Rule Rule.** All structure uses a single 1px `rule` line. The only heavier mark is 2px ink, reserved for the settled verdict (the verdict box border and the rule that opens "Why this verdict").

**The Sticky Glass Rule.** Pinned bars (header, agent heads) use the page ground at 95% with a small backdrop blur and a 1px bottom rule; no shadow.

## Shapes

Gentle, consistent corners on a base radius of 8px. Controls, the timeline frame and Critic panels use 8px; contained boxes (verdict box, sources list, source cards, composer) use about 11px; tags and citation chips use 4px; list rows use about 6px. Bars, avatars, the credibility dot and the pulsing "live" dot are fully round. The logo mark is two 13x28 rounded bars, cobalt beside orange, the facing columns reduced to a glyph.

## Components

### Buttons
Plain, sturdy and slightly oversized for projector legibility.
- **Shape:** gently curved (8px).
- **Primary:** ink fill, white text; default 40px tall at 15px with 16px side padding; large 48px at 16px with 24px padding ("Start debate").
- **Secondary:** cool grey fill, ink text, 36px small size (current nav item).
- **Ghost:** no fill, cool grey on hover (nav, theme toggle, Replay).
- **Hover / Focus:** primary fades to 80% ink; focus shows a cobalt ring; press nudges down 1px.

### Side Tag (signature)
The textual half of every stance colour. 24px tall, 4px corners, 12px bold uppercase with slight tracking: PRO on cobalt wash with cobalt ink text, CON on orange wash with orange ink text, DRAW and NEUTRAL on cool grey.

### Citation Chip
Inline `[E#]` marker in argument text. 12px semibold tabular, 4px corners, `panel` fill with an `input-line` border; hover darkens the border to ink; active (its source open) inverts to ink fill, white text. One click opens its source.

### Step Timeline
A single bordered segmented row: Opening, Rebuttal n, Verdict. Steps restyle in place: done steps get a check, the active step inverts to ink with a pulsing dot, upcoming steps are muted. Reached steps are buttons that jump to their round.

### Argument Block
Meta line (confidence and strength as label-size tabular figures), serif argument prose, a "Key claims" list with stance-coloured 6px bullets, then the Critic panel: amber wash with a warning icon and score when flagged (below 3.5/5), green wash with a check when passed, issue notes at 14px.

### Verdict Box (signature)
**The Ruled Verdict Rule.** The settled verdict is the only container with a 2px ink border. Pending, it is a dashed `input-line` box with a round progress bar; settled, it shows the ruling, its side tag, confidence as a large figure over an ink bar, the vote split bar with its Pro/Con legend, the top "why it won" points, and a link to the full reasoning.

### Vote Split Bar
A 10px fully round bar, cobalt share left, orange share right, always paired with a "Pro x.xx / Con x.xx" legend in the stance ink colours, or a side tag and ruling in compact rows.

### Sources (Evidence List and Sheet)
In the rail: a 1px-ruled box listing `E#`, source name and a credibility dot; selecting a row expands the serif quote, host link and credibility percentage inline. Below `lg`, the same list opens as a right-hand sheet of ruled cards.

**The Fixed Ramp Rule.** Credibility is a dot whose diameter follows a fixed four-step ramp: 12px at 85% and above, 10px at 70%, 8px at 50%, 6px below. The percentage is printed beside it, and the list states that dot size shows credibility.

### Inputs / Fields
Standard shadcn fields: 1px `input-line` stroke, 8px corners, transparent ground, cobalt focus ring. The question composer is a large field (20px text) inside a ruled box with the composer lift; its border turns cobalt while focused.

### Navigation
A 60px sticky header: logo mark and "Multi-Agent Debate" in 17px bold on the left; small ghost buttons (New debate, Sample debates) and the theme toggle on the right; the current page uses the secondary fill.

### Pending: Struck Revision
**The Struck Original Rule (pending, not shipped).** When the Critic forces a revision, the revised argument should keep its original text visible as struck-through copy above or beside the revision. It is not rendered yet because the transcript schema carries no original-text field; build it when the schema adds one.

### Motion
Entrances are short and quiet: arguments fade up 6px over 220ms, the settled verdict scales from 0.98 over 350ms, both on `cubic-bezier(0.16, 1, 0.3, 1)`. Argument text types in during live replay with a 2px ink caret. All motion collapses under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** set Pro and Con of the same round in one row across a single 1px `rule` gutter.
- **Do** pair every stance colour with a PRO/CON tag or a labelled Pro/Con figure.
- **Do** keep primary actions ink (`ink` fill, white text), 40px tall at 15px, 48px for the main call to action.
- **Do** set agent and judge prose in Source Serif 4 at 17px/1.65, and everything else in Public Sans.
- **Do** print every metric as a tabular number beside its bar or dot; credibility uses the 12/10/8/6px dot ramp.
- **Do** reserve the 2px ink border for the settled verdict.
- **Do** keep light as the default theme and route dark through the header toggle only.

### Don't:
- **Don't** show stance by colour alone.
- **Don't** use cobalt or orange for buttons, links or decoration unrelated to a side; cobalt is allowed only as focus feedback (focus ring, focused composer border, caret, selection tint).
- **Don't** split a round into two independent card lanes or stacked cards with shadows.
- **Don't** add shadows beyond the composer lift; separate containers with 1px rules.
- **Don't** add a second border weight or new accent hue.
- **Don't** drop running text below 15px.
