import { NextResponse } from 'next/server';

function getTarget() {
  const t = process.env.API_PROXY_TARGET?.trim();
  if (!t) throw new Error('Missing API_PROXY_TARGET in env');
  return t.replace(/\/+$/, '');
}

export async function GET(
  _req: Request,
  { params }: { params: { jobId: string } }
) {
  const target = getTarget();
  const url = `${target}/seo/jobs/${encodeURIComponent(params.jobId)}`;

  const r = await fetch(url, { method: 'GET', cache: 'no-store' });
  const buf = await r.arrayBuffer();

  return new NextResponse(buf, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') ?? 'application/json',
    },
  });
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
