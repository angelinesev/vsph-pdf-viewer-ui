#!/usr/bin/env node
/**
 * Verify live Netlify deployment for share-link viewer support.
 * Usage: node scripts/verify-netlify.js [siteUrl]
 * Optional: VERIFY_TOKEN=<share-token> node scripts/verify-netlify.js
 */
const https = require('https');

const SITE = (process.argv[2] || process.env.BASE_URL || 'https://vsph-pdfviewer.netlify.app')
  .replace(/\/$/, '');

function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SITE);
    https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    }).on('error', reject);
  });
}

function isNetlifyStatic404(res) {
  return res.status === 404 && res.body.includes('Page not found') && res.body.includes('<!DOCTYPE html>');
}

async function main() {
  console.log(`Checking ${SITE}...\n`);

  const health = await get('/api/health');
  let healthJson = null;
  try {
    healthJson = JSON.parse(health.body);
  } catch {
    /* ignore */
  }

  console.log(`/api/health -> ${health.status}`);
  if (healthJson) {
    console.log(`  supabaseOk: ${healthJson.supabaseOk}`);
    console.log(`  baseUrl: ${healthJson.baseUrl}`);
    if (healthJson.baseUrl && healthJson.baseUrl !== SITE) {
      console.log(`  WARN: set BASE_URL on Netlify to ${SITE}`);
    }
    if (healthJson.hint) console.log(`  hint: ${healthJson.hint}`);
  }

  const viewFn = await get('/.netlify/functions/view/test-token');
  console.log(`\n/.netlify/functions/view/test-token -> ${viewFn.status}`);
  if (isNetlifyStatic404(viewFn)) {
    console.log('  FAIL: view function not deployed');
  } else {
    console.log('  OK: view function is deployed');
  }

  const pdfFn = await get('/.netlify/functions/api-pdf-url/test-token');
  console.log(`\n/.netlify/functions/api-pdf-url/test-token -> ${pdfFn.status}`);
  if (isNetlifyStatic404(pdfFn)) {
    console.log('  FAIL: api-pdf-url function not deployed');
  } else {
    console.log('  OK: api-pdf-url function is deployed');
  }

  const pdfProxy = await get('/.netlify/functions/api-pdf/test-token');
  console.log(`\n/.netlify/functions/api-pdf/test-token -> ${pdfProxy.status}`);
  if (isNetlifyStatic404(pdfProxy)) {
    console.log('  WARN: api-pdf function not deployed (optional for large PDFs)');
  } else {
    console.log('  OK: api-pdf function is deployed');
  }

  const viewRoute = await get('/view/test-token');
  console.log(`\n/view/test-token -> ${viewRoute.status}`);
  if (isNetlifyStatic404(viewRoute)) {
    console.log('  FAIL: /view/* redirect or function missing');
  } else {
    console.log('  OK: /view route handled by app');
  }

  const token = process.env.VERIFY_TOKEN;
  if (token) {
    const viewRes = await get(`/view/${token}?view=brochure`);
    const loc = viewRes.headers.location || '';
    console.log(`\n/view/${token} -> ${viewRes.status}`);
    if (viewRes.status === 302 && (
      loc.includes('api%2Fpdf')
      || loc.includes('/api/pdf/')
    )) {
      console.log('  OK: redirect includes short /api/pdf token URL');
    } else {
      console.log(`  FAIL: unexpected redirect: ${loc || viewRes.body.slice(0, 80)}`);
    }

    const pdfUrlRes = await get(`/api/pdf-url/${token}`);
    console.log(`\n/api/pdf-url/${token} -> ${pdfUrlRes.status}`);
    let pdfUrlJson = null;
    try { pdfUrlJson = JSON.parse(pdfUrlRes.body); } catch { /* ignore */ }
    if (pdfUrlRes.status === 200 && pdfUrlJson?.url?.includes('supabase.co')) {
      console.log('  OK: signed PDF URL returned');
    } else {
      console.log('  FAIL: api-pdf-url did not return signed URL');
    }
  }

  const failed =
    !healthJson?.supabaseOk
    || healthJson?.baseUrl !== SITE
    || isNetlifyStatic404(viewFn)
    || isNetlifyStatic404(pdfFn)
    || isNetlifyStatic404(viewRoute);

  if (failed) {
    console.log('\nVerification FAILED. Redeploy with: npm run deploy:netlify');
    process.exit(1);
  }

  console.log('\nVerification passed.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
