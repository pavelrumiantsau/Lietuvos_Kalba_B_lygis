# Lietuvos_Kalba_B_lygis

Interactive companion app for working through "Nė dienos be lietuvių kalbos" (B level
Lithuanian textbook) as web forms, on desktop or mobile.

## How it works

- **This repository contains only the app itself** — a static site (`site/`) with no
  book content in it. It's safe to be public.
- The actual book content (transcribed reading texts, exercises, images) is packaged
  separately as a `.zip` **content package** that is never committed here or hosted
  anywhere — you load it into the app yourself, entirely client-side.
- Open the site, click **"Įkelti turinį"** (Load content), and pick your content
  package `.zip` file. It's unzipped and stored in your browser's IndexedDB — nothing
  is uploaded anywhere.
- Your answers and progress are saved in `localStorage`, per browser/device.
- There's no built-in grading (the book has no answer key baked into the app). Each
  task has a **"Kopijuoti patikrinimui (Claude)"** button that copies the original
  task text plus your current answers to the clipboard, formatted to paste into
  Claude (web/app/desktop) so you can ask it to check your work manually. This app
  never calls any AI API directly and needs no API key.

## Development

The site is plain HTML/CSS/JS, no build step. Open `site/index.html` directly, or
serve the `site/` folder with any static file server for a realistic same-origin test
(IndexedDB/clipboard behave more predictably over http(s) than `file://`).

`scripts/package-content.py` builds a content package zip from
`content-source/chapter-NN/` folders (gitignored) — see that script's docstring.

## Deployment

`.github/workflows/deploy.yml` publishes `site/` to GitHub Pages automatically on
every push to `main` that touches `site/`.
