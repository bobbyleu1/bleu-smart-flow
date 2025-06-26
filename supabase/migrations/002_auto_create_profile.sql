
-- Drop existing objects if they exist to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.ensure_user_profile(UUID, TEXT);

-- Create the ensure_user_profile function first
CREATE OR REPLACE FUNCTION public.ensure_user_profile(user_id UUID, user_email TEXT)
RETURNS UUID AS $$
DECLARE
  existing_company_id UUID;
  new_company_id UUID;
BEGIN
  -- Check if profile already exists and get company_id
  SELECT company_id INTO existing_company_id FROM public.profiles WHERE id = user_id;
  
  IF NOT FOUND THEN
    -- Create new profile with new company_id
    new_company_id := gen_random_uuid();
    INSERT INTO public.profiles (id, email, company_id, role)
    VALUES (user_id, user_email, new_company_id, 'invoice_owner');
    RETURN new_company_id;
  ELSIF existing_company_id IS NULL THEN
    -- Profile exists but no company_id, generate one
    new_company_id := gen_random_uuid();
    UPDATE public.profiles 
    SET company_id = new_company_id
    WHERE id = user_id;
    RETURN new_company_id;
  ELSE
    -- Profile exists with company_id, return existing
    RETURN existing_company_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to automatically create user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Use the ensure_user_profile function to handle profile creation
  PERFORM public.ensure_user_profile(NEW.id, NEW.email);
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, just return NEW
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically create profiles for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
