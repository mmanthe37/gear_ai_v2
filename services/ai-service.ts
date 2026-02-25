/**
 * Gear AI CoPilot - AI Service
 *
 * Integrates with OpenAI for conversational AI, RAG-powered
 * owner's manual queries, and vehicle-context-aware responses.
 *
 * Uses the two-stage retrieval pipeline (BM25 + semantic) to ground
 * responses in actual owner's manual content, recalls, and specs.
 */

import {
  AIRequest,
  AIResponse,
  SearchQuery,
  SearchResult,
  RAGSource,
  VehicleFullContext,
  RepairCostEstimate,
  CompatiblePart,
  ParsedMaintenanceLog,
  PrepurchaseReport,
} from '../types';
import {
  VehicleLookup,
  ManualSearchResult,
} from '../types/manual';
import { searchManual, quickSearch } from './manual-search';
import {
  retrieveManual,
  getRecalls,
  findIndexedManual,
} from './manual-retrieval';
import Constants from 'expo-constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4.1-mini';
const FALLBACK_MODEL = 'gpt-4.1-mini';

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const BASE_SYSTEM_PROMPT = `You are Gear AI, an expert automotive assistant specializing in owner's manual queries, vehicle maintenance, diagnostics, and safety information.

Guidelines:
- Be precise and cite page numbers when referencing owner's manual content.
- When providing maintenance specifications (oil type, tire pressure, fluid capacities), always give the exact values from the manual.
- If you are unsure or don't have the specific information, say so clearly and recommend consulting the physical owner's manual or an authorized dealer.
- Flag any safety warnings prominently.
- Use plain language accessible to non-mechanics while being technically accurate.`;

function buildVehicleContext(vehicle: VehicleLookup): string {
  let ctx = `\nVehicle Context: ${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  if (vehicle.trim) ctx += ` ${vehicle.trim}`;
  if (vehicle.vin) ctx += ` (VIN: ${vehicle.vin})`;
  return ctx;
}

/** F1: Build enhanced context from full vehicle data including maintenance history and active codes */
function buildEnhancedVehicleContext(ctx: VehicleFullContext): string {
  let out = `\nVehicle: ${ctx.year} ${ctx.make} ${ctx.model}`;
  if (ctx.trim) out += ` ${ctx.trim}`;
  if (ctx.vin) out += ` (VIN: ${ctx.vin})`;
  if (ctx.current_mileage) out += `\nCurrent Mileage: ${ctx.current_mileage.toLocaleString()} miles`;
  if (ctx.monthly_mileage_delta) out += `\nMileage this month: +${ctx.monthly_mileage_delta} miles`;

  if (ctx.recent_maintenance?.length) {
    out += '\n\nRecent Maintenance History:';
    ctx.recent_maintenance.slice(0, 8).forEach((r) => {
      out += `\n- ${r.title} on ${r.date}`;
      if (r.mileage) out += ` at ${r.mileage.toLocaleString()} mi`;
      if (r.parts_replaced?.length) out += ` (parts: ${r.parts_replaced.join(', ')})`;
    });
  }

  if (ctx.active_codes?.length) {
    out += '\n\nActive Diagnostic Codes:';
    ctx.active_codes.forEach((c) => {
      out += `\n- ${c.code}: ${c.description} [${c.severity}]`;
    });
  }

  if (ctx.pending_services?.length) {
    out += '\n\nPending / Upcoming Services:';
    ctx.pending_services.slice(0, 5).forEach((s) => {
      out += `\n- ${s.title} [${s.priority}]`;
      if (s.due_mileage) out += ` — due at ${s.due_mileage.toLocaleString()} mi`;
      if (s.due_date) out += ` — due by ${s.due_date}`;
    });
  }

  return out;
}

/** F1: Build seasonal advice context based on current month */
function buildSeasonalContext(): string {
  const month = new Date().getMonth(); // 0=Jan, 11=Dec
  if (month >= 10 || month <= 1) {
    return '\n\nSeasonal Note: Winter conditions — proactively mention battery health, antifreeze levels, tire tread/pressure, wiper blades, and 4WD/AWD readiness when relevant.';
  }
  if (month >= 2 && month <= 4) {
    return '\n\nSeasonal Note: Spring — proactively mention winter damage inspection (undercarriage, brakes, alignment), pollen cabin filter replacement, and A/C pre-season check when relevant.';
  }
  if (month >= 5 && month <= 7) {
    return '\n\nSeasonal Note: Summer — proactively mention coolant system health, A/C refrigerant, tire pressure (heat expansion), and long-trip readiness when relevant.';
  }
  return '\n\nSeasonal Note: Fall — proactively mention tire swap (winter tires), battery load test, and heating system readiness when relevant.';
}

function buildRAGContext(sources: RAGSource[]): string {
  if (sources.length === 0) return '';

  let ctx = '\n\nRelevant Owner\'s Manual Excerpts:\n';
  sources.forEach((source, i) => {
    ctx += `\n[Source ${i + 1}]`;
    if (source.manual_name) ctx += ` ${source.manual_name}`;
    if (source.page_number) ctx += `, Page ${source.page_number}`;
    if (source.section_title) ctx += ` - ${source.section_title}`;
    ctx += `:\n${source.chunk_text}\n`;
  });
  ctx += '\nAlways cite the specific source number and page when using information from the manual excerpts above.';
  return ctx;
}

function buildRecallContext(
  recalls: Array<{ Component: string; Summary: string; Remedy: string }>
): string {
  if (recalls.length === 0) return '';

  let ctx = '\n\nActive NHTSA Recalls for this vehicle:\n';
  recalls.forEach((r, i) => {
    ctx += `\n[Recall ${i + 1}] Component: ${r.Component}\nSummary: ${r.Summary}\nRemedy: ${r.Remedy}\n`;
  });
  ctx += '\nMention any relevant recalls when they relate to the user\'s question.';
  return ctx;
}

// ---------------------------------------------------------------------------
// Core AI response generation
// ---------------------------------------------------------------------------

/**
 * Generate an AI response with full RAG pipeline integration.
 *
 * Flow:
 *   1. If vehicle context provided, search indexed manuals for relevant chunks
 *   2. Optionally fetch recall data for safety-related queries
 *   3. Build system prompt with manual excerpts and vehicle context
 *   4. Call OpenAI GPT-4 Turbo for the response
 *   5. Return response with source citations
 */
export async function generateAIResponse(
  request: AIRequest
): Promise<AIResponse> {
  const apiKey = Constants.expoConfig?.extra?.openaiApiKey || process.env.OPENAI_API_KEY;

  // If no API key, fall back to intelligent template response
  if (!apiKey) {
    return generateTemplateResponse(request);
  }

  let ragSources: RAGSource[] = [];
  let recallContext = '';
  let vehicleContext = '';

  // Build vehicle lookup from request metadata
  const vehicle = extractVehicleFromRequest(request);

  if (vehicle) {
    // Use full VehicleFullContext if provided (F1), else fall back to basic lookup
    vehicleContext = request.vehicle_context
      ? buildEnhancedVehicleContext(request.vehicle_context)
      : buildVehicleContext(vehicle);

    vehicleContext += buildSeasonalContext();

    // RAG search: find relevant manual chunks
    if (request.include_rag !== false) {
      try {
        const manualId = await findIndexedManual(vehicle);
        const searchResults = await quickSearch(
          request.message,
          vehicle,
          manualId || undefined
        );

        ragSources = searchResults.map((r: ManualSearchResult) => ({
          embedding_id: r.chunk_id,
          manual_id: r.manual_id,
          chunk_text: r.chunk_text,
          page_number: r.page_number,
          section_title: r.section_title,
          similarity_score: r.score,
          manual_name: `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model} Owner's Manual`,
        }));
      } catch (err) {
        console.warn('[AI Service] RAG search failed, proceeding without manual context:', err);
      }
    }

    // Check for recalls if the question seems safety-related
    if (isSafetyRelated(request.message)) {
      try {
        const recallResult = await getRecalls(vehicle);
        if (recallResult.recalls.length > 0) {
          recallContext = buildRecallContext(
            recallResult.recalls.slice(0, 3)
          );
        }
      } catch (err) {
        console.warn('[AI Service] Recall fetch failed:', err);
      }
    }
  }

  // Build the full system prompt
  const systemPrompt =
    BASE_SYSTEM_PROMPT +
    vehicleContext +
    buildRAGContext(ragSources) +
    recallContext;

  try {
    const model = request.attachment?.type === 'image' ? 'gpt-4o' :
      request.context_type === 'general' ? FALLBACK_MODEL : DEFAULT_MODEL;

    // Build user message — plain text or multimodal with image
    const userContent: any = request.attachment?.type === 'image'
      ? [
          { type: 'image_url', image_url: { url: request.attachment.data_uri, detail: 'high' } },
          { type: 'text', text: request.message },
        ]
      : request.message;

    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 1000,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn('[AI Service] OpenAI API error:', res.status, errBody);
      return generateTemplateResponse(request);
    }

    const json = await res.json();
    const choice = json.choices?.[0];

    return {
      message_id: generateUUID(),
      content: choice?.message?.content || 'I was unable to generate a response. Please try again.',
      sources: ragSources.length > 0 ? ragSources : undefined,
      tokens_used: json.usage?.total_tokens || 0,
      model_version: json.model || model,
      created_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[AI Service] OpenAI request failed:', err);
    return generateTemplateResponse(request);
  }
}

// ---------------------------------------------------------------------------
// Template-based fallback (no API key)
// ---------------------------------------------------------------------------

function generateTemplateResponse(request: AIRequest): AIResponse {
  const content = getSmartTemplateResponse(request.message);
  return {
    message_id: generateUUID(),
    content,
    tokens_used: 0,
    model_version: 'template-v1',
    created_at: new Date().toISOString(),
  };
}

function getSmartTemplateResponse(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes('oil') && (lower.includes('type') || lower.includes('change') || lower.includes('weight'))) {
    return 'To find the correct oil type and capacity for your vehicle, I recommend checking your owner\'s manual in the "Maintenance" or "Specifications" section. Common specifications include 0W-20, 5W-20, or 5W-30 synthetic oil. Once I have access to your indexed manual, I can provide the exact specification.';
  }

  if (lower.includes('tire') && (lower.includes('pressure') || lower.includes('psi') || lower.includes('size'))) {
    return 'Tire pressure specifications are typically found on a sticker inside the driver\'s door jamb and in the "Tires" section of your owner\'s manual. I\'ll be able to provide exact PSI values once your vehicle\'s manual is indexed in the system.';
  }

  if (lower.includes('recall') || lower.includes('safety')) {
    return 'I can check NHTSA recall data for your vehicle. Recall information is retrieved in real-time from the National Highway Traffic Safety Administration database. Please ensure your vehicle\'s year, make, and model are set correctly.';
  }

  if (lower.includes('maintenance') || lower.includes('schedule') || lower.includes('service')) {
    return 'Maintenance schedules vary by vehicle and driving conditions. Your owner\'s manual contains detailed service intervals. Common schedules include oil changes every 5,000-7,500 miles, tire rotation every 5,000 miles, and brake inspection every 12,000-15,000 miles. I\'ll be able to give you exact intervals once your manual is indexed.';
  }

  if (lower.includes('warning') || lower.includes('light') || lower.includes('dashboard')) {
    return 'Dashboard warning lights are explained in the "Instrument Cluster" or "Warning Indicators" section of your owner\'s manual. Common warnings include check engine (amber), oil pressure (red), battery (red), and TPMS (amber). If you see a red warning light, pull over safely and address it immediately.';
  }

  if (lower.includes('manual') || lower.includes('download') || lower.includes('pdf')) {
    return 'I can retrieve your owner\'s manual PDF through the VehicleDatabases API or directly from your manufacturer\'s website. Navigate to the "Manuals" tab and enter your VIN or vehicle details to begin the retrieval process.';
  }

  return 'I\'m your Gear AI assistant, ready to help with vehicle maintenance, owner\'s manual queries, diagnostics, and safety information. Ask me about oil specifications, tire pressure, maintenance schedules, dashboard warnings, or any other vehicle-related question. For the best experience, make sure your vehicle is set up so I can reference your specific owner\'s manual.';
}

// ---------------------------------------------------------------------------
// F1: Proactive suggestions based on vehicle state
// ---------------------------------------------------------------------------

/**
 * Generate proactive maintenance/safety suggestions based on current vehicle context.
 * Returns up to 3 short suggestion strings to show as chips in the chat UI.
 */
export async function getProactiveSuggestions(ctx: VehicleFullContext): Promise<string[]> {
  const suggestions: string[] = [];

  // Mileage-based oil change prediction
  if (ctx.current_mileage && ctx.monthly_mileage_delta && ctx.recent_maintenance) {
    const lastOil = ctx.recent_maintenance.find((r) =>
      r.title.toLowerCase().includes('oil') && r.mileage
    );
    if (lastOil?.mileage) {
      const nextOilMileage = lastOil.mileage + 5000;
      const milesRemaining = nextOilMileage - ctx.current_mileage;
      if (milesRemaining > 0 && ctx.monthly_mileage_delta > 0) {
        const monthsOut = (milesRemaining / ctx.monthly_mileage_delta).toFixed(1);
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + parseFloat(monthsOut));
        suggestions.push(
          `Oil change due ~${dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} (${milesRemaining.toLocaleString()} mi remaining)`
        );
      }
    }
  }

  // Active codes warning
  if (ctx.active_codes?.length) {
    const critical = ctx.active_codes.filter((c) => c.severity === 'critical' || c.severity === 'high');
    if (critical.length) {
      suggestions.push(`⚠️ ${critical.length} active code${critical.length > 1 ? 's' : ''} need attention (${critical[0].code})`);
    }
  }

  // Pending high-priority services
  if (ctx.pending_services?.length) {
    const overdue = ctx.pending_services.filter((s) => s.priority === 'high');
    if (overdue.length) {
      suggestions.push(`📋 ${overdue[0].title} is due soon`);
    }
  }

  // Seasonal suggestion
  const month = new Date().getMonth();
  if ((month === 9 || month === 10) && ctx.year && ctx.make) {
    suggestions.push(`❄️ Pre-winter checklist for your ${ctx.year} ${ctx.make} ${ctx.model}`);
  }

  return suggestions.slice(0, 3);
}

// ---------------------------------------------------------------------------
// F3: AI Repair Cost Estimator
// ---------------------------------------------------------------------------

/**
 * Estimate repair cost for a given service on the user's vehicle at their location.
 */
export async function estimateRepairCost(
  serviceDescription: string,
  vehicle: VehicleFullContext,
  location: string
): Promise<RepairCostEstimate> {
  const apiKey = Constants.expoConfig?.extra?.openaiApiKey || process.env.OPENAI_API_KEY;
  const vehicleStr = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`;

  const fallback: RepairCostEstimate = {
    service: serviceDescription,
    vehicle: vehicleStr,
    location,
    labor_cost_min: 0,
    labor_cost_max: 0,
    parts_cost_min: 0,
    parts_cost_max: 0,
    total_min: 0,
    total_max: 0,
    labor_hours_est: 'N/A',
    notes: 'Could not generate estimate. Please configure your OpenAI API key.',
    red_flags: [],
  };

  if (!apiKey) return fallback;

  const systemPrompt = `You are an expert automotive service advisor with knowledge of current labor rates and parts pricing across the US.
Always respond with valid JSON only — no markdown, no extra text.`;

  const userPrompt = `Estimate the cost for: "${serviceDescription}"
Vehicle: ${vehicleStr}
Location: ${location}

Return JSON with exactly these keys:
{
  "service": "${serviceDescription}",
  "vehicle": "${vehicleStr}",
  "location": "${location}",
  "labor_cost_min": 150,
  "labor_cost_max": 200,
  "parts_cost_min": 100,
  "parts_cost_max": 150,
  "total_min": 250,
  "total_max": 350,
  "labor_hours_est": "2–3 hours",
  "notes": "Notes about what affects price, OEM vs aftermarket options, etc.",
  "red_flags": ["Signs of overcharging to watch for"]
}`;

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 600,
      }),
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    return JSON.parse(json.choices?.[0]?.message?.content || '{}') as RepairCostEstimate;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// F4: AI Parts Lookup
// ---------------------------------------------------------------------------

/**
 * Look up compatible parts for the user's vehicle across OEM and aftermarket brands.
 */
export async function lookupCompatibleParts(
  partType: string,
  vehicle: VehicleFullContext
): Promise<CompatiblePart[]> {
  const apiKey = Constants.expoConfig?.extra?.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const vehicleStr = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`;
  const vinNote = vehicle.vin ? ` VIN: ${vehicle.vin}` : '';

  const systemPrompt = `You are an automotive parts expert with knowledge of OEM and aftermarket part numbers for all major makes and models.
Always respond with valid JSON only — no markdown, no extra text.`;

  const userPrompt = `What ${partType} parts are compatible with a ${vehicleStr}?${vinNote}
Return a JSON array of compatible parts. Each entry should have exactly these keys:
[
  {
    "brand": "Bosch",
    "part_number": "3323",
    "description": "Premium oil filter",
    "type": "OEM-equivalent",
    "price_range": "$8–$12",
    "purchase_links": [
      {"retailer": "Amazon", "url": "https://www.amazon.com/s?k=Bosch+3323+oil+filter"},
      {"retailer": "AutoZone", "url": "https://www.autozone.com/searchresult?searchText=Bosch+3323"},
      {"retailer": "RockAuto", "url": "https://www.rockauto.com"}
    ]
  }
]
Include 4–6 options covering OEM, OEM-equivalent, and quality aftermarket brands (Bosch, Wix, Fram, Denso, NGK, Motorcraft, ACDelco, etc.).`;

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1200,
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return JSON.parse(json.choices?.[0]?.message?.content || '[]') as CompatiblePart[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// F5: Conversational Maintenance Logging
// ---------------------------------------------------------------------------

/**
 * Parse natural language maintenance description into a structured log entry.
 * Returns null if no maintenance event is detected in the text.
 */
export async function parseMaintenanceFromText(
  text: string,
  vehicle?: VehicleFullContext
): Promise<ParsedMaintenanceLog | null> {
  const apiKey = Constants.expoConfig?.extra?.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const vehicleNote = vehicle
    ? `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}, Current mileage: ${vehicle.current_mileage || 'unknown'}`
    : '';

  const systemPrompt = `You are an automotive service log parser. Extract structured maintenance data from natural language descriptions.
${vehicleNote}
If the text does NOT describe a maintenance event, return null.
Always respond with valid JSON only — no markdown, no extra text.`;

  const userPrompt = `Parse this text for a maintenance log entry: "${text}"
If this describes a maintenance event, return a JSON object:
{
  "title": "Short service name (e.g. Oil Change)",
  "type": "routine|repair|modification|diagnostic|inspection",
  "date": "YYYY-MM-DD (today if not specified: ${new Date().toISOString().split('T')[0]})",
  "mileage": 131500,
  "cost": 45,
  "parts_cost": 45,
  "labor_cost": 0,
  "parts_replaced": ["Mobil 1 5W-30 oil", "Bosch filter"],
  "shop_name": null,
  "description": "Full details from the text",
  "confidence": "high|medium|low"
}
If no maintenance event is described, return: null`;

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 400,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content?.trim() || 'null';
    if (raw === 'null') return null;
    return JSON.parse(raw) as ParsedMaintenanceLog;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// F6: Pre-Purchase Inspection Assistant
// ---------------------------------------------------------------------------

/**
 * Analyze a VIN for pre-purchase inspection: recalls, common issues,
 * inspection checklist, and estimated remaining component life.
 */
export async function analyzePrepurchaseVIN(
  vin: string,
  location?: string
): Promise<PrepurchaseReport> {
  const apiKey = Constants.expoConfig?.extra?.openaiApiKey || process.env.OPENAI_API_KEY;

  // Always decode the VIN to get vehicle info
  const { decodeVIN } = await import('./vin-decoder');
  const { getRecalls } = await import('./manual-retrieval');

  let vehicleStr = vin;
  let recalls: Array<{ component: string; summary: string; remedy: string }> = [];

  try {
    const decoded = await decodeVIN(vin);
    if (decoded && !decoded.error_code) {
      vehicleStr = `${decoded.year} ${decoded.make} ${decoded.model}${decoded.trim ? ' ' + decoded.trim : ''}`;
      const recallResult = await getRecalls({ year: decoded.year, make: decoded.make, model: decoded.model });
      recalls = recallResult.recalls.map((r: any) => ({
        component: r.Component || r.component,
        summary: r.Summary || r.summary,
        remedy: r.Remedy || r.remedy,
      }));
    }
  } catch {
    // continue with VIN-only analysis
  }

  const fallback: PrepurchaseReport = {
    vin,
    vehicle: vehicleStr,
    overall_risk: 'medium',
    recalls,
    common_issues: [],
    inspection_checklist: [],
    estimated_remaining_life: {},
    negotiation_tips: [],
    summary: 'Could not generate full report. Please configure your OpenAI API key.',
  };

  if (!apiKey) return { ...fallback, recalls };

  const systemPrompt = `You are an expert pre-purchase vehicle inspector with deep knowledge of common issues, reliability data, and inspection procedures for all makes and models.
Always respond with valid JSON only — no markdown, no extra text.`;

  const recallSummary = recalls.length
    ? `Known recalls (${recalls.length}): ${recalls.map((r) => r.component).join(', ')}`
    : 'No known recalls found.';

  const userPrompt = `Pre-purchase analysis for VIN: ${vin} (${vehicleStr})${location ? ` — buyer located in ${location}` : ''}
${recallSummary}

Return a JSON object with exactly these keys:
{
  "vin": "${vin}",
  "vehicle": "${vehicleStr}",
  "overall_risk": "low|medium|high",
  "recalls": ${JSON.stringify(recalls)},
  "common_issues": [
    {"issue": "known problem name", "severity": "minor|major|critical", "description": "what to look for"}
  ],
  "inspection_checklist": [
    {"area": "Engine", "what_to_check": "Look for...", "red_flags": "Be concerned if..."}
  ],
  "estimated_remaining_life": {
    "engine": "likely 100,000+ miles if maintained",
    "transmission": "...",
    "brakes": "...",
    "tires": "..."
  },
  "negotiation_tips": ["tip1", "tip2"],
  "summary": "3-4 sentence overall assessment and recommendation"
}`;

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });
    if (!res.ok) return { ...fallback, recalls };
    const json = await res.json();
    return JSON.parse(json.choices?.[0]?.message?.content || '{}') as PrepurchaseReport;
  } catch {
    return { ...fallback, recalls };
  }
}

// ---------------------------------------------------------------------------
// Manual search (public wrapper for existing code)
// ---------------------------------------------------------------------------

export async function searchManualChunks(
  query: SearchQuery
): Promise<SearchResult[]> {
  try {
    const response = await searchManual({
      query: query.query,
      manual_id: query.manual_id,
      limit: query.limit || 5,
      similarity_threshold: query.threshold || 0.7,
    });

    return response.results.map((r) => ({
      embedding_id: r.chunk_id,
      chunk_text: r.chunk_text,
      page_number: r.page_number,
      section_title: r.section_title,
      similarity: r.score,
      manual: {
        manual_id: r.manual_id,
        make: r.vehicle.make,
        model: r.vehicle.model,
        year: r.vehicle.year,
      },
    }));
  } catch (err) {
    console.warn('[AI Service] searchManualChunks failed:', err);
    return [];
  }
}

/**
 * Generate embedding for text (public API).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { generateQueryEmbedding } = await import('./rag-pipeline');
  return generateQueryEmbedding(text);
}

/**
 * Process a manual PDF (public API).
 */
export async function processManualPDF(
  manualId: string,
  fileUrl: string
): Promise<void> {
  const { processManual } = await import('./rag-pipeline');
  // We need vehicle info to process - retrieve from the manuals table
  const { data } = await (await import('../lib/supabase')).default
    .from('manuals')
    .select('make, model, year, trim')
    .eq('manual_id', manualId)
    .single();

  if (!data) {
    throw new Error(`Manual ${manualId} not found`);
  }

  await processManual(manualId, fileUrl, {
    year: data.year,
    make: data.make,
    model: data.model,
    trim: data.trim,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractVehicleFromRequest(request: AIRequest): VehicleLookup | null {
  // Prefer full vehicle_context (F1)
  if (request.vehicle_context) {
    return {
      year: request.vehicle_context.year,
      make: request.vehicle_context.make,
      model: request.vehicle_context.model,
      trim: request.vehicle_context.trim,
      vin: request.vehicle_context.vin,
    };
  }
  // Check metadata for vehicle info (legacy)
  const meta = request as any;
  if (meta.vehicle_year && meta.vehicle_make && meta.vehicle_model) {
    return {
      year: meta.vehicle_year,
      make: meta.vehicle_make,
      model: meta.vehicle_model,
      trim: meta.vehicle_trim,
      vin: meta.vehicle_vin,
    };
  }
  return null;
}

function isSafetyRelated(message: string): boolean {
  const safetyKeywords = [
    'recall', 'safety', 'airbag', 'brake', 'braking', 'accident',
    'crash', 'fire', 'smoke', 'warning', 'defect', 'hazard',
    'steer', 'steering', 'rollover',
  ];
  const lower = message.toLowerCase();
  return safetyKeywords.some((kw) => lower.includes(kw));
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
