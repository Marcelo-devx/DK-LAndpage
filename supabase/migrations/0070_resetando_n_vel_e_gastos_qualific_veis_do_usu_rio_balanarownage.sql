UPDATE public.profiles
SET 
  tier_id = 1,
  current_tier_name = 'Bronze',
  spend_last_6_months = 0
WHERE id = (SELECT id FROM auth.users WHERE email = 'balanarownage@gmail.com');