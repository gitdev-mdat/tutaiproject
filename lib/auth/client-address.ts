/**
 * The caller's address for rate limiting. On Vercel the platform sets
 * x-forwarded-for and x-real-ip itself, so the first entry is the client.
 * Elsewhere the headers may be absent or client-supplied; callers then fall
 * back to per-account limits only.
 */
export function clientAddressFrom(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || null;
}
