/**
 * Gear AI – Shared Automotive Domain Layer
 * Recall & TSB Checker (pure NHTSA API logic, no Supabase dependencies)
 *
 * Provides recall and Technical Service Bulletin lookups via the free
 * NHTSA public APIs. Supabase-dependent acknowledgment tracking lives
 * in the mobile-app service layer, not here.
 *
 * @module automotive/recall-checker
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single NHTSA recall record. */
export interface NHTSARecall {
  NHTSACampaignNumber: string;
  ReportReceivedDate: string;
  Component: string;
  Summary: string;
  Consequence: string;
  Remedy: string;
  Manufacturer: string;
  ModelYear: string;
  Make: string;
  Model: string;
}

/** A single Technical Service Bulletin result. */
export interface TSBResult {
  tsb_id: string;
  document_id: string;
  make: string;
  model: string;
  year: string;
  subject: string;
  summary: string;
  issue_date?: string;
  category?: string;
}

/** A single NHTSA consumer complaint record. */
export interface NHTSAComplaint {
  odiNumber: string;
  manufacturer: string;
  crash: boolean;
  fire: boolean;
  numberOfInjuries: number;
  numberOfDeaths: number;
  dateOfIncident: string;
  dateComplaintFiled: string;
  component: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NHTSA_RECALLS_BASE = 'https://api.nhtsa.gov/recalls/recallsByVehicle';
const NHTSA_COMPLAINTS_BASE = 'https://api.nhtsa.gov/complaints/complaintsByVehicle';
const DEFAULT_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Wrapper around `fetch` that aborts if the request takes longer than
 * the specified timeout.
 *
 * @param url - URL to fetch
 * @param ms  - Timeout in milliseconds (default {@link DEFAULT_TIMEOUT_MS})
 * @returns The `Response` object
 */
export function fetchWithTimeout(
  url: string,
  ms: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check NHTSA recalls for a vehicle by make, model, and year.
 *
 * This is a free API and requires no API key.
 *
 * @param make  - Manufacturer name (e.g. "Toyota")
 * @param model - Model name (e.g. "Camry")
 * @param year  - Model year
 * @returns Array of matching NHTSA recall records (empty on error)
 */
export async function checkRecallsByVehicle(
  make: string,
  model: string,
  year: number,
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
  } catch {
    return [];
  }
}

/**
 * Fetch Technical Service Bulletins for a vehicle from NHTSA.
 *
 * @param make  - Manufacturer name
 * @param model - Model name
 * @param year  - Model year
 * @returns Array of TSB results (empty on error)
 */
export async function lookupTSBs(
  make: string,
  model: string,
  year: number,
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
  } catch {
    return [];
  }
}

/**
 * Fetch NHTSA consumer complaints for a vehicle.
 *
 * @param make  - Manufacturer name
 * @param model - Model name
 * @param year  - Model year
 * @returns Array of complaint records (empty on error)
 */
export async function lookupComplaints(
  make: string,
  model: string,
  year: number,
): Promise<NHTSAComplaint[]> {
  try {
    const url = `${NHTSA_COMPLAINTS_BASE}?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];

    const json = await res.json();
    return (json.results || []).map((r: any) => ({
      odiNumber: r.odiNumber || '',
      manufacturer: r.manufacturer || make,
      crash: r.crash === true || r.crash === 'Yes',
      fire: r.fire === true || r.fire === 'Yes',
      numberOfInjuries: Number(r.numberOfInjuries) || 0,
      numberOfDeaths: Number(r.numberOfDeaths) || 0,
      dateOfIncident: r.dateOfIncident || '',
      dateComplaintFiled: r.dateComplaintFiled || '',
      component: r.components || r.component || '',
      summary: r.summary || '',
    }));
  } catch {
    return [];
  }
}
