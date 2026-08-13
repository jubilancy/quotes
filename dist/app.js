// app.js — theme toggle + quote filtering/sorting, all client-side.
// No build step: this file runs as-is in the browser.

(function () {
  "use strict";

  const THEME_KEY = "quotes-theme";

  /* ----------------------------------------------------------------
     Theme toggle (light / dark / system)
     ---------------------------------------------------------------- */

  function initThemeToggle() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;

    function currentEffectiveTheme() {
      const explicit = document.documentElement.getAttribute("data-theme");
      if (explicit === "light" || explicit === "dark") return explicit;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    function applyTheme(theme) {
      // theme is "light" | "dark" | null (null = follow system)
      if (theme) {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem(THEME_KEY, theme);
      } else {
        document.documentElement.removeAttribute("data-theme");
        localStorage.removeItem(THEME_KEY);
      }
    }

    btn.addEventListener("click", function () {
      const effective = currentEffectiveTheme();
      const next = effective === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  }

  /* ----------------------------------------------------------------
     Data loading
     ---------------------------------------------------------------- */

  function loadJson(path) {
    return fetch(path).then(function (res) {
      if (!res.ok) throw new Error("Failed to load " + path + " (" + res.status + ")");
      return res.json();
    });
  }

  /* ----------------------------------------------------------------
     Browse page (index.html)
     ---------------------------------------------------------------- */

  function initBrowsePage() {
    const list = document.getElementById("quote-list");
    if (!list) return; // not on the browse page

    const tagRow = document.getElementById("tag-filter-row");
    const sortSelect = document.getElementById("sort-select");
    const authorSelect = document.getElementById("author-select");
    const clearBtn = document.getElementById("clear-filters");
    const resultsCount = document.getElementById("results-count");

    const state = {
      quotes: [],
      activeTags: new Set(),
      sort: "none",
      author: "",
    };

    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }

    function readStateFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const tagsParam = params.get("tags");
      if (tagsParam) {
        tagsParam.split(",").forEach(function (t) {
          if (t) state.activeTags.add(t);
        });
      }
      const sortParam = params.get("sort");
      if (sortParam) state.sort = sortParam;
      const authorParam = params.get("author");
      if (authorParam) state.author = authorParam;
    }

    function writeStateToUrl() {
      const params = new URLSearchParams();
      if (state.activeTags.size) params.set("tags", Array.from(state.activeTags).join(","));
      if (state.sort !== "none") params.set("sort", state.sort);
      if (state.author) params.set("author", state.author);
      const qs = params.toString();
      const newUrl = window.location.pathname + (qs ? "?" + qs : "");
      window.history.replaceState(null, "", newUrl);
    }

    function renderTagChips() {
      const allTags = new Set();
      state.quotes.forEach(function (q) {
        q.tags.forEach(function (t) {
          allTags.add(t);
        });
      });
      const sorted = Array.from(allTags).sort(function (a, b) {
        return a.localeCompare(b);
      });

      tagRow.querySelectorAll(".tag-chip").forEach(function (el) {
        el.remove();
      });

      sorted.forEach(function (tag) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "tag-chip";
        chip.textContent = tag;
        chip.setAttribute("aria-pressed", state.activeTags.has(tag) ? "true" : "false");
        chip.addEventListener("click", function () {
          if (state.activeTags.has(tag)) {
            state.activeTags.delete(tag);
          } else {
            state.activeTags.add(tag);
          }
          render();
        });
        tagRow.appendChild(chip);
      });
    }

    function renderAuthorOptions() {
      const authors = Array.from(new Set(state.quotes.map(function (q) { return q.author; }))).sort(function (a, b) {
        return a.localeCompare(b);
      });
      authorSelect.querySelectorAll("option:not([value=''])").forEach(function (opt) {
        opt.remove();
      });
      authors.forEach(function (author) {
        const opt = document.createElement("option");
        opt.value = author;
        opt.textContent = author;
        authorSelect.appendChild(opt);
      });
      authorSelect.value = state.author;
    }

    function applyFiltersAndSort() {
      let result = state.quotes.slice();

      if (state.activeTags.size) {
        result = result.filter(function (q) {
          for (const tag of state.activeTags) {
            if (!q.tags.includes(tag)) return false;
          }
          return true;
        });
      }

      if (state.author) {
        result = result.filter(function (q) {
          return q.author === state.author;
        });
      }

      switch (state.sort) {
        case "author-asc":
          result.sort(function (a, b) { return a.author.localeCompare(b.author); });
          break;
        case "author-desc":
          result.sort(function (a, b) { return b.author.localeCompare(a.author); });
          break;
        case "quote-asc":
          result.sort(function (a, b) { return a.quote.localeCompare(b.quote); });
          break;
        case "quote-desc":
          result.sort(function (a, b) { return b.quote.localeCompare(a.quote); });
          break;
        default:
          break; // keep CSV order
      }

      return result;
    }

    function renderQuoteCards(quotes) {
      list.innerHTML = "";

      if (!quotes.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No quotes match the current filters.";
        list.appendChild(empty);
        return;
      }

      quotes.forEach(function (q) {
        const card = document.createElement("article");
        card.className = "quote-card";

        const bq = document.createElement("blockquote");
        bq.textContent = q.quote;
        card.appendChild(bq);

        const meta = document.createElement("div");
        meta.className = "quote-meta";

        const authorEl = document.createElement("span");
        authorEl.className = "quote-author";
        authorEl.textContent = q.author;
        meta.appendChild(authorEl);

        if (q.source) {
          const sourceEl = document.createElement("span");
          sourceEl.className = "quote-source";
          sourceEl.textContent = q.source;
          meta.appendChild(sourceEl);
        }

        card.appendChild(meta);

        if (q.tags.length) {
          const tagsEl = document.createElement("div");
          tagsEl.className = "quote-tags";
          q.tags.forEach(function (tag) {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "tag-chip";
            chip.textContent = tag;
            chip.setAttribute("aria-pressed", state.activeTags.has(tag) ? "true" : "false");
            chip.addEventListener("click", function () {
              if (state.activeTags.has(tag)) {
                state.activeTags.delete(tag);
              } else {
                state.activeTags.add(tag);
              }
              render();
            });
            tagsEl.appendChild(chip);
          });
          card.appendChild(tagsEl);
        }

        list.appendChild(card);
      });
    }

    function render() {
      renderTagChips();
      const filtered = applyFiltersAndSort();
      renderQuoteCards(filtered);
      resultsCount.textContent =
        filtered.length + (filtered.length === 1 ? " quote" : " quotes") +
        (filtered.length !== state.quotes.length ? " of " + state.quotes.length : "");
      writeStateToUrl();
    }

    sortSelect.addEventListener("change", function () {
      state.sort = sortSelect.value;
      render();
    });

    authorSelect.addEventListener("change", function () {
      state.author = authorSelect.value;
      render();
    });

    clearBtn.addEventListener("click", function () {
      state.activeTags.clear();
      state.sort = "none";
      state.author = "";
      sortSelect.value = "none";
      render();
    });

    loadJson("quotes.json")
      .then(function (quotes) {
        state.quotes = quotes;
        readStateFromUrl();
        sortSelect.value = state.sort;
        renderAuthorOptions();
        render();
      })
      .catch(function (err) {
        list.innerHTML = '<p class="empty-state">Could not load quotes: ' + escapeHtml(err.message) + "</p>";
      });
  }

  /* ----------------------------------------------------------------
     Tags page (tags.html)
     ---------------------------------------------------------------- */

  function initTagsPage() {
    const grid = document.getElementById("tags-grid");
    if (!grid) return;

    loadJson("meta.json")
      .then(function (meta) {
        if (!meta.tags.length) {
          grid.innerHTML = '<p class="empty-state">No tags yet.</p>';
          return;
        }
        meta.tags.forEach(function (tag) {
          const a = document.createElement("a");
          a.href = "index.html?tags=" + encodeURIComponent(tag.name);
          a.innerHTML = tag.name + '<span class="count">' + tag.count + "</span>";
          grid.appendChild(a);
        });
      })
      .catch(function (err) {
        grid.innerHTML = '<p class="empty-state">Could not load tags: ' + err.message + "</p>";
      });
  }

  /* ----------------------------------------------------------------
     Sources page (sources.html)
     ---------------------------------------------------------------- */

  function initSourcesPage() {
    const listEl = document.getElementById("sources-list");
    if (!listEl) return;

    loadJson("meta.json")
      .then(function (meta) {
        if (!meta.sources.length) {
          listEl.innerHTML = '<p class="empty-state">No sources on file yet.</p>';
          return;
        }
        meta.sources.forEach(function (source) {
          const li = document.createElement("li");
          const label = document.createElement("span");
          label.textContent = source.name;
          const count = document.createElement("span");
          count.className = "count";
          count.textContent = source.count + (source.count === 1 ? " quote" : " quotes");
          li.appendChild(label);
          li.appendChild(count);
          listEl.appendChild(li);
        });
      })
      .catch(function (err) {
        listEl.innerHTML = '<p class="empty-state">Could not load sources: ' + err.message + "</p>";
      });
  }

  /* ----------------------------------------------------------------
     Authors page (authors.html)
     ---------------------------------------------------------------- */

  function initAuthorsPage() {
    const grid = document.getElementById("authors-grid");
    if (!grid) return;

    loadJson("meta.json")
      .then(function (meta) {
        if (!meta.authors.length) {
          grid.innerHTML = '<p class="empty-state">No authors yet.</p>';
          return;
        }
        meta.authors.forEach(function (author) {
          const a = document.createElement("a");
          a.href = "index.html?author=" + encodeURIComponent(author.name);
          a.innerHTML = author.name + '<span class="count">' + author.count + "</span>";
          grid.appendChild(a);
        });
      })
      .catch(function (err) {
        grid.innerHTML = '<p class="empty-state">Could not load authors: ' + err.message + "</p>";
      });
  }

  /* ----------------------------------------------------------------
     Init
     ---------------------------------------------------------------- */

  document.addEventListener("DOMContentLoaded", function () {
    initThemeToggle();
    initBrowsePage();
    initTagsPage();
    initSourcesPage();
    initAuthorsPage();
  });
})();
