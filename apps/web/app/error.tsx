'use client';

import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ minHeight: '100vh', padding: 40 }}>
      <h1 style={{ fontSize: 40, marginBottom: 12 }}>Something went wrong</h1>

      <p style={{ marginBottom: 12 }}>
        Please try again. If the problem persists, contact support.
      </p>

      <pre
        style={{
          whiteSpace: 'pre-wrap',
          background: '#f5f5f5',
          padding: 12,
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        {error?.message ?? 'Unknown error'}
      </pre>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => reset()}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #ccc',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>

        <Link href="/" style={{ padding: '10px 14px', textDecoration: 'underline' }}>
          Home
        </Link>
      </div>
    </div>
  );
}
