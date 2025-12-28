/**
 * Help Button Component
 * Displays documentation from markdown files in a modal dialog
 */

'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface HelpButtonProps {
  /** Name of the documentation file (without .md extension) */
  docName: string;
}

export function HelpButton({ docName }: HelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocumentation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get basePath for GitHub Pages deployment support
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const response = await fetch(`${basePath}/docs/${docName}.md`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Dokumentation nicht verfügbar.');
        }
        throw new Error(`Fehler beim Laden (${response.status})`);
      }

      const text = await response.text();
      setContent(text);
    } catch (err) {
      console.error('Error loading documentation:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Fehler beim Laden der Dokumentation. Bitte versuche es erneut.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !content && !error) {
      // Fetch documentation when modal opens for the first time
      fetchDocumentation();
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(true)}
        aria-label="Hilfe anzeigen"
        className="h-10 w-10"
      >
        <HelpCircle className="size-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hilfe</DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            )}

            {error && (
              <div className="text-center py-8">
                <p className="text-destructive font-medium">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchDocumentation}
                  className="mt-4"
                >
                  Erneut versuchen
                </Button>
              </div>
            )}

            {!isLoading && !error && content && (
              <div className="markdown-prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
