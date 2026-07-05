-- ============================================================================
-- COMPLETE AUTHENTICATION RESET & OWNER INITIALIZATION
-- ============================================================================
-- This migration performs a complete auth reset for clean production start
-- and sets up automatic owner assignment for the first registration

-- ============================================================================
-- STEP 1: CLEAN ALL USER-RELATED DATA
-- ============================================================================

-- Delete all profiles (cascade should handle most relations)
DELETE FROM profiles;

-- Delete all auth users (this completely wipes auth system)
DELETE FROM auth.users;

-- Reset any user-related sequences
ALTER SEQUENCE IF EXISTS profiles_id_seq RESTART WITH 1;

-- ============================================================================
-- STEP 2: OWNER Auto-Assignment System
-- ============================================================================
-- When the designated owner email registers for the FIRST time,
-- they automatically receive the 'super_admin' role.
-- After this happens, the flag is disabled permanently.

-- Create a config table to track owner assignment status
CREATE TABLE IF NOT EXISTS owner_init_config (
  id int PRIMARY KEY DEFAULT 1,
  owner_email text NOT NULL,
  owner_assigned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Initialize with the designated owner email
INSERT INTO owner_init_config (id, owner_email, owner_assigned) 
VALUES (1, 'sameraldjaber@gmail.com', false)
ON CONFLICT (id) DO UPDATE SET 
  owner_email = EXCLUDED.owner_email,
  owner_assigned = false;

-- RLS on owner_init_config (only super_admin can modify)
ALTER TABLE owner_init_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_config_select" ON owner_init_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "owner_config_admin_only" ON owner_init_config FOR ALL
  TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ============================================================================
-- STEP 3: Enhanced User Creation Trigger with Owner Auto-Assignment
-- ============================================================================

-- Replace the existing handle_new_user function with owner auto-assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role text;
  owner_email text;
  owner_already_assigned boolean;
BEGIN
  -- Determine role based on metadata, but check for owner auto-assignment
  user_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'customer'
  );
  
  -- Check if this registration email matches the configured owner email
  BEGIN
    SELECT owner_email, owner_assigned INTO owner_email, owner_already_assigned
    FROM owner_init_config
    WHERE id = 1;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback in case table is missing
    owner_email := 'sameraldjaber@gmail.com';
    owner_already_assigned := false;
  END;
  
  -- If email matches owner email AND owner hasn't been assigned yet:
  IF (owner_email IS NOT NULL AND LOWER(NEW.email) = LOWER(owner_email))
     OR (LOWER(NEW.email) = 'sameraldjaber@gmail.com') THEN
    -- Override role to super_admin
    user_role := 'super_admin';
    
    -- Mark owner as assigned permanently
    BEGIN
      UPDATE owner_init_config 
      SET owner_assigned = true, updated_at = now()
      WHERE id = 1;
    EXCEPTION WHEN OTHERS THEN
      -- Do nothing if table is missing or update fails
    END;
    
    RAISE LOG 'Owner account auto-promoted: % assigned super_admin role', NEW.email;
  END IF;
  
  -- Insert the profile with the determined role
  INSERT INTO public.profiles (id, email, full_name, phone, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    user_role::public.user_role,
    now(),
    now()
  );
  
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists (drop if old version, recreate)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 4: Verification functions
-- ============================================================================

-- Function to check if owner has been initialized
CREATE OR REPLACE FUNCTION public.is_owner_initialized()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (SELECT owner_assigned FROM owner_init_config WHERE id = 1);
END;
$$;

-- Function to manually assign owner (fallback - only works if not already assigned)
CREATE OR REPLACE FUNCTION public.manually_assign_owner(p_user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  owner_email text;
  owner_assigned boolean;
BEGIN
  -- Check current state
  SELECT owner_email, owner_assigned INTO owner_email, owner_assigned
  FROM owner_init_config WHERE id = 1;
  
  -- If already assigned, don't allow
  IF owner_assigned THEN
    RAISE EXCEPTION 'Owner has already been assigned. This action is disabled.';
  END IF;
  
  -- Verify the user matches expected owner email
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = p_user_id AND LOWER(email) = LOWER(owner_email)
  ) THEN
    RAISE EXCEPTION 'User email does not match configured owner email.';
  END IF;
  
  -- Assign super_admin role
  UPDATE profiles SET role = 'super_admin' WHERE id = p_user_id;
  
  -- Mark as assigned
  UPDATE owner_init_config SET owner_assigned = true, updated_at = now() WHERE id = 1;
  
  RETURN true;
END;
$$;

-- Verify the reset
SELECT 'Auth system reset complete' as status;
