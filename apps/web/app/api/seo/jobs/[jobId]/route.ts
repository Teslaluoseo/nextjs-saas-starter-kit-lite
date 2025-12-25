import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getApiBaseUrl() {
  const raw =
    process.env.API_BASE_URL ||
    process.env.API_PROXY_TARGET ||
    process.env.NEXT_PUBLIC_BACKEND_URL;

  const url = (raw ?? '').trim().replace(/\/+$/, '');
  if (!url) {
    throw new Error(
      "Missing API_BASE_URL. Set Vercel env: API_BASE_URL='https://api.blogpostaboutai.com'"
    );
  }
  return url;
}

function jsonError(where: string, err: unknown, status = 500) {
  const e = err as any;
  return NextResponse.json(
    {
      ok: false,
      where,
      error: e?.message ?? String(err),
      stack: e?.stack ?? undefined,
    },
    { status }
  );
}

/**
 * GET /api/seo/jobs/:jobId
 * Proxy -> GET ${API_BASE_URL}/seo/jobs/:jobId
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> }
) {
  try {
    const API_BASE_URL = getApiBaseUrl();
    const { jobId } = await ctx.params;

    const authHeader = req.headers.get('authorization') || '';
    const xUserId = req.headers.get('x-user-id') || '';

    const upstream = await fetch(`${API_BASE_URL}/seo/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(xUserId ? { 'X-User-Id': xUserId } : {}),
      },
      cache: 'no-store',
    });

    const ct = upstream.headers.get('content-type') || '';
    const status = upstream.status;

    if (ct.includes('application/json')) {
      const data = await upstream.json().catch(() => null);
      return NextResponse.json(data ?? { ok: false, error: 'Invalid JSON from upstream' }, { status });
    }

    const text = await upstream.text().catch(() => '');
    return new NextResponse(text, {
      status,
      headers: { 'content-type': ct || 'text/plain' },
    });
  } catch (err) {
    return jsonError('api/seo/jobs/[jobId]:GET', err, 500);
  }
}
