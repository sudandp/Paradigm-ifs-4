import { ComponentType, lazy } from 'react';

/**
 * A wrapper around React.lazy that handles "Failed to fetch dynamically imported module" errors.
 * This error often occurs in production when a new deployment happens and a user's browser
 * tries to load an old chunk that no longer exists.
 */
export const lazyWithRetry = (
  componentImport: () => Promise<{ default: ComponentType<any> }>,
  retriesLeft = 1
) => {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      if (retriesLeft > 0) {
        console.warn(
          `Failed to load chunk, retrying... (${retriesLeft} retries left)`,
          error
        );
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // If it's a dynamic import failure, try to reload once
        if (error instanceof TypeError || (error as any).name === 'ChunkLoadError') {
          console.error('Chunk loading failed. Reloading page...');
          window.location.reload();
          
          // Return a pending promise that never resolves since the page is reloading
          return new Promise(() => {});
        }
        
        return componentImport();
      }
      
      console.error('Max retries reached for lazy load.', error);
      throw error;
    }
  });
};
