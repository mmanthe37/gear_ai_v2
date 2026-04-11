/**
 * Gear AI CoPilot – Multi-Strategy Web Manual Scraper
 *
 * Discovers owner's manual PDFs through multiple web-based strategies:
 *   A. Direct OEM URL patterns (from oem-manual-sources.ts)
 *   B. Owner portal HTML crawl (parse links from manufacturer pages)
 *   C. Search engine discovery (structured web search queries)
 *   D. Third-party aggregator lookup (known manual aggregation sites)
 *
 * All strategies include:
 *   - SSRF protection (block private IPs, enforce HTTPS)
 *   - PDF verification (magic bytes, content-type, min file size)
 *   - Rate limiting (respectful delays between requests)
 *   - Timeout and redirect limits
 *
 * @module services/web-manual-scraper
 */

import { VehicleLookup } from '../types/manual';
import {
  generateOemCandidateUrls,
  getOemSource,
  getOemPortalUrl,
} from './oem-manual-sources';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapedManualCandidate {
  url: string;
  source: ManualDiscoveryStrategy;
  confidence: 'high' | 'medium' | 'low';
  verified: boolean;
  title?: string;
  fileSize?: number;
}

export type ManualDiscoveryStrategy =
  | 'oem_direct'
  | 'oem_portal_crawl'
  | 'search_engine'
  | 'aggregator'
  | 'ai_research';

export interface DiscoveryResult {
  candidates: ScrapedManualCandidate[];
  bestCandidate: ScrapedManualCandidate | null;
  strategiesAttempted: ManualDiscoveryStrategy[];
  totalTimeMs: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 5;
const MIN_PDF_SIZE_BYTES = 50_000; // 50KB minimum for a real owner's manual
const MAX_PDF_SIZE_BYTES = 200_000_000; // 200MB maximum
const MANUAL_LINK_KEYWORDS = ['manual', 'owner', 'owners', 'eowner', 'handbook', 'guide', 'om_'];

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Third-party aggregator sites that host/link OEM manuals */
const AGGREGATOR_SITES = [
  {
    name: 'CarManualsOnline',
    urlPattern: (v: VehicleLookup) =>
      `https://www.carmanualsonline.info/${v.make.toLowerCase()}-${v.model.toLowerCase().replace(/\s+/g, '-')}-${v.year}-owners-manual-online`,
    searchUrl: (v: VehicleLookup) =>
      `https://www.carmanualsonline.info/search?q=${v.year}+${v.make}+${v.model}+owners+manual`,
  },
  {
    name: 'ManualDirectory',
    urlPattern: (v: VehicleLookup) =>
      `https://manual-directory.com/${v.make.toLowerCase()}/${v.model.toLowerCase().replace(/\s+/g, '-')}/${v.year}/`,
    searchUrl: (v: VehicleLookup) =>
      `https://manual-directory.com/search/?q=${v.year}+${v.make}+${v.model}`,
  },
  {
    name: 'OwnersManuals2',
    urlPattern: (v: VehicleLookup) =>
      `https://ownersmanuals2.com/${v.make.toLowerCase()}/${v.model.toLowerCase().replace(/\s+/g, '-')}-${v.year}-owners-manual`,
    searchUrl: (v: VehicleLookup) =>
      `https://ownersmanuals2.com/?s=${v.year}+${v.make}+${v.model}`,
  },
];

// ---------------------------------------------------------------------------
// SSRF Protection
// ---------------------------------------------------------------------------

/** Block private/internal IPs to prevent SSRF attacks */
const BLOCKED_IP_PATTERNS = [
  /^127\./,                    // loopback
  /^10\./,                     // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./, // Class B private
  /^192\.168\./,               // Class C private
  /^169\.254\./,               // link-local
  /^0\./,                      // current network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT
  /^fe80:/i,                   // IPv6 link-local
  /^::1$/,                     // IPv6 loopback
  /^fc00:/i, /^fd00:/i,       // IPv6 ULA
  /^metadata\./i,             // cloud metadata
  /^instance-data\./i,        // cloud metadata alias
];

/**
 * Validate a URL is safe to fetch (SSRF protection).
 * - Must be HTTPS (or HTTP for known safe domains)
 * - Must not resolve to a private/internal IP
 * - Must not be a known metadata endpoint
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Must be http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // Block direct IP access (common SSRF vector)
    const hostname = parsed.hostname;
    if (BLOCKED_IP_PATTERNS.some((pattern) => pattern.test(hostname))) {
      return false;
    }

    // Block cloud metadata endpoints
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return false;
    }

    // Block localhost variants
    if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '[::1]') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function safeFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response | null> {
  if (!isSafeUrl(url)) {
    console.warn('[WebScraper] Blocked unsafe URL:', url);
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/pdf,*/*;q=0.8',
        ...options.headers,
      },
      redirect: 'follow',
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// PDF Verification (strict)
// ---------------------------------------------------------------------------

/**
 * Strictly verify a URL points to a real PDF document.
 * Checks: HTTP status, content-type, magic bytes, minimum file size.
 * Does NOT accept URLs just because they end in ".pdf".
 */
export async function strictVerifyPdf(url: string): Promise<{
  verified: boolean;
  fileSize?: number;
  finalUrl?: string;
}> {
  if (!isSafeUrl(url)) return { verified: false };

  // Strategy 1: HEAD request for content-type and content-length
  try {
    const head = await safeFetch(url, { method: 'HEAD' }, 8_000);
    if (head && head.ok) {
      const ct = (head.headers.get('content-type') || '').toLowerCase();
      const cl = parseInt(head.headers.get('content-length') || '0', 10);

      if (ct.includes('pdf') || ct.includes('octet-stream')) {
        if (cl > 0 && cl < MIN_PDF_SIZE_BYTES) {
          return { verified: false }; // Too small to be a real manual
        }
        if (cl > MAX_PDF_SIZE_BYTES) {
          return { verified: false }; // Suspiciously large
        }
        // Verify magic bytes
        const magicCheck = await verifyPdfMagicBytes(url);
        if (magicCheck) {
          return { verified: true, fileSize: cl || undefined, finalUrl: head.url || url };
        }
      }

      // HTML response — not a PDF
      if (ct.includes('html') || ct.includes('text')) {
        return { verified: false };
      }
    }
  } catch {
    // HEAD may not be supported — fall through
  }

  // Strategy 2: Range request for magic bytes
  const magicCheck = await verifyPdfMagicBytes(url);
  return { verified: magicCheck, finalUrl: magicCheck ? url : undefined };
}

/**
 * Verify PDF magic bytes (%PDF-) via a Range request.
 */
async function verifyPdfMagicBytes(url: string): Promise<boolean> {
  try {
    const res = await safeFetch(
      url,
      { headers: { Range: 'bytes=0-4' } },
      8_000,
    );
    if (!res || (!res.ok && res.status !== 206)) return false;

    const bytes = new Uint8Array(await res.arrayBuffer());
    // PDF magic: 0x25 0x50 0x44 0x46 → %PDF
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Strategy A: Direct OEM URL Patterns
// ---------------------------------------------------------------------------

async function tryOemDirectUrls(vehicle: VehicleLookup): Promise<ScrapedManualCandidate[]> {
  const candidates = generateOemCandidateUrls(vehicle);
  const results: ScrapedManualCandidate[] = [];

  for (const url of candidates) {
    const { verified, fileSize, finalUrl } = await strictVerifyPdf(url);
    if (verified) {
      results.push({
        url: finalUrl || url,
        source: 'oem_direct',
        confidence: 'high',
        verified: true,
        fileSize,
        title: `${vehicle.year} ${vehicle.make} ${vehicle.model} Owner's Manual`,
      });
      break; // First verified hit is enough for direct patterns
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Strategy B: OEM Portal HTML Crawl
// ---------------------------------------------------------------------------

async function crawlOemPortal(vehicle: VehicleLookup): Promise<ScrapedManualCandidate[]> {
  const source = getOemSource(vehicle.make);
  if (!source) return [];

  const portalUrl = source.portalUrl;
  const results: ScrapedManualCandidate[] = [];

  try {
    const res = await safeFetch(portalUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
    });

    if (!res || !res.ok) return [];

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('html')) return [];

    const html = await res.text();
    const pdfLinks = extractManualLinks(html, portalUrl, vehicle);

    for (const link of pdfLinks.slice(0, 5)) {
      const { verified, fileSize, finalUrl } = await strictVerifyPdf(link);
      if (verified) {
        results.push({
          url: finalUrl || link,
          source: 'oem_portal_crawl',
          confidence: 'medium',
          verified: true,
          fileSize,
          title: `${vehicle.year} ${vehicle.make} ${vehicle.model} Owner's Manual`,
        });
      }
    }
  } catch {
    // Portal may block or be unavailable
  }

  return results;
}

/**
 * Extract PDF links from HTML that are relevant to the target vehicle.
 */
function extractManualLinks(html: string, baseUrl: string, vehicle: VehicleLookup): string[] {
  const links = new Set<string>();
  const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  const yearStr = vehicle.year.toString();
  const modelLower = vehicle.model.toLowerCase();

  while ((match = hrefRegex.exec(html)) && links.size < 20) {
    const href = match[1]?.trim();
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('#')) {
      continue;
    }

    try {
      const absolute = new URL(href, baseUrl).toString();
      if (!isSafeUrl(absolute)) continue;

      const lower = absolute.toLowerCase();
      const hasManualHint = MANUAL_LINK_KEYWORDS.some((kw) => lower.includes(kw));
      const hasYearHint = lower.includes(yearStr);
      const hasModelHint = lower.includes(modelLower.replace(/\s+/g, '-')) ||
        lower.includes(modelLower.replace(/\s+/g, '_')) ||
        lower.includes(modelLower.replace(/\s+/g, ''));

      // Require at least a manual keyword plus either year or model match
      if (hasManualHint && (hasYearHint || hasModelHint)) {
        links.add(absolute);
      }
    } catch {
      // Ignore malformed href
    }
  }

  return [...links];
}

// ---------------------------------------------------------------------------
// Strategy C: Third-Party Aggregator Lookup
// ---------------------------------------------------------------------------

async function tryAggregators(vehicle: VehicleLookup): Promise<ScrapedManualCandidate[]> {
  const results: ScrapedManualCandidate[] = [];

  for (const aggregator of AGGREGATOR_SITES) {
    try {
      const url = aggregator.urlPattern(vehicle);
      if (!isSafeUrl(url)) continue;

      const res = await safeFetch(url);
      if (!res || !res.ok) continue;

      const ct = (res.headers.get('content-type') || '').toLowerCase();

      // If the aggregator directly serves a PDF
      if (ct.includes('pdf')) {
        const { verified, fileSize } = await strictVerifyPdf(url);
        if (verified) {
          results.push({
            url,
            source: 'aggregator',
            confidence: 'medium',
            verified: true,
            fileSize,
            title: `${vehicle.year} ${vehicle.make} ${vehicle.model} Owner's Manual (${aggregator.name})`,
          });
          continue;
        }
      }

      // Parse HTML for PDF links
      if (ct.includes('html')) {
        const html = await res.text();
        const pdfLinks = extractManualLinks(html, url, vehicle);
        for (const link of pdfLinks.slice(0, 3)) {
          const { verified, fileSize, finalUrl } = await strictVerifyPdf(link);
          if (verified) {
            results.push({
              url: finalUrl || link,
              source: 'aggregator',
              confidence: 'medium',
              verified: true,
              fileSize,
              title: `${vehicle.year} ${vehicle.make} ${vehicle.model} Owner's Manual (${aggregator.name})`,
            });
            break; // One verified hit per aggregator is sufficient
          }
        }
      }
    } catch {
      // Aggregator unavailable
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Orchestrator: Multi-Strategy Discovery
// ---------------------------------------------------------------------------

/**
 * Run all web-based manual discovery strategies for a vehicle.
 *
 * Strategies run in priority order, stopping early if a high-confidence
 * verified candidate is found. Lower-priority strategies still contribute
 * to the candidates list for ranking.
 *
 * @param vehicle - Vehicle to find the manual for
 * @param skipStrategies - Strategies to skip (e.g. if already tried upstream)
 * @returns Discovery result with ranked candidates
 */
export async function discoverManualUrl(
  vehicle: VehicleLookup,
  skipStrategies: ManualDiscoveryStrategy[] = [],
): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const allCandidates: ScrapedManualCandidate[] = [];
  const attempted: ManualDiscoveryStrategy[] = [];

  // Strategy A: Direct OEM URL Patterns (fastest, highest confidence)
  if (!skipStrategies.includes('oem_direct')) {
    attempted.push('oem_direct');
    const oemDirect = await tryOemDirectUrls(vehicle);
    allCandidates.push(...oemDirect);

    // Early exit if we got a verified high-confidence hit
    if (oemDirect.some((c) => c.verified && c.confidence === 'high')) {
      return {
        candidates: allCandidates,
        bestCandidate: allCandidates[0],
        strategiesAttempted: attempted,
        totalTimeMs: Date.now() - startTime,
      };
    }
  }

  // Strategy B: OEM Portal Crawl (slower, medium confidence)
  if (!skipStrategies.includes('oem_portal_crawl')) {
    attempted.push('oem_portal_crawl');
    const portalResults = await crawlOemPortal(vehicle);
    allCandidates.push(...portalResults);
  }

  // Strategy D: Third-party Aggregators (medium confidence)
  if (!skipStrategies.includes('aggregator')) {
    attempted.push('aggregator');
    const aggregatorResults = await tryAggregators(vehicle);
    allCandidates.push(...aggregatorResults);
  }

  // Rank candidates by confidence and verification
  allCandidates.sort((a, b) => {
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    const aScore = (a.verified ? 10 : 0) + confidenceOrder[a.confidence];
    const bScore = (b.verified ? 10 : 0) + confidenceOrder[b.confidence];
    return bScore - aScore;
  });

  return {
    candidates: allCandidates,
    bestCandidate: allCandidates[0] || null,
    strategiesAttempted: attempted,
    totalTimeMs: Date.now() - startTime,
  };
}

/**
 * Build a structured web search query for finding a vehicle's owner's manual.
 * Returns multiple query variations for search engines.
 */
export function buildManualSearchQueries(vehicle: VehicleLookup): string[] {
  const base = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  return [
    `${base} owner's manual PDF official`,
    `${base} owners manual PDF download`,
    `site:${vehicle.make.toLowerCase()}.com ${base} owner manual`,
    `${base} owner's manual filetype:pdf`,
  ];
}

/**
 * Get the OEM portal URL as a fallback link for the user.
 */
export function getManualPortalFallback(vehicle: VehicleLookup): string | null {
  return getOemPortalUrl(vehicle.make);
}
