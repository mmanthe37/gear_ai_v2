import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

function callOpenAI(apiKey: string, body: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(OPENAI_CHAT_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString();
          const data = JSON.parse(raw);
          resolve({ status: response.statusCode || 500, data });
        } catch (err) {
          reject(new Error('Failed to parse OpenAI response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured on server' });
  }

  try {
    const body = JSON.stringify(req.body);
    const { status, data } = await callOpenAI(apiKey, body);
    return res.status(status).json(data);
  } catch (error: any) {
    console.error('[api/chat] OpenAI proxy error:', error?.message || error);
    return res.status(502).json({ error: 'Failed to reach OpenAI API', detail: error?.message });
  }
}
