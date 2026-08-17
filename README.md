# Brochure SaaS (multi-tenant)

What this product does: see [PRODUCT.md](PRODUCT.md).

Upload PDFs as brochures or flyers per organization, with plan quotas, developer-code login, and an admin console. Public share links open the existing PDF.js flipbook / trifold viewer.

Live site: [https://vsph-pdfviewer.netlify.app](https://vsph-pdfviewer.netlify.app)

## Architecture

- **Admin portal** (`/admin/`) — Supabase Auth + `platform_admins`
- **Developer portal** (`/developer/`) — developer code + password → org session
- **SaaS API** — same-origin `/api/saas/*` on Netlify Functions / Express
- **Postgres** — `plans`, `organizations`, `developer_codes`, `brochures`, `brochure_links`, `usage_monthly`
- **Storage** — private `pdfs` bucket, org-prefixed paths, signed URLs
- **Viewer** — existing brochure/flyer engine under `external/` + `pdf-turn/`

## Quick start

```bash
cp .env.example .env
# Fill SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
# PUBLIC_BASE_URL, BOOTSTRAP_SECRET
npm install
node scripts/write-portal-config.js
```

1. In Supabase SQL Editor run:
   - [`supabase/schema.sql`](supabase/schema.sql)
   - [`supabase/migrations/002_multi_tenant.sql`](supabase/migrations/002_multi_tenant.sql)
2. Create the first admin via `/admin/` bootstrap (set `BOOTSTRAP_SECRET` in `.env` / Netlify) or SQL in [`supabase/migrations/003_bootstrap_admin.sql`](supabase/migrations/003_bootstrap_admin.sql).
3. Local Express:

```bash
npm start
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000/ | Home |
| http://localhost:3000/developer/ | Developer portal |
| http://localhost:3000/admin/ | Admin portal |
| http://localhost:3000/view/{token} | Public flipbook |

Optional: migrate old documents into the legacy org:

```bash
npm run migrate:tenancy
```

## Portals config

`apps/shared/config.js` is generated (gitignored). On Netlify the build runs `scripts/write-portal-config.js`. Locally:

```bash
node scripts/write-portal-config.js
```

It sets `functionsBase: "/api/saas"` (same origin).

## Admin flow

1. Sign in at `/admin/` with a `platform_admins` user (or Bootstrap first).
2. Create / review plans (Free / Pro seeded).
3. Create an organization and assign a plan.
4. Create a developer code + password for that org.

## Developer flow

1. Sign in at `/developer/` with code + password.
2. Upload a PDF (brochure or flyer) — blocked when monthly quota is exceeded.
3. Copy the share link; open `/view/{token}`.

## Netlify

```bash
npm run deploy:netlify
```

**Required env vars** (Site settings → Environment variables):

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | Anon JWT (portal + build config) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `SUPABASE_STORAGE_BUCKET` | `pdfs` |
| `PUBLIC_BASE_URL` / `BASE_URL` | `https://vsph-pdfviewer.netlify.app` |
| `BOOTSTRAP_SECRET` | First admin bootstrap at `/admin/` |

After deploy, open `/admin/`, enter email/password + bootstrap secret, click Bootstrap, then Sign in.

## License

MIT — see [LICENSE](LICENSE). Based on the original flip-book viewer by RaffaeleMorganti; this product adds multi-tenant SaaS and brochure/flyer modes.
