import dns from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);
const DEFAULT_PROXY_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const FALLBACK_PROXY_USER_AGENT = 'OpenAI/v1';
const DEFAULT_PROXY_ACCEPT = 'application/json, text/event-stream';
const ALLOWED_RESPONSE_HEADERS = new Set([
  'cache-control',
  'content-disposition',
  'content-type',
  'retry-after',
  'x-request-id',
]);
const MAX_REDIRECT_HOPS = 3;
const PROXY_TIMEOUT_MS = 300_000;

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    nums.push(n);
  }
  return nums;
}

function isBlockedIpv4(ip: string): boolean {
  const octets = parseIpv4(ip);
  if (!octets) return true;
  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local & cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && octets[2] === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && octets[2] === 2) return true; // 192.0.2.0/24
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a >= 224) return true; // multicast & reserved
  return false;
}

function extractMappedIpv4FromIpv6(ip: string): string | null {
  const lower = ip.toLowerCase();
  const dotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(lower);
  if (dotted?.[1]) return dotted[1];
  const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16);
    const lo = parseInt(hexMapped[2], 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  return null;
}

function isBlockedIpAddress(rawIp: string): boolean {
  const ip = rawIp.trim().replace(/^\[|\]$/g, '').split('%')[0];
  const family = net.isIP(ip);
  if (family === 4) {
    return isBlockedIpv4(ip);
  }
  if (family === 6) {
    const mappedV4 = extractMappedIpv4FromIpv6(ip);
    if (mappedV4) {
      return isBlockedIpv4(mappedV4);
    }
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1' || /^0+:0+:0+:0+:0+:0+:0+:[01]$/.test(lower)) {
      return true;
    }
    // Unique local fc00::/7, link-local fe80::/10, multicast ff00::/8
    if (/^(fc|fd|fe[89ab]|ff)/i.test(lower)) {
      return true;
    }
    return false;
  }
  return true;
}

function isBlockedHostname(rawHost: string): boolean {
  const host = rawHost.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata' ||
    host === 'metadata.google.internal'
  ) {
    return true;
  }
  return false;
}

async function validateProxyTargetUrl(rawUrl: string): Promise<{
  ok: true;
  url: URL;
} | {
  ok: false;
  status: number;
  message: string;
}> {
  if (typeof rawUrl !== 'string' || !rawUrl.trim() || rawUrl.length > 4096) {
    return { ok: false, status: 400, message: 'targetUrl không hợp lệ.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, status: 400, message: 'Định dạng URL đích không hợp lệ.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      status: 400,
      message: 'Chỉ hỗ trợ giao thức http:// hoặc https://.',
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      status: 400,
      message: 'Không hỗ trợ thông tin đăng nhập nhúng trực tiếp trong URL.',
    };
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isBlockedHostname(hostname)) {
    return {
      ok: false,
      status: 403,
      message: 'Server Proxy không chuyển tiếp tới địa chỉ nội bộ hoặc localhost.',
    };
  }

  if (net.isIP(hostname) !== 0) {
    if (isBlockedIpAddress(hostname)) {
      return {
        ok: false,
        status: 403,
        message: 'Server Proxy chặn chuyển tiếp tới dải IP nội bộ/riêng tư.',
      };
    }
    return { ok: true, url: parsed };
  }

  try {
    const resolved = await dns.lookup(hostname, { all: true });
    if (!resolved.length) {
      return {
        ok: false,
        status: 502,
        message: `Không phân giải được DNS cho tên miền ${hostname}.`,
      };
    }
    for (const record of resolved) {
      if (isBlockedIpAddress(record.address)) {
        return {
          ok: false,
          status: 403,
          message: 'Tên miền đích trỏ tới địa chỉ IP nội bộ không được phép.',
        };
      }
    }
  } catch {
    return {
      ok: false,
      status: 502,
      message: `Không thể phân giải DNS cho tên miền ${hostname}.`,
    };
  }

  return { ok: true, url: parsed };
}

function isSameOriginProxyRequest(req: Request): boolean {
  const originHeader = req.headers.origin;
  if (!originHeader) return true;
  try {
    const originHost = new URL(originHeader).host.toLowerCase();
    const rawForwarded = req.headers['x-forwarded-host'];
    const forwardedHost = (Array.isArray(rawForwarded) ? rawForwarded[0] : rawForwarded || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    const directHost = String(req.headers.host || '').trim().toLowerCase();
    return Boolean(
      (forwardedHost && originHost === forwardedHost) ||
        (directHost && originHost === directHost),
    );
  } catch {
    return false;
  }
}

function isGeminiNativeTargetUrl(rawUrl: string): boolean {
  if (/\/openai(\/|$)/i.test(rawUrl)) return false;
  return (
    /generativelanguage\.googleapis\.com/i.test(rawUrl) ||
    /:(generateContent|streamGenerateContent)/i.test(rawUrl)
  );
}

const BLOCKED_PROXY_REQUEST_HEADERS = new Set([
  'host',
  'origin',
  'referer',
  'cookie',
  'set-cookie',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
  'forwarded',
  'content-length',
  'x-real-ip',
  'x-requested-with',
  'user-agent',
  'accept',
  'content-type',
  'authorization',
  'x-goog-api-key',
  'x-api-key',
  'anthropic-version',
]);

function isBlockedProxyRequestHeader(lowerKey: string): boolean {
  if (BLOCKED_PROXY_REQUEST_HEADERS.has(lowerKey)) return true;
  if (
    lowerKey.startsWith('sec-') ||
    lowerKey.startsWith('cf-') ||
    lowerKey.startsWith('x-forwarded-') ||
    lowerKey.startsWith('proxy-')
  ) {
    return true;
  }
  return false;
}

/**
 * Strictly constructs a clean outbound header object for upstream API calls.
 * Never forwards browser-identifying or reverse-proxy headers (Origin, Referer,
 * Host, Cookie, Sec-Fetch-*, CF-*, X-Forwarded-*, etc.) that trigger Nginx/WAF 403 blocks.
 */
function buildCleanUpstreamHeaders(options: {
  rawHeaders: unknown;
  targetUrl: string;
  method: string;
  hasBody: boolean;
  userAgent?: string;
}): Record<string, string> {
  const { rawHeaders, targetUrl, method, hasBody, userAgent } = options;
  const inputMap = new Map<string, { originalKey: string; value: string }>();

  if (rawHeaders && typeof rawHeaders === 'object' && !Array.isArray(rawHeaders)) {
    for (const [key, value] of Object.entries(rawHeaders as Record<string, unknown>)) {
      if (typeof value !== 'string') continue;
      if (/[\r\n]/.test(value)) continue;
      const trimmedKey = key.trim();
      const lowerKey = trimmedKey.toLowerCase();
      const trimmedVal = value.trim();
      if (!lowerKey || !trimmedVal) continue;
      if (!/^[a-z0-9-]+$/i.test(trimmedKey) || trimmedKey.length > 64) continue;
      inputMap.set(lowerKey, { originalKey: trimmedKey, value: trimmedVal });
    }
  }

  const clean: Record<string, string> = {
    Accept: inputMap.get('accept')?.value || DEFAULT_PROXY_ACCEPT,
    'User-Agent': userAgent || DEFAULT_PROXY_USER_AGENT,
  };

  const auth = inputMap.get('authorization')?.value;
  if (auth) {
    clean.Authorization = auth;
  }

  const isGeminiNative = isGeminiNativeTargetUrl(targetUrl);
  const googKey = inputMap.get('x-goog-api-key')?.value;
  if (googKey && (isGeminiNative || !auth)) {
    clean['x-goog-api-key'] = googKey;
  }

  const apiKeyHeader = inputMap.get('x-api-key')?.value;
  if (apiKeyHeader && (!auth || /anthropic\.com/i.test(targetUrl))) {
    clean['x-api-key'] = apiKeyHeader;
  }

  const anthropicVer = inputMap.get('anthropic-version')?.value;
  if (anthropicVer) {
    clean['anthropic-version'] = anthropicVer;
  }

  // Forward safe user-specified custom auth/endpoint headers (e.g. api-key, x-auth-token, xi-api-key)
  for (const [lowerKey, entry] of inputMap.entries()) {
    if (isBlockedProxyRequestHeader(lowerKey)) continue;
    clean[entry.originalKey] = entry.value;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    clean['Content-Type'] =
      inputMap.get('content-type')?.value || (hasBody ? 'application/json' : 'application/json');
  }

  return clean;
}

async function fetchWithValidatedRedirects(options: {
  initialUrl: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
  signal: AbortSignal;
}): Promise<globalThis.Response> {
  let currentUrl = options.initialUrl;
  let currentMethod = options.method;
  let currentBody = options.body;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    const check = await validateProxyTargetUrl(currentUrl);
    if (!check.ok) {
      const err = new Error(check.message) as Error & { statusCode?: number };
      err.statusCode = check.status;
      throw err;
    }

    const upstreamRes = await fetch(check.url.toString(), {
      method: currentMethod,
      headers: options.headers,
      body:
        currentMethod === 'GET' || currentMethod === 'HEAD'
          ? undefined
          : currentBody,
      redirect: 'manual',
      signal: options.signal,
    });

    const isRedirect =
      upstreamRes.status === 301 ||
      upstreamRes.status === 302 ||
      upstreamRes.status === 303 ||
      upstreamRes.status === 307 ||
      upstreamRes.status === 308;

    if (!isRedirect) {
      return upstreamRes;
    }

    const location = upstreamRes.headers.get('location');
    if (!location || hop === MAX_REDIRECT_HOPS) {
      return upstreamRes;
    }

    // Drain redirect body before following next hop
    await upstreamRes.body?.cancel().catch(() => {});
    currentUrl = new URL(location, check.url).toString();
    if (upstreamRes.status === 303) {
      currentMethod = 'GET';
      currentBody = undefined;
    }
  }

  throw new Error('Quá số lần chuyển hướng tối đa.');
}

async function handleApiProxy(req: Request, res: Response): Promise<void> {
  if (!isSameOriginProxyRequest(req)) {
    res.status(403).json({
      error: { message: 'Yêu cầu proxy không cùng nguồn gốc (Origin mismatch).' },
    });
    return;
  }

  const payload = req.body as
    | {
        targetUrl?: unknown;
        method?: unknown;
        headers?: unknown;
        body?: unknown;
      }
    | undefined;

  if (!payload || typeof payload !== 'object') {
    res.status(400).json({
      error: { message: 'Thiếu dữ liệu JSON cho /api/proxy.' },
    });
    return;
  }

  const targetUrl = typeof payload.targetUrl === 'string' ? payload.targetUrl.trim() : '';
  const method =
    typeof payload.method === 'string' && payload.method.trim()
      ? payload.method.trim().toUpperCase()
      : 'GET';

  if (!ALLOWED_METHODS.has(method)) {
    res.status(400).json({
      error: { message: `Phương thức HTTP không được hỗ trợ: ${method}` },
    });
    return;
  }

  let serializedBody: string | undefined;
  if (method !== 'GET' && method !== 'HEAD' && payload.body !== undefined && payload.body !== null) {
    serializedBody =
      typeof payload.body === 'string' ? payload.body : JSON.stringify(payload.body);
  }

  const forwardHeaders = buildCleanUpstreamHeaders({
    rawHeaders: payload.headers,
    targetUrl,
    method,
    hasBody: serializedBody !== undefined,
    userAgent: DEFAULT_PROXY_USER_AGENT,
  });

  const abortController = new AbortController();
  let timedOut = false;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, PROXY_TIMEOUT_MS);

  const onResponseClose = () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  };
  res.on('close', onResponseClose);

  try {
    let upstreamRes = await fetchWithValidatedRedirects({
      initialUrl: targetUrl,
      method,
      headers: forwardHeaders,
      body: serializedBody,
      signal: abortController.signal,
    });

    // If an upstream Nginx/Cloudflare WAF rejects the browser User-Agent with an HTML 403,
    // retry once with a minimal OpenAI SDK User-Agent before surfacing the 403 response.
    const initialContentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();
    if (upstreamRes.status === 403 && initialContentType.includes('text/html')) {
      await upstreamRes.body?.cancel().catch(() => {});
      const retryHeaders = buildCleanUpstreamHeaders({
        rawHeaders: payload.headers,
        targetUrl,
        method,
        hasBody: serializedBody !== undefined,
        userAgent: FALLBACK_PROXY_USER_AGENT,
      });
      upstreamRes = await fetchWithValidatedRedirects({
        initialUrl: targetUrl,
        method,
        headers: retryHeaders,
        body: serializedBody,
        signal: abortController.signal,
      });
    }

    res.status(upstreamRes.status);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    upstreamRes.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (ALLOWED_RESPONSE_HEADERS.has(lower)) {
        res.setHeader(key, value);
      }
    });

    const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/event-stream')) {
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
    } else if (!res.getHeader('Cache-Control')) {
      res.setHeader('Cache-Control', 'no-store');
    }

    res.flushHeaders();

    if (!upstreamRes.body || method === 'HEAD') {
      res.end();
      return;
    }

    const reader = upstreamRes.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (res.writableEnded || res.destroyed) {
          await reader.cancel().catch(() => {});
          break;
        }
        if (value && value.byteLength > 0) {
          const canContinue = res.write(Buffer.from(value));
          if (!canContinue) {
            await new Promise<void>((resolve) => {
              res.once('drain', resolve);
              res.once('close', resolve);
            });
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!res.writableEnded) {
      res.end();
    }
  } catch (err) {
    if (res.headersSent) {
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    if (timedOut) {
      res.status(504).json({
        error: { message: 'Server Proxy quá thời gian chờ phản hồi từ máy chủ đích.' },
      });
      return;
    }

    if (abortController.signal.aborted) {
      res.status(499).end();
      return;
    }

    const customStatus =
      err && typeof err === 'object' && 'statusCode' in err
        ? Number((err as { statusCode?: unknown }).statusCode)
        : 502;
    const status =
      Number.isInteger(customStatus) && customStatus >= 400 && customStatus < 600
        ? customStatus
        : 502;
    const message =
      err instanceof Error && err.message
        ? err.message
        : 'Không thể kết nối tới máy chủ đích qua Server Proxy.';

    res.status(status).json({
      error: { message },
    });
  } finally {
    clearTimeout(timeoutHandle);
    res.off('close', onResponseClose);
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');

  app.post('/api/proxy', express.json({ limit: '50mb' }), (req, res) => {
    void handleApiProxy(req, res);
  });

  if (IS_PROD) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ark Lite server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
