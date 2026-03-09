const https = require('https');

module.exports = async function handler(req, res) {
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
    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const request = https.request(options, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          try {
            resolve({ status: response.statusCode, json: JSON.parse(raw) });
          } catch {
            reject(new Error('Failed to parse OpenAI response: ' + raw.slice(0, 200)));
          }
        });
      });

      request.on('error', reject);
      request.write(body);
      request.end();
    });

    return res.status(data.status).json(data.json);
  } catch (error) {
    console.error('[api/chat] Proxy error:', error.message || error);
    return res.status(502).json({ error: 'Failed to reach OpenAI API', detail: String(error.message || error) });
  }
};
