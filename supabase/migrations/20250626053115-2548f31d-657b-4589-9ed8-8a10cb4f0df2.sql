
-- Add missing profile fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_connected BOOLEAN DEFAULT false;

-- Add missing jobs field
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS company_id UUID;

-- Update existing jobs to set company_id based on the user's profile
UPDATE public.jobs 
SET company_id = (
    SELECT p.company_id 
    FROM public.profiles p 
    JOIN public.clients c ON c.company_id = p.company_id 
    WHERE c.id = jobs.client_id
    LIMIT 1
)
WHERE company_id IS NULL;

-- Create RLS policies for jobs table to allow users to manage jobs for their company
CREATE POLICY "Users can view jobs for their company"
  ON public.jobs FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert jobs for their company"
  ON public.jobs FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update jobs for their company"
  ON public.jobs FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete jobs for their company"
  ON public.jobs FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Enable RLS on jobs table if not already enabled
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
