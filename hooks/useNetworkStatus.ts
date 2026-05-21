import { useEffect, useState, useRef } from 'react';
import { Network, ConnectionStatus } from '@capacitor/network';

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

        // Transition detected
        if (s.connected && prevConnected.current === false) {
          console.log('[useNetworkStatus] Back online');
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
