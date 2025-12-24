import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const getApiBaseUrl = () => {
  const v = process.env.API_BASE_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/+$/, '') : null; // 去掉末尾 /
};

/**
 * ✅ 用来验证 Vercel 运行时是否能读到 API_BASE_URL
 * 访问：GET /api/seo/jobs
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    API_BASE_URL: getApiBaseUrl(),
  });
}

/**
 * ✅ 上传 Excel → 转发到 Railway: POST {API_BASE_URL}/seo/jobs
 * 前端发 multipart/form-data，字段名 file
 */
export async function POST(req: NextRequest) {
  const API_BASE_URL = getApiBaseUrl();

  if (!API_BASE_URL) {
    return NextResponse.json(
      { error: 'Missing API_BASE_URL in env' },
      { status: 500 },
    );
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Missing file in form-data (field name must be "file")' },
      { status: 400 },
    );
  }

  const upstream = new FormData();
  upstream.set('file', file, file.name);

  // ✅ 转发到 FastAPI
  const r = await fetch(`${API_BASE_URL}/seo/jobs`, {
    method: 'POST',
    body: upstream,
  });

  const text = await r.text();

  return new NextResponse(text, {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
  });
}
