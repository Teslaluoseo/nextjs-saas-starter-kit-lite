import { NextRequest, NextResponse } from 'next/server';

// ✅ 强制走 Node.js（不要 Edge）
export const runtime = 'nodejs';

// ✅ 防止被静态优化/缓存导致 env 读取异常
export const dynamic = 'force-dynamic';

/**
 * ✅ 用来验证：Vercel 运行时能不能读到 API_BASE_URL
 * 访问：/api/seo/jobs
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    API_BASE_URL: process.env.API_BASE_URL ?? null,
  });
}

const API_BASE_URL = process.env.API_BASE_URL;

export async function POST(req: Request) {
  if (!API_BASE_URL) {
    return NextResponse.json(
      { error: 'Missing API_BASE_URL in env' },
      { status: 500 },
    );
  }

  const formData = await req.formData();

  const upstream = await fetch(`${API_BASE_URL}/seo/jobs`, {
    method: 'POST',
    body: formData,
  });

  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}
