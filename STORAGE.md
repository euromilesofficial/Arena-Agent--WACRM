# Where the bytes live

The workspace was 119 MB with five modules still to build. It is now **78 MB** (55 MB of it Git history and the two artifacts, which have to exist somewhere), and this file is the map — because the reduction was not "delete things", it was "stop storing the same bytes three times".

## What was actually large

| Item | Size | Verdict |
|---|---|---|
| `src/lib/theme-font-data.ts` — 247 font families, base64 woff2 | **14.0 MB** | real, needed to build |
| `WACRM-CMS.html` — the single-file app, 90 % of it the same font bytes | **15.5 MB** | real, the deliverable |
| `wacrm-app.zip` | 31 MB | contained both of the above **again**, plus 9 MB of QA captures |
| `repo/.git` | 36 MB | history — the two big files again, plus 26 MB of reference mocks |
| `qa/` captures | 9.3 MB | evidence, regenerable |

Every one of those big files existed **three times**: the app folder, the Git clone, and the zip. Nothing was wrong with any of the artifacts — the layout was just wastefully built.

## What changed

### 1 · One copy on disk, via symlinks

`wacrm-app/` no longer stores its own copy of the two biggest files. It points at the clone, which is the copy Git owns:

```
wacrm-app/WACRM-CMS.html              -> ../repo/WACRM-CMS.html
wacrm-app/src/lib/theme-font-data.ts  -> ../../../repo/src/lib/theme-font-data.ts
```

Both directions still work, and that was the whole risk:

- **Building** writes through the link (`cp dist/index.html WACRM-CMS.html` follows it), so the clone's copy is always the current build — the failure mode where Git silently keeps an old artifact cannot happen by omission.
- **Reading** — the viewer, the package step's md5 check, `tsc`, Vite — all resolve the link normally. A full rebuild through the links produced **md5 `3b6612e18fc6…`, byte-identical to the pre-change artifact**, which is the proof that nothing shifted.
- `checkpoint.sh` excludes both paths from its tar mirror (a symlink copied over a real file would produce a self-referential link) and **restores the real file into the clone** if a fresh workspace ever presents a dangling one. It never stages a deletion of the artifact.
- `npm run build` and `npm run dev` start with `scripts/ensure-font-data.mjs`, which fails with instructions rather than building a fontless app if the link ever dangles.

Saving: **29.5 MB**.

### 2 · The zip stops carrying regenerable source

`npm run package` now omits `theme-font-data.ts`, `theme-font-catalog.ts` and `qa/` — all regenerable, all in Git:

```bash
npm run fonts     # regenerate the 247-family library from Google Fonts (--budget flag inside)
npm ci && npm run build   # rebuild the app itself
```

Zip: **31 MB → 11.4 MB**, 195 → 113 files, still opens by double-click, still verified against the build by md5 on every package. The console line names what was left out, so the omission is never a surprise.

Saving: **19.7 MB**.

### 3 · History repacked

```
before  .git 36 MB   (pack 35.6 MiB)
after   .git 26 MB   (pack 25.5 MiB)
```

`git gc --aggressive --prune=now`. The pack is now dominated by what it must carry: 26 MB of reference mocks (they belong in Git — that was a standing requirement) and the two big artifacts.

Saving: **10 MB**.

### 4 · Screenshots follow the WebP-only rule

The four stray `qa/*.png` files (1.7 MB) were deleted — JPEG/PNG captures were explicitly ruled out. 76 WebP captures remain, 7.7 MB, one per audited state.

## Where it stands

| | Before | After |
|---|---|---|
| app folder | 41 MB | **11 MB** |
| clone + history | 67 MB | **57 MB** |
| zip | 31 MB | **11 MB** |
| **snapshot total** | **~119 MB** | **78 MB** |

## What is left, and why it is the floor

```
26 MB  .git       history: 26 MB of mocks + the font artifact + every doc commit
31 MB  worktree   theme-font-data.ts 14.0 + WACRM-CMS.html 15.5 + source ~1.5
11 MB  app folder docs, source, QA captures, link stubs
12 MB  zip        the same HTML, deflated
```

The 29.5 MB of font bytes now exist **once on disk, once in Git**. They cannot go to zero: the app must render 247 families offline, which is what makes the artifact a single file that works with no network.

**If you want it smaller still, there is exactly one real lever: the font budget.** Dropping from 247 embedded families to ~150 (the top of Google's popularity list, still "ask for a font and it is there") takes the artifact from 15.5 MB to ~9.5 MB and would remove roughly 20 MB more across the three copies. The 1,746-family index, the picker, the licences and every other M6.1 surface stay exactly as they are — it is one number in `scripts/fetch-theme-fonts.mjs --budget`. Say the word and it is a five-minute change; I would not spend it silently, because "almost all the fonts in Google" was the explicit ask.
