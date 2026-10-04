/**
 * vercel.json rewrites /api/<path> to /api?__path=<path>. Rebuild the original
 * URL so the app's routes match whether or not the platform keeps the
 * original path on rewrites.
 */
export function restoreRewrittenUrl(request: Request): Request {
  const url = new URL(request.url);
  const rewrittenPath = url.searchParams.get('__path');
  if (rewrittenPath === null) return request;
  url.searchParams.delete('__path');
  if (url.pathname === '/api' || url.pathname === '/api/') url.pathname = `/api/${rewrittenPath}`;
  return new Request(url, request);
}
