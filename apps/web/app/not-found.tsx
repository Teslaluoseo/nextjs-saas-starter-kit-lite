import Link from 'next/link';

export const dynamic = 'force-static';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', padding: 40 }}>
      <h1 style={{ fontSize: 40, marginBottom: 12 }}>404 - Page Not Found</h1>
      <p style={{ marginBottom: 20 }}>
        The page you are looking for doesn&apos;t exist.
      </p>
      <Link href="/" style={{ textDecoration: 'underline' }}>
        Back to Home
      </Link>
    </div>
  );
}
