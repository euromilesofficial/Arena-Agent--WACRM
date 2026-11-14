# Reference mocks (source material for every module)

The screenshots the product was specified against — the visual builder mock with the **AI Copy** chip, ten dashboard frames, the Sites & Domains / Pages / Overview / Spec dashboards, and a stray `vite.config.ts` that arrived with them.

**16 images · 2.9 MB · WebP q86.** The originals were 1672×941 (a few 1536×1024) PNGs totalling **27.1 MB**; at q86 WebP they are 10.8 % of that with no visible loss — text in the builder mock, including 9 px inspector labels, is still crisp. PNG is a terrible format for flat UI at this size and every extra second of `git clone` was paying for it.

They live **in Git, and only in Git**. The working copies are marked `skip-worktree` and removed from disk: a committed file otherwise costs twice (once in `.git`, once in the tree). Reading one needs no restore at all:

```bash
# one file, straight out of the object store
git -C /home/user/repo show HEAD:"uploads/EuroMiles Study Abroad Visual Builder.webp" > /tmp/builder.webp

# list them / verify integrity
git -C /home/user/repo ls-tree --name-only HEAD uploads/
cd /home/user/repo/uploads && sha256sum -c MANIFEST.sha256     # after materialising

# materialise the folder again (only if a tool needs real files)
git -C /home/user/repo update-index --no-skip-worktree $(git -C /home/user/repo ls-files uploads)
git -C /home/user/repo checkout -- uploads
# …and hide it again when finished
git -C /home/user/repo update-index --skip-worktree $(git -C /home/user/repo ls-files uploads)
rm -rf /home/user/repo/uploads
```

## What each file is

| File | Role |
|---|---|
| `EuroMiles Study Abroad Visual Builder.webp` | the builder mock — three panels, and the **AI Copy** popover over the hero heading that became §2 of `AI-BUILDER-SPEC.md` |
| `ChatGPT Image … 07_03_43 … 07_04_00 AM-1…10.webp` | ten 1672×941 frames: builder states, device morphs, inspector and library variants |
| `WACRM Pages CMS Dashboard.webp` | the Pages registry layout (Module 3) |
| `WACRM Sites & Domains Dashboard.webp` | Module 2 layout |
| `WACRM Website CMS Dashboard Overview.webp` | Module 1 dashboard |
| `WACRM Website CMS Dashboard Spec.webp` | the overview's written spec |
| `Screenshot 2026-11-13 at 9.20.58 AM.webp` | supporting state capture |
| `vite.config.ts` | arrived with the mocks; kept for completeness, not used by the build |

## If a mock is ever needed again at full fidelity

The PNG originals are gone from this repository on purpose (rewriting history to purge them is what took `.git` from 33 MB to 9 MB). Re-export a WebP back to PNG with `python3 -c "from PIL import Image; Image.open('x.webp').save('x.png')"` — the WebP is an 8-bit lossless-in-appearance render of the same pixels at the same dimensions, so nothing about the layout, spacing or colour you would measure from it changes.
