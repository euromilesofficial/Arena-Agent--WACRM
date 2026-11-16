# Prebuilt templates

Third-party, single-file HTML templates used by **Layouts & Templates → Prebuilt** (Module 7).

- **Source** — `https://github.com/mmrahmanbappi/free-html-templates`, branch `main`,
  commit `bab6ec6c8900`. MIT, upstream licence text in `LICENSE-MIT.txt`.
- **How they got here** — `node scripts/fetch-prebuilt.mjs` downloads the 14 selected pages,
  strips `<script>`, `<style>`, `<noscript>`, media embeds, inline `on*` handlers and inline
  `<svg>`, collapses whitespace and writes three outputs:
  1. `templates/prebuilt/<id>.html` — the cleaned page (committed, reviewable in Git)
  2. `templates/PROVENANCE.md` — generated table: id, category, source path, raw vs cleaned
     bytes, commit
  3. `src/lib/prebuilt-kits.ts` — the same HTML inlined for the offline artefact
- **Why both** — the artefact cannot fetch at runtime (it opens from `file://` with no
  network), and the workspace must stay reviewable, so the HTML lives in Git *and* in the
  bundle. Re-running the script refreshes all three together; never edit the `.ts` by hand.
- **What is kept** — body semantics (`section`, `h1`–`h4`, `p`, `ul`, `table`, `form`,
  `blockquote`, `details`) and the business copy. That is exactly what the importer reads.
- **What is dropped, and why** — CSS never survives: the WACRM theme owns colour, type and
  spacing. This is why an imported page looks like a WACRM page, not like the original site.

Licence note: the templates are MIT, so the attribution requirement is satisfied by keeping
`LICENSE-MIT.txt` and the source commit in `PROVENANCE.md` in this repository.
