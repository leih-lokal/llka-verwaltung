/**
 * Real-Time Connection Status Indicator
 * Shows connection status and provides reconnection functionality
 */
'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRealtimeConnection } from '@/hooks/use-realtime-connection';
import { ConnectionState } from '@/types';

// One toast for the connection state: a new state replaces it, and a
// reconnect dismisses only it, not other toasts
const TOAST_ID = 'realtime-status';

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
        id: TOAST_ID,
        description: error || 'Keine Verbindung zum Server',
        action: {
          label: 'Neu verbinden',
          onClick: reconnect,
        },
        duration: Infinity, // Keep showing until dismissed
      });
    } else if (state === ConnectionState.Disconnected) {
      toast.warning('Verbindung getrennt', {
        id: TOAST_ID,
        description: 'Echtzeit-Updates sind deaktiviert',
        duration: 5000,
      });
    } else if (state === ConnectionState.Connected) {
      // Dismiss the error/warning toast shown above
      toast.dismiss(TOAST_ID);
    }
  }, [state, error, reconnect]);

  // Don't render anything - we're using toast notifications
  return null;
}
