import { NextResponse } from 'next/server';

function getTarget() {
  const t = process.env.API_PROXY_TARGET?.trim();
  if (!t) throw new Error('Missing API_PROXY_TARGET in env');
  return t.replace(/\/+$/, '');
}

export async function POST(req: Request) {
  const target = getTarget();
  const url = `${target}/seo/jobs`;

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      // ✅ 透传 content-type（multipart/form-data 会自动带 boundary）
      ...(req.headers.get('content-type')
        ? { 'content-type': req.headers.get('content-type') as string }
        : {}),
      // ✅ 如果你后端需要鉴权 token / user id，可以继续在这里加
      ...(req.headers.get('authorization')
        ? { authorization: req.headers.get('authorization') as string }
        : {}),
      ...(req.headers.get('x-user-id')
        ? { 'x-user-id': req.headers.get('x-user-id') as string }
        : {}),
    },
    body: await req.arrayBuffer(),
  });

  const buf = await r.arrayBuffer();
  return new NextResponse(buf, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') ?? 'application/json',
    },
  });
}

export async function OPTIONS() {
  // ✅ 解决浏览器预检（即使同源一般也不会触发，但保险）
  return NextResponse.json({}, { status: 200 });
}
