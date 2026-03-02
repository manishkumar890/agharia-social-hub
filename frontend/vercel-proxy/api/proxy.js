// Vercel Serverless Function — Supabase Reverse Proxy
// Bypasses ISP blocking of supabase.co domains (e.g., Jio in India)

const SUPABASE_URL = 'https://rtkcegudtndzxcqkukew.supabase.co';

module.exports = async (req, res) => {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 
    'authorization, x-client-info, apikey, content-type, accept, range, prefer, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
  );
  res.setHeader('Access-Control-Expose-Headers', 'content-range, x-supabase-api-version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract the path after /api/proxy
    // req.url will be like /api/proxy/rest/v1/profiles or /api/proxy/auth/v1/token
    const path = req.url.replace(/^\/api\/proxy/, '');
    const targetUrl = `${SUPABASE_URL}${path}`;

    // Forward headers (exclude host and connection-specific headers)
    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (
        lower !== 'host' &&
        lower !== 'connection' &&
        lower !== 'transfer-encoding' &&
        lower !== 'keep-alive' &&
        !lower.startsWith('x-vercel') &&
        !lower.startsWith('x-forwarded')
      ) {
        forwardHeaders[key] = value;
      }
    }

    // Read body for non-GET requests
    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      if (chunks.length > 0) {
        body = Buffer.concat(chunks);
      }
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: body,
    });

    // Forward response headers
    for (const [key, value] of response.headers.entries()) {
      const lower = key.toLowerCase();
      if (lower !== 'transfer-encoding' && lower !== 'connection') {
        res.setHeader(key, value);
      }
    }

    // Ensure CORS headers are on the response
    res.setHeader('Access-Control-Allow-Origin', '*');

    const responseBody = await response.arrayBuffer();
    res.status(response.status).send(Buffer.from(responseBody));
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ error: 'Proxy request failed', details: error.message });
  }
};
