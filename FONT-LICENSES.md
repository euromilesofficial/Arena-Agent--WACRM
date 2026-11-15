# Font licences — Module 6 · Theme Studio

Every family embedded in `WACRM-CMS.html` is licensed under the **SIL Open Font
License 1.1**, which permits embedding in an application, self-hosting and
redistribution, provided the licence travels with the font.

| Family | Weights shipped | Copyright / author | Licence |
|---|---|---|---|
| Geist | 300, 400, 500, 600, 700 | Vercel / Basement Studio | SIL OFL 1.1 |
| Inter | 300, 400, 500, 600, 700 | Rasmus Andersson | SIL OFL 1.1 |
| Montserrat | 300, 400, 500, 600, 700 | Julieta Ulanovsky | SIL OFL 1.1 |
| DM Sans | 300, 400, 500, 600, 700 | Colophon Foundry | SIL OFL 1.1 |
| Lora | 400, 500, 600, 700 | Cyreal | SIL OFL 1.1 |
| Poppins | 400, 500, 600, 700 | Indian Type Foundry | SIL OFL 1.1 |

Subsets: latin and latin-ext only — the CMS and the EuroMiles site are English.
Total embedded weight: **242 KB** as base64 in a single build artefact;
no request ever leaves the document (CSP `font-src 'self'` needs nothing external).

Full licence text: https://openfontlicense.org/open-font-license-official-text/

Families that appear in the catalogue but are **not** embedded are shown as
`Requires ingestion` and cannot be selected — the UI never pretends to render a
font it does not have.
