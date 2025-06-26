
-- Add phone_number column to the jobs table
ALTER TABLE public.jobs 
ADD COLUMN phone_number TEXT;

-- Add index for phone number queries (optional but good for performance)
CREATE INDEX IF NOT EXISTS jobs_phone_number_idx ON public.jobs(phone_number);
