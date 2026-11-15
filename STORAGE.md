# Where the bytes live

The workspace hit its 128 MB ceiling with five modules still to build. It is now **52 MB**,
and this file is the map — because the fix was not "delete things", it was "stop storing the
same bytes twice, and stop embedding fonts nobody picks".

## What was actually large

| Item | Was | Now |
|---|---|---|
| `src/lib/theme-font-data.ts` — base64 woff2 inside the artifact's source | **14.0 MB** (247 families) | **3.3 MB** (50) |
| `WACRM-CMS.html` — the single-file app, ~90 % of it those same font bytes | **15.5 MB** | **4.8 MB** |
| `wacrm-app.zip` | 31 MB | **3.6 MB** |
| a second full clone of the repo at `/home/user/repo` | **57 MB** | **gone** |
| `.git` | 36 MB | 16 MB after the repack below |

## The three changes

### 1 · The embedded font set is the top 50, not 247

```bash
npm run fonts                          # regenerate: 50 families, 2.48 MB of woff2
npm run fonts -- --only="Bebas Neue"   # or pull one family in from Google Fonts
```

The cut is ordered by Google popularity, with eighteen families pinned because the product
itself references them — the seeded theme documents and every pairing shortcut
(Geist, Inter, Poppins, DM Sans, Montserrat, Open Sans, DM Serif Display, Playfair Display,
Source Sans 3, Lora, Space Grotesk, Oswald, Roboto, Bebas Neue, Libre Baskerville,
Nunito Sans, Raleway, Merriweather). QA asserts that all twelve pairing chips resolve, so a
shortcut can never point at a face the build cannot render.

**The long tail is not a dead end.** The 1,746-family index is unchanged; every family
outside the 50 is searchable and carries a **Get** action that opens the exact command, a
copy button, and the production equivalent (`POST /theme/fonts/{family}/ingest`,
`BACKEND-PLAN §7.28.3`). QA covers it (14.14–14.21).

Saving: **11.6 MB of artifact, and ~10 MB more in the zip.**

### 2 · No mirror clone

`/home/user/repo` was a second copy of the entire project — worktree *and* history — purely
to have somewhere to commit. `wacrm-app/` is now the repository: one working tree, one
`.git`, nothing copied. `checkpoint.sh` builds, commits and pushes in place.

An earlier attempt used symlinks to share the big files between the two trees. It does **not**
work here: the workspace snapshot silently drops symlinks, so the files vanished and the
tree came back inconsistent. A single tree has nothing to drop.

Saving: **57 MB**.

### 3 · History repacked, then trimmed by the smaller artifacts

```
git gc --aggressive --prune=now
before  .git 36 MB   →   after 16 MB
```

The pack is now dominated by the **26 MB of reference mocks** — which have to stay in Git
(they are the source of truth for every module's mock, and a standing requirement). That is
the one part of the history that cannot be shrunk without deleting them.

## Where it stands

| | Before | After |
|---|---|---|
| whole workspace | **140.6 MB** (over the 128 MB cap) | **52 MB** |
| artifact | 15.5 MB | 4.8 MB |
| zip | 31 MB | 3.6 MB |
| clone | 57 MB | 0 |

Runtime cost of the trim: the picker's default list is 50 families instead of 247, and the
specimen/preview load 3.3 MB of font data instead of 14 MB — measurably faster first paint.
Nothing renders differently: every family the UI can name is still embedded.

## Final composition (52 MB)

```
29 MB  .git          26 MB of it the reference mocks · the rest is docs and the trimmed artifact
20 MB  working tree  artifact 4.8 MB · font source 3.3 MB · QA captures 9.5 MB · source ~2 MB
 3.7 MB zip
```

The QA captures are local only — gitignored and excluded from the zip — so deleting them
costs nothing but the screenshots; they are ~9.5 MB of the 52.
