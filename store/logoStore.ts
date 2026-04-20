
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { originalDefaultLogoBase64 } from '../components/ui/logoData';

interface LogoState {
  currentLogo: string;
  defaultLogo: string;
  setCurrentLogo: (logoBase64: string) => void;
  setDefaultLogo: () => void; // Sets current as default
  resetToDefault: () => void; // Sets current to default
  resetToOriginal: () => void; // Resets both to original
}

export const useLogoStore = create(
  persist<LogoState>(
    (set) => ({
      currentLogo: '/paradigm-logo.png',
      defaultLogo: '/paradigm-logo.png',
      setCurrentLogo: (logoBase64) => set({ currentLogo: logoBase64 }),
      setDefaultLogo: () => set((state) => ({ defaultLogo: state.currentLogo })),
      resetToDefault: () => set((state) => ({ currentLogo: state.defaultLogo })),
      resetToOriginal: () => set({ 
          currentLogo: '/paradigm-logo.png', 
          defaultLogo: '/paradigm-logo.png' 
      }),
    }),
    {
      name: 'paradigm-app-logo',
      storage: createJSONStorage(() => localStorage),
      version: 2, // Bump version to trigger migration
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Force reset to new logo for legacy users while preserving existing state methods/structure
          return {
            ...persistedState,
            currentLogo: '/paradigm-logo.png',
            defaultLogo: '/paradigm-logo.png'
          } as LogoState;
        }
        return persistedState as LogoState;
      },
    }
  )
);