-- ============================================================
-- FIX: Allow operators to SELECT their own assigned services
-- This RLS policy was likely missing or had wrong conditions
-- ============================================================

-- Drop any old conflicting policies on services for operators
DROP POLICY IF EXISTS "Operators see their assigned services" ON services;
DROP POLICY IF EXISTS "operator_see_own" ON services;

-- Create correct policy: operator can read services where operator_id = their UID
CREATE POLICY "Operators see their assigned services"
ON services
FOR SELECT
TO authenticated
USING (
  operator_id = auth.uid()
  OR
  -- Dispatchers and admins can see all services of their company
  company_id = (SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);

-- ============================================================
-- Verify the services table has RLS enabled
-- ============================================================
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
