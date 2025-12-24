import type { NextRequest } from 'next/server';
import { NextResponse, URLPattern } from 'next/server';

import { CsrfError, createCsrfProtect } from '@edge-csrf/nextjs';
import { getAuth } from '@clerk/nextjs/server';

import appConfig from '~/config/app.config';
import pathsConfig from '~/config/paths.config';

const CSRF_SECRET_COOKIE = 'csrfSecret';
const NEXT_ACTION_HEADER = 'next-action';

export const config = {
  /**
   * ✅ Exclude Next internals, static assets, and API routes.
   * NOTE: this is a regex string; avoid globs like api/*
   */
  matcher: [
    '/((?!_next/static|_next/image|images|locales|assets|api(?:/.*)?).*)',
  ],
};

export async function middleware(request: NextRequest) {
  /**
   * ✅ Next.js middleware 里 request.headers 是只读的
   * ✅ 正确方式：clone headers → set → NextResponse.next({ request: { headers } })
   */
  const requestHeaders = new Headers(request.headers);

  // set a unique request ID for each request (for tracing)
  setRequestId(requestHeaders);

  // build a base response that includes the mutated request headers
  const baseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // apply CSRF protection for mutating requests
  const csrfResponse = await withCsrfMiddleware(request, baseResponse);

  // ✅ also echo correlation id back to the response for easier tracing
  const cid = requestHeaders.get('x-correlation-id');
  if (cid && !csrfResponse.headers.has('x-correlation-id')) {
    csrfResponse.headers.set('x-correlation-id', cid);
  }

  // handle patterns for specific routes
  const handlePattern = matchUrlPattern(request.url);

  if (handlePattern) {
    const patternHandlerResponse = await handlePattern(request, csrfResponse);

    if (patternHandlerResponse) {
      return patternHandlerResponse;
    }
  }

  // If server action, append action path to response headers
  if (isServerAction(request)) {
    csrfResponse.headers.set('x-action-path', request.nextUrl.pathname);
  }

  return csrfResponse;
}

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
    /**
     * ✅ Ignore CSRF errors for server actions since protection is built-in
     * Server Actions are POST with `next-action` header.
     */
    ignoreMethods: isServerAction(request)
      ? ['POST']
      : ['GET', 'HEAD', 'OPTIONS'],
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

  // ✅ Better UX for page navigations; keep JSON for API-ish calls
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

/**
 * Redirect helper that preserves important headers/cookies
 * from a previous response (e.g. CSRF cookie).
 */
function redirectWithPreservedHeaders(
  from: NextResponse,
  to: string,
  status?: 301 | 302 | 303 | 307 | 308,
) {
  const r = NextResponse.redirect(to, status);

  // Preserve Set-Cookie (critical for csrf)
  const setCookie = from.headers.get('set-cookie');
  if (setCookie) {
    r.headers.set('set-cookie', setCookie);
  }

  // Preserve correlation id for tracing
  const cid = from.headers.get('x-correlation-id');
  if (cid) r.headers.set('x-correlation-id', cid);

  return r;
}

/**
 * Clerk auth check (Edge-safe)
 */
function isLoggedIn(req: NextRequest) {
  const { userId } = getAuth(req);
  return Boolean(userId);
}

/**
 * Define URL patterns and their corresponding handlers.
 */
function getPatterns() {
  return [
    {
      pattern: new URLPattern({ pathname: '/auth/*?' }),
      handler: async (req: NextRequest, res: NextResponse) => {
        // ✅ 已登录就别进登录/注册页了，直接回到 /home
        if (isLoggedIn(req)) {
          const to = new URL(pathsConfig.app.home, req.nextUrl.origin).href;
          return redirectWithPreservedHeaders(res, to);
        }
      },
    },
    {
      pattern: new URLPattern({ pathname: '/home/*?' }),
      handler: async (req: NextRequest, res: NextResponse) => {
        const origin = req.nextUrl.origin;
        const next = req.nextUrl.pathname;

        // ✅ 未登录 → 去登录页
        if (!isLoggedIn(req)) {
          const signIn = pathsConfig.auth.signIn;
          const redirectPath = `${signIn}?next=${encodeURIComponent(next)}`;
          const to = new URL(redirectPath, origin).href;
          return redirectWithPreservedHeaders(res, to);
        }
      },
    },
  ];
}

/**
 * Match URL patterns to specific handlers.
 */
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

/**
 * Set a unique request ID for each request.
 * ✅ must mutate cloned headers, not request.headers directly
 */
function setRequestId(headers: Headers) {
  if (!headers.has('x-correlation-id')) {
    headers.set('x-correlation-id', crypto.randomUUID());
  }
}
