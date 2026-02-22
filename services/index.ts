/**
 * Gear AI CoPilot - Services Index
 *
 * Central export point for all service modules.
 */

// Authentication & User Management
export {
  syncUserToSupabase,
  signUp,
  signIn,
  signOut,
  getUserByFirebaseUid,
  sendPasswordResetEmail,
  updateUserProfile,
  updateUserPreferences,
  deleteUserAccount,
  sendEmailVerification,
  isEmailVerified,
  reloadUser,
} from './auth-service';

// VIN decoding (NHTSA vPIC)
export {
  decodeVIN,
  getMakesForYear,
  getModelsForMake,
  validateVINChecksum,
} from './vin-decoder';

// Owner's manual retrieval pipeline
export {
  retrieveManual,
  getRecalls,
  getSafetyRatings,
  getVehicleReport,
  resolveVehicle,
  findIndexedManual,
  createManualRecord,
} from './manual-retrieval';

// RAG pipeline (chunking, embeddings, processing)
export {
  chunkManualText,
  generateEmbeddings,
  generateQueryEmbedding,
  storeChunksWithEmbeddings,
  processManual,
} from './rag-pipeline';

// Two-stage search (BM25 + semantic)
export {
  searchManual,
  quickSearch,
} from './manual-search';

// AI chat service
export {
  generateAIResponse,
  searchManualChunks,
  generateEmbedding,
  processManualPDF,
} from './ai-service';

// Diagnostics (CarMD integration)
export {
  analyzeDTC,
  getCommonDTCInfo,
} from './diagnostic-service';

// Health check
export {
  getHealthStatus,
  validateEnvironment,
} from './health-check';

// Vehicle management
export {
  createVehicle,
  getUserVehicles,
  getVehicleById,
  updateVehicle,
  updateVehicleMileage,
  updateVehicleImage,
  deleteVehicle,
  hardDeleteVehicle,
  getUserVehicleCount,
  canAddVehicle,
  searchVehicleByVIN,
} from './vehicle-service';

// Maintenance tracking
export {
  createMaintenanceRecord,
  getMaintenanceRecords,
  getMaintenanceRecordById,
  updateMaintenanceRecord,
  deleteMaintenanceRecord,
  getMaintenanceStats,
  getAllUserMaintenanceRecords,
  getRecentMaintenanceRecords,
  addMaintenanceAttachment,
  removeMaintenanceAttachment,
} from './maintenance-service';

// Storage management
export {
  STORAGE_BUCKETS,
  uploadFile,
  uploadVehiclePhoto,
  uploadMaintenanceReceipt,
  uploadProfileAvatar,
  deleteFile,
  deleteVehiclePhoto,
  deleteMaintenanceReceipt,
  getPublicUrl,
  listFiles,
  getVehiclePhotos,
  getMaintenanceReceipts,
  initializeStorageBuckets,
} from './storage-service';

// Chat session and message management
export {
  createChatSession,
  getChatSession,
  getUserChatSessions,
  getVehicleChatSessions,
  updateChatSessionTitle,
  archiveChatSession,
  deleteChatSession,
  addChatMessage,
  getChatMessages,
  getRecentChatMessages,
  deleteChatMessage,
  getUserTokenUsage,
  generateSessionTitle,
} from './chat-service';

// Subscription & Tier Management
export {
  TIER_LIMITS,
  getUserSubscription,
  getUserTierLimits,
  hasFeatureAccess,
  updateSubscriptionTier,
  setStripeCustomerId,
  cancelSubscription,
  reactivateSubscription,
  isSubscriptionActive,
  getSubscriptionPrice,
  createCheckoutSession,
  handleStripeWebhook,
} from './subscription-service';

export type {
  SubscriptionTier,
  SubscriptionStatus,
  TierLimits,
} from './subscription-service';
