# PDF Viewer
PDF viewer with flip-book interface integration to allow read files flipping pages like a book.

## Info
This is a web viewer written in javascript with no external dependencies. It works with almost every browser.

Try it now [HERE](https://raffaelemorganti.github.io/pdf-viewer/)

## Quick start (local preview)

No build step. Dependencies for the **viewer UI** are already bundled under `external/`.

For **Supabase-backed flipbooks**, install Node.js 18+ and run the API server:

```bash
cp .env.example .env
# Add SUPABASE_SERVICE_ROLE_KEY to .env.local (see .env.local.example)
npm install
npm run setup:supabase
npm start
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000/ | Home — create or view sample |
| http://localhost:3000/create/ | Upload PDF and get share link |
| http://localhost:3000/view/{token} | Shareable flipbook link for clients |

## Supabase setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor (creates bucket + tables).
   - If upgrading an existing database, run [`supabase/migrations/001_add_view_type.sql`](supabase/migrations/001_add_view_type.sql) or `npm run migrate:view-type` (requires `DATABASE_URL` in `.env.local`).
3. Copy **Project URL** and **service_role key** into `.env` (never expose service role to the browser).
   - Or put the secret in `.env.local` (see `.env.local.example`) so it overrides `.env`.
   - Your URL: `https://phftvaptlqibllkqcduf.supabase.co`
   - Do **not** use the publishable key (`sb_publishable_...`) as `SUPABASE_SERVICE_ROLE_KEY`.
4. Run schema setup:

```bash
npm run setup:supabase
```

This creates the `pdfs` bucket and verifies tables (or runs `schema.sql` if `DATABASE_URL` is set).

### Create and share flow

1. Open `/create/` and choose **Brochure** or **Flyer**, then upload a PDF.
2. Copy the share link (`/view/{token}`) and send it to your client.
3. The viewer opens in the selected mode automatically.

| Type | PDF | Viewer |
|------|-----|--------|
| **Brochure** | Any page count | Book flip (turn.js double-page spread) |
| **Flyer** | 6 pages (outside 1–3, inside 4–6) | Trifold — 3 panels side-by-side, fold transition between spreads |

Brochure links use page-flip mode. Flyer links use trifold layout (pages 1–3, then 4–6). Non-6-page flyers still open with a warning banner.

## Production deployment

### Netlify (recommended for this repo)

The site is configured for Netlify via [`netlify.toml`](netlify.toml). Static assets are served from the CDN; API routes run as Netlify Functions. PDF uploads go **directly to Supabase Storage** (signed URLs), so large files work despite Netlify’s function size limits.

1. **Push this repo to GitHub** (Netlify deploys from git). The commit must include [`netlify.toml`](netlify.toml), [`netlify/functions/`](netlify/functions/), [`create/`](create/), and [`server/lib/`](server/lib/).
2. In **Site configuration → Build & deploy**, confirm:
   - **Base directory:** *(empty)*
   - **Build command:** `npm install` *(or leave blank — [`netlify.toml`](netlify.toml) sets this)*
   - **Publish directory:** `.` *(not `dist` or `build`)*
3. Set environment variables under **Site settings → Environment variables**:
   - `BASE_URL` — your Netlify URL, e.g. `https://your-site.netlify.app`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` (`pdfs`)
   - `DEFAULT_LINK_EXPIRY_HOURS` (`168`)
   - For `SUPABASE_SERVICE_ROLE_KEY`, paste **only the key value** in the Value field (starts with `eyJ...` or `sb_secret_...`). Do **not** include `SUPABASE_SERVICE_ROLE_KEY=` in the value.
3. Run [`supabase/schema.sql`](supabase/schema.sql) and [`supabase/migrations/001_add_view_type.sql`](supabase/migrations/001_add_view_type.sql) in the Supabase SQL Editor if not already applied.
4. After deploy, confirm the deploy log lists **4 functions** (`api-health`, `api-documents-prepare`, `api-links`, `view`).
5. Verify `GET /api/health` returns `{ "ok": true, "supabaseOk": true }`.
6. Open a share link `/view/<token>` — should redirect to the flipbook viewer (not Netlify “Page not found”).
7. Run `npm run validate:env` locally to check your key before deploying.

### Node.js web service (Render, Railway, Fly.io)

Deploy as a **Node.js web service** if you prefer a single long-running server:

- **Start command:** `npm start` (or `node server/index.js`)
- **Environment:** copy all variables from `.env.example`
- **HTTPS:** required in production; set `BASE_URL=https://your-domain.com`
- [`render.yaml`](render.yaml) is included for Render Blueprint deploys.

**Security:** keep `SUPABASE_SERVICE_ROLE_KEY` server-side only; uploads are open (rate-limited). Add auth later if needed.

Client mode (`?client=1`) hides Open/Download controls for shared links.

## Requirements
Despite no external dependencies in order to build this project some external script are included:

* jQuery 3.4.1 downloaded [here](https://jquery.com/download/).
* PDF.js 2.1.266 downloaded [here](https://mozilla.github.io/pdf.js/getting_started/#download).
* turn.js 4.1.0 downloaded [here](http://www.turnjs.com/).

## Develop
If you want to add features feel free to make a PR.
To help you to understand how it works here a list of modified files in order to accomplish this result:

| Type | Path | Files |
| --- | --- | --- |
| JS |  ./external/pdfjs/ | viewer.js  |
| HTML | ./external/pdfjs/ | index.html |
| ALL | ./pdf-turn/ | ***NEW*** |


Any change in files not listed as NEW is marked with a `$FB:` comment. Files listed as NEW are build to accomplish final result.
Other files come directly from specified source without any edit. External libraries files not used were deleted to make the source slimmer and clearer.

## Known problems
* __Book Flip__ texts are not included in PDF.js locales, so are not translated to the user language. In order to solve this you should go in _'pdfjs/locale/YOUR_LANG'_ and add to the _'viewer.properties'_ file following lines:
```
book_flip.title = Flip pages like a book
book_flip_label = Flip book
```
* If you find any other bug open a new Issue

## License
This project is released under [MIT License](https://github.com/RaffaeleMorganti/pdf-viewer/blob/master/LICENSE) however some code come from external with following licenses:

* jQuery released under [MIT License](https://github.com/jquery/jquery/blob/master/LICENSE.txt)
* PDF.js released under [Apache License](https://github.com/mozilla/pdf.js/blob/master/LICENSE)
* turn.js released under [BSD License](https://github.com/blasten/turn.js/blob/master/license.txt)
