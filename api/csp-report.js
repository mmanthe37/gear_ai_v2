// Disable Vercel's default body parser so we can handle the
// application/csp-report content-type that browsers send for CSP reports.
module.exports.config = { api: { bodyParser: false } };

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    try {
      const raw = Buffer.concat(chunks).toString('utf8');
      const report = raw ? JSON.parse(raw) : {};
      console.warn('[CSP Violation]', JSON.stringify(report?.['csp-report'] || report));
    } catch (err) {
      // Non-fatal — log parsing failures but still acknowledge receipt
      console.error('[CSP Report] Failed to parse body:', err.message);
    }
    // Respond 204 No Content — browsers do not use the response body
    return res.status(204).end();
  });
  req.on('error', () => res.status(400).end());
};
