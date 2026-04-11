/**
 * Gear AI – Shared Automotive Domain Layer
 * DTC (Diagnostic Trouble Code) Analyzer
 *
 * Pure business logic for parsing OBD-II / SAE J2012 diagnostic trouble
 * codes, determining severity, and escalating safety-critical faults.
 *
 * @module automotive/dtc-analyzer
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Structured information about a parsed DTC code. */
export interface DTCInfo {
  /** The original DTC code string (e.g. "P0301"). */
  code: string;
  /** Top-level system: Powertrain, Body, Chassis, or Network. */
  system: string;
  /** Subsystem description derived from the code digits. */
  subsystem: string;
  /** Human-readable description of the code. */
  description: string;
  /** Severity classification. */
  severity: 'info' | 'caution' | 'warning' | 'critical';
  /** Safety escalation message, if applicable. */
  safetyEscalation?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Map of first-character prefix → system name. */
const SYSTEM_MAP: Record<string, string> = {
  P: 'Powertrain',
  B: 'Body',
  C: 'Chassis',
  U: 'Network',
};

/** Map of second-character → standard vs manufacturer. */
const ORIGIN_MAP: Record<string, string> = {
  '0': 'SAE standard',
  '1': 'Manufacturer specific',
  '2': 'SAE standard (extended)',
  '3': 'SAE/Manufacturer joint',
};

/**
 * Subsystem lookup keyed by system prefix + third digit.
 * The third digit (first of the three trailing digits) identifies the subsystem.
 */
const POWERTRAIN_SUBSYSTEMS: Record<string, string> = {
  '0': 'Fuel and air metering (auxiliary controls)',
  '1': 'Fuel and air metering',
  '2': 'Fuel and air metering (injector circuit)',
  '3': 'Ignition system or misfire',
  '4': 'Auxiliary emission controls',
  '5': 'Vehicle speed, idle control, and auxiliary inputs',
  '6': 'Computer and output circuit',
  '7': 'Transmission',
  '8': 'Transmission',
  '9': 'SAE reserved',
  A: 'Hybrid propulsion',
  B: 'SAE reserved',
  C: 'SAE reserved',
};

const BODY_SUBSYSTEMS: Record<string, string> = {
  '0': 'SAE reserved',
  '1': 'Driver circuit',
  '2': 'Passenger circuit',
  '3': 'Wiper/washer',
  '4': 'Display/lighting',
  '5': 'Climate control',
  '6': 'Airbag / restraint system',
  '7': 'Power convertible top',
  '8': 'Audio/entertainment',
  '9': 'SAE reserved',
};

const CHASSIS_SUBSYSTEMS: Record<string, string> = {
  '0': 'SAE reserved',
  '1': 'Brake system',
  '2': 'Steering system',
  '3': 'Suspension',
  '4': 'Traction control',
  '5': 'Stability control',
  '6': 'SAE reserved',
  '7': 'SAE reserved',
  '8': 'SAE reserved',
  '9': 'SAE reserved',
};

const NETWORK_SUBSYSTEMS: Record<string, string> = {
  '0': 'CAN bus / general network',
  '1': 'High-speed CAN',
  '2': 'Medium-speed CAN',
  '3': 'Low-speed CAN / LIN',
  '4': 'Network management',
  '5': 'SAE reserved',
  '6': 'SAE reserved',
  '7': 'SAE reserved',
  '8': 'SAE reserved',
  '9': 'SAE reserved',
};

const SUBSYSTEM_MAPS: Record<string, Record<string, string>> = {
  P: POWERTRAIN_SUBSYSTEMS,
  B: BODY_SUBSYSTEMS,
  C: CHASSIS_SUBSYSTEMS,
  U: NETWORK_SUBSYSTEMS,
};

/**
 * DTC prefixes that indicate safety-critical "do not drive" conditions.
 *
 * Each entry is a prefix of 2–4 characters that, when matched against
 * the start of a code, flags it as safety-critical.
 */
export const SAFETY_CRITICAL_PREFIXES: string[] = [
  // Brake system failures (Chassis)
  'C01',   // ABS / brake hydraulic faults
  'C02',   // Power steering faults

  // Steering system failures
  'C021',  // Electric power steering motor circuit
  'C022',  // Steering torque sensor

  // Airbag / restraint faults (Body)
  'B06',   // Airbag deployment / restraint system
  'B016',  // Airbag circuit

  // Fuel system critical
  'P0171', // System too lean (Bank 1) – potential stall
  'P0172', // System too rich (Bank 1) – fire risk at extreme
  'P025',  // Fuel pump circuit – engine stall
  'P0087', // Fuel rail pressure too low
  'P0088', // Fuel rail pressure too high

  // Transmission critical
  'P07',   // Transmission mechanical faults
  'P17',   // Manufacturer-specific transmission critical

  // Engine critical – risk of sudden loss of power
  'P0301', // Cylinder 1 misfire (severe at highway speeds)
  'P0302', // Cylinder 2 misfire
  'P0303', // Cylinder 3 misfire
  'P0304', // Cylinder 4 misfire
  'P030',  // Random / multiple cylinder misfire
  'P0218', // Transmission over-temperature
  'P0217', // Engine over-temperature

  // Stability / traction (Chassis)
  'C04',   // Traction control
  'C05',   // Stability control
];

/** Safety escalation messages keyed by matched prefix. */
const ESCALATION_MESSAGES: Record<string, string> = {
  C01: 'CRITICAL: This code indicates a potential brake system failure. Do not drive. Seek professional mechanic immediately.',
  C02: 'CRITICAL: This code indicates a potential steering system failure. Do not drive. Have the vehicle towed to a repair facility.',
  C021: 'CRITICAL: Electric power steering failure detected. Steering may become extremely difficult. Do not drive.',
  C022: 'CRITICAL: Steering torque sensor fault. Steering assist may be lost unexpectedly. Do not drive.',
  B06: 'CRITICAL: Airbag / restraint system fault. Airbags may not deploy in a collision. Seek immediate service.',
  B016: 'CRITICAL: Airbag circuit malfunction. Occupant protection compromised. Seek immediate service.',
  P0171: 'WARNING: Engine running dangerously lean. Risk of engine stall or damage. Avoid highway driving; service soon.',
  P0172: 'WARNING: Engine running dangerously rich. Potential fire hazard in extreme cases. Service immediately.',
  P025: 'CRITICAL: Fuel pump circuit failure. Engine may stall without warning. Do not drive.',
  P0087: 'CRITICAL: Fuel rail pressure too low. Engine may stall at speed. Do not drive on highways.',
  P0088: 'CRITICAL: Fuel rail pressure too high. Risk of fuel leak or engine damage. Service immediately.',
  P07: 'CRITICAL: Transmission mechanical failure indicated. Vehicle may lose ability to maintain speed. Do not drive.',
  P17: 'CRITICAL: Manufacturer-specific transmission fault. Have the vehicle inspected immediately.',
  P030: 'WARNING: Multiple cylinder misfire detected. Catalytic converter damage and power loss likely. Service immediately.',
  P0301: 'WARNING: Cylinder 1 misfire. Risk of catalytic converter damage and reduced power. Service soon.',
  P0302: 'WARNING: Cylinder 2 misfire. Risk of catalytic converter damage and reduced power. Service soon.',
  P0303: 'WARNING: Cylinder 3 misfire. Risk of catalytic converter damage and reduced power. Service soon.',
  P0304: 'WARNING: Cylinder 4 misfire. Risk of catalytic converter damage and reduced power. Service soon.',
  P0218: 'CRITICAL: Transmission over-temperature. Stop driving immediately to prevent permanent damage.',
  P0217: 'CRITICAL: Engine over-temperature. Stop driving immediately to prevent catastrophic engine failure.',
  C04: 'WARNING: Traction control system fault. Vehicle stability compromised in slippery conditions. Drive cautiously; service soon.',
  C05: 'WARNING: Stability control system fault. Vehicle may not recover from skids. Drive cautiously; service soon.',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a DTC code string into structured information.
 *
 * Supports standard SAE J2012 codes of the form `P0xxx`, `B0xxx`,
 * `C0xxx`, `U0xxx`, as well as manufacturer-specific variants.
 *
 * @param code - OBD-II diagnostic trouble code (e.g. "P0301")
 * @returns Parsed DTC information including system, subsystem, severity
 */
export function parseDTCCode(code: string): DTCInfo {
  const normalized = code.toUpperCase().trim();

  if (normalized.length < 5 || !/^[PBCU][0-3][0-9A-C][0-9]{2}$/.test(normalized)) {
    return {
      code: normalized,
      system: 'Unknown',
      subsystem: 'Unknown',
      description: `Unrecognised DTC format: ${normalized}`,
      severity: 'info',
    };
  }

  const systemChar = normalized[0];
  const originChar = normalized[1];
  const subsystemChar = normalized[2];

  const system = SYSTEM_MAP[systemChar] || 'Unknown';
  const origin = ORIGIN_MAP[originChar] || 'Unknown origin';
  const subsystemMap = SUBSYSTEM_MAPS[systemChar] || {};
  const subsystem = subsystemMap[subsystemChar] || 'Unknown subsystem';

  const description = `${system} – ${origin} – ${subsystem} (code ${normalized})`;

  const safety = isSafetyCritical(normalized);
  const safetyEscalation = getSafetyEscalation(normalized) ?? undefined;

  let severity: DTCInfo['severity'];
  if (safety) {
    severity = 'critical';
  } else if (systemChar === 'C' || systemChar === 'B') {
    severity = 'warning';
  } else if (originChar === '1') {
    severity = 'caution';
  } else {
    severity = 'caution';
  }

  return {
    code: normalized,
    system,
    subsystem,
    description,
    severity,
    safetyEscalation,
  };
}

/**
 * Check whether a DTC code indicates a safety-critical "do not drive"
 * or "immediate attention" condition.
 *
 * @param code - OBD-II diagnostic trouble code
 * @returns `true` if the code matches a known safety-critical prefix
 */
export function isSafetyCritical(code: string): boolean {
  const normalized = code.toUpperCase().trim();
  return SAFETY_CRITICAL_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  );
}

/**
 * Return a human-readable safety escalation message for a DTC code,
 * or `null` if the code is not safety-critical.
 *
 * @param code - OBD-II diagnostic trouble code
 * @returns Escalation message string, or `null`
 */
export function getSafetyEscalation(code: string): string | null {
  const normalized = code.toUpperCase().trim();

  // Match the longest prefix first for specificity
  const sortedPrefixes = [...SAFETY_CRITICAL_PREFIXES].sort(
    (a, b) => b.length - a.length,
  );

  for (const prefix of sortedPrefixes) {
    if (normalized.startsWith(prefix)) {
      return ESCALATION_MESSAGES[prefix] || `SAFETY ALERT: Code ${normalized} matches critical prefix ${prefix}. Have the vehicle inspected immediately.`;
    }
  }

  return null;
}
