
-- Drop existing table if it exists to recreate with correct structure
DROP TABLE IF EXISTS public.jobs CASCADE;

-- Create jobs table with updated schema to match the application code
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_id UUID,
  price DECIMAL(10,2) NOT NULL,
  company_id UUID NOT NULL,
  status TEXT CHECK (status IN ('pending', 'paid', 'completed', 'test')) DEFAULT 'pending',
  payment_url TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  description TEXT,
  scheduled_date DATE,
  is_recurring BOOLEAN DEFAULT FALSE,
  frequency TEXT CHECK (frequency IN ('weekly', 'bi-weekly', 'monthly')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS jobs_company_id_idx ON public.jobs(company_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON public.jobs(status);
CREATE INDEX IF NOT EXISTS jobs_client_id_idx ON public.jobs(client_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

-- Create function to update updated_at column if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on jobs table
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
