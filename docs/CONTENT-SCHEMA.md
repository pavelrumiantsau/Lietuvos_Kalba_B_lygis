# Chapter content JSON schema (v2 — proven against chapter 1)

Each chapter is one JSON file: `chapters/chapter-NN.json`. Images referenced by
relative path `images/chapter-NN/<file>`, shipped in the same content package zip.

Top level:
```
{
  "chapter": 1,
  "title": "Jūs būtinai atvažiuokite čia",
  "pageStart": 8,
  "pageEnd": 35,
  "sections": [ Section, ... ]
}
```

## Copyright / fidelity policy (apply this consistently across every chapter)

Transcribe **verbatim, in full**: every vocabulary word-list, every grammar rule's
derivation lines and short example-sentence pairs, and every discrete exercise item
needed for the exercise to function — cloze sentence-starters/inline blanks,
true/false statements, matching/ordering items, word banks, transform sentences,
fill-table cells, short numbered drill sentences, footnote/glossary definitions,
photo captions, and short one-sentence attributed quotes/maxims.

Do **not** transcribe verbatim (even for this personal-use, non-redistributed
project): extended multi-paragraph reading passages/interviews composed for the book
(roughly 100+ words of continuous prose), complete song lyrics, complete poems.
For these, instead write:
- `"summaryNotVerbatim": true` on the passage/task object
- `paragraphs`/`raw`: a short **original summary in your own words** covering what
  the text is about (enough for the exercises referencing it to make sense), never
  a near-complete paraphrase that reproduces most of the original's content/wording
- keep `title`, `author`/`performer`, dates, and `sourcePage` as normal (these are
  bare facts, not the expressive text itself)
- if the passage has short **functional fragments** actually needed for an exercise
  (e.g. the underlined verb infinitives in a "change these verbs to participles"
  drill), it's fine to keep just those short fragments verbatim in a separate field
  (e.g. `verbHints`) even though the surrounding narrative is summarized — see
  chapter 1's "Moko akmuo" task for the pattern.
- add a line to `content-source/chapter-NN/ISSUES.md` listing every passage handled
  this way, with page numbers, so the book owner can paste in their own transcription
  later if they want full fidelity (the app has a "paste original text" box for
  exactly this, stored only in the user's browser).

This is not a fallback for unclear scans — it applies even when you can read the
text perfectly. Apply it consistently: don't verbatim-transcribe chapter 3's long
passages just because chapter 1 summarized similar ones, and vice versa.

## Section types

A `Section` is one of the book's 7 recurring parts, identified by `type`:
`reading_listening`, `vocabulary`, `grammar`, `tasks` (title is one of "Žodyno ir
gramatikos užduotys" / "Rašymo užduotys" / "Kalbėjimo užduotys"), `leisure`.
Include `sourcePageStart`/`sourcePageEnd` on every section.

- `reading_listening` / `leisure`: `"blocks": [Passage | Task, ...]` in reading order.
- `vocabulary`: `"groups": [{"heading": string|null, "items": [string, ...]}]` plus
  optional `"diagrams": [{"note": string, "sourcePage": number, "image"?: string}]`
  for anything graphical (maps, nested-box diagrams, decorative photos) — describe
  what it shows in `note` rather than trying to force it into word-list form.
- `grammar`: `"rules": [Rule, ...]`.
- `tasks`: `"tasks": [Task, ...]`.

### Passage
```
{
  "blockType": "passage", "id": "c1-s1-p1", "sourcePage": 9,
  "title": "Lietuvos vardo kilmė",
  "paragraphs": ["...", "..."],      // "" entries = stanza/paragraph break
  "footnotes": ["* ...", ...],        // optional
  "images": [{"file": "images/chapter-01/...", "caption": "..."}],  // optional
  "author": "...",                    // for poems
  "isPoem": true,                      // optional flag
  "summaryNotVerbatim": true           // when the policy above applies
}
```

### Task — common envelope
```
{
  "blockType": "task",              // only inside reading_listening/leisure blocks
  "id": "c1-s1-t1", "number": 1,     // null if the book prints no number here
  "sourcePage": 10, "taskType": "...",
  "instruction": "...",
  "relatedPassageId": "c1-s1-p1",    // optional, when a separate top-level passage exists
  "sourcePassages": [Passage, ...],  // optional, when the passage is embedded directly
                                     // in the task instead (common for writing/speaking/
                                     // Kalbėjimo tasks that quote a short text inline)
  "grammarHint": ["c1-gram-1"],      // optional
  ... taskType-specific fields below
}
```
Split an unnumbered follow-on instruction into its own task object (with
`"number": null`) rather than forcing two different exercises under one number —
see chapter 1's `t1a`/`t1b` pattern.

### taskType payloads (as actually implemented in the renderer)

- **cloze** — `"items": [Item, ...]`, optional top-level `"wordBank"`. Each Item is
  either `{"prefix": "1. Sentence start, ", "answerLines": 1}` (blank at the end) or
  `{"number": 2, "text": "Sentence with ___ in the middle.", "given"?: "answer"}`
  (inline blank — `given` marks the book's own worked example, rendered as fixed
  text rather than an input).

- **open_questions** — `"questions": [string, ...]` (numbered Q&A); if the book has
  no fixed question list, omit `questions` (or leave it `[]`) and the renderer shows
  one open textarea instead. May also carry `"quotes": [{"text","author"}]` and/or
  `"sourcePassages"`.

- **writing** / **speaking** — open long-form prompt. Optional `"prompt"` (only if
  different from `instruction`), `"wordBank"`, `"images"`, `"sourcePassages"`.

- **true_false** — `"audio": true, "transcriptRef": "cN-appendix-M"` when tied to a
  listening transcript; `"statements": [{"number","text","given"?: "correct"|
  "incorrect"}]` — `given` marks the book's own worked example.

- **matching** — `"left": [...], "right": [...]`, optional `"given": {"1": "E"}`
  (1-indexed left-item number → right letter, for the book's worked example).

- **ordering** — `"items"`: either plain strings, or (when photo-illustrated)
  objects `{"label": "A", "name": "...", "image": "images/...", "given"?: 1}`
  (`given` = the worked-example position). Optional `"transcriptRef"`.

- **phrase_building** — `"wordBankA"`, `"wordBankB"`, `"example"`.

- **transform** — `"items": [{"number", "sentence", "hintWord"|"hint"?, "given"?}]`.
  If `sentence` contains `___`, it's an inline blank; if not, it's a whole-sentence
  rewrite task using the hint word's transformed form. `given` on item 1 is
  typically the book's own worked example (full transformed sentence).

- **fill_table** — either flat `"columns"`/`"rows"` (`rows: [{"cells": [...]}]`,
  empty string = blank to fill in), or `"tables": [{"title","columns","rows"}, ...]`
  for multiple named tables under one task/instruction.

- **freeform** — use when nothing else fits. Optional `"title"`, `"attribution"`,
  `"abbreviations"`, `"wordBank"`, `"verbHints"`, `"images"`, `"summaryNotVerbatim"` +
  `"sourcePage"`, and `"raw"` (a description of the exercise/answer format — see
  chapter 1's river/lake/geography cloze tasks for the pattern of describing a
  summarized passage plus its numbered blanks in `raw`).

### Grammar rule
```
{"number": 1, "id": "c1-gram-1", "sourcePage": 18, "title": "Daiktavardžių priesaga -umas.",
 "lines": ["ilg-as + -umas → ilgumas", ...],
 "examples": ["Before sentence. / After sentence.", ...]}
```

## Non-negotiable rules
- Faithful transcription for everything in scope (see policy above) — never invent,
  guess, or silently normalize wording. Preserve exact diacritics.
- If unsure about a transcription (unclear scan, ambiguous column order, a layout
  that doesn't fit any taskType), don't guess — note it in `ISSUES.md` with the page
  number and either leave the field out or use `freeform`/`raw`.
- Blank-marking dots (`...............`) in the book mean "learner writes here" —
  represent with the schema's blank/answer fields, don't transcribe the dots.
- Always end with `ISSUES.md` (even if just "No issues found") and validate the
  chapter JSON with `python3 -m json.tool`.
