import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

function getApiBaseUrl() {
  const raw =
    process.env.API_BASE_URL ||
    process.env.API_PROXY_TARGET ||
    process.env.NEXT_PUBLIC_BACKEND_URL; // 兜底（不推荐用 public）

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
 * POST /api/seo/jobs
 * Proxy to: POST ${API_BASE_URL}/seo/jobs
 * Accepts multipart/form-data: excel, config_json, images_zip?
 */
export async function POST(req: Request) {
  try {
    const API_BASE_URL = getApiBaseUrl();

    // 读取原始 formData（Next.js Route Handler 原生支持）
    const incomingForm = await req.formData();

    // 重新组装一份（更安全，避免某些 runtime 对 incomingForm 的惰性对象出问题）
    const form = new FormData();
    for (const [key, value] of incomingForm.entries()) {
      form.append(key, value as any);
    }

    // Clerk token（如果用户已登录）
    const { getToken } = auth();
    const token = await getToken().catch(() => null);

    // 透传到后端
    const upstream = await fetch(`${API_BASE_URL}/seo/jobs`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // ⚠️ 不要手动设置 Content-Type，fetch 会自动带 boundary
      },
      body: form,
      cache: 'no-store',
    });

    const contentType = upstream.headers.get('content-type') || '';
    const status = upstream.status;

    // 统一把后端的 body 原样返回（json / text 都行）
    if (contentType.includes('application/json')) {
      const data = await upstream.json().catch(() => null);
      return NextResponse.json(data ?? { ok: false, error: 'Invalid JSON from upstream' }, { status });
    } else {
      const text = await upstream.text().catch(() => '');
      return new NextResponse(text, { status, headers: { 'content-type': contentType || 'text/plain' } });
    }
  } catch (err) {
    return jsonError('api/seo/jobs:POST', err, 500);
  }
}
