
-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'failed')) DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  card_saved BOOLEAN DEFAULT false,
  payment_method TEXT DEFAULT 'stripe',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS payments_job_id_idx ON public.payments(job_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments(payment_status);

-- Enable RLS (Row Level Security)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view payments for their company's jobs"
  ON public.payments FOR SELECT
  USING (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.clients c ON j.client_id = c.id
      WHERE c.company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert payments for their company's jobs"
  ON public.payments FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.clients c ON j.client_id = c.id
      WHERE c.company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Create trigger to automatically update updated_at on payments table
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
