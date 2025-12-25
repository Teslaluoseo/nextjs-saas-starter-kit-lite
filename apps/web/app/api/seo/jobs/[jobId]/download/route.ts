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
 * GET /api/seo/jobs/:jobId/download
 * Proxy -> GET ${API_BASE_URL}/seo/jobs/:jobId/download
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

    const upstream = await fetch(`${API_BASE_URL}/seo/jobs/${encodeURIComponent(jobId)}/download`, {
      method: 'GET',
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(xUserId ? { 'X-User-Id': xUserId } : {}),
      },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return new NextResponse(text, {
        status: upstream.status,
        headers: { 'content-type': upstream.headers.get('content-type') || 'text/plain' },
      });
    }

    const buf = await upstream.arrayBuffer();
    const contentType =
      upstream.headers.get('content-type') ||
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const cd =
      upstream.headers.get('content-disposition') ||
      `attachment; filename="seo_result_${jobId}.xlsx"`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'content-type': contentType,
        'content-disposition': cd,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    return jsonError('api/seo/jobs/[jobId]/download:GET', err, 500);
  }
}
