/**
 * Gear AI CoPilot - Recall & TSB Service
 *
 * Pure NHTSA API calls are delegated to the shared automotive domain layer
 * (`lib/automotive/recall-checker`). This file keeps the Supabase-dependent
 * acknowledgment / enrichment logic that is specific to the mobile app.
 */

import { supabase } from '../lib/supabase';
import { RecallAlert } from '../types/diagnostic';

// Pure NHTSA functions from shared domain layer
import {
  checkRecallsByVehicle,
  lookupTSBs,
  lookupComplaints,
  fetchWithTimeout,
} from '../lib/automotive';

// Re-export so existing app imports (`from '../services/recall-service'`) still work
export { checkRecallsByVehicle, lookupTSBs, lookupComplaints, fetchWithTimeout };

// Re-export types from the app's canonical type files
export type { NHTSARecall } from '../types/manual';
export type { TSBResult } from '../types/diagnostic';

/**
 * Enrich recall list into RecallAlert objects for a vehicle_id.
 * Merges with local acknowledgment state from Supabase.
 */
export async function getRecallAlerts(
  vehicleId: string,
  make: string,
  model: string,
  year: number
): Promise<RecallAlert[]> {
  const [recalls, ackRows] = await Promise.all([
    checkRecallsByVehicle(make, model, year),
    fetchAcknowledgments(vehicleId),
  ]);

  const ackMap = new Map(ackRows.map((r) => [r.nhtsa_campaign, r]));

  return recalls.map((r) => {
    const ack = ackMap.get(r.NHTSACampaignNumber);
    return {
      recall_id: r.NHTSACampaignNumber,
      vehicle_id: vehicleId,
      nhtsa_campaign: r.NHTSACampaignNumber,
      component: r.Component,
      summary: r.Summary,
      consequence: r.Consequence,
      remedy: r.Remedy,
      remedy_url: `https://www.nhtsa.gov/vehicle-safety/recalls#${r.NHTSACampaignNumber}`,
      manufacturer: r.Manufacturer,
      report_date: r.ReportReceivedDate,
      acknowledged: ack?.acknowledged ?? false,
      acknowledged_at: ack?.acknowledged_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Recall acknowledgment tracking (Supabase)
// ---------------------------------------------------------------------------

async function fetchAcknowledgments(
  vehicleId: string
): Promise<Array<{ nhtsa_campaign: string; acknowledged: boolean; acknowledged_at?: string }>> {
  try {
    const { data, error } = await supabase
      .from('recall_acknowledgments')
      .select('nhtsa_campaign, acknowledged, acknowledged_at')
      .eq('vehicle_id', vehicleId);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Mark a recall as acknowledged by the user.
 */
export async function acknowledgeRecall(
  vehicleId: string,
  userId: string,
  nhtsaCampaign: string
): Promise<void> {
  await supabase.from('recall_acknowledgments').upsert(
    {
      vehicle_id: vehicleId,
      user_id: userId,
      nhtsa_campaign: nhtsaCampaign,
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
    },
    { onConflict: 'vehicle_id,nhtsa_campaign' }
  );
}

/**
 * Count unacknowledged recalls for a vehicle (fast badge count).
 */
export async function getUnacknowledgedRecallCount(
  vehicleId: string,
  make: string,
  model: string,
  year: number
): Promise<number> {
  const alerts = await getRecallAlerts(vehicleId, make, model, year);
  return alerts.filter((a) => !a.acknowledged).length;
}
