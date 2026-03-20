import { useEffect, useState } from 'react';
import { Network, ConnectionStatus } from '@capacitor/network';

export const useNetworkStatus = () => {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    // Get initial status
    Network.getStatus().then(status => setStatus(status));

    // Listen for changes
    const listen = async () => {
      const handler = await Network.addListener('networkStatusChange', status => {
        setStatus(status);
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
