
-- Create receipts table to store generated receipts
CREATE TABLE public.receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL,
  session_id text NOT NULL,
  amount_paid integer NOT NULL,
  receipt_html text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add foreign key constraint to jobs table
ALTER TABLE public.receipts 
ADD CONSTRAINT receipts_job_id_fkey 
FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

-- Enable RLS on receipts table
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for receipts (accessible by job's company)
CREATE POLICY "Users can view receipts for their company jobs" 
ON public.receipts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.jobs 
    WHERE jobs.id = receipts.job_id 
    AND jobs.company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

-- Add receipt_id column to jobs table to link to receipts
ALTER TABLE public.jobs 
ADD COLUMN receipt_id uuid REFERENCES public.receipts(id);
