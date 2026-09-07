#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {
  /* dotenv is already a runtime dependency, but keep this check standalone. */
}

const root = path.join(__dirname, '..');
const browserRoots = [
  path.join(root, 'apps', 'admin'),
  path.join(root, 'client-portal.bundle.js'),
];
const forbidden = [
  'https://example.supabase.co',
  'demo-anon-key',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.SUPABASE_SECRET_KEY,
  process.env.BOOTSTRAP_SECRET,
].filter(Boolean);

function filesUnder(target) {
  if (!fs.existsSync(target)) return [];
  if (fs.statSync(target).isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) =>
    filesUnder(path.join(target, entry.name)),
  );
}

const files = browserRoots.flatMap(filesUnder);
const findings = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const value of forbidden) {
    if (content.includes(value)) {
      findings.push(path.relative(root, file));
      break;
    }
  }
}

if (findings.length) {
  console.error('[check-browser-build] Forbidden configuration found in browser output:');
  for (const file of findings) console.error(`  ${file}`);
  process.exit(1);
}

console.log('[check-browser-build] No placeholder or server-only credentials found in browser output.');