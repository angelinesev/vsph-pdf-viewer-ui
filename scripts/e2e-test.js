#!/usr/bin/env node
/**
 * End-to-end test: prepare upload, PUT to signed URL, create link, view redirect.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env or .env.local
 */
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const PORT = Number(process.env.PORT) || 3000;
const BASE = `http://localhost:${PORT}`;
const SAMPLE_PDF = path.join(
  __dirname,
  '..',
  'external',
  'pdfjs-2.1.266-dist',
  'web',
  'compressed.tracemonkey-pldi-09.pdf',
);

function request(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.request(
      url,
      { method, headers },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          const text = raw.toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            /* binary or non-json */
          }
          resolve({ status: res.statusCode, headers: res.headers, text, json, raw });
        });
      },
    );
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function externalPut(urlString, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(
      url,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': body.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') });
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(SAMPLE_PDF)) {
    throw new Error(`Sample PDF not found: ${SAMPLE_PDF}`);
  }

  const health = await request('GET', '/api/health');
  if (health.status !== 200 || !health.json?.supabaseOk) {
    throw new Error(
      health.json?.hint
        || 'Supabase not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local and run npm run setup:supabase',
    );
  }

  const pdf = fs.readFileSync(SAMPLE_PDF);
  const prepareBody = JSON.stringify({
    filename: 'sample.pdf',
    view_type: 'brochure',
    size_bytes: pdf.length,
  });

  const prepare = await request('POST', '/api/documents/prepare', {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(prepareBody),
  }, prepareBody);

  if (prepare.status !== 201) {
    throw new Error(`Prepare failed (${prepare.status}): ${prepare.text}`);
  }

  if (prepare.json.document.view_type !== 'brochure') {
    throw new Error(`Expected view_type brochure, got ${prepare.json.document.view_type}`);
  }

  const put = await externalPut(prepare.json.upload.signedUrl, pdf);
  if (put.status < 200 || put.status >= 300) {
    throw new Error(`Signed upload failed (${put.status}): ${put.text}`);
  }

  const linkBody = JSON.stringify({
    document_id: prepare.json.document.id,
    view_type: 'brochure',
  });

  const link = await request('POST', '/api/links', {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(linkBody),
  }, linkBody);

  if (link.status !== 201) {
    throw new Error(`Link failed (${link.status}): ${link.text}`);
  }

  if (link.json.view_type !== 'brochure') {
    throw new Error(`Expected link view_type brochure, got ${link.json.view_type}`);
  }

  const token = link.json.token;
  const pdfRes = await request('GET', `/api/pdf/${token}`);
  if (pdfRes.status !== 200) {
    throw new Error(`PDF proxy failed (${pdfRes.status}): ${pdfRes.text}`);
  }

  const view = await request('GET', `/view/${token}`);
  if (view.status !== 302) {
    throw new Error(`View redirect failed (${view.status})`);
  }

  const location = view.headers.location || '';
  if (!location.includes('view=brochure')) {
    throw new Error(`View redirect missing view=brochure: ${location}`);
  }

  const hasSameOriginPdf = location.includes('api%2Fpdf') || location.includes('/api/pdf/');
  if (!hasSameOriginPdf) {
    throw new Error(`View redirect missing /api/pdf token URL: ${location}`);
  }

  const flyerPrepareBody = JSON.stringify({
    filename: 'sample-flyer.pdf',
    view_type: 'flyer',
    size_bytes: pdf.length,
  });
  const flyerPrepare = await request('POST', '/api/documents/prepare', {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(flyerPrepareBody),
  }, flyerPrepareBody);
  if (flyerPrepare.status !== 201) {
    throw new Error(`Flyer prepare failed (${flyerPrepare.status}): ${flyerPrepare.text}`);
  }
  if (flyerPrepare.json.document.view_type !== 'flyer') {
    throw new Error(`Expected view_type flyer, got ${flyerPrepare.json.document.view_type}`);
  }

  const flyerPut = await externalPut(flyerPrepare.json.upload.signedUrl, pdf);
  if (flyerPut.status < 200 || flyerPut.status >= 300) {
    throw new Error(`Flyer signed upload failed (${flyerPut.status}): ${flyerPut.text}`);
  }

  const flyerLinkBody = JSON.stringify({
    document_id: flyerPrepare.json.document.id,
    view_type: 'flyer',
  });
  const flyerLink = await request('POST', '/api/links', {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(flyerLinkBody),
  }, flyerLinkBody);
  if (flyerLink.status !== 201) {
    throw new Error(`Flyer link failed (${flyerLink.status}): ${flyerLink.text}`);
  }
  if (flyerLink.json.view_type !== 'flyer') {
    throw new Error(`Expected link view_type flyer, got ${flyerLink.json.view_type}`);
  }
  if (!String(flyerLink.json.url || '').includes('view=flyer')) {
    throw new Error(`Flyer share URL missing view=flyer: ${flyerLink.json.url}`);
  }

  const flyerView = await request('GET', `/view/${flyerLink.json.token}?view=flyer`);
  if (flyerView.status !== 302) {
    throw new Error(`Flyer view redirect failed (${flyerView.status})`);
  }
  const flyerLocation = flyerView.headers.location || '';
  if (!flyerLocation.includes('view=flyer')) {
    throw new Error(`Flyer view redirect missing view=flyer: ${flyerLocation}`);
  }

  console.log('E2E passed');
  console.log(`Client URL: ${link.json.url}`);
  console.log(`Flyer URL: ${flyerLink.json.url}`);
}

main().catch((err) => {
  console.error(`E2E failed: ${err.message}`);
  process.exit(1);
});
