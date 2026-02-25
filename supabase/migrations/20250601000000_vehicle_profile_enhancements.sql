-- ============================================================================
-- VEHICLE PROFILE ENHANCEMENTS
-- Adds rich profile fields: nickname, status, registration, insurance, purchase
-- Also adds a proper mileage log table for odometer history tracking
-- ============================================================================

-- Add new columns to vehicles table
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(100),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'stored', 'for_sale', 'sold', 'totaled')),
  ADD COLUMN IF NOT EXISTS registration_expiry DATE,
  ADD COLUMN IF NOT EXISTS inspection_due DATE,
  ADD COLUMN IF NOT EXISTS insurance_provider VARCHAR(100),
  ADD COLUMN IF NOT EXISTS insurance_policy_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS insurance_coverage_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS insurance_expiry DATE,
  ADD COLUMN IF NOT EXISTS dealer_seller_info TEXT,
  ADD COLUMN IF NOT EXISTS loan_details TEXT;

-- Mileage log table for tracking odometer history over time
CREATE TABLE IF NOT EXISTS public.vehicle_mileage_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(vehicle_id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
  mileage INT NOT NULL CHECK (mileage >= 0),
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mileage_logs_vehicle ON public.vehicle_mileage_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_mileage_logs_user ON public.vehicle_mileage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mileage_logs_date ON public.vehicle_mileage_logs(logged_date DESC);

-- RLS for mileage logs
ALTER TABLE public.vehicle_mileage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own mileage logs"
  ON public.vehicle_mileage_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
