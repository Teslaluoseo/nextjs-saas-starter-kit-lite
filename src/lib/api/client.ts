import { auth } from '@clerk/nextjs/server';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL!;

export async function apiFetch(
  path: string,
  options: RequestInit = {},
) {
  const { getToken } = auth();
  const token = await getToken();

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${BACKEND}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json();
}
