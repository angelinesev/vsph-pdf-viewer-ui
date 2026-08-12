-- After creating a Supabase Auth user in the dashboard, promote them to platform admin:
--
-- insert into public.platform_admins (user_id, email)
-- values ('YOUR-AUTH-USER-UUID', 'you@company.com')
-- on conflict (user_id) do update set email = excluded.email;
--
-- Then sign in at /admin/ with that email/password.
select 1;
