# Quotes Site

A static, filterable quote website generated from a single CSV file. No server,
no database, no build tools beyond a small Node.js script — just static HTML,
CSS, and JS, deployed to GitHub Pages.

## How it works

- **Data**: `data/quotes.csv` — one row per quote, columns: `quote,author,tags,source`.
- **Generator**: `scripts/generate.js` reads the CSV and produces `dist/quotes.json`
  and `dist/meta.json` (derived tag/source/author counts), then copies the static
  site files (`src/*.html`, `styles.css`, `app.js`) into `dist/`.
- **Frontend**: `dist/index.html` fetches `quotes.json` and filters/sorts it
  entirely in the browser — tag filters, author filter, and A–Z sort all combine
  (AND logic). State is reflected in the URL query string so filtered views are
  shareable/bookmarkable.
- **Styling**: [Sakura CSS](https://github.com/oxalorg/sakura) as a base, with
  [Victor Mono](https://rubjo.github.io/victor-mono/) for typography and custom
  overrides in `src/styles.css` for a light/dark "reading room" theme. Dark mode
  respects `prefers-color-scheme` by default, with a manual toggle that's saved
  to `localStorage`.

## Local development

```bash
npm install
npm run generate     # CSV -> dist/
```

Then serve `dist/` with any static file server, e.g.:

```bash
npx serve dist
# or
python3 -m http.server --directory dist 8080
```

## Editing quotes

Add a row to `data/quotes.csv`:

```csv
quote,author,tags,source
"Your quote text here.","Author Name","tag-one,tag-two","Where it's from (optional)"
```

Notes:

- `quote` and `author` are required; `tags` and `source` may be empty strings.
- `tags` is a comma-separated list inside one CSV field — wrap it in quotes.
- Commit and push to `main`; the GitHub Actions workflow regenerates and
  redeploys the site automatically.

## Deployment (GitHub Pages)

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages** and set **Source** to
   **GitHub Actions**.
3. Push to `main` (or run the workflow manually via **Actions → Build and
   Deploy Quotes Site → Run workflow**).
4. The workflow will:
   - Run `scripts/generate.js` to rebuild `dist/`.
   - Commit the regenerated `dist/` back to the repo (tagged `[skip ci]` to
     avoid loop-triggering itself).
   - Deploy `dist/` to GitHub Pages.
5. Your site will be live at `https://<username>.github.io/<repo-name>/`.

## File structure

```
quotes-site/
├── data/
│   └── quotes.csv          # Quote data source
├── scripts/
│   └── generate.js         # CSV -> HTML/JSON processor
├── src/
│   ├── index.html          # Browse page (filters + quote list)
│   ├── tags.html           # All tags with counts
│   ├── sources.html        # All sources with counts
│   ├── about.html          # About + "More" info
│   ├── styles.css          # Victor Mono + Sakura overrides
│   └── app.js               # Filter logic, theme toggle, rendering
├── dist/                   # Generated output (committed by CI)
├── .github/workflows/
│   └── build.yml           # CI: generate -> commit -> deploy to Pages
├── package.json
└── README.md
```

## License

MIT — do whatever you like with it.
