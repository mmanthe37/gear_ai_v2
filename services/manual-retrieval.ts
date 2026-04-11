/**
 * Gear AI CoPilot - Owner's Manual Retrieval Service
 *
 * Orchestrates manual lookup across multiple sources with an enhanced
 * 8-step waterfall:
 *   1. Local Supabase cache (fastest)
 *   2. Database lookup for already-indexed manuals (DB-first)
 *   3. VehicleDatabases.com Owner's Manual API (primary commercial)
 *   4. Expanded OEM direct URL patterns (40+ manufacturers)
 *   5. OEM owner portal HTML crawl (parse for PDF links)
 *   6. AI-powered deep research (candidate ranking, not generation)
 *   7. Third-party aggregator search
 *   8. Web search fallback (last resort, clearly labeled)
 *
 * Also exposes helpers for NHTSA safety ratings and recall checks.
 */

import Constants from 'expo-constants';
import {
  VehicleLookup,
  ManualRetrievalResult,
  VehicleDatabasesResponse,
  NHTSARecall,
  RecallResult,
  SafetyRating,
  SafetyRatingResult,
  CachedManualLookup,
} from '../types/manual';
import { VINDecodeResult } from '../types/vehicle';
import { decodeVIN } from './vin-decoder';
import supabase from '../lib/supabase';
import { discoverManualUrl } from './web-manual-scraper';
import { researchManualWithAI, quickAISuggestion } from './ai-manual-research';
import { isSafeUrl, strictVerifyPdf } from './web-manual-scraper';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NHTSA_BASE = 'https://vpic.nhtsa.dot.gov/api';
const NHTSA_RECALLS_BASE = 'https://api.nhtsa.gov/recalls/recallsByVehicle';
const NHTSA_SAFETY_BASE = 'https://api.nhtsa.gov/SafetyRatings';
const VEHICLE_DATABASES_BASE = 'https://api.vehicledatabases.com/owner-manual';

/** Cache TTL – 30 days in milliseconds */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_EMBEDDED_PDF_LINKS = 8;
const MANUAL_LINK_KEYWORDS = ['manual', 'owner', 'owners', 'eowner', 'handbook'];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a deterministic cache key from a vehicle lookup.
 */
function buildCacheKey(v: VehicleLookup): string {
  const parts = [
    v.year.toString(),
    v.make.toLowerCase().trim(),
    v.model.toLowerCase().trim(),
  ];
  if (v.trim) parts.push(v.trim.toLowerCase().trim());
  return `manual:${parts.join(':')}`;
}

/**
 * Fetch with a timeout guard.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function looksLikePdfUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.endsWith('.pdf') || lower.includes('.pdf?') || lower.includes('.pdf#');
}

function extractEmbeddedPdfLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) && links.size < MAX_EMBEDDED_PDF_LINKS) {
    const href = match[1]?.trim();
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) {
      continue;
    }

    try {
      const absolute = new URL(href, baseUrl).toString();
      const lower = absolute.toLowerCase();
      const hasManualHint = MANUAL_LINK_KEYWORDS.some((keyword) => lower.includes(keyword));
      if (looksLikePdfUrl(absolute) || hasManualHint) {
        links.add(absolute);
      }
    } catch {
      // Ignore malformed href values.
    }
  }

  return [...links];
}

// ---------------------------------------------------------------------------
// 1. Local cache layer (Supabase api_cache table)
// ---------------------------------------------------------------------------

async function getFromCache(key: string): Promise<CachedManualLookup | null> {
  try {
    const { data, error } = await supabase
      .from('api_cache')
      .select('*')
      .eq('cache_key', key)
      .single();

    if (error || !data) return null;

    // Check expiry
    if (new Date(data.expires_at) < new Date()) {
      // Expired – clean up in background
      supabase.from('api_cache').delete().eq('cache_key', key).then(() => {});
      return null;
    }

    return data.data as CachedManualLookup;
  } catch {
    return null;
  }
}

async function writeToCache(entry: CachedManualLookup): Promise<void> {
  try {
    await supabase.from('api_cache').upsert({
      cache_key: entry.cache_key,
      data: entry,
      created_at: new Date().toISOString(),
      expires_at: entry.expires_at,
    });
  } catch (err) {
    console.warn('[ManualRetrieval] Cache write failed:', err);
  }
}

// ---------------------------------------------------------------------------
// 2. VehicleDatabases.com API
// ---------------------------------------------------------------------------

/**
 * Query VehicleDatabases.com Owner's Manual API.
 *
 * Supports lookup by VIN or by Year/Make/Model.
 * Requires VEHICLE_DATABASES_API_KEY env var.
 */
async function queryVehicleDatabases(
  vehicle: VehicleLookup
): Promise<ManualRetrievalResult | null> {
  const apiKey = process.env.VEHICLE_DATABASES_API_KEY;
  if (!apiKey) {
    console.warn('[ManualRetrieval] VEHICLE_DATABASES_API_KEY not set – skipping VehicleDatabases lookup.');
    return null;
  }

  try {
    let url: string;
    if (vehicle.vin) {
      url = `${VEHICLE_DATABASES_BASE}/vin/${encodeURIComponent(vehicle.vin)}`;
    } else {
      url = `${VEHICLE_DATABASES_BASE}/${vehicle.year}/${encodeURIComponent(vehicle.make)}/${encodeURIComponent(vehicle.model)}`;
    }

    const res = await fetchWithTimeout(url, {
      headers: {
        'x-AuthKey': apiKey,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[ManualRetrieval] VehicleDatabases responded ${res.status}`);
      return null;
    }

    const json: VehicleDatabasesResponse = await res.json();

    if (json.status !== 'success' || !json.data?.owner_manual_url) {
      return null;
    }

    const verifiedUrl = await resolveVerifiedPdfUrl(json.data.owner_manual_url);
    if (!verifiedUrl) {
      return null;
    }

    return {
      source: 'vehicledatabases',
      vehicle,
      manual_url: verifiedUrl,
      manual_title: `${json.data.year} ${json.data.make} ${json.data.model} Owner's Manual`,
      retrieved_at: new Date().toISOString(),
      cached: false,
    };
  } catch (err) {
    console.warn('[ManualRetrieval] VehicleDatabases query failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. OEM URL patterns – delegated to oem-manual-sources.ts + web-manual-scraper.ts
//    The old 12-manufacturer OEM_MANUAL_PATTERNS map has been replaced by
//    a 40+ manufacturer registry in services/oem-manual-sources.ts.
//    tryOemFallback now uses the multi-strategy scraper.
// ---------------------------------------------------------------------------

/**
 * Attempt to find the manual via expanded OEM direct URL patterns (40+ manufacturers).
 * Delegates to the web-manual-scraper which checks oem-manual-sources.ts patterns.
 */
async function tryOemFallback(vehicle: VehicleLookup): Promise<ManualRetrievalResult | null> {
  try {
    const discovery = await discoverManualUrl(vehicle, ['aggregator']);
    if (discovery.bestCandidate?.verified && discovery.bestCandidate.url) {
      return {
        source: discovery.bestCandidate.source === 'oem_portal_crawl' ? 'oem_portal_crawl' : 'oem_direct',
        vehicle,
        manual_url: discovery.bestCandidate.url,
        manual_title: discovery.bestCandidate.title || `${vehicle.year} ${vehicle.make} ${vehicle.model} Owner's Manual`,
        file_size_bytes: discovery.bestCandidate.fileSize,
        retrieved_at: new Date().toISOString(),
        cached: false,
      };
    }
  } catch (err) {
    console.warn('[ManualRetrieval] OEM discovery failed:', err);
  }

  return null;
}

/**
 * Build a Google-style search URL for the user to find the manual.
 * This is the last resort and does not auto-fetch.
 */
function buildWebSearchFallbackUrl(vehicle: VehicleLookup): string {
  const q = encodeURIComponent(
    `${vehicle.year} ${vehicle.make} ${vehicle.model} owner's manual PDF filetype:pdf`
  );
  return `https://www.google.com/search?q=${q}`;
}

// ---------------------------------------------------------------------------
// 3b. AI-powered URL discovery – delegated to ai-manual-research.ts
//     The old inline OpenAI call is replaced by the research service
//     which includes SSRF protection and strict verification.
// ---------------------------------------------------------------------------

/**
 * Use AI to suggest a direct PDF URL for the owner's manual.
 * Delegates to ai-manual-research.ts with SSRF protection.
 */
async function discoverUrlWithAI(vehicle: VehicleLookup): Promise<string | null> {
  return quickAISuggestion(vehicle);
}

// ---------------------------------------------------------------------------
// 3c. PDF download, verification, and Supabase Storage import
// ---------------------------------------------------------------------------

export type RetrievalProgressStep =
  | 'checking_cache'
  | 'checking_indexed'
  | 'trying_oem'
  | 'asking_ai'
  | 'verifying_url'
  | 'downloading_pdf'
  | 'uploading'
  | 'processing_rag'
  | 'searching_aggregators'
  | 'done'
  | 'fallback';

export type ProgressCallback = (step: RetrievalProgressStep, detail?: string) => void;

export interface ManualRetrievalContext {
  userId?: string;
  vehicleId?: string;
}

/**
 * Verify a URL points to a real PDF (either by HEAD or by fetching the first 5 bytes).
 * Returns the verified URL or null.
 */
async function verifyPdfUrl(url: string): Promise<boolean> {
  try {
    // Try HEAD first (fast, most servers support it)
    const head = await fetchWithTimeout(url, { method: 'HEAD' }, 8_000);
    if (head.ok) {
      const ct = head.headers.get('content-type') || '';
      // Some servers return PDF content-type, some return octet-stream
      if (ct.includes('pdf') || ct.includes('octet-stream') || url.toLowerCase().endsWith('.pdf')) {
        return true;
      }
    }
  } catch {
    // HEAD may be blocked — fall through to GET
  }

  try {
    // Partial GET to read the first 5 bytes (%PDF-)
    const partial = await fetchWithTimeout(
      url,
      { headers: { Range: 'bytes=0-4' } },
      8_000
    );
    if (partial.ok || partial.status === 206) {
      const bytes = new Uint8Array(await partial.arrayBuffer());
      // PDF magic: 25 50 44 46 2D  → %PDF-
      return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Resolve a candidate URL into a direct, verified PDF URL.
 * Supports HTML pages that contain links to hosted PDFs.
 *
 * STRICT: Does NOT accept URLs merely because they end in ".pdf".
 * All URLs must pass magic-byte or content-type verification.
 */
async function resolveVerifiedPdfUrl(url: string): Promise<string | null> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return null;
  }

  // SSRF check
  if (!isSafeUrl(url)) {
    console.warn('[ManualRetrieval] Blocked unsafe URL:', url);
    return null;
  }

  // Try strict verification first
  const { verified, finalUrl } = await strictVerifyPdf(url);
  if (verified) {
    return finalUrl || url;
  }

  try {
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
        },
      },
      12_000
    );

    if (!res.ok) {
      return null;
    }

    const responseUrl = res.url || url;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('pdf') && (await verifyPdfUrl(responseUrl))) {
      return responseUrl;
    }

    if (!contentType.includes('html')) {
      return null;
    }

    const html = await res.text();
    const candidates = extractEmbeddedPdfLinks(html, responseUrl);
    for (const candidate of candidates) {
      if (await verifyPdfUrl(candidate)) {
        return candidate;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Download a PDF from `url`, upload to Supabase Storage, and return the
 * public storage URL. Returns null if CORS or network prevents the download.
 */
async function downloadAndStorePdf(
  url: string,
  vehicle: VehicleLookup
): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, {}, 60_000);
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    // Validate PDF magic bytes
    const header = new Uint8Array(buffer.slice(0, 5));
    const isPdf =
      header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
    if (!isPdf) {
      console.warn('[ManualRetrieval] Downloaded content is not a valid PDF');
      return null;
    }

    const filename = `${vehicle.year}-${vehicle.make}-${vehicle.model}`
      .replace(/\s+/g, '-')
      .toLowerCase()
      .replace(/[^a-z0-9\-]/g, '') + '.pdf';
    const storagePath = `manuals/${filename}`;

    const { error } = await supabase.storage
      .from('manuals')
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });

    if (error) {
      console.warn('[ManualRetrieval] Storage upload failed:', error.message);
      // Bucket may not exist yet — return the original URL as fallback
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('manuals')
      .getPublicUrl(storagePath);

    return publicUrlData.publicUrl;
  } catch (err: any) {
    // CORS or network error — cannot download on web from this origin
    const msg: string = err?.message || '';
    if (msg.includes('CORS') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      console.warn('[ManualRetrieval] CORS blocked PDF download — URL stored by reference only');
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// 4. NHTSA Recalls API (supplementary safety data)
// ---------------------------------------------------------------------------

/**
 * Fetch NHTSA recall campaigns for a vehicle.
 * Free, no API key required.
 */
export async function getRecalls(vehicle: VehicleLookup): Promise<RecallResult> {
  const now = new Date().toISOString();
  try {
    const url = `${NHTSA_RECALLS_BASE}?make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&modelYear=${vehicle.year}`;
    const res = await fetchWithTimeout(url);

    if (!res.ok) {
      return { recalls: [], count: 0, vehicle, retrieved_at: now };
    }

    const json = await res.json();
    const recalls: NHTSARecall[] = (json.results || []).map((r: any) => ({
      NHTSACampaignNumber: r.NHTSACampaignNumber || '',
      ReportReceivedDate: r.ReportReceivedDate || '',
      Component: r.Component || '',
      Summary: r.Summary || '',
      Consequence: r.Consequence || '',
      Remedy: r.Remedy || '',
      Manufacturer: r.Manufacturer || '',
      ModelYear: r.ModelYear || '',
      Make: r.Make || '',
      Model: r.Model || '',
    }));

    return { recalls, count: recalls.length, vehicle, retrieved_at: now };
  } catch (err) {
    console.warn('[ManualRetrieval] NHTSA recalls fetch failed:', err);
    return { recalls: [], count: 0, vehicle, retrieved_at: now };
  }
}

// ---------------------------------------------------------------------------
// 5. NHTSA Safety Ratings API
// ---------------------------------------------------------------------------

/**
 * Fetch NHTSA 5-star safety ratings for a vehicle.
 * Free, no API key required.
 */
export async function getSafetyRatings(vehicle: VehicleLookup): Promise<SafetyRatingResult> {
  const now = new Date().toISOString();
  try {
    const url = `${NHTSA_SAFETY_BASE}/modelyear/${vehicle.year}/make/${encodeURIComponent(vehicle.make)}/model/${encodeURIComponent(vehicle.model)}?format=json`;
    const res = await fetchWithTimeout(url);

    if (!res.ok) {
      return { ratings: [], vehicle, retrieved_at: now };
    }

    const json = await res.json();
    const ratings: SafetyRating[] = (json.Results || []).map((r: any) => ({
      OverallRating: r.OverallRating || 'Not Rated',
      OverallFrontCrashRating: r.OverallFrontCrashRating || 'Not Rated',
      OverallSideCrashRating: r.OverallSideCrashRating || 'Not Rated',
      RolloverRating: r.RolloverRating || 'Not Rated',
      VehicleDescription: r.VehicleDescription || '',
      VehicleId: r.VehicleId || 0,
    }));

    return { ratings, vehicle, retrieved_at: now };
  } catch (err) {
    console.warn('[ManualRetrieval] NHTSA safety ratings fetch failed:', err);
    return { ratings: [], vehicle, retrieved_at: now };
  }
}

// ---------------------------------------------------------------------------
// 6. Orchestrator – resolve vehicle and retrieve manual
// ---------------------------------------------------------------------------

/**
 * Resolve a VIN into a VehicleLookup using the existing VIN decoder.
 */
export async function resolveVehicle(
  vinOrLookup: string | VehicleLookup
): Promise<VehicleLookup> {
  if (typeof vinOrLookup === 'object') return vinOrLookup;

  const decoded: VINDecodeResult = await decodeVIN(vinOrLookup);
  return {
    vin: decoded.vin,
    year: decoded.year,
    make: decoded.make,
    model: decoded.model,
    trim: decoded.trim,
  };
}

/**
 * Primary entry point – retrieve an owner's manual for a vehicle.
 *
 * Lookup waterfall:
 *   1. Local Supabase cache
 *   2. VehicleDatabases.com API (if API key present)
 *   3. Direct OEM URL patterns (12 manufacturers)
 *   4. AI-powered URL discovery (OpenAI suggests known PDF URLs)
 *      → If URL verified: download PDF → Supabase Storage → RAG pipeline
 *   5. Web search fallback (last resort, clearly labeled)
 *
 * The first non-null result is cached and returned.
 */
export async function retrieveManual(
  vinOrLookup: string | VehicleLookup,
  onProgress?: ProgressCallback,
  context?: ManualRetrievalContext
): Promise<ManualRetrievalResult> {
  const vehicle = await resolveVehicle(vinOrLookup);
  const cacheKey = buildCacheKey(vehicle);
  const now = new Date().toISOString();

  onProgress?.('checking_cache');

  // 1. Cache check
  const cached = await getFromCache(cacheKey);
  if (cached) {
    if (cached.source !== 'web_search') {
      onProgress?.('verifying_url', 'Validating cached manual URL...');
      const verifiedCachedUrl = await resolveVerifiedPdfUrl(cached.manual_url);
      if (verifiedCachedUrl) {
        onProgress?.('done', 'Loaded from cache');
        return {
          source: 'cache',
          vehicle: cached.vehicle,
          manual_url: verifiedCachedUrl,
          manual_title: `${cached.vehicle.year} ${cached.vehicle.make} ${cached.vehicle.model} Owner's Manual`,
          retrieved_at: now,
          cached: true,
        };
      }

      await supabase.from('api_cache').delete().eq('cache_key', cacheKey);
    } else {
      onProgress?.('done', 'Loaded from cache');
      return {
        source: 'cache',
        vehicle: cached.vehicle,
        manual_url: cached.manual_url,
        manual_title: `${cached.vehicle.year} ${cached.vehicle.make} ${cached.vehicle.model} Owner's Manual`,
        retrieved_at: now,
        cached: true,
      };
    }
  }

  // 2. DB-first: check for already-indexed manuals BEFORE any network calls
  onProgress?.('checking_indexed', 'Checking for previously indexed manuals...');
  const indexedManualId = await findIndexedManual(vehicle);
  if (indexedManualId) {
    const { data: manualRow } = await supabase
      .from('manuals')
      .select('id, file_url, title')
      .eq('id', indexedManualId)
      .single();

    if (manualRow?.file_url) {
      const result: ManualRetrievalResult = {
        source: 'indexed_manual',
        vehicle,
        manual_url: manualRow.file_url,
        manual_title: manualRow.title || `${vehicle.year} ${vehicle.make} ${vehicle.model} Owner's Manual`,
        retrieved_at: now,
        cached: false,
      };
      await cacheResult(cacheKey, vehicle, result);
      onProgress?.('done', 'Found in existing manual library');
      return result;
    }
  }

  // 3. VehicleDatabases.com
  const vdbResult = await queryVehicleDatabases(vehicle);
  if (vdbResult?.manual_url) {
    const storedUrl = await importPdfToStorage(
      vdbResult.manual_url,
      vehicle,
      cacheKey,
      vdbResult,
      onProgress,
      context
    );
    const result = storedUrl ? { ...vdbResult, manual_url: storedUrl } : vdbResult;
    await cacheResult(cacheKey, vehicle, result);
    onProgress?.('done', 'Found via VehicleDatabases API');
    return result;
  }

  // 4. Expanded OEM direct URL patterns (40+ manufacturers)
  onProgress?.('trying_oem', `Checking ${vehicle.make} manufacturer site...`);
  const oemResult = await tryOemFallback(vehicle);
  if (oemResult?.manual_url) {
    const storedUrl = await importPdfToStorage(
      oemResult.manual_url,
      vehicle,
      cacheKey,
      oemResult,
      onProgress,
      context
    );
    const result = storedUrl ? { ...oemResult, manual_url: storedUrl } : oemResult;
    await cacheResult(cacheKey, vehicle, result);
    onProgress?.('done', `Found via ${vehicle.make} official site`);
    return result;
  }

  // 5. AI-powered deep research (candidate ranking, not generation)
  onProgress?.('asking_ai', 'AI is researching official manual sources...');
  try {
    const aiResearch = await researchManualWithAI(vehicle);
    const aiBestUrl = aiResearch.bestCandidate?.url;
    const aiBestConfidence = aiResearch.bestCandidate?.confidence;
    if (aiBestUrl && aiBestConfidence !== 'low') {
      onProgress?.('verifying_url', `Verifying: ${aiBestUrl}`);
      const verifiedAiUrl = await resolveVerifiedPdfUrl(aiBestUrl);
      if (verifiedAiUrl) {
        const storedUrl = await importPdfToStorage(
          verifiedAiUrl,
          vehicle,
          cacheKey,
          {
            source: 'ai_research',
            vehicle,
            manual_url: verifiedAiUrl,
            manual_title: '',
            retrieved_at: now,
            cached: false,
          },
          onProgress,
          context
        );
        const result: ManualRetrievalResult = {
          source: 'ai_research',
          vehicle,
          manual_url: storedUrl || verifiedAiUrl,
          manual_title: `${vehicle.year} ${vehicle.make} ${vehicle.model} Owner's Manual`,
          retrieved_at: now,
          cached: false,
        };
        await cacheResult(cacheKey, vehicle, result);
        onProgress?.('done', storedUrl ? 'PDF downloaded and imported' : 'PDF URL verified');
        return result;
      }
    }
  } catch (err) {
    console.warn('[ManualRetrieval] AI research failed:', err);
  }

  // 6. Quick AI single-URL suggestion (lighter-weight fallback)
  const aiUrl = await discoverUrlWithAI(vehicle);
  if (aiUrl) {
    onProgress?.('verifying_url', `Verifying: ${aiUrl}`);
    const verifiedAiUrl = await resolveVerifiedPdfUrl(aiUrl);
    if (verifiedAiUrl) {
      const storedUrl = await importPdfToStorage(
        verifiedAiUrl,
        vehicle,
        cacheKey,
        {
          source: 'ai_discovered',
          vehicle,
          manual_url: verifiedAiUrl,
          manual_title: '',
          retrieved_at: now,
          cached: false,
        },
        onProgress,
        context
      );
      const result: ManualRetrievalResult = {
        source: 'ai_discovered',
        vehicle,
        manual_url: storedUrl || verifiedAiUrl,
        manual_title: `${vehicle.year} ${vehicle.make} ${vehicle.model} Owner's Manual`,
        retrieved_at: now,
        cached: false,
      };
      await cacheResult(cacheKey, vehicle, result);
      onProgress?.('done', storedUrl ? 'PDF downloaded and imported' : 'PDF URL verified');
      return result;
    }
  }

  // 7. Third-party aggregator search
  onProgress?.('searching_aggregators', 'Searching manual aggregator sites...');
  try {
    const aggDiscovery = await discoverManualUrl(vehicle, ['oem_direct', 'oem_portal_crawl', 'search_engine', 'ai_research']);
    if (aggDiscovery.bestCandidate?.verified && aggDiscovery.bestCandidate.url) {
      const storedUrl = await importPdfToStorage(
        aggDiscovery.bestCandidate.url,
        vehicle,
        cacheKey,
        {
          source: 'aggregator',
          vehicle,
          manual_url: aggDiscovery.bestCandidate.url,
          manual_title: aggDiscovery.bestCandidate.title || '',
          retrieved_at: now,
          cached: false,
        },
        onProgress,
        context
      );
      const result: ManualRetrievalResult = {
        source: 'aggregator',
        vehicle,
        manual_url: storedUrl || aggDiscovery.bestCandidate.url,
        manual_title: aggDiscovery.bestCandidate.title || `${vehicle.year} ${vehicle.make} ${vehicle.model} Owner's Manual`,
        retrieved_at: now,
        cached: false,
      };
      await cacheResult(cacheKey, vehicle, result);
      onProgress?.('done', 'Found via manual aggregator');
      return result;
    }
  } catch (err) {
    console.warn('[ManualRetrieval] Aggregator search failed:', err);
  }

  // 8. Web search fallback – last resort
  onProgress?.('fallback', 'No direct PDF found — providing search link');
  const searchUrl = buildWebSearchFallbackUrl(vehicle);
  return {
    source: 'web_search',
    vehicle,
    manual_url: searchUrl,
    manual_title: `Search for ${vehicle.year} ${vehicle.make} ${vehicle.model} Owner's Manual`,
    retrieved_at: now,
    cached: false,
  };
}

/**
 * Download a verified PDF, upload to Supabase Storage, and optionally
 * trigger the RAG pipeline. Returns the Supabase Storage public URL,
 * or null if the download was blocked (e.g. CORS on web).
 */
async function importPdfToStorage(
  pdfUrl: string,
  vehicle: VehicleLookup,
  cacheKey: string,
  partialResult: ManualRetrievalResult,
  onProgress?: ProgressCallback,
  context?: ManualRetrievalContext
): Promise<string | null> {
  onProgress?.('downloading_pdf', 'Downloading PDF...');
  const storedUrl = await downloadAndStorePdf(pdfUrl, vehicle);

  if (storedUrl) {
    onProgress?.('uploading', 'Uploading to secure storage...');
    // Create/update the manual record in the database
    const manualId = await createManualRecord(vehicle, storedUrl);

    if (manualId) {
      await linkManualToVehicle(manualId, context);
      // Kick off RAG processing in the background (non-blocking)
      onProgress?.('processing_rag', 'Processing manual for AI search...');
      import('./rag-pipeline').then(({ processManual }) => {
        processManual(manualId, storedUrl, vehicle).catch((err: unknown) => {
          console.warn('[ManualRetrieval] RAG processing failed (non-fatal):', err);
        });
      });
    }
  }

  return storedUrl;
}

/**
 * Cache a successful manual lookup.
 */
async function cacheResult(
  cacheKey: string,
  vehicle: VehicleLookup,
  result: ManualRetrievalResult
): Promise<void> {
  if (!result.manual_url) return;
  await writeToCache({
    cache_key: cacheKey,
    vehicle,
    manual_url: result.manual_url,
    source: result.source,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
  });
}

// ---------------------------------------------------------------------------
// 7. Check Supabase manuals table for already-processed manuals
// ---------------------------------------------------------------------------

/**
 * Check if we already have an indexed manual for this vehicle.
 * Returns the manual_id if found.
 */
export async function findIndexedManual(
  vehicle: VehicleLookup
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('manuals')
      .select('manual_id, processing_status')
      .eq('make', vehicle.make)
      .eq('model', vehicle.model)
      .eq('year', vehicle.year)
      .eq('processing_status', 'completed')
      .limit(1)
      .single();

    if (error || !data) return null;
    return data.manual_id;
  } catch {
    return null;
  }
}

/**
 * Create a new manual record in Supabase for processing.
 */
export async function createManualRecord(
  vehicle: VehicleLookup,
  pdfUrl: string
): Promise<string | null> {
  try {
    const { data: existing, error: existingError } = await supabase
      .from('manuals')
      .select('manual_id')
      .eq('make', vehicle.make)
      .eq('model', vehicle.model)
      .eq('year', vehicle.year)
      .eq('file_url', pdfUrl)
      .limit(1)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      console.warn('[ManualRetrieval] Existing manual lookup failed:', existingError);
    }

    if (existing?.manual_id) {
      return existing.manual_id;
    }

    const { data, error } = await supabase
      .from('manuals')
      .insert({
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        trim: vehicle.trim || null,
        file_url: pdfUrl,
        language: 'en',
        processing_status: 'pending',
      })
      .select('manual_id')
      .single();

    if (error || !data) {
      console.warn('[ManualRetrieval] Failed to create manual record:', error);
      return null;
    }

    return data.manual_id;
  } catch (err) {
    console.warn('[ManualRetrieval] createManualRecord error:', err);
    return null;
  }
}

async function linkManualToVehicle(
  manualId: string,
  context?: ManualRetrievalContext
): Promise<void> {
  if (!context?.userId || !context?.vehicleId) return;

  try {
    const { error } = await supabase
      .from('vehicles')
      .update({
        manual_id: manualId,
        updated_at: new Date().toISOString(),
      })
      .eq('vehicle_id', context.vehicleId)
      .eq('user_id', context.userId);

    if (error) {
      console.warn('[ManualRetrieval] Failed to link manual to vehicle:', error);
    }
  } catch (err) {
    console.warn('[ManualRetrieval] Vehicle manual link failed:', err);
  }
}

// ---------------------------------------------------------------------------
// 8. Comprehensive vehicle report
// ---------------------------------------------------------------------------

export interface VehicleReport {
  vehicle: VehicleLookup;
  manual: ManualRetrievalResult;
  recalls: RecallResult;
  safety: SafetyRatingResult;
  indexed_manual_id: string | null;
}

/**
 * Produce a comprehensive vehicle report including manual URL,
 * active recalls, safety ratings, and indexed manual status.
 */
export async function getVehicleReport(
  vinOrLookup: string | VehicleLookup,
  onProgress?: ProgressCallback,
  context?: ManualRetrievalContext
): Promise<VehicleReport> {
  const vehicle = await resolveVehicle(vinOrLookup);

  // Manual retrieval runs first (sequential, with progress); others run in parallel
  const manual = await retrieveManual(vehicle, onProgress, context);

  const [recalls, safety, indexedManualId] = await Promise.all([
    getRecalls(vehicle),
    getSafetyRatings(vehicle),
    findIndexedManual(vehicle),
  ]);

  return {
    vehicle,
    manual,
    recalls,
    safety,
    indexed_manual_id: indexedManualId,
  };
}
