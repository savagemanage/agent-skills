---
name: exec-one-pager
description: >-
  Generate an English executive or startup one-pager as a .docx (problem, solution,
  product, market, GTM, kill/go criteria, timeline). Use when the user asks for a
  one-pager, one page summary, exec brief, pitch one-pager, investment one-pager,
  or "create a one-pager on X" in English without Korean government-proposal framing.
  Do not use for Korean 정부지원 사업 요약서 / 추진계획(안) / 1페이지 요약서 — that is the
  gov-one-pager skill.
license: Apache-2.0
---

# Executive one-pager

Produce a single-page English `.docx` brief in label/content table form: startup or
corporate exec summary, not a Korean government 요약서.

## When to use

- "Create a one-pager", "exec brief", "pitch one-pager", "one-page summary"
- English product / market / ask framing without 사업계획서 or 정부지원 cues
- Reusing the sample table structure for a new topic

For Korean government-style 요약서 / 추진계획(안), use the `gov-one-pager` skill instead.

## Quick workflow

1. Map user material into the **11 label rows** below using the style and fill rules.
   Ask only for missing must-haves; otherwise draft and note assumptions briefly.
2. Copy `scripts/report_generator.js` into the working directory.
3. Replace only the top-level `DATA` object (leave the style engine untouched).
4. Run `npm install docx --no-save` if needed, then `node report_generator.js`.
5. Deliver the `.docx` to the user.

## Format rules

- Output: one Letter page `.docx`. If it overflows, cut sentences and compress tables.
- One main table: left labels, right content.
- Title on one line with a double underline beneath.
- Label column: light gray fill, bold, centered.
- Nested tables: dark header row, white body.
- Font: Calibri throughout; title bold only.
- Label order: Opportunity, Summary, Problem, Why now, Solution, Product, Market,
  Go-to-market, Kill / Go, Timeline, Sources.
- Always include **Product** for new ventures or products.

## Style rules

- Short bullets; one fact per line.
- Prefer plain nouns and verbs; cut hype and filler adjectives.
- No "not A but B" contrast openers.
- No em dashes (—). Use a hyphen (-) or a plain sentence.
- Spare use of quotation marks for emphasis.
- Put superscripts on numbers and hard claims; list matching sources in **Sources**.
- Mark market figures as estimates in **Sources**.

## Fill guidance

- **Summary**: at most 4 lines — problem, cause, approach, beachhead.
- **Problem**: at most 4 facts.
- **Solution**: 3-column nested table (Track / What / Outcome), plus one guardrail line.
- **Product**: 2-column nested table (Step / What) for the user flow; one line under for
  platform, stack, and first users.
- **Market**: TAM / SAM / SOM nested table.
- **Kill / Go**: two-column nested table.
- **Sources**: short citations only.

## Intake skeleton

When the chat already has enough content, fill this privately and write `DATA` directly
(do not make the user paste the skeleton back):

```
- Topic:
- Problem:
- Why now:
- Solution:
- Product (user-flow steps; platform / stack):
- Market (TAM / SAM / SOM):
- Go-to-market:
- Kill / Go:
- Timeline:
- Sources:
```

## Script (`scripts/report_generator.js`)

- Edit only `DATA`, then `node report_generator.js` (`npm install docx` required).
- Do not edit the style engine below the marker comment.
- Citations: `{ line: "...", sup: 1 }` plus matching Sources rows.
- Nested tables: `{ table: { widths, header, body } }`.
- `m` = bullet glyph, `label` = bold step label, `size` = font half-points (default 20).
- Sample `DATA` is fictional; replace all of it for real topics.
- If Calibri is missing, change only the `FONT` constant.

## Pre-delivery checklist

- [ ] All 11 labels in order (Product included)
- [ ] Sample DATA fully replaced
- [ ] No em dashes
- [ ] Claims/numbers have superscripts with Sources matches
- [ ] Market estimates called out in Sources
- [ ] Fits one Letter page
