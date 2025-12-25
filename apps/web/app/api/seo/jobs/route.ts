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
 * POST /api/seo/jobs
 * Proxy -> POST ${API_BASE_URL}/seo/jobs
 * multipart/form-data: excel, config_json, images_zip?
 */
export async function POST(req: Request) {
  try {
    const API_BASE_URL = getApiBaseUrl();

    // 读入 multipart
    const incomingForm = await req.formData();

    // 重新组装 FormData（避免某些 runtime 对 incomingForm 的奇怪实现）
    const form = new FormData();
    for (const [k, v] of incomingForm.entries()) form.append(k, v as any);

    // ✅ 不用 Clerk：直接透传 Authorization / X-User-Id
    const authHeader = req.headers.get('authorization') || '';
    const xUserId = req.headers.get('x-user-id') || '';

    const upstream = await fetch(`${API_BASE_URL}/seo/jobs`, {
      method: 'POST',
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(xUserId ? { 'X-User-Id': xUserId } : {}),
        // ⚠️ 不要设置 Content-Type，fetch 会自动带 boundary
      },
      body: form,
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
    return jsonError('api/seo/jobs:POST', err, 500);
  }
}
