/**
 * Keyboard Shortcuts Reference Dialog
 * Shows all available shortcuts organized by category
 * Opens with / key or via overflow menu
 */

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Keyboard, Plus, FolderOpen, Navigation, Eye, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SHORTCUT_REGISTRY } from '@/lib/keyboard-shortcuts/shortcut-registry';
import { shouldIgnoreShortcutKey } from '@/lib/keyboard-shortcuts/input-detection';
import { areSingleKeyShortcutsEnabled } from '@/lib/keyboard-shortcuts/preferences';
import { useSingleKeyShortcutsEnabled } from '@/hooks/use-keyboard-shortcuts';

// Context for keyboard shortcuts reference
interface KeyboardShortcutsReferenceContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const KeyboardShortcutsReferenceContext =
  createContext<KeyboardShortcutsReferenceContextValue | null>(null);

export function KeyboardShortcutsReferenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { open, setOpen } = useKeyboardShortcutsReference();

  return (
    <KeyboardShortcutsReferenceContext.Provider value={{ open, setOpen }}>
      {children}
      <KeyboardShortcutsReference open={open} onOpenChange={setOpen} />
    </KeyboardShortcutsReferenceContext.Provider>
  );
}

export function useKeyboardShortcutsReferenceContext() {
  const context = useContext(KeyboardShortcutsReferenceContext);
  if (!context) {
    throw new Error(
      'useKeyboardShortcutsReferenceContext must be used within KeyboardShortcutsReferenceProvider'
    );
  }
  return context;
}

interface ShortcutReferenceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsReference({
  open,
  onOpenChange,
}: ShortcutReferenceProps) {
  const [singleKeyEnabled, setSingleKeyEnabled] = useSingleKeyShortcutsEnabled();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Tastaturkürzel
          </DialogTitle>
          <DialogDescription>
            Alle verfügbaren Shortcuts für schnellere Navigation und Verwaltung
          </DialogDescription>
        </DialogHeader>

        {/* WCAG 2.1.4: single-key shortcuts must be switchable off */}
        <div className="flex items-start justify-between gap-4 border px-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="single-key-shortcuts">Tastaturkürzel aktiv</Label>
            <p
              id="single-key-shortcuts-description"
              className="text-xs text-muted-foreground"
            >
              Alle Kürzel bestehen aus einzelnen Tasten ohne Strg/Alt/⌘ und
              können versehentlich auslösen, z.&nbsp;B. bei Spracheingabe.
              Diese Übersicht bleibt über das Menü erreichbar.
            </p>
          </div>
          <Switch
            id="single-key-shortcuts"
            checked={singleKeyEnabled}
            onCheckedChange={setSingleKeyEnabled}
            aria-describedby="single-key-shortcuts-description"
          />
        </div>

        <div className="space-y-6 mt-4">
          {/* N - Create shortcuts */}
          <ShortcutSection
            title="Erstellen"
            icon={<Plus className="h-4 w-4" />}
            firstKey="N"
            shortcuts={SHORTCUT_REGISTRY.n}
          />

          {/* O - Open shortcuts */}
          <ShortcutSection
            title="Öffnen"
            icon={<FolderOpen className="h-4 w-4" />}
            firstKey="O"
            shortcuts={SHORTCUT_REGISTRY.o}
            extraShortcuts={[
              {
                keys: ['Shift', 'Shift'],
                description: 'Suche öffnen (Alternative)',
              },
            ]}
          />

          {/* G - Go to shortcuts */}
          <ShortcutSection
            title="Gehe zu"
            icon={<Navigation className="h-4 w-4" />}
            firstKey="G"
            shortcuts={SHORTCUT_REGISTRY.g}
          />

          {/* V - View shortcuts */}
          <ShortcutSection
            title="Ansicht"
            icon={<Eye className="h-4 w-4" />}
            firstKey="V"
            shortcuts={SHORTCUT_REGISTRY.v}
          />
        </div>

        {/* Footer note */}
        {singleKeyEnabled && (
          <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
            <p>
              <strong>Tipp:</strong> Drücke{' '}
              <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono">
                /
              </kbd>{' '}
              um diese Ansicht jederzeit zu öffnen
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ShortcutSectionProps {
  title: string;
  icon: React.ReactNode;
  firstKey: string;
  shortcuts: Array<{
    sequence: [string, string];
    description: string;
  }>;
  extraShortcuts?: Array<{
    keys: string[];
    description: string;
  }>;
}

function ShortcutSection({
  title,
  icon,
  firstKey,
  shortcuts,
  extraShortcuts,
}: ShortcutSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 font-semibold text-sm">
        {icon}
        <span>{title}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {shortcuts.map((shortcut) => (
          <ShortcutItem
            key={shortcut.sequence.join('-')}
            firstKey={firstKey}
            secondKey={shortcut.sequence[1]}
            description={shortcut.description}
          />
        ))}
        {extraShortcuts?.map((extra, index) => (
          <div
            key={index}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <span className="text-sm">{extra.description}</span>
            <div className="flex items-center gap-1">
              {extra.keys.map((key, i) => (
                <kbd
                  key={i}
                  className="px-2 py-1 bg-background border border-border rounded font-mono text-xs font-semibold"
                >
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ShortcutItemProps {
  firstKey: string;
  secondKey: string;
  description: string;
}

function ShortcutItem({ firstKey, secondKey, description }: ShortcutItemProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <span className="text-sm">{description}</span>
      <div className="flex items-center gap-1">
        <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-xs font-semibold">
          {firstKey.toUpperCase()}
        </kbd>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-xs font-semibold">
          {secondKey.toUpperCase()}
        </kbd>
      </div>
    </div>
  );
}

/**
 * Hook to manage keyboard shortcuts reference state
 * Handles / key detection to open the reference
 */
export function useKeyboardShortcutsReference() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with / key (unless turned off, typing, or inside a dialog/widget)
      if (
        e.key === '/' &&
        areSingleKeyShortcutsEnabled() &&
        !shouldIgnoreShortcutKey(e)
      ) {
        e.preventDefault();
        setOpen(true);
      }

      // Close with Escape
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return {
    open,
    setOpen,
  };
}
