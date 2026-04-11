/**
 * AI Model Registry
 *
 * Defines all available AI models, their providers, tier requirements,
 * and capabilities for the multi-model chat feature.
 */

// ---------------------------------------------------------------------------
// Provider types
// ---------------------------------------------------------------------------

export type AIProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'xai'
  | 'deepseek'
  | 'moonshot';

export type ModelTier = 'free' | 'paid';

export interface ModelDefinition {
  id: string;
  name: string;
  provider: AIProvider;
  modelId: string; // actual model ID sent to the provider API
  tier: ModelTier;
  supportsImages: boolean;
  maxTokens: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export interface ProviderConfig {
  baseUrl: string;
  envKey: string; // env var name for the API key
  format: 'openai' | 'anthropic' | 'google';
}

export const PROVIDER_CONFIG: Record<AIProvider, ProviderConfig> = {
  openai: {
    baseUrl: 'https://api.openai.com',
    envKey: 'OPENAI_API_KEY',
    format: 'openai',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    envKey: 'ANTHROPIC_API_KEY',
    format: 'anthropic',
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    envKey: 'GOOGLE_AI_API_KEY',
    format: 'google',
  },
  xai: {
    baseUrl: 'https://api.x.ai',
    envKey: 'XAI_API_KEY',
    format: 'openai', // OpenAI-compatible
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    envKey: 'DEEPSEEK_API_KEY',
    format: 'openai', // OpenAI-compatible
  },
  moonshot: {
    baseUrl: 'https://api.moonshot.cn',
    envKey: 'MOONSHOT_API_KEY',
    format: 'openai', // OpenAI-compatible
  },
};

// ---------------------------------------------------------------------------
// Available models
// ---------------------------------------------------------------------------

export const AVAILABLE_MODELS: ModelDefinition[] = [
  // ---- OpenAI ----
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    modelId: 'gpt-4.1-mini',
    tier: 'free',
    supportsImages: false,
    maxTokens: 4096,
    description: 'Fast and affordable OpenAI model',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    modelId: 'gpt-4o',
    tier: 'free',
    supportsImages: true,
    maxTokens: 4096,
    description: 'OpenAI multimodal model with image support',
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    modelId: 'gpt-4.1',
    tier: 'paid',
    supportsImages: false,
    maxTokens: 8192,
    description: 'Advanced OpenAI reasoning model',
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    provider: 'openai',
    modelId: 'o3-mini',
    tier: 'paid',
    supportsImages: false,
    maxTokens: 8192,
    description: 'OpenAI reasoning model for complex queries',
  },

  // ---- Anthropic / Claude ----
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    modelId: 'claude-3-5-haiku-20241022',
    tier: 'free',
    supportsImages: false,
    maxTokens: 4096,
    description: 'Fast and affordable Anthropic model',
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-20250514',
    tier: 'free',
    supportsImages: true,
    maxTokens: 4096,
    description: 'Balanced Anthropic model — fast and capable',
  },
  {
    id: 'claude-opus-4.6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    modelId: 'claude-opus-4-6',
    tier: 'paid',
    supportsImages: true,
    maxTokens: 8192,
    description: 'Anthropic\'s most powerful model',
  },

  // ---- Google / Gemini ----
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    provider: 'google',
    modelId: 'gemini-3.1-flash-lite-preview',
    tier: 'free',
    supportsImages: false,
    maxTokens: 4096,
    description: 'Fastest & cheapest Gemini — great for quick questions',
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    provider: 'google',
    modelId: 'gemini-3-flash-preview',
    tier: 'free',
    supportsImages: true,
    maxTokens: 4096,
    description: 'Fast multimodal Gemini with image support',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    modelId: 'gemini-2.5-flash',
    tier: 'free',
    supportsImages: true,
    maxTokens: 4096,
    description: 'Stable multimodal Gemini model',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    modelId: 'gemini-2.5-pro',
    tier: 'paid',
    supportsImages: true,
    maxTokens: 8192,
    description: 'Advanced Gemini for complex reasoning',
  },
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    provider: 'google',
    modelId: 'gemini-3.1-pro-preview',
    tier: 'paid',
    supportsImages: true,
    maxTokens: 8192,
    description: 'Google\'s most capable model — 1M context window',
  },

  // ---- xAI / Grok ----
  {
    id: 'grok-3-mini',
    name: 'Grok 3 Mini',
    provider: 'xai',
    modelId: 'grok-3-mini',
    tier: 'free',
    supportsImages: false,
    maxTokens: 4096,
    description: 'xAI\'s efficient reasoning model',
  },
  {
    id: 'grok-3',
    name: 'Grok 3',
    provider: 'xai',
    modelId: 'grok-3',
    tier: 'paid',
    supportsImages: false,
    maxTokens: 8192,
    description: 'xAI\'s flagship model',
  },

  // ---- DeepSeek ----
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'deepseek',
    modelId: 'deepseek-chat',
    tier: 'free',
    supportsImages: false,
    maxTokens: 4096,
    description: 'DeepSeek\'s general-purpose model',
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    provider: 'deepseek',
    modelId: 'deepseek-reasoner',
    tier: 'paid',
    supportsImages: false,
    maxTokens: 8192,
    description: 'DeepSeek\'s advanced reasoning model',
  },

  // ---- Moonshot / Kimi ----
  {
    id: 'moonshot-v1-8k',
    name: 'Kimi (Moonshot)',
    provider: 'moonshot',
    modelId: 'moonshot-v1-8k',
    tier: 'free',
    supportsImages: false,
    maxTokens: 4096,
    description: 'Moonshot AI\'s conversational model',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getModelById(id: string): ModelDefinition | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === id);
}

export function getModelsForTier(userTier: 'free' | 'pro' | 'mechanic' | 'dealer'): ModelDefinition[] {
  const isPaid = userTier !== 'free';
  return AVAILABLE_MODELS.filter((m) => isPaid || m.tier === 'free');
}

export function getDefaultModel(): ModelDefinition {
  return AVAILABLE_MODELS[0]; // gpt-4.1-mini
}

export function getProviderConfig(provider: AIProvider): ProviderConfig {
  return PROVIDER_CONFIG[provider];
}
