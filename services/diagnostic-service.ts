/**
 * Gear AI CoPilot - Diagnostic Service
 *
 * OBD-II simulation, AI-powered DTC analysis, symptom checker,
 * vehicle health scoring, and persistent code history via Supabase.
 */

import { supabase } from '../lib/supabase';
import Constants from 'expo-constants';
import {
  DTCAnalysis,
  DiagnosticCode,
  FreezeFrameData,
  LiveOBDData,
  OBDSessionState,
  SymptomCheck,
  VehicleHealthScore,
  HealthSystemScore,
  HealthSystem,
} from '../types';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const DIAG_MODEL = 'gpt-4.1-mini';

function getApiKey(): string | undefined {
  return Constants.expoConfig?.extra?.openaiApiKey || process.env.OPENAI_API_KEY;
}

async function callOpenAI(systemPrompt: string, userMessage: string, maxTokens = 800): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DIAG_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.4,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

// ============================================================================
// DTC ANALYSIS
// ============================================================================

/**
 * Analyze a DTC using AI for plain-English explanation, ranked causes, and
 * DIY vs. shop recommendation. Falls back to local database if no API key.
 */
export async function analyzeDTC(
  vin: string,
  code: string,
  mileage: number,
  vehicleContext?: string
): Promise<DTCAnalysis> {
  const localInfo = getCommonDTCInfo(code);
  const base = getMockDTCAnalysis(code);

  const apiKey = getApiKey();
  if (!apiKey) return base;

  const vehicleDesc = vehicleContext || (vin ? `Vehicle VIN: ${vin}` : 'Unknown vehicle');
  const systemPrompt = `You are an expert automotive diagnostic technician. Analyze OBD-II trouble codes with precise, vehicle-specific knowledge. Always respond with valid JSON only — no markdown, no extra text.`;

  const userMessage = `Analyze DTC code ${code} for: ${vehicleDesc}, mileage: ${mileage.toLocaleString()} miles.
Return a JSON object with these exact keys:
{
  "plain_english": "1-2 sentence plain English explanation of what this code means",
  "probable_causes": [
    { "cause": "Most likely cause", "likelihood": "high", "explanation": "Why this is most likely" },
    { "cause": "Second cause", "likelihood": "medium", "explanation": "..." },
    { "cause": "Third cause", "likelihood": "low", "explanation": "..." }
  ],
  "diy_vs_shop": "diy" | "shop" | "either",
  "diy_reasoning": "One sentence explaining the recommendation",
  "cost_min": 150,
  "cost_max": 800,
  "difficulty": "easy" | "moderate" | "difficult" | "professional"
}`;

  try {
    const raw = await callOpenAI(systemPrompt, userMessage, 600);
    if (raw) {
      const parsed = JSON.parse(raw.trim());
      return {
        ...base,
        description: localInfo?.description || base.description,
        ai_plain_english: parsed.plain_english,
        probable_causes_ranked: parsed.probable_causes || [],
        diy_vs_shop: parsed.diy_vs_shop || 'shop',
        diy_vs_shop_reasoning: parsed.diy_reasoning,
        estimated_cost_min: parsed.cost_min ?? base.estimated_cost_min,
        estimated_cost_max: parsed.cost_max ?? base.estimated_cost_max,
        repair_difficulty: parsed.difficulty || base.repair_difficulty,
      };
    }
  } catch (err) {
    console.warn('[DiagnosticService] AI DTC analysis parse failed:', err);
  }

  return base;
}

/**
 * Get common DTC code information from local database.
 */
export function getCommonDTCInfo(code: string): Partial<DTCAnalysis> | null {
  const commonCodes: Record<string, Partial<DTCAnalysis>> = {
    P0420: {
      description: 'Catalyst System Efficiency Below Threshold (Bank 1)',
      common_causes: ['Faulty catalytic converter', 'Exhaust leak before O2 sensor', 'Faulty downstream O2 sensor', 'Engine misfire causing catalyst damage'],
      symptoms: ['Check engine light', 'Reduced fuel efficiency', 'Sulfur smell from exhaust'],
    },
    P0171: {
      description: 'System Too Lean (Bank 1)',
      common_causes: ['Vacuum leak', 'Dirty or faulty MAF sensor', 'Weak fuel pump', 'Clogged fuel filter or injectors'],
      symptoms: ['Check engine light', 'Rough idle', 'Lack of power', 'Hesitation on acceleration'],
    },
    P0300: {
      description: 'Random/Multiple Cylinder Misfire Detected',
      common_causes: ['Worn spark plugs', 'Faulty ignition coil', 'Vacuum leak', 'Low compression', 'Bad fuel injector'],
      symptoms: ['Engine shaking/vibration', 'Poor acceleration', 'Flashing check engine light', 'Rough idle'],
    },
    P0128: {
      description: 'Coolant Temperature Below Thermostat Regulating Temperature',
      common_causes: ['Stuck-open thermostat', 'Faulty coolant temp sensor', 'Low coolant level'],
      symptoms: ['Check engine light', 'Heater not working well', 'Poor fuel economy'],
    },
    P0442: {
      description: 'Evaporative Emission Control System Leak Detected (Small Leak)',
      common_causes: ['Loose or faulty gas cap', 'Cracked EVAP hose', 'Faulty purge valve', 'Faulty vent valve'],
      symptoms: ['Check engine light', 'Fuel smell from engine bay'],
    },
    P0507: {
      description: 'Idle Control System RPM High',
      common_causes: ['Vacuum leak', 'Dirty throttle body', 'Faulty IAC valve', 'Faulty MAF sensor'],
      symptoms: ['High idle RPM (above 1000)', 'Rough idle', 'Check engine light'],
    },
    P0401: {
      description: 'Exhaust Gas Recirculation Flow Insufficient Detected',
      common_causes: ['Clogged EGR valve or passages', 'Faulty EGR position sensor', 'Vacuum leak in EGR system'],
      symptoms: ['Check engine light', 'Engine ping/knock under load', 'Rough idle'],
    },
  };
  return commonCodes[code] || null;
}

function getMockDTCAnalysis(code: string): DTCAnalysis {
  const baseInfo = getCommonDTCInfo(code);
  const prefix = code[0]?.toUpperCase();
  const isSerious = ['P0300', 'P0301', 'P0302', 'P0303', 'P0304'].includes(code);
  return {
    code,
    description: baseInfo?.description || `Diagnostic Trouble Code: ${code}`,
    urgency: isSerious ? 'high' : 'medium',
    estimated_cost_min: 150,
    estimated_cost_max: 1200,
    labor_cost: 150,
    parts_cost: 300,
    tech_service_bulletins: [],
    common_causes: baseInfo?.common_causes || ['Professional diagnosis recommended'],
    symptoms: baseInfo?.symptoms || ['Check engine light illuminated'],
    repair_difficulty: prefix === 'P' ? 'moderate' : 'professional',
  };
}

// ============================================================================
// SYMPTOM CHECKER
// ============================================================================

/**
 * Analyze a natural-language symptom description using AI.
 * Returns probable causes, suggested codes, urgency, and a diagnostic flowchart.
 */
export async function checkSymptoms(
  symptomText: string,
  vehicleContext: { year: number; make: string; model: string; trim?: string; mileage?: number },
  vehicleId: string,
  userId: string
): Promise<SymptomCheck> {
  const checkId = `chk-${Date.now()}`;
  const vehicleDesc = `${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}${vehicleContext.trim ? ` ${vehicleContext.trim}` : ''}${vehicleContext.mileage ? ` at ${vehicleContext.mileage.toLocaleString()} miles` : ''}`;

  const fallback: SymptomCheck = {
    check_id: checkId,
    vehicle_id: vehicleId,
    symptom_text: symptomText,
    ai_analysis: 'Unable to analyze symptoms at this time. Please consult a qualified mechanic.',
    suggested_codes: [],
    probable_causes: ['Unknown — professional inspection recommended'],
    urgency: 'medium',
    related_recalls: [],
    related_tsbs: [],
    flowchart_steps: [
      { step: 1, instruction: 'Note when the symptom occurs (e.g., cold start, highway, braking).' },
      { step: 2, instruction: 'Check for any warning lights on the dashboard.' },
      { step: 3, instruction: 'Scan for OBD-II trouble codes with a scanner.' },
      { step: 4, instruction: 'Consult a qualified technician with your findings.' },
    ],
    checked_at: new Date().toISOString(),
  };

  const apiKey = getApiKey();
  if (!apiKey) {
    await saveSymptomCheck(fallback, userId);
    return fallback;
  }

  const systemPrompt = `You are an expert automotive diagnostic technician with encyclopedic knowledge of common vehicle issues, TSBs, and OBD-II codes. Respond only with valid JSON — no markdown, no extra text.`;

  const userMessage = `Vehicle: ${vehicleDesc}
Symptom reported by owner: "${symptomText}"

Provide a comprehensive diagnostic analysis. Return JSON with these exact keys:
{
  "analysis": "2-3 sentence plain English analysis of the likely issue",
  "urgency": "low" | "medium" | "high" | "critical",
  "probable_causes": ["Most likely cause", "Second cause", "Third cause"],
  "suggested_codes": ["P0XXX", "C0XXX"],
  "flowchart_steps": [
    { "step": 1, "instruction": "First thing to check", "check": "What to look for", "if_yes": "Action if found", "if_no": "Action if not found" },
    { "step": 2, "instruction": "...", "check": "...", "if_yes": "...", "if_no": "..." },
    { "step": 3, "instruction": "...", "check": "...", "if_yes": "...", "if_no": "..." }
  ],
  "related_tsb_topics": ["TSB subject area if applicable"],
  "diy_feasibility": "Brief assessment of whether owner can diagnose/fix this"
}`;

  try {
    const raw = await callOpenAI(systemPrompt, userMessage, 900);
    if (raw) {
      const parsed = JSON.parse(raw.trim());
      const result: SymptomCheck = {
        check_id: checkId,
        vehicle_id: vehicleId,
        symptom_text: symptomText,
        ai_analysis: parsed.analysis || fallback.ai_analysis,
        suggested_codes: parsed.suggested_codes || [],
        probable_causes: parsed.probable_causes || [],
        urgency: parsed.urgency || 'medium',
        related_recalls: [],
        related_tsbs: parsed.related_tsb_topics || [],
        flowchart_steps: (parsed.flowchart_steps || []).map((s: any, i: number) => ({
          step: s.step || i + 1,
          instruction: s.instruction || '',
          check: s.check,
          if_yes: s.if_yes,
          if_no: s.if_no,
        })),
        checked_at: new Date().toISOString(),
      };
      await saveSymptomCheck(result, userId);
      return result;
    }
  } catch (err) {
    console.warn('[DiagnosticService] Symptom check parse failed:', err);
  }

  await saveSymptomCheck(fallback, userId);
  return fallback;
}

async function saveSymptomCheck(check: SymptomCheck, userId: string): Promise<void> {
  try {
    await supabase.from('symptom_checks').insert({
      check_id: check.check_id,
      vehicle_id: check.vehicle_id,
      user_id: userId,
      symptom_text: check.symptom_text,
      ai_analysis: check.ai_analysis,
      suggested_codes: check.suggested_codes,
      probable_causes: check.probable_causes,
      urgency: check.urgency,
      related_recalls: check.related_recalls,
      related_tsbs: check.related_tsbs,
      flowchart_steps: check.flowchart_steps,
      checked_at: check.checked_at,
    });
  } catch (err) {
    console.warn('[DiagnosticService] saveSymptomCheck failed:', err);
  }
}

// ============================================================================
// CODE HISTORY (Supabase persistence)
// ============================================================================

/** Save a diagnostic code to history. */
export async function saveDiagnosticCode(
  vehicleId: string,
  userId: string,
  code: string,
  description: string,
  severity: DiagnosticCode['severity'] = 'medium',
  mileage?: number,
  freezeFrame?: FreezeFrameData
): Promise<DiagnosticCode | null> {
  try {
    const { data, error } = await supabase
      .from('diagnostic_codes')
      .insert({
        vehicle_id: vehicleId,
        user_id: userId,
        code,
        code_type: code[0]?.toUpperCase() as DiagnosticCode['code_type'],
        description,
        severity,
        status: 'active',
        mileage_at_detection: mileage,
        freeze_frame_data: freezeFrame,
        detected_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('[DiagnosticService] saveDiagnosticCode failed:', err);
    return null;
  }
}

/** Load all diagnostic codes for a vehicle (history). */
export async function getDiagnosticHistory(vehicleId: string): Promise<DiagnosticCode[]> {
  try {
    const { data, error } = await supabase
      .from('diagnostic_codes')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('detected_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[DiagnosticService] getDiagnosticHistory failed:', err);
    return [];
  }
}

/** Mark a diagnostic code as resolved. */
export async function resolveDiagnosticCode(diagnosticId: string): Promise<void> {
  await supabase
    .from('diagnostic_codes')
    .update({ status: 'resolved', cleared_at: new Date().toISOString() })
    .eq('diagnostic_id', diagnosticId);
}

/** Update a code record with AI analysis results. */
export async function updateCodeWithAIAnalysis(
  diagnosticId: string,
  analysis: DTCAnalysis
): Promise<void> {
  await supabase
    .from('diagnostic_codes')
    .update({
      ai_analysis: analysis.ai_plain_english,
      ai_causes: analysis.probable_causes_ranked,
      diy_vs_shop: analysis.diy_vs_shop,
      estimated_cost_min: analysis.estimated_cost_min,
      estimated_cost_max: analysis.estimated_cost_max,
      repair_difficulty: analysis.repair_difficulty,
    })
    .eq('diagnostic_id', diagnosticId);
}

// ============================================================================
// VEHICLE HEALTH SCORE
// ============================================================================

const SYSTEM_META: Record<HealthSystem, { label: string; weight: number }> = {
  engine: { label: 'Engine', weight: 0.30 },
  transmission: { label: 'Transmission', weight: 0.15 },
  brakes: { label: 'Brakes', weight: 0.15 },
  suspension: { label: 'Suspension', weight: 0.10 },
  electrical: { label: 'Electrical', weight: 0.10 },
  fuel: { label: 'Fuel System', weight: 0.08 },
  cooling: { label: 'Cooling', weight: 0.07 },
  exhaust: { label: 'Exhaust', weight: 0.05 },
};

const CODE_SYSTEM_MAP: Record<string, HealthSystem> = {
  P: 'engine', C: 'suspension', B: 'electrical', U: 'electrical',
};
const CODE_OVERRIDE: Record<string, HealthSystem> = {
  P04: 'exhaust', P01: 'fuel', P02: 'fuel', P03: 'engine',
  P07: 'transmission', P08: 'transmission', C0: 'brakes', P05: 'engine',
};

function codeToSystem(code: string): HealthSystem {
  const prefix3 = code.slice(0, 3);
  if (CODE_OVERRIDE[prefix3]) return CODE_OVERRIDE[prefix3];
  const prefix1 = code[0]?.toUpperCase();
  return CODE_SYSTEM_MAP[prefix1] || 'engine';
}

function scoreStatus(score: number): HealthSystemScore['status'] {
  if (score >= 80) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'poor';
  return 'critical';
}

/**
 * Calculate the vehicle health score by aggregating:
 *  - Active DTC codes
 *  - Maintenance record compliance
 *  - Vehicle age + mileage factor
 */
export async function calculateHealthScore(
  vehicleId: string,
  userId: string,
  currentMileage: number,
  vehicleYear: number
): Promise<VehicleHealthScore> {
  const now = new Date();
  const healthId = `hlth-${vehicleId}-${Date.now()}`;

  // Fetch active codes
  const { data: codes } = await supabase
    .from('diagnostic_codes')
    .select('code, severity, status')
    .eq('vehicle_id', vehicleId)
    .eq('status', 'active');

  // Fetch maintenance records
  const { data: maintRecords } = await supabase
    .from('maintenance_records')
    .select('service_type, service_date, mileage, next_service_mileage')
    .eq('vehicle_id', vehicleId)
    .order('service_date', { ascending: false });

  const activeCodes = codes || [];

  // Per-system score degradations
  const systemDegradation: Record<HealthSystem, number> = {
    engine: 0, transmission: 0, brakes: 0, suspension: 0,
    electrical: 0, fuel: 0, cooling: 0, exhaust: 0,
  };

  for (const c of activeCodes) {
    const sys = codeToSystem(c.code);
    const penalty = c.severity === 'critical' ? 25 : c.severity === 'high' ? 15 : c.severity === 'medium' ? 8 : 3;
    systemDegradation[sys] = Math.min(systemDegradation[sys] + penalty, 60);
  }

  // Maintenance compliance factor (0–20 point bonus/penalty)
  const records = maintRecords || [];
  let maintenanceScore = 85; // base
  if (records.length === 0) {
    maintenanceScore = 60;
  } else {
    const overdueCount = records.filter((r) => {
      if (!r.next_service_mileage) return false;
      return currentMileage > r.next_service_mileage + 500;
    }).length;
    maintenanceScore = Math.max(50, 90 - overdueCount * 10);
  }

  // Vehicle age factor
  const age = now.getFullYear() - vehicleYear;
  const ageFactor = Math.max(0, Math.min(15, age * 0.7));

  // Build per-system scores
  const systems: HealthSystemScore[] = (Object.keys(SYSTEM_META) as HealthSystem[]).map((sys) => {
    const raw = 100 - systemDegradation[sys] - ageFactor * SYSTEM_META[sys].weight * 5;
    const score = Math.round(Math.max(0, Math.min(100, raw)));
    const codesForSystem = activeCodes.filter((c) => codeToSystem(c.code) === sys);
    const factors: string[] = [];
    if (codesForSystem.length > 0) {
      factors.push(`${codesForSystem.length} active code${codesForSystem.length > 1 ? 's' : ''}: ${codesForSystem.map((c) => c.code).join(', ')}`);
    }
    if (age > 8 && sys === 'electrical') factors.push('Normal aging for vehicle age');
    return { system: sys, label: SYSTEM_META[sys].label, score, status: scoreStatus(score), contributing_factors: factors };
  });

  // Weighted overall score
  const overall = Math.round(
    systems.reduce((sum, s) => sum + s.score * SYSTEM_META[s.system].weight, 0) *
    (maintenanceScore / 100)
  );

  // Fetch previous score for trend
  const { data: prevData } = await supabase
    .from('vehicle_health_scores')
    .select('overall_score')
    .eq('vehicle_id', vehicleId)
    .order('calculated_at', { ascending: false })
    .limit(1);
  const prevScore = prevData?.[0]?.overall_score;
  const trend: VehicleHealthScore['trend'] =
    prevScore == null ? 'stable' : overall > prevScore + 2 ? 'improving' : overall < prevScore - 2 ? 'declining' : 'stable';

  const healthScore: VehicleHealthScore = {
    health_id: healthId,
    vehicle_id: vehicleId,
    overall_score: Math.max(0, Math.min(100, overall)),
    systems,
    active_code_count: activeCodes.length,
    maintenance_compliance_pct: maintenanceScore,
    calculated_at: now.toISOString(),
    trend,
    previous_score: prevScore,
  };

  // Persist
  try {
    await supabase.from('vehicle_health_scores').insert({
      health_id: healthId,
      vehicle_id: vehicleId,
      user_id: userId,
      overall_score: healthScore.overall_score,
      systems: healthScore.systems,
      active_code_count: healthScore.active_code_count,
      maintenance_compliance_pct: healthScore.maintenance_compliance_pct,
      trend: healthScore.trend,
      previous_score: healthScore.previous_score,
      calculated_at: healthScore.calculated_at,
    });
  } catch (err) {
    console.warn('[DiagnosticService] persist health score failed:', err);
  }

  return healthScore;
}

/** Fetch the most recent health score for a vehicle. */
export async function getLatestHealthScore(vehicleId: string): Promise<VehicleHealthScore | null> {
  try {
    const { data, error } = await supabase
      .from('vehicle_health_scores')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/** Fetch health score history (for trend chart). */
export async function getHealthScoreHistory(vehicleId: string, limit = 30): Promise<Array<Pick<VehicleHealthScore, 'health_id' | 'vehicle_id' | 'overall_score' | 'trend' | 'calculated_at'>>> {
  try {
    const { data, error } = await supabase
      .from('vehicle_health_scores')
      .select('health_id, vehicle_id, overall_score, trend, calculated_at')
      .eq('vehicle_id', vehicleId)
      .order('calculated_at', { ascending: true })
      .limit(limit);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

// ============================================================================
// OBD-II SIMULATION
// ============================================================================

let _obdInterval: ReturnType<typeof setInterval> | null = null;
let _obdCallbacks: Array<(data: LiveOBDData) => void> = [];

/** Simulated ELM327 OBD-II connection with realistic live data stream. */
export async function connectOBDAdapter(adapterId?: string): Promise<OBDSessionState> {
  // Simulate BLE scan + connect delay
  await new Promise((r) => setTimeout(r, 1800));
  return {
    status: 'connected',
    adapter_id: adapterId || 'ELM327-SIM',
    adapter_name: 'ELM327 Bluetooth OBD-II (Simulated)',
    protocol: 'ISO 15765-4 CAN (11-bit, 500 kbps)',
    connected_at: new Date().toISOString(),
  };
}

/** Start streaming simulated live OBD-II PID data. */
export function startLiveDataStream(callback: (data: LiveOBDData) => void): () => void {
  _obdCallbacks.push(callback);

  if (!_obdInterval) {
    let tick = 0;
    _obdInterval = setInterval(() => {
      tick++;
      const rpm = 800 + Math.sin(tick * 0.1) * 200 + Math.random() * 50;
      const data: LiveOBDData = {
        rpm: Math.round(rpm),
        vehicle_speed: Math.round(Math.max(0, 35 + Math.sin(tick * 0.05) * 35)),
        coolant_temp: Math.round(90 + Math.sin(tick * 0.02) * 5),
        intake_air_temp: Math.round(25 + Math.random() * 5),
        throttle_position: Math.round(15 + Math.sin(tick * 0.08) * 10 + Math.random() * 3),
        engine_load: Math.round(20 + Math.sin(tick * 0.08) * 15 + Math.random() * 5),
        fuel_trim_short: parseFloat((Math.random() * 4 - 2).toFixed(1)),
        fuel_trim_long: parseFloat((Math.random() * 3 - 1.5).toFixed(1)),
        o2_voltage_bank1: parseFloat((0.45 + Math.sin(tick * 0.2) * 0.4).toFixed(3)),
        maf_rate: parseFloat((4 + Math.sin(tick * 0.1) * 2).toFixed(2)),
        timing_advance: Math.round(12 + Math.sin(tick * 0.05) * 4),
        battery_voltage: parseFloat((13.8 + Math.random() * 0.4).toFixed(1)),
        timestamp: Date.now(),
      };
      _obdCallbacks.forEach((cb) => cb(data));
    }, 500);
  }

  return () => {
    _obdCallbacks = _obdCallbacks.filter((cb) => cb !== callback);
    if (_obdCallbacks.length === 0 && _obdInterval) {
      clearInterval(_obdInterval);
      _obdInterval = null;
    }
  };
}

/** Simulate reading DTCs from connected adapter (Mode 03). */
export async function readDTCCodes(_adapterId?: string): Promise<string[]> {
  await new Promise((r) => setTimeout(r, 1200));
  // Returns sample codes for simulation
  return ['P0420', 'P0171'];
}

/** Simulate reading freeze frame data for a specific code. */
export async function readFreezeFrame(code: string): Promise<FreezeFrameData> {
  await new Promise((r) => setTimeout(r, 800));
  return {
    rpm: 1450 + Math.round(Math.random() * 200),
    vehicle_speed: 45,
    engine_load: 38,
    coolant_temp: 87,
    fuel_trim_short: -2.3,
    fuel_trim_long: 1.6,
    intake_pressure: 98,
    timing_advance: 14,
    throttle_position: 22,
  };
}

/** Simulate clearing DTCs (Mode 04). */
export async function clearDTCCodes(_adapterId?: string): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 1000));
  return true;
}

