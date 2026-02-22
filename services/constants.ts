/**
 * Gear AI CoPilot - Constants
 * 
 * Shared constants used across services
 */

// Vehicle and subscription limits
export const UNLIMITED_VEHICLES = Number.MAX_SAFE_INTEGER;

// Storage limits
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

// API timeouts
export const DEFAULT_API_TIMEOUT = 30000; // 30 seconds

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 30;
export const MAX_PAGE_SIZE = 100;

// Subscription tiers
export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PRO: 'pro',
  MECHANIC: 'mechanic',
  DEALER: 'dealer',
} as const;

// Subscription statuses
export const SUBSCRIPTION_STATUSES = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  PAST_DUE: 'past_due',
  TRIALING: 'trialing',
  NONE: 'none',
} as const;
