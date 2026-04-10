'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#111111',
          color: '#f5f5f5',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          textAlign: 'center',
          padding: '0 1.5rem',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="32"
            height="32"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="#f87171"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h1 style={{ marginTop: 24, fontSize: 24, fontWeight: 700 }}>
          Something went wrong
        </h1>

        <p style={{ marginTop: 12, maxWidth: 400, color: 'rgba(245,245,245,0.6)' }}>
          A critical error occurred. Please try again.
        </p>

        <button
          onClick={reset}
          style={{
            marginTop: 32,
            padding: '12px 24px',
            borderRadius: 9999,
            border: 'none',
            backgroundColor: '#f5f5f5',
            color: '#111111',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
