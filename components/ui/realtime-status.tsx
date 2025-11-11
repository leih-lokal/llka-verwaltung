/**
 * Real-Time Connection Status Indicator
 * Shows connection status and provides reconnection functionality
 */
'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { Wifi, WifiOff } from 'lucide-react';
import { useRealtimeConnection } from '@/hooks/use-realtime-connection';
import { ConnectionState } from '@/types';

/**
 * Connection status indicator that only shows when there's a problem
 * Uses toast notifications for connection changes
 */
export function RealtimeStatus() {
  const { state, error, reconnect } = useRealtimeConnection();

  // Show toast notifications on connection state changes
  useEffect(() => {
    if (state === ConnectionState.Error) {
      toast.error('Echtzeit-Verbindung unterbrochen', {
        description: error || 'Keine Verbindung zum Server',
        action: {
          label: 'Neu verbinden',
          onClick: reconnect,
        },
        duration: Infinity, // Keep showing until dismissed
      });
    } else if (state === ConnectionState.Disconnected) {
      toast.warning('Verbindung getrennt', {
        description: 'Echtzeit-Updates sind deaktiviert',
        duration: 5000,
      });
    } else if (state === ConnectionState.Connected) {
      // Dismiss any existing error toasts
      toast.dismiss();
    }
  }, [state, error, reconnect]);

  // Don't render anything - we're using toast notifications
  return null;
}

/**
 * Connection status badge that always shows in the UI
 * Use this if you want a visible indicator
 */
export function RealtimeStatusBadge() {
  const { state, reconnect } = useRealtimeConnection();

  if (state === ConnectionState.Connected) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600" title="Echtzeit verbunden">
        <Wifi className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Live</span>
      </div>
    );
  }

  if (state === ConnectionState.Disconnected || state === ConnectionState.Error) {
    return (
      <button
        onClick={reconnect}
        className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors"
        title="Echtzeit getrennt - Klicken zum Neu verbinden"
      >
        <WifiOff className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Offline</span>
      </button>
    );
  }

  if (state === ConnectionState.Connecting) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Verbinde...">
        <div className="h-3.5 w-3.5 animate-spin border-2 border-current border-t-transparent rounded-full" />
        <span className="hidden sm:inline">Verbinde...</span>
      </div>
    );
  }

  return null;
}
