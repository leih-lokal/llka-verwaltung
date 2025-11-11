/**
 * Dashboard layout with top navigation
 */

'use client';

import { Navbar } from '@/components/layout/navbar';
import { GlobalCommandMenu } from '@/components/search/global-command-menu';
import { QuickFindModal } from '@/components/search/quick-find-modal';
import { RealtimeStatus } from '@/components/ui/realtime-status';
import { QuickFindProvider } from '@/hooks/use-quick-find';
import { IdentityProvider } from '@/hooks/use-identity';
import { useRequireAuth } from '@/hooks/use-auth';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useRequireAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Lädt...</p>
        </div>
      </div>
    );
  }

  return (
    <IdentityProvider>
      <QuickFindProvider>
        <div className="flex h-screen flex-col">
          <Navbar />
          <main className="flex-1 overflow-y-auto pt-16">
            {children}
          </main>
          <GlobalCommandMenu />
          <QuickFindModal />
          <RealtimeStatus />
        </div>
      </QuickFindProvider>
    </IdentityProvider>
  );
}
