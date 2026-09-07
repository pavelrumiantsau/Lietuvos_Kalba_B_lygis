# Chapter content JSON schema

Each chapter is one JSON file: `chapters/chapter-XX.json`. Images referenced by
relative path `images/chapter-XX/<file>`, shipped in the same content package zip.

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

A `Section` is one of the book's 7 recurring parts. `type` picks the renderer:

- `reading_listening` — title "Skaitymo ir klausymo užduotys". Has `blocks`: an
  ordered array mixing `passage` and `task` blocks (tasks reference passages by id
  when the instruction says "read the text and...").
- `vocabulary` — title "Žodynas". Has `groups`: array of word lists/diagrams.
- `grammar` — title "Gramatika". Has `rules`: numbered rule explanations.
- `tasks` — title one of "Žodyno ir gramatikos užduotys" / "Rašymo užduotys" /
  "Kalbėjimo užduotys". Has `tasks`: array of Task.
- `leisure` — title "Laisvalaikiui". Has `blocks`: same shape as reading_listening
  (mostly passages/poems, occasionally a light task).

### Passage block
```
{
  "blockType": "passage",
  "id": "c1-s1-p1",
  "sourcePage": 9,
  "title": "Lietuvos vardo kilmė",          // omit if untitled
  "paragraphs": ["...", "..."],              // two-column text merged into reading order
  "footnotes": ["* ...", "* ..."],           // optional, small print notes at bottom
  "images": [                                 // optional, 0+
    {"file": "images/chapter-01/p9-photo1.jpg", "caption": "Lietavos upelis"}
  ]
}
```
Poems keep line breaks: put each line as its own paragraph string, and use
`"stanzaBreak": true` markers as a paragraph value of `""` between stanzas if needed
— simplest: just include blank strings "" for stanza breaks.

### Task block (used inside reading_listening/leisure blocks, and inside tasks.tasks)
Every task has this common envelope, plus a `taskType`-specific payload:
```
{
  "blockType": "task",           // only needed inside reading_listening/leisure blocks
  "id": "c1-s1-t1",
  "number": 1,                    // the printed number in the book, or null if unnumbered
  "sourcePage": 10,
  "taskType": "...",
  "instruction": "Perskaitykite tekstą apie Lietuvos vardo kilmę ir pabaikite sakinius.",
  "relatedPassageId": "c1-s1-p1", // optional
  "grammarHint": ["c1-gram-1"],   // optional array of grammar rule ids this task draws on
  ... taskType-specific fields
}
```

taskType payloads:

- `cloze` — fill in the blank(s) to finish/complete text.
  `"items": [{"prefix": "Kalbininko K. Kuzavinio nuomone, ", "answerLines": 1}]`
  (answerLines usually 1; the printed dotted line just means "write the answer here").

- `open_questions` — free-text Q&A / discussion.
  `"questions": ["Kuo ypatingas jūsų šalies kraštovaizdis?", "..."]`

- `true_false` — statement graded true/neteisingas by the learner, optionally tied
  to a listening transcript.
  ```
  "audio": true,
  "transcriptRef": "c1-appendix-2",  // id into the appendix transcripts list, if audio task
  "statements": [
    {"number": 1, "text": "...", "given": "correct"},  // "given" = book's own worked example, not a real question
    {"number": 2, "text": "..."}
  ]
  ```

- `matching` — pair left column with right column.
  `"left": ["upė", "ežeras", ...], "right": ["trykšta", "driekiasi", ...]`
  (store exactly as printed; do not invent a correct pairing)

- `ordering` — arrange items in the order mentioned/heard.
  `"items": ["Aukštaitijos nacionalinis parkas", "Žuvintas", ...]`

- `phrase_building` — combine word bank into phrases/sentences.
  `"wordBankA": [...], "wordBankB": [...], "example": "Akmenuotas dugnas. ..."`

- `transform` — given-word / verb-form transformation fill-ins (e.g. "Nuo kalno
  turėtų atsiverti nuostabus vaizdas (atsiverti, ...)"). Store the sentence with a
  `___` marker where the blank is, plus the parenthetical hint words exactly as
  printed: `"sentence": "Ar jūs esate ___ (būti) Europos centre?"`

- `writing` — open long-form writing prompt. `"prompt": "..."`, optional
  `"wordBank": [...]` if the book supplies words to use.

- `speaking` — open discussion/speaking prompt, same shape as writing.

- `fill_table` — a table with some cells blank for the learner to complete.
  `"columns": [...], "rows": [{"cells": ["upė", "", "teka"]}]` (empty string = blank)

If a task's layout genuinely doesn't fit any of the above, use `taskType: "freeform"`
with `"raw": "<verbatim instruction + content>"` and flag it for review rather than
forcing it into the wrong shape.

### Vocabulary section
```
{"type": "vocabulary", "title": "Žodynas", "sourcePage": 16,
 "groups": [
   {"heading": null, "items": ["kalba", "tarmė", "patarmė", "šnekta"]},
   {"heading": null, "items": ["gimtoji kalba", "svetimoji kalba"]},
   ...
 ],
 "diagram": {"note": "nested boxes kalba > tarmė > patarmė > šnekta", "image": "images/chapter-01/p16-diagram.jpg"}
}
```
Keep vocabulary as plain word/phrase lists grouped the way the columns group them.
Don't invent definitions — the book gives bare terms, not translations.

### Grammar section
```
{"type": "grammar", "title": "Gramatika",
 "rules": [
   {"number": 1, "id": "c1-gram-1", "sourcePage": 17,
    "title": "Daiktavardžių priesaga -umas.",
    "lines": ["ilg-as + -umas → ilgumas", "plat-us + -umas → platumas", "aukšt-as + -umas → aukštumas"],
    "examples": ["Nemunas ir Neris – ilgiausios Lietuvos upės. / Neris – antra pagal ilgumą Lietuvos upė."]
   }
 ]}
```
Preserve the arrow/derivation formulas and example sentence pairs as printed.

### Appendix transcripts (listening texts)
Separate file `chapters/appendix-listening.json`:
```
{"transcripts": [
  {"id": "c1-appendix-2", "chapter": 1, "section": "reading_listening", "taskNumber": 2,
   "title": "Lietuvos gamtos stebuklai", "sourcePage": 297, "paragraphs": ["...", "..."]}
]}
```
`id` must match the `transcriptRef` used by the corresponding `true_false`/listening task.

## Non-negotiable rules
- Every piece of book text must be a faithful transcription — same wording, same
  numbering. Never invent, paraphrase-as-if-original, or guess missing text.
- If a page/element is unclear, ambiguous, or you're not fully sure you read it
  right (smudged scan, unclear column order, cut-off text), do NOT guess — add an
  entry to `content-source/chapter-XX/ISSUES.md` describing exactly what's unclear
  and where (page number), and leave the field's value as `null` or omit it rather
  than fabricating.
- Blank-marking punctuation like rows of dots (`...............`) in the book means
  "learner writes here" — represent as the schema's blank/answer fields, don't
  transcribe the dots themselves.
