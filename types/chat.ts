/**
 * Gear AI CoPilot - Chat & AI Type Definitions
 * 
 * Data models for AI chat sessions and messages
 */

export interface ChatSession {
  session_id: string;
  user_id: string;
  vehicle_id?: string;
  title?: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
  is_active: boolean;
  context_type: 'general' | 'manual' | 'diagnostic' | 'maintenance' | 'valuation' | 'cost_estimate' | 'parts_lookup' | 'pre_purchase';
  metadata?: Record<string, any>;
}

export interface ChatMessage {
  message_id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens_used?: number;
  model_version?: string;
  retrieval_context?: RetrievalContext;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface RetrievalContext {
  sources: RAGSource[];
  query_embedding?: number[];
  search_results_count: number;
  reranked: boolean;
}

export interface RAGSource {
  embedding_id: string;
  manual_id: string;
  chunk_text: string;
  page_number?: number;
  section_title?: string;
  similarity_score: number;
  manual_name?: string; // e.g., "2023 Honda Accord Owner's Manual"
}

// ---------------------------------------------------------------------------
// Multimodal support
// ---------------------------------------------------------------------------

export interface MultimodalAttachment {
  type: 'image' | 'audio';
  /** base64-encoded data URI (e.g., "data:image/jpeg;base64,...") */
  data_uri: string;
  /** Original filename or description */
  label?: string;
}

// ---------------------------------------------------------------------------
// Rich vehicle context injected into every AI call (F1)
// ---------------------------------------------------------------------------

export interface VehicleFullContext {
  vehicle_id: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  vin?: string;
  current_mileage?: number;
  /** Recent maintenance records (last 10) */
  recent_maintenance?: Array<{
    title: string;
    date: string;
    mileage?: number;
    cost?: number;
    parts_replaced?: string[];
  }>;
  /** Active / pending DTC codes */
  active_codes?: Array<{ code: string; description: string; severity: string }>;
  /** Upcoming service reminders */
  pending_services?: Array<{ title: string; due_mileage?: number; due_date?: string; priority: string }>;
  /** 30-day mileage delta for proactive suggestions */
  monthly_mileage_delta?: number;
}

export interface AIRequest {
  session_id: string;
  message: string;
  vehicle_id?: string;
  context_type?: ChatSession['context_type'];
  include_rag?: boolean;
  max_tokens?: number;
  temperature?: number;
  /** Full vehicle context for enhanced AI responses (F1) */
  vehicle_context?: VehicleFullContext;
  /** Multimodal attachment for photo/audio analysis (F2) */
  attachment?: MultimodalAttachment;
}

export interface AIResponse {
  message_id: string;
  content: string;
  sources?: RAGSource[];
  tokens_used: number;
  model_version: string;
  created_at: string;
}

export interface Manual {
  manual_id: string;
  make: string;
  model: string;
  year: number;
  trim?: string;
  file_url?: string;
  file_size_bytes?: number;
  page_count?: number;
  language: string;
  version?: string;
  upload_date: string;
  processed: boolean;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface VectorEmbedding {
  embedding_id: string;
  manual_id: string;
  chunk_text: string;
  chunk_index: number;
  parent_chunk_id?: string;
  page_number?: number;
  section_title?: string;
  embedding: number[]; // 768-dimensional vector
  token_count?: number;
  chunk_type: 'parent' | 'child';
  created_at: string;
  metadata?: Record<string, any>;
}

export interface SearchQuery {
  query: string;
  manual_id?: string; // Optional: limit search to specific manual
  vehicle_id?: string; // Optional: limit search to vehicle's manual
  limit?: number; // Number of results to return
  threshold?: number; // Minimum similarity score (0-1)
}

export interface SearchResult {
  embedding_id: string;
  chunk_text: string;
  page_number?: number;
  section_title?: string;
  similarity: number;
  manual: {
    manual_id: string;
    make: string;
    model: string;
    year: number;
  };
}

// ---------------------------------------------------------------------------
// Structured AI result types for special features
// ---------------------------------------------------------------------------

/** F3: Repair cost estimate result */
export interface RepairCostEstimate {
  service: string;
  vehicle: string;
  location: string;
  labor_cost_min: number;
  labor_cost_max: number;
  parts_cost_min: number;
  parts_cost_max: number;
  total_min: number;
  total_max: number;
  labor_hours_est: string;
  notes: string;
  red_flags: string[];
}

/** F4: Compatible part result */
export interface CompatiblePart {
  brand: string;
  part_number: string;
  description: string;
  type: 'OEM' | 'OEM-equivalent' | 'Aftermarket';
  price_range?: string;
  purchase_links: Array<{ retailer: string; url: string }>;
}

/** F5: Parsed maintenance record from natural language */
export interface ParsedMaintenanceLog {
  title: string;
  type: 'routine' | 'repair' | 'modification' | 'diagnostic' | 'inspection';
  date: string;
  mileage?: number;
  cost?: number;
  parts_cost?: number;
  labor_cost?: number;
  parts_replaced?: string[];
  shop_name?: string;
  description?: string;
  confidence: 'high' | 'medium' | 'low';
}

/** F6: Pre-purchase inspection result */
export interface PrepurchaseReport {
  vin: string;
  vehicle: string;
  overall_risk: 'low' | 'medium' | 'high';
  recalls: Array<{ component: string; summary: string; remedy: string }>;
  common_issues: Array<{ issue: string; severity: 'minor' | 'major' | 'critical'; description: string }>;
  inspection_checklist: Array<{ area: string; what_to_check: string; red_flags: string }>;
  estimated_remaining_life: Record<string, string>;
  negotiation_tips: string[];
  summary: string;
}

// AI model configurations
export const AIModels = {
  GPT4_TURBO: {
    name: 'gpt-4-turbo-preview',
    max_tokens: 4096,
    cost_per_1k_input: 0.01,
    cost_per_1k_output: 0.03,
  },
  GPT35_TURBO: {
    name: 'gpt-3.5-turbo',
    max_tokens: 4096,
    cost_per_1k_input: 0.0015,
    cost_per_1k_output: 0.002,
  },
  EMBEDDING_SMALL: {
    name: 'text-embedding-3-small',
    dimensions: 1536,
    cost_per_1k: 0.00002,
  },
} as const;

export type AIModelType = keyof typeof AIModels;
