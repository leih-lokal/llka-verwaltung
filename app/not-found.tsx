/**
 * 404 page (exported as 404.html for static hosting)
 */

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">Seite nicht gefunden</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Unter dieser Adresse gibt es keine Seite.
      </p>
      {/* next/link prefixes the basePath (GitHub Pages) */}
      <Link href="/dashboard" className={buttonVariants()}>
        Zum Dashboard
      </Link>
    </main>
  );
}
