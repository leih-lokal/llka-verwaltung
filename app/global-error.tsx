/**
 * Last-resort error boundary
 * Replaces the root layout when it (or anything outside a nested error
 * boundary, e.g. the dashboard layout) throws. It must render its own
 * <html>/<body> and deliberately uses no app CSS or components, in case
 * those are what failed.
 */

'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  /** The error thrown while rendering */
  error: Error & { digest?: string };
  /** Re-render the root layout */
  reset: () => void;
}

const buttonStyle: React.CSSProperties = {
  font: 'inherit',
  padding: '0.5rem 1rem',
  border: '1px solid currentColor',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Anwendungsfehler:', error);
  }, [error]);

  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          boxSizing: 'border-box',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <main role="alert">
          <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem' }}>
            Etwas ist schiefgelaufen
          </h1>
          <p style={{ margin: '0 0 1.5rem' }}>
            Die Anwendung konnte wegen eines unerwarteten Fehlers nicht
            angezeigt werden.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button type="button" onClick={reset} style={buttonStyle}>
              Erneut versuchen
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={buttonStyle}
            >
              Seite neu laden
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
