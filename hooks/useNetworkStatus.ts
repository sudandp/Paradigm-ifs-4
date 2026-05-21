import { useEffect, useState, useRef } from 'react';
import { Network, ConnectionStatus } from '@capacitor/network';
import { offlineDb } from '../services/offline/database';
import { syncService } from '../services/offline/syncService';

export const useNetworkStatus = () => {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const prevConnected = useRef<boolean | null>(null);

  useEffect(() => {
    // Get initial status
    Network.getStatus().then(s => {
      prevConnected.current = s.connected;
      setStatus(s);
    });

    // Listen for changes
    const listen = async () => {
      const handler = await Network.addListener('networkStatusChange', s => {
        setStatus(s);

        // Detect offline → online transition
        if (s.connected && prevConnected.current === false) {
          offlineDb.setLastOnlineTimestamp().catch(() => {});
          syncService.sync().catch(err =>
            console.warn('[useNetworkStatus] Auto-sync on reconnect failed:', err)
          );
        }

        prevConnected.current = s.connected;
      });
      return handler;
    };

    const handlerPromise = listen();

    return () => {
      handlerPromise.then(handler => handler.remove());
    };

  }, []);

  return {
    isOnline: status?.connected ?? true,
    connectionType: status?.connectionType ?? 'unknown',
  };
};
