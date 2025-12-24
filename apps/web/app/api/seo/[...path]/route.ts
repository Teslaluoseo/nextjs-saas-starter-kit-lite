import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

/**
 * 小白说明：
 * 浏览器只请求 /api/seo/xxx
 * 这里在服务器里转发到 Railway 后端
 * 浏览器不会跨域 → 不会有 CORS
 */

function mustGetEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function proxy(req: Request, method: string, path: string[]) {
  const backend = mustGetEnv('API_PROXY_TARGET'); 
  const url = new URL(`/seo/${path.join('/')}`, backend);

  // 透传 query 参数
  const incoming = new URL(req.url);
  incoming.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  // Clerk 登录 token（有就用，没有就算）
  const { getToken } = await auth();
  const token = await getToken();

  // dev 模式下你填的 X-User-Id
  const devUserId = req.headers.get('x-user-id');

  const headers: Record<string, string> = {};
  if (token) headers['authorization'] = `Bearer ${token}`;
  if (!token && devUserId) headers['x-user-id'] = devUserId;

  let body: any = undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    body = await req.arrayBuffer();
    const ct = req.headers.get('content-type');
    if (ct) headers['content-type'] = ct;
  }

  const r = await fetch(url.toString(), {
    method,
    headers,
    body,
  });

  const data = await r.arrayBuffer();
  const res = new NextResponse(data, { status: r.status });

  const ct = r.headers.get('content-type');
  if (ct) res.headers.set('content-type', ct);

  const cd = r.headers.get('content-disposition');
  if (cd) res.headers.set('content-disposition', cd);

  return res;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function GET(req: Request, ctx: { params: { path: string[] } }) {
  return proxy(req, 'GET', ctx.params.path);
}

export async function POST(req: Request, ctx: { params: { path: string[] } }) {
  return proxy(req, 'POST', ctx.params.path);
}

export async function PUT(req: Request, ctx: { params: { path: string[] } }) {
  return proxy(req, 'PUT', ctx.params.path);
}

export async function PATCH(req: Request, ctx: { params: { path: string[] } }) {
  return proxy(req, 'PATCH', ctx.params.path);
}

export async function DELETE(req: Request, ctx: { params: { path: string[] } }) {
  return proxy(req, 'DELETE', ctx.params.path);
}
