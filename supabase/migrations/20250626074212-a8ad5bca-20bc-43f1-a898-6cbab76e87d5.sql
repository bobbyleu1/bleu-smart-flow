
-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can read team profiles" ON public.profiles;

-- Create a simpler, non-recursive policy for reading team profiles
-- This allows users to read profiles that share the same company_id as their own profile
CREATE POLICY "Users can read team profiles" ON public.profiles
  FOR SELECT USING (
    company_id IN (
      SELECT p.company_id 
      FROM public.profiles p 
      WHERE p.id = auth.uid()
    )
  );
