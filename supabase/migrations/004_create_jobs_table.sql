
-- Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  scheduled_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  frequency TEXT CHECK (frequency IN ('weekly', 'bi-weekly', 'monthly')) DEFAULT 'weekly',
  status TEXT CHECK (status IN ('pending', 'paid', 'completed')) DEFAULT 'pending',
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stripe_checkout_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS jobs_client_id_idx ON public.jobs(client_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON public.jobs(status);
CREATE INDEX IF NOT EXISTS jobs_scheduled_date_idx ON public.jobs(scheduled_date);
CREATE INDEX IF NOT EXISTS jobs_is_recurring_idx ON public.jobs(is_recurring);

-- Enable RLS (Row Level Security)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view jobs for their company's clients"
  ON public.jobs FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert jobs for their company's clients"
  ON public.jobs FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update jobs for their company's clients"
  ON public.jobs FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete jobs for their company's clients"
  ON public.jobs FOR DELETE
  USING (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Create trigger to automatically update updated_at on jobs table
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
