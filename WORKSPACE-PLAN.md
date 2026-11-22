# Workspace plan — keep the local folder small, keep everything in Git

Goal: the working folder stays around 4–5 MB. Git (github.com/euromilesofficial/Arena-Agent--WACRM) holds
every file, including build output, fonts, mockups and the zip. A file is removed locally only after it is
verified in Git. The workspace has no `.git`.

## 1. Three tiers of files

| Tier | What | Where it lives | Why |
|---|---|---|---|
| **Working set** | `src/` (except generated data), `scripts/`, `qa_*.py`, `*.md` specs, config (`package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `handover.config.json`, `serve.py`), `templates/`, `.gitignore` | Local, always | What we build, develop and modify |
| **Generated** | `WACRM-CMS.html` (single-file app), `release/wacrm-app.zip`, `src/lib/theme-font-data.ts` (font data), `dist/`, `qa/` captures | Git. Local only while a build or test needs them | Rebuilt from the working set at any time |
| **Reference** | Mockups and uploads (`uploads/`, `workspace-extras/`) | Git only, listed in `GIT-REFERENCE.md` | Read rarely; fetched when needed |
| **Caches** | `node_modules/` | Local during a session, removed after | Rebuilt with `npm ci` from `package-lock.json` |

## 2. The working cycle

1. **Start.** Fetch only what the task needs: `bash scripts/git-fetch.sh <path>`. `--list` shows what is only in Git.
2. **Edit.** Change the working set. These are the only files that get edited by hand.
3. **Build and test.** `bash scripts/lean-build.sh`. It fetches the font data if missing, installs dependencies if
   missing, runs `npm run build`, and moves the zip into `release/`. The QA suites read `WACRM-CMS.html`, so run this first.
4. **Save.** `bash scripts/git-sync.sh "what changed"`. It copies the working set and the generated output into a
   temporary clone, commits, pushes and checks the remote head.
5. **Clean.** `bash scripts/workspace-clean.sh` (dry run) then `bash scripts/workspace-clean.sh --apply`. It removes
   `node_modules/`, `dist/`, `WACRM-CMS.html`, `release/`, `theme-font-data.ts`, `qa/` captures and stray zips. Before
   deleting any file, it confirms that the same content is in GitHub. A file that cannot be confirmed is kept and reported.

## 3. Rules

- Never delete a generated file that is not confirmed in Git. Caches (`node_modules/`, `dist/`) are rebuilt from the lockfile and the source, so they are removed without that check.
- Never commit `node_modules/`, `dist/`, tokens (`.gh-token*`), `.env*` or `*.pyc`.
- Run the QA suites only after `lean-build.sh`, so they test the current build.
- Each save adds the generated outputs to Git. Keep the number of saves per release low, because each build adds a few MB to the repository history.
- The full `qa-all` run takes about 25 minutes. Run it in the background and poll the log.

## 4. What is kept locally (approximate sizes)

Working set about 4 MB, of which `src/` is about 2.4 MB. Everything else is removed after a session.
