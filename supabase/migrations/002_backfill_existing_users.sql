-- Run this AFTER 001_initial_schema.sql
-- Backfills profile rows for any auth users that already exist
-- (created before the trigger was installed)

INSERT INTO public.profiles (id, email, full_name, phone_number, apartment_number, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.raw_user_meta_data->>'phone_number',
  u.raw_user_meta_data->>'apartment_number',
  COALESCE(u.raw_user_meta_data->>'role', 'resident')
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;
