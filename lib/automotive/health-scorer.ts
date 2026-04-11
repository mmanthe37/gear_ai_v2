/**
 * Gear AI – Shared Automotive Domain Layer
 * Vehicle Health Scorer
 *
 * Pure computation of a 0–100 vehicle health score based on maintenance
 * records, active DTC codes, open recalls, mileage, and vehicle age.
 * No external API calls – everything is derived from the inputs.
 *
 * @module automotive/health-scorer
 */

import { parseDTCCode, isSafetyCritical } from './dtc-analyzer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Vehicle systems tracked by the health scorer. */
export type HealthSystem =
  | 'engine'
  | 'transmission'
  | 'brakes'
  | 'electrical'
  | 'suspension'
  | 'exhaust'
  | 'cooling'
  | 'fuel'
  | 'body'
  | 'tires';

/** Per-system breakdown of health score. */
export interface HealthSystemScore {
  system: HealthSystem;
  /** 0–100 score for this system. */
  score: number;
  /** Human-readable issues affecting this system. */
  issues: string[];
  /** ISO date string of last relevant service, if known. */
  lastService?: string;
}

/** Full health report returned by {@link computeHealthScore}. */
export interface VehicleHealthReport {
  /** Weighted overall score (0–100). */
  overallScore: number;
  /** Per-system breakdowns. */
  systems: HealthSystemScore[];
  /** Number of open (unacknowledged) NHTSA recalls. */
  openRecalls: number;
  /** Number of maintenance items past their recommended interval. */
  overdueServices: number;
  /** Which data sources contributed to this report. */
  dataSources: string[];
}

/** Input parameters for the health scoring algorithm. */
export interface HealthScoreParams {
  /**
   * Maintenance records – each should have at least:
   * `{ type: string; date: string; mileage?: number; system?: string }`.
   * Additional fields are ignored.
   */
  maintenanceRecords: any[];
  /** Currently active DTC codes (e.g. ["P0301", "C0110"]). */
  activeDTCs: string[];
  /** Number of unacknowledged open NHTSA recalls. */
  openRecalls: number;
  /** Current odometer reading in miles. */
  mileage: number;
  /** Vehicle model year. */
  year: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Mapping from DTC system prefix → HealthSystem. */
const DTC_SYSTEM_MAP: Record<string, HealthSystem> = {
  P: 'engine',      // powertrain: default to engine
  B: 'body',
  C: 'brakes',      // chassis: default to brakes
  U: 'electrical',  // network: closest to electrical
};

/** More specific DTC-digit → system overrides (prefix + third char). */
const DTC_SUBSYSTEM_OVERRIDES: Record<string, HealthSystem> = {
  P07: 'transmission',
  P17: 'transmission',
  P04: 'exhaust',
  P05: 'engine',
  C01: 'brakes',
  C02: 'suspension',
  C03: 'suspension',
  C04: 'brakes',
  C05: 'brakes',
  B06: 'body',
};

/** Typical maintenance interval in miles for common service items. */
const MAINTENANCE_INTERVALS: Record<string, number> = {
  'oil change': 5_000,
  'oil_change': 5_000,
  'tire rotation': 7_500,
  'tire_rotation': 7_500,
  'brake inspection': 15_000,
  'brake_inspection': 15_000,
  'brake pads': 30_000,
  'brake_pads': 30_000,
  'transmission fluid': 30_000,
  'transmission_fluid': 30_000,
  'coolant flush': 30_000,
  'coolant_flush': 30_000,
  'air filter': 15_000,
  'air_filter': 15_000,
  'spark plugs': 30_000,
  'spark_plugs': 30_000,
  'timing belt': 60_000,
  'timing_belt': 60_000,
  'battery': 50_000,
};

/** All systems to include in the report. */
const ALL_SYSTEMS: HealthSystem[] = [
  'engine',
  'transmission',
  'brakes',
  'electrical',
  'suspension',
  'exhaust',
  'cooling',
  'fuel',
  'body',
  'tires',
];

/** Points deducted per active DTC by severity tier. */
const DTC_PENALTY: Record<string, number> = {
  critical: 15,
  warning: 8,
  caution: 4,
  info: 2,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function classifyDTCSystem(code: string): HealthSystem {
  const upper = code.toUpperCase();
  const threeChar = upper.slice(0, 3);
  if (DTC_SUBSYSTEM_OVERRIDES[threeChar]) {
    return DTC_SUBSYSTEM_OVERRIDES[threeChar];
  }
  return DTC_SYSTEM_MAP[upper[0]] || 'engine';
}

function normalizeServiceType(type: string): string {
  return type.toLowerCase().replace(/[-_]/g, ' ').trim();
}

function getVehicleAgeMiles(mileage: number, year: number): number {
  const age = Math.max(1, new Date().getFullYear() - year);
  return mileage / age;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a comprehensive vehicle health report.
 *
 * Starts every system at 100 and deducts points for:
 * - Active DTCs (weighted by severity – critical codes penalise more)
 * - Open / unacknowledged NHTSA recalls
 * - Overdue maintenance intervals
 * - High mileage relative to vehicle age
 *
 * @param params - Input data (maintenance records, DTCs, recalls, mileage, year)
 * @returns A {@link VehicleHealthReport} with per-system breakdowns
 */
export function computeHealthScore(params: HealthScoreParams): VehicleHealthReport {
  const { maintenanceRecords, activeDTCs, openRecalls, mileage, year } = params;
  const dataSources: string[] = [];

  // Initialise per-system scores
  const systemScores = new Map<HealthSystem, { score: number; issues: string[]; lastService?: string }>();
  for (const sys of ALL_SYSTEMS) {
    systemScores.set(sys, { score: 100, issues: [] });
  }

  // ------------------------------------------------------------------
  // 1. Active DTC penalties
  // ------------------------------------------------------------------
  if (activeDTCs.length > 0) {
    dataSources.push('active_dtcs');
    for (const code of activeDTCs) {
      const dtcInfo = parseDTCCode(code);
      const targetSystem = classifyDTCSystem(code);
      const entry = systemScores.get(targetSystem)!;
      const penalty = DTC_PENALTY[dtcInfo.severity] ?? 4;
      entry.score -= penalty;

      let issueMsg = `Active DTC ${code}: ${dtcInfo.subsystem}`;
      if (isSafetyCritical(code)) {
        issueMsg += ' ⚠️ SAFETY-CRITICAL';
      }
      entry.issues.push(issueMsg);
    }
  }

  // ------------------------------------------------------------------
  // 2. Open recall penalties (spread across relevant systems, or global)
  // ------------------------------------------------------------------
  if (openRecalls > 0) {
    dataSources.push('nhtsa_recalls');
    // Apply a flat per-recall penalty to overall (deducted later)
    // and note it on the body system as a proxy
    const bodyEntry = systemScores.get('body')!;
    const recallPenalty = Math.min(openRecalls * 5, 25);
    bodyEntry.score -= recallPenalty;
    bodyEntry.issues.push(
      `${openRecalls} open NHTSA recall(s) not yet acknowledged or remedied`,
    );
  }

  // ------------------------------------------------------------------
  // 3. Maintenance interval analysis
  // ------------------------------------------------------------------
  let overdueCount = 0;
  if (maintenanceRecords.length > 0) {
    dataSources.push('maintenance_records');

    // Build latest-service map: type → { date, mileage }
    const latestByType = new Map<string, { date: string; mileage: number }>();
    for (const rec of maintenanceRecords) {
      const type = normalizeServiceType(rec.type || rec.service_type || '');
      const recMileage = rec.mileage || rec.mileage_at_service || 0;
      const recDate = rec.date || rec.service_date || rec.completed_date || '';
      const existing = latestByType.get(type);
      if (!existing || recMileage > existing.mileage) {
        latestByType.set(type, { date: recDate, mileage: recMileage });
      }
    }

    // Check each known interval
    for (const [serviceType, interval] of Object.entries(MAINTENANCE_INTERVALS)) {
      const normalized = normalizeServiceType(serviceType);
      const latest = latestByType.get(normalized);
      if (latest) {
        const milesSince = mileage - latest.mileage;
        if (milesSince > interval) {
          overdueCount++;
          const overdueMiles = milesSince - interval;
          const targetSystem = guessMaintenanceSystem(normalized);
          const entry = systemScores.get(targetSystem)!;
          entry.issues.push(
            `${serviceType} overdue by ~${overdueMiles.toLocaleString()} miles`,
          );
          entry.score -= Math.min(Math.floor(overdueMiles / interval * 10), 15);
          if (!entry.lastService || entry.lastService < latest.date) {
            entry.lastService = latest.date;
          }
        } else {
          const targetSystem = guessMaintenanceSystem(normalized);
          const entry = systemScores.get(targetSystem)!;
          if (!entry.lastService || entry.lastService < latest.date) {
            entry.lastService = latest.date;
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // 4. High-mileage-for-age penalty
  // ------------------------------------------------------------------
  if (mileage > 0 && year > 0) {
    dataSources.push('mileage_analysis');
    const avgPerYear = getVehicleAgeMiles(mileage, year);
    if (avgPerYear > 20_000) {
      const engineEntry = systemScores.get('engine')!;
      engineEntry.score -= 5;
      engineEntry.issues.push(
        `High annual mileage (~${Math.round(avgPerYear).toLocaleString()} mi/yr)`,
      );
    }
    if (mileage > 150_000) {
      const transEntry = systemScores.get('transmission')!;
      transEntry.score -= 5;
      transEntry.issues.push('Vehicle exceeds 150,000 miles – increased wear expected');
    }
  }

  // ------------------------------------------------------------------
  // 5. Clamp scores and build output
  // ------------------------------------------------------------------
  const systems: HealthSystemScore[] = ALL_SYSTEMS.map((sys) => {
    const entry = systemScores.get(sys)!;
    return {
      system: sys,
      score: Math.max(0, Math.min(100, entry.score)),
      issues: entry.issues,
      lastService: entry.lastService,
    };
  });

  // Overall = weighted average (all equal weight for now), then apply recall drag
  const totalScore = systems.reduce((sum, s) => sum + s.score, 0);
  let overallScore = Math.round(totalScore / systems.length);
  overallScore = Math.max(0, Math.min(100, overallScore));

  return {
    overallScore,
    systems,
    openRecalls,
    overdueServices: overdueCount,
    dataSources,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Best-effort mapping of maintenance type keywords → HealthSystem. */
function guessMaintenanceSystem(type: string): HealthSystem {
  if (/oil|spark|timing|engine/.test(type)) return 'engine';
  if (/transmission|trans fluid/.test(type)) return 'transmission';
  if (/brake/.test(type)) return 'brakes';
  if (/coolant|thermostat|radiator/.test(type)) return 'cooling';
  if (/battery|alternator|electrical/.test(type)) return 'electrical';
  if (/exhaust|catalytic|muffler|o2 sensor/.test(type)) return 'exhaust';
  if (/tire|alignment/.test(type)) return 'tires';
  if (/fuel|injector/.test(type)) return 'fuel';
  if (/suspension|strut|shock|spring/.test(type)) return 'suspension';
  if (/air filter|cabin/.test(type)) return 'engine';
  return 'engine';
}
