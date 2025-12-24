import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEV_USER_ID = process.env.DEV_USER_ID?.trim() || 'dev';

function getApiBaseUrl() {
  const v = process.env.API_BASE_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/+$/, '') : null;
}

function getCorrelationId(req: NextRequest) {
  return (
    req.headers.get('x-correlation-id') ||
    req.headers.get('x-request-id') ||
    crypto.randomUUID()
  );
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const API_BASE_URL = getApiBaseUrl();
  const correlationId = getCorrelationId(req);

  if (!API_BASE_URL) {
    return NextResponse.json(
      { error: 'Missing API_BASE_URL in env' },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }

  const { jobId } = await ctx.params;

  const r = await fetch(`${API_BASE_URL}/seo/jobs/${encodeURIComponent(jobId)}`, {
    method: 'GET',
    headers: {
      'X-User-Id': DEV_USER_ID,
      'X-Correlation-Id': correlationId,
    },
    cache: 'no-store',
  });

  const text = await r.text();

  return new NextResponse(text, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') ?? 'application/json',
      'x-correlation-id': correlationId,
    },
  });
}
