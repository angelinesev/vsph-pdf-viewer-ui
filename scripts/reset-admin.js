#!/usr/bin/env node
/**
 * Unlocks /admin/ bootstrap by clearing platform_admins.
 * Optional: --email you@company.com --delete-user  (removes the Auth user)
 * Optional: --email you@company.com --password newpass  (sets Auth password)
 */
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

function arg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || true;
}

async function findUserByEmail(supabase, email) {
  const target = String(email).trim().toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = (data?.users || []).find((u) => String(u.email || '').toLowerCase() === target);
    if (found) return found;
    if (!data?.users || data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const email = typeof arg('--email') === 'string' ? arg('--email') : null;
  const password = typeof arg('--password') === 'string' ? arg('--password') : null;
  const deleteUser = process.argv.includes('--delete-user');

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: admins, error: listError } = await supabase
    .from('platform_admins')
    .select('user_id, email, created_at');
  if (listError) throw new Error(listError.message);

  console.log(`platform_admins rows: ${(admins || []).length}`);
  (admins || []).forEach((a) => console.log(`  ${a.email || '(no email)'}  ${a.user_id}`));

  const { error: delError } = await supabase.from('platform_admins').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
  if (delError) {
    const { error: delAllError } = await supabase.from('platform_admins').delete().gte('created_at', '1970-01-01');
    if (delAllError) throw new Error(delAllError.message);
  }

  const { count } = await supabase.from('platform_admins').select('*', { count: 'exact', head: true });
  console.log(`Cleared platform_admins (remaining: ${count || 0}). Bootstrap is unlocked.`);

  if (email && deleteUser) {
    const user = await findUserByEmail(supabase, email);
    if (!user) {
      console.log(`No Auth user for ${email}`);
    } else {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) throw new Error(error.message);
      console.log(`Deleted Auth user ${email} (${user.id})`);
    }
  } else if (email && password) {
    const user = await findUserByEmail(supabase, email);
    if (!user) {
      console.log(`No Auth user for ${email}; bootstrap will create one.`);
    } else {
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
      });
      if (error) throw new Error(error.message);
      console.log(`Updated password for ${email}. You can Sign in after bootstrap, or bootstrap first.`);
    }
  }

  console.log('Next: open /admin/, enter email + password + BOOTSTRAP_SECRET, click Create first admin, then Sign in.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
