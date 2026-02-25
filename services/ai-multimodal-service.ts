/**
 * Gear AI CoPilot - AI Multimodal Service (F2)
 *
 * Photo analysis (GPT-4o vision), document scanning (repair estimate OCR),
 * and audio transcription + engine noise analysis via OpenAI Whisper.
 */

import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_TRANSCRIPTION_URL = 'https://api.openai.com/v1/audio/transcriptions';
const VISION_MODEL = 'gpt-4o';

function getApiKey(): string | undefined {
  return Constants.expoConfig?.extra?.openaiApiKey || process.env.OPENAI_API_KEY;
}

// ---------------------------------------------------------------------------
// Photo Analysis — warning lights, worn parts, fluid leaks, tire tread
// ---------------------------------------------------------------------------

export interface PhotoAnalysisResult {
  diagnosis: string;
  severity: 'info' | 'caution' | 'warning' | 'critical';
  identified_items: string[];
  recommended_actions: string[];
  estimated_cost_range?: string;
  safe_to_drive: boolean | null;
}

/**
 * Analyze a vehicle photo (warning light, worn part, fluid leak, tire tread).
 * imageBase64 should be raw base64 WITHOUT the data URI prefix.
 */
export async function analyzeVehiclePhoto(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  vehicleContext?: string
): Promise<PhotoAnalysisResult> {
  const apiKey = getApiKey();
  if (!apiKey) return getPhotoFallback();

  const vehicleNote = vehicleContext ? `\nVehicle: ${vehicleContext}` : '';
  const systemPrompt = `You are Gear AI, an expert automotive technician with 20+ years of experience. 
Analyze vehicle photos and provide precise, safety-focused diagnoses.${vehicleNote}
Always respond with valid JSON only — no markdown, no extra text.`;

  const userPrompt = `Analyze this vehicle photo and identify any issues, warning lights, worn parts, fluid leaks, or tire conditions.
Return a JSON object with exactly these keys:
{
  "diagnosis": "Clear, plain-English diagnosis of what you see",
  "severity": "info|caution|warning|critical",
  "identified_items": ["item1", "item2"],
  "recommended_actions": ["action1", "action2"],
  "estimated_cost_range": "$X–$Y (or null if not applicable)",
  "safe_to_drive": true|false|null
}`;

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' },
              },
              { type: 'text', text: userPrompt },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    if (!res.ok) return getPhotoFallback();
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content || '';
    return JSON.parse(raw) as PhotoAnalysisResult;
  } catch {
    return getPhotoFallback();
  }
}

function getPhotoFallback(): PhotoAnalysisResult {
  return {
    diagnosis: 'Unable to analyze the photo at this time. Please ensure your OpenAI API key is configured.',
    severity: 'info',
    identified_items: [],
    recommended_actions: ['Try again or consult a mechanic for in-person inspection.'],
    safe_to_drive: null,
  };
}

// ---------------------------------------------------------------------------
// Repair Document Scanning — extract line items, flag overcharges
// ---------------------------------------------------------------------------

export interface RepairEstimateItem {
  description: string;
  labor_hours?: number;
  labor_cost?: number;
  parts_cost?: number;
  total?: number;
  is_overpriced?: boolean;
  fair_price_range?: string;
  notes?: string;
}

export interface RepairDocumentAnalysis {
  shop_name?: string;
  total_estimate: number | null;
  line_items: RepairEstimateItem[];
  flagged_items: string[];
  overall_assessment: 'fair' | 'slightly_high' | 'overpriced';
  negotiation_tips: string[];
  summary: string;
}

/**
 * Analyze a photographed repair estimate. Extracts line items, flags overcharges,
 * and suggests alternatives.
 */
export async function analyzeRepairDocument(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  vehicleContext?: string
): Promise<RepairDocumentAnalysis> {
  const apiKey = getApiKey();
  if (!apiKey) return getDocumentFallback();

  const vehicleNote = vehicleContext ? `\nVehicle: ${vehicleContext}` : '';
  const systemPrompt = `You are an expert automotive service advisor who helps consumers understand and negotiate repair estimates.${vehicleNote}
Extract all line items from this repair estimate and evaluate fairness based on industry-standard labor rates and parts pricing.
Always respond with valid JSON only — no markdown, no extra text.`;

  const userPrompt = `Read this repair estimate document and return a JSON object with exactly these keys:
{
  "shop_name": "name or null",
  "total_estimate": 999.99,
  "line_items": [
    {
      "description": "service name",
      "labor_hours": 1.5,
      "labor_cost": 150,
      "parts_cost": 80,
      "total": 230,
      "is_overpriced": false,
      "fair_price_range": "$180–$250",
      "notes": "optional note"
    }
  ],
  "flagged_items": ["Description of any items that seem overpriced or unnecessary"],
  "overall_assessment": "fair|slightly_high|overpriced",
  "negotiation_tips": ["tip1", "tip2"],
  "summary": "2-3 sentence overall assessment"
}`;

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' },
              },
              { type: 'text', text: userPrompt },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 1200,
      }),
    });

    if (!res.ok) return getDocumentFallback();
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content || '';
    return JSON.parse(raw) as RepairDocumentAnalysis;
  } catch {
    return getDocumentFallback();
  }
}

function getDocumentFallback(): RepairDocumentAnalysis {
  return {
    shop_name: undefined,
    total_estimate: null,
    line_items: [],
    flagged_items: [],
    overall_assessment: 'fair',
    negotiation_tips: [],
    summary: 'Unable to analyze the document. Please ensure the image is clear and well-lit.',
  };
}

// ---------------------------------------------------------------------------
// Audio Analysis — engine noise transcription + diagnosis
// ---------------------------------------------------------------------------

export interface AudioAnalysisResult {
  transcription: string;
  noise_type?: string;
  probable_source?: string;
  severity: 'info' | 'caution' | 'warning' | 'critical';
  recommended_actions: string[];
  estimated_cost_range?: string;
  urgency: string;
}

/**
 * Transcribe an audio recording and analyze engine/vehicle noises.
 * audioUri should be a local file URI from expo-av or expo-document-picker.
 */
export async function analyzeEngineNoise(
  audioUri: string,
  vehicleContext?: string
): Promise<AudioAnalysisResult> {
  const apiKey = getApiKey();
  if (!apiKey) return getAudioFallback('No API key configured.');

  // Step 1: Transcribe the audio with Whisper
  let transcription = '';
  try {
    transcription = await transcribeAudio(audioUri, apiKey);
  } catch (err) {
    return getAudioFallback('Could not transcribe audio recording.');
  }

  if (!transcription) {
    return getAudioFallback('The recording was too quiet or unclear to transcribe.');
  }

  // Step 2: Analyze the transcribed description as an automotive noise
  const vehicleNote = vehicleContext ? `\nVehicle: ${vehicleContext}` : '';
  const systemPrompt = `You are an expert automotive diagnostic technician.${vehicleNote}
A customer recorded a vehicle noise and it was transcribed. Analyze the noise description and diagnose the probable cause.
Always respond with valid JSON only — no markdown, no extra text.`;

  const userPrompt = `Audio transcription of vehicle noise: "${transcription}"
Return a JSON object with exactly these keys:
{
  "transcription": "${transcription}",
  "noise_type": "knock/squeal/rattle/hiss/grind/click/etc",
  "probable_source": "e.g. worn brake pads, loose heat shield",
  "severity": "info|caution|warning|critical",
  "recommended_actions": ["action1", "action2"],
  "estimated_cost_range": "$X–$Y or null",
  "urgency": "Monitor / Schedule service soon / Address immediately"
}`;

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!res.ok) return getAudioFallback(transcription);
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content || '';
    return JSON.parse(raw) as AudioAnalysisResult;
  } catch {
    return getAudioFallback(transcription);
  }
}

/**
 * Transcribe audio file using OpenAI Whisper API.
 */
export async function transcribeAudio(audioUri: string, apiKeyOverride?: string): Promise<string> {
  const apiKey = apiKeyOverride || getApiKey();
  if (!apiKey) throw new Error('No API key');

  // Read the file as base64 then create a blob for multipart upload
  const base64 = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Determine content type from URI extension
  const ext = audioUri.split('.').pop()?.toLowerCase() || 'm4a';
  const mimeMap: Record<string, string> = {
    m4a: 'audio/m4a',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'audio/mp4',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
  };
  const mimeType = mimeMap[ext] || 'audio/m4a';

  // Build FormData for multipart upload
  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    name: `recording.${ext}`,
    type: mimeType,
  } as any);
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');

  const res = await fetch(OPENAI_TRANSCRIPTION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) throw new Error(`Whisper API error: ${res.status}`);
  const json = await res.json();
  return json.text || '';
}

function getAudioFallback(transcription: string): AudioAnalysisResult {
  return {
    transcription,
    severity: 'info',
    recommended_actions: ['Visit a trusted mechanic for an in-person diagnosis.'],
    urgency: 'Schedule a service appointment when convenient.',
  };
}
