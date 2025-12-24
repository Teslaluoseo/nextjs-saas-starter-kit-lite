import type { NextRequest } from 'next/server';
import { NextResponse, URLPattern } from 'next/server';

import { CsrfError, createCsrfProtect } from '@edge-csrf/nextjs';

import { checkRequiresMultiFactorAuthentication } from '@kit/supabase/check-requires-mfa';
import { createMiddlewareClient } from '@kit/supabase/middleware-client';

import appConfig from '~/config/app.config';
import pathsConfig from '~/config/paths.config';

const CSRF_SECRET_COOKIE = 'csrfSecret';
const NEXT_ACTION_HEADER = 'next-action';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|images|locales|assets|api(?:/.*)?).*)',
  ],
};

export async function middleware(request: NextRequest) {
  // ✅ 永远不要让 middleware 抛异常导致 Vercel 500
  try {
    const requestHeaders = new Headers(request.headers);
    setRequestId(requestHeaders);

    const baseResponse = NextResponse.next({
      request: { headers: requestHeaders },
    });

    const csrfResponse = await withCsrfMiddleware(request, baseResponse);

    const cid = requestHeaders.get('x-correlation-id');
    if (cid && !csrfResponse.headers.has('x-correlation-id')) {
      csrfResponse.headers.set('x-correlation-id', cid);
    }

    // ✅ Supabase env 不完整就直接跳过 Supabase 鉴权（否则 100% 炸）
    if (!isSupabaseConfigured()) {
      return csrfResponse;
    }

    // handle patterns for specific routes
    const handlePattern = matchUrlPattern(request.url);

    if (handlePattern) {
      const patternHandlerResponse = await handlePattern(request, csrfResponse);
      if (patternHandlerResponse) return patternHandlerResponse;
    }

    if (isServerAction(request)) {
      csrfResponse.headers.set('x-action-path', request.nextUrl.pathname);
    }

    return csrfResponse;
  } catch (err) {
    // fail-open：返回 next，避免整个站 500
    // 你也可以在这里加一个 header 用于排查
    const res = NextResponse.next();
    res.headers.set('x-mw-error', '1');
    return res;
  }
}

function isSupabaseConfigured() {
  // Makerkit/Supabase 常用这两个；只要没配就不要跑 supabase middleware client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return Boolean(url && anon);
}

const getUser = async (request: NextRequest, response: NextResponse) => {
  const supabase = createMiddlewareClient(request, response);
  return supabase.auth.getClaims();
};

async function withCsrfMiddleware(
  request: NextRequest,
  response = new NextResponse(),
) {
  const csrfProtect = createCsrfProtect({
    cookie: {
      secure: appConfig.production,
      name: CSRF_SECRET_COOKIE,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    },
    ignoreMethods: isServerAction(request) ? ['POST'] : ['GET', 'HEAD', 'OPTIONS'],
  });

  try {
    await csrfProtect(request, response);
    return response;
  } catch (error) {
    if (error instanceof CsrfError) {
      return handleCsrfFailure(request);
    }
    throw error;
  }
}

function handleCsrfFailure(request: NextRequest) {
  const accept = request.headers.get('accept') ?? '';
  const isPageNavigation =
    accept.includes('text/html') ||
    request.headers.get('sec-fetch-dest') === 'document';

  if (isPageNavigation) {
    const url = new URL(pathsConfig.auth.signIn, request.nextUrl.origin);
    url.searchParams.set('next', request.nextUrl.pathname);
    url.searchParams.set('error', 'csrf');
    return NextResponse.redirect(url.href);
  }

  return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
}

function isServerAction(request: NextRequest) {
  return request.headers.has(NEXT_ACTION_HEADER);
}

function redirectWithPreservedHeaders(
  from: NextResponse,
  to: string,
  status?: 301 | 302 | 303 | 307 | 308,
) {
  const r = NextResponse.redirect(to, status);

  const setCookie = from.headers.get('set-cookie');
  if (setCookie) r.headers.set('set-cookie', setCookie);

  const cid = from.headers.get('x-correlation-id');
  if (cid) r.headers.set('x-correlation-id', cid);

  return r;
}

function getPatterns() {
  return [
    {
      pattern: new URLPattern({ pathname: '/auth/*?' }),
      handler: async (req: NextRequest, res: NextResponse) => {
        // 如果 getUser 也失败，不要让 middleware 崩
        try {
          const { data } = await getUser(req, res);
          if (!data?.claims) return;

          const isVerifyMfa = req.nextUrl.pathname === pathsConfig.auth.verifyMfa;
          if (!isVerifyMfa) {
            const to = new URL(pathsConfig.app.home, req.nextUrl.origin).href;
            return redirectWithPreservedHeaders(res, to);
          }
        } catch {
          return;
        }
      },
    },
    {
      pattern: new URLPattern({ pathname: '/home/*?' }),
      handler: async (req: NextRequest, res: NextResponse) => {
        try {
          const { data } = await getUser(req, res);
          const origin = req.nextUrl.origin;
          const next = req.nextUrl.pathname;

          if (!data?.claims) {
            const signIn = pathsConfig.auth.signIn;
            const redirectPath = `${signIn}?next=${encodeURIComponent(next)}`;
            const to = new URL(redirectPath, origin).href;
            return redirectWithPreservedHeaders(res, to);
          }

          const supabase = createMiddlewareClient(req, res);
          const requiresMfa = await checkRequiresMultiFactorAuthentication(supabase);

          if (requiresMfa) {
            const to = new URL(pathsConfig.auth.verifyMfa, origin).href;
            return redirectWithPreservedHeaders(res, to);
          }
        } catch {
          // fail-open：不要因为 auth/mfa 检查挂了就 500
          return;
        }
      },
    },
  ];
}

function matchUrlPattern(url: string) {
  const patterns = getPatterns();
  const input = url.split('?')[0];

  for (const pattern of patterns) {
    const patternResult = pattern.pattern.exec(input);
    if (patternResult !== null && 'pathname' in patternResult) {
      return pattern.handler;
    }
  }
}

function setRequestId(headers: Headers) {
  if (!headers.has('x-correlation-id')) {
    headers.set('x-correlation-id', crypto.randomUUID());
  }
}
