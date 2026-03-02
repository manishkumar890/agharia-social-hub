/**
 * Polyfills and compatibility shims for older Android WebViews,
 * Samsung Internet, Opera Mobile, Firefox Mobile, and Edge Mobile.
 */

// 1. AbortController polyfill for older browsers
if (typeof AbortController === 'undefined') {
  (window as any).AbortController = class AbortController {
    signal: any;
    constructor() {
      this.signal = { aborted: false, addEventListener: function() {}, removeEventListener: function() {} };
    }
    abort() {
      this.signal.aborted = true;
    }
  };
}

// 2. Safe storage wrapper — some WebViews block localStorage entirely
export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      try { return sessionStorage.getItem(key); } catch { return null; }
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      try { sessionStorage.setItem(key, value); } catch { /* silently fail */ }
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      try { sessionStorage.removeItem(key); } catch { /* silently fail */ }
    }
  },
};

// 3. String.prototype.normalize polyfill guard
export const safeNormalize = (str: string, form?: string): string => {
  try {
    return str.normalize(form as any);
  } catch {
    return str;
  }
};

// 4. Robust fetch wrapper with XMLHttpRequest fallback
export const compatFetch = (
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
  }
): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<any> }> => {
  const { method = 'GET', headers = {}, body, signal, timeoutMs = 25000 } = options;

  // Try native fetch first
  if (typeof fetch === 'function') {
    const controller = new AbortController();
    const timeoutId = setTimeout(function() { controller.abort(); }, timeoutMs);

    const fetchSignal = signal || controller.signal;

    return fetch(url, {
      method: method,
      headers: headers,
      body: body,
      signal: fetchSignal,
      cache: 'no-store' as RequestCache,
    })
      .then(function(response) {
        clearTimeout(timeoutId);
        return response;
      })
      .catch(function(err) {
        clearTimeout(timeoutId);
        // If fetch fails entirely (e.g. old WebView with partial fetch support), fall back to XHR
        if (
          err.name === 'TypeError' ||
          (err.message && err.message.toLowerCase().indexOf('failed to fetch') >= 0)
        ) {
          return xhrFallback(url, method, headers, body, timeoutMs);
        }
        throw err;
      });
  }

  // Full XHR fallback for browsers without fetch
  return xhrFallback(url, method, headers, body, timeoutMs);
};

function xhrFallback(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
  timeoutMs = 25000
): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<any> }> {
  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.timeout = timeoutMs;

    var headerKeys = Object.keys(headers);
    for (var i = 0; i < headerKeys.length; i++) {
      try {
        xhr.setRequestHeader(headerKeys[i], headers[headerKeys[i]]);
      } catch (e) {
        // Some headers may be restricted; skip them
        console.warn('Skipping restricted header:', headerKeys[i]);
      }
    }

    xhr.onload = function() {
      var responseText = xhr.responseText || '';
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        text: function() { return Promise.resolve(responseText); },
        json: function() {
          try {
            return Promise.resolve(JSON.parse(responseText));
          } catch (e) {
            return Promise.reject(new Error('Invalid JSON response'));
          }
        },
      });
    };

    xhr.onerror = function() {
      reject(new Error('Network request failed (XHR fallback)'));
    };

    xhr.ontimeout = function() {
      reject(new Error('Request timed out'));
    };

    xhr.send(body || null);
  });
}

// 5. URLSearchParams polyfill guard
if (typeof URLSearchParams === 'undefined') {
  (window as any).URLSearchParams = class URLSearchParams {
    private params: Record<string, string> = {};
    constructor(init?: Record<string, string> | string) {
      if (typeof init === 'string') {
        var pairs = init.replace(/^\?/, '').split('&');
        for (var i = 0; i < pairs.length; i++) {
          var parts = pairs[i].split('=');
          if (parts[0]) this.params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
        }
      } else if (init) {
        var keys = Object.keys(init);
        for (var j = 0; j < keys.length; j++) {
          this.params[keys[j]] = init[keys[j]];
        }
      }
    }
    toString() {
      var keys = Object.keys(this.params);
      var parts: string[] = [];
      for (var i = 0; i < keys.length; i++) {
        parts.push(encodeURIComponent(keys[i]) + '=' + encodeURIComponent(this.params[keys[i]]));
      }
      return parts.join('&');
    }
  };
}

// 6. Promise.allSettled polyfill for older engines
if (typeof Promise.allSettled === 'undefined') {
  (Promise as any).allSettled = function(promises: Promise<any>[]) {
    return Promise.all(
      promises.map(function(p) {
        return p
          .then(function(value: any) { return { status: 'fulfilled', value: value }; })
          .catch(function(reason: any) { return { status: 'rejected', reason: reason }; });
      })
    );
  };
}

// 7. globalThis polyfill
if (typeof globalThis === 'undefined') {
  (window as any).globalThis = window;
}

// 8. In-memory response cache for proxy requests (reduces Jio latency)
const _responseCache = new Map<string, { data: string; status: number; headers: Record<string, string>; ts: number }>();
const CACHE_TTL_MS = 30_000; // 30s cache for GET requests
const MAX_CACHE_SIZE = 50;

function getCacheKey(url: string, init?: RequestInit): string | null {
  const method = (init?.method || 'GET').toUpperCase();
  if (method !== 'GET') return null;
  // Only cache REST API calls, not auth
  if (url.includes('/auth/')) return null;
  // Include Authorization header in cache key for user-specific data
  const authHeader = (init?.headers as Record<string, string>)?.['Authorization'] ||
    (init?.headers as Record<string, string>)?.['authorization'] || '';
  return url + '|' + authHeader.slice(-20);
}

function pruneCache() {
  if (_responseCache.size <= MAX_CACHE_SIZE) return;
  const entries = Array.from(_responseCache.entries());
  entries.sort((a, b) => a[1].ts - b[1].ts);
  const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
  for (const [key] of toRemove) _responseCache.delete(key);
}

function makeCachedResponse(cached: { data: string; status: number; headers: Record<string, string> }): Response {
  return new Response(cached.data, {
    status: cached.status,
    headers: cached.headers,
  });
}

// 9. Supabase proxy interceptor — routes API calls through Vercel proxy
// to bypass ISP blocking of supabase.co domains (e.g., Jio in India)
const isLovablePreview = window.location.hostname.endsWith('.lovable.app') || window.location.hostname === 'localhost';

if (!isLovablePreview) {
  const SUPABASE_ORIGIN = 'https://rtkcegudtndzxcqkukew.supabase.co';
  const PROXY_ORIGIN = 'https://supabase-proxy-theta.vercel.app/api/proxy';

  const _originalFetch = window.fetch.bind(window);
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let url: string;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input instanceof Request) {
      url = input.url;
    } else {
      return _originalFetch(input, init);
    }

    if (url.startsWith(SUPABASE_ORIGIN)) {
      const path = url.substring(SUPABASE_ORIGIN.length);
      const proxiedUrl = PROXY_ORIGIN + path;

      // Check in-memory cache first (instant, no network)
      const cacheKey = getCacheKey(url, init);
      if (cacheKey) {
        const cached = _responseCache.get(cacheKey);
        if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
          return Promise.resolve(makeCachedResponse(cached));
        }
      }

      const doProxyFetch = () => {
        if (input instanceof Request) {
          const newRequest = new Request(proxiedUrl, input);
          return _originalFetch(newRequest, init);
        }
        return _originalFetch(proxiedUrl, init);
      };

      return doProxyFetch()
        .then(function(response: Response) {
          // Cache successful GET responses
          if (cacheKey && response.ok) {
            const cloned = response.clone();
            cloned.text().then(function(text) {
              const hdrs: Record<string, string> = {};
              response.headers.forEach(function(v, k) { hdrs[k] = v; });
              _responseCache.set(cacheKey, { data: text, status: response.status, headers: hdrs, ts: Date.now() });
              pruneCache();
            });
          }
          return response;
        })
        .catch(function(err: any) {
          if (
            err.name === 'TypeError' ||
            (err.message && (
              err.message.indexOf('Failed to fetch') >= 0 ||
              err.message.indexOf('NetworkError') >= 0 ||
              err.message.indexOf('ERR_NAME_NOT_RESOLVED') >= 0
            ))
          ) {
            console.warn('[Compat] Proxy failed, falling back to direct:', err.message);
            return _originalFetch(input, init);
          }
          throw err;
        });
    }

    return _originalFetch(input, init);
  };
  console.log('[Compat] Supabase proxy ENABLED with response cache.');
} else {
  console.log('[Compat] Supabase proxy SKIPPED (Lovable preview).');
}

// Export cache invalidator for mutations
export function invalidateProxyCache() {
  _responseCache.clear();
}

console.log('[Compat] Polyfills loaded. UA:', navigator.userAgent);
