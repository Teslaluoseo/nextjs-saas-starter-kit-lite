import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> },
) {
  if (!API_BASE_URL) {
    return NextResponse.json(
      { error: 'Missing API_BASE_URL in env' },
      { status: 500 },
    );
  }

  const { jobId } = await ctx.params;

  const upstream = await fetch(`${API_BASE_URL}/seo/jobs/${jobId}`, {
    method: 'GET',
    cache: 'no-store',
  });

  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}
