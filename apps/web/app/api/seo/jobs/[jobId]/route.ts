import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEV_USER_ID = process.env.DEV_USER_ID?.trim() || 'dev';

function getApiBaseUrl() {
  const v = process.env.API_BASE_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/+$/, '') : null;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  const API_BASE_URL = getApiBaseUrl();

  if (!API_BASE_URL) {
    return NextResponse.json(
      { error: 'Missing API_BASE_URL in env' },
      { status: 500 },
    );
  }

  const { jobId } = await context.params;

  const r = await fetch(`${API_BASE_URL}/seo/jobs/${encodeURIComponent(jobId)}`, {
    method: 'GET',
    headers: {
      // ✅ dev 模式绕过 Clerk（查状态也必须带）
      'X-User-Id': DEV_USER_ID,
    },
    cache: 'no-store',
  });

  const text = await r.text();

  return new NextResponse(text, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') ?? 'application/json',
    },
  });
}
