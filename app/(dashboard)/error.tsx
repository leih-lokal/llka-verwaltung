/**
 * Error boundary for dashboard pages
 * Catches render errors in a page so the navigation stays usable instead of
 * the whole app going blank.
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, LayoutDashboard, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardErrorProps {
  /** The error thrown while rendering */
  error: Error & { digest?: string };
  /** Re-render the segment */
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error('Seitenfehler:', error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <AlertTriangle className="h-10 w-10 text-primary" aria-hidden="true" />
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Etwas ist schiefgelaufen</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Diese Seite konnte wegen eines unerwarteten Fehlers nicht angezeigt
          werden. Bleibt der Fehler bestehen, hilft oft ein Neuladen der Seite.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw aria-hidden="true" />
          Erneut versuchen
        </Button>
        <Button variant="outline" asChild>
          {/* next/link prefixes the basePath (GitHub Pages) */}
          <Link href="/dashboard">
            <LayoutDashboard aria-hidden="true" />
            Zum Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
