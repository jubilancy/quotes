#!/usr/bin/env node
/**
 * generate.js
 *
 * Reads data/quotes.csv, validates it, and produces:
 *   dist/quotes.json   - all quotes as structured JSON
 *   dist/meta.json     - derived metadata (tags with counts, sources with counts)
 *   dist/index.html    - copied from src/, with build-time stats injected
 *   dist/about.html    - copied from src/
 *   dist/tags.html     - copied from src/
 *   dist/sources.html  - copied from src/
 *   dist/styles.css    - copied from src/
 *   dist/app.js        - copied from src/
 *
 * Run with: node scripts/generate.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.join(ROOT, "data", "quotes.csv");
const SRC_DIR = path.join(ROOT, "src");
const DIST_DIR = path.join(ROOT, "dist");

function fail(message) {
  console.error(`\n✖ Build failed: ${message}\n`);
  process.exit(1);
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function readCsv() {
  if (!fs.existsSync(CSV_PATH)) {
    fail(`CSV file not found at ${CSV_PATH}`);
  }
  const raw = fs.readFileSync(CSV_PATH, "utf-8");
  const parsed = Papa.parse(raw, {
    header: true,
    skipEmptyLines: true,
    transform: (value) => value.trim(),
  });

  if (parsed.errors && parsed.errors.length) {
    const first = parsed.errors[0];
    fail(`CSV parse error on row ${first.row}: ${first.message}`);
  }

  const requiredCols = ["quote", "author", "tags", "source"];
  const fields = parsed.meta.fields || [];
  for (const col of requiredCols) {
    if (!fields.includes(col)) {
      fail(`CSV is missing required column "${col}". Found columns: ${fields.join(", ")}`);
    }
  }

  return parsed.data;
}

function buildQuotes(rows) {
  const quotes = [];
  let skipped = 0;

  rows.forEach((row, i) => {
    const quoteText = (row.quote || "").trim();
    const author = (row.author || "").trim() || "Unknown";
    const tagsRaw = (row.tags || "").trim();
    const source = (row.source || "").trim();

    if (!quoteText) {
      skipped++;
      return;
    }

    const tags = tagsRaw
      ? tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    quotes.push({
      id: `q${i + 1}`,
      quote: quoteText,
      author,
      authorSlug: slugify(author),
      tags,
      source,
    });
  });

  if (skipped) {
    console.warn(`⚠ Skipped ${skipped} row(s) with empty quote text.`);
  }
  if (!quotes.length) {
    fail("No valid quotes found after parsing CSV.");
  }

  return quotes;
}

function buildMeta(quotes) {
  const tagCounts = new Map();
  const sourceCounts = new Map();
  const authorCounts = new Map();

  for (const q of quotes) {
    for (const tag of q.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
    if (q.source) {
      sourceCounts.set(q.source, (sourceCounts.get(q.source) || 0) + 1);
    }
    authorCounts.set(q.author, (authorCounts.get(q.author) || 0) + 1);
  }

  const toSortedArray = (map) =>
    Array.from(map.entries())
      .map(([name, count]) => ({ name, slug: slugify(name), count }))
      .sort((a, b) => a.name.localeCompare(b.name));

  return {
    generatedAt: new Date().toISOString(),
    totalQuotes: quotes.length,
    tags: toSortedArray(tagCounts),
    sources: toSortedArray(sourceCounts),
    authors: toSortedArray(authorCounts),
  };
}

function copyStaticFiles() {
  const filesToCopy = ["index.html", "about.html", "tags.html", "sources.html", "authors.html", "styles.css", "app.js"];
  for (const file of filesToCopy) {
    const from = path.join(SRC_DIR, file);
    const to = path.join(DIST_DIR, file);
    if (!fs.existsSync(from)) {
      fail(`Expected source file missing: ${from}`);
    }
    fs.copyFileSync(from, to);
  }
}

function writeJson(filename, data) {
  fs.writeFileSync(path.join(DIST_DIR, filename), JSON.stringify(data, null, 2), "utf-8");
}

function main() {
  console.log("→ Reading CSV...");
  const rows = readCsv();

  console.log("→ Building quote records...");
  const quotes = buildQuotes(rows);

  console.log("→ Deriving tags, sources, authors...");
  const meta = buildMeta(quotes);

  console.log("→ Preparing dist/ ...");
  fs.mkdirSync(DIST_DIR, { recursive: true });

  writeJson("quotes.json", quotes);
  writeJson("meta.json", meta);

  console.log("→ Copying static site files...");
  copyStaticFiles();

  console.log(
    `\n✔ Build complete: ${quotes.length} quotes, ${meta.tags.length} tags, ${meta.sources.length} sources.\n  Output: ${DIST_DIR}\n`
  );
}

main();
