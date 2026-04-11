/**
 * Gear AI – Shared Automotive Domain Layer
 * Owner's Manual Search Adapter (stub)
 *
 * Provides type-safe interfaces and stub implementations for searching
 * indexed owner's manual content. The actual implementation will connect
 * to Supabase pgvector / RPC once the manual ingestion pipeline is ready.
 *
 * @module automotive/manual-search
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single chunk of manual content returned by a search. */
export interface ManualChunk {
  /** The text content of this chunk. */
  content: string;
  /** Page number in the original PDF, if known. */
  pageNumber?: number;
  /** Section / chapter title this chunk belongs to. */
  section?: string;
  /** Relevance score (0–1) from the search backend. */
  relevanceScore: number;
}

/** Status of a vehicle's indexed owner's manual. */
export interface ManualStatus {
  /** Whether a manual is indexed and available for this vehicle. */
  available: boolean;
  /** The vehicle identifier this status relates to. */
  vehicleId: string;
  /** Total number of indexed chunks. */
  totalChunks: number;
  /** ISO timestamp of the last indexing run, if any. */
  lastIndexed?: string;
}

// ---------------------------------------------------------------------------
// Public API (stubs)
// ---------------------------------------------------------------------------

/**
 * Search indexed owner's manual chunks for a vehicle.
 *
 * TODO: Connect to Supabase pgvector / RPC when the manual ingestion
 * pipeline is ready. The implementation will call a Supabase RPC
 * function that performs a hybrid BM25 + cosine-similarity search
 * over the `manual_chunks` table with `pgvector`.
 *
 * @param vehicleId - UUID of the vehicle whose manual to search
 * @param query     - Natural-language search query
 * @param limit     - Maximum number of chunks to return (default 5)
 * @returns Matching manual chunks sorted by relevance (empty until implemented)
 */
export async function searchManualChunks(
  vehicleId: string,
  query: string,
  limit: number = 5,
): Promise<ManualChunk[]> {
  // TODO: Replace with real implementation when manual pipeline is built.
  // Expected implementation:
  //   1. Call Supabase RPC `search_manual_chunks(vehicle_id, query_embedding, limit)`
  //   2. Map RPC results to ManualChunk[]
  //   3. Return sorted by relevanceScore descending
  void vehicleId;
  void query;
  void limit;
  return [];
}

/**
 * Check whether an indexed owner's manual is available for a vehicle.
 *
 * TODO: Connect to Supabase pgvector / RPC when the manual ingestion
 * pipeline is ready. Will query the `vehicle_manuals` table to check
 * indexing status and chunk count.
 *
 * @param vehicleId - UUID of the vehicle to check
 * @returns Status object indicating availability and chunk count
 */
export async function getManualStatus(
  vehicleId: string,
): Promise<ManualStatus> {
  // TODO: Replace with real implementation when manual pipeline is built.
  // Expected implementation:
  //   1. Query `vehicle_manuals` table for this vehicleId
  //   2. Count chunks in `manual_chunks` where manual_id matches
  //   3. Return status with available=true if chunks > 0
  return {
    available: false,
    vehicleId,
    totalChunks: 0,
    lastIndexed: undefined,
  };
}
