-- Gear AI CoPilot - Helper Functions Migration
-- Version: 20250301000000
-- Description: Create RPC functions for common operations

-- ============================================================================
-- CHAT MESSAGE COUNT MANAGEMENT
-- ============================================================================

/**
 * Decrement message count for a chat session
 * Called when a message is deleted
 */
CREATE OR REPLACE FUNCTION public.decrement_message_count(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.chat_sessions
  SET message_count = GREATEST(message_count - 1, 0)
  WHERE session_id = p_session_id;
END;
$$;

/**
 * Increment message count for a chat session
 * Called when a message is added (alternative to trigger)
 */
CREATE OR REPLACE FUNCTION public.increment_message_count(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.chat_sessions
  SET 
    message_count = message_count + 1,
    last_message_at = NOW()
  WHERE session_id = p_session_id;
END;
$$;

-- ============================================================================
-- VEHICLE STATISTICS
-- ============================================================================

/**
 * Get vehicle statistics for a user
 */
CREATE OR REPLACE FUNCTION public.get_user_vehicle_stats(p_user_id UUID)
RETURNS TABLE (
  total_vehicles INT,
  average_mileage DECIMAL,
  total_value DECIMAL,
  pending_maintenance INT,
  active_diagnostic_codes INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INT as total_vehicles,
    COALESCE(AVG(current_mileage), 0)::DECIMAL as average_mileage,
    COALESCE(SUM(current_market_value), 0)::DECIMAL as total_value,
    0::INT as pending_maintenance, -- To be implemented with service reminders
    0::INT as active_diagnostic_codes -- To be implemented with diagnostics
  FROM public.vehicles
  WHERE user_id = p_user_id AND is_active = true;
END;
$$;

-- ============================================================================
-- MAINTENANCE STATISTICS
-- ============================================================================

/**
 * Get maintenance statistics for a vehicle
 */
CREATE OR REPLACE FUNCTION public.get_vehicle_maintenance_stats(p_vehicle_id UUID)
RETURNS TABLE (
  total_services INT,
  total_cost DECIMAL,
  average_cost_per_service DECIMAL,
  last_service_date DATE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INT as total_services,
    COALESCE(SUM(cost), 0)::DECIMAL as total_cost,
    COALESCE(AVG(cost), 0)::DECIMAL as average_cost_per_service,
    MAX(date) as last_service_date
  FROM public.maintenance_records
  WHERE vehicle_id = p_vehicle_id;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.decrement_message_count IS 'Decrements message count for a chat session';
COMMENT ON FUNCTION public.increment_message_count IS 'Increments message count and updates last message timestamp';
COMMENT ON FUNCTION public.get_user_vehicle_stats IS 'Returns aggregate statistics for a user''s vehicles';
COMMENT ON FUNCTION public.get_vehicle_maintenance_stats IS 'Returns maintenance statistics for a vehicle';
