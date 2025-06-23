
-- Create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  company_id UUID,
  role TEXT DEFAULT 'invoice_owner',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies to allow users to read and write their own profiles
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create policy to allow users to read profiles with same company_id (for team features)
CREATE POLICY "Users can read team profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id = public.profiles.company_id
    )
  );

-- Create an index on company_id for better performance
CREATE INDEX IF NOT EXISTS profiles_company_id_idx ON public.profiles(company_id);

-- Create an index on email for better performance
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
