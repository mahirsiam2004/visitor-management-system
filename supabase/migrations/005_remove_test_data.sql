-- Migration 005: Remove any test/seed users that may have been inserted manually.
-- Safe to run even if these users don't exist (DELETE is a no-op if no rows match).

DELETE FROM public.profiles
WHERE email IN (
  'hanae.gamble@example.com',
  'regan.chen@example.com',
  'ursula.franco@example.com'
);

-- Also delete from auth.users if service-role access is available.
-- Run the following manually in the Supabase Auth dashboard or via service-role API:
--
--   SELECT id FROM auth.users
--   WHERE email IN (
--     'hanae.gamble@example.com',
--     'regan.chen@example.com',
--     'ursula.franco@example.com'
--   );
--
-- Then delete each auth user via the Supabase dashboard → Auth → Users.
