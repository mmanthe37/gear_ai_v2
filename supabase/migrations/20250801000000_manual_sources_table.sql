-- ---------------------------------------------------------------------------
-- manual_sources: Provenance tracking for discovered manual URLs
--
-- Records every manual URL we discover, how it was found, whether it has
-- been verified, and a rolling reliability score. This enables:
--   - Skipping network calls when we already know a good URL
--   - Tracking which OEM patterns are breaking over time
--   - Preferring high-reliability sources in future lookups
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.manual_sources (
  source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_year INTEGER NOT NULL,
  vehicle_make TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'oem_direct', 'oem_portal_crawl', 'search_engine', 'aggregator', 'ai_research'
  )),
  source_url TEXT NOT NULL,
  canonical_pdf_url TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0,
  reliability_score REAL NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite index for fast year/make/model lookups
CREATE INDEX IF NOT EXISTS idx_manual_sources_vehicle
  ON public.manual_sources (vehicle_year, lower(vehicle_make), lower(vehicle_model));

-- Index for finding broken sources that need re-verification
CREATE INDEX IF NOT EXISTS idx_manual_sources_reliability
  ON public.manual_sources (reliability_score ASC, failure_count DESC)
  WHERE verified = TRUE;

-- Unique constraint: one entry per source URL + vehicle combo
CREATE UNIQUE INDEX IF NOT EXISTS idx_manual_sources_unique_url
  ON public.manual_sources (vehicle_year, lower(vehicle_make), lower(vehicle_model), source_url);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_manual_sources_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_manual_sources_updated_at
  BEFORE UPDATE ON public.manual_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_manual_sources_timestamp();

-- RLS: users can read all sources, only service role can write
ALTER TABLE public.manual_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY manual_sources_read_policy
  ON public.manual_sources
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY manual_sources_service_write_policy
  ON public.manual_sources
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
