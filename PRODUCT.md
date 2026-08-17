# VSPH PDF Viewer

A product overview for leadership. For setup and deploy notes, see [README.md](README.md).

**Live site:** [https://vsph-pdfviewer.netlify.app](https://vsph-pdfviewer.netlify.app)

## What it is

VSPH PDF Viewer lets Virtual Studios host property and estate PDFs as interactive documents instead of a download-only file dump. Clients upload a brochure or flyer; we give them a clean link (or an embed) that opens in the browser as a flipbook or trifold. Each client is isolated from the others.

## Who uses it

- **VSPH admin** — onboards a client organization, issues an access code, and watches usage and which PDFs perform well.
- **Client (developer or estate team)** — signs in with that code, organizes work into projects, uploads PDFs, and shares them.
- **Public / buyer** — opens a link. No login.

## How it typically works

1. Admin creates an organization and an access code.
2. The client signs in at the [client portal](https://vsph-pdfviewer.netlify.app/) and creates a project (for example, Miravera).
3. They upload a PDF as a **brochure** (page-flip) or a **flyer** (trifold).
4. They copy a readable URL, a backup token link, or an embed snippet for a website.
5. The buyer opens it. The browser tab shows the brochure title, not a raw storage address.

The [admin portal](https://vsph-pdfviewer.netlify.app/admin/) is where VSPH staff manage organizations and see platform analytics.

## Features

### For clients

- **Projects** — folders for estates or developments, each with its own brochure list.
- **Brochure or flyer** — choose how the PDF should look when opened.
- **Quota meters** — how many brochures are in use and how much storage is left.
- **Share** — a pretty URL, a backup token link, and an iframe embed.
- **Stats** — opens, approximate unique visitors, and top country for each PDF (last 30 days).
- **Delete** — removes the file from storage, kills share links, and frees a plan slot.

### For admins

- **One plan (VSPH Plan)** — 100 brochures, 50 MB per upload, 15 GB storage per organization.
- **Organizations** — create a client, issue an access code, and see brochure count and storage.
- **Rotate vs revoke** — rotate replaces the code without shutting the account down; revoke archives the organization and locks its PDFs.
- **Analytics** — 30-day opens by organization and by PDF **title** (not an internal ID).
- **Export** — print or save a PDF report of one organization’s performance.

### For viewers

- Flipbook or flyer in the browser, on desktop or phone.
- The document title appears in the tab.
- The address bar stays a clean VSPH link, not a private storage URL.
- If an organization is archived, its links stop working.

## What it does not do

Deleted PDFs cannot be restored from the app. There is no public catalog of every client’s files; people only see what they were given a link to.
