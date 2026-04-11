/**
 * Gear AI – Shared Automotive Domain Layer
 * VIN Decoder (pure business logic, no Expo/React Native dependencies)
 *
 * Integrates with NHTSA vPIC API for VIN decoding, make/model lookups,
 * and ISO 3779 checksum validation.
 *
 * @module automotive/vin-decoder
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Structured result returned by NHTSA VIN decoding. */
export interface VINDecodeResult {
  vin: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  engine_displacement_l?: number;
  engine_cylinders?: number;
  fuel_type?: string;
  transmission?: string;
  drivetrain?: string;
  body_type?: string;
  plant_country?: string;
  plant_city?: string;
  error_code?: string;
  error_message?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NHTSA_API_BASE = 'https://vpic.nhtsa.dot.gov/api';

/** ISO 3779 positional weights used for checksum calculation. */
const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** ISO 3779 letter → numeric transliteration map. */
const VIN_TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decode a VIN using the NHTSA vPIC API.
 *
 * @param vin  - 17-character Vehicle Identification Number
 * @param year - Optional model year for more accurate results
 * @returns Decoded vehicle information
 * @throws Error if the VIN format is invalid or the API call fails
 */
export async function decodeVIN(
  vin: string,
  year?: number,
): Promise<VINDecodeResult> {
  if (!isValidVIN(vin)) {
    throw new Error(
      'Invalid VIN format. VIN must be exactly 17 characters and cannot contain I, O, or Q.',
    );
  }

  const sanitizedVIN = vin.toUpperCase().replace(/\s/g, '');
  const yearParam = year ? `&modelyear=${year}` : '';
  const url = `${NHTSA_API_BASE}/vehicles/DecodeVin/${sanitizedVIN}?format=json${yearParam}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.Results || data.Results.length === 0) {
      throw new Error('Failed to decode VIN. No results returned from NHTSA.');
    }

    return parseNHTSAResponse(sanitizedVIN, data.Results);
  } catch (error) {
    throw new Error(
      `Failed to decode VIN: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Validate that a string is a well-formed VIN.
 *
 * Checks length (17), forbidden characters (I, O, Q), and the ISO 3779
 * check-digit at position 9.
 *
 * @param vin - Candidate VIN string
 * @returns `true` when the VIN passes all format checks
 */
export function isValidVIN(vin: string): boolean {
  if (vin.length !== 17) return false;
  if (/[IOQ]/i.test(vin)) return false;
  return validateVINChecksum(vin);
}

/**
 * Validate the ISO 3779 check-digit (position 9) of a VIN.
 *
 * @param vin - 17-character VIN (must be uppercase for correct results)
 * @returns `true` when the check digit is correct
 */
export function validateVINChecksum(vin: string): boolean {
  if (vin.length !== 17) return false;

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const char = vin[i];
    const value = /\d/.test(char)
      ? parseInt(char, 10)
      : VIN_TRANSLITERATION[char] || 0;
    sum += value * VIN_WEIGHTS[i];
  }

  const checkDigit = sum % 11;
  const expected = vin[8];

  return checkDigit === 10 ? expected === 'X' : expected === checkDigit.toString();
}

/**
 * Fetch vehicle makes available for a given year from NHTSA.
 *
 * @param year - Model year (defaults to current year)
 * @returns Sorted array of make names
 */
export async function getMakesForYear(year?: number): Promise<string[]> {
  const yearParam = year || new Date().getFullYear();
  const url = `${NHTSA_API_BASE}/vehicles/GetMakesForVehicleType/car?format=json&year=${yearParam}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.Results) return [];
    return data.Results.map((result: any) => result.MakeName).sort();
  } catch {
    return [];
  }
}

/**
 * Fetch models for a specific make and year from NHTSA.
 *
 * @param make - Manufacturer name (e.g. "Toyota")
 * @param year - Model year (defaults to current year)
 * @returns Sorted array of model names
 */
export async function getModelsForMake(
  make: string,
  year?: number,
): Promise<string[]> {
  const yearParam = year || new Date().getFullYear();
  const url = `${NHTSA_API_BASE}/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${yearParam}?format=json`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.Results) return [];
    return data.Results.map((result: any) => result.Model_Name).sort();
  } catch {
    return [];
  }
}

/**
 * Parse a raw NHTSA vPIC result array into a structured {@link VINDecodeResult}.
 *
 * @param vin     - The sanitized VIN that was decoded
 * @param results - The `Results` array from the NHTSA JSON response
 * @returns Structured decode result
 */
export function parseNHTSAResponse(
  vin: string,
  results: any[],
): VINDecodeResult {
  const getValue = (variableId: number): string | undefined => {
    const result = results.find((r) => r.VariableId === variableId);
    return result?.Value || undefined;
  };

  const getNumericValue = (variableId: number): number | undefined => {
    const value = getValue(variableId);
    return value ? parseFloat(value) : undefined;
  };

  const errorCode = getValue(143);
  if (errorCode && errorCode !== '0') {
    return {
      vin,
      year: getNumericValue(29) || new Date().getFullYear(),
      make: getValue(26) || 'Unknown',
      model: getValue(28) || 'Unknown',
      error_code: errorCode,
      error_message: `VIN decode error: ${errorCode}`,
    };
  }

  return {
    vin,
    year: getNumericValue(29) || new Date().getFullYear(),
    make: getValue(26) || 'Unknown',
    model: getValue(28) || 'Unknown',
    trim: getValue(38) || getValue(109),
    engine_displacement_l: getNumericValue(13),
    engine_cylinders: getNumericValue(9),
    fuel_type: getValue(24),
    transmission: getValue(10),
    drivetrain: getValue(15),
    body_type: getValue(5),
    plant_country: getValue(75),
    plant_city: getValue(31),
  };
}
