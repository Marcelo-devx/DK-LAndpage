-- Add column to categories to control age restriction badge
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS show_age_restriction boolean DEFAULT true;

-- Ensure existing rows have value true if null
UPDATE public.categories SET show_age_restriction = true WHERE show_age_restriction IS NULL;
