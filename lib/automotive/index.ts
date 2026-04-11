/**
 * Gear AI – Shared Automotive Domain Layer
 *
 * Pure business logic with NO Expo / React Native dependencies.
 * Safe to import from both the mobile app services and the MCP server.
 *
 * @module automotive
 */

// VIN decoding & NHTSA vehicle lookups
export {
  decodeVIN,
  isValidVIN,
  validateVINChecksum,
  getMakesForYear,
  getModelsForMake,
  parseNHTSAResponse,
} from './vin-decoder';
export type { VINDecodeResult } from './vin-decoder';

// NHTSA recall & TSB lookups
export {
  checkRecallsByVehicle,
  lookupTSBs,
  lookupComplaints,
  fetchWithTimeout,
} from './recall-checker';
export type { NHTSARecall, TSBResult, NHTSAComplaint } from './recall-checker';

// DTC code analysis & safety classification
export {
  parseDTCCode,
  isSafetyCritical,
  getSafetyEscalation,
  SAFETY_CRITICAL_PREFIXES,
} from './dtc-analyzer';
export type { DTCInfo } from './dtc-analyzer';

// Vehicle health scoring
export { computeHealthScore } from './health-scorer';
export type {
  HealthSystem,
  HealthSystemScore,
  VehicleHealthReport,
  HealthScoreParams,
} from './health-scorer';

// Owner's manual search (stub)
export { searchManualChunks, getManualStatus } from './manual-search';
export type { ManualChunk, ManualStatus } from './manual-search';
