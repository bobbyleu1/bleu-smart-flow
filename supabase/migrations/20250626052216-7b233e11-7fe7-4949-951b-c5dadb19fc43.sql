
-- First, let's add the missing columns to the profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_connected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

-- Add missing columns to jobs table to match the interface expectations
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS job_name TEXT,
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS company_id UUID,
ADD COLUMN IF NOT EXISTS payment_url TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Update existing data to populate the new columns
UPDATE public.jobs 
SET job_name = title 
WHERE job_name IS NULL;

-- Create the payments table that the PaymentsTab is trying to query
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- stored in cents
  payment_status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  card_saved BOOLEAN DEFAULT false,
  payment_method TEXT DEFAULT 'card',
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on payments table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Add foreign key relationship from jobs to clients if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'jobs_client_id_fkey'
    ) THEN
        ALTER TABLE public.jobs 
        ADD CONSTRAINT jobs_client_id_fkey 
        FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key from clients to profiles via company_id if it doesn't exist  
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'clients_company_id_fkey'
    ) THEN
        ALTER TABLE public.clients 
        ADD CONSTRAINT clients_company_id_fkey 
        FOREIGN KEY (company_id) REFERENCES public.profiles(company_id);
    END IF;
END $$;

-- Add trigger to update updated_at column for payments
CREATE OR REPLACE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
