module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const report = req.body?.['csp-report'] || req.body;
    console.warn('[CSP Violation]', JSON.stringify(report));
  } catch (err) {
    // Non-fatal — log parsing failures but still acknowledge receipt
    console.error('[CSP Report] Failed to parse body:', err.message);
  }

  // Respond 204 No Content — browsers do not use the response body
  return res.status(204).end();
};
