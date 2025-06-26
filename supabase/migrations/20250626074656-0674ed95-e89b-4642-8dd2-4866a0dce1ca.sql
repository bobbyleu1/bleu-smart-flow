
-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read team profiles" ON public.profiles;

-- Create comprehensive policies for profile access
-- Allow users to read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow users to read profiles from the same company
CREATE POLICY "Users can read team profiles" ON public.profiles
  FOR SELECT USING (
    company_id IS NOT NULL AND 
    company_id = (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );
