// =================== THK MAP PROXY (Cloudflare Worker) ===================
// Proxies Google Maps Tile API and GISTDA tile requests.
// API keys are stored as Cloudflare secrets — never exposed to the browser.
//
// Endpoints:
//   GET /google/session?mapType=satellite|roadmap  → creates Google session token
//   GET /google/tiles/{z}/{x}/{y}?session=TOKEN    → proxies Google tiles
//   GET /gistda/tiles/{z}/{x}/{y}                  → proxies GISTDA tiles

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- CORS ---
    const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
    const origin = request.headers.get('Origin') || '';
    const isAllowed = allowedOrigins.includes(origin) || origin === '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(isAllowed ? origin : allowedOrigins[0])
      });
    }

    try {
      let response;

      // --- Google Maps Session ---
      if (path === '/google/session') {
        response = await handleGoogleSession(url, env);
      }
      // --- Google Maps Tiles ---
      else if (path.startsWith('/google/tiles/')) {
        response = await handleGoogleTiles(path, url, env);
      }
      // --- GISTDA Tiles ---
      else if (path.startsWith('/gistda/tiles/')) {
        response = await handleGistdaTiles(path, env);
      }
      // --- Health Check ---
      else if (path === '/health') {
        response = new Response(JSON.stringify({ status: 'ok', time: new Date().toISOString() }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      // --- 404 ---
      else {
        response = new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Attach CORS headers to all responses
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders(isAllowed ? origin : allowedOrigins[0])).forEach(([k, v]) => {
        newHeaders.set(k, v);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
      });
    }
  }
};

// --- CORS Headers ---
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

// --- Google Maps Session Token ---
async function handleGoogleSession(url, env) {
  const apiKey = env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Google Maps API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const mapType = url.searchParams.get('mapType') || 'satellite';

  const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mapType: mapType,
      language: 'th',
      region: 'TH'
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    return new Response(JSON.stringify({ error: `Google API error: ${res.status}`, details: errText }), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const data = await res.json();
  return new Response(JSON.stringify({ session: data.session }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

// --- Google Maps Tile Proxy ---
async function handleGoogleTiles(path, url, env) {
  const apiKey = env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return new Response('API key not configured', { status: 500 });
  }

  // Path format: /google/tiles/{z}/{x}/{y}
  const match = path.match(/^\/google\/tiles\/(\d+)\/(\d+)\/(\d+)$/);
  if (!match) {
    return new Response('Invalid tile path', { status: 400 });
  }

  const [, z, x, y] = match;
  const session = url.searchParams.get('session');
  if (!session) {
    return new Response('Missing session parameter', { status: 400 });
  }

  const tileUrl = `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${session}&key=${apiKey}`;
  
  const tileRes = await fetch(tileUrl);
  
  const headers = new Headers(tileRes.headers);
  headers.set('Cache-Control', 'public, max-age=86400'); // Cache tiles for 24h at edge
  
  return new Response(tileRes.body, {
    status: tileRes.status,
    headers
  });
}

// --- GISTDA Tile Proxy ---
async function handleGistdaTiles(path, env) {
  const apiKey = env.GISTDA_API_KEY;
  if (!apiKey) {
    return new Response('GISTDA API key not configured', { status: 500 });
  }

  // Path format: /gistda/tiles/{z}/{x}/{y}
  const match = path.match(/^\/gistda\/tiles\/(\d+)\/(\d+)\/(\d+)$/);
  if (!match) {
    return new Response('Invalid tile path', { status: 400 });
  }

  const [, z, x, y] = match;
  const tileUrl = `https://basemap.sphere.gistda.or.th/tiles/thailand_images/EPSG3857/${z}/${x}/${y}.jpeg?key=${apiKey}`;
  
  const tileRes = await fetch(tileUrl);
  
  const headers = new Headers(tileRes.headers);
  headers.set('Cache-Control', 'public, max-age=86400');
  
  return new Response(tileRes.body, {
    status: tileRes.status,
    headers
  });
}
