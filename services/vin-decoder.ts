/**
 * Gear AI CoPilot - VIN Decoder Service
 *
 * Thin re-export wrapper around the shared automotive domain layer.
 * All pure NHTSA / ISO 3779 logic lives in `lib/automotive/vin-decoder`.
 * Existing app imports (`from '../services/vin-decoder'`) continue to work.
 */

export {
  decodeVIN,
  isValidVIN,
  validateVINChecksum,
  getMakesForYear,
  getModelsForMake,
  parseNHTSAResponse,
} from '../lib/automotive';

// Re-export the app's own VINDecodeResult type so dependents that import
// it from this file keep working. The shared layer's type is structurally
// identical, but the canonical app type lives in `../types`.
export type { VINDecodeResult } from '../types';
