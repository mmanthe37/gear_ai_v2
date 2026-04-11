/**
 * Gear AI CoPilot — Server-side Manual Lookup API
 *
 * Vercel serverless function that handles heavy manual discovery operations
 * (web scraping, AI research) server-side to avoid exposing API keys
 * and to bypass CORS restrictions that affect client-side fetches.
 *
 * POST /api/manual-lookup
 * Body: { year: number, make: string, model: string, vin?: string }
 * Response: { url: string | null, source: string, title: string, confidence: string }
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 25_000;
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const MIN_PDF_SIZE = 50 * 1024; // 50 KB

// SSRF protection: block private/reserved IP ranges
const BLOCKED_IP_PATTERNS = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^0\./, /^169\.254\./, /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./,
  /^::1$/, /^fe80:/i, /^fc00:/i, /^fd/i,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSafeUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '0.0.0.0') return false;
    if (host === '169.254.169.254') return false; // AWS metadata
    for (const pat of BLOCKED_IP_PATTERNS) {
      if (pat.test(host)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function fetchUrl(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    if (!isSafeUrl(urlStr)) {
      return reject(new Error('Blocked: unsafe URL'));
    }
    const parsed = new URL(urlStr);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(urlStr, {
      method: options.method || 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GearAI/1.0)',
        ...options.headers,
      },
      timeout: REQUEST_TIMEOUT_MS,
    }, (res) => {
      if (options.method === 'HEAD') {
        resolve({ status: res.statusCode, headers: res.headers });
        res.resume();
      } else {
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size < 1024 * 1024) chunks.push(chunk); // cap at 1MB for parsing
        });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      }
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function verifyPdf(urlStr) {
  try {
    const res = await fetchUrl(urlStr, { method: 'GET', headers: { Range: 'bytes=0-4' } });
    if (res.status >= 400) return false;

    // Check content-type
    const ct = (res.headers['content-type'] || '').toLowerCase();
    if (ct.includes('application/pdf')) return true;

    // Check magic bytes
    if (res.body && res.body.length >= 4) {
      return res.body.slice(0, 4).equals(PDF_MAGIC_BYTES);
    }

    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// OEM URL Patterns (subset for server-side quick lookup)
// ---------------------------------------------------------------------------

function generateOemUrls(year, make, model) {
  const m = make.toLowerCase().trim();
  const modelSlug = model.toLowerCase().replace(/\s+/g, '-');
  const modelUnderscore = model.toLowerCase().replace(/\s+/g, '_');
  const modelEncoded = encodeURIComponent(model);

  const candidates = [];

  // GM brands
  if (['chevrolet', 'gmc', 'buick', 'cadillac'].includes(m)) {
    candidates.push(
      `https://my.${m}.com/content/dam/gmownercenter/gmna/dynamic/manuals/${year}/${modelEncoded}/en_US/eOwnerManual.pdf`,
      `https://my.${m}.com/content/dam/gmownercenter/gmna/dynamic/manuals/${year}/${modelSlug}/en_US/eOwnerManual.pdf`
    );
  }

  // Ford/Lincoln
  if (['ford', 'lincoln'].includes(m)) {
    const brand = m.charAt(0).toUpperCase() + m.slice(1);
    candidates.push(
      `https://www.fordservicecontent.com/Ford_Content/Catalog/owner_information/${year}-${brand}-${modelEncoded}-Owners-Manual.pdf`,
      `https://www.fordservicecontent.com/Ford_Content/Catalog/owner_information/${year}-${brand}-${modelSlug}-Owners-Manual.pdf`
    );
  }

  // Toyota/Lexus
  if (m === 'toyota') {
    candidates.push(`https://www.toyota.com/t3Portal/document/om-s/${String(year).slice(-2)}/pdf/en/OM.pdf`);
  }

  // Honda/Acura
  if (m === 'honda') {
    candidates.push(`https://techinfo.honda.com/rNavigator/document.aspx?DocumentID=${year}_${modelEncoded}_OM`);
  }

  // Hyundai
  if (m === 'hyundai') {
    candidates.push(
      `https://owners.hyundaiusa.com/content/dam/hyundaiusa/owners_content/${year}/${modelUnderscore}/owners_manual.pdf`
    );
  }

  // Kia
  if (m === 'kia') {
    candidates.push(
      `https://www.kia.com/dam/kia/us/owner/pdf/${year}/${modelSlug}/owners-manual.pdf`
    );
  }

  // Nissan/Infiniti
  if (m === 'nissan') {
    candidates.push(
      `https://owners.nissanusa.com/content/techpub/ManualsAndGuides/${year}/${modelEncoded}/Owner_Manual_English.pdf`
    );
  }

  // Subaru
  if (m === 'subaru') {
    candidates.push(
      `https://cdn.subarunet.com/stis/doc/ownerManual/${year}_${modelSlug}_om.pdf`
    );
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// AI URL suggestion (server-side — keeps API key off the client)
// ---------------------------------------------------------------------------

async function aiSuggestUrl(year, make, model) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetchUrl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    // Use the full POST approach with body
    return new Promise((resolve) => {
      const body = JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a vehicle owner\'s manual expert. Return ONLY a JSON object with a direct PDF download URL. Be precise.',
          },
          {
            role: 'user',
            content: `Find the direct PDF download URL for the ${year} ${make} ${model} owner's manual. Must be publicly accessible (no login). Prefer official manufacturer sites. Respond ONLY with JSON: {"url": "https://...", "confidence": "high|medium|low"} or {"url": null}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 200,
        temperature: 0,
      });

      const parsed = new URL('https://api.openai.com/v1/chat/completions');
      const req = https.request({
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: REQUEST_TIMEOUT_MS,
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString());
            const content = JSON.parse(json.choices?.[0]?.message?.content || '{}');
            if (content.url && typeof content.url === 'string' && content.url.startsWith('https://')) {
              resolve({ url: content.url, confidence: content.confidence || 'medium' });
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(body);
      req.end();
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { year, make, model, vin } = req.body || {};

  if (!year || !make || !model) {
    return res.status(400).json({ error: 'Missing required fields: year, make, model' });
  }

  const startTime = Date.now();

  try {
    // Strategy 1: OEM direct URL patterns
    const oemCandidates = generateOemUrls(year, make, model);
    for (const url of oemCandidates) {
      try {
        const isValid = await verifyPdf(url);
        if (isValid) {
          return res.status(200).json({
            url,
            source: 'oem_direct',
            title: `${year} ${make} ${model} Owner's Manual`,
            confidence: 'high',
            timeMs: Date.now() - startTime,
          });
        }
      } catch {
        // Try next candidate
      }
    }

    // Strategy 2: AI suggestion (server-side, API key stays private)
    const aiResult = await aiSuggestUrl(year, make, model);
    if (aiResult?.url) {
      if (isSafeUrl(aiResult.url)) {
        const isValid = await verifyPdf(aiResult.url);
        if (isValid) {
          return res.status(200).json({
            url: aiResult.url,
            source: 'ai_research',
            title: `${year} ${make} ${model} Owner's Manual`,
            confidence: aiResult.confidence || 'medium',
            timeMs: Date.now() - startTime,
          });
        }
      }
    }

    // No result found
    return res.status(200).json({
      url: null,
      source: 'none',
      title: `${year} ${make} ${model} Owner's Manual`,
      confidence: 'none',
      timeMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('[manual-lookup] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
