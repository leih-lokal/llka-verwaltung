/**
 * Identity Picker Component
 * Allows operators to set their employee shortcode for auto-filling rental forms
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { User, Check, X } from 'lucide-react';
import { useIdentity } from '@/hooks/use-identity';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function IdentityPicker() {
  const { currentIdentity, setIdentity, clearIdentity, identityHistory } = useIdentity();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when popover opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Reset input when popover closes
  useEffect(() => {
    if (!open) {
      setInputValue('');
    }
  }, [open]);

  const handleSelectIdentity = (identity: string) => {
    setIdentity(identity);
    setOpen(false);
    setInputValue('');
  };

  const handleSubmitInput = () => {
    if (inputValue.trim()) {
      handleSelectIdentity(inputValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitInput();
    }
  };

  const handleClear = () => {
    clearIdentity();
    setOpen(false);
    setInputValue('');
  };

  // Filter history based on input
  const filteredHistory = identityHistory.filter((identity) =>
    identity.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={currentIdentity ? 'default' : 'outline'}
          size="sm"
          className="h-7 gap-1.5 text-xs"
        >
          <User className="h-3.5 w-3.5" />
          {currentIdentity ? (
            <Badge variant="secondary" className="px-1.5 py-0 h-5 text-xs font-mono">
              {currentIdentity}
            </Badge>
          ) : (
            <span>Wer bist du?</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-3">
          {/* Header */}
          <div className="space-y-1">
            <h4 className="font-semibold text-sm">Identität</h4>
            <p className="text-xs text-muted-foreground">
              Wähle dein Kürzel, um schnell Leihvorgänge zu verwalten.
            </p>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Dein Kürzel..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 text-sm"
            />
            {inputValue.trim() && (
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                onClick={handleSubmitInput}
              >
                <Check className="h-3 w-3 mr-1" />
                Set as {inputValue.trim()}
              </Button>
            )}
          </div>

          {/* Recent identities */}
          {filteredHistory.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Zuletzt</p>
              <div className="space-y-1">
                {filteredHistory.map((identity) => (
                  <button
                    key={identity}
                    onClick={() => handleSelectIdentity(identity)}
                    className={cn(
                      'w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors',
                      currentIdentity === identity
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    <span className="font-mono">{identity}</span>
                    {currentIdentity === identity && (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clear button */}
          {currentIdentity && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={handleClear}
            >
              <X className="h-3 w-3 mr-1" />
              Identität zurücksetzen
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
