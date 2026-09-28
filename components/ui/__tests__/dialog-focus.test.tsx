// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';

afterEach(cleanup);

/** A dialog opened from state (no Radix Trigger), like the app's dialogs. */
function DialogHarness({ onCloseAutoFocus }: { onCloseAutoFocus?: (e: Event) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Öffnen</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
          <DialogTitle>Titel</DialogTitle>
          <DialogDescription>Beschreibung</DialogDescription>
          {/* autoFocus moves focus before Radix's FocusScope would */}
          <input aria-label="Feld" autoFocus />
        </DialogContent>
      </Dialog>
    </>
  );
}

describe('DialogContent focus return', () => {
  it('returns focus to the previously focused element when there is no trigger', async () => {
    render(<DialogHarness />);
    const opener = screen.getByRole('button', { name: 'Öffnen' });
    opener.focus();
    fireEvent.click(opener);

    const field = await screen.findByRole('textbox', { name: 'Feld' });
    await waitFor(() => expect(document.activeElement).toBe(field));

    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('respects a caller onCloseAutoFocus that prevents the default', async () => {
    const onCloseAutoFocus = vi.fn((e: Event) => e.preventDefault());
    render(<DialogHarness onCloseAutoFocus={onCloseAutoFocus} />);
    const opener = screen.getByRole('button', { name: 'Öffnen' });
    opener.focus();
    fireEvent.click(opener);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalled());
    expect(document.activeElement).not.toBe(opener);
  });
});

describe('SheetContent overlayContent', () => {
  it('renders overlay content inside the dialog, reachable by assistive tech', async () => {
    render(
      <Sheet open>
        <SheetContent overlayContent={<button>Hilfe einblenden</button>}>
          <SheetTitle>Titel</SheetTitle>
          <SheetDescription>Beschreibung</SheetDescription>
        </SheetContent>
      </Sheet>
    );

    const dialog = await screen.findByRole('dialog');
    const help = screen.getByRole('button', { name: 'Hilfe einblenden' });
    expect(dialog.contains(help)).toBe(true);
    expect(help.closest('[aria-hidden="true"]')).toBeNull();
  });
});
