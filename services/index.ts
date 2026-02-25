/**
 * Gear AI CoPilot - Services Index
 *
 * Central export point for all service modules.
 */

// Constants
export {
  UNLIMITED_VEHICLES,
  MAX_FILE_SIZE_BYTES,
  DEFAULT_API_TIMEOUT,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  SUBSCRIPTION_TIERS,
  SUBSCRIPTION_STATUSES,
} from './constants';

// Authentication & User Management
export {
  signUp,
  signIn,
  signOut,
  getSession,
  sendPasswordResetEmail,
  updateUserProfile,
  getUserById,
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
  getProactiveSuggestions,
  estimateRepairCost,
  lookupCompatibleParts,
  parseMaintenanceFromText,
  analyzePrepurchaseVIN,
} from './ai-service';

// AI multimodal service (F2: photo analysis, document scanning, audio analysis)
export {
  analyzeVehiclePhoto,
  analyzeRepairDocument,
  analyzeEngineNoise,
  transcribeAudio,
} from './ai-multimodal-service';

// Diagnostics (AI-powered DTC analysis, health score, symptom checker, OBD-II)
export {
  analyzeDTC,
  getCommonDTCInfo,
  checkSymptoms,
  calculateHealthScore,
  getLatestHealthScore,
  getHealthScoreHistory,
  saveDiagnosticCode,
  getDiagnosticHistory,
  resolveDiagnosticCode,
  updateCodeWithAIAnalysis,
  connectOBDAdapter,
  startLiveDataStream,
  readDTCCodes,
  readFreezeFrame,
  clearDTCCodes,
} from './diagnostic-service';

// Recalls & TSBs (NHTSA)
export {
  checkRecallsByVehicle,
  getRecallAlerts,
  lookupTSBs,
  acknowledgeRecall,
  getUnacknowledgedRecallCount,
} from './recall-service';

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
  getMileageLogs,
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
  getServiceReminders,
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
