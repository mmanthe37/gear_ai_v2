/**
 * Gear AI CoPilot - Recall & TSB Service
 *
 * NHTSA recall database lookups by VIN and make/model/year.
 * TSB (Technical Service Bulletin) lookups.
 * Local recall acknowledgment tracking via Supabase.
 */

import { supabase } from '../lib/supabase';
import { RecallAlert, TSBResult } from '../types/diagnostic';
import { NHTSARecall } from '../types/manual';

const NHTSA_RECALLS_BASE = 'https://api.nhtsa.gov/recalls/recallsByVehicle';
const NHTSA_VIN_RECALLS_BASE = 'https://api.nhtsa.gov/recalls/recallsByVehicleId';
const NHTSA_COMPLAINTS_BASE = 'https://api.nhtsa.gov/complaints/complaintsByVehicle';
const DEFAULT_TIMEOUT_MS = 8000;

function fetchWithTimeout(url: string, ms = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// NHTSA Recall lookups
// ---------------------------------------------------------------------------

/**
 * Check NHTSA recalls by make/model/year (free, no API key).
 */
export async function checkRecallsByVehicle(
  make: string,
  model: string,
  year: number
): Promise<NHTSARecall[]> {
  try {
    const url = `${NHTSA_RECALLS_BASE}?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results || []).map((r: any) => ({
      NHTSACampaignNumber: r.NHTSACampaignNumber || '',
      ReportReceivedDate: r.ReportReceivedDate || '',
      Component: r.Component || '',
      Summary: r.Summary || '',
      Consequence: r.Consequence || '',
      Remedy: r.Remedy || '',
      Manufacturer: r.Manufacturer || '',
      ModelYear: r.ModelYear || String(year),
      Make: r.Make || make,
      Model: r.Model || model,
    }));
  } catch (err) {
    console.warn('[RecallService] checkRecallsByVehicle failed:', err);
    return [];
  }
}

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
// TSB lookups via NHTSA Complaints / public TSB API
// ---------------------------------------------------------------------------

/**
 * Fetch Technical Service Bulletins for a vehicle.
 * Uses NHTSA TSB API (free, no key required).
 */
export async function lookupTSBs(
  make: string,
  model: string,
  year: number
): Promise<TSBResult[]> {
  try {
    const url = `https://api.nhtsa.gov/tsbs/tsbsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results || []).map((r: any, i: number) => ({
      tsb_id: `tsb-${i}-${r.documentId || r.NHTSAItemNumber || i}`,
      document_id: r.documentId || r.NHTSAItemNumber || '',
      make: r.Make || make,
      model: r.Model || model,
      year: r.ModelYear || String(year),
      subject: r.Subject || r.subject || 'Technical Service Bulletin',
      summary: r.Summary || r.summary || '',
      issue_date: r.IssueDate || r.issueDate,
      category: r.Category || r.category,
    }));
  } catch (err) {
    console.warn('[RecallService] lookupTSBs failed:', err);
    return [];
  }
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
