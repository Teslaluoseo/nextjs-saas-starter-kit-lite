import { NextResponse } from 'next/server';

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
