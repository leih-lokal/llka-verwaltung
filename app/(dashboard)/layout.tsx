/**
 * Dashboard layout with top navigation
 */

'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { GlobalCommandMenu } from '@/components/search/global-command-menu';
import { QuickFindModal } from '@/components/search/quick-find-modal';
import { SequentialModeModal } from '@/components/sequential-mode/sequential-mode-modal';
import { RealtimeStatus } from '@/components/ui/realtime-status';
import { OnPremisesNotification } from '@/components/notifications/on-premises-notification';
import { QuickFindProvider, useQuickFind } from '@/hooks/use-quick-find';
import { IdentityProvider, useIdentity } from '@/hooks/use-identity';
import { SequentialModeProvider, useSequentialMode } from '@/hooks/use-sequential-mode';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  KeyboardShortcutsProvider,
  useKeyboardShortcuts,
} from '@/hooks/use-keyboard-shortcuts';
import { CommandMenuProvider, useCommandMenu } from '@/hooks/use-command-menu';
import { KeyboardShortcutsReferenceProvider } from '@/components/keyboard-shortcuts/keyboard-shortcuts-reference';
import { SettingsProvider, useSettings } from '@/hooks/use-settings';

/**
 * Bridge component to connect keyboard shortcuts to modal states
 * Must be inside all provider contexts to access their setters
 */
function KeyboardShortcutBridge() {
  const keyboardShortcuts = useKeyboardShortcuts();
  const commandMenu = useCommandMenu();
  const quickFind = useQuickFind();
  const sequentialMode = useSequentialMode();
  const identity = useIdentity();

  // Connect modal setters to keyboard shortcuts context
  useEffect(() => {
    keyboardShortcuts.registerCommandMenu(commandMenu.setOpen);
    keyboardShortcuts.registerQuickFind(quickFind.setOpen);
    keyboardShortcuts.registerSequentialMode(sequentialMode.setOpen);
    keyboardShortcuts.registerIdentityPicker(identity.setPopoverOpen);
  }, [commandMenu, quickFind, sequentialMode, identity, keyboardShortcuts]);

  return null;
}

/**
 * Component to check if setup is complete and redirect if needed
 * Must be inside SettingsProvider
 */
function SetupRedirectGuard({ children }: { children: React.ReactNode }) {
  const { settings, isLoading, isLoaded } = useSettings();
  const router = useRouter();
  const pathname = usePathname();

  const isSetupPage = pathname?.startsWith('/setup');

  useEffect(() => {
    // Don't redirect while loading or if already on setup page
    if (isLoading || !isLoaded || isSetupPage) return;

    // Redirect to setup if not complete
    if (!settings.setup_complete) {
      router.replace('/setup');
    }
  }, [settings.setup_complete, isLoading, isLoaded, isSetupPage, router]);

  // Show loading state while settings are loading
  if (isLoading || !isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Lädt Einstellungen...</p>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting (prevents flash)
  if (!settings.setup_complete && !isSetupPage) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Inner layout component that uses settings context
 */
function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSetupPage = pathname?.startsWith('/setup');

  // Setup page gets minimal layout (no navbar, no modals)
  if (isSetupPage) {
    return <>{children}</>;
  }

  // Regular pages get full layout with setup redirect guard
  return (
    <SetupRedirectGuard>
      <KeyboardShortcutsProvider>
        <KeyboardShortcutsReferenceProvider>
          <IdentityProvider>
            <SequentialModeProvider>
              <CommandMenuProvider>
                <QuickFindProvider>
                  <div className="flex h-screen flex-col">
                    <Navbar />
                    <main className="flex-1 overflow-y-auto pt-16">
                      {children}
                    </main>
                    <GlobalCommandMenu />
                    <QuickFindModal />
                    <SequentialModeModal />
                    <RealtimeStatus />
                    <OnPremisesNotification />
                    <KeyboardShortcutBridge />
                  </div>
                </QuickFindProvider>
              </CommandMenuProvider>
            </SequentialModeProvider>
          </IdentityProvider>
        </KeyboardShortcutsReferenceProvider>
      </KeyboardShortcutsProvider>
    </SetupRedirectGuard>
  );
}

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
    <SettingsProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </SettingsProvider>
  );
}
