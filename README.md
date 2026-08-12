# PDF Flipbook Viewer

Upload a PDF and share it as an interactive brochure (page-flip) or flyer (trifold). Built for Virtual Studios deployments on Netlify + Supabase.

Live site: [https://vsph-pdfviewer.netlify.app](https://vsph-pdfviewer.netlify.app)

## Quick start (local)

```bash
cp .env.example .env
# Add SUPABASE_SERVICE_ROLE_KEY to .env.local (see .env.local.example)
npm install
npm run setup:supabase
npm start
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000/ | Home |
| http://localhost:3000/create/ | Upload PDF and get a share link |
| http://localhost:3000/view/{token} | Shared flipbook |

## Supabase setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor.
   - Upgrades: [`supabase/migrations/001_add_view_type.sql`](supabase/migrations/001_add_view_type.sql) or `npm run migrate:view-type` (needs `DATABASE_URL` in `.env.local`).
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` / `.env.local`.
   - Use the **service_role** key only (never the publishable/anon key in that field).
4. Run `npm run setup:supabase` to create the `pdfs` bucket and verify tables.

### Create and share

1. Open `/create/` and choose **Brochure** or **Flyer**, then upload a PDF.
2. Copy the share link (`/view/{token}`). Links do not expire.
3. The viewer opens in the selected mode automatically.

| Type | PDF | Viewer |
|------|-----|--------|
| **Brochure** | Any page count | Book flip (turn.js double-page spread) |
| **Flyer** | 2-page landscape print sheet, 3 square/portrait pages, or 6 pages | Physical trifold — closed cover, left flap, full front, then flip to the back |

Flyer PDFs always use six virtual slots (front 1–3, back 4–5–0). Empty back slots stay blank paper and still flip.

- **2 landscape pages** (canonical print sheet, e.g. MIRAVERA ~12.8×8.5"): each page is sliced into 3 panels (outside + inside)
- **3 square or portrait pages**: pages 1–3 fill the front; the back is blank
- **6 pages** (portrait): pages 1–3 fronts, 4–6 backs (last page sits in slot 0)
- **1 wide sheet**: fronts only; back slots stay blank
- Other page counts still open, with a warning banner

Each click (or swipe / arrow) advances one fold. Input is locked until the flip finishes. The fully open 3-panel width is what fits to the screen.

## Production (Netlify)

```bash
npm install
npx netlify login
npx netlify link          # choose site: vsph-pdfviewer
npm run deploy:netlify
npm run verify:netlify
```

1. Deploy this project folder — Netlify needs [`netlify.toml`](netlify.toml), [`netlify/functions/`](netlify/functions/), and [`server/lib/`](server/lib/).
2. Site settings:
   - **Base directory:** *(empty)*
   - **Build command:** `npm install` (or leave blank — set in `netlify.toml`)
   - **Publish directory:** `.`
3. Environment variables:
   - `BASE_URL` — e.g. `https://vsph-pdfviewer.netlify.app`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` (`pdfs`)
   - Paste **only the key value** for `SUPABASE_SERVICE_ROLE_KEY` (starts with `eyJ...` or `sb_secret_...`).
4. Apply schema / migrations in Supabase if needed.
5. Confirm deploy lists functions: `api-health`, `api-documents-prepare`, `api-links`, `api-pdf-url`, `api-pdf`, `view`.
6. Check `GET /api/health` → `{ "ok": true, "supabaseOk": true }`.
7. Open `/view/<token>` — should redirect into the flipbook viewer.

### Node host (Render / Railway / Fly)

- Start: `npm start`
- Env: copy from `.env.example`
- Set `BASE_URL` to your HTTPS origin
- [`render.yaml`](render.yaml) is included for Render

Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only. Uploads are open (rate-limited).

Client mode (`?client=1`) hides Open/Download on shared links.

## Bundled libraries

- jQuery 3.4.1
- PDF.js 2.1.266
- turn.js 4.1.0

## License

MIT — see [LICENSE](LICENSE). Based on the original flip-book viewer by RaffaeleMorganti; this repo adds Supabase share links, Netlify functions, brochure/flyer modes, and related product changes.
