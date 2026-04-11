/**
 * Gear AI CoPilot – AI-Powered Manual Research Service
 *
 * When direct URL patterns and web scraping fail, this service uses
 * AI-powered reasoning + web search context to discover owner's manual
 * PDFs. The AI acts as a **candidate ranker and researcher**, not as
 * the primary source.
 *
 * Pipeline:
 *   1. Build structured research prompt with vehicle details
 *   2. Include web search results as context (if available)
 *   3. AI reasons about likely manual locations
 *   4. Parse candidate URLs from AI response
 *   5. Strictly verify each candidate
 *   6. Rank by confidence score
 *
 * SSRF Protection:
 *   - All AI-suggested URLs are validated before fetching
 *   - Private/internal IPs are blocked
 *   - Redirect chains are limited
 *
 * @module services/ai-manual-research
 */

import Constants from 'expo-constants';
import { VehicleLookup } from '../types/manual';
import { isSafeUrl, strictVerifyPdf, buildManualSearchQueries } from './web-manual-scraper';
import type { ScrapedManualCandidate } from './web-manual-scraper';
import { getOemSource } from './oem-manual-sources';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIResearchResult {
  candidates: ScrapedManualCandidate[];
  bestCandidate: ScrapedManualCandidate | null;
  reasoning: string;
  searchQueriesUsed: string[];
  timeMs: number;
}

interface AIManualSuggestion {
  url: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  source_type: 'oem_official' | 'dealer' | 'aggregator' | 'archive' | 'unknown';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AI_REQUEST_TIMEOUT_MS = 25_000;
const MAX_AI_CANDIDATES = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOpenAIKey(): string {
  return (
    (Constants.expoConfig?.extra?.openaiApiKey as string | undefined) ||
    process.env.OPENAI_API_KEY ||
    process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
    ''
  );
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Research Prompt Engineering
// ---------------------------------------------------------------------------

function buildResearchSystemPrompt(): string {
  return `You are an expert automotive research assistant specialized in finding official OEM vehicle owner's manuals online.

Your task: Given a vehicle's year, make, and model, identify the most likely direct download URL(s) for the official owner's manual PDF.

RULES:
1. Only suggest URLs you believe are REAL and currently accessible (no made-up URLs)
2. Prefer official manufacturer domains over third-party sites
3. If unsure, say so — never fabricate a URL
4. Consider common OEM URL patterns:
   - Ford: fordservicecontent.com, owner.ford.com
   - GM brands: my.chevrolet.com/content/dam/gmownercenter
   - Toyota: toyota.com/t3Portal
   - Honda: owners.honda.com, techinfo.honda.com
   - Hyundai: owners.hyundaiusa.com
   - Others: check brand-specific portals
5. Also consider reputable third-party sources:
   - carmanualsonline.info
   - manual-directory.com
   - ownersmanuals2.com
6. For each suggestion, rate your confidence (high/medium/low) honestly

Respond ONLY with valid JSON matching this schema:
{
  "suggestions": [
    {
      "url": "https://...",
      "confidence": "high|medium|low",
      "reasoning": "Brief explanation of why this URL likely works",
      "source_type": "oem_official|dealer|aggregator|archive|unknown"
    }
  ],
  "overall_reasoning": "Brief summary of your research approach"
}

If you cannot find any likely URLs, respond with:
{ "suggestions": [], "overall_reasoning": "explanation" }`;
}

function buildResearchUserPrompt(
  vehicle: VehicleLookup,
  webSearchContext?: string,
): string {
  const source = getOemSource(vehicle.make);
  const portalInfo = source
    ? `\nKnown OEM portal: ${source.portalUrl} (VIN lookup: ${source.supportsVinLookup ? 'yes' : 'no'})`
    : '\nNo known OEM portal pattern for this manufacturer.';

  const searchContext = webSearchContext
    ? `\n\nWeb search results for context:\n${webSearchContext}`
    : '';

  return `Find the official owner's manual PDF URL for:

Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}${vehicle.vin ? `\nVIN: ${vehicle.vin}` : ''}
${portalInfo}${searchContext}

Please suggest up to ${MAX_AI_CANDIDATES} candidate URLs in order of likelihood.`;
}

// ---------------------------------------------------------------------------
// Core AI Research Function
// ---------------------------------------------------------------------------

/**
 * Use AI to research and discover owner's manual PDF URLs.
 *
 * This is designed as a FALLBACK strategy when direct patterns and
 * web scraping have already failed. The AI reasons about where the
 * manual is likely hosted based on manufacturer patterns.
 *
 * @param vehicle - Vehicle to research
 * @param webSearchContext - Optional web search results to provide as context
 * @returns Research result with verified candidate URLs
 */
export async function researchManualWithAI(
  vehicle: VehicleLookup,
  webSearchContext?: string,
): Promise<AIResearchResult> {
  const startTime = Date.now();
  const apiKey = getOpenAIKey();

  if (!apiKey) {
    return {
      candidates: [],
      bestCandidate: null,
      reasoning: 'OpenAI API key not configured',
      searchQueriesUsed: [],
      timeMs: Date.now() - startTime,
    };
  }

  const searchQueries = buildManualSearchQueries(vehicle);

  try {
    const res = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [
            { role: 'system', content: buildResearchSystemPrompt() },
            { role: 'user', content: buildResearchUserPrompt(vehicle, webSearchContext) },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 800,
          temperature: 0,
        }),
      },
      AI_REQUEST_TIMEOUT_MS,
    );

    if (!res.ok) {
      console.warn(`[AIResearch] OpenAI responded ${res.status}`);
      return {
        candidates: [],
        bestCandidate: null,
        reasoning: `OpenAI API error: ${res.status}`,
        searchQueriesUsed: searchQueries,
        timeMs: Date.now() - startTime,
      };
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      return {
        candidates: [],
        bestCandidate: null,
        reasoning: 'Empty AI response',
        searchQueriesUsed: searchQueries,
        timeMs: Date.now() - startTime,
      };
    }

    const parsed = JSON.parse(content) as {
      suggestions: AIManualSuggestion[];
      overall_reasoning: string;
    };

    // Validate and verify each suggestion
    const verifiedCandidates: ScrapedManualCandidate[] = [];

    for (const suggestion of (parsed.suggestions || []).slice(0, MAX_AI_CANDIDATES)) {
      if (!suggestion.url || typeof suggestion.url !== 'string') continue;

      // SSRF check
      if (!isSafeUrl(suggestion.url)) {
        console.warn('[AIResearch] Blocked unsafe AI-suggested URL:', suggestion.url);
        continue;
      }

      // Must be HTTPS
      if (!suggestion.url.startsWith('https://')) continue;

      // Strict PDF verification
      const { verified, fileSize, finalUrl } = await strictVerifyPdf(suggestion.url);

      verifiedCandidates.push({
        url: finalUrl || suggestion.url,
        source: 'ai_research',
        confidence: verified ? suggestion.confidence : 'low',
        verified,
        fileSize,
        title: `${vehicle.year} ${vehicle.make} ${vehicle.model} Owner's Manual`,
      });
    }

    // Sort: verified first, then by confidence
    verifiedCandidates.sort((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      const order = { high: 3, medium: 2, low: 1 };
      return order[b.confidence] - order[a.confidence];
    });

    return {
      candidates: verifiedCandidates,
      bestCandidate: verifiedCandidates.find((c) => c.verified) || verifiedCandidates[0] || null,
      reasoning: parsed.overall_reasoning || 'No reasoning provided',
      searchQueriesUsed: searchQueries,
      timeMs: Date.now() - startTime,
    };
  } catch (err) {
    console.warn('[AIResearch] Research failed:', err);
    return {
      candidates: [],
      bestCandidate: null,
      reasoning: `Research error: ${err instanceof Error ? err.message : 'Unknown'}`,
      searchQueriesUsed: searchQueries,
      timeMs: Date.now() - startTime,
    };
  }
}

/**
 * Quick AI URL suggestion — lightweight single-URL mode.
 * Used as a fast fallback when only one suggestion is needed.
 */
export async function quickAISuggestion(vehicle: VehicleLookup): Promise<string | null> {
  const apiKey = getOpenAIKey();
  if (!apiKey) return null;

  try {
    const res = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'system',
              content:
                'Return a JSON object with the direct PDF URL for a vehicle owner\'s manual. Be precise. Only return URLs you are confident exist. Format: {"url": "https://...", "confidence": "high|medium|low"} or {"url": null}',
            },
            {
              role: 'user',
              content: `Direct PDF URL for ${vehicle.year} ${vehicle.make} ${vehicle.model} owner's manual?`,
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 200,
          temperature: 0,
        }),
      },
      20_000,
    );

    if (!res.ok) return null;

    const json = await res.json();
    const content = JSON.parse(json.choices?.[0]?.message?.content || '{}');
    const url: unknown = content.url;

    if (!url || typeof url !== 'string' || !url.startsWith('https://')) return null;
    if (!isSafeUrl(url)) return null;

    return url;
  } catch {
    return null;
  }
}
