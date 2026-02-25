-- Gear AI CoPilot - Diagnostics Tables
-- Version: 20250701000000
-- Description: Full diagnostics feature tables: code history, health scores, symptom checks

-- ============================================================================
-- DIAGNOSTIC CODES TABLE (persistent DTC history)
-- Create if not exists (fresh install), then add any missing columns (upgrade)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.diagnostic_codes (
  diagnostic_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(vehicle_id) ON DELETE CASCADE,
  user_id         UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
  code            VARCHAR(10) NOT NULL,
  code_type       VARCHAR(10) CHECK (code_type IN ('P','C','B','U')),
  description     TEXT,
  severity        VARCHAR(20) CHECK (severity IN ('low','medium','high','critical')) DEFAULT 'medium',
  status          VARCHAR(50) CHECK (status IN ('active','pending','resolved','false_positive')) DEFAULT 'active',
  mileage_at_detection  INTEGER,
  freeze_frame_data     JSONB,
  ai_analysis     TEXT,
  ai_causes       JSONB,
  diy_vs_shop     VARCHAR(10) CHECK (diy_vs_shop IN ('diy','shop','either')),
  estimated_cost_min    INTEGER,
  estimated_cost_max    INTEGER,
  repair_difficulty     VARCHAR(20) CHECK (repair_difficulty IN ('easy','moderate','difficult','professional')),
  detected_at     TIMESTAMP DEFAULT NOW(),
  cleared_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Add columns that may be missing on existing tables (idempotent upgrades)
ALTER TABLE public.diagnostic_codes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE;
ALTER TABLE public.diagnostic_codes ADD COLUMN IF NOT EXISTS ai_causes JSONB;
ALTER TABLE public.diagnostic_codes ADD COLUMN IF NOT EXISTS diy_vs_shop VARCHAR(10);
ALTER TABLE public.diagnostic_codes ADD COLUMN IF NOT EXISTS estimated_cost_min INTEGER;
ALTER TABLE public.diagnostic_codes ADD COLUMN IF NOT EXISTS estimated_cost_max INTEGER;
ALTER TABLE public.diagnostic_codes ADD COLUMN IF NOT EXISTS repair_difficulty VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_diagnostic_codes_vehicle ON public.diagnostic_codes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_codes_user    ON public.diagnostic_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_codes_status  ON public.diagnostic_codes(status);
CREATE INDEX IF NOT EXISTS idx_diagnostic_codes_code    ON public.diagnostic_codes(code);

-- ============================================================================
-- VEHICLE HEALTH SCORES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_health_scores (
  health_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(vehicle_id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  overall_score   INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  systems         JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of HealthSystemScore
  active_code_count           INTEGER DEFAULT 0,
  maintenance_compliance_pct  NUMERIC(5,2) DEFAULT 0,
  trend           VARCHAR(20) CHECK (trend IN ('improving','stable','declining')) DEFAULT 'stable',
  previous_score  INTEGER,
  calculated_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_scores_vehicle   ON public.vehicle_health_scores(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_health_scores_calculated ON public.vehicle_health_scores(calculated_at);

-- ============================================================================
-- SYMPTOM CHECKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.symptom_checks (
  check_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(vehicle_id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  symptom_text    TEXT NOT NULL,
  ai_analysis     TEXT,
  suggested_codes JSONB DEFAULT '[]'::jsonb,
  probable_causes JSONB DEFAULT '[]'::jsonb,
  urgency         VARCHAR(10) CHECK (urgency IN ('low','medium','high','critical')) DEFAULT 'medium',
  related_recalls JSONB DEFAULT '[]'::jsonb,
  related_tsbs    JSONB DEFAULT '[]'::jsonb,
  flowchart_steps JSONB DEFAULT '[]'::jsonb,
  checked_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_symptom_checks_vehicle ON public.symptom_checks(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_symptom_checks_user    ON public.symptom_checks(user_id);

-- ============================================================================
-- RECALL ACKNOWLEDGMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.recall_acknowledgments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(vehicle_id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  nhtsa_campaign  VARCHAR(50) NOT NULL,
  acknowledged    BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(vehicle_id, nhtsa_campaign)
);

CREATE INDEX IF NOT EXISTS idx_recall_acks_vehicle ON public.recall_acknowledgments(vehicle_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.diagnostic_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recall_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Diagnostic codes: users own their data
CREATE POLICY "Users can manage their diagnostic codes"
  ON public.diagnostic_codes FOR ALL
  USING (user_id = auth.uid());

-- Health scores: users own their data
CREATE POLICY "Users can manage their health scores"
  ON public.vehicle_health_scores FOR ALL
  USING (user_id = auth.uid());

-- Symptom checks: users own their data
CREATE POLICY "Users can manage their symptom checks"
  ON public.symptom_checks FOR ALL
  USING (user_id = auth.uid());

-- Recall acknowledgments: users own their data
CREATE POLICY "Users can manage their recall acknowledgments"
  ON public.recall_acknowledgments FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- UPDATED_AT TRIGGER for diagnostic_codes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_diagnostic_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_diagnostic_codes_updated_at
  BEFORE UPDATE ON public.diagnostic_codes
  FOR EACH ROW EXECUTE FUNCTION update_diagnostic_codes_updated_at();
