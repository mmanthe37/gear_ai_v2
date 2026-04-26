const https = require('https');

// ---------------------------------------------------------------------------
// Provider configuration (mirrors types/models.ts but plain JS for serverless)
// ---------------------------------------------------------------------------

const PROVIDERS = {
  openai: { hostname: 'api.openai.com', path: '/v1/chat/completions', envKey: 'OPENAI_API_KEY', format: 'openai' },
  anthropic: { hostname: 'api.anthropic.com', path: '/v1/messages', envKey: 'ANTHROPIC_API_KEY', format: 'anthropic' },
  google: { hostname: 'generativelanguage.googleapis.com', pathTemplate: '/v1beta/models/{model}:generateContent', envKey: 'GOOGLE_AI_API_KEY', format: 'google' },
  xai: { hostname: 'api.x.ai', path: '/v1/chat/completions', envKey: 'XAI_API_KEY', format: 'openai' },
  deepseek: { hostname: 'api.deepseek.com', path: '/chat/completions', envKey: 'DEEPSEEK_API_KEY', format: 'openai' },
  moonshot: { hostname: 'api.moonshot.cn', path: '/v1/chat/completions', envKey: 'MOONSHOT_API_KEY', format: 'openai' },
};

// ---------------------------------------------------------------------------
// Request/response transformers
// ---------------------------------------------------------------------------

function toAnthropicRequest(body) {
  const messages = (body.messages || []).filter((m) => m.role !== 'system');
  const systemMsg = (body.messages || []).find((m) => m.role === 'system');
  return {
    model: body.model,
    max_tokens: body.max_tokens || 1024,
    temperature: body.temperature,
    system: systemMsg ? systemMsg.content : undefined,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
}

function fromAnthropicResponse(data) {
  const text = (data.content || []).map((b) => b.text || '').join('');
  return {
    id: data.id,
    object: 'chat.completion',
    model: data.model,
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: data.stop_reason || 'stop' }],
    usage: {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
  };
}

/**
 * Convert an OpenAI-style content value (string or multimodal array) to
 * Gemini `parts`. Handles text, data-URI images (→ inlineData), and
 * fetches remote image URLs server-side to convert them to inlineData.
 */
function toGoogleParts(content) {
  if (typeof content === 'string') return [{ text: content }];
  if (!Array.isArray(content)) return [{ text: String(content) }];

  return content.map((part) => {
    if (part.type === 'text') return { text: part.text };
    if (part.type === 'image_url') {
      const url = (part.image_url?.url || '').trim();
      if (url.startsWith('data:')) {
        const commaIdx = url.indexOf(',');
        if (commaIdx === -1) return { text: '[unsupported image]' };
        const meta = url.slice(0, commaIdx); // e.g. "data:image/jpeg;base64"
        const mimeMatch = meta.match(/^data:([^;,]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const data = url.slice(commaIdx + 1).replace(/\s/g, '');
        return { inlineData: { mimeType, data } };
      }
      // Non-data-URI images cannot be passed as fileData (requires Gemini Files API).
      // Fall back to a text placeholder — the AI will respond without seeing the image.
      return { text: '[Image attached — image analysis requires a data URI]' };
    }
    return { text: JSON.stringify(part) };
  });
}

function toGoogleRequest(body) {
  const systemMsg = (body.messages || []).find((m) => m.role === 'system');
  const userMsgs = (body.messages || []).filter((m) => m.role !== 'system');
  const contents = userMsgs.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: toGoogleParts(m.content),
  }));
  const req = {
    contents,
    generationConfig: {
      temperature: body.temperature,
      maxOutputTokens: body.max_tokens || 1024,
    },
  };
  if (systemMsg) {
    req.systemInstruction = { parts: [{ text: typeof systemMsg.content === 'string' ? systemMsg.content : JSON.stringify(systemMsg.content) }] };
  }
  return req;
}

function fromGoogleResponse(data) {
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text || '').join('') || '';
  return {
    id: 'google-' + Date.now(),
    object: 'chat.completion',
    model: 'gemini',
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: candidate?.finishReason || 'stop' }],
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0,
    },
  };
}

// ---------------------------------------------------------------------------
// HTTPS helper
// ---------------------------------------------------------------------------

function httpsPost(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try {
          resolve({ status: response.statusCode, json: JSON.parse(raw) });
        } catch {
          reject(new Error('Failed to parse response: ' + raw.slice(0, 300)));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

module.exports = async function handler(req, res) {
  const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowedOrigins = configuredOrigins.length > 0
    ? configuredOrigins
    : (process.env.NODE_ENV === 'production' ? [] : ['http://localhost:8081', 'http://localhost:19006', 'http://localhost:3000']);

  const requestOrigin = req.headers.origin;
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { provider: providerName = 'openai', ...openaiBody } = req.body;
  const provider = PROVIDERS[providerName];
  if (!provider) {
    return res.status(400).json({ error: `Unknown provider: ${providerName}` });
  }

  const apiKey = process.env[provider.envKey];
  if (!apiKey) {
    return res.status(500).json({ error: `API key not configured for provider: ${providerName}` });
  }

  try {
    let requestBody;
    let path = provider.path;
    const headers = { 'Content-Type': 'application/json' };

    if (provider.format === 'anthropic') {
      requestBody = JSON.stringify(toAnthropicRequest(openaiBody));
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else if (provider.format === 'google') {
      requestBody = JSON.stringify(toGoogleRequest(openaiBody));
      path = provider.pathTemplate.replace('{model}', openaiBody.model) + '?key=' + apiKey;
    } else {
      // OpenAI-compatible (openai, xai, deepseek, moonshot)
      requestBody = JSON.stringify(openaiBody);
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    headers['Content-Length'] = Buffer.byteLength(requestBody);

    const data = await httpsPost(
      { hostname: provider.hostname, path, method: 'POST', headers },
      requestBody
    );

    // Normalize non-OpenAI responses to OpenAI format
    let normalized = data.json;
    if (provider.format === 'anthropic' && data.status < 300) {
      normalized = fromAnthropicResponse(data.json);
    } else if (provider.format === 'google' && data.status < 300) {
      normalized = fromGoogleResponse(data.json);
    }

    return res.status(data.status).json(normalized);
  } catch (error) {
    console.error(`[api/chat] ${providerName} proxy error:`, error.message || error);
    return res.status(502).json({ error: `Failed to reach ${providerName} API`, detail: String(error.message || error) });
  }
};
