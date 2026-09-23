# comic-writing (mini)

Condensed reference for the ailbert **writer**. Read with
`panel-schema.mini.md`.

## 1. Adams humor grammar — the 6 triggers

1. **Importance/triviality juxtaposition** — huge stakes for something absurd,
   or enormous process around nothing.
2. **Inappropriate solutions** — a fix that "works" by ignoring the real problem.
3. **Unseen-reaction punchline** — the sting is what someone *else* does/feels.
4. **Mocking platitudes** — management-speak laundered into wisdom.
5. **Engineered cleverness in service of selfishness** — ingenuity bent toward
   a petty win.
6. **Stacking** — the strip must contain at least **2 triggers** (pair them).

> Stacking is the house style: one trigger is a joke, two is a Dilbert gag.

## 2. Archetypes (manifest-only ids)

- `worker` — the straight man; stressed is his resting face.
- `boss` / pointy-haired boss — confident, wrong, unaccountable.
- `it` — glasses + hoodie; owns everything, fixes nothing. Stressed even when
  just standing by.
- `hr` — cheerful, clipboard, suspiciously encouraging.
- `intern` — beanie + backpack; eager, cheap, disposable optimism.
- `ceo` — slicked hair + tie; confident about things he does not understand.
- `cfo` — balding + tie; frustrated, fluent in budget and headcount.
- **Rule:** archetypes are visual ids. You may only name an id/pose/expression
  that exists in the manifest. Never invent one.
- **Scene ideas** (manifest-only backgrounds): `office`, `meeting-room`,
  `cubicle`, `server-room`, `coffee-room`, `hallway`. Pick the one that
  undercuts or fits the joke (e.g. synergy talk in `server-room`).

## 3. Beat structure (3 panels, exactly)

- **Panel 1 — setup.** Establish the absurd normal.
- **Panel 2 — escalation.** Apply pressure or misdirection.
- **Panel 3 — quiet-absurd punchline.** Land it deadpan.
- **Punchline NEVER restates panel 1.** It must advance, invert, or reveal.

## 4. Bubble craft

- ≤ **~90 chars** per bubble; **exactly one joke** per bubble (strip = one gag).
- Style enum: `speech | thought | shout | whisper`. Pick for the beat (whisper
  for conspiracies, shout for bosses mid-rant).
- Punchline panel usually gets the last line; keep it shortest.

## 5. Banned content

- Meanspirited at real people (characters only — Dilbert mocks *roles*).
- Slice-of-life with no joke (a pretty panel with no punchline).
- Profanity.

## 6. Topic bank

- LLM / AI hype; git; open-source commit age; pointless meetings;
  pointy-haired-boss decisions; standups; CI flakes; office tooling.

## 7. Output contract

- Schema-valid JSON ONLY (see `panel-schema.mini.md`), written to
  `work/attempt-N/panel.json`.
- Enumerate ids/poses/expressions ONLY from `assets/manifest.json`.
- One bubble/panel, text ≤ 90 chars, style from enum.
- On `out/verify.json` feedback: revise next attempt against it, ≤ N
  iterations, then report the blocker to the architect. Never self-loop.

## 8. Quick example (beat shape)

> "We adopted AI to eliminate busywork." → now the busywork is *reviewing* the
> AI's busywork → "It's saving you time." / "Whose time?" — triggers 1+4.