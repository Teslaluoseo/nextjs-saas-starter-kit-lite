import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

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
  if (!url.startsWith('https://') && process.env.NODE_ENV === 'production') {
    throw new Error(`API_BASE_URL must be https in production. Got: ${url}`);
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
 * Proxy to: GET ${API_BASE_URL}/seo/jobs/:jobId/download
 * Returns xlsx stream
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> }
) {
  try {
    const API_BASE_URL = getApiBaseUrl();
    const { jobId } = await ctx.params;

    const { getToken } = auth();
    const token = await getToken().catch(() => null);

    const upstream = await fetch(`${API_BASE_URL}/seo/jobs/${encodeURIComponent(jobId)}/download`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

    // 让浏览器以附件下载
    const filename =
      upstream.headers.get('content-disposition') ||
      `attachment; filename="seo_result_${jobId}.xlsx"`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'content-type': contentType,
        'content-disposition': filename,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    return jsonError('api/seo/jobs/[jobId]/download:GET', err, 500);
  }
}
